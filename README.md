# Lexique

Carnet de vocabulaire personnel : une PWA installable sur iPhone, hors ligne, sans compte ni serveur.

## Commandes

| Commande            | Rôle                                                        |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Serveur de développement (exposé sur le réseau local)       |
| `npm run build`     | Vérification des types + build de production dans `dist/`   |
| `npm run preview`   | Sert le build de production (service worker actif)          |
| `npm test`          | Tests unitaires (Vitest) de la logique métier               |
| `npm run icons`     | Régénère les icônes depuis `scripts/icons/icon.html`        |

Le service worker n'est actif qu'avec `build` + `preview` (pas en `dev`).

## Organisation

```
src/
  domain/    Logique métier pure (aucune dépendance à React ni à la base) — testée
  data/      Accès à IndexedDB via Dexie (schéma, migrations, dépôts)
  features/  Un dossier par écran : today, words, progress, settings
  ui/        Composants d'interface réutilisables
  pwa/       Service worker, installation, stockage persistant
  styles/    Tokens de design (couleurs, typo, espacements) et styles de base
  app/       Assemblage : navigation, démarrage, gestion des erreurs
```

Conventions :
- Un composant par fichier, avec son `*.module.css` à côté.
- Les couleurs et tailles passent toujours par les variables de `styles/tokens.css`.
- Schéma de base : ne jamais modifier une version existante dans `data/db.ts`, en ajouter une nouvelle.

## Tester sur iOS

- Simulateur : `npm run build && npm run preview`, puis
  `xcrun simctl openurl booted http://localhost:4173/`.
- iPhone : utiliser l'URL publiée (HTTPS obligatoire pour le service worker).
  Débogage depuis le Mac : Safari > Développement > [iPhone] (activer « Inspecteur web »
  dans Réglages > Apps > Safari > Avancé sur l'iPhone).
- Réglages > Diagnostic, dans l'app, affiche l'état du service worker, du stockage et de la base.
