/**
 * Lecture du formulaire Construction, calculs de structure et persistance.
 * Toutes les grandeurs manipulées ici sont en unités SI.
 * @module structure
 */

import { MATERIALS } from './materials.js';
import { getUnits, toDisplay, fromDisplay } from './units.js';

const STORAGE_STATE = 'rocket-simulator:builder-state';

const NOSE_VOLUME = { cone: 1 / 3, ogive: 0.45 };
const NOSE_CG = { cone: 0.25, ogive: 0.33 };
const NOSE_CP = { cone: 0.333, ogive: 0.5 };
const FIN_AREA = { triangulaire: 0.5, trapezoidale: 0.65, rectangulaire: 1 };

/** État par défaut en SI. */
export const DEFAULT_STATE = {
  body: { material: 'pvc', length: 0.6, diameter: 0.05, thickness: 0.002 },
  nose: { material: 'pla', shape: 'ogive', length: 0.12, diameter: 0.05 },
  fins: {
    count: 3, shape: 'triangulaire',
    height: 0.08, width: 0.045, thickness: 0.003, material: 'balsa'
  },
  motor: { mass: 0.15, propellant: 0.05, position: 0.06, thrust: 40, burnTime: 1.2, isp: 110 },
  payload: { mass: 0.02, position: 0.5 },
  dragCd: 0.5
};

/**
 * Lit la valeur numérique d'un champ HTML.
 * @param {string} id
 * @returns {number}
 */
function val(id) {
  const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
  const v = Number.parseFloat(el?.value ?? '');
  return Number.isFinite(v) ? v : 0;
}

/**
 * Lit un select.
 * @param {string} id
 * @returns {string}
 */
function sel(id) {
  const el = /** @type {HTMLSelectElement|null} */ (document.getElementById(id));
  return el?.value ?? '';
}

/**
 * Rassemble les saisies et convertit en SI.
 * @returns {Object}
 */
export function collect() {
  const u = getUnits();
  const L = (id) => fromDisplay(val(id), 'length', u);
  const M = (id) => fromDisplay(val(id), 'mass', u);
  const F = (id) => fromDisplay(val(id), 'force', u);

  return {
    body: {
      material: sel('body-material'),
      length: L('body-length'),
      diameter: L('body-diameter'),
      thickness: L('body-thickness')
    },
    nose: {
      material: sel('nose-material'),
      shape: sel('nose-shape'),
      length: L('nose-length'),
      diameter: L('nose-diameter')
    },
    fins: {
      count: val('fin-count'),
      shape: sel('fin-shape'),
      height: L('fin-height'),
      width: L('fin-width'),
      thickness: L('fin-thickness'),
      material: sel('fin-material')
    },
    motor: {
      mass: M('motor-mass'),
      propellant: M('motor-propellant'),
      position: L('motor-position'),
      thrust: F('motor-thrust'),
      burnTime: val('motor-burn'),
      isp: val('motor-isp')
    },
    payload: { mass: M('payload-mass'), position: L('payload-position') },
    dragCd: val('drag-cd') || 0.5
  };
}

/**
 * Calcule masses, CG, CP, marge statique. x = 0 à la base.
 * @param {ReturnType<typeof collect>} input
 */
