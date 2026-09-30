/**
 * Analyse heuristique de la fusée et de son vol.
 * Ne remplace pas une validation experte — signale les erreurs fréquentes.
 * @module advisor
 */

/**
 * @typedef {'ok'|'info'|'warn'|'danger'} Severity
 *
 * @typedef {Object} Advice
 * @property {Severity} severity
 * @property {string} title
 * @property {string} message
 * @property {string} [hint] Suggestion concrète
 */

/** Seuils de référence pour un vol amateur stable. */
export const T = {
  twrMin: 1.5,
  twrIdealMin: 3,
  twrIdealMax: 12,
  twrMax: 20,
  elongationMin: 8,
  elongationMax: 30,
  propFracMin: 0.3,
  propFracMax: 0.6,
  railExitSpeedMin: 15,
  finSpanRatioMin: 0.35,
  finSpanRatioMax: 1.2,
  wallRatioMin: 0.015,
  wallRatioMax: 0.08,
  payloadFracMax: 0.25
};

/**
 * Classe un niveau de sévérité.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {Severity}
 */
function rate(value, min, max) {
  if (value < min || value > max) return 'danger';
  return 'ok';
}

/**
 * Construit une liste d'advices pour le VOL (simulateur).
 * @param {import('./physics.js').RocketConfig} cfg
 * @param {import('./physics.js').SimulationResult} r
 * @returns {Advice[]}
 */
