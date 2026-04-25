# CLAUDE.md — Contexte app mobile InfraSScanField

## Aperçu

Application mobile React Native (Android prioritaire, iOS Phase 3) qui se connecte à une instance Dolibarr disposant du module **InfraSScanField** activé. Permet aux techniciens et utilisateurs de scanner des documents papier et de les rattacher automatiquement aux objets Dolibarr (factures, devis, interventions, projets, contrats).

## Informations app

- Éditeur : InfraS - Sylvain Legrand
- Licence : GPL v3+
- Plateformes : Android (priorité Phase 1), iOS (Phase 3)
- Compatibilité : Android 8.0+ (API 26+), iOS 14+
- Repo associé (module Dolibarr) : `../infrascanfield-dolibarr-module/`

## Stack technique

| Catégorie | Choix |
|-----------|-------|
| Framework | React Native + Expo SDK |
| Langage | TypeScript strict (`"strict": true`) |
| Routing | Expo Router (file-based) |
| État global | Zustand |
| Données serveur | TanStack Query (React Query v5) |
| HTTP | axios (avec intercepteurs) |
| Stockage rapide | MMKV (`react-native-mmkv`) |
| Stockage sécurisé | `expo-secure-store` (Android Keystore) |
| Base offline | SQLite (`expo-sqlite`) — Phase 2 |
| Caméra | `react-native-vision-camera` |
| Document scanner | `vision-camera-document-scanner` ou `react-native-document-scanner-plugin` (à choisir) |
| PDF | `pdf-lib` |
| Styling | NativeWind (Tailwind CSS) — light + dark mode |
| i18n | i18next + react-i18next (FR/EN) |
| Icônes | lucide-react-native |
| Réseau | `@react-native-community/netinfo` |
| Tests | Jest + React Native Testing Library |
| Build/Deploy | EAS Build + EAS Submit |

## Design

- Charte minimaliste **noir et blanc** avec mode clair et sombre
- Pas de couleurs d'accent franches sauf badges de statut métier (rouge erreur, etc.)
- Optimisé pour usage rapide sur le terrain (lisibilité + accessibilité immédiates)
- Boutons larges (zones de tap > 44 px)
- Fonts système par défaut, pas de webfonts custom

## Architecture du code

```text
infrascanfield-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/
│   │   ├── setup.tsx             # Écran 1 : config URL Dolibarr
│   │   └── login.tsx             # Écran 2 : login/password user
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Dashboard
│   │   ├── interventions.tsx     # Liste interventions assignées
│   │   ├── invoices.tsx          # Liste factures (Phase 1.5)
│   │   └── settings.tsx          # Paramètres
│   ├── object/[type]/[id].tsx    # Détail objet générique
│   ├── scanner/
│   │   ├── capture.tsx           # Caméra + détection bords
│   │   ├── review.tsx            # Post-traitement (recadrage, rotation, filtres)
│   │   └── validate.tsx          # Aperçu PDF + envoi
│   ├── sync-queue.tsx            # File de synchro (Phase 2)
│   └── _layout.tsx               # Root layout
│
├── src/
│   ├── api/
│   │   ├── client.ts             # Instance axios + intercepteurs (X-IFS-Token, retry)
│   │   ├── auth.ts               # Endpoints auth/login, auth/me, auth/logout
│   │   └── endpoints/            # Un fichier par domaine
│   │       ├── dashboard.ts
│   │       ├── interventions.ts
│   │       ├── invoices.ts
│   │       └── documents.ts
│   ├── types/
│   │   ├── dolibarr.ts           # Types objets Dolibarr (Facture, Fichinter, etc.)
│   │   └── api.ts                # Types réponses API du module
│   ├── stores/                   # Zustand
│   │   ├── authStore.ts          # X-IFS-Token, user, permissions
│   │   ├── instanceStore.ts      # URL Dolibarr courante (+ multi-instance Phase 3)
│   │   └── settingsStore.ts      # Préférences scan (DPI, format, compression)
│   ├── hooks/
│   │   ├── useNetworkStatus.ts
│   │   ├── usePermissions.ts     # Permissions Android (caméra, géoloc, stockage)
│   │   └── useSyncQueue.ts       # Phase 2
│   ├── features/
│   │   ├── scanner/              # Cœur de l'app
│   │   │   ├── DocumentScanner.tsx
│   │   │   ├── EdgeDetectionOverlay.tsx
│   │   │   ├── PageReview.tsx
│   │   │   ├── filters.ts        # Filtres image (N&B, contraste)
│   │   │   └── pdf.ts            # Génération PDF multi-pages
│   │   ├── sync/                 # Phase 2
│   │   │   ├── queue.ts
│   │   │   ├── worker.ts
│   │   │   └── conflict.ts
│   │   └── equipment-photo/      # Phase 2
│   ├── components/               # UI réutilisable
│   │   ├── ObjectCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ScanFAB.tsx
│   │   └── ...
│   ├── db/                       # Phase 2
│   │   ├── schema.ts
│   │   └── migrations/
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── fr.json
│   │   └── en.json
│   └── utils/
│       ├── secureStorage.ts      # Wrapper expo-secure-store
│       ├── format.ts             # Formatage dates, montants
│       └── logger.ts             # Logger custom (jamais console.log en prod)
│
├── assets/
├── app.json                      # Config Expo
├── eas.json                      # Config EAS Build
├── tailwind.config.js            # NativeWind theme N&B + dark mode
├── tsconfig.json                 # TS strict + alias @/
├── package.json
├── README.md
└── CLAUDE.md
```

