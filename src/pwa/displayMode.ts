/** Détection du contexte d'exécution (app installée ou onglet Safari). */

/** Vrai si l'app est lancée depuis l’écran d’accueil (mode standalone). */
export function isStandalone(): boolean {
  // `navigator.standalone` est propre à Safari iOS ; la media query couvre les autres navigateurs.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

/** Vrai sur iPhone / iPad (y compris iPadOS qui se présente comme un Mac). */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  const isIPadOS = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || isIPadOS;
}
