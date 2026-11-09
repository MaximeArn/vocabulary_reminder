import { db } from "../data/db";
import { buildCards, type Card } from "../domain/card";
import { reminderSummary } from "../domain/reminder";
import { CATEGORY_MODELS } from "../categories/models";
import { supabase } from "./supabase";

/** Heure du rappel quotidien : réglage synchronisé entre appareils. */
export const REMINDER_TIME_KEY = "review.reminderTime";
export const DEFAULT_REMINDER_TIME = "20:00";
/** Dernier état publié (propre à l'appareil : préfixe « sync. ») ; évite les envois inutiles. */
const PUBLISHED_KEY = "sync.reminderPublished";

/** Fiches révisables : celles des catégories qui ont assez de fiches pour composer des questions. */
function reviewable(cards: Card[]): Card[] {
  const kinds = new Set(
    CATEGORY_MODELS.filter((model) =>
      model.canBuildQuestions(cards.filter((card) => card.item.kind === model.kind).map((card) => card.item)),
    ).map((model) => model.kind),
  );
  return cards.filter((card) => kinds.has(card.item.kind));
}

/**
 * Publie l'état utile au rappel quotidien (heure, fuseau, fiches dues par jour,
 * dernier jour révisé, série), après chaque synchronisation réussie : le serveur
 * décide ensuite seul, même si l'app reste fermée.
 */
export async function publishReminder(userId: string): Promise<void> {
  const [items, reviews, timeSetting, published] = await Promise.all([
    db.items.toArray(),
    db.reviews.toArray(),
    db.settings.get(REMINDER_TIME_KEY),
    db.settings.get(PUBLISHED_KEY),
  ]);
  const row = {
    user_id: userId,
    time: typeof timeSetting?.value === "string" ? timeSetting.value : DEFAULT_REMINDER_TIME,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
    ...reminderSummary(reviewable(buildCards(items, reviews)), reviews),
  };
  // Le compte fait partie de la signature : un autre compte sur l'appareil republie.
  const signature = JSON.stringify(row);
  if (published?.value === signature) return;

  // Sans user_id : le serveur le déduit de la session (et l'app n'a pas le droit de le modifier).
  const { user_id: _account, ...columns } = row;
  const { error } = await supabase
    .from("reminders")
    .upsert({ ...columns, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  await db.settings.put({ key: PUBLISHED_KEY, value: signature });
}
