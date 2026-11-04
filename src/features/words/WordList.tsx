import type { Word } from "../../domain/types";
import styles from "./WordList.module.css";

interface WordListProps {
  words: Word[];
  onOpen: (word: Word) => void;
}

export function WordList({ words, onOpen }: WordListProps) {
  return (
    <ul className={styles.list}>
      {words.map((word) => (
        <li key={word.id}>
          <button type="button" className={styles.item} onClick={() => onOpen(word)}>
            <p className={styles.term}>{word.term}</p>
            <p className={styles.definition}>{word.definition}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
