import type { Card } from "../../domain/card";
import { findCategory } from "../../categories/registry";
import styles from "./CardList.module.css";

interface CardListProps {
  cards: Card[];
  onOpen: (card: Card) => void;
}

export function CardList({ cards, onOpen }: CardListProps) {
  return (
    <ul className={styles.list}>
      {cards.map((card) => {
        const category = findCategory(card.item.kind);
        if (!category) return null;
        return (
          <li key={card.item.id}>
            <button type="button" className={styles.item} onClick={() => onOpen(card)}>
              <p className={styles.term}>{category.title(card.item.content)}</p>
              <p className={styles.definition}>{category.subtitle(card.item.content)}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
