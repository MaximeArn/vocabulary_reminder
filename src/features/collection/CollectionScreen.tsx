import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { SearchField } from "../../ui/SearchField";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { formatCardCount } from "../../ui/format";
import { SORT_LABELS, searchCards, sortCards, type CardSort } from "../../domain/collection";
import { describeCard, presentCategories, type AnyCategory } from "../../categories/registry";
import { useCards } from "./useCards";
import { CardList } from "./CardList";
import { CardDetailPage } from "./CardDetailPage";
import styles from "./CollectionScreen.module.css";

/** Tris proposés : une catégorie datée se lit d'abord dans l'ordre chronologique. */
function sortOptionsFor(category: AnyCategory): CardSort[] {
  return category.chronologicalKey ? ["chronological", "recent", "alphabetical"] : ["recent", "oldest", "alphabetical"];
}

/**
 * Collection : une catégorie à la fois (les mots et les dates sont deux
 * collections distinctes), avec recherche et tris propres à chacune.
 */
export function CollectionScreen() {
  const cards = useCards();
  const [chosenKind, setChosenKind] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sorts, setSorts] = useState<Record<string, CardSort>>({});
  const [openedId, setOpenedId] = useState<string | null>(null);

  if (cards === undefined) return null; // premier chargement, quasi instantané

  const categories = presentCategories(cards);
  const category = categories.find((candidate) => candidate.kind === chosenKind) ?? categories[0];

  if (!category) {
    return (
      <Screen eyebrow="Aucune fiche" title="Collection">
        <p className={styles.message}>
          Ta collection est vide. Touche + pour ajouter un mot ou une date, ou restaure une sauvegarde depuis les
          Réglages.
        </p>
      </Screen>
    );
  }

  const sortOptions = sortOptionsFor(category);
  const sort = sorts[category.kind] ?? sortOptions[0]!;
  const ofKind = cards.filter((card) => card.item.kind === category.kind);
  const visibleCards = sortCards(searchCards(ofKind, query, describeCard), sort, describeCard);

  return (
    <Screen eyebrow={formatCardCount(ofKind.length, category.unit)} title="Collection">
      <div className={styles.tools}>
        {categories.length > 1 && (
          <div className={styles.categories} style={{ "--category": category.color } as React.CSSProperties}>
            <SegmentedControl
              label="Catégorie"
              options={Object.fromEntries(categories.map((candidate) => [candidate.kind, candidate.label]))}
              value={category.kind}
              onChange={(kind) => {
                setChosenKind(kind);
                setQuery("");
              }}
            />
          </div>
        )}
        <SearchField value={query} onChange={setQuery} placeholder={category.searchPlaceholder} />
        <SegmentedControl
          label="Trier"
          options={Object.fromEntries(sortOptions.map((option) => [option, SORT_LABELS[option]]))}
          value={sort}
          onChange={(next) => setSorts((current) => ({ ...current, [category.kind]: next as CardSort }))}
        />
      </div>
      {visibleCards.length === 0 ? (
        <p className={styles.message}>Rien ne correspond à « {query.trim()} ».</p>
      ) : (
        <CardList cards={visibleCards} onOpen={(card) => setOpenedId(card.item.id)} />
      )}

      {openedId && <CardDetailPage itemId={openedId} onClose={() => setOpenedId(null)} />}
    </Screen>
  );
}
