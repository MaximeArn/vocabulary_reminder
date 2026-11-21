import { useState } from "react";
import type { ExplorerProps } from "../views";
import { ChevronRightIcon } from "../../ui/icons";
import { FranceMap } from "./FranceMap";
import { departmentOf, placeId, riverOf, type GeographyContent } from "./model";
import { regionName, riverWithArticle } from "./referential";
import styles from "./Geography.module.css";

/** Pas de formulaire : les fiches de géographie se choisissent dans le référentiel (voir `GeographyAddSheet`). */
export function GeographyFields() {
  return null;
}

/** Carte d'un lieu : le département, ou le cours d'eau (sur les départements en fond). */
function PlaceMap({ content, name }: { content: GeographyContent; name: string }) {
  return (
    <FranceMap
      tones={{ [placeId(content)]: "highlight" }}
      layer={content.type === "river" ? "rivers" : "departments"}
      label={`${name} sur la carte de France`}
    />
  );
}

/** Fiche détaillée : nom, repères (numéro, préfecture, région ; ou nature et embouchure), et la carte. */
export function GeographyDetail({ content }: { content: GeographyContent }) {
  if (content.type === "river") {
    const river = riverOf(content);
    return (
      <>
        <h1 className={styles.name}>{river.name}</h1>
        <dl className={styles.facts}>
          <dt className={styles.factLabel}>Nature</dt>
          <dd className={styles.factValue}>{river.kind === "fleuve" ? "Fleuve" : "Rivière"}</dd>
          <dt className={styles.factLabel}>Se jette dans</dt>
          <dd className={styles.factValue}>{river.outlet}</dd>
        </dl>
        <div className={styles.detailMap}>
          <PlaceMap content={content} name={riverWithArticle(river)} />
        </div>
      </>
    );
  }
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
        <PlaceMap content={content} name={department.name} />
      </div>
    </>
  );
}

/** Après une réponse : le lieu, ses repères, et la carte si la question n'en avait pas. */
export function GeographyExplanation({ content, showMap }: { content: GeographyContent; showMap?: boolean }) {
  const { name, code, facts } = describePlace(content);
  return (
    <>
      <p className={styles.answerName}>
        {name} {code && <span className={styles.answerCode}>{code}</span>}
      </p>
      <p className={styles.answerFacts}>{facts}</p>
      {showMap && (
        <div className={styles.answerMap}>
          <PlaceMap content={content} name={name} />
        </div>
      )}
    </>
  );
}

/** Nom, numéro (département) et repères d'un lieu, pour une ligne d'explication. */
function describePlace(content: GeographyContent): { name: string; code?: string; facts: string } {
  if (content.type === "river") {
    const river = riverOf(content);
    return { name: river.name, facts: `${river.kind === "fleuve" ? "Fleuve" : "Rivière"} · se jette dans ${river.outlet}` };
  }
  const department = departmentOf(content);
  return {
    name: department.name,
    code: department.code,
    facts: `Préfecture : ${department.prefecture} · ${regionName(department.region)}`,
  };
}

/**
 * Collection de géographie : la carte en plein écran, à parcourir librement, avec les
 * départements et les cours d'eau. Toucher un lieu le montre avec ses repères ; toucher
 * ce bandeau ouvre sa fiche (progression).
 */
export function GeographyExplorer({ items, onOpen }: ExplorerProps<GeographyContent>) {
  const [zone, setZone] = useState<string | null>(null);
  const item = zone === null ? undefined : items.find((candidate) => placeId(candidate.content) === zone);
  const place = item && describePlace(item.content);

  return (
    <div className={styles.explorer}>
      <FranceMap
        fill
        layer="all"
        tones={zone ? { [zone]: "selected" } : {}}
        // Toucher à nouveau le lieu choisi le désélectionne.
        onSelect={(touched) => setZone(touched === zone ? null : touched)}
        label="Carte des départements et des cours d’eau"
      />
      {/* Sous la carte, à hauteur fixe : il ne cache aucun lieu et la carte ne bouge pas. */}
      <div className={styles.explorerFooter} aria-live="polite">
        {item && place ? (
          <button type="button" className={styles.explorerCard} onClick={() => onOpen(item.id)}>
            <span className={styles.explorerText}>
              <span className={styles.answerName}>
                {place.name} {place.code && <span className={styles.answerCode}>{place.code}</span>}
              </span>
              <span className={styles.answerFacts}>{place.facts}</span>
            </span>
            <ChevronRightIcon size={18} />
          </button>
        ) : (
          <p className={styles.explorerHint}>Touche un département ou un cours d’eau</p>
        )}
      </div>
    </div>
  );
}
