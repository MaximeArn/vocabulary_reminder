import { useId, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { addItems } from "../../data/itemsRepository";
import { Sheet } from "../../ui/Sheet";
import { useToast } from "../../ui/Toast";
import { CheckIcon, ChevronRightIcon } from "../../ui/icons";
import type { DepartmentContent } from "./model";
import { DEPARTMENTS, REGIONS, type Department } from "./referential";
import styles from "./GeographyAddSheet.module.css";

/** Régions de métropole par ordre alphabétique, puis l'outre-mer. */
const isOverseasRegion = (code: string) => Number(code) < 10;
const regionsInOrder = [...REGIONS].sort(
  (a, b) => Number(isOverseasRegion(a.code)) - Number(isOverseasRegion(b.code)) || a.name.localeCompare(b.name, "fr"),
);
const departmentsOf = (regionCode: string) =>
  DEPARTMENTS.filter((department) => department.region === regionCode).sort((a, b) =>
    a.code.localeCompare(b.code, "fr", { numeric: true }),
  );

/**
 * Ajout de départements : tout d'un coup, région par région, ou un par un.
 * Ceux déjà dans la collection sont signalés et ne sont pas ajoutés deux fois.
 */
export function GeographyAddSheet({ onClose }: { onClose: () => void }) {
  const showToast = useToast();
  const items = useLiveQuery(() => db.items.where("kind").equals("geography").toArray(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const owned = new Set(
    (items ?? [])
      .filter((item) => item.deletedAt === undefined)
      .map((item) => (item.content as DepartmentContent).code),
  );
  const available = (departments: Department[]) => departments.filter((department) => !owned.has(department.code));
  const allAvailable = available(DEPARTMENTS);

  const setMany = (codes: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const code of codes) {
        if (on) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  const toggleOpen = (region: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const codes = DEPARTMENTS.map((department) => department.code).filter((code) => selected.has(code));
      const added = await addItems(codes.map((code) => ({ kind: "geography", content: { type: "department", code } })));
      showToast({ message: `${added} ${added > 1 ? "départements ajoutés" : "département ajouté"}` });
      onClose();
    } catch {
      setSaving(false);
      showToast({ message: "L’ajout a échoué. Rien n’a été modifié." });
    }
  };

  const everything = allAvailable.length > 0 && allAvailable.every((department) => selected.has(department.code));

  return (
    <Sheet
      title="Départements"
      confirmLabel={selected.size > 0 ? `Ajouter (${selected.size})` : "Ajouter"}
      onConfirm={save}
      onCancel={onClose}
      confirmDisabled={selected.size === 0 || saving}
    >
      {allAvailable.length === 0 ? (
        <p className={styles.help}>Les 101 départements sont déjà dans ta collection.</p>
      ) : (
        <>
          <p className={styles.help}>Choisis les départements à réviser : tous, par région, ou un par un.</p>
          <Checkbox
            checked={everything ? true : selected.size > 0 ? "mixed" : false}
            onChange={() => setMany(allAvailable.map((department) => department.code), !everything)}
            label="Tous les départements"
            detail={`${allAvailable.length} à ajouter`}
            strong
          />
        </>
      )}

      <ul className={styles.regions}>
        {regionsInOrder.map((region) => {
          const departments = departmentsOf(region.code);
          const free = available(departments);
          const chosen = free.filter((department) => selected.has(department.code)).length;
          const expanded = open.has(region.code);
          return (
            <li key={region.code} className={styles.region}>
              <div className={styles.regionRow}>
                <Checkbox
                  checked={free.length > 0 && chosen === free.length ? true : chosen > 0 ? "mixed" : false}
                  disabled={free.length === 0}
                  onChange={() => setMany(free.map((department) => department.code), chosen < free.length)}
                  label={region.name}
                  detail={
                    free.length === 0
                      ? "Déjà dans ta collection"
                      : `${departments.length} ${departments.length > 1 ? "départements" : "département"}${
                          free.length < departments.length ? ` · ${departments.length - free.length} déjà ajoutés` : ""
                        }`
                  }
                />
                {departments.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.expand} ${expanded ? styles.expanded : ""}`}
                    onClick={() => toggleOpen(region.code)}
                    aria-expanded={expanded}
                    aria-label={`Départements de ${region.name}`}
                  >
                    <ChevronRightIcon size={18} />
                  </button>
                )}
              </div>
              {expanded && (
                <ul className={styles.departments}>
                  {departments.map((department) => (
                    <li key={department.code}>
                      <Checkbox
                        checked={owned.has(department.code) || selected.has(department.code)}
                        disabled={owned.has(department.code)}
                        onChange={() => setMany([department.code], !selected.has(department.code))}
                        label={`${department.code} · ${department.name}`}
                        detail={owned.has(department.code) ? "Déjà ajouté" : undefined}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

interface CheckboxProps {
  checked: boolean | "mixed";
  onChange: () => void;
  label: string;
  detail?: string;
  disabled?: boolean;
  strong?: boolean;
}

function Checkbox({ checked, onChange, label, detail, disabled, strong }: CheckboxProps) {
  const detailId = useId();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={detail ? detailId : undefined}
      className={`${styles.checkbox} ${strong ? styles.strong : ""}`}
      onClick={onChange}
      disabled={disabled}
    >
      <span className={`${styles.box} ${checked === true ? styles.on : checked === "mixed" ? styles.mixed : ""}`} aria-hidden="true">
        {checked === true && <CheckIcon size={14} />}
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {detail && (
          <span className={styles.detail} id={detailId}>
            {detail}
          </span>
        )}
      </span>
    </button>
  );
}
