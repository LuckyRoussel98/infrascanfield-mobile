# InfraSScanField — App Mobile

Application mobile React Native (Android prioritaire, iOS Phase 3) qui se connecte à une instance Dolibarr et permet aux techniciens et utilisateurs de scanner des documents papier et de les rattacher automatiquement aux objets Dolibarr (factures, devis, interventions, projets, contrats).

## Informations app

| Propriété | Valeur |
|-----------|--------|
| Nom | InfraSScanField |
| Plateformes | Android (priorité Phase 1), iOS (Phase 3) |
| Framework | React Native + Expo (EAS Build) |
| Langage | TypeScript strict |
| Éditeur | InfraS - Sylvain Legrand |
| Licence | GPL v3+ |

## Stack technique

- **Framework** : React Native + Expo SDK
- **État global** : Zustand
- **Données serveur** : TanStack Query (React Query v5)
- **Stockage rapide** : MMKV (`react-native-mmkv`)
- **Stockage sécurisé** : `expo-secure-store` (Android Keystore)
- **Base offline** : SQLite (`expo-sqlite`)
- **HTTP** : axios
- **Caméra/Scan** : `react-native-vision-camera` + lib document scanner
- **PDF** : `pdf-lib`
- **Navigation** : Expo Router (file-based)
- **Styling** : NativeWind (Tailwind CSS)
- **i18n** : i18next + react-i18next
- **Icônes** : lucide-react-native

## Design

- Charte minimaliste **noir et blanc** avec mode clair et sombre
- Optimisé pour usage rapide sur le terrain (lisibilité + accessibilité immédiates)

## Pré-requis dev

- Node.js 20 LTS+
- pnpm ou npm
- Android Studio (émulateur)
- Compte Expo + EAS CLI installé (`npm i -g eas-cli`)
- Une instance Dolibarr accessible avec le module **InfraSScanField** activé (voir [repo module](../infrascanfield-dolibarr-module))

## Lancer l'app en dev

```bash
npm install
npx expo start
# Lancer sur Android : appuyer sur 'a' (émulateur ouvert au préalable)
```

## Build Android (EAS)

```bash
eas build --profile preview --platform android   # APK signé pour test
eas build --profile production --platform android # AAB pour Play Store
```

## Architecture

```
app/                          # Expo Router (file-based routing)
├── (auth)/                   # Setup + Login
├── (tabs)/                   # Dashboard + listes
├── object/[type]/[id].tsx    # Détail d'objet
└── scanner/                  # Capture / Review / Validate

src/
├── api/         # Client axios + endpoints typés
├── types/       # Types Dolibarr + types réponses API
├── stores/      # Zustand (auth, instance, settings)
├── hooks/       # Hooks custom (network, permissions, sync)
├── features/    # Logique métier (scanner, sync, equipment-photo)
├── components/  # UI réutilisable
├── db/          # SQLite (queue offline, cache)
├── i18n/        # Traductions FR / EN
└── utils/       # Helpers (secureStorage, format, logger)
```

## Documentation interne

- [CLAUDE.md](CLAUDE.md) — contexte technique structuré pour assistants IA

## Licence

GPL v3+ — voir [LICENSE](LICENSE).
