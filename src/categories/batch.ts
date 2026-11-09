import { parseBackup, type ContentValidator } from "../domain/backup";
import { cleanText, comparisonKey } from "../domain/text";
import type { Item, Review } from "../domain/types";
import { findCategoryModel } from "./models";
import { parseDateText } from "./historical-event/parse";
import { vocabularyModel } from "./vocabulary/model";
import { historicalEventModel } from "./historical-event/model";

/**
 * Ajout par lot : lecture d'un texte libre (une fiche par ligne) ou d'une
 * sauvegarde JSON collée, et aperçu de ce qui sera ajouté, sans rien remplacer.
 *
 *   « 331 av. J.-C. : Bataille de Gaugamèles »  → une date historique
 *   « alacrité : vivacité et enjouement »         → un mot
 */

export interface BatchEntry {
  kind: string;
  content: unknown;
  /** Résumé pour l'aperçu. */
  label: string;
  /** Fiche venant d'une sauvegarde : conservée avec son identifiant et son historique. */
  fromBackup?: { item: Item; reviews: Review[] };
}

export interface BatchPreview {
  source: "text" | "backup";
  entries: BatchEntry[];
  /** Fiches déjà présentes (ou répétées dans le lot) : ignorées. */
  duplicates: string[];
  /** Lignes non reconnues, avec la raison. */
  ignored: { line: string; reason: string }[];
}

const validateContent: ContentValidator = (kind, raw) => findCategoryModel(kind)?.validateContent(raw);

/** Clé de doublon : la catégorie et le titre (mot, événement), sans casse ni accents. */
function duplicateKey(kind: string, content: unknown): string {
  const title = findCategoryModel(kind)?.title(content) ?? "";
  return `${kind}:${comparisonKey(title)}`;
}

function label(kind: string, content: unknown): string {
  const model = findCategoryModel(kind);
  if (!model) return "";
  const title = model.title(content);
  const subtitle = model.subtitle(content);
  return model.listStyle === "timeline" ? `${subtitle} — ${title}` : `${title} — ${subtitle}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Lit une ligne de texte : une date historique, un mot, ou `null` avec la raison. */
function readLine(line: string): { kind: string; content: unknown } | { reason: string } {
  const separator = line.indexOf(":");
  if (separator === -1) return { reason: "pas de « : » (titre de section ?)" };
  const left = line.slice(0, separator).trim();
  const right = line.slice(separator + 1).trim();
  if (left === "" || right === "") return { reason: "il manque un côté du « : »" };

  // « date : événement », ou « événement : date »
  const dateFirst = parseDateText(left);
  const dateLast = dateFirst ? null : parseDateText(right);
  const dates = dateFirst ?? dateLast;
  if (dates) {
    // Un nom d'événement est un titre : sans point final.
    const name = capitalize(cleanText(dateFirst ? right : left).replace(/\.+$/, ""));
    const content = historicalEventModel.validateContent({ name, start: dates.start, end: dates.end, uncertain: false, people: [] });
    return { kind: historicalEventModel.kind, content };
  }

  // « mot : définition « exemple » »
  const example = right.match(/«\s*([^»]+?)\s*»\s*$/);
  const definition = example ? right.slice(0, example.index).trim() : right;
  if (cleanText(definition) === "") return { reason: "définition vide" };
  const content = vocabularyModel.contentFrom({ term: left, definition, example: example?.[1] ?? "" });
  return { kind: vocabularyModel.kind, content };
}

export function previewBatch(text: string, existing: Item[]): BatchPreview {
  const active = existing.filter((item) => item.deletedAt === undefined);
  const seen = new Set(active.map((item) => duplicateKey(item.kind, item.content)));
  const existingIds = new Set(existing.map((item) => item.id));
  const preview: BatchPreview = { source: text.trim().startsWith("{") ? "backup" : "text", entries: [], duplicates: [], ignored: [] };

  const accept = (entry: BatchEntry) => {
    const key = duplicateKey(entry.kind, entry.content);
    if (seen.has(key)) {
      preview.duplicates.push(findCategoryModel(entry.kind)?.title(entry.content) ?? "");
      return;
    }
    seen.add(key);
    preview.entries.push(entry);
  };

  if (preview.source === "backup") {
    const result = parseBackup(text, validateContent);
    if (!result.ok) {
      preview.ignored.push({ line: "Sauvegarde JSON", reason: result.error });
      return preview;
    }
    for (const item of result.backup.items) {
      if (item.deletedAt !== undefined || !findCategoryModel(item.kind) || existingIds.has(item.id)) continue;
      const reviews = result.backup.reviews.filter((review) => review.itemId === item.id);
      accept({ kind: item.kind, content: item.content, label: label(item.kind, item.content), fromBackup: { item, reviews } });
    }
    return preview;
  }

  for (const rawLine of text.split("\n")) {
    // Puces et numéros de liste retirés.
    const line = rawLine.replace(/^\s*(?:[-*•–—]|\d+[.)])\s+/, "").trim();
    if (line === "") continue;
    const read = readLine(line);
    if ("reason" in read) {
      preview.ignored.push({ line, reason: read.reason });
      continue;
    }
    accept({ ...read, label: label(read.kind, read.content) });
  }
  return preview;
}
