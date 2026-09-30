/**
 * Page « Construction » : masse, CG, CP (Barrowman simplifié), marge statique.
 * Supporte la fusée « cône seul » (corps de longueur nulle, 0 ailerette).
 * @module builder
 */

import { MATERIALS, fillMaterialSelect } from './materials.js';
import { getUnits, toDisplay, fromDisplay, refreshUnitLabels } from './units.js';
import { $, on, fmt, createEl } from './ui.js';

const STORAGE_KEY = 'rocket-simulator:config';
const STORAGE_STATE = 'rocket-simulator:builder-state';

const NOSE_VOLUME = { cone: 1 / 3, ogive: 0.45 };
const NOSE_CG = { cone: 0.25, ogive: 0.33 };
const NOSE_CP = { cone: 0.333, ogive: 0.5 };
const FIN_AREA = { triangulaire: 0.5, trapezoidale: 0.65, rectangulaire: 1 };

/**
 * Lit la valeur numérique d'un champ.
 * @param {string} id
 * @returns {number}
 */
function val(id) {
  const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
  const value = Number.parseFloat(el?.value ?? '');
  return Number.isFinite(value) ? value : 0;
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
function collect() {
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
    payload: {
      mass: M('payload-mass'),
      position: L('payload-position')
    },
    dragCd: val('drag-cd') || 0.5
  };
}

/**
 * Calcule masses, CG, CP, marge statique.
 * Repère : x = 0 à la base, croissant vers la coiffe.
 * @param {ReturnType<typeof collect>} input
 */
function computeStructure(input) {
  const { body, nose, fins, motor, payload } = input;
  /** @type {{name:string,mass:number,cg:number}[]} */
  const parts = [];

  // Corps (peut être vide : fusée cône seul)
  if (body.length > 0) {
    const inner = Math.max(0, body.diameter - 2 * body.thickness);
    const volume = (Math.PI / 4) * (body.diameter ** 2 - inner ** 2) * body.length;
    parts.push({
      name: 'Corps',
      mass: volume * MATERIALS[body.material].density,
      cg: body.length / 2
    });
  }

  // Coiffe
  const noseRadius = nose.diameter / 2;
  const noseVolume = NOSE_VOLUME[nose.shape] * Math.PI * noseRadius ** 2 * nose.length;
  parts.push({
    name: 'Coiffe',
    mass: noseVolume * MATERIALS[nose.material].density,
    cg: body.length + NOSE_CG[nose.shape] * nose.length
  });

  // Ailerettes (0 = pas d'ailerettes)
  if (fins.count > 0) {
    const finVolume =
      fins.count * FIN_AREA[fins.shape] * fins.height * fins.width * fins.thickness;
    parts.push({
      name: 'Ailerettes',
      mass: finVolume * MATERIALS[fins.material].density,
      cg: fins.height / 2
    });
  }

  if (motor.mass > 0) parts.push({ name: 'Moteur', mass: motor.mass, cg: motor.position });
  if (payload.mass > 0) parts.push({ name: 'Charge utile', mass: payload.mass, cg: payload.position });

  const totalMass = parts.reduce((s, p) => s + p.mass, 0);
  const cg = totalMass > 0 ? parts.reduce((s, p) => s + p.mass * p.cg, 0) / totalMass : 0;

  // Diamètre de référence : corps, sinon base de la coiffe (fusée cône seul)
  const diameter = body.diameter || nose.diameter || 0.05;

  // Barrowman simplifié
  const cNaNose = 2;
  const xNose = body.length + NOSE_CP[nose.shape] * nose.length;

  let cNaFins = 0;
  let xFins = 0;
  if (fins.count > 0) {
    const rootChord = fins.height;
    const tipChord = fins.height * 0.5;
    const span = fins.width;
    const mid = span || 0.001;
    const denom = 1 + Math.sqrt(1 + ((2 * mid) / (rootChord + tipChord || 0.001)) ** 2);
    cNaFins = denom > 0 ? (4 * fins.count * (span / diameter) ** 2) / denom : 0;
    xFins = fins.height / 2;
  }

  const sumCNa = cNaNose + cNaFins;
  const cp = sumCNa > 0 ? (cNaNose * xNose + cNaFins * xFins) / sumCNa : xNose;
  const margin = diameter > 0 ? (cg - cp) / diameter : 0;

  return { parts, totalMass, cg, cp, margin, diameter, body, nose, fins, motor };
}

/**
 * Dessine le schéma SVG de la fusée avec CG et CP.
 * @param {HTMLElement} host
 * @param {ReturnType<typeof computeStructure>} model
 */
