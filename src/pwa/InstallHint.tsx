import { isIOS, isStandalone } from "./displayMode";
import styles from "./InstallHint.module.css";

/**
 * Safari iOS ne propose pas d'installation automatique :
 * on explique la marche à suivre quand l'app est ouverte dans un onglet.
 */
export function InstallHint() {
  if (isStandalone()) return null;

  return (
    <aside className={styles.hint}>
      <p className={styles.title}>Installe Lexique sur ton iPhone</p>
      {isIOS() ? (
        <p>
          Dans Safari, touche le bouton <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.
        </p>
      ) : (
        <p>Ouvre cette page dans Safari sur ton iPhone pour l’ajouter à l’écran d’accueil.</p>
      )}
      <p className={styles.warning}>
        Les mots saisis ici, dans le navigateur, ne seront pas visibles dans l’app installée : chacune a son propre
        stockage.
      </p>
    </aside>
  );
}
