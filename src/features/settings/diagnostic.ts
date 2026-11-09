import { MIGRATION_V3_KEY, db, type MigrationReport } from "../../data/db";
import { readSetting } from "../../data/settingsRepository";
import { readLaunchInfo, type LaunchInfo } from "../../data/launchLog";
import { isStandalone } from "../../pwa/displayMode";
import { readServiceWorkerStatus, type ServiceWorkerStatus } from "../../pwa/serviceWorkerStatus";
import { readStorageStatus, type StorageStatus } from "../../pwa/storageStatus";
import type { InfoRow } from "../../ui/InfoList";

/**
 * Collecte des informations techniques affichées dans Réglages > Diagnostic.
 * But : constater sur l'iPhone que la PWA fonctionne, plutôt que le supposer.
 */

export interface DiagnosticReport {
  standalone: boolean;
  online: boolean;
  serviceWorker: ServiceWorkerStatus;
  storage: StorageStatus;
  database: { ok: true; itemCount: number } | { ok: false; error: string };
  launches: LaunchInfo | undefined;
  migration: MigrationReport | undefined;
}

export async function collectDiagnostic(): Promise<DiagnosticReport> {
  const [serviceWorker, storage, database, launches, migration] = await Promise.all([
    readServiceWorkerStatus().catch((): ServiceWorkerStatus => "not-registered"),
    readStorageStatus(),
    checkDatabase(),
    readLaunchInfo().catch(() => undefined),
    readSetting<MigrationReport>(MIGRATION_V3_KEY).catch(() => undefined),
  ]);
  return {
    standalone: isStandalone(),
    online: navigator.onLine,
    serviceWorker,
    storage,
    database,
    launches,
    migration,
  };
}

async function checkDatabase(): Promise<DiagnosticReport["database"]> {
  try {
    const items = await db.items.filter((item) => item.deletedAt === undefined).count();
    return { ok: true, itemCount: items };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/* ---------- Mise en forme pour l'affichage ---------- */

const SERVICE_WORKER_LABELS: Record<ServiceWorkerStatus, string> = {
  active: "Actif",
  installing: "En cours d’installation",
  "not-registered": "Non enregistré",
  unsupported: "Non pris en charge",
};

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const decimalFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "inconnu";
  if (bytes < 1024 * 1024) return `${decimalFormatter.format(bytes / 1024)} Ko`;
  if (bytes < 1024 ** 3) return `${decimalFormatter.format(bytes / 1024 ** 2)} Mo`;
  return `${decimalFormatter.format(bytes / 1024 ** 3)} Go`;
}

export function toInfoRows(report: DiagnosticReport): InfoRow[] {
  const { storage, database, launches, migration } = report;
  return [
    {
      label: "Mode d’affichage",
      value: report.standalone ? "App installée" : "Navigateur",
      tone: report.standalone ? "good" : "neutral",
    },
    {
      label: "Service worker",
      value: SERVICE_WORKER_LABELS[report.serviceWorker],
      tone: report.serviceWorker === "active" ? "good" : "bad",
    },
    { label: "Connexion", value: report.online ? "En ligne" : "Hors ligne" },
    {
      label: "Stockage persistant",
      value: storage.persisted === null ? "inconnu" : storage.persisted ? "Oui" : "Non",
      tone: storage.persisted ? "good" : "neutral",
    },
    { label: "Espace utilisé", value: `${formatBytes(storage.usageBytes)} / ${formatBytes(storage.quotaBytes)}` },
    database.ok
      ? { label: "Base de données", value: `OK · ${database.itemCount} fiche(s)`, tone: "good" }
      : { label: "Base de données", value: `Erreur : ${database.error}`, tone: "bad" },
    { label: "Lancements", value: launches ? String(launches.launchCount) : "—" },
    {
      label: "Premier lancement",
      value: launches ? dateTimeFormatter.format(launches.firstLaunchAt) : "—",
    },
    ...(migration ? [migrationRow(migration)] : []),
  ];
}

/** Résultat de la migration vers le modèle générique (v3), si elle a eu lieu sur cet appareil. */
function migrationRow(migration: MigrationReport): InfoRow {
  if (migration.mismatches.length === 0) {
    return { label: "Migration v3", value: `OK · ${migration.checkedItems} fiche(s) vérifiée(s)`, tone: "good" };
  }
  const terms = migration.mismatches.map((mismatch) => mismatch.term).join(", ");
  return { label: "Migration v3", value: `${migration.mismatches.length} écart(s) : ${terms}`, tone: "bad" };
}
