import type { RemoteItem, RemoteReview, RemoteSetting } from "./mapping";
import { supabase } from "./supabase";

/** Accès aux tables distantes. Toute erreur est levée avec un message lisible. */

export type RemoteTable = "items" | "reviews" | "settings";

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context} : ${error.message}`);
}

export async function pushItems(rows: RemoteItem[]): Promise<void> {
  const { error } = await supabase.rpc("push_items", { rows });
  fail("Envoi des fiches", error);
}

export async function pushReviews(rows: RemoteReview[]): Promise<void> {
  // Historique en ajout seul : une réponse déjà présente est ignorée.
  const { error } = await supabase.from("reviews").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  fail("Envoi des réponses", error);
}

export async function pushSettings(rows: RemoteSetting[]): Promise<void> {
  const { error } = await supabase.rpc("push_settings", { rows });
  fail("Envoi des réglages", error);
}

/** Lignes modifiées après le curseur `afterSeq`, dans l'ordre du serveur. */
export async function pullAfter<Row>(table: RemoteTable, afterSeq: number, limit: number): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .gt("server_seq", afterSeq)
    .order("server_seq", { ascending: true })
    .limit(limit);
  fail(`Réception (${table})`, error);
  return (data ?? []) as Row[];
}
