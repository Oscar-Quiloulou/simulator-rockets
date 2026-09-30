/**
 * Moteur de simulation balistique 1D (vol vertical) pour fusée artisanale.
 * Intégration numérique par Runge-Kutta d'ordre 4.
 *
 * Équations utilisées :
 *  - Newton :        m·a = T + D + W
 *  - Traînée :       D = -0.5 · ρ(y) · v · |v| · Cd · A
 *  - Atmosphère :    ρ(y) = ρ0 · exp(-y / H)
 *  - Pesanteur :     g(y) = g0 · (R / (R + y))²
 *  - Débit massique :ṁ = -T / (Isp · g0)
 *  - Tsiolkovsky :   Δv = Isp · g0 · ln(m0 / mf)
 *
 * @module physics
 */

/** Pesanteur standard au niveau de la mer (m/s²). */
export const G0 = 9.80665;
/** Rayon moyen de la Terre (m). */
export const R_EARTH = 6371000;
/** Masse volumique de l'air au niveau de la mer (kg/m³). */
export const RHO0 = 1.225;
/** Hauteur d'échelle de l'atmosphère isotherme (m). */
export const H_SCALE = 8500;
/** Vitesse du son au niveau de la mer (m/s). */
export const C_SOUND = 340;

/**
 * @typedef {Object} RocketConfig
 * @property {string} name            Nom de la fusée
 * @property {number} dryMass         Masse à vide (kg)
 * @property {number} propellantMass  Masse de propergol (kg)
 * @property {number} diameter        Diamètre du corps (m)
 * @property {number} cd              Coefficient de traînée
 * @property {number} thrust          Poussée moyenne (N)
 * @property {number} burnTime        Durée de combustion (s)
 * @property {number} isp             Impulsion spécifique (s)
 */

/**
 * @typedef {Object} Sample
 * @property {number} t    Instant (s)
 * @property {number} y    Altitude (m)
 * @property {number} v    Vitesse verticale (m/s)
 * @property {number} a    Accélération verticale (m/s²)
 * @property {number} m    Masse courante (kg)
 * @property {number} mach Nombre de Mach
 */

/**
 * @typedef {Object} SimulationResult
 * @property {Sample[]} samples
 * @property {number} apogee
 * @property {number} apogeeTime
 * @property {number} maxVelocity
 * @property {number} maxAcceleration
 * @property {number} flightTime
 * @property {number} maxMach
 * @property {number} deltaV
 */

/**
 * Pesanteur en fonction de l'altitude — loi de gravitation newtonienne.
 * @param {number} y Altitude (m)
 * @returns {number} Accélération de la pesanteur (m/s²)
 */
export function gravityAt(y) {
  const ratio = R_EARTH / (R_EARTH + Math.max(y, -R_EARTH * 0.5));
  return G0 * ratio * ratio;
}

/**
 * Masse volumique de l'air — modèle d'atmosphère isotherme exponentiel.
 * @param {number} y Altitude (m)
 * @returns {number} Masse volumique (kg/m³)
 */
export function densityAt(y) {
  if (y <= 0) return RHO0;
  return RHO0 * Math.exp(-y / H_SCALE);
}

/**
 * Normalise et borne une configuration utilisateur.
 * @param {Partial<RocketConfig>} cfg
 * @returns {RocketConfig}
 */
function normalizeConfig(cfg) {
  return {
    name: String(cfg.name ?? 'Fusée'),
    dryMass: Math.max(0.001, Number(cfg.dryMass) || 0.001),
    propellantMass: Math.max(0, Number(cfg.propellantMass) || 0),
    diameter: Math.max(0.005, Number(cfg.diameter) || 0.05),
    cd: Math.max(0.01, Number(cfg.cd) || 0.5),
    thrust: Math.max(0, Number(cfg.thrust) || 0),
    burnTime: Math.max(0, Number(cfg.burnTime) || 0),
    isp: Math.max(1, Number(cfg.isp) || 100)
  };
}

/**
 * Masse courante de la fusée à l'instant t (combustion linéaire).
 * @param {number} t
 * @param {RocketConfig} cfg
 * @param {number} m0 Masse totale initiale (kg)
 * @param {number} mdot Débit massique (kg/s)
 * @returns {number}
 */
function massAt(t, cfg, m0, mdot) {
  if (t >= cfg.burnTime) return cfg.dryMass;
  return Math.max(cfg.dryMass, m0 - mdot * t);
}

/**
 * Accélération verticale : m·a = T + D + W.
 * @param {number} t
 * @param {number} y
 * @param {number} v
 * @param {number} m
 * @param {RocketConfig} cfg
 * @returns {number} Accélération (m/s²)
 */
function accelAt(t, y, v, m, cfg) {
  const area = Math.PI * (cfg.diameter / 2) ** 2;
  const thrust = t < cfg.burnTime ? cfg.thrust : 0;
  const drag = -0.5 * densityAt(y) * v * Math.abs(v) * cfg.cd * area;
  const weight = -m * gravityAt(y);
  return (thrust + drag + weight) / m;
}

