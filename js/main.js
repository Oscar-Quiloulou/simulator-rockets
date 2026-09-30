/**
 * Point d'entrée du simulateur : formulaire, presets, unités, graphiques.
 * @module main
 */

import { simulate } from './physics.js';
import { PRESETS } from './presets.js';
import { readForm, fillForm } from './form.js';
import { renderResults } from './results.js';
import { renderChart } from './charts.js';
import { getUnits, toDisplay, unitLabel, refreshUnitLabels } from './units.js';
import { $, on, debounce, createEl } from './ui.js';

const STORAGE_BUILDER = 'rocket-simulator:config';
const STORAGE_LAST = 'rocket-simulator:last-config';

const form = /** @type {HTMLFormElement} */ ($('#rocket-form'));
const presetSelect = /** @type {HTMLSelectElement} */ ($('#preset-select'));
const errorBox = /** @type {HTMLElement} */ ($('#form-errors'));
const resultsHost = /** @type {HTMLElement} */ ($('#results'));

/**
 * @param {string[]} errors
 */
function showErrors(errors) {
  errorBox.textContent = errors.join(' ');
  errorBox.classList.toggle('is-visible', errors.length > 0);
}

/**
 * Convertit un champ d'un échantillon vers l'unité d'affichage.
 * @param {Object[]} samples
 * @param {string} key
 * @param {?string} quantity
 * @returns {Object[]}
 */
function convertSamples(samples, key, quantity) {
  if (!quantity) return samples;
  const units = getUnits();
  return samples.map((s) => ({ ...s, [key]: toDisplay(s[key], quantity, units) }));
}

/**
 * Rendu des 4 graphiques.
 * @param {import('./physics.js').SimulationResult} result
 */
function renderCharts(result) {
  const units = getUnits();
  const altUnit = unitLabel('altitude', units);
  const velUnit = unitLabel('velocity', units);

  renderChart($('#chart-altitude'), convertSamples(result.samples, 'y', 'altitude'), {
    xKey: 't', yKey: 'y',
    xLabel: 'Temps (s)', yLabel: `Altitude (${altUnit})`,
    unit: altUnit, xUnit: 's', color: '#38bdf8'
  });

  renderChart($('#chart-velocity'), convertSamples(result.samples, 'v', 'velocity'), {
    xKey: 't', yKey: 'v',
    xLabel: 'Temps (s)', yLabel: `Vitesse (${velUnit})`,
    unit: velUnit, xUnit: 's', color: '#22c55e'
  });

  renderChart($('#chart-acceleration'), result.samples, {
    xKey: 't', yKey: 'a',
    xLabel: 'Temps (s)', yLabel: 'Accélération (m/s²)',
    unit: 'm/s²', xUnit: 's', color: '#f59e0b'
  });

  // Trajectoire (x vs y) — mêmes unités sur les deux axes
  const trajHost = $('#chart-trajectory');
  trajHost.textContent = '';
  const trajSamples = result.samples.map((s) => ({
    ...s,
    x: toDisplay(s.x, 'altitude', units),
    y: toDisplay(s.y, 'altitude', units)
  }));
  const maxX = trajSamples.reduce((m, s) => (s.x > m ? s.x : m), 0);
  if (maxX < 0.01) {
    trajHost.appendChild(createEl('p', {
      class: 'chart-empty',
      text: 'Lancement vertical — aucune portée horizontale à afficher.'
    }));
    return;
  }
  renderChart(trajHost, trajSamples, {
    xKey: 'x', yKey: 'y',
    xLabel: `Distance horizontale (${altUnit})`,
    yLabel: `Altitude (${altUnit})`,
    unit: altUnit, xUnit: altUnit, xDecimals: 1,
    color: '#a855f7'
  });
}

/** Exécute la simulation et met à jour tous les affichages. */
function run() {
  const { config, errors } = readForm(form);
  showErrors(errors);
  if (errors.length > 0) return;

  localStorage.setItem(STORAGE_LAST, JSON.stringify(config));

  const result = simulate(config, 0.01, 600);
  renderResults(resultsHost, result, config);
  refreshUnitLabels(form);
  renderCharts(result);
}

const runLive = debounce(run, 200);

// --- Initialisation du sélecteur de presets ---
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