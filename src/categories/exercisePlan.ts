import type { Card } from "../domain/card";
import type { Random } from "../domain/random";
import { CATEGORY_MODELS } from "./models";

/**
 * Choix de l'exercice pour une carte d'une session.
 *
 * - Une carte nouvelle ou en apprentissage est posée avec quatre propositions.
 * - Une fois acquise (« En bonne voie », boîte 3), elle est à taper quand sa
 *   catégorie le permet : la difficulté monte avec la maîtrise.
 * - De temps en temps, une question de classement (dates) remplace la question.
 * - Pour une catégorie à volets (géographie), seuls les exercices du volet de la carte.
 *
 * `preference` : réglage de l'utilisateur, « mixed » ou l'exercice à choix imposé.
 * Une saisie n'est proposée que si elle suit un exercice autorisé.
 */

/** Boîte à partir de laquelle on tape la réponse. */
export const TYPING_FROM_BOX = 3;
/** Part des questions remplacées par un classement, quand la catégorie en propose. */
export const ORDER_SHARE = 0.2;

export function chooseExercise(
  card: Card,
  rotation: number,
  preference: string,
  random: Random = Math.random,
): string | undefined {
  const model = CATEGORY_MODELS.find((candidate) => candidate.kind === card.item.kind);
  if (!model) return undefined;
  // Un exercice adapté à la fiche et, pour une catégorie à volets, au volet de la carte.
  const fits = (exercise: (typeof model.exercises)[number]) =>
    (exercise.accepts?.(card.item) ?? true) && exercise.track === card.track;
  // Exercices qui alternent : à choix, ou sur la carte.
  const rotating = model.exercises.filter((exercise) => (exercise.mode === "choice" || exercise.mode === "map") && fits(exercise));
  const allowed = rotating.some((exercise) => exercise.id === preference)
    ? rotating.filter((exercise) => exercise.id === preference)
    : rotating;
  if (allowed.length === 0) return undefined;

  const order = model.exercises.find((exercise) => exercise.mode === "order" && fits(exercise));
  if (order && random() < ORDER_SHARE) return order.id;

  const base = allowed[rotation % allowed.length]!;
  if (card.progress.box >= TYPING_FROM_BOX) {
    const typedOf = (choice: { id: string }) =>
      model.exercises.find((exercise) => exercise.mode === "typed" && exercise.follows === choice.id && fits(exercise));
    // Sa propre version tapée ; sinon (exercice à choix sans saisie), celle d'un autre exercice autorisé.
    // Un exercice sur la carte reste sur la carte.
    const typed = typedOf(base) ?? (base.mode === "choice" ? allowed.map(typedOf).find(Boolean) : undefined);
    if (typed) return typed.id;
  }
  return base.id;
}
