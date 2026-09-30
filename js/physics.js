/**
 * Moteur de simulation balistique 2D (vol dans un plan vertical) pour fusée.
 * Intégration numérique par Runge-Kutta d'ordre 4.
 *
 * Équations utilisées :
 *  - Newton :        m·a = T + D + W
 *  - Traînée :       D = -0.5 · ρ(y) · |v| · v · Cd · A   (vectorielle)
 *  - Atmosphère :    ρ(y) = ρ0 · exp(-y / H)
 *  - Pesanteur :     g(y) = g0 · (R / (R + y))²
 *  - Débit massique :ṁ = -T / (Isp · g0)
 *  - Tsiolkovsky :   Δv = Isp · g0 · ln(m0 / mf)
 *
 * Configuration de lancement :
 *  - launchAngle : inclinaison depuis la verticale (°). 0 = tir vertical.
 *  - railLength  : longueur de guidage (m). 0 = lancement libre.
 *
 * Hypothèse de vol libre : le vecteur poussée reste aligné sur la vitesse,
 * car la marge statique positive fait que la fusée s'aligne sur sa trajectoire.
 *
 * @module physics
 */

/** Pesanteur standard (m/s²). */
export const G0 = 9.80665;
/** Rayon moyen terrestre (m). */
export const R_EARTH = 6371000;
/** Masse volumique de l'air au niveau de la mer (kg/m³). */
export const RHO0 = 1.225;
/** Hauteur d'échelle atmosphérique (m). */
export const H_SCALE = 8500;
/** Vitesse du son au niveau de la mer (m/s). */
export const C_SOUND = 340;

/**
 * Pesanteur en fonction de l'altitude.
 * @param {number} y Altitude (m)
 * @returns {number} Accélération (m/s²)
 */
export function gravityAt(y) {
  const ratio = R_EARTH / (R_EARTH + Math.max(y, -R_EARTH * 0.5));
  return G0 * ratio * ratio;
}

/**
 * Masse volumique de l'air — atmosphère isotherme.
 * @param {number} y Altitude (m)
 * @returns {number} Masse volumique (kg/m³)
 */
export function densityAt(y) {
  if (y <= 0) return RHO0;
  return RHO0 * Math.exp(-y / H_SCALE);
}

/**
 * Vecteur unitaire de la direction de lancement.
 * 0° = vertical vers le haut, 90° = horizontal.
 * @param {number} angleDeg
 * @returns {{x: number, y: number}}
 */
export function launchDirection(angleDeg) {
  const a = (Math.max(0, Math.min(90, angleDeg)) * Math.PI) / 180;
  return { x: Math.sin(a), y: Math.cos(a) };
}

/**
 * @typedef {Object} RocketConfig
 * @property {string} name
 * @property {number} dryMass
 * @property {number} propellantMass
 * @property {number} diameter
 * @property {number} cd
 * @property {number} thrust
 * @property {number} burnTime
 * @property {number} isp
 * @property {number} [launchAngle=0] Inclinaison depuis la verticale (°)
 * @property {number} [railLength=0]  Longueur de guidage (m)
 */

/**
 * @typedef {Object} Sample
 * @property {number} t
 * @property {number} x    Distance horizontale (m)
 * @property {number} y    Altitude (m)
 * @property {number} vx   Vitesse horizontale (m/s)
 * @property {number} vy   Vitesse verticale (m/s)
 * @property {number} v    Norme de la vitesse (m/s)
 * @property {number} a    Norme de l'accélération (m/s²)
 * @property {number} m    Masse (kg)
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
 * @property {number} downrange
 * @property {number} launchTime
 */

/**
 * Normalise et borne la configuration.
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
    isp: Math.max(1, Number(cfg.isp) || 100),
    launchAngle: Math.max(0, Math.min(80, Number(cfg.launchAngle) || 0)),
    railLength: Math.max(0, Number(cfg.railLength) || 0)
  };
}

/**
 * Masse courante à l'instant t (combustion linéaire).
 * @param {number} t
 * @param {RocketConfig} cfg
 * @param {number} m0
 * @param {number} mdot
 * @returns {number}
 */
function massAt(t, cfg, m0, mdot) {
  if (t >= cfg.burnTime) return cfg.dryMass;
  return Math.max(cfg.dryMass, m0 - mdot * t);
}

/**
 * Accélération en vol libre (2D). Poussée alignée sur la vitesse.
 * @returns {[number, number]}
 */
function accelFree(t, x, y, vx, vy, m, cfg) {
  const speed = Math.hypot(vx, vy);
  const area = Math.PI * (cfg.diameter / 2) ** 2;
  const thrust = t < cfg.burnTime ? cfg.thrust : 0;

  let ux;
  let uy;
  if (speed > 1e-3) {
    ux = vx / speed;
    uy = vy / speed;
  } else {
    const d = launchDirection(cfg.launchAngle);
    ux = d.x;
    uy = d.y;
  }

  const dragMag = -0.5 * densityAt(y) * speed * cfg.cd * area;
  const ax = (thrust * ux + dragMag * vx) / m;
  const ay = (thrust * uy + dragMag * vy - m * gravityAt(y)) / m;
  return [ax, ay];
}

/**
 * Accélération sur la rampe : mouvement contraint à la direction de lancement.
 * @returns {[number, number]}
 */
