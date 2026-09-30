/**
 * Aperçu live de la trajectoire prévue (page Construction).
 * Utilise le même moteur physique que le simulateur principal.
 * @module launch-preview
 */

import { simulate } from './physics.js';
import { getUnits, toDisplay, unitLabel } from './units.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_W = 280;
const VIEW_H = 280;
const PAD = { l: 16, r: 16, t: 16, b: 28 };

/**
 * Crée un nœud SVG.
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 * @returns {SVGElement}
 */
function make(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * Affiche un message à la place du dessin.
 * @param {HTMLElement} host
 * @param {string} text
 */
function showPlaceholder(host, text) {
  const p = document.createElement('p');
  p.className = 'chart-empty';
  p.textContent = text;
  host.appendChild(p);
}

/**
 * Dessine l'aperçu de trajectoire.
 * @param {HTMLElement} host
 * @param {import('./physics.js').RocketConfig} config
 */
export function drawLaunchPreview(host, config) {
  host.textContent = '';

  if (!config.thrust || config.thrust <= 0 || !config.burnTime || config.burnTime <= 0) {
    showPlaceholder(host, 'Renseignez une poussée et une durée de combustion pour voir la trajectoire prévue.');
    return;
  }

  let result;
  try {
    result = simulate(config, 0.02, 600);
  } catch {
    showPlaceholder(host, 'Impossible de simuler avec ces paramètres.');
    return;
  }

  if (result.apogee < 0.1 && result.downrange < 0.1) {
    showPlaceholder(host, 'La fusée ne décolle pas (poussée insuffisante).');
    return;
  }

  const units = getUnits();
  const lengthUnit = unitLabel('length', units);

  // Conversion des échantillons dans l'unité d'affichage
  const samples = result.samples.map((s) => ({
    x: toDisplay(s.x, 'altitude', units),
    y: toDisplay(s.y, 'altitude', units)
  }));

  // Rampe
  const angleRad = ((config.launchAngle ?? 0) * Math.PI) / 180;
  const railLen = (config.railLength > 0)
    ? toDisplay(config.railLength, 'length', units)
    : 0;
  const railX = Math.sin(angleRad) * railLen;
  const railY = Math.cos(angleRad) * railLen;

  // Boîte englobante
  let maxX = Math.max(railX, 0);
  let maxY = Math.max(railY, 0);
  for (const s of samples) {
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }
  // Éviter les divisions par zéro (tir strictement vertical)
  if (maxX < 1e-3) maxX = 1;
  if (maxY < 1e-3) maxY = 1;

  // Facteur d'échelle uniforme
  const iw = VIEW_W - PAD.l - PAD.r;
  const ih = VIEW_H - PAD.t - PAD.b;
  const scale = Math.min(iw / maxX, ih / maxY);

  const drawW = maxX * scale;
  const drawH = maxY * scale;
  const offsetX = PAD.l + (iw - drawW) / 2;
  const offsetY = PAD.t + (ih - drawH);
  const groundY = offsetY + drawH;

  const sx = (x) => offsetX + x * scale;
  const sy = (y) => groundY - y * scale;

  const svg = make('svg', {
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    class: 'chart',
    role: 'img',
    'aria-label': 'Trajectoire prévue'
  });

  // Sol
  svg.appendChild(make('line', {
    x1: 0, y1: groundY, x2: VIEW_W, y2: groundY,
    stroke: '#334155', 'stroke-width': 1.5
  }));
  for (let gx = 4; gx < VIEW_W; gx += 10) {
    svg.appendChild(make('line', {
      x1: gx, y1: groundY,
      x2: gx - 6, y2: groundY + 6,
      stroke: '#1f2937', 'stroke-width': 1
    }));
  }

  // Rampe
  if (railLen > 0) {
    svg.appendChild(make('line', {
      x1: sx(0), y1: sy(0),
      x2: sx(railX), y2: sy(railY),
      stroke: '#fbbf24', 'stroke-width': 3, 'stroke-linecap': 'round'
    }));
    svg.appendChild(make('circle', {
      cx: sx(railX), cy: sy(railY), r: 2.5, fill: '#fbbf24'
    }));
  }

  // Trajectoire
  const points = samples
    .map((s) => `${sx(s.x).toFixed(1)},${sy(s.y).toFixed(1)}`)
    .join(' ');
  svg.appendChild(make('polyline', {
    points,
    fill: 'none',
    stroke: '#38bdf8',
    'stroke-width': 2,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round'
  }));

  // Apogée
  let apogeePoint = samples[0];
  for (const s of samples) if (s.y > apogeePoint.y) apogeePoint = s;

  svg.appendChild(make('circle', {
    cx: sx(apogeePoint.x), cy: sy(apogeePoint.y),
    r: 4, fill: '#22c55e', stroke: '#0a0f1a', 'stroke-width': 1.5
  }));

  const apogeeLabel = make('text', {
    x: sx(apogeePoint.x) + 7,
    y: sy(apogeePoint.y) - 3,
    fill: '#22c55e', 'font-size': 10,
    'font-family': 'sans-serif', 'font-weight': 700
  });
  apogeeLabel.textContent = `apogée ${apogeePoint.y.toFixed(1)} ${lengthUnit}`;
  svg.appendChild(apogeeLabel);

  // Impact au sol
  const last = samples[samples.length - 1];
  if (last.x > 0.1 && last.y < Math.max(0.5, apogeePoint.y * 0.01)) {
    svg.appendChild(make('circle', {
      cx: sx(last.x), cy: sy(0),
      r: 4, fill: '#dc2626', stroke: '#0a0f1a', 'stroke-width': 1.5
    }));
    const impactLabel = make('text', {
      x: sx(last.x) + 7,
      y: groundY - 5,
      fill: '#f87171', 'font-size': 10,
      'font-family': 'sans-serif', 'font-weight': 700
    });
    impactLabel.textContent = `portée ${last.x.toFixed(1)} ${lengthUnit}`;
    svg.appendChild(impactLabel);
  }

  // Bandeau d'information en bas
  const method = config.launchMethod === 'tube'
    ? 'tube'
    : config.launchMethod === 'free'
      ? 'libre'
      : 'rampe';
  const infoLabel = make('text', {
    x: PAD.l,
    y: VIEW_H - 8,
    fill: '#64748b', 'font-size': 11,
    'font-family': 'sans-serif'
  });
  infoLabel.textContent = `${config.launchAngle ?? 0}° · ${method}`;
  svg.appendChild(infoLabel);

  host.appendChild(svg);
}