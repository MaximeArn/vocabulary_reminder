import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { SearchField } from "../../ui/SearchField";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { formatWordCount } from "../../ui/format";
import { SORT_LABELS, searchWords, sortWords, type WordSort } from "../../domain/collection";
import { useWords } from "./useWords";
import { WordList } from "./WordList";
import { WordDetailPage } from "./WordDetailPage";
import styles from "./CollectionScreen.module.css";

export function CollectionScreen() {
  const words = useWords();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WordSort>("recent");
  const [openedWordId, setOpenedWordId] = useState<string | null>(null);

  if (words === undefined) return null; // premier chargement, quasi instantané

  const visibleWords = sortWords(searchWords(words, query), sort);

  return (
    <Screen eyebrow={formatWordCount(words.length)} title="Collection">
      {words.length === 0 ? (
        <p className={styles.message}>
          Ta collection est vide. Touche + pour ajouter ton premier mot, ou restaure une sauvegarde depuis les Réglages.
        </p>
      ) : (
        <>
          <div className={styles.tools}>
            <SearchField value={query} onChange={setQuery} placeholder="Rechercher un mot, une définition…" />
            <SegmentedControl label="Trier" options={SORT_LABELS} value={sort} onChange={setSort} />
          </div>
          {visibleWords.length === 0 ? (
            <p className={styles.message}>Aucun mot ne correspond à « {query.trim()} ».</p>
          ) : (
            <WordList words={visibleWords} onOpen={(word) => setOpenedWordId(word.id)} />
          )}
        </>
      )}

      {openedWordId && <WordDetailPage wordId={openedWordId} onClose={() => setOpenedWordId(null)} />}
    </Screen>
  );
}
