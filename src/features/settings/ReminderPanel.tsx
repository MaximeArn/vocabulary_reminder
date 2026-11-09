import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { writeSetting } from "../../data/settingsRepository";
import { currentSubscription, disableReminder, enableReminder, pushAvailability, sendTestReminder } from "../../pwa/push";
import { DEFAULT_REMINDER_TIME, REMINDER_TIME_KEY } from "../../sync/reminderPublisher";
import { syncNow } from "../../sync/service";
import { Button } from "../../ui/Button";
import { SettingsCard } from "../../ui/Section";
import { Toggle } from "../../ui/Toggle";
import { useToast } from "../../ui/Toast";
import styles from "./ReminderPanel.module.css";

const UNAVAILABLE: Record<string, string> = {
  "needs-install": "Disponible dans l’app installée sur l’écran d’accueil.",
  unsupported: "Ce navigateur ne permet pas les notifications.",
  denied: "Notifications refusées. Pour les autoriser : Réglages de l’iPhone › Notifications › Mnémé.",
};

/**
 * Rappel quotidien : activé appareil par appareil (chacun s'abonne aux
 * notifications) ; l'heure est commune à tous les appareils du compte.
 */
export function ReminderPanel() {
  const showToast = useToast();
  const availability = pushAvailability();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeSetting = useLiveQuery(() => db.settings.get(REMINDER_TIME_KEY), []);
  const time = typeof timeSetting?.value === "string" ? timeSetting.value : DEFAULT_REMINDER_TIME;

  useEffect(() => {
    currentSubscription()
      .then((subscription) => setEnabled(subscription !== null))
      .catch(() => setEnabled(false));
  }, []);

  const toggle = (on: boolean) => {
    setError(null);
    setBusy(true);
    // Appel immédiat (sans attente avant) : iOS ne demande la permission qu'en réponse à un toucher.
    const action = on ? enableReminder() : disableReminder();
    action
      .then(() => {
        setEnabled(on);
        // L'état du rappel (heure, fiches dues…) part au serveur avec la synchronisation.
        if (on) void syncNow();
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Le rappel n’a pas pu être modifié."))
      .finally(() => setBusy(false));
  };

  const test = () => {
    setError(null);
    sendTestReminder()
      .then(() => showToast({ message: "Rappel d’essai envoyé : il arrive dans quelques secondes." }))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Le rappel d’essai a échoué."));
  };

  return (
    <SettingsCard title="Rappel quotidien" padded>
      {availability !== "available" ? (
        <p className={styles.note}>{UNAVAILABLE[availability]}</p>
      ) : (
        <>
          <Toggle label="Me rappeler de réviser" checked={enabled === true} onChange={(on) => !busy && toggle(on)} />
          {enabled && (
            <>
              <label className={styles.row}>
                <span className={styles.label}>Heure</span>
                <input
                  className={styles.time}
                  type="time"
                  value={time}
                  onChange={(event) => {
                    if (/^\d{2}:\d{2}$/.test(event.target.value)) void writeSetting(REMINDER_TIME_KEY, event.target.value);
                  }}
                />
              </label>
              <p className={styles.note}>
                Chaque jour à cette heure, seulement s’il reste des fiches à réviser et que tu n’as pas encore révisé.
              </p>
              <Button variant="quiet" onClick={test}>
                Envoyer un rappel d’essai
              </Button>
            </>
          )}
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </SettingsCard>
  );
}