/**
 * Dérivée de l'état [y, v] pour l'intégrateur.
 * @param {number} t
 * @param {[number, number]} state
 * @param {RocketConfig} cfg
 * @param {number} m0
 * @param {number} mdot
 * @returns {[number, number]}
 */
function derivative(t, state, cfg, m0, mdot) {
  const m = massAt(t, cfg, m0, mdot);
  return [state[1], accelAt(t, state[0], state[1], m, cfg)];
}

/**
 * Une étape de Runge-Kutta d'ordre 4.
 * @param {number} t
 * @param {[number, number]} s
 * @param {number} dt
 * @param {RocketConfig} cfg
 * @param {number} m0
 * @param {number} mdot
 * @returns {[number, number]} Nouvel état
 */
function rk4Step(t, s, dt, cfg, m0, mdot) {
  const k1 = derivative(t, s, cfg, m0, mdot);

  const s2 = [s[0] + 0.5 * dt * k1[0], s[1] + 0.5 * dt * k1[1]];
  const k2 = derivative(t + 0.5 * dt, s2, cfg, m0, mdot);

  const s3 = [s[0] + 0.5 * dt * k2[0], s[1] + 0.5 * dt * k2[1]];
  const k3 = derivative(t + 0.5 * dt, s3, cfg, m0, mdot);

  const s4 = [s[0] + dt * k3[0], s[1] + dt * k3[1]];
  const k4 = derivative(t + dt, s4, cfg, m0, mdot);

  return [
    s[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    s[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
  ];
}

/**
 * Réduit le nombre d'échantillons pour l'affichage graphique.
 * @param {Sample[]} samples
 * @param {number} maxPoints
 * @returns {Sample[]}
 */
function downsample(samples, maxPoints) {
  if (samples.length <= maxPoints) return samples;
  const stride = Math.ceil(samples.length / maxPoints);
  const out = [];
  for (let i = 0; i < samples.length; i += stride) out.push(samples[i]);
  const last = samples[samples.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Simule le vol vertical complet d'une fusée.
 * @param {RocketConfig} config Configuration de la fusée
 * @param {number} [dt=0.01] Pas de temps (s)
 * @param {number} [maxT=600] Durée maximale simulée (s)
 * @returns {SimulationResult}
 */
export function simulate(config, dt = 0.01, maxT = 600) {
  const cfg = normalizeConfig(config);
  const m0 = cfg.dryMass + cfg.propellantMass;
  const mdot = cfg.burnTime > 0 && cfg.thrust > 0 ? cfg.thrust / (cfg.isp * G0) : 0;
  const sampleDt = 0.02;

  /** @type {Sample[]} */
  const raw = [];

  let t = 0;
  let y = 0;
  let v = 0;
  let apogee = 0;
  let apogeeTime = 0;
  let maxVelocity = 0;
  let maxAcceleration = -Infinity;
  let maxMach = 0;
  let airborne = false;
  let nextSample = 0;

  while (t < maxT) {
    const m = massAt(t, cfg, m0, mdot);
    const a = accelAt(t, y, v, m, cfg);

    if (t >= nextSample - 1e-9) {
      raw.push({ t, y, v, a, m, mach: Math.abs(v) / C_SOUND });
      nextSample += sampleDt;
    }

    if (y > apogee) {
      apogee = y;
      apogeeTime = t;
    }
    const speed = Math.abs(v);
    if (speed > maxVelocity) maxVelocity = speed;
    if (a > maxAcceleration) maxAcceleration = a;
    if (speed / C_SOUND > maxMach) maxMach = speed / C_SOUND;

    const next = rk4Step(t, [y, v], dt, cfg, m0, mdot);
    t += dt;
    y = next[0];
    v = next[1];

    if (y > 1e-6) airborne = true;
    if (airborne && y <= 0 && v < 0) {
      y = 0;
      break;
    }
    if (!airborne && t > 1) break;
    if (!Number.isFinite(y) || !Number.isFinite(v)) {
      y = 0;
      v = 0;
      break;
    }
  }

  const yEnd = Math.max(0, y);
  const mEnd = massAt(t, cfg, m0, mdot);
  raw.push({
    t,
    y: yEnd,
    v,
    a: accelAt(t, yEnd, v, mEnd, cfg),
    m: mEnd,
    mach: Math.abs(v) / C_SOUND
  });

  return {
    samples: downsample(raw, 2500),
    apogee: Math.max(0, apogee),
    apogeeTime,
    maxVelocity,
    maxAcceleration: Number.isFinite(maxAcceleration) ? maxAcceleration : 0,
    flightTime: t,
    maxMach,
    deltaV: cfg.isp * G0 * Math.log(m0 / cfg.dryMass)
  };
}