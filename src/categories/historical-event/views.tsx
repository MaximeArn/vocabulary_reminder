import { TextField } from "../../ui/TextField";
import { Toggle } from "../../ui/Toggle";
import type { FieldsProps } from "../views";
import { formatAge } from "./dates";
import { DateInput } from "./DateInput";
import { eventDateLabel, findSameEvent, type HistoricalEventContent, type HistoricalEventDraft } from "./model";
import styles from "./HistoricalEvent.module.css";

/** Formulaire : événement, date ou période, contexte, personnages, source, notes. */
export function HistoricalEventFields({
  draft,
  onChange,
  errors,
  items,
  editedId,
}: FieldsProps<HistoricalEventContent, HistoricalEventDraft>) {
  const sameEvent = findSameEvent(items, draft.name, editedId);
  const update = (changes: Partial<HistoricalEventDraft>) => onChange({ ...draft, ...changes });

  return (
    <>
      <TextField
        label="Événement"
        value={draft.name}
        onChange={(name) => update({ name })}
        serif
        autoFocus={editedId === undefined}
        error={errors.name}
        hint={sameEvent && `« ${sameEvent.content.name} » est déjà dans ta collection (${eventDateLabel(sameEvent.content)}).`}
      />
      <DateInput
        legend={draft.isPeriod ? "Début" : "Date"}
        value={draft.start}
        onChange={(start) => update({ start })}
        error={errors.start}
      />
      <Toggle label="C’est une période (avec une date de fin)" checked={draft.isPeriod} onChange={(isPeriod) => update({ isPeriod })} />
      {draft.isPeriod && <DateInput legend="Fin" value={draft.end} onChange={(end) => update({ end })} error={errors.end} />}
      <Toggle label="Date incertaine ou discutée" checked={draft.uncertain} onChange={(uncertain) => update({ uncertain })} />
      <TextField
        label="Contexte"
        value={draft.description}
        onChange={(description) => update({ description })}
        multiline
        serif
        optional
        hint="Ce qu’il faut retenir : il sera affiché après chaque réponse."
      />
      <TextField
        label="Personnages"
        value={draft.people}
        onChange={(people) => update({ people })}
        optional
        hint="Séparés par des virgules."
      />
      <TextField label="Source" value={draft.source} onChange={(source) => update({ source })} optional hint="Le livre où tu l’as découvert." />
      <TextField label="Notes personnelles" value={draft.notes} onChange={(notes) => update({ notes })} multiline optional />
    </>
  );
}

function DateLine({ content, className }: { content: HistoricalEventContent; className: string | undefined }) {
  return (
    <p className={className}>
      {eventDateLabel(content)}
      {content.uncertain && " · date incertaine"}
    </p>
  );
}

export function HistoricalEventDetail({ content }: { content: HistoricalEventContent }) {
  const age = formatAge(content.start, new Date().getFullYear());
  return (
    <>
      <h1 className={styles.name}>{content.name}</h1>
      <DateLine content={content} className={styles.date} />
      {age && <p className={styles.age}>{age}</p>}
      {content.description && <p className={styles.description}>{content.description}</p>}
      {(content.people.length > 0 || content.source) && (
        <dl className={styles.facts}>
          {content.people.length > 0 && (
            <>
              <dt className={styles.factLabel}>Personnages</dt>
              <dd className={styles.factValue}>{content.people.join(", ")}</dd>
            </>
          )}
          {content.source && (
            <>
              <dt className={styles.factLabel}>Source</dt>
              <dd className={styles.factValue}>
                <em>{content.source}</em>
              </dd>
            </>
          )}
        </dl>
      )}
      {content.notes && <p className={styles.notes}>{content.notes}</p>}
    </>
  );
}

export function HistoricalEventExplanation({ content }: { content: HistoricalEventContent }) {
  return (
    <>
      <p className={styles.answerName}>{content.name}</p>
      <DateLine content={content} className={styles.answerDate} />
      {content.description && <p className={styles.answerDescription}>{content.description}</p>}
      {content.people.length > 0 && <p className={styles.answerPeople}>Avec {content.people.join(", ")}</p>}
    </>
  );
}
