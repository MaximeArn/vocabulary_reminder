import { useState } from "react";
import type { ExplorerProps } from "../views";
import { ChevronRightIcon } from "../../ui/icons";
import { FranceMap } from "./FranceMap";
import { departmentOf, type GeographyContent } from "./model";
import { findDepartment, regionName } from "./referential";
import styles from "./Geography.module.css";

/** Pas de formulaire : les fiches de géographie se choisissent dans le référentiel (voir `GeographyAddSheet`). */
export function GeographyFields() {
  return null;
}

/** Fiche détaillée : nom, numéro, préfecture, région, et la carte. */
export function GeographyDetail({ content }: { content: GeographyContent }) {
  const department = departmentOf(content);
  return (
    <>
      <h1 className={styles.name}>{department.name}</h1>
      <dl className={styles.facts}>
        <dt className={styles.factLabel}>Numéro</dt>
        <dd className={styles.factValue}>{department.code}</dd>
        <dt className={styles.factLabel}>Préfecture</dt>
        <dd className={styles.factValue}>{department.prefecture}</dd>
        <dt className={styles.factLabel}>Région</dt>
        <dd className={styles.factValue}>{regionName(department.region)}</dd>
      </dl>
      <div className={styles.detailMap}>
        <FranceMap
          tones={{ [department.code]: "highlight" }}
          label={`${department.name} sur la carte de France`}
        />
      </div>
    </>
  );
}

/** Après une réponse : le département, ses repères, et la carte si la question n'en avait pas. */
export function GeographyExplanation({
  content,
  showMap,
}: {
  content: GeographyContent;
  showMap?: boolean;
}) {
  const department = departmentOf(content);
  return (
    <>
      <p className={styles.answerName}>
        {department.name}{" "}
        <span className={styles.answerCode}>{department.code}</span>
      </p>
      <p className={styles.answerFacts}>
        Préfecture : {department.prefecture} · {regionName(department.region)}
      </p>
      {showMap && (
        <div className={styles.answerMap}>
          <FranceMap
            tones={{ [department.code]: "highlight" }}
            label={`${department.name} sur la carte de France`}
          />
        </div>
      )}
    </>
  );
}

/**
 * Collection de géographie : la carte en plein écran, à parcourir librement. Toucher un
 * département le montre avec ses repères ; toucher ce bandeau ouvre sa fiche (progression).
 */
export function GeographyExplorer({
  items,
  onOpen,
}: ExplorerProps<GeographyContent>) {
  const [code, setCode] = useState<string | null>(null);
  const department = code ? findDepartment(code) : undefined;
  const item = items.find((candidate) => candidate.content.code === code);

  return (
    <div className={styles.explorer}>
      <FranceMap
        fill
        tones={code ? { [code]: "selected" } : {}}
        // Toucher à nouveau le département choisi le désélectionne.
        onSelect={(touched) => setCode(touched === code ? null : touched)}
        label="Carte des départements"
      />
      {/* Sous la carte, à hauteur fixe : il ne cache aucun département et la carte ne bouge pas. */}
      <div className={styles.explorerFooter} aria-live="polite">
        {department && item ? (
          <button
            type="button"
            className={styles.explorerCard}
            onClick={() => onOpen(item.id)}
          >
            <span className={styles.explorerText}>
              <span className={styles.answerName}>
                {department.name}{" "}
                <span className={styles.answerCode}>{department.code}</span>
              </span>
              <span className={styles.answerFacts}>
                {department.prefecture} · {regionName(department.region)}
              </span>
            </span>
            <ChevronRightIcon size={18} />
          </button>
        ) : (
          <p className={styles.explorerHint}>Touche un département</p>
        )}
      </div>
    </div>
  );
}
