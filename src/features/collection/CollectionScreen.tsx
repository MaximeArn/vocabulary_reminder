import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { SearchField } from "../../ui/SearchField";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { formatWordCount } from "../../ui/format";
import { SORT_LABELS, searchCards, sortCards, type CardSort } from "../../domain/collection";
import { describeCard } from "../../categories/registry";
import { useCards } from "./useCards";
import { CardList } from "./CardList";
import { CardDetailPage } from "./CardDetailPage";
import styles from "./CollectionScreen.module.css";

export function CollectionScreen() {
  const cards = useCards();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CardSort>("recent");
  const [openedId, setOpenedId] = useState<string | null>(null);

  if (cards === undefined) return null; // premier chargement, quasi instantané

  const visibleCards = sortCards(searchCards(cards, query, describeCard), sort, describeCard);

  return (
    <Screen eyebrow={formatWordCount(cards.length)} title="Collection">
      {cards.length === 0 ? (
        <p className={styles.message}>
          Ta collection est vide. Touche + pour ajouter ton premier mot, ou restaure une sauvegarde depuis les Réglages.
        </p>
      ) : (
        <>
          <div className={styles.tools}>
            <SearchField value={query} onChange={setQuery} placeholder="Rechercher un mot, une définition…" />
            <SegmentedControl label="Trier" options={SORT_LABELS} value={sort} onChange={setSort} />
          </div>
          {visibleCards.length === 0 ? (
            <p className={styles.message}>Aucun mot ne correspond à « {query.trim()} ».</p>
          ) : (
            <CardList cards={visibleCards} onOpen={(card) => setOpenedId(card.item.id)} />
          )}
        </>
      )}

      {openedId && <CardDetailPage itemId={openedId} onClose={() => setOpenedId(null)} />}
    </Screen>
  );
}