function drawDiagram(host, model) {
  host.textContent = '';
  const totalLength = model.body.length + model.nose.length;
  if (totalLength <= 0) return;

  const ns = 'http://www.w3.org/2000/svg';
  const W = 150;
  const H = 340;
  const margin = 24;
  const scale = (H - 2 * margin) / totalLength;

  const make = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };

  const svg = make('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'chart',
    role: 'img',
    'aria-label': 'Schéma de la fusée'
  });

  const refDiameter = model.body.diameter || model.nose.diameter || 0.05;
  const bodyWidth = Math.max(8, refDiameter * scale);
  const cx = W / 2;
  const yOf = (x) => H - margin - x * scale;

  if (model.body.length > 0) {
    svg.appendChild(make('rect', {
      x: cx - bodyWidth / 2,
      y: yOf(model.body.length),
      width: bodyWidth,
      height: model.body.length * scale,
      fill: '#1e293b',
      stroke: '#38bdf8',
      'stroke-width': 1.5,
      rx: 2
    }));
  }

  const noseHalf = Math.max(6, (model.nose.diameter / 2) * scale);
  svg.appendChild(make('polygon', {
    points: `${cx - noseHalf},${yOf(model.body.length)} ${cx + noseHalf},${yOf(model.body.length)} ${cx},${yOf(totalLength)}`,
    fill: '#1e293b',
    stroke: '#38bdf8',
    'stroke-width': 1.5
  }));

  if (model.fins.count > 0) {
    const finH = Math.min(model.fins.height * scale, 60);
    const finW = Math.max(6, Math.min(model.fins.width * scale, 26));
    const baseY = yOf(0);
    for (const dir of [-1, 1]) {
      svg.appendChild(make('polygon', {
        points:
          `${cx + dir * bodyWidth / 2},${baseY} ` +
          `${cx + dir * (bodyWidth / 2 + finW)},${baseY} ` +
          `${cx + dir * bodyWidth / 2},${baseY - finH}`,
        fill: '#334155',
        stroke: '#38bdf8',
        'stroke-width': 1
      }));
    }
  }

  for (const mark of [
    { x: model.cg, color: '#22c55e', label: 'CG' },
    { x: model.cp, color: '#dc2626', label: 'CP' }
  ]) {
    const y = yOf(mark.x);
    if (y < 0 || y > H) continue;
    svg.appendChild(make('line', {
      x1: 8, y1: y, x2: W - 8, y2: y,
      stroke: mark.color, 'stroke-width': 1.5, 'stroke-dasharray': '4 3'
    }));
    const text = make('text', {
      x: W - 6, y: y - 4, fill: mark.color, 'font-size': 11,
      'text-anchor': 'end', 'font-family': 'sans-serif', 'font-weight': 600
    });
    text.textContent = mark.label;
    svg.appendChild(text);
  }

  host.appendChild(svg);
}

/**
 * Enregistre l'état courant (SI) dans localStorage.
 * @param {ReturnType<typeof collect>} input
 */
function saveState(input) {
  localStorage.setItem(STORAGE_STATE, JSON.stringify(input));
}

/**
 * Recharge un état sauvegardé.
 * @returns {ReturnType<typeof collect>|null}
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Applique un état SI aux inputs en convertissant dans l'unité affichée.
 * @param {ReturnType<typeof collect>} state
 */
function applyState(state) {
  const u = getUnits();
  const set = (id, valueSi, quantity) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    if (!el) return;
    el.value = String(Number(toDisplay(valueSi, quantity, u).toFixed(4)));
  };
  const setRaw = (id, value) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    if (el) el.value = String(value);
  };

  set('body-length', state.body.length, 'length');
  set('body-diameter', state.body.diameter, 'length');
  set('body-thickness', state.body.thickness, 'length');
  set('nose-length', state.nose.length, 'length');
  set('nose-diameter', state.nose.diameter, 'length');
  setRaw('fin-count', state.fins.count);
  set('fin-height', state.fins.height, 'length');
  set('fin-width', state.fins.width, 'length');
  set('fin-thickness', state.fins.thickness, 'length');
  set('motor-mass', state.motor.mass, 'mass');
  set('motor-propellant', state.motor.propellant, 'mass');
  set('motor-position', state.motor.position, 'length');
  set('motor-thrust', state.motor.thrust, 'force');
  setRaw('motor-burn', state.motor.burnTime);
  setRaw('motor-isp', state.motor.isp);
  set('payload-mass', state.payload.mass, 'mass');
  set('payload-position', state.payload.position, 'length');
  setRaw('drag-cd', state.dragCd);

  const material = (id, value) => {
    const el = /** @type {HTMLSelectElement|null} */ (document.getElementById(id));
    if (el && value) el.value = value;
  };
  material('body-material', state.body.material);
  material('nose-material', state.nose.material);
  material('nose-shape', state.nose.shape);
  material('fin-shape', state.fins.shape);
  material('fin-material', state.fins.material);
}