export function analyzeFlight(cfg, r) {
  /** @type {Advice[]} */
  const a = [];

  const m0 = cfg.dryMass + cfg.propellantMass;
  const twr = cfg.thrust > 0 ? cfg.thrust / (m0 * 9.80665) : 0;

  // --- TWR au décollage ---
  if (twr < 1) {
    a.push({
      severity: 'danger',
      title: 'Ne décolle pas',
      message: `Rapport poussée/poids = ${twr.toFixed(2)}. La fusée est trop lourde pour ce moteur.`,
      hint: 'Augmentez la poussée, réduisez la masse à vide, ou retirez de la charge utile.'
    });
  } else if (twr < T.twrMin) {
    a.push({
      severity: 'warn',
      title: 'Décollage lent',
      message: `TWR = ${twr.toFixed(2)}. La fusée quittera à peine la rampe.`,
      hint: 'Visez un TWR entre 3 et 12.'
    });
  } else if (twr > T.twrMax) {
    a.push({
      severity: 'warn',
      title: 'Accélération très violente',
      message: `TWR = ${twr.toFixed(2)}. Les contraintes structurelles seront importantes.`,
      hint: 'Renforcez le collage coiffe/corps et vérifiez la tenue des ailerettes.'
    });
  } else if (twr >= T.twrIdealMin && twr <= T.twrIdealMax) {
    a.push({
      severity: 'ok',
      title: 'Poussée équilibrée',
      message: `TWR = ${twr.toFixed(2)}, dans la plage recommandée (3–12).`
    });
  }

  // --- Fraction propulsive ---
  const propFrac = m0 > 0 ? cfg.propellantMass / m0 : 0;
  if (propFrac < T.propFracMin && cfg.propellantMass > 0) {
    a.push({
      severity: 'info',
      title: 'Peu de propergol',
      message: `Le propergol représente ${(propFrac * 100).toFixed(0)} % de la masse totale.`,
      hint: 'Pour un gain significatif d’apogée, allégez plutôt la structure que d’ajouter du carburant.'
    });
  } else if (propFrac > T.propFracMax) {
    a.push({
      severity: 'warn',
      title: 'Structure très légère',
      message: `Le propergol représente ${(propFrac * 100).toFixed(0)} % de la masse — structure très sollicitée.`,
      hint: 'Vérifiez l’épaisseur de paroi et le collage.'
    });
  }

  // --- Vitesse de sortie de rampe ---
  const railLen = cfg.railLength ?? 0;
  if (railLen > 0 && twr > 1) {
    const aRail = cfg.thrust / m0 - 9.80665 * Math.cos(((cfg.launchAngle ?? 0) * Math.PI) / 180);
    const vExit = Math.sqrt(Math.max(0, 2 * aRail * railLen));
    if (vExit < T.railExitSpeedMin) {
      a.push({
        severity: 'danger',
        title: 'Vitesse de sortie de rampe insuffisante',
        message: `À la sortie du guidage (${railLen.toFixed(1)} m), la vitesse est d’environ ${vExit.toFixed(1)} m/s.`,
        hint: 'Allongez la rampe ou augmentez la poussée : en dessous de ~15 m/s la fusée peut retomber sur la rampe.'
      });
    } else {
      a.push({
        severity: 'ok',
        title: 'Guidage suffisant',
        message: `Vitesse de sortie de rampe estimée : ${vExit.toFixed(1)} m/s.`
      });
    }
  }

  // --- Apogée ---
  if (r.apogee < 20 && twr >= 1) {
    a.push({
      severity: 'warn',
      title: 'Vol très bas',
      message: `Apogée = ${r.apogee.toFixed(1)} m.`,
      hint: 'Vérifiez le Cd (trop élevé ?) et l’Isp.'
    });
  } else if (r.apogee > 3000) {
    a.push({
      severity: 'info',
      title: 'Vol au-delà du domaine de validité',
      message: `Apogée = ${r.apogee.toFixed(0)} m. Au-delà de 3 km, l’atmosphère isotherme simple perd en précision.`,
      hint: 'Prenez la valeur avec une marge. Référez-vous à OpenRocket pour un vol de cette ampleur.'
    });
  }

  // --- Mach ---
  if (r.maxMach > 0.8 && r.maxMach < 1.2) {
    a.push({
      severity: 'warn',
      title: 'Vol transsonique',
      message: `Mach max = ${r.maxMach.toFixed(2)}. Le Cd réel augmente brutalement autour de Mach 1.`,
      hint: 'Le modèle suppose un Cd constant : la vitesse et l’apogée réelles seront plus faibles.'
    });
  } else if (r.maxMach >= 1.2) {
    a.push({
      severity: 'warn',
      title: 'Vol supersonique',
      message: `Mach max = ${r.maxMach.toFixed(2)}. Modèle peu fiable dans ce régime.`
    });
  }

  // --- Angle + guidage ---
  const angle = cfg.launchAngle ?? 0;
  if (angle > 20 && railLen < 1) {
    a.push({
      severity: 'danger',
      title: 'Tir incliné sans guidage',
      message: `Angle = ${angle.toFixed(0)}° mais pas de rampe. La trajectoire initiale est imprévisible.`,
      hint: 'Une fusée inclinée DOIT disposer d’un guidage sur au moins 1 mètre.'
    });
  }

  // --- Isp cohérente ---
  if (cfg.isp >= 180 && cfg.propellantMass > 0) {
    a.push({
      severity: 'info',
      title: 'Isp élevée pour un amateur',
      message: `Isp = ${cfg.isp} s. Les propergols solides amateurs plafonnent vers 130–150 s.`,
      hint: 'Vérifiez votre valeur ou justifiez avec un propergol composite plus performant.'
    });
  }

  return a;
}

/**
 * Construit une liste d’advices pour la STRUCTURE (builder).
 * @param {ReturnType<import('./structure.js').collect>} input
 * @param {ReturnType<import('./structure.js').computeStructure>} model
 * @returns {Advice[]}
 */
