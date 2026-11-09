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
  const choices = model.exercises.filter((exercise) => exercise.mode === "choice");
  const allowed = choices.some((exercise) => exercise.id === preference)
    ? choices.filter((exercise) => exercise.id === preference)
    : choices;
  if (allowed.length === 0) return undefined;

  const order = model.exercises.find((exercise) => exercise.mode === "order");
  if (order && random() < ORDER_SHARE) return order.id;

  if (card.progress.box >= TYPING_FROM_BOX) {
    const typed = model.exercises.find(
      (exercise) =>
        exercise.mode === "typed" &&
        allowed.some((choice) => choice.id === exercise.follows) &&
        (exercise.accepts?.(card.item) ?? true),
    );
    if (typed) return typed.id;
  }
  return allowed[rotation % allowed.length]!.id;
}
