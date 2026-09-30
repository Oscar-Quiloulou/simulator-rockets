/**
 * Rendu SVG du schéma de la fusée et mise en évidence au survol des champs.
 * @module diagram
 */

import { toDisplay, unitLabel } from './units.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 240;
const H = 380;
const MARGIN = 28;

/** Dernier SVG rendu. @type {SVGElement|null} */
let svgEl = null;
/** Dernier modèle calculé. @type {Object|null} */
let lastModel = null;
/** État de mise en évidence actif. @type {{kind:'part',part:string}|{kind:'guide',part:string,value:number}|null} */
let active = null;

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
 * Convertit une position SI (m depuis la base) en coordonnée Y SVG.
 * @param {number} x
 * @param {number} totalLength
 * @returns {number}
 */
function makeY(x, totalLength) {
  return H - MARGIN - (x / totalLength) * (H - 2 * MARGIN);
}

/**
 * Dessine le schéma complet.
 * @param {HTMLElement} host
 * @param {Object} model Résultat de computeStructure()
 */
export function drawDiagram(host, model) {
  host.textContent = '';
  lastModel = model;

  const totalLength = model.body.length + model.nose.length;
  if (totalLength <= 0) {
    svgEl = null;
    return;
  }

  const scale = (H - 2 * MARGIN) / totalLength;
  const cx = W / 2;
  const yOf = (x) => makeY(x, totalLength);
  const refDiameter = model.body.diameter || model.nose.diameter || 0.05;
  const bodyWidth = Math.max(10, refDiameter * scale);

  const svg = make('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'chart',
    role: 'img',
    'aria-label': 'Schéma de la fusée'
  });

  // Ligne de sol (repère "base")
  svg.appendChild(make('line', {
    x1: 6, y1: yOf(0), x2: W - 6, y2: yOf(0),
    stroke: '#334155', 'stroke-width': 1, 'stroke-dasharray': '2 4'
  }));
  const baseTxt = make('text', {
    x: W - 6, y: yOf(0) + 13, fill: '#64748b', 'font-size': 10,
    'text-anchor': 'end', 'font-family': 'sans-serif'
  });
  baseTxt.textContent = 'base';
  svg.appendChild(baseTxt);

  // --- Corps ---
  const gBody = make('g', { class: 'dgm-group', 'data-part': 'body' });
  if (model.body.length > 0) {
    gBody.appendChild(make('rect', {
      x: cx - bodyWidth / 2,
      y: yOf(model.body.length),
      width: bodyWidth,
      height: model.body.length * scale,
      fill: '#1e293b', stroke: '#38bdf8', 'stroke-width': 1.5, rx: 2,
      class: 'dgm-shape'
    }));
  }
  svg.appendChild(gBody);

  // --- Coiffe ---
  const gNose = make('g', { class: 'dgm-group', 'data-part': 'nose' });
  const noseHalf = Math.max(6, (model.nose.diameter / 2) * scale);
  gNose.appendChild(make('polygon', {
    points: `${cx - noseHalf},${yOf(model.body.length)} ${cx + noseHalf},${yOf(model.body.length)} ${cx},${yOf(totalLength)}`,
    fill: '#1e293b', stroke: '#38bdf8', 'stroke-width': 1.5,
    class: 'dgm-shape'
  }));
  svg.appendChild(gNose);

  // --- Ailerettes ---
  const gFins = make('g', { class: 'dgm-group', 'data-part': 'fins' });
  if (model.fins.count > 0) {
    const finH = Math.min(model.fins.height * scale, 80);
    const finW = Math.max(6, Math.min(model.fins.width * scale, 34));
    const baseY = yOf(0);
    for (const dir of [-1, 1]) {
      gFins.appendChild(make('polygon', {
        points:
          `${cx + dir * bodyWidth / 2},${baseY} ` +
          `${cx + dir * (bodyWidth / 2 + finW)},${baseY} ` +
          `${cx + dir * bodyWidth / 2},${baseY - finH}`,
        fill: '#334155', stroke: '#38bdf8', 'stroke-width': 1,
        class: 'dgm-shape'
      }));
    }
  }
  svg.appendChild(gFins);

  // --- Marquage moteur ---
  const gMotor = make('g', { class: 'dgm-group', 'data-part': 'motor' });
  const yM = yOf(model.motor.position);
  if (model.motor.position >= 0 && model.motor.position <= totalLength) {
    gMotor.appendChild(make('line', {
      x1: 14, y1: yM, x2: W - 14, y2: yM,
      stroke: '#f59e0b', 'stroke-width': 1.3, 'stroke-dasharray': '4 3',
      class: 'dgm-shape'
    }));
    const t = make('text', {
      x: 12, y: yM - 4, fill: '#f59e0b', 'font-size': 10,
      'font-family': 'sans-serif', 'font-weight': 700
    });
    t.textContent = 'MOTEUR';
    gMotor.appendChild(t);
  }
  svg.appendChild(gMotor);

  // --- Marquage charge utile ---
  const gPayload = make('g', { class: 'dgm-group', 'data-part': 'payload' });
  const yP = yOf(model.payload.position);
  if (model.payload.position >= 0 && model.payload.position <= totalLength) {
    gPayload.appendChild(make('line', {
      x1: 14, y1: yP, x2: W - 14, y2: yP,
      stroke: '#a855f7', 'stroke-width': 1.3, 'stroke-dasharray': '4 3',
      class: 'dgm-shape'
    }));
    const t = make('text', {
      x: 12, y: yP - 4, fill: '#a855f7', 'font-size': 10,
      'font-family': 'sans-serif', 'font-weight': 700
    });
    t.textContent = 'CU';
    gPayload.appendChild(t);
  }
  svg.appendChild(gPayload);

  // --- Guide vertical de position (caché par défaut) ---
  const gGuide = make('g', { class: 'dgm-guide', id: 'dgm-guide' });
  gGuide.appendChild(make('line', {
    x1: cx, y1: yOf(0), x2: cx, y2: yOf(0),
    stroke: '#fbbf24', 'stroke-width': 2, 'stroke-dasharray': '4 3',
    id: 'dgm-guide-line'
  }));
  gGuide.appendChild(make('circle', {
    cx, cy: yOf(0), r: 4, fill: '#fbbf24', id: 'dgm-guide-dot'
  }));
  const gLabel = make('text', {
    x: cx + 12, y: yOf(0) - 6, fill: '#fbbf24', 'font-size': 11,
    'font-family': 'sans-serif', 'font-weight': 700,
    'text-anchor': 'start', id: 'dgm-guide-label'
  });
  gGuide.appendChild(gLabel);
  svg.appendChild(gGuide);

  // --- CG / CP ---
  for (const m of [
    { x: model.cg, color: '#22c55e', label: 'CG' },
    { x: model.cp, color: '#dc2626', label: 'CP' }
  ]) {
    const y = yOf(m.x);
    if (y < 0 || y > H) continue;
    svg.appendChild(make('line', {
      x1: 8, y1: y, x2: W - 8, y2: y,
      stroke: m.color, 'stroke-width': 1.5,
      'stroke-dasharray': '5 4', opacity: 0.8
    }));
    const t = make('text', {
      x: W - 6, y: y - 4, fill: m.color, 'font-size': 11,
      'text-anchor': 'end', 'font-family': 'sans-serif', 'font-weight': 700
    });
    t.textContent = m.label;
    svg.appendChild(t);
  }

  host.appendChild(svg);
  svgEl = svg;
  reapply();
}