export function analyzeStructure(input, model) {
  /** @type {Advice[]} */
  const a = [];
  const { body, nose, fins, motor, payload } = input;

  // --- Marge statique ---
  if (model.margin < 0) {
    a.push({
      severity: 'danger',
      title: 'Fusée instable',
      message: `Marge statique négative (${model.margin.toFixed(2)}). Le CP est devant le CG.`,
      hint: 'Ajoutez du poids en pointe, agrandissez les ailerettes, ou reculez le moteur.'
    });
  } else if (model.margin < 0.5) {
    a.push({
      severity: 'danger',
      title: 'Marge statique trop faible',
      message: `${model.margin.toFixed(2)} calibre. Risque de culbute.`,
      hint: 'Visez au moins 1 calibre.'
    });
  } else if (model.margin < 1) {
    a.push({
      severity: 'warn',
      title: 'Marge statique limite',
      message: `${model.margin.toFixed(2)} calibre. Tolérable mais sensible au vent.`
    });
  } else if (model.margin > 4) {
    a.push({
      severity: 'info',
      title: 'Marge statique très importante',
      message: `${model.margin.toFixed(2)} calibres. La fusée sera très stable mais sensible au vent latéral (elle "pointe dans le vent").`,
      hint: 'Une marge de 1 à 2 calibres suffit.'
    });
  } else {
    a.push({
      severity: 'ok',
      title: 'Marge statique correcte',
      message: `${model.margin.toFixed(2)} calibre(s).`
    });
  }

  // --- Élancement ---
  const totalLen = body.length + nose.length;
  const refD = model.diameter;
  const elong = refD > 0 ? totalLen / refD : 0;
  if (elong < T.elongationMin && elong > 0) {
    a.push({
      severity: 'warn',
      title: 'Fusée trop trapue',
      message: `Élancement = ${elong.toFixed(1)} (longueur / diamètre).`,
      hint: 'Visez entre 10 et 20. Une fusée courte est plus dure à stabiliser.'
    });
  } else if (elong > T.elongationMax) {
    a.push({
      severity: 'warn',
      title: 'Fusée très élancée',
      message: `Élancement = ${elong.toFixed(1)}. Risque de flambage en poussée forte.`,
      hint: 'Réduisez la longueur ou augmentez le diamètre.'
    });
  } else if (elong >= 10 && elong <= 20) {
    a.push({
      severity: 'ok',
      title: 'Élancement correct',
      message: `${elong.toFixed(1)} — dans la plage 10–20.`
    });
  }

  // --- Épaisseur de paroi ---
  if (body.length > 0 && body.diameter > 0 && body.thickness > 0) {
    const ratio = body.thickness / body.diameter;
    if (ratio < T.wallRatioMin) {
      a.push({
        severity: 'warn',
        title: 'Paroi très fine',
        message: `Épaisseur / diamètre = ${(ratio * 100).toFixed(1)} %.`,
        hint: 'Une paroi trop fine flambe au décollage. Visez 2 à 5 %.'
      });
    }
  }

  // --- Fraction propulsive / payload ---
  const totalMass = model.totalMass;
  const payloadFrac = totalMass > 0 ? payload.mass / totalMass : 0;
  if (payloadFrac > T.payloadFracMax) {
    a.push({
      severity: 'info',
      title: 'Charge utile importante',
      message: `La charge utile pèse ${(payloadFrac * 100).toFixed(0)} % de la masse totale.`,
      hint: 'Au-delà de 25 %, la performance chute fortement.'
    });
  }

  // --- Position du moteur / CG ---
  if (motor.mass > 0 && motor.position > 0) {
    if (motor.position > model.cg) {
      a.push({
        severity: 'warn',
        title: 'Moteur au-dessus du CG',
        message: `Le moteur (position ${(motor.position * 100).toFixed(1)} cm) est devant le CG (${(model.cg * 100).toFixed(1)} cm).`,
        hint: 'Le moteur doit être à l’arrière, derrière le CG.'
      });
    }
  }

  // --- Nombre d’ailerettes ---
  if (fins.count === 0) {
    if (model.margin >= 2) {
      a.push({
        severity: 'info',
        title: 'Fusée sans ailerettes',
        message: 'Marge statique suffisante pour se passer d’ailerettes.',
        hint: 'Sans ailerettes, la fusée reste très sensible au vent : elles restent recommandées.'
      });
    }
    // Cas margin < 2 déjà couvert par la marge statique
  } else if (fins.count === 2) {
    a.push({
      severity: 'warn',
      title: 'Deux ailerettes',
      message: 'Configuration rarement stable : la symétrie est difficile à garantir.',
      hint: '3 ou 4 ailerettes donnent un vol plus régulier.'
    });
  } else if (fins.count > 6) {
    a.push({
      severity: 'info',
      title: 'Beaucoup d’ailerettes',
      message: `${fins.count} ailerettes. Surcharge pondérale et traînée supplémentaires.`,
      hint: '3 ou 4 suffisent pour la quasi-totalité des fusées amateur.'
    });
  }

  // --- Ratio d’envergure ---
  if (fins.count > 0 && refD > 0) {
    const spanRatio = fins.width / refD;
    if (spanRatio < T.finSpanRatioMin) {
      a.push({
        severity: 'warn',
        title: 'Ailerettes courtes',
        message: `Envergure / diamètre = ${spanRatio.toFixed(2)}.`,
        hint: 'Trop courtes, elles stabilisent peu. Visez 0,5 à 1× le diamètre.'
      });
    } else if (spanRatio > T.finSpanRatioMax) {
      a.push({
        severity: 'info',
        title: 'Ailerettes très larges',
        message: `Envergure / diamètre = ${spanRatio.toFixed(2)}. Ajoute la traînée et de la masse.`,
        hint: 'Au-delà de 1× le diamètre, le gain marginal est faible.'
      });
    }
  }

  return a;
}

