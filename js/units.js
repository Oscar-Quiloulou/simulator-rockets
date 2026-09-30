/**
 * Gestion des unités d'affichage. Le moteur physique travaille TOUJOURS en SI
 * (m, kg, N, s, m/s). Ce module gère la conversion affichage ↔ SI.
 * @module units
 */

const STORAGE_KEY = 'rocket-simulator:units';

/** @typedef {'length'|'mass'|'velocity'|'altitude'|'force'} Quantity */

/**
 * @typedef {Object} UnitDef
 * @property {string} label
 * @property {string} si
 * @property {Record<string, {factor: number, label: string}>} units
 *   factor = valeur_SI / valeur_affichée
 */

/** @type {Record<Quantity, UnitDef>} */
export const UNIT_DEFS = {
  length: {
    label: 'Longueur',
    si: 'm',
    units: {
      mm: { factor: 1000, label: 'mm' },
      cm: { factor: 100, label: 'cm' },
      m: { factor: 1, label: 'm' },
      in: { factor: 39.3701, label: 'in' },
      ft: { factor: 3.28084, label: 'ft' }
    }
  },
  mass: {
    label: 'Masse',
    si: 'kg',
    units: {
      g: { factor: 1000, label: 'g' },
      kg: { factor: 1, label: 'kg' },
      oz: { factor: 35.274, label: 'oz' },
      lb: { factor: 2.20462, label: 'lb' }
    }
  },
  velocity: {
    label: 'Vitesse',
    si: 'm/s',
    units: {
      'm/s': { factor: 1, label: 'm/s' },
      'km/h': { factor: 3.6, label: 'km/h' },
      mph: { factor: 2.23694, label: 'mph' },
      kt: { factor: 1.94384, label: 'kt' }
    }
  },
  altitude: {
    label: 'Altitude',
    si: 'm',
    units: {
      m: { factor: 1, label: 'm' },
      km: { factor: 0.001, label: 'km' },
      ft: { factor: 3.28084, label: 'ft' },
      mi: { factor: 0.000621371, label: 'mi' }
    }
  },
  force: {
    label: 'Force',
    si: 'N',
    units: {
      N: { factor: 1, label: 'N' },
      kgf: { factor: 0.101972, label: 'kgf' },
      lbf: { factor: 0.224809, label: 'lbf' }
    }
  }
};

/** @type {Record<Quantity, string>} */
export const DEFAULT_UNITS = {
  length: 'mm',
  mass: 'g',
  velocity: 'm/s',
  altitude: 'm',
  force: 'N'
};

/**
 * Lit les préférences d'unités depuis localStorage, en filtrant les valeurs invalides.
 * @returns {Record<Quantity, string>}
 */
export function getUnits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_UNITS };
    const parsed = JSON.parse(raw);
    /** @type {Record<Quantity, string>} */
    const out = { ...DEFAULT_UNITS };
    for (const key of Object.keys(DEFAULT_UNITS)) {
      if (typeof parsed[key] === 'string' && UNIT_DEFS[key].units[parsed[key]]) {
        out[key] = parsed[key];
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_UNITS };
  }
}

/**
 * Enregistre les préférences d'unités (fusion avec l'existant).
 * @param {Partial<Record<Quantity, string>>} units
 */
export function setUnits(units) {
  const merged = { ...getUnits(), ...units };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

/**
 * Réinitialise aux unités par défaut.
 */
export function resetUnits() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Convertit une valeur SI vers l'unité d'affichage choisie.
 * @param {number} valueSi
 * @param {Quantity} quantity
 * @param {Record<Quantity, string>} [units]
 * @returns {number}
 */
export function toDisplay(valueSi, quantity, units = getUnits()) {
  const factor = UNIT_DEFS[quantity].units[units[quantity]]?.factor ?? 1;
  return valueSi * factor;
}

/**
 * Convertit une valeur affichée vers le SI.
 * @param {number} valueDisplay
 * @param {Quantity} quantity
 * @param {Record<Quantity, string>} [units]
 * @returns {number}
 */
export function fromDisplay(valueDisplay, quantity, units = getUnits()) {
  const factor = UNIT_DEFS[quantity].units[units[quantity]]?.factor ?? 1;
  return valueDisplay / factor;
}

/**
 * Symbole de l'unité affichée pour une grandeur.
 * @param {Quantity} quantity
 * @param {Record<Quantity, string>} [units]
 * @returns {string}
 */
export function unitLabel(quantity, units = getUnits()) {
  return units[quantity];
}

/**
 * Met à jour tous les éléments portant l'attribut data-unit-for="<quantity>".
 * @param {ParentNode} [root=document]
 */
export function refreshUnitLabels(root = document) {
  const units = getUnits();
  root.querySelectorAll('[data-unit-for]').forEach((el) => {
    const q = el.getAttribute('data-unit-for');
    if (q && UNIT_DEFS[q]) el.textContent = `(${unitLabel(q, units)})`;
  });
}

/**
 * Applique un preset d'unités complet.
 * @param {'metric'|'imperial'} system
 */
export function applyPreset(system) {
  if (system === 'imperial') {
    setUnits({ length: 'in', mass: 'oz', velocity: 'mph', altitude: 'ft', force: 'lbf' });
  } else {
    setUnits({ ...DEFAULT_UNITS });
  }
}