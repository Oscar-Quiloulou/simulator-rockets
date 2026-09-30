/**
 * Affichage du panneau de résultats, avec conversions d'unités à l'affichage.
 * @module results
 */

import { createEl, fmt } from './ui.js';
import { toDisplay, unitLabel, getUnits } from './units.js';

/**
 * Construit les avertissements pertinents.
 * @param {import('./physics.js').SimulationResult} result
 * @param {import('./physics.js').RocketConfig} config
 * @returns {string[]}
 */
function buildWarnings(result, config) {
  /** @type {string[]} */
  const warnings = [];

  if (result.apogee < 1) {
    warnings.push(
      "La fusée n'a pas décollé : la poussée est inférieure au poids initial. Augmentez la poussée ou réduisez la masse."
    );
  }
  if (config.burnTime <= 0 || config.thrust <= 0) {
    warnings.push('Aucune phase propulsée : poussée ou durée de combustion nulle.');
  }
  if (result.maxMach > 0.8) {
    warnings.push(
      `Le vol atteint Mach ${fmt(result.maxMach, 2)} : le modèle de Cd constant devient optimiste en transsonique.`
    );
  }
  if (result.apogee > 3000) {
    warnings.push(
      "Apogée > 3 km : l'atmosphère isotherme simple perd en précision."
    );
  }
  if (config.cd < 0.2 || config.cd > 1.2) {
    warnings.push('Cd hors de la plage usuelle (0,2 – 1,2) : vérifiez la valeur.');
  }
  return warnings;
}

/**
 * Affiche les résultats dans le conteneur fourni.
 * @param {HTMLElement} root
 * @param {import('./physics.js').SimulationResult} result
 * @param {import('./physics.js').RocketConfig} config
 */
export function renderResults(root, result, config) {
  root.textContent = '';

  const units = getUnits();
  const totalMass = config.dryMass + config.propellantMass;
  const massRatio = config.dryMass > 0 ? totalMass / config.dryMass : 1;

  const altitude = toDisplay(result.apogee, 'altitude', units);
  const velocity = toDisplay(result.maxVelocity, 'velocity', units);
  const deltaV = toDisplay(result.deltaV, 'velocity', units);

  /** @type {{label:string,value:string,unit:string,hint?:string}[]} */
  const items = [
    {
      label: 'Apogée',
      value: fmt(altitude, 1),
      unit: unitLabel('altitude', units),
      hint: `atteinte à t = ${fmt(result.apogeeTime, 2)} s`
    },
    {
      label: 'Vitesse maximale',
      value: fmt(velocity, 1),
      unit: unitLabel('velocity', units)
    },
    { label: 'Mach maximal', value: fmt(result.maxMach, 2), unit: 'Mach' },
    { label: 'Accélération max', value: fmt(result.maxAcceleration, 1), unit: 'm/s²' },
    { label: 'Durée de vol', value: fmt(result.flightTime, 2), unit: 's' },
    {
      label: 'Δv (Tsiolkovsky)',
      value: fmt(deltaV, 1),
      unit: unitLabel('velocity', units),
      hint: `rapport de masse ${fmt(massRatio, 2)} — hors traînée et gravité`
    }
  ];

  const grid = createEl('div', { class: 'stat-grid' });
  for (const item of items) {
    const children = [
      createEl('span', { class: 'stat-label', text: item.label }),
      createEl('span', { class: 'stat-value' }, [
        item.value,
        createEl('small', { text: ` ${item.unit}` })
      ])
    ];
    if (item.hint) children.push(createEl('span', { class: 'stat-hint', text: item.hint }));
    grid.appendChild(createEl('div', { class: 'stat' }, children));
  }
  root.appendChild(grid);

  const warnings = buildWarnings(result, config);
  if (warnings.length > 0) {
    const list = createEl('ul', { class: 'warn-list' });
    for (const warning of warnings) list.appendChild(createEl('li', { text: warning }));
    root.appendChild(list);
  }
}