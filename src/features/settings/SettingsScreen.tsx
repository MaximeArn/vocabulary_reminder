import { Screen } from "../../ui/Screen";
import { InfoList } from "../../ui/InfoList";
import { BackupPanel } from "./BackupPanel";
import { DiagnosticPanel } from "./DiagnosticPanel";

const buildDateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export function SettingsScreen() {
  return (
    <Screen title="Réglages">
      <BackupPanel />
      <DiagnosticPanel />
      <InfoList
        heading="À propos"
        rows={[
          { label: "Version", value: __APP_VERSION__ },
          { label: "Publiée le", value: buildDateFormatter.format(new Date(__BUILD_TIME__)) },
        ]}
      />
    </Screen>
  );
}
