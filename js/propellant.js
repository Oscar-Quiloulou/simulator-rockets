/**
 * Calculateur de répartition massique de mélanges pour fusée.
 * Le module ne fournit AUCUNE étape de fabrication, AUCUNE température,
 * AUCUN protocole : uniquement des rapports massiques publics.
 *
 * IMPORTANT : en France, la fabrication de propergols est illégale sans
 * autorisation préfectorale (Code de la défense, décret 2010-455).
 * Ce module est un outil de PRÉVENTION : il vise à éviter les erreurs de
 * dosage qui sont la première cause d'accidents graves.
 *
 * @module propellant
 */

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} label
 * @property {string} code Nom technique usuel
 * @property {string} note Contexte d'usage documenté publiquement
 * @property {{name:string, ratio:number}[]} components Somme des ratio = 1
 */

/** @type {Recipe[]} */
export const RECIPES = [
  {
    id: 'knsb',
    label: 'Nitrate de potassium + sorbitol',
    code: 'KNSB',
    note: 'Mélange sucré le plus courant dans la littérature amateur. Ratio massique public : 65 / 35.',
    components: [
      { name: 'Nitrate de potassium (KNO3)', ratio: 0.65 },
      { name: 'Sorbitol', ratio: 0.35 }
    ]
  },
  {
    id: 'knsu',
    label: 'Nitrate de potassium + saccharose',
    code: 'KNSU',
    note: 'Variante au sucre blanc de cuisine. Ratio massique public : 65 / 35.',
    components: [
      { name: 'Nitrate de potassium (KNO3)', ratio: 0.65 },
      { name: 'Saccharose (sucre blanc)', ratio: 0.35 }
    ]
  },
  {
    id: 'kndx',
    label: 'Nitrate de potassium + dextrose',
    code: 'KNDX',
    note: 'Variante au glucose. Ratio massique public : 65 / 35.',
    components: [
      { name: 'Nitrate de potassium (KNO3)', ratio: 0.65 },
      { name: 'Dextrose (glucose)', ratio: 0.35 }
    ]
  }
];

/**
 * Récupère une recette par identifiant.
 * @param {string} id
 * @returns {Recipe | undefined}
 */
export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id);
}

/**
 * Calcule la répartition massique pour une masse totale donnée.
 * @param {Recipe} recipe
 * @param {number} totalMassG Masse totale désirée (g)
 * @returns {{name:string, mass:number, ratio:number}[]}
 */
export function computeBatch(recipe, totalMassG) {
  const mass = Number.isFinite(totalMassG) && totalMassG > 0 ? totalMassG : 0;
  return recipe.components.map((c) => ({
    name: c.name,
    ratio: c.ratio,
    mass: mass * c.ratio
  }));
}

/**
 * Estime l’impulsion totale disponible à partir d’une masse de propergol
 * et d’une Isp typique (Ns), pour dimensionner un moteur simple.
 * @param {number} massG
 * @param {number} isp
 * @returns {number} Impulsion (N·s)
 */
export function estimateImpulse(massG, isp) {
  const kg = Math.max(0, massG) / 1000;
  return kg * isp * 9.80665;
}

/**
 * Remplit un `<select>` avec les recettes.
 * @param {HTMLSelectElement} select
 * @param {string} [selected]
 */
export function fillRecipeSelect(select, selected = 'knsb') {
  select.textContent = '';
  for (const recipe of RECIPES) {
    const opt = document.createElement('option');
    opt.value = recipe.id;
    opt.textContent = `${recipe.code} — ${recipe.label}`;
    opt.selected = recipe.id === selected;
    select.appendChild(opt);
  }
}