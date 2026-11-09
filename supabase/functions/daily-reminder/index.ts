// Rappel quotidien de Mnémé (fonction Supabase, Deno).
//
// Deux usages :
// - la tâche planifiée l'appelle toutes les 5 minutes, avec le secret partagé
//   (en-tête x-cron-secret) : elle prévient les utilisateurs dont l'heure est venue ;
// - l'app l'appelle avec la session de l'utilisateur et { "test": true } : rappel
//   d'essai immédiat sur ses appareils, depuis Réglages.
//
// Secrets (supabase secrets set) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { reminderToSend, type ReminderState } from "./reminder.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Le rappel ouvre directement la page Réviser. */
const OPEN_HASH = "#reviser";
/** Un rappel non distribué dans les 6 heures n'a plus de sens. */
const TIME_TO_LIVE_SECONDS = 6 * 3600;

interface Subscription {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}

interface Delivery {
  sent: number;
  /** Appareils désabonnés (réponse 404 ou 410) : retirés de la base. */
  gone: number;
  failed: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function deliver(subscriptions: Subscription[], title: string, body: string): Promise<Delivery> {
  const result: Delivery = { sent: 0, gone: 0, failed: 0 };
  const payload = JSON.stringify({ title, body, open: OPEN_HASH });
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: TIME_TO_LIVE_SECONDS, urgency: "normal" },
      );
      result.sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        result.gone += 1;
      } else {
        result.failed += 1;
        console.error("Envoi impossible", status, (error as { body?: string }).body ?? String(error));
      }
    }
  }
  return result;
}

/** Tâche planifiée : chaque utilisateur abonné dont l'heure est venue reçoit son rappel. */
async function runSchedule(): Promise<Response> {
  const [{ data: reminders, error: remindersError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    admin.from("reminders").select("user_id, time, timezone, due_by_day, last_review_day, streak, last_sent_day"),
    admin.from("push_subscriptions").select("endpoint, user_id, p256dh, auth"),
  ]);
  if (remindersError || subscriptionsError) return json({ error: (remindersError ?? subscriptionsError)!.message }, 500);

  const now = new Date();
  const total: Delivery & { users: number } = { users: 0, sent: 0, gone: 0, failed: 0 };
  for (const reminder of reminders ?? []) {
    const devices = (subscriptions ?? []).filter((subscription) => subscription.user_id === reminder.user_id);
    if (devices.length === 0) continue;
    const decision = reminderToSend(reminder as ReminderState & { user_id: string }, now);
    if (!decision) continue;
    // Noté avant l'envoi : deux exécutions rapprochées n'envoient jamais deux rappels.
    const { data: claimed } = await admin
      .from("reminders")
      .update({ last_sent_day: decision.day })
      .eq("user_id", reminder.user_id)
      .or(`last_sent_day.is.null,last_sent_day.neq.${decision.day}`)
      .select("user_id");
    if (!claimed?.length) continue;
    const delivery = await deliver(devices, decision.message.title, decision.message.body);
    total.users += 1;
    total.sent += delivery.sent;
    total.gone += delivery.gone;
    total.failed += delivery.failed;
  }
  return json(total);
}

/** Rappel d'essai, demandé depuis l'app : envoyé tout de suite aux appareils de l'utilisateur. */
async function runTest(request: Request): Promise<Response> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "Session invalide" }, 401);
  const { data: devices } = await admin
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .eq("user_id", data.user.id);
  if (!devices?.length) return json({ error: "Aucun appareil abonné" }, 404);
  return json(await deliver(devices, "Rappel d’essai", "Les rappels de Mnémé arriveront ainsi, à l’heure choisie."));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "Méthode non permise" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (cronSecret.length >= 32 && request.headers.get("x-cron-secret") === cronSecret) return runSchedule();

  const body = await request.json().catch(() => ({}));
  if (body?.test === true) return runTest(request);
  return json({ error: "Non autorisé" }, 401);
});
