# Ma Caisse Desktop - Version Offline

Application de gestion de caisse **100% offline** avec systeme de licence cryptographique.

## Pre-requis

- Node.js 18+ (LTS recommande)
- Windows 10/11 (pour le build .exe)
- Git (optionnel)

## Installation

```bash
cd desktop
npm install
```

## Premiere utilisation - Generer les cles de licence

```bash
cd tools
node generate-license.mjs init
```

Cela cree un dossier `tools/keys/` contenant :
- `private.pem` : votre cle privee (NE JAMAIS la partager)
- `public.pem` : la cle publique (a integrer dans l'app)

### Integrer la cle publique dans l'app

Ouvrez `electron/license.ts` et remplacez le placeholder `REPLACE_WITH_YOUR_PUBLIC_KEY` par le contenu de `tools/keys/public.pem` (sans les lignes BEGIN/END).

## Generer une licence pour un client

1. Le client lance l'app et voit son **ID Machine** (code de 16 caracteres)
2. Vous generez la licence :

```bash
node tools/generate-license.mjs --machine-id "ABC123DEF456" --client "Boutique Alou" --expiry "2027-12-31"
```

Ou pour une licence perpetuelle :

```bash
node tools/generate-license.mjs --machine-id "ABC123DEF456" --client "Boutique Alou" --perpetual
```

3. Vous donnez la cle generee au client (par USB, message, etc.)
4. Le client colle la cle dans l'ecran d'activation

## Build de l'application

### Build Windows (.exe installeur)

```bash
npm run build-exe
```

Le fichier `.exe` sera dans le dossier `release/`.

### Build Linux (AppImage)

```bash
npm run build-linux
```

### Build macOS (DMG)

```bash
npm run build-mac
```

## Developpement

```bash
npm run dev
```

## Structure du projet

```
desktop/
├── electron/           # Process principal Electron
│   ├── main.ts        # Point d'entree, gestion IPC
│   ├── preload.ts     # Bridge securise vers le renderer
│   ├── database.ts    # Couche SQLite (toutes les operations CRUD)
│   └── license.ts     # Validation de licence cryptographique
├── src/               # Interface React (renderer process)
│   ├── App.tsx        # App principale avec flow licence -> login -> app
│   ├── hooks/         # Hooks React adaptés pour IPC Electron
│   ├── components/    # Composants UI
│   └── pages/         # Pages de l'application
├── tools/             # Outils admin
│   └── generate-license.mjs  # Generateur de licences
└── package.json       # Config Electron + electron-builder
```

## Flux de l'application

1. **Verification licence** : Au demarrage, l'app verifie si une licence valide existe
2. **Activation** : Si pas de licence, l'ecran affiche l'ID machine et demande une cle
3. **Connexion PIN** : L'utilisateur entre son code PIN a 4 chiffres
4. **Application** : Acces aux fonctionnalites selon le role (admin/caissier)

## Securite de la licence

- La licence est signee avec RSA 2048-bit (SHA256)
- Elle est liee au hardware de la machine (UUID du BIOS Windows / machine-id Linux)
- Impossible de la copier sur un autre PC
- Date d'expiration optionnelle integree dans la licence
- La cle privee ne quitte JAMAIS votre machine admin

## Base de donnees

Les donnees sont stockees localement dans un fichier SQLite :
- Windows : `%APPDATA%/ma-caisse-desktop/macaisse.db`
- Linux : `~/.config/ma-caisse-desktop/macaisse.db`
- macOS : `~/Library/Application Support/ma-caisse-desktop/macaisse.db`

## Premiere configuration (apres installation chez le client)

1. Activer la licence
2. Creer un utilisateur admin dans Parametres > Utilisateurs (PIN: 0000 par defaut si aucun utilisateur)
3. Creer les caisses
4. Creer les comptes de charges
5. Configurer les infos societe

**Note** : Au premier lancement, si aucun profil n'existe, tout PIN de 4 chiffres sera accepte pour creer le premier admin. Ensuite, seuls les PIN enregistres fonctionneront.
