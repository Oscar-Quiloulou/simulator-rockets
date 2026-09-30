/**
 * Bibliothèque de matériaux : densités usuelles pour la construction amateur.
 * Les densités sont exprimées en kg/m³.
 * @module materials
 */

/**
 * @typedef {Object} Material
 * @property {string} name    Libellé affiché
 * @property {number} density Densité (kg/m³)
 * @property {string} note    Commentaire d'usage
 */

/** @type {Record<string, Material>} */
export const MATERIALS = {
  pvc: {
    name: 'PVC (tube pression)',
    density: 1400,
    note: 'Bon marché, facile à coller, devient cassant au froid.'
  },
  alu6061: {
    name: 'Aluminium 6061-T6',
    density: 2700,
    note: 'Excellent rapport masse/résistance, usinage requis.'
  },
  acier: {
    name: 'Acier S235',
    density: 7850,
    note: 'Très résistant mais lourd — réservé aux bancs de test.'
  },
  pla: {
    name: 'PLA (impression 3D)',
    density: 1240,
    note: 'Faible tenue en température (> 60 °C il se ramollit).'
  },
  petg: {
    name: 'PETG (impression 3D)',
    density: 1270,
    note: 'Plus résilient que le PLA, bonne tenue à l’humidité.'
  },
  abs: {
    name: 'ABS (impression 3D)',
    density: 1040,
    note: 'Résiste aux chocs, sensible aux solvants.'
  },
  epoxy: {
    name: 'Époxy (résine coulée)',
    density: 1150,
    note: 'Utilisé pour le collage structural et la stratification.'
  },
  carton: {
    name: 'Carton (tube spiralé)',
    density: 700,
    note: 'Adapté aux moteurs commerciaux basse puissance.'
  },
  balsa: {
    name: 'Balsa',
    density: 160,
    note: 'Très léger, réservé aux ailerettes de maquette.'
  },
  carbone: {
    name: 'Fibre de carbone (composite)',
    density: 1600,
    note: 'Rigidité exceptionnelle, prix élevé, usinage délicat.'
  },
  kno3: {
    name: 'Nitrate de potassium (KNO3)',
    density: 2100,
    note: 'Comburant — densité du cristal pur.'
  },
  sorbitol: {
    name: 'Sorbitol',
    density: 1490,
    note: 'Carburant — densité du solide.'
  }
};

/**
 * Récupère un matériau par sa clé, avec repli sur le PVC.
 * @param {string} key
 * @returns {Material}
 */
export function getMaterial(key) {
  return MATERIALS[key] ?? MATERIALS.pvc;
}

/**
 * Remplit un élément `<select>` avec la liste des matériaux.
 * @param {HTMLSelectElement} select
 * @param {string} [selected]
 */
export function fillMaterialSelect(select, selected = 'pvc') {
  select.textContent = '';
  for (const [key, material] of Object.entries(MATERIALS)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${material.name} — ${material.density} kg/m³`;
    option.selected = key === selected;
    select.appendChild(option);
  }
}