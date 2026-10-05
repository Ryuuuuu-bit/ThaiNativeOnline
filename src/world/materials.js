import * as THREE from 'three';
import { materialColors, goldMaterial, defaultRoughness } from './data/palette.js';

export const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: defaultRoughness, ...extra });

/** Shared building/nature materials keyed by name (see data/palette.js). */
export const materials = Object.fromEntries(Object.entries(materialColors).map(([name, color]) => [name, mat(color)]));
materials.gold = mat(goldMaterial.color, { metalness: goldMaterial.metalness, roughness: goldMaterial.roughness });
