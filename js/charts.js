/**
 * Rendu de graphiques SVG générés dynamiquement, sans dépendance externe.
 * @module charts
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_W = 640;
const VIEW_H = 280;
const PAD = { l: 62, r: 18, t: 16, b: 44 };
const TICKS = 5;

/**
 * Crée un nœud SVG avec ses attributs.
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 * @returns {SVGElement}
 */
function node(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

/**
 * Arrondit une valeur vers le haut sur une borne « ronde » (1, 2, 5 × 10ⁿ).
 * @param {number} value
 * @returns {number}
 */
function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * base;
}

/**
 * Formate une graduation d'axe.
 * @param {number} value
 * @returns {string}
 */
function tickLabel(value) {
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

/**
 * Recherche dichotomique de l'échantillon le plus proche d'un instant.
 * @param {import('./physics.js').Sample[]} samples
 * @param {number} t
 * @returns {number} Index trouvé
 */
function indexAt(samples, t) {
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(samples[lo - 1].t - t) < Math.abs(samples[lo].t - t)) {
    return lo - 1;
  }
  return lo;
}

/**
 * Dessine un graphique SVG dans un conteneur.
 * @param {HTMLElement} container
 * @param {import('./physics.js').Sample[]} samples
 * @param {Object} options
 * @param {string} options.yKey   Clé de l'échantillon à tracer
 * @param {string} options.yLabel Libellé de l'axe vertical
 * @param {string} [options.xKey='t']
 * @param {string} [options.xLabel='Temps (s)']
 * @param {string} [options.color='#38bdf8']
 * @param {string} [options.unit='']
 */
export function renderChart(container, samples, options) {
  container.textContent = '';
  if (!samples || samples.length < 2) return;

  const {
    xKey = 't',
    yKey,
    xLabel = 'Temps (s)',
    yLabel = '',
    color = '#38bdf8',
    unit = ''
  } = options;

  const iw = VIEW_W - PAD.l - PAD.r;
  const ih = VIEW_H - PAD.t - PAD.b;

  const xMax = niceCeil(samples[samples.length - 1][xKey] || 1);

  let yHi = -Infinity;
  let yLo = Infinity;
  for (const sample of samples) {
    const value = sample[yKey];
    if (value > yHi) yHi = value;
    if (value < yLo) yLo = value;
  }
  yHi = niceCeil(yHi);
  yLo = yLo < 0 ? -niceCeil(-yLo) : 0;
  if (yHi === yLo) yHi = yLo + 1;

  const sx = (x) => PAD.l + (x / xMax) * iw;
  const sy = (y) => PAD.t + ih - ((y - yLo) / (yHi - yLo)) * ih;

  const svg = node('svg', {
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    class: 'chart',
    role: 'img',
    'aria-label': `${yLabel} en fonction de ${xLabel.toLowerCase()}`
  });

  // Grille + graduations
  for (let i = 0; i <= TICKS; i += 1) {
    const gx = PAD.l + (iw * i) / TICKS;
    svg.appendChild(node('line', { x1: gx, y1: PAD.t, x2: gx, y2: PAD.t + ih, class: 'chart-grid' }));
    const xText = node('text', {
      x: gx, y: PAD.t + ih + 20, class: 'chart-tick', 'text-anchor': 'middle'
    });
    xText.textContent = tickLabel((xMax * i) / TICKS);
    svg.appendChild(xText);
  }
  for (let i = 0; i <= TICKS; i += 1) {
    const gy = PAD.t + (ih * i) / TICKS;
    svg.appendChild(node('line', { x1: PAD.l, y1: gy, x2: PAD.l + iw, y2: gy, class: 'chart-grid' }));
    const yText = node('text', {
      x: PAD.l - 10, y: gy + 4, class: 'chart-tick', 'text-anchor': 'end'
    });
    yText.textContent = tickLabel(yHi - ((yHi - yLo) * i) / TICKS);
    svg.appendChild(yText);
  }

  // Axes
  svg.appendChild(node('line', { x1: PAD.l, y1: PAD.t, x2: PAD.l, y2: PAD.t + ih, class: 'chart-axis' }));
  svg.appendChild(node('line', { x1: PAD.l, y1: PAD.t + ih, x2: PAD.l + iw, y2: PAD.t + ih, class: 'chart-axis' }));

  // Courbe
  const points = samples
    .map((sample) => `${sx(sample[xKey]).toFixed(1)},${sy(sample[yKey]).toFixed(1)}`)
    .join(' ');
  svg.appendChild(
    node('polyline', {
      points,
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    })
  );

  // Titres d'axes
  const xTitle = node('text', {
    x: PAD.l + iw / 2, y: VIEW_H - 6, class: 'chart-label', 'text-anchor': 'middle'
  });
  xTitle.textContent = xLabel;
  svg.appendChild(xTitle);

  const yCy = PAD.t + ih / 2;
  const yTitle = node('text', {
    x: 14, y: yCy, class: 'chart-label', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${yCy})`
  });
  yTitle.textContent = yLabel;
  svg.appendChild(yTitle);

  // Curseur + marqueur
  const crosshair = node('line', {
    y1: PAD.t, y2: PAD.t + ih, class: 'chart-crosshair', opacity: 0
  });
  const marker = node('circle', {
    r: 4, fill: color, stroke: '#0a0f1a', 'stroke-width': 2, opacity: 0
  });
  svg.appendChild(crosshair);
  svg.appendChild(marker);

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;

  container.appendChild(svg);
  container.appendChild(tooltip);

  const hide = () => {
    crosshair.setAttribute('opacity', 0);
    marker.setAttribute('opacity', 0);
    tooltip.hidden = true;
  };

  svg.addEventListener('pointermove', (event) => {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    if (px < PAD.l || px > PAD.l + iw) {
      hide();
      return;
    }
    const t = ((px - PAD.l) / iw) * xMax;
    const sample = samples[indexAt(samples, t)];
    const cx = sx(sample[xKey]);
    const cy = sy(sample[yKey]);

    crosshair.setAttribute('x1', cx);
    crosshair.setAttribute('x2', cx);
    crosshair.setAttribute('opacity', 1);
    marker.setAttribute('cx', cx);
    marker.setAttribute('cy', cy);
    marker.setAttribute('opacity', 1);

    tooltip.hidden = false;
    tooltip.textContent = `t = ${sample.t.toFixed(2)} s — ${sample[yKey].toFixed(1)} ${unit}`.trim();
    tooltip.style.left = `${(cx / VIEW_W) * 100}%`;
    tooltip.style.top = `${(cy / VIEW_H) * 100}%`;
  });

  svg.addEventListener('pointerleave', hide);
}