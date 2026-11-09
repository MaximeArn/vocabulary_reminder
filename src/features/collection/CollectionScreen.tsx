import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { SearchField } from "../../ui/SearchField";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { formatCardCount } from "../../ui/format";
import { SORT_LABELS, searchCards, sortCards, type CardSort } from "../../domain/collection";
import { categoryFilterOptions, describeCard, filterByKind, unitFor } from "../../categories/registry";
import { useCards } from "./useCards";
import { CardList } from "./CardList";
import { CardDetailPage } from "./CardDetailPage";
import styles from "./CollectionScreen.module.css";

export function CollectionScreen() {
  const cards = useCards();
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CardSort>("recent");
  const [openedId, setOpenedId] = useState<string | null>(null);

  if (cards === undefined) return null; // premier chargement, quasi instantané

  // Le filtre par catégorie n'apparaît que si plusieurs catégories ont des fiches.
  const filterOptions = categoryFilterOptions(cards);
  const ofKind = filterOptions ? filterByKind(cards, kind) : cards;
  const visibleCards = sortCards(searchCards(ofKind, query, describeCard), sort, describeCard);

  return (
    <Screen eyebrow={formatCardCount(ofKind.length, unitFor(ofKind))} title="Collection">
      {cards.length === 0 ? (
        <p className={styles.message}>
          Ta collection est vide. Touche + pour ajouter un mot ou une date, ou restaure une sauvegarde depuis les
          Réglages.
        </p>
      ) : (
        <>
          <div className={styles.tools}>
            {filterOptions && <SegmentedControl label="Catégorie" options={filterOptions} value={kind} onChange={setKind} />}
            <SearchField value={query} onChange={setQuery} placeholder="Rechercher…" />
            <SegmentedControl label="Trier" options={SORT_LABELS} value={sort} onChange={setSort} />
          </div>
          {visibleCards.length === 0 ? (
            <p className={styles.message}>Rien ne correspond à « {query.trim()} ».</p>
          ) : (
            <CardList cards={visibleCards} onOpen={(card) => setOpenedId(card.item.id)} />
          )}
        </>
      )}

      {openedId && <CardDetailPage itemId={openedId} onClose={() => setOpenedId(null)} />}
    </Screen>
  );
}
