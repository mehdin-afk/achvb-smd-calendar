# ACHVB SMD Calendar

Interface web de consultation d'une compétition FFVB avec :
- classement
- calendrier / résultats
- filtres par équipe
- navigation hebdomadaire

Le projet est composé d'un frontend statique (`index.html`, `styles.css`, `script.js`) et d'un petit serveur Python (`server.py`) qui :
- sert les fichiers statiques
- expose l'API locale `/api/ffvb-live`
- récupère et transforme les données FFVB à la volée

## Stack

- HTML
- CSS
- JavaScript vanilla
- Python standard library

## Lancer en local

Depuis le dossier du projet :

```bash
python3 server.py
```

Le site sera disponible sur :

```txt
http://127.0.0.1:8000
```

## Variables d'environnement

Le serveur supporte :

- `HOST`
- `PORT`

Par défaut :
- `HOST=0.0.0.0`
- `PORT=8000`

## Déploiement Render

Le projet est configuré pour Render via [render.yaml](./render.yaml).

Configuration utilisée :
- type : `web`
- runtime : `python`
- build command : `pip install -r requirements.txt`
- start command : `python server.py`

## Déploiement GitHub + Render

### 1. Initialiser Git

```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. Connecter le repo GitHub

```bash
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

### 3. Déployer sur Render

Sur Render :
1. `New`
2. `Blueprint` ou `Web Service`
3. connecter le repo GitHub
4. laisser Render utiliser `render.yaml`

Chaque push sur `main` déclenche ensuite un nouveau déploiement.

## Structure du projet

```txt
.
├── index.html
├── styles.css
├── script.js
├── server.py
├── render.yaml
├── requirements.txt
└── README.md
```

## API locale

### `GET /api/ffvb-live`

Retourne un JSON contenant :
- le titre de la compétition
- la date de synchronisation
- le classement
- les matchs par journée

## Notes

- Les données ne sont pas stockées localement : elles sont récupérées à chaque appel.
- Si la source FFVB change de structure HTML, le parsing dans `server.py` devra être ajusté.
- Le projet est optimisé pour une interface légère sans framework frontend.

## Workflow de mise à jour

```bash
git add .
git commit -m "Description du changement"
git push
```

Render redéploiera automatiquement après le push.
