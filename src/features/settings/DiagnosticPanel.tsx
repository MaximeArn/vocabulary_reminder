import { useEffect, useState } from "react";
import { InfoList } from "../../ui/InfoList";
import { SettingsCard } from "../../ui/Section";
import { Button } from "../../ui/Button";
import { requestPersistentStorage } from "../../pwa/storageStatus";
import { collectDiagnostic, toInfoRows, type DiagnosticReport } from "./diagnostic";

export function DiagnosticPanel() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const refresh = () => {
    collectDiagnostic().then(setReport);
  };

  useEffect(refresh, []);

  const askPersistence = async () => {
    await requestPersistentStorage();
    refresh();
  };

  if (!report) return null;

  return (
    <SettingsCard>
      <InfoList
      rows={toInfoRows(report)}
      footer={
        report.storage.persisted === false && (
          <Button variant="quiet" onClick={askPersistence}>
            Demander le stockage persistant
          </Button>
        )
      }
      />
    </SettingsCard>
  );
}