/** État par défaut en SI. */
const DEFAULT_STATE = {
  body: { material: 'pvc', length: 0.6, diameter: 0.05, thickness: 0.002 },
  nose: { material: 'pla', shape: 'ogive', length: 0.12, diameter: 0.05 },
  fins: { count: 3, shape: 'triangulaire', height: 0.08, width: 0.045, thickness: 0.003, material: 'balsa' },
  motor: { mass: 0.15, propellant: 0.05, position: 0.06, thrust: 40, burnTime: 1.2, isp: 110 },
  payload: { mass: 0.02, position: 0.5 },
  dragCd: 0.5
};

/**
 * Met à jour tableau, indicateurs et schéma.
 */
function render() {
  const input = collect();
  saveState(input);
  const model = computeStructure(input);

  const tbody = /** @type {HTMLElement} */ ($('#parts-body'));
  tbody.textContent = '';
  for (const part of model.parts) {
    tbody.appendChild(createEl('tr', {}, [
      createEl('td', { text: part.name }),
      createEl('td', { class: 'num', text: fmt(part.mass, 3) }),
      createEl('td', { class: 'num', text: fmt(part.cg * 100, 1) })
    ]));
  }
  tbody.appendChild(createEl('tr', {}, [
    createEl('td', { text: 'Total' }),
    createEl('td', { class: 'num', text: fmt(model.totalMass, 3) }),
    createEl('td', { class: 'num', text: fmt(model.cg * 100, 1) })
  ]));

  $('#out-mass').textContent = `${fmt(model.totalMass, 3)} kg`;
  $('#out-cg').textContent = `${fmt(model.cg * 100, 1)} cm`;
  $('#out-cp').textContent = `${fmt(model.cp * 100, 1)} cm`;
  $('#out-margin').textContent = fmt(model.margin, 2);

  const badge = /** @type {HTMLElement} */ ($('#stability-badge'));
  const text = /** @type {HTMLElement} */ ($('#stability-text'));

  if (model.fins.count === 0 && model.margin < 1) {
    badge.dataset.level = 'bad';
    badge.textContent = 'Très instable';
    text.textContent =
      "Une fusée sans ailerettes est presque toujours instable. Ajoutez au moins 3 ailerettes ou du poids en pointe.";
  } else if (model.margin >= 1) {
    badge.dataset.level = 'ok';
    badge.textContent = 'Stable';
    text.textContent = 'Marge statique ≥ 1 calibre : la fusée est stable en vol.';
  } else if (model.margin >= 0.5) {
    badge.dataset.level = 'warn';
    badge.textContent = 'Limite';
    text.textContent = 'Marge entre 0,5 et 1 calibre : vol possible mais sensible au vent.';
  } else {
    badge.dataset.level = 'bad';
    badge.textContent = 'Instable';
    text.textContent =
      'Marge < 0,5 calibre : risque de culbute. Ajoutez du poids en pointe ou agrandissez les ailerettes.';
  }

  drawDiagram(/** @type {HTMLElement} */ ($('#rocket-diagram')), model);
}

/**
 * Envoie la configuration vers le simulateur via localStorage.
 */
function sendToSimulator() {
  const input = collect();
  const model = computeStructure(input);
  const dryMass = Math.max(0.001, model.totalMass - input.motor.propellant);

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    name: 'Fusée construction',
    dryMass,
    propellantMass: input.motor.propellant,
    diameter: model.diameter,
    cd: input.dragCd,
    thrust: input.motor.thrust,
    burnTime: input.motor.burnTime,
    isp: input.motor.isp
  }));
  window.location.href = 'index.html';
}

// --- Initialisation ---
fillMaterialSelect(/** @type {HTMLSelectElement} */ ($('#body-material')), 'pvc');
fillMaterialSelect(/** @type {HTMLSelectElement} */ ($('#nose-material')), 'pla');
fillMaterialSelect(/** @type {HTMLSelectElement} */ ($('#fin-material')), 'balsa');

applyState(loadState() || DEFAULT_STATE);
refreshUnitLabels(document);

const form = /** @type {HTMLFormElement} */ ($('#builder-form'));
on(form, 'input', render);
on(form, 'change', render);
on(/** @type {HTMLElement} */ ($('#send-simulator')), 'click', sendToSimulator);

on(window, 'storage', (event) => {
  if (event.key === 'rocket-simulator:units') {
    applyState(loadState() || DEFAULT_STATE);
    refreshUnitLabels(document);
    render();
  }
});

render();