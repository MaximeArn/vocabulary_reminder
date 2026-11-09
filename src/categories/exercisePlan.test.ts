import { describe, expect, it } from "vitest";
import type { Card } from "../domain/card";
import { initialProgress } from "../domain/srs";
import { vocabularyItem } from "../test/factories";
import { chooseExercise, TYPING_FROM_BOX } from "./exercisePlan";

const never = () => 0.99; // jamais de classement
const always = () => 0; // toujours un classement (si la catégorie en propose)

const wordCard = (box: number): Card => ({ item: vocabularyItem("fruste", "Qui manque de finesse."), progress: { ...initialProgress(0), box } });
const dateCard = (box: number, precision: "year" | "century"): Card => ({
  item: {
    id: `d${box}${precision}`,
    kind: "historical-event",
    content: { name: "Marathon", start: { year: -490, precision, circa: false }, uncertain: false, people: [] },
    createdAt: 0,
    updatedAt: 0,
  },
  progress: { ...initialProgress(0), box },
});

describe("choix de l'exercice", () => {
  it("propose des choix tant que la fiche n'est pas acquise, en alternant", () => {
    const exercises = [0, 1].map((rotation) => chooseExercise(wordCard(1), rotation, "mixed", never));
    expect(exercises).toEqual(["vocabulary.word-to-definition", "vocabulary.definition-to-word"]);
  });

  it("fait taper la réponse une fois la fiche acquise", () => {
    expect(chooseExercise(wordCard(TYPING_FROM_BOX), 0, "mixed", never)).toBe("vocabulary.definition-to-word-typed");
    expect(chooseExercise(dateCard(4, "year"), 0, "mixed", never)).toBe("historical-event.event-to-year-typed");
  });

  it("garde les choix quand la saisie ne convient pas (siècle) ou contredit le réglage", () => {
    expect(chooseExercise(dateCard(4, "century"), 0, "mixed", never)).toMatch(/event-to-date|date-to-event/);
    expect(chooseExercise(wordCard(5), 0, "vocabulary.word-to-definition", never)).toBe("vocabulary.word-to-definition");
  });

  it("glisse un classement de temps en temps, pour les dates seulement", () => {
    expect(chooseExercise(dateCard(1, "year"), 0, "mixed", always)).toBe("historical-event.chronological-order");
    expect(chooseExercise(wordCard(1), 0, "mixed", always)).toBe("vocabulary.word-to-definition");
  });
});