/**
 * Trie les advices par sévérité (danger → warn → info → ok).
 * @param {Advice[]} advices
 * @returns {Advice[]}
 */
export function sortAdvices(advices) {
  const order = { danger: 0, warn: 1, info: 2, ok: 3 };
  return [...advices].sort((x, y) => order[x.severity] - order[y.severity]);
}

/**
 * Affiche les advices dans un conteneur DOM.
 * @param {HTMLElement} host
 * @param {Advice[]} advices
 */
export function renderAdvices(host, advices) {
  host.textContent = '';
  if (advices.length === 0) return;

  const sorted = sortAdvices(advices);
  const counts = { danger: 0, warn: 0, info: 0, ok: 0 };
  for (const adv of advices) counts[adv.severity]++;

  const summary = document.createElement('div');
  summary.className = 'advisor-summary';
  const summaryParts = [];
  if (counts.danger) summaryParts.push(`<span data-sev="danger">${counts.danger} critique${counts.danger > 1 ? 's' : ''}</span>`);
  if (counts.warn) summaryParts.push(`<span data-sev="warn">${counts.warn} à surveiller</span>`);
  if (counts.info) summaryParts.push(`<span data-sev="info">${counts.info} information${counts.info > 1 ? 's' : ''}</span>`);
  if (counts.ok && summaryParts.length === 0) summaryParts.push(`<span data-sev="ok">Tout est bon</span>`);
  summary.innerHTML = summaryParts.join(' · ');
  host.appendChild(summary);

  const list = document.createElement('ul');
  list.className = 'advisor-list';

  for (const adv of sorted) {
    const li = document.createElement('li');
    li.className = 'advisor-item';
    li.dataset.sev = adv.severity;

    const head = document.createElement('div');
    head.className = 'advisor-head';
    head.textContent = adv.title;
    li.appendChild(head);

    const msg = document.createElement('p');
    msg.className = 'advisor-msg';
    msg.textContent = adv.message;
    li.appendChild(msg);

    if (adv.hint) {
      const hint = document.createElement('p');
      hint.className = 'advisor-hint';
      hint.textContent = '→ ' + adv.hint;
      li.appendChild(hint);
    }

    list.appendChild(li);
  }
  host.appendChild(list);
}