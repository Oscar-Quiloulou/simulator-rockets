/**
 * Page Construction : câblage formulaire, schéma, aperçu trajectoire,
 * envoi vers le simulateur.
 * @module builder
 */

import { fillMaterialSelect } from './materials.js';
import {
  getUnits, toDisplay, unitLabel, fromDisplay, refreshUnitLabels
} from './units.js';
import {
  DEFAULT_STATE, collect, computeStructure,
  saveState, loadState, applyState
} from './structure.js';
import { drawDiagram, setHighlight } from './diagram.js';
import { drawLaunchPreview } from './launch-preview.js';
import { $, on, fmt, createEl } from './ui.js';

const STORAGE_KEY = 'rocket-simulator:config';

/**
 * Associe chaque champ à l'action sur le schéma.
 * @type {Record<string, {kind:'part',part:string}|{kind:'guide',part:string}>}
 */
const DIAGRAM_MAP = {
  'body-material': { kind: 'part', part: 'body' },
  'body-length': { kind: 'part', part: 'body' },
  'body-diameter': { kind: 'part', part: 'body' },
  'body-thickness': { kind: 'part', part: 'body' },
  'nose-material': { kind: 'part', part: 'nose' },
  'nose-shape': { kind: 'part', part: 'nose' },
  'nose-length': { kind: 'part', part: 'nose' },
  'nose-diameter': { kind: 'part', part: 'nose' },
  'fin-count': { kind: 'part', part: 'fins' },
  'fin-shape': { kind: 'part', part: 'fins' },
  'fin-height': { kind: 'part', part: 'fins' },
  'fin-width': { kind: 'part', part: 'fins' },
  'fin-thickness': { kind: 'part', part: 'fins' },
  'fin-material': { kind: 'part', part: 'fins' },
  'motor-mass': { kind: 'part', part: 'motor' },
  'motor-propellant': { kind: 'part', part: 'motor' },
  'motor-thrust': { kind: 'part', part: 'motor' },
  'motor-burn': { kind: 'part', part: 'motor' },
  'motor-isp': { kind: 'part', part: 'motor' },
  'motor-position': { kind: 'guide', part: 'motor' },
  'payload-mass': { kind: 'part', part: 'payload' },
  'payload-position': { kind: 'guide', part: 'payload' }
};

/**
 * Applique le highlight lié à un champ.
 * @param {string} fieldId
 */
function hoverField(fieldId) {
  const def = DIAGRAM_MAP[fieldId];
  if (!def) return;

  if (def.kind === 'guide') {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(fieldId));
    const raw = Number.parseFloat(el?.value ?? '');
    if (!Number.isFinite(raw)) return;
    const value = fromDisplay(raw, 'length', getUnits());
    setHighlight({ kind: 'guide', part: def.part, value });
  } else {
    setHighlight({ kind: 'part', part: def.part });
  }
}

/**
 * Construit la config passée au moteur physique.
 * @param {ReturnType<typeof collect>} input
 * @param {ReturnType<typeof computeStructure>} model
 * @returns {import('./physics.js').RocketConfig}
 */
function buildSimConfig(input, model) {
  const dryMass = Math.max(0.001, model.totalMass - input.motor.propellant);
  return {
    name: 'Aperçu construction',
    dryMass,
    propellantMass: input.motor.propellant,
    diameter: model.diameter,
    cd: input.dragCd,
    thrust: input.motor.thrust,
    burnTime: input.motor.burnTime,
    isp: input.motor.isp,
    launchAngle: input.launchAngle,
    railLength: input.launchMethod === 'free' ? 0 : input.railLength,
    launchMethod: input.launchMethod
  };
}

/**
 * Met à jour tableau, indicateurs, schéma et aperçu trajectoire.
 */
