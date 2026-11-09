import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { Panel } from "../../ui/Panel";
import { Button } from "../../ui/Button";
import { CategoryToggle } from "../../ui/CategoryToggle";
import { ActionSheet } from "../../ui/ActionSheet";
import { ChevronRightIcon, FlameIcon, HourglassIcon, RepeatIcon, ShuffleIcon, SparkIcon } from "../../ui/icons";
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
import { activityByDay, currentStreak } from "../../domain/progress";
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
import styles from "./ReviseScreen.module.css";

/**
 * Couleurs de l'action principale et des icônes selon la catégorie révisée.
 * Pour « Tout », moitié vocabulaire, moitié dates : le bouton a une bordure
 * bicolore (texte d'une seule couleur, toujours lisible), et chaque icône a un
 * tracé de chaque couleur. Contrastes vérifiés en clair et en sombre.
 */
const SPLIT_ICON_TONES: [string, string] = ["var(--vocabulary)", "var(--dates)"];

interface RunningSession {
  id: number;
  cards: Card[];
  plan: SessionItem[];
  /** « Encore une session » relance le même type de révision. */
  restart: () => void;
}

/** Les entraînements proposés en accès rapide (libellés courts : trois tuiles côte à côte). */
const PRACTICES: {
  kind: PracticeKind;
  title: string;
  Icon: (props: { size?: number; tones?: [string, string] }) => React.ReactNode;
  hint: string;
}[] = [
  { kind: "forgotten", title: "Oubliées", Icon: RepeatIcon, hint: "Les fiches déjà ratées, les plus souvent d’abord" },
  { kind: "recent", title: "Nouveautés", Icon: SparkIcon, hint: `Les fiches ajoutées ces ${RECENT_DAYS} derniers jours` },
  { kind: "random", title: "En vrac", Icon: ShuffleIcon, hint: "Un tirage au hasard dans la collection" },
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

/** Réviser : la révision du jour, puis des entraînements ciblés en accès rapide. */
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
  const streak = currentStreak(reviews, today);
  const category = findCategory(kind);
  const answeredToday = activityByDay(reviews, [today])[0]?.answered ?? 0;

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

      <Panel>
        <p className={styles.eyebrow}>Révision du jour</p>
        <DailyMessage cards={selected} reviewable={reviewable} dueCount={dueCount} today={today} />
        {dueCount > 0 && (
          <Button
            fullWidth
            onClick={startDaily}
            className={category ? undefined : styles.splitButton}
            style={category ? { background: category.fillColor, color: category.onFillColor } : undefined}
          >
            Commencer · {Math.min(settings.sessionSize, reviewable.length)} questions
          </Button>
        )}
        {reviews.length > 0 && (
          <p className={styles.stats}>
            <span className={styles.flame}>
              <FlameIcon size={16} />
            </span>
            {streak} {streak > 1 ? "jours de suite" : "jour de suite"} · {answeredToday}{" "}
            {answeredToday > 1 ? "réponses aujourd’hui" : "réponse aujourd’hui"}
          </p>
        )}
      </Panel>

      {reviewable.length > 0 && (
        <section className={styles.practices}>
          <h2 className={styles.heading}>Entraînements</h2>
          <div className={styles.tiles}>
            {PRACTICES.map(({ kind: practice, title, Icon, hint }) => {
              const count = practiceCandidates(reviewable, practice, Date.now()).length;
              return (
                <button
                  key={practice}
                  type="button"
                  className={styles.tile}
                  onClick={() => startPractice(practice)}
                  disabled={count === 0}
                  aria-label={title}
                  aria-describedby={`practice-${practice}`}
                >
                  <span className={styles.tileIcon} style={{ color: category?.color }}>
                    <Icon size={22} tones={category ? undefined : SPLIT_ICON_TONES} />
                  </span>
                  <span className={styles.tileTitle}>{title}</span>
                  <span className={styles.tileCount}>{count}</span>
                  <span className={styles.hidden} id={`practice-${practice}`}>
                    {hint}
                  </span>
                </button>
              );
            })}
          </div>
          {eras.length > 0 && (
            <button
              type="button"
              className={styles.eraRow}
              onClick={() => setChoosingEra(true)}
              aria-label="Par époque"
              aria-describedby="practice-eras"
              aria-haspopup="dialog"
            >
              <span className={styles.tileIcon} style={{ color: historicalEventModel.color }}>
                <HourglassIcon size={22} />
              </span>
              <span className={styles.eraText}>
                <span className={styles.tileTitle}>Par époque</span>
                <span className={styles.tileCount} id="practice-eras">
                  {eras.map((era) => era.label).join(", ")}
                </span>
              </span>
              <span className={styles.chevron}>
                <ChevronRightIcon size={18} />
              </span>
            </button>
          )}
          <p className={styles.footnote}>Une bonne réponse en entraînement n’avance pas le planning ; une erreur, si.</p>
        </section>
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

interface DailyMessageProps {
  cards: Card[];
  reviewable: Card[];
  dueCount: number;
  today: string;
}

/** Message de la révision du jour, selon l'état de la collection (une ou deux lignes). */
function DailyMessage({ cards, reviewable, dueCount, today }: DailyMessageProps) {
  if (cards.length === 0) {
    return (
      <>
        <p className={styles.lead}>Ton carnet est encore vide.</p>
        <p className={styles.text}>Ajoute des mots et des dates avec le bouton +.</p>
      </>
    );
  }

  if (reviewable.length === 0) {
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

  if (dueCount > 0) {
    const dueCards = reviewable.filter((card) => card.progress.dueDay <= today);
    return <p className={`${styles.lead} ${styles.leadWithButton}`}>{formatCardCount(dueCount, unitFor(dueCards))} à réviser.</p>;
  }

  const nextDay = nextDueDay(reviewable, today);
  return (
    <>
      <p className={styles.lead}>Tout est révisé pour aujourd’hui.</p>
      <p className={styles.text}>
        {nextDay ? `Prochaine révision ${formatRelativeDay(nextDay, today, addDays(today, 1))}. ` : ""}Un entraînement, en
        attendant ?
      </p>
    </>
  );
}
