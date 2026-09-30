# 🚀 Rocket Simulator

Simulateur de fusée artisanale **100 % front-end**, sans framework, sans build, sans npm.
HTML + CSS + JavaScript natif (modules ES), déployable tel quel sur Vercel via GitHub.

## Fonctionnalités

- **Simulateur 1D** — moteur physique Runge-Kutta 4 (traînée quadratique, atmosphère
  isotherme, pesanteur variable, consommation de propergol linéaire).
- **Graphiques SVG** générés dynamiquement (altitude, vitesse, accélération) avec curseur
  et infobulle.
- **Page Construction** — masse pièce par pièce, centre de gravité, centre de poussée
  (Barrowman simplifié), marge statique avec indicateur visuel vert / orange / rouge.
- **5 presets** — candy rocket 20 mm et 40 mm, fusée à eau, moteur Estes C6, fusée
  expérimentale 63 mm.
- **Bibliothèque de matériaux** (PVC, aluminium, PLA, PETG, ABS, époxy, carton, balsa,
  carbone, KNO3, sorbitol).
- **Aucune dépendance**, aucune requête réseau, aucune donnée envoyée nulle part.

## Lancer en local

### Option A — serveur statique (recommandé)

```bash
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

ou avec Node (sans rien installer) :

```bash
npx serve .
```

### Option B — double-clic sur `index.html`

⚠️ **Limitation navigateur :** les modules ES (`<script type="module">`) sont bloqués par
la politique CORS lorsque la page est ouverte via `file://` dans **Chrome** et
**Firefox** (`origin: null`). Safari accepte ce cas de figure.

Pour un fonctionnement garanti par double-clic, utilisez un serveur local (option A) ou
Safari. Le code lui-même ne dépend d'aucun serveur : c'est une contrainte de sécurité des
navigateurs, pas du projet.

## Structure

```
rocket-simulator/
├── index.html              # Simulateur
├── builder.html            # Construction (masse + CG + CP + stabilité)
├── about.html              # Équations, hypothèses, légal
├── css/
│   ├── reset.css
│   ├── style.css
│   └── components.css
├── js/
│   ├── main.js             # Point d'entrée du simulateur
│   ├── physics.js          # Moteur RK4
│   ├── materials.js        # Densités
│   ├── presets.js          # Fusées pré-remplies
│   ├── charts.js           # Rendu SVG
│   ├── form.js             # Formulaire + validation
│   ├── results.js          # Panneau de résultats
│   ├── builder.js          # Logique de la page Construction
│   └── ui.js               # Helpers DOM
├── assets/favicon.svg
├── vercel.json
└── .gitignore
```

## Déploiement

### 1. Pousser sur GitHub

```bash
git init
git add .
git commit -m "init: rocket-simulator"
gh repo create rocket-simulator --public --source=. --push
```

Sans `gh` :

```bash
git remote add origin https://github.com/<votre-compte>/rocket-simulator.git
git branch -M main
git push -u origin main
```

### 2. Déployer sur Vercel

1. Aller sur [vercel.com](https://vercel.com) → **New Project**
2. Importer le dépôt `rocket-simulator`
3. Framework Preset : **Other** — Build Command : *vide* — Output Directory : `.`
4. **Deploy**

Chaque `git push` sur `main` déclenche un redéploiement automatique.
Le fichier `vercel.json` active les URLs propres (`/about` au lieu de `/about.html`).

## Équations implémentées

| Grandeur | Formule |
|---|---|
| Mouvement | `m·a = T + D + W` |
| Traînée | `D = -0,5 · ρ(y) · v · \|v\| · Cd · A` |
| Atmosphère | `ρ(y) = ρ₀ · exp(-y / H)`, `ρ₀ = 1,225`, `H = 8500` |
| Pesanteur | `g(y) = g₀ · (R / (R + y))²`, `R = 6 371 000` |
| Débit massique | `ṁ = T / (Isp · g₀)` |
| Tsiolkovsky | `Δv = Isp · g₀ · ln(m₀ / m_f)` |

Intégration : **Runge-Kutta d'ordre 4**, pas de 10 ms.

## Limites

- Vol vertical uniquement (pas de vent, pas de dérive, pas de rotation).
- Poussée et Cd constants (pas de courbe `F(t)`, pas de pic transsonique).
- Atmosphère isotherme (valable jusqu'à ~11 km).
- Aucune séparation d'étage, aucun parachute.
- La marge statique de la page Construction repose sur un **Barrowman simplifié** :
  ordre de grandeur, pas une valeur certifiée.

## ⚠️ Avertissement

Ce simulateur est **pédagogique**. Il ne remplace ni une certification, ni un banc d'essai,
ni l'encadrement d'une fédération agréée. La fabrication et le tir de moteurs fusées
artisanaux sont réglementés et dangereux. En France, voir le Code de la défense et le
décret n° 2010-455 relatif aux produits explosifs.

## Licence

MIT — voir ci-dessous.

```
MIT License

Copyright (c) 2025 Rocket Simulator contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```