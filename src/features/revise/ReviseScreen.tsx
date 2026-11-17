import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Panel } from "../../ui/Panel";
import { CategoryToggle } from "../../ui/CategoryToggle";
import { ActionSheet } from "../../ui/ActionSheet";
import { CheckIcon, ChevronRightIcon, DailyIcon, HourglassIcon, RepeatIcon, ShuffleIcon, SparkIcon } from "../../ui/icons";
import { formatCardCount, formatRelativeDay } from "../../ui/format";
import { InstallHint } from "../../pwa/InstallHint";
import { CHOICE_COUNT } from "../../domain/quiz";
import type { Card } from "../../domain/card";
import {
  RECENT_DAYS,
  countDue,
  nextDueDay,
  planDraw,
  planPractice,
  planSession,
  practiceCandidates,
  type PracticeKind,
  type SessionItem,
} from "../../domain/session";
import { addDays } from "../../domain/studyDay";
import { CATEGORIES, findCategory, presentCategories, unitFor } from "../../categories/registry";
import { chooseExercise } from "../../categories/exercisePlan";
import { formatCount } from "../../categories/model";
import { historicalEventModel, ORDER_SIZE, type HistoricalEventContent } from "../../categories/historical-event/model";
import { ERAS, eraOf } from "../../categories/historical-event/eras";
import { useCards } from "../collection/useCards";
import { useReviews } from "../review/useReviews";
import { useToday } from "../review/useToday";
import { useReviewSettings } from "../review/useReviewSettings";
import { ReviewSession } from "../review/ReviewSession";
import { RevisionRow } from "./RevisionRow";
import { StreakPanel } from "./StreakPanel";
import styles from "./ReviseScreen.module.css";

/**
 * Les icônes prennent la couleur de la catégorie révisée. Pour « Tout », chaque
 * icône a un tracé de chaque couleur (vocabulaire, dates), et la pastille de la
 * révision du jour une bordure bicolore. Contrastes vérifiés en clair et en sombre.
 */
const SPLIT_ICON_TONES: [string, string] = ["var(--vocabulary)", "var(--dates)"];

interface RunningSession {
  id: number;
  cards: Card[];
  plan: SessionItem[];
  /** « Encore une session » relance le même type de révision. */
  restart: () => void;
}

/** Les révisions ciblées, après la révision du jour. */
const PRACTICES: {
  kind: PracticeKind;
  title: string;
  Icon: (props: { size?: number; tones?: [string, string] }) => React.ReactNode;
  hint: string;
}[] = [
  { kind: "forgotten", title: "Oubliées", Icon: RepeatIcon, hint: "Les fiches que tu as déjà ratées" },
  { kind: "recent", title: "Nouveautés", Icon: SparkIcon, hint: `Ajoutées ces ${RECENT_DAYS} derniers jours` },
  { kind: "random", title: "En vrac", Icon: ShuffleIcon, hint: "Un tirage au hasard dans ta collection" },
];

/** Cartes des catégories qui ont assez de fiches pour composer des questions. */
function reviewableCards(cards: Card[]): Card[] {
  const reviewableKinds = new Set(
    CATEGORIES.filter((category) =>
      category.canBuildQuestions(cards.filter((card) => card.item.kind === category.kind).map((card) => card.item)),
    ).map((category) => category.kind),
  );
  return cards.filter((card) => reviewableKinds.has(card.item.kind));
}

