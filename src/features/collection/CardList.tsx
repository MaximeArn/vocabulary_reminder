import type { Card } from "../../domain/card";
import { findCategory } from "../../categories/registry";
import styles from "./CardList.module.css";

interface CardListProps {
  cards: Card[];
  onOpen: (card: Card) => void;
}

/**
 * Liste de fiches. Deux présentations, selon la catégorie :
 * « definition » (le mot, puis sa définition) ou « timeline » (la date en
 * tête, dans la couleur de la catégorie, puis l'événement), comme une frise.
 */
export function CardList({ cards, onOpen }: CardListProps) {
  return (
    <ul className={styles.list}>
      {cards.map((card) => {
        const category = findCategory(card.item.kind);
        if (!category) return null;
        const title = category.title(card.item.content);
        const subtitle = category.subtitle(card.item.content);
        return (
          <li key={card.item.id}>
            <button type="button" className={styles.item} onClick={() => onOpen(card)}>
              {category.listStyle === "timeline" ? (
                <>
                  <p className={styles.date} style={{ color: category.color }}>
                    {subtitle}
                  </p>
                  <p className={styles.term}>{title}</p>
                </>
              ) : (
                <>
                  <p className={styles.term}>{title}</p>
                  <p className={styles.definition}>{subtitle}</p>
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
