import { Screen } from "../../ui/Screen";
import { InfoList } from "../../ui/InfoList";
import { Section, SettingsCard } from "../../ui/Section";
import { CardsIcon, CloudIcon, InfoIcon, PulseIcon } from "../../ui/icons";
import { AccountPanel } from "./AccountPanel";
import { BackupPanel } from "./BackupPanel";
import { DiagnosticPanel } from "./DiagnosticPanel";
import { ReviewSettingsPanel } from "./ReviewSettingsPanel";

const buildDateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** Réglages, par ordre d'importance : la révision, la sauvegarde, puis le technique. */
export function SettingsScreen() {
  return (
    <Screen title="Réglages">
      <Section title="Révision" icon={<CardsIcon size={18} />}>
        <ReviewSettingsPanel />
      </Section>

      <Section title="Sauvegarde" icon={<CloudIcon size={18} />}>
        <AccountPanel />
        <BackupPanel />
      </Section>

      <Section title="Diagnostic" icon={<PulseIcon size={18} />} collapsible>
        <DiagnosticPanel />
      </Section>

      <Section title="À propos" icon={<InfoIcon size={18} />}>
        <SettingsCard>
          <InfoList
            rows={[
              { label: "Version", value: __APP_VERSION__ },
              { label: "Publiée le", value: buildDateFormatter.format(new Date(__BUILD_TIME__)) },
            ]}
          />
        </SettingsCard>
      </Section>
    </Screen>
  );
}