## Authentification (X-IFS-Token)

- L'app **ne stocke jamais** un DOLAPIKEY admin — uniquement le X-IFS-Token reçu après `POST /auth/login`
- Stockage : `expo-secure-store` (Android Keystore — chiffré au niveau OS)
- Intercepteur axios `request` : ajoute `X-IFS-Token: {token}` à toute requête sauf `/auth/login`
- Intercepteur axios `response` : sur `401` → tente refresh, sinon déconnecte
- Le X-IFS-Token a une durée de vie de 30 jours par défaut (configurable côté module via `INFRASSCANFIELD_TOKEN_LIFETIME_DAYS`)

## Conventions de code

- TypeScript **strict** (jamais `any` sauf cas justifié et commenté)
- Imports absolus avec alias `@/` pointant vers `src/`
- Composants en PascalCase, hooks en camelCase préfixés `use`
- Tous les appels API typés avec interfaces dédiées
- Gestion d'erreur explicite (pas de try/catch silencieux)
- Logs via le logger custom (`src/utils/logger.ts`), jamais `console.log` en prod
- Pas de classe React (composants fonctionnels uniquement)
- Memoization explicite (`useMemo`, `useCallback`) seulement quand mesurée nécessaire
- Pas de dépendance non utilisée dans `package.json`

## Workflow dev

```bash
# Installation
npm install

# Lancement Android (émulateur ou device USB)
npx expo start
# Puis 'a' pour ouvrir sur Android

# Build de test (APK signé)
eas build --profile preview --platform android

# Build production (AAB pour Play Store)
eas build --profile production --platform android

# Tests
npm test

# Lint
npm run lint
```

## Profils EAS Build

- `development` : APK avec dev client (HMR)
- `preview` : APK signé, pour test interne (TestFlight équivalent Android = internal testing track)
- `production` : AAB pour Play Store

## Permissions Android requises

- `CAMERA` — scanner et photos équipement
- `ACCESS_FINE_LOCATION` — géoloc photos équipement
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` — sauvegarde temporaire des PDFs
- `INTERNET` + `ACCESS_NETWORK_STATE`

## Points d'attention

- Toujours tester sur un device physique avant release (l'émulateur ne reproduit pas la qualité de la caméra)
- La détection de bords temps réel est gourmande en CPU — vérifier sur des appareils bas de gamme (Android 8.0)
- Les images base64 envoyées doivent être compressées avant encodage (JPEG 80 % max)
- Le upload base64 ajoute ~33 % de payload — surveiller la taille des PDFs (cible < 500 Ko/page N&B, < 1.5 Mo/page couleur)
- Sur les écrans à pli (Galaxy Z Fold etc.), tester l'orientation et le pliage

## Phase actuelle

**Phase 1** — fondations :
- Setup projet Expo + TS + ESLint + NativeWind
- Onboarding (setup + login)
- Dashboard
- Liste interventions assignées
- Détail intervention
- Scanner + génération PDF + upload (sans offline)
- Build Android testable

**Phases ultérieures** (cf. `../PROMPT_CLAUDE_CODE_InfraSScanField.md` à la racine du workspace) :
- Phase 2 : couverture complète (devis, projets, contrats), photos équipement, mode offline
- Phase 3 : notifs push, multi-instance, iOS, polish, traductions
- Phase 4 : backoffice licensing
