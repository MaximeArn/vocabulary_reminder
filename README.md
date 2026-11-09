# Mnémé

Carnet de mémorisation personnel (vocabulaire, dates historiques…) : une PWA installable sur iPhone,
hors ligne, sans compte ni serveur, avec un moteur de répétition espacée commun à toutes les catégories.

## Commandes

| Commande            | Rôle                                                        |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Serveur de développement (exposé sur le réseau local)       |
| `npm run build`     | Vérification des types + build de production dans `dist/`   |
| `npm run preview`   | Sert le build de production (service worker actif)          |
| `npm test`          | Tests unitaires (Vitest) de la logique métier               |
| `npm run check:ios` | Parcours de bout en bout dans Safari iOS : mots, révision, dates, exercices, synchronisation |
| `npm run icons`     | Régénère les icônes depuis l'illustration (`scripts/icons/source/`, non versionnée) |

Le service worker n'est actif qu'avec `build` + `preview` (pas en `dev`).

## Organisation

```
src/
  domain/      Moteur de mémorisation, TypeScript pur et testé : fiches, historique,
               répétition espacée (Leitner, progression rejouée depuis l'historique),
               sessions, statistiques, sauvegardes
  categories/  Une catégorie de connaissances par dossier (vocabulary/, historical-event/) :
               model.ts (logique, exercices) + views.tsx (formulaire, fiche, explication)
  data/        Accès à IndexedDB via Dexie (schéma versionné, migrations, dépôts)
  features/    Un dossier par écran : today, collection, review, progress, settings
  ui/          Composants d'interface réutilisables
  pwa/         Service worker, installation, stockage persistant
  styles/      Tokens de design (couleurs, typo, espacements) et styles de base
  app/         Assemblage : navigation, démarrage, gestion des erreurs
```

Principes :
- Le moteur ne connaît que des **fiches** (`Item` : catégorie + contenu) et un **historique**
  de réponses en ajout seul. La progression de chaque fiche est recalculée en rejouant
  son historique : rien à synchroniser ni à migrer de ce côté.
- Les suppressions sont « douces » (`deletedAt`) : annulables, et synchronisables plus tard.
- Dates historiques : jamais de `Date` JavaScript. Années « historiennes » (-480 = 480 av. J.-C.,
  pas d'an 0), précision (jour → siècle), « vers », périodes ; calculs via la numérotation
  astronomique (`categories/historical-event/dates.ts`).

Ajouter une catégorie :
1. Créer `src/categories/<nom>/` avec `model.ts` (contrat `CategoryModel` : validation,
   titre, recherche, exercices, formulaire) et `views.tsx` (`Fields`, `Detail`, `Explanation`).
2. L'inscrire dans `src/categories/models.ts` et `src/categories/registry.ts`.
Aucune migration de base n'est nécessaire.

Conventions :
- Un composant par fichier, avec son `*.module.css` à côté.
- Les couleurs et tailles passent toujours par les variables de `styles/tokens.css`.
- Schéma de base : ne jamais modifier une version existante dans `data/db.ts`, en ajouter une nouvelle.

## Tester sur iOS

- Simulateur, à la main : `npm run build && npm run preview`, puis
  `xcrun simctl openurl booted http://localhost:4173/`.
- Simulateur, automatisé : avec un iPhone démarré (`IOS_DEVICE_UDID` pour en choisir un), `safaridriver -p 4444` et
  `npm run preview` lancés, `npm run check:ios` pilote le vrai Safari iOS via
  WebDriver (voir `scripts/ios/`). Limite connue du simulateur iOS 26.5 : le tap et
  la saisie natifs de safaridriver ne fonctionnent pas, ils sont simulés en
  JavaScript ; les gestes tactiles eux-mêmes se valident sur l'iPhone. Attention : le port
  4190 est interdit par la spécification Fetch, Safari refuse de le charger.
- iPhone : utiliser l'URL publiée (HTTPS obligatoire pour le service worker).
  Débogage depuis le Mac : Safari > Développement > [iPhone] (activer « Inspecteur web »
  dans Réglages > Apps > Safari > Avancé sur l'iPhone).
- Réglages > Diagnostic, dans l'app, affiche l'état du service worker, du stockage et de la base.
