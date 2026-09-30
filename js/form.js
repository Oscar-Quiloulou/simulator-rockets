/**
 * Lecture, validation et remplissage du formulaire de configuration.
 * Les champs dont le nom figure dans QUANTITIES sont convertis
 * entre l'unité d'affichage et le SI.
 * @module form
 */

import { getUnits, fromDisplay, toDisplay } from './units.js';

/** Champs numériques du formulaire. */
export const NUMERIC_FIELDS = [
  'dryMass', 'propellantMass', 'diameter', 'cd', 'thrust', 'burnTime', 'isp'
];

/** Grandeur physique associée à chaque champ (absent = sans dimension). */
const QUANTITIES = {
  dryMass: 'mass',
  propellantMass: 'mass',
  diameter: 'length',
  thrust: 'force'
};

const LABELS = {
  dryMass: 'Masse à vide',
  propellantMass: 'Masse de propergol',
  diameter: 'Diamètre',
  cd: 'Coefficient de traînée',
  thrust: 'Poussée',
  burnTime: 'Durée de combustion',
  isp: 'Impulsion spécifique'
};

/**
 * @param {number} value
 * @param {number} digits
 * @returns {number}
 */
function round(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

/**
 * Lit et valide le formulaire. Retourne une configuration en SI.
 * @param {HTMLFormElement} form
 * @returns {{ config: import('./physics.js').RocketConfig, errors: string[] }}
 */
export function readForm(form) {
  const data = new FormData(form);
  const units = getUnits();
  /** @type {string[]} */
  const errors = [];
  /** @type {Record<string, number>} */
  const raw = {};

  for (const key of NUMERIC_FIELDS) {
    const displayValue = Number.parseFloat(String(data.get(key) ?? ''));
    if (!Number.isFinite(displayValue)) {
      errors.push(`« ${LABELS[key]} » : valeur numérique invalide.`);
      raw[key] = 0;
      continue;
    }
    if (displayValue < 0) {
      errors.push(`« ${LABELS[key]} » : la valeur doit être positive.`);
      raw[key] = 0;
      continue;
    }
    const q = QUANTITIES[key];
    raw[key] = q ? fromDisplay(displayValue, q, units) : displayValue;
  }

  if (raw.dryMass <= 0) errors.push('La masse à vide doit être strictement positive.');
  if (raw.diameter <= 0) errors.push('Le diamètre doit être strictement positif.');
  if (raw.isp <= 0) errors.push("L'impulsion spécifique doit être strictement positive.");

  const name = String(data.get('name') ?? '').trim() || 'Fusée sans nom';

  return {
    config: {
      name,
      dryMass: raw.dryMass,
      propellantMass: raw.propellantMass,
      diameter: raw.diameter,
      cd: raw.cd,
      thrust: raw.thrust,
      burnTime: raw.burnTime,
      isp: raw.isp
    },
    errors
  };
}

/**
 * Remplit le formulaire depuis une configuration SI.
 * @param {HTMLFormElement} form
 * @param {Partial<import('./physics.js').RocketConfig>} config
 */
export function fillForm(form, config) {
  const units = getUnits();

  /** @param {string} name @param {string|number} value */
  const set = (name, value) => {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement) field.value = String(value);
  };

  /** @param {string} name @param {number} valueSi @param {string} quantity */
  const setQ = (name, valueSi, quantity) => {
    set(name, round(toDisplay(valueSi, quantity, units), 4));
  };

  set('name', config.name ?? '');
  setQ('dryMass', config.dryMass ?? 0, 'mass');
  setQ('propellantMass', config.propellantMass ?? 0, 'mass');
  setQ('diameter', config.diameter ?? 0.05, 'length');
  set('cd', round(config.cd ?? 0.5, 2));
  setQ('thrust', config.thrust ?? 0, 'force');
  set('burnTime', round(config.burnTime ?? 0, 2));
  set('isp', round(config.isp ?? 100, 1));
}