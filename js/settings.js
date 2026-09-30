/**
 * Page Paramètres : sélection des unités d'affichage.
 * @module settings
 */

import { UNIT_DEFS, getUnits, setUnits, resetUnits, applyPreset } from './units.js';
import { $, on, createEl } from './ui.js';

/**
 * Construit le bloc de sélection d'une grandeur (boutons radio).
 * @param {string} quantity
 * @param {string} current
 * @returns {HTMLElement}
 */
function buildQuantityBlock(quantity, current) {
  const def = UNIT_DEFS[quantity];
  const row = createEl('div', { class: 'radio-row' });

  for (const [key, unit] of Object.entries(def.units)) {
    const id = `unit-${quantity}-${key.replace('/', '-')}`;
    const input = createEl('input', {
      type: 'radio',
      name: quantity,
      id,
      value: key,
      checked: key === current
    });
    const label = createEl('label', { for: id, class: 'radio-pill' }, [
      input,
      createEl('span', { text: unit.label })
    ]);
    row.appendChild(label);
  }

  return createEl('div', { class: 'card unit-card' }, [
    createEl('h3', { class: 'chart-title', text: def.label }),
    row
  ]);
}

/**
 * Rafraîchit l'aperçu « SI = … » pour chaque grandeur.
 */
function refreshPreview() {
  const units = getUnits();
  /** @type {Record<string, string>} */
  const samples = {
    length: '1 m',
    mass: '1 kg',
    velocity: '10 m/s',
    altitude: '1000 m',
    force: '50 N'
  };
  for (const quantity of Object.keys(UNIT_DEFS)) {
    const host = $(`#preview-${quantity}`);
    if (!host) continue;
    const factor = UNIT_DEFS[quantity].units[units[quantity]].factor;
    const value = Number.parseFloat(samples[quantity]);
    host.textContent = `${samples[quantity]} = ${(value * factor).toFixed(2)} ${units[quantity]}`;
  }
}

/**
 * Initialise la page.
 */
function init() {
  const host = $('#units-host');
  const units = getUnits();

  for (const quantity of Object.keys(UNIT_DEFS)) {
    const block = buildQuantityBlock(quantity, units[quantity]);
    const preview = createEl('p', {
      class: 'unit-preview',
      id: `preview-${quantity}`
    });
    block.appendChild(preview);
    host.appendChild(block);
  }

  refreshPreview();

  on(host, 'change', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    if (target.type !== 'radio') return;
    setUnits({ [target.name]: target.value });
    refreshPreview();
  });

  on($('#preset-metric'), 'click', () => {
    applyPreset('metric');
    window.location.reload();
  });
  on($('#preset-imperial'), 'click', () => {
    applyPreset('imperial');
    window.location.reload();
  });
  on($('#reset-units'), 'click', () => {
    resetUnits();
    window.location.reload();
  });
}

init();