export function computeStructure(input) {
  const { body, nose, fins, motor, payload } = input;
  /** @type {{name:string,mass:number,cg:number}[]} */
  const parts = [];

  if (body.length > 0) {
    const inner = Math.max(0, body.diameter - 2 * body.thickness);
    const vol = (Math.PI / 4) * (body.diameter ** 2 - inner ** 2) * body.length;
    parts.push({ name: 'Corps', mass: vol * MATERIALS[body.material].density, cg: body.length / 2 });
  }

  const noseVol = NOSE_VOLUME[nose.shape] * Math.PI * (nose.diameter / 2) ** 2 * nose.length;
  parts.push({
    name: 'Coiffe',
    mass: noseVol * MATERIALS[nose.material].density,
    cg: body.length + NOSE_CG[nose.shape] * nose.length
  });

  if (fins.count > 0) {
    const vol = fins.count * FIN_AREA[fins.shape] * fins.height * fins.width * fins.thickness;
    parts.push({
      name: 'Ailerettes',
      mass: vol * MATERIALS[fins.material].density,
      cg: fins.height / 2
    });
  }

  if (motor.mass > 0) parts.push({ name: 'Moteur', mass: motor.mass, cg: motor.position });
  if (payload.mass > 0) parts.push({ name: 'Charge utile', mass: payload.mass, cg: payload.position });

  const totalMass = parts.reduce((s, p) => s + p.mass, 0);
  const cg = totalMass > 0 ? parts.reduce((s, p) => s + p.mass * p.cg, 0) / totalMass : 0;

  const diameter = body.diameter || nose.diameter || 0.05;
  const cNaNose = 2;
  const xNose = body.length + NOSE_CP[nose.shape] * nose.length;

  let cNaFins = 0;
  let xFins = 0;
  if (fins.count > 0) {
    const root = fins.height;
    const tip = fins.height * 0.5;
    const span = fins.width;
    const mid = span || 0.001;
    const denom = 1 + Math.sqrt(1 + ((2 * mid) / (root + tip || 0.001)) ** 2);
    cNaFins = denom > 0 ? (4 * fins.count * (span / diameter) ** 2) / denom : 0;
    xFins = fins.height / 2;
  }

  const sumCNa = cNaNose + cNaFins;
  const cp = sumCNa > 0 ? (cNaNose * xNose + cNaFins * xFins) / sumCNa : xNose;
  const margin = diameter > 0 ? (cg - cp) / diameter : 0;

  return { parts, totalMass, cg, cp, margin, diameter };
}

/**
 * Persiste l'état courant.
 * @param {ReturnType<typeof collect>} input
 */
export function saveState(input) {
  localStorage.setItem(STORAGE_STATE, JSON.stringify(input));
}

/**
 * Charge l'état sauvegardé.
 * @returns {ReturnType<typeof collect>|null}
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Applique un état SI aux inputs (conversion vers l'unité d'affichage).
 * @param {ReturnType<typeof collect>} state
 */
export function applyState(state) {
  const u = getUnits();
  const setQ = (id, valueSi, quantity) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    if (!el) return;
    el.value = String(Number(toDisplay(valueSi, quantity, u).toFixed(4)));
  };
  const setRaw = (id, value) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    if (el) el.value = String(value);
  };
  const setSel = (id, value) => {
    const el = /** @type {HTMLSelectElement|null} */ (document.getElementById(id));
    if (el && value) el.value = value;
  };

  setQ('body-length', state.body.length, 'length');
  setQ('body-diameter', state.body.diameter, 'length');
  setQ('body-thickness', state.body.thickness, 'length');
  setQ('nose-length', state.nose.length, 'length');
  setQ('nose-diameter', state.nose.diameter, 'length');
  setRaw('fin-count', state.fins.count);
  setQ('fin-height', state.fins.height, 'length');
  setQ('fin-width', state.fins.width, 'length');
  setQ('fin-thickness', state.fins.thickness, 'length');
  setQ('motor-mass', state.motor.mass, 'mass');
  setQ('motor-propellant', state.motor.propellant, 'mass');
  setQ('motor-position', state.motor.position, 'length');
  setQ('motor-thrust', state.motor.thrust, 'force');
  setRaw('motor-burn', state.motor.burnTime);
  setRaw('motor-isp', state.motor.isp);
  setQ('payload-mass', state.payload.mass, 'mass');
  setQ('payload-position', state.payload.position, 'length');
  setRaw('drag-cd', state.dragCd);

  setSel('body-material', state.body.material);
  setSel('nose-material', state.nose.material);
  setSel('nose-shape', state.nose.shape);
  setSel('fin-shape', state.fins.shape);
  setSel('fin-material', state.fins.material);
}