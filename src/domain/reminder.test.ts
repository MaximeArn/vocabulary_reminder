import { describe, expect, it } from "vitest";
import { card } from "../test/factories";
import type { Review } from "./types";
import { reminderSummary } from "./reminder";
import {
  dueOn,
  localClock,
  reminderToSend,
  studyDayIn,
  type ReminderState,
} from "../../supabase/functions/daily-reminder/reminder";

const review = (studyDay: string): Review => ({
  id: studyDay,
  itemId: "x",
  answeredAt: Date.parse(`${studyDay}T18:00:00Z`),
  studyDay,
  exercise: "e",
  correct: true,
});

describe("résumé publié par l'app", () => {
  it("compte les fiches dues par jour, le dernier jour révisé et la série", () => {
    const cards = [card("a", { dueDay: "2026-11-09" }), card("b", { dueDay: "2026-11-09" }), card("c", { dueDay: "2026-11-12" })];
    const reviews = [review("2026-11-06"), review("2026-11-07"), review("2026-11-08")];
    expect(reminderSummary(cards, reviews)).toEqual({
      due_by_day: { "2026-11-09": 2, "2026-11-12": 1 },
      last_review_day: "2026-11-08",
      streak: 3,
    });
    expect(reminderSummary([], [])).toEqual({ due_by_day: {}, last_review_day: null, streak: 0 });
  });
});

describe("rappel quotidien (serveur)", () => {
  const paris = (iso: string) => new Date(`${iso}+01:00`); // novembre : heure d'hiver
  const state: ReminderState = {
    time: "20:00",
    timezone: "Europe/Paris",
    due_by_day: { "2026-11-01": 3, "2026-11-09": 2, "2026-11-20": 4 },
    last_review_day: "2026-11-08",
    streak: 5,
    last_sent_day: null,
  };

  it("lit l'heure et le jour d'étude dans le fuseau de l'utilisateur", () => {
    expect(localClock(paris("2026-11-09T20:05:00"), "Europe/Paris")).toEqual({ day: "2026-11-09", minutes: 20 * 60 + 5 });
    // Le jour d'étude commence à 4 h : à 2 h du matin, c'est encore la veille.
    expect(studyDayIn(paris("2026-11-10T02:00:00"), "Europe/Paris")).toBe("2026-11-09");
    expect(localClock(new Date("2026-11-09T19:00:00Z"), "Fuseau/Inconnu").minutes).toBe(20 * 60);
  });

  it("additionne les fiches devenues dues ce jour ou avant", () => {
    expect(dueOn(state.due_by_day, "2026-11-09")).toBe(5);
    expect(dueOn(state.due_by_day, "2026-11-08")).toBe(3);
  });

  it("prévient à partir de l'heure choisie, pendant une heure, avec la série en jeu", () => {
    expect(reminderToSend(state, paris("2026-11-09T19:55:00"))).toBeNull();
    expect(reminderToSend(state, paris("2026-11-09T20:00:00"))).toEqual({
      day: "2026-11-09",
      message: { title: "Révision du jour", body: "5 fiches t’attendent. Ta série de 5 jours continue si tu révises aujourd’hui." },
    });
    expect(reminderToSend(state, paris("2026-11-09T20:59:00"))).not.toBeNull();
    expect(reminderToSend(state, paris("2026-11-09T21:00:00"))).toBeNull();
  });

  it("ne prévient qu'une fois par jour, et pas si l'utilisateur a déjà révisé", () => {
    expect(reminderToSend({ ...state, last_sent_day: "2026-11-09" }, paris("2026-11-09T20:10:00"))).toBeNull();
    expect(reminderToSend({ ...state, last_review_day: "2026-11-09" }, paris("2026-11-09T20:10:00"))).toBeNull();
  });

  it("se tait s'il n'y a rien à réviser", () => {
    expect(reminderToSend({ ...state, due_by_day: { "2026-11-20": 4 } }, paris("2026-11-09T20:10:00"))).toBeNull();
  });

  it("ne mentionne pas une série déjà interrompue", () => {
    const sent = reminderToSend({ ...state, last_review_day: "2026-11-05" }, paris("2026-11-09T20:10:00"));
    expect(sent?.message.body).toBe("5 fiches t’attendent.");
    const single = reminderToSend({ ...state, due_by_day: { "2026-11-09": 1 }, streak: 1 }, paris("2026-11-09T20:10:00"));
    expect(single?.message.body).toBe("1 fiche t’attend. Ta série de 1 jour continue si tu révises aujourd’hui.");
  });

  it("refuse une heure mal formée", () => {
    expect(reminderToSend({ ...state, time: "25:00" }, paris("2026-11-09T20:10:00"))).toBeNull();
  });
});