function render() {
  const input = collect();
  saveState(input);
  const model = computeStructure(input);

  const units = getUnits();
  const massUnit = unitLabel('mass', units);
  const lengthUnit = unitLabel('length', units);

  // --- Tableau des pièces ---
  const tbody = /** @type {HTMLElement} */ ($('#parts-body'));
  tbody.textContent = '';
  for (const part of model.parts) {
    tbody.appendChild(createEl('tr', {}, [
      createEl('td', { text: part.name }),
      createEl('td', { class: 'num', text: fmt(toDisplay(part.mass, 'mass', units), 3) }),
      createEl('td', { class: 'num', text: fmt(toDisplay(part.cg, 'length', units), 1) })
    ]));
  }
  tbody.appendChild(createEl('tr', {}, [
    createEl('td', { text: 'Total' }),
    createEl('td', { class: 'num', text: fmt(toDisplay(model.totalMass, 'mass', units), 3) }),
    createEl('td', { class: 'num', text: fmt(toDisplay(model.cg, 'length', units), 1) })
  ]));

  // --- Statistiques ---
  $('#out-mass').textContent = `${fmt(toDisplay(model.totalMass, 'mass', units), 3)} ${massUnit}`;
  $('#out-cg').textContent = `${fmt(toDisplay(model.cg, 'length', units), 1)} ${lengthUnit}`;
  $('#out-cp').textContent = `${fmt(toDisplay(model.cp, 'length', units), 1)} ${lengthUnit}`;
  $('#out-margin').textContent = fmt(model.margin, 2);

  // --- Stabilité ---
  const badge = /** @type {HTMLElement} */ ($('#stability-badge'));
  const text = /** @type {HTMLElement} */ ($('#stability-text'));

  if (input.fins.count === 0 && model.margin < 1) {
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

  // --- Description du lancement ---
  const info = $('#out-launch-info');
  if (info) {
    const isFree = input.launchMethod === 'free' || input.railLength <= 1e-6;
    if (isFree) {
      info.textContent = `Libre, inclinaison ${fmt(input.launchAngle, 0)}°`;
    } else {
      const railDisp = toDisplay(input.railLength, 'length', units);
      const meth = input.launchMethod === 'tube' ? 'Tube' : 'Rampe';
      info.textContent =
        `${meth} de ${fmt(railDisp, 1)} ${lengthUnit}, inclinaison ${fmt(input.launchAngle, 0)}°`;
    }
  }

  // --- Schéma ---
  drawDiagram(/** @type {HTMLElement} */ ($('#rocket-diagram')), model);

  // --- Aperçu de la trajectoire ---
  const previewHost = $('#launch-preview');
  if (previewHost) {
    drawLaunchPreview(previewHost, buildSimConfig(input, model));
  }
}

/** Envoie la configuration vers le simulateur. */
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
    isp: input.motor.isp,
    launchAngle: input.launchAngle,
    railLength: input.launchMethod === 'free' ? 0 : input.railLength
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

// --- Survol des champs : localisation sur le schéma ---
on(form, 'pointerover', (event) => {
  const label = /** @type {Element} */ (event.target).closest('[data-diagram]');
  if (!label) return;
  hoverField(label.getAttribute('data-diagram') ?? '');
});

on(form, 'pointerout', (event) => {
  const label = /** @type {Element} */ (event.target).closest('[data-diagram]');
  if (!label) return;
  const related = /** @type {PointerEvent} */ (event).relatedTarget;
  if (related instanceof Node && label.contains(related)) return;
  setHighlight(null);
});

on(form, 'focusin', (event) => {
  const label = /** @type {Element} */ (event.target).closest('[data-diagram]');
  if (!label) return;
  hoverField(label.getAttribute('data-diagram') ?? '');
});

on(form, 'focusout', () => setHighlight(null));

on(/** @type {HTMLElement} */ ($('#send-simulator')), 'click', sendToSimulator);

on(window, 'storage', (event) => {
  if (event.key === 'rocket-simulator:units') {
    applyState(loadState() || DEFAULT_STATE);
    refreshUnitLabels(document);
    render();
  }
});

render();