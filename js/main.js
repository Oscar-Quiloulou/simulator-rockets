/**
 * Point d'entrée du simulateur : wiring formulaire, presets, unités, graphiques.
 * @module main
 */

import { simulate } from './physics.js';
import { PRESETS } from './presets.js';
import { readForm, fillForm } from './form.js';
import { renderResults } from './results.js';
import { renderChart } from './charts.js';
import { getUnits, toDisplay, unitLabel, refreshUnitLabels } from './units.js';
import { $, on, debounce } from './ui.js';

const STORAGE_BUILDER = 'rocket-simulator:config';
const STORAGE_LAST = 'rocket-simulator:last-config';

const form = /** @type {HTMLFormElement} */ ($('#rocket-form'));
const presetSelect = /** @type {HTMLSelectElement} */ ($('#preset-select'));
const errorBox = /** @type {HTMLElement} */ ($('#form-errors'));
const resultsHost = /** @type {HTMLElement} */ ($('#results'));

/** Définition des trois graphiques. */
const CHART_DEFS = [
  { host: '#chart-altitude', yKey: 'y', base: 'Altitude', quantity: 'altitude', unit: 'm', color: '#38bdf8' },
  { host: '#chart-velocity', yKey: 'v', base: 'Vitesse', quantity: 'velocity', unit: 'm/s', color: '#22c55e' },
  { host: '#chart-acceleration', yKey: 'a', base: 'Accélération', quantity: null, unit: 'm/s²', color: '#f59e0b' }
];

/**
 * @param {string[]} errors
 */
function showErrors(errors) {
  errorBox.textContent = errors.join(' ');
  errorBox.classList.toggle('is-visible', errors.length > 0);
}

/**
 * Convertit un échantillon dans l'unité d'affichage pour le graphique.
 * @param {import('./physics.js').Sample[]} samples
 * @param {string} key
 * @param {?string} quantity
 * @returns {import('./physics.js').Sample[]}
 */
function convertSamples(samples, key, quantity) {
  if (!quantity) return samples;
  const units = getUnits();
  return samples.map((s) => ({ ...s, [key]: toDisplay(s[key], quantity, units) }));
}

/**
 * Exécute la simulation, met à jour affichages et graphiques.
 */
function run() {
  const { config, errors } = readForm(form);
  showErrors(errors);
  if (errors.length > 0) return;

  localStorage.setItem(STORAGE_LAST, JSON.stringify(config));

  const result = simulate(config, 0.01, 600);
  renderResults(resultsHost, result, config);

  refreshUnitLabels(form);

  for (const def of CHART_DEFS) {
    const samples = convertSamples(result.samples, def.yKey, def.quantity);
    const unit = def.quantity ? unitLabel(def.quantity) : def.unit;
    renderChart(/** @type {HTMLElement} */ ($(def.host)), samples, {
      xKey: 't',
      yKey: def.yKey,
      xLabel: 'Temps (s)',
      yLabel: `${def.base} (${unit})`,
      unit,
      color: def.color
    });
  }
}

const runLive = debounce(run, 200);

// --- Initialisation sélecteur de presets ---
for (const preset of PRESETS) {
  const option = document.createElement('option');
  option.value = preset.id;
  option.textContent = preset.label;
  presetSelect.appendChild(option);
}

// --- Wiring ---
on(form, 'input', runLive);
on(form, 'change', runLive);
on(/** @type {HTMLElement} */ ($('#run')), 'click', run);

on(presetSelect, 'change', () => {
  const preset = PRESETS.find((item) => item.id === presetSelect.value);
  if (!preset) return;
  fillForm(form, preset.config);
  run();
});

on(/** @type {HTMLElement} */ ($('#reset')), 'click', () => {
  const first = PRESETS[0];
  presetSelect.value = first.id;
  fillForm(form, first.config);
  run();
});

// Recalcule si les unités changent dans un autre onglet
on(window, 'storage', (event) => {
  if (event.key === 'rocket-simulator:units') run();
});

// --- Chargement initial ---
const fromBuilder = localStorage.getItem(STORAGE_BUILDER);
const lastConfig = localStorage.getItem(STORAGE_LAST);

if (fromBuilder) {
  localStorage.removeItem(STORAGE_BUILDER);
  try { fillForm(form, JSON.parse(fromBuilder)); } catch { fillForm(form, PRESETS[0].config); }
} else if (lastConfig) {
  try { fillForm(form, JSON.parse(lastConfig)); } catch { fillForm(form, PRESETS[0].config); }
} else {
  fillForm(form, PRESETS[0].config);
  presetSelect.value = PRESETS[0].id;
}

refreshUnitLabels(form);
run();