import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { addItems } from "../../data/itemsRepository";
import { previewBatch } from "../../categories/batch";
import { findCategory, unitForKinds } from "../../categories/registry";
import { Sheet } from "../../ui/Sheet";
import { useToast } from "../../ui/Toast";
import { formatAdded } from "../../ui/format";
import { formatCount } from "../../categories/model";
import styles from "./BatchAddSheet.module.css";

const EXAMPLE = `331 av. J.-C. : Bataille de Gaugamèles
1337-1453 : Guerre de Cent Ans
alacrité : vivacité et enjouement « Il répondit avec alacrité. »`;

/** Nombre de fiches montrées dans l'aperçu (les autres sont résumées). */
const PREVIEW_SHOWN = 12;

/**
 * Ajout de plusieurs fiches d'un coup, par copier-coller : une fiche par ligne,
 * ou une sauvegarde JSON. Rien n'est remplacé ; les doublons sont écartés.
 */
export function BatchAddSheet({ onClose }: { onClose: () => void }) {
  const items = useLiveQuery(() => db.items.toArray(), []) ?? [];
  const showToast = useToast();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => previewBatch(text, items), [text, items]);
  const count = preview.entries.length;

  // « 14 dates · 3 mots »
  const byKind = [...new Set(preview.entries.map((entry) => entry.kind))].map((kind) => {
    const category = findCategory(kind);
    const total = preview.entries.filter((entry) => entry.kind === kind).length;
    return category ? formatCount(total, category.unit) : "";
  });

  const save = async () => {
    setSaving(true);
    try {
      const added = await addItems(preview.entries);
      const unit = unitForKinds(preview.entries.map((entry) => entry.kind));
      showToast({ message: formatAdded(added, unit) });
      onClose();
    } catch {
      setSaving(false);
      showToast({ message: "L’ajout a échoué. Rien n’a été modifié." });
    }
  };

  const cancel = () => {
    if (text.trim() !== "" && !window.confirm("Abandonner cet ajout ?")) return;
    onClose();
  };

  return (
    <Sheet
      title="Ajouter plusieurs"
      confirmLabel={count > 0 ? `Ajouter (${count})` : "Ajouter"}
      onConfirm={save}
      onCancel={cancel}
      confirmDisabled={count === 0 || saving}
    >
      <p className={styles.help}>
        Une fiche par ligne : « date : événement » ou « mot : définition ». Un exemple peut suivre entre « ». Tu peux
        aussi coller une sauvegarde JSON.
      </p>
      <p className={styles.example} aria-label="Exemple">
        {EXAMPLE}
      </p>
      <textarea
        className={styles.input}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Colle tes notes ici…"
        aria-label="Fiches à ajouter"
        autoCapitalize="sentences"
      />

      {text.trim() !== "" && (
        <div className={styles.preview} aria-live="polite">
          <p className={styles.summary}>{count > 0 ? `Prêt à ajouter : ${byKind.join(" · ")}` : "Aucune fiche reconnue."}</p>
          {count > 0 && (
            <ul className={styles.list}>
              {preview.entries.slice(0, PREVIEW_SHOWN).map((entry, index) => (
                <li key={index} className={styles.entry}>
                  <span className={styles.dot} style={{ background: findCategory(entry.kind)?.color }} aria-hidden="true" />
                  {entry.label}
                </li>
              ))}
            </ul>
          )}
          {count > PREVIEW_SHOWN && <p className={styles.more}>… et {count - PREVIEW_SHOWN} autres.</p>}
          {preview.duplicates.length > 0 && (
            <div className={styles.notice}>
              <strong>Déjà dans ta collection, ignorées :</strong> {preview.duplicates.join(", ")}
            </div>
          )}
          {preview.ignored.length > 0 && (
            <div className={styles.notice}>
              <strong>Lignes non reconnues :</strong>
              <ul>
                {preview.ignored.map((ignored, index) => (
                  <li key={index}>
                    « {ignored.line} » : {ignored.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
