import { FranceMap } from "./FranceMap";
import { departmentOf, type GeographyContent } from "./model";
import { regionName } from "./referential";
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
        <FranceMap tones={{ [department.code]: "highlight" }} label={`${department.name} sur la carte de France`} />
      </div>
    </>
  );
}

/** Après une réponse : le département, ses repères, et la carte si la question n'en avait pas. */
export function GeographyExplanation({ content, showMap }: { content: GeographyContent; showMap?: boolean }) {
  const department = departmentOf(content);
  return (
    <>
      <p className={styles.answerName}>
        {department.name} <span className={styles.answerCode}>{department.code}</span>
      </p>
      <p className={styles.answerFacts}>
        Préfecture : {department.prefecture} · {regionName(department.region)}
      </p>
      {showMap && (
        <div className={styles.answerMap}>
          <FranceMap tones={{ [department.code]: "highlight" }} label={`${department.name} sur la carte de France`} />
        </div>
      )}
    </>
  );
}
