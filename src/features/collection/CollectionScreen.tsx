import { useState } from "react";
import { Screen } from "../../ui/Screen";
import { SearchField } from "../../ui/SearchField";
import { CategoryToggle } from "../../ui/CategoryToggle";
import { formatCardCount } from "../../ui/format";
import { searchCards, sortCards, type CardSort, type SortDirection, type SortKey } from "../../domain/collection";
import { describeCard, presentCategories, type AnyCategory } from "../../categories/registry";
import { useCards } from "./useCards";
import { CardList } from "./CardList";
import { CardDetailPage } from "./CardDetailPage";
import { SortButtons } from "./SortButtons";
import styles from "./CollectionScreen.module.css";

/**
 * Tris proposés, le premier étant celui par défaut : une catégorie datée se lit
 * dans l'ordre chronologique ; le vocabulaire, du plus récent au plus ancien.
 */
function sortOptionsFor(category: AnyCategory): { key: SortKey; direction: SortDirection }[] {
  return category.chronologicalKey
    ? [
        { key: "chronological", direction: "asc" },
        { key: "added", direction: "desc" },
      ]
    : [
        { key: "added", direction: "desc" },
        { key: "alphabetical", direction: "asc" },
      ];
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
  const sort: CardSort = sorts[category.kind] ?? sortOptions[0]!;
  const ofKind = cards.filter((card) => card.item.kind === category.kind);
  const visibleCards = sortCards(searchCards(ofKind, query, describeCard), sort, describeCard);

  return (
    <Screen eyebrow={formatCardCount(ofKind.length, category.unit)} title="Collection">
      <div className={styles.tools}>
        {categories.length > 1 && (
          <div className={styles.categories}>
            <CategoryToggle
              label="Catégorie"
              options={categories.map((candidate) => ({
                value: candidate.kind,
                label: candidate.label,
                fill: candidate.fillColor,
                onFill: candidate.onFillColor,
              }))}
              value={category.kind}
              onChange={(kind) => {
                setChosenKind(kind);
                setQuery("");
              }}
            />
          </div>
        )}
        <SearchField value={query} onChange={setQuery} placeholder={category.searchPlaceholder} />
        <SortButtons options={sortOptions} value={sort} onChange={(next) => setSorts((current) => ({ ...current, [category.kind]: next }))} />
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
