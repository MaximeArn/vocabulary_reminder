import { Screen } from "../../ui/Screen";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { InstallHint } from "../../pwa/InstallHint";
import styles from "./TodayScreen.module.css";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function TodayScreen() {
  return (
    <Screen eyebrow={dateFormatter.format(new Date())} title="Aujourd’hui">
      <InstallHint />
      <Card>
        <p className={styles.lead}>Ton carnet est encore vide.</p>
        <p className={styles.text}>Ajoute les mots rencontrés au fil de tes lectures, puis reviens chaque jour les réviser.</p>
        <Button fullWidth disabled>
          Commencer la révision
        </Button>
      </Card>
    </Screen>
  );
}
