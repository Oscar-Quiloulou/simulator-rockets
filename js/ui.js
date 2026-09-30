/**
 * Helpers DOM minimalistes (création, écoute, debounce, formatage).
 * @module ui
 */

/**
 * Sélectionne un élément unique.
 * @template {Element} T
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {T}
 */
export function $(selector, root = document) {
  return /** @type {T} */ (root.querySelector(selector));
}

/**
 * Sélectionne tous les éléments correspondants.
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {Element[]}
 */
export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Crée un élément HTML avec attributs et enfants.
 * @param {string} tag
 * @param {Record<string, string|number|boolean|null|undefined>} [attrs={}]
 * @param {(Node|string)[]} [children=[]]
 * @returns {HTMLElement}
 */
export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children) {
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/**
 * Attache un écouteur d'événement et renvoie la fonction de détachement.
 * @param {EventTarget} target
 * @param {string} type
 * @param {EventListenerOrEventListenerObject} handler
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {() => void}
 */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/**
 * Retarde l'exécution d'une fonction jusqu'à une accalmie.
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} [delay=200]
 * @returns {F}
 */
export function debounce(fn, delay = 200) {
  let timer = 0;
  return /** @type {F} */ (
    (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    }
  );
}

/**
 * Formate un nombre à la française, avec notation scientifique pour les extrêmes.
 * @param {number} value
 * @param {number} [digits=1]
 * @returns {string}
 */
export function fmt(value, digits = 1) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return value.toExponential(2);
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}