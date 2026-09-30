/**
 * Fusées pré-remplies pour le simulateur.
 * Les valeurs sont des ordres de grandeur réalistes pour l'amateurisme.
 * @module presets
 */

/**
 * @typedef {Object} Preset
 * @property {string} id
 * @property {string} label
 * @property {import('./physics.js').RocketConfig} config
 */

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: 'candy-20',
    label: 'Candy rocket PVC 20 mm (KNO3 + sorbitol)',
    config: {
      name: 'Candy PVC 20 mm',
      dryMass: 0.12,
      propellantMass: 0.05,
      diameter: 0.025,
      cd: 0.5,
      thrust: 40,
      burnTime: 1.2,
      isp: 110
    }
  },
  {
    id: 'candy-40',
    label: 'Candy rocket PVC 40 mm (KNO3 + sorbitol)',
    config: {
      name: 'Candy PVC 40 mm',
      dryMass: 0.45,
      propellantMass: 0.35,
      diameter: 0.042,
      cd: 0.5,
      thrust: 180,
      burnTime: 1.8,
      isp: 110
    }
  },
  {
    id: 'water-1l5',
    label: 'Fusée à eau (bouteille 1,5 L)',
    config: {
      name: 'Fusée à eau 1,5 L',
      dryMass: 0.12,
      propellantMass: 0.5,
      diameter: 0.09,
      cd: 0.4,
      thrust: 90,
      burnTime: 0.3,
      isp: 15
    }
  },
  {
    id: 'estes-c6',
    label: 'Moteur Estes C6 (fusée légère)',
    config: {
      name: 'Estes C6',
      dryMass: 0.045,
      propellantMass: 0.0108,
      diameter: 0.024,
      cd: 0.45,
      thrust: 4.74,
      burnTime: 1.6,
      isp: 80
    }
  },
  {
    id: 'experimental-63',
    label: 'Fusée expérimentale PVC 63 mm',
    config: {
      name: 'Expérimentale 63 mm',
      dryMass: 1.6,
      propellantMass: 1.8,
      diameter: 0.063,
      cd: 0.5,
      thrust: 700,
      burnTime: 2.5,
      isp: 125
    }
  }
];

/**
 * Recherche un preset par identifiant.
 * @param {string} id
 * @returns {Preset | undefined}
 */
export function getPreset(id) {
  return PRESETS.find((preset) => preset.id === id);
}