/** Réviser : la série en cours, puis les différentes révisions possibles. */
export function ReviseScreen() {
  const cards = useCards();
  const reviews = useReviews();
  const today = useToday();
  const settings = useReviewSettings();
  const [session, setSession] = useState<RunningSession | null>(null);
  const [choosingEra, setChoosingEra] = useState(false);

  if (cards === undefined || reviews === undefined) {
    return <Screen title="Réviser" />;
  }

  // Catégorie révisée : proposée seulement si plusieurs catégories ont des fiches.
  const categories = presentCategories(cards);
  const kind = categories.some((category) => category.kind === settings.categoryFilter) ? settings.categoryFilter : "all";
  const selected = kind === "all" ? cards : cards.filter((card) => card.item.kind === kind);
  const reviewable = reviewableCards(selected);
  const dueCount = countDue(reviewable, today);
  const category = findCategory(kind);
  const iconTones = category ? undefined : SPLIT_ICON_TONES;

  // Exercice d'une carte : selon sa catégorie, son niveau et le réglage de l'utilisateur.
  const exerciseFor = (card: Card, rotation: number) =>
    chooseExercise(card, rotation, settings.exercisePreference(card.item.kind));

  // Par époque : les dates révisables, rangées par époque.
  const dates = reviewable.filter((card) => card.item.kind === historicalEventModel.kind);
  const datesByEra = new Map(ERAS.map((era) => [era.id, [] as Card[]]));
  for (const card of dates) datesByEra.get(eraOf(card.item.content as HistoricalEventContent).id)!.push(card);
  const eras = ERAS.filter((era) => datesByEra.get(era.id)!.length > 0);

  // Une session part d'un instantané de la collection : elle reste stable pendant les réponses.
  // Toutes les cartes sont transmises : les mauvaises réponses se tirent dans toute la catégorie.
  // `makePlan` peut restreindre les fiches de la session (une époque) : les autres questions s'y tiennent.
  const start = (makePlan: () => SessionItem[] | { plan: SessionItem[]; cards: Card[] }) => {
    const launch = () => {
      const made = makePlan();
      const planned = Array.isArray(made) ? { plan: made, cards } : made;
      setSession({ id: Date.now(), ...planned, restart: launch });
    };
    launch();
  };
  const startDaily = () => start(() => planSession(reviewable, today, settings.sessionSize, exerciseFor));
  const startPractice = (practice: PracticeKind) =>
    start(() => planPractice(reviewable, practice, settings.sessionSize, Date.now(), exerciseFor));
  /** Une époque donnée, ou tirée au hasard (à chaque session) parmi celles qui ont des dates. */
  const startEra = (eraId: string | "random") => {
    setChoosingEra(false);
    start(() => {
      const id = eraId === "random" ? eras[Math.floor(Math.random() * eras.length)]!.id : eraId;
      const eraCards = datesByEra.get(id) ?? [];
      const plan = planDraw(eraCards, settings.sessionSize, exerciseFor);
      // Classements et propositions restent dans l'époque, si elle a assez de dates pour cela.
      return { plan, cards: eraCards.length >= ORDER_SIZE ? eraCards : cards };
    });
  };

  return (
    <Screen title="Réviser">
      <InstallHint />

      {categories.length > 1 && (
        <div className={styles.filter}>
          <CategoryToggle
            label="Réviser"
            options={[
              { value: "all", label: "Tout" },
              ...categories.map((category) => ({
                value: category.kind,
                label: category.label,
                fill: category.fillColor,
                onFill: category.onFillColor,
              })),
            ]}
            value={kind}
            onChange={settings.setCategoryFilter}
          />
        </div>
      )}

      {reviewable.length === 0 ? (
        <Panel>
          <EmptyMessage cards={selected} />
        </Panel>
      ) : (
        <>
          <StreakPanel reviews={reviews} today={today} />
          <ul className={styles.list} aria-label="Révisions">
            <RevisionRow
              icon={<DailyIcon size={24} tones={iconTones} />}
              iconColor={category?.color}
              title="Révision du jour"
              detail={dailyDetail(reviewable, dueCount, today)}
              trailing={
                dueCount > 0 ? (
                  <span
                    className={`${styles.badge} ${category ? "" : styles.splitBadge}`}
                    style={category ? { background: category.fillColor, color: category.onFillColor } : undefined}
                  >
                    {dueCount}
                  </span>
                ) : (
                  <span className={styles.done} aria-label="Tout est révisé">
                    <CheckIcon size={20} />
                  </span>
                )
              }
              disabled={dueCount === 0}
              onClick={startDaily}
            />
            {PRACTICES.map(({ kind: practice, title, Icon, hint }) => {
              const count = practiceCandidates(reviewable, practice, Date.now()).length;
              return (
                <RevisionRow
                  key={practice}
                  icon={<Icon size={24} tones={iconTones} />}
                  iconColor={category?.color}
                  title={title}
                  detail={hint}
                  trailing={count}
                  disabled={count === 0}
                  onClick={() => startPractice(practice)}
                />
              );
            })}
            {eras.length > 0 && (
              <RevisionRow
                icon={<HourglassIcon size={24} />}
                iconColor={historicalEventModel.color}
                title="Par époque"
                detail="Choisis une époque, ou au hasard"
                trailing={<ChevronRightIcon size={18} />}
                opensChoice
                onClick={() => setChoosingEra(true)}
              />
            )}
          </ul>
        </>
      )}

      {choosingEra && (
        <ActionSheet
          title="Réviser une époque"
          options={[
            ...(eras.length > 1 ? [{ label: "Époque au hasard", onSelect: () => startEra("random") }] : []),
            ...eras.map((era) => ({
              label: `${era.label} · ${formatCount(datesByEra.get(era.id)!.length, historicalEventModel.unit)}`,
              onSelect: () => startEra(era.id),
            })),
          ]}
          onCancel={() => setChoosingEra(false)}
        />
      )}

      {session && (
        <ReviewSession
          key={session.id}
          cards={session.cards}
          plan={session.plan}
          today={today}
          onClose={() => setSession(null)}
          onRestart={session.restart}
        />
      )}
    </Screen>
  );
}

/** Collection vide, ou pas encore assez de fiches pour composer des questions. */
function EmptyMessage({ cards }: { cards: Card[] }) {
  if (cards.length === 0) {
    return (
      <>
        <p className={styles.lead}>Ton carnet est encore vide.</p>
        <p className={styles.text}>Ajoute des mots et des dates avec le bouton +.</p>
      </>
    );
  }
  const missing = Math.max(CHOICE_COUNT - cards.length, 1);
  return (
    <>
      <p className={styles.lead}>Encore un peu de patience.</p>
      <p className={styles.text}>
        Il faut au moins {CHOICE_COUNT} mots aux définitions différentes. Ajoute-en encore {missing === 1 ? "un" : missing}.
      </p>
    </>
  );
}

/** « 12 fiches à réviser », ou « Tout est révisé · suite demain ». */
function dailyDetail(reviewable: Card[], dueCount: number, today: string): string {
  if (dueCount > 0) {
    const dueCards = reviewable.filter((card) => card.progress.dueDay <= today);
    return `${formatCardCount(dueCount, unitFor(dueCards))} à réviser`;
  }
  const nextDay = nextDueDay(reviewable, today);
  return nextDay ? `Tout est révisé · suite ${formatRelativeDay(nextDay, today, addDays(today, 1))}` : "Tout est révisé";
}