function accelRail(t, x, y, vx, vy, m, cfg, dir) {
  const speedAlong = vx * dir.x + vy * dir.y;
  const area = Math.PI * (cfg.diameter / 2) ** 2;
  const thrust = t < cfg.burnTime ? cfg.thrust : 0;
  const dragMag = -0.5 * densityAt(y) * Math.abs(speedAlong) * speedAlong * cfg.cd * area;
  const fParallel = thrust + dragMag - m * gravityAt(y) * dir.y;
  const aParallel = fParallel / m;
  return [aParallel * dir.x, aParallel * dir.y];
}

/**
 * Dérivée de l'état [x, y, vx, vy].
 */
function derivative(t, state, cfg, m0, mdot) {
  const [x, y, vx, vy] = state;
  const m = massAt(t, cfg, m0, mdot);
  const dir = launchDirection(cfg.launchAngle);
  const proj = x * dir.x + y * dir.y;
  const onRail = cfg.railLength > 1e-6 && proj < cfg.railLength - 1e-6;
  const [ax, ay] = onRail
    ? accelRail(t, x, y, vx, vy, m, cfg, dir)
    : accelFree(t, x, y, vx, vy, m, cfg);
  return [vx, vy, ax, ay];
}

/**
 * Une étape de Runge-Kutta d'ordre 4.
 * @param {number} t
 * @param {number[]} s
 * @param {number} dt
 * @returns {number[]}
 */
function rk4Step(t, s, dt, cfg, m0, mdot) {
  const k1 = derivative(t, s, cfg, m0, mdot);
  const s2 = s.map((v, i) => v + 0.5 * dt * k1[i]);
  const k2 = derivative(t + 0.5 * dt, s2, cfg, m0, mdot);
  const s3 = s.map((v, i) => v + 0.5 * dt * k2[i]);
  const k3 = derivative(t + 0.5 * dt, s3, cfg, m0, mdot);
  const s4 = s.map((v, i) => v + dt * k3[i]);
  const k4 = derivative(t + dt, s4, cfg, m0, mdot);
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Réduit le nombre d'échantillons pour l'affichage.
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
 * Simule le vol complet.
 * @param {RocketConfig} config
 * @param {number} [dt=0.01] Pas de temps (s)
 * @param {number} [maxT=600] Durée max (s)
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
  /** @type {number[]} */
  let state = [0, 0, 0, 0];
  let apogee = 0;
  let apogeeTime = 0;
  let maxSpeed = 0;
  let maxAccel = 0;
  let maxMach = 0;
  let launchTime = null;
  let maxX = 0;
  let nextSample = 0;

  while (t < maxT) {
    const [x, y, vx, vy] = state;
    const m = massAt(t, cfg, m0, mdot);
    const speed = Math.hypot(vx, vy);
    const dir = launchDirection(cfg.launchAngle);
    const proj = x * dir.x + y * dir.y;
    const onRail = cfg.railLength > 1e-6 && proj < cfg.railLength - 1e-6;
    const [ax, ay] = onRail
      ? accelRail(t, x, y, vx, vy, m, cfg, dir)
      : accelFree(t, x, y, vx, vy, m, cfg);
    const aMag = Math.hypot(ax, ay);

    if (t >= nextSample - 1e-9) {
      raw.push({ t, x, y, vx, vy, v: speed, a: aMag, m, mach: speed / C_SOUND });
      nextSample += sampleDt;
    }

    if (y > apogee) { apogee = y; apogeeTime = t; }
    if (speed > maxSpeed) maxSpeed = speed;
    if (aMag > maxAccel) maxAccel = aMag;
    if (speed / C_SOUND > maxMach) maxMach = speed / C_SOUND;
    if (x > maxX) maxX = x;
    if (launchTime === null && y > 0.01) launchTime = t;

    state = rk4Step(t, state, dt, cfg, m0, mdot);
    t += dt;

    if (state[1] < 0) {
      state[1] = 0;
      if (state[3] < 0) state[3] = 0;
    }

    if (launchTime !== null && state[1] <= 0 && state[3] < 0) break;
    if (launchTime === null && t > 5) break;
    if (!Number.isFinite(state[0]) || !Number.isFinite(state[1]) ||
        !Number.isFinite(state[2]) || !Number.isFinite(state[3])) break;
  }

  const [fx, fy, fvx, fvy] = state;
  const fv = Math.hypot(fvx, fvy);
  const fm = massAt(t, cfg, m0, mdot);
  const fdir = launchDirection(cfg.launchAngle);
  const fproj = fx * fdir.x + fy * fdir.y;
  const fonRail = cfg.railLength > 1e-6 && fproj < cfg.railLength - 1e-6;
  const [fax, fay] = fonRail
    ? accelRail(t, fx, fy, fvx, fvy, fm, cfg, fdir)
    : accelFree(t, fx, fy, fvx, fvy, fm, cfg);

  raw.push({
    t, x: fx, y: Math.max(0, fy), vx: fvx, vy: fvy, v: fv,
    a: Math.hypot(fax, fay), m: fm, mach: fv / C_SOUND
  });

  return {
    samples: downsample(raw, 2500),
    apogee: Math.max(0, apogee),
    apogeeTime,
    maxVelocity: maxSpeed,
    maxAcceleration: maxAccel,
    flightTime: t,
    maxMach,
    deltaV: cfg.isp * G0 * Math.log(m0 / cfg.dryMass),
    downrange: Math.max(maxX, fx),
    launchTime: launchTime ?? 0
  };
}