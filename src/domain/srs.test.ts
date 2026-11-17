import { describe, expect, it } from "vitest";
import { MASTERED_BOX, applyReview, masteryLevel, nextSchedule, progressByItem, replayProgress } from "./srs";

const today = "2026-11-04";

describe("nextSchedule", () => {
  it("fait monter un mot dû d'une boîte et espace sa révision", () => {
    expect(nextSchedule({ box: 0, dueDay: today, lapses: 0 }, true, today)).toEqual({
      box: 1,
      dueDay: "2026-11-05",
      lapses: 0,
      movedOn: today,
    });
    expect(nextSchedule({ box: 3, dueDay: "2026-11-01", lapses: 1 }, true, today)).toEqual({
      box: 4,
      dueDay: "2026-11-19",
      lapses: 1,
      movedOn: today,
    });
  });

  it("plafonne à la dernière boîte (90 jours)", () => {
    expect(nextSchedule({ box: 6, dueDay: today, lapses: 0 }, true, today)).toEqual({
      box: 6,
      dueDay: "2027-02-02",
      lapses: 0,
      movedOn: today,
    });
  });

  it("renvoie un mot oublié en boîte 1, pour le lendemain", () => {
    expect(nextSchedule({ box: 5, dueDay: today, lapses: 2 }, false, today)).toEqual({
      box: 1,
      dueDay: "2026-11-05",
      lapses: 3,
      movedOn: today,
    });
  });

  it("fait aussi monter une fiche révisée en avance (entraînement), et compte une erreur", () => {
    const early = { box: 3, dueDay: "2026-11-10", lapses: 0 };
    expect(nextSchedule(early, true, today)).toEqual({ box: 4, dueDay: "2026-11-19", lapses: 0, movedOn: today });
    expect(nextSchedule(early, false, today).box).toBe(1);
  });

  it("ne fait monter une fiche qu'une fois par jour, et pas après une erreur ce jour-là", () => {
    const promoted = nextSchedule({ box: 2, dueDay: today, lapses: 0 }, true, today);
    expect(nextSchedule(promoted, true, today)).toEqual(promoted);
    const failed = nextSchedule({ box: 4, dueDay: "2026-11-20", lapses: 0 }, false, today);
    expect(nextSchedule(failed, true, today)).toEqual(failed);
    // Le lendemain, elle remonte normalement.
    expect(nextSchedule(failed, true, "2026-11-05").box).toBe(2);
  });
});

describe("masteryLevel", () => {
  it("regroupe les boîtes en niveaux", () => {
    expect([0, 1, 2, 3, 4, MASTERED_BOX, 6].map(masteryLevel)).toEqual([
      "new",
      "learning",
      "learning",
      "progressing",
      "progressing",
      "mastered",
      "mastered",
    ]);
  });
});

describe("replayProgress", () => {
  const createdAt = new Date(2026, 10, 1, 10).getTime(); // jour d'étude 2026-11-01
  const review = (id: string, studyDay: string, correct: boolean, hour = 12) => {
    const [y, m, d] = studyDay.split("-").map(Number);
    return {
      id,
      itemId: "x",
      answeredAt: new Date(y!, m! - 1, d!, hour).getTime(),
      studyDay,
      exercise: "test",
      correct,
    };
  };

  it("part d'une fiche nouvelle, à réviser le jour de son ajout", () => {
    expect(replayProgress(createdAt, [])).toEqual({
      box: 0,
      dueDay: "2026-11-01",
      lapses: 0,
      correctCount: 0,
      wrongCount: 0,
    });
  });

  it("rejoue les réponses dans l'ordre chronologique, quel que soit l'ordre reçu", () => {
    const history = [
      review("c", "2026-11-05", true),
      review("a", "2026-11-01", true),
      review("b", "2026-11-02", false),
    ];
    expect(replayProgress(createdAt, history)).toEqual({
      box: 2,
      dueDay: "2026-11-08",
      lapses: 1,
      movedOn: "2026-11-05",
      correctCount: 2,
      wrongCount: 1,
      lastReviewedAt: history[0]!.answeredAt,
    });
  });

  it("donne le même résultat que les réponses appliquées une à une", () => {
    const history = [review("a", "2026-11-01", true), review("b", "2026-11-02", true), review("c", "2026-11-05", true)];
    let live = replayProgress(createdAt, []);
    for (const answer of history) live = applyReview(live, answer);
    expect(replayProgress(createdAt, [...history].reverse())).toEqual(live);
  });
});

describe("progressByItem", () => {
  it("calcule la progression de chaque fiche à partir de son seul historique", () => {
    const items = [
      { id: "a", createdAt: new Date(2026, 10, 1, 12).getTime() },
      { id: "b", createdAt: new Date(2026, 10, 1, 12).getTime() },
    ];
    const reviews = [{ id: "r", itemId: "a", answeredAt: items[0]!.createdAt, studyDay: "2026-11-01", exercise: "t", correct: true }];
    const progress = progressByItem(items, reviews);
    expect(progress.get("a")?.box).toBe(1);
    expect(progress.get("b")?.box).toBe(0);
  });
});
