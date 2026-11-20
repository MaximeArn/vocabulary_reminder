/**
 * Contour aux couleurs des catégories, de gauche à droite dans l'ordre du sélecteur :
 * une part par couleur, séparées par de courtes transitions (une seule couleur : contour uni).
 * À poser en `background` d'un élément à bordure transparente ; `inside` est son fond.
 */
export function categoryBorder(colors: string[], inside: string): string {
  const step = 100 / colors.length;
  const stops = colors.flatMap((color, index) => [
    `${color} ${index === 0 ? 0 : index * step + 4}%`,
    `${color} ${index === colors.length - 1 ? 100 : (index + 1) * step - 4}%`,
  ]);
  return `linear-gradient(${inside}, ${inside}) padding-box, linear-gradient(90deg, ${stops.join(", ")}) border-box`;
}