/**
 * Met en évidence une pièce.
 * @param {string|null} part
 */
export function highlightPart(part) {
  if (!svgEl) return;
  svgEl.querySelectorAll('.dgm-group').forEach((g) => {
    g.classList.toggle('is-focus', g.getAttribute('data-part') === part);
  });
}

/**
 * Affiche le guide vertical à une position donnée (m depuis la base).
 * @param {number} positionMeters
 */
export function showPositionGuide(positionMeters) {
  if (!svgEl || !lastModel) return;
  const totalLength = lastModel.body.length + lastModel.nose.length;
  if (totalLength <= 0) return;

  const cx = W / 2;
  const y0 = makeY(0, totalLength);
  const clamped = Math.max(0, Math.min(positionMeters, totalLength));
  const y1 = makeY(clamped, totalLength);

  const line = svgEl.querySelector('#dgm-guide-line');
  const dot = svgEl.querySelector('#dgm-guide-dot');
  const label = svgEl.querySelector('#dgm-guide-label');
  const group = svgEl.querySelector('#dgm-guide');

  if (line) {
    line.setAttribute('x1', cx);
    line.setAttribute('y1', y0);
    line.setAttribute('x2', cx);
    line.setAttribute('y2', y1);
  }
  if (dot) {
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', y1);
  }
  if (label) {
    label.setAttribute('x', cx + 12);
    label.setAttribute('y', y1 - 6);
    label.textContent = `${toDisplay(clamped, 'length').toFixed(1)} ${unitLabel('length')}`;
  }
  group?.classList.add('is-visible');
}

/** Cache le guide vertical. */
export function hideGuide() {
  svgEl?.querySelector('#dgm-guide')?.classList.remove('is-visible');
}

/** Réapplique l'état de mise en évidence en cours (après un redraw). */
function reapply() {
  if (!active) return;
  highlightPart(active.part);
  if (active.kind === 'guide') showPositionGuide(active.value);
  else hideGuide();
}

/**
 * Définit l'état de mise en évidence.
 * @param {{kind:'part',part:string}|{kind:'guide',part:string,value:number}|null} state
 */
export function setHighlight(state) {
  active = state;
  if (!state) {
    highlightPart(null);
    hideGuide();
    return;
  }
  reapply();
}