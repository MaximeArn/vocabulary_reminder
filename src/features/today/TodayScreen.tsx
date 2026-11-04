import { Screen } from "../../ui/Screen";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { formatWordCount } from "../../ui/format";
import { InstallHint } from "../../pwa/InstallHint";
import { useWords } from "../words/useWords";
import styles from "./TodayScreen.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function TodayScreen() {
  const words = useWords();

  return (
    <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui">
      <InstallHint />
      {words !== undefined && (
        <Card>
          {words.length === 0 ? (
            <>
              <p className={styles.lead}>Ton carnet est encore vide.</p>
              <p className={styles.text}>
                Ajoute les mots rencontrés au fil de tes lectures avec le bouton +, puis reviens chaque jour les réviser.
              </p>
            </>
          ) : (
            <>
              <p className={styles.lead}>{formatWordCount(words.length)} dans ton carnet.</p>
              <p className={styles.text}>Les révisions quotidiennes arrivent très bientôt.</p>
            </>
          )}
          <Button fullWidth disabled>
            Commencer la révision
          </Button>
        </Card>
      )}
    </Screen>
  );
}
