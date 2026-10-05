// Player movement controller (click-to-move + keyboard). Does not import
// Three.js: it only reads/writes .x/.y/.z of the player's group, so it also
// runs under node --test with a stub player.
import { stepMovement, headingFor } from './steering.js';

/**
 * @param {object} o
 * @param {{ group: { position, rotation }, stats: { moveSpeed }, update(time, moving) }} o.player
 * @param {(x:number, z:number) => boolean} o.canStand
 * @param {(x:number, z:number) => number} o.groundHeight
 */
export function createMovementController({ player, canStand, groundHeight }) {
  if (!player || !player.group) throw new Error('createMovementController: player with .group required');
  if (typeof canStand !== 'function' || typeof groundHeight !== 'function') {
    throw new Error('createMovementController: canStand and groundHeight functions required');
  }
  let destination = null;

  return {
    /** Accepts a THREE.Vector3 (or any {x, y, z}); the value is copied. null clears it. */
    setDestination(point) {
      destination = point ? { x: point.x, y: point.y ?? 0, z: point.z } : null;
    },
    hasDestination() { return destination !== null; },
    /** Copy of the current destination, or null. */
    getDestination() { return destination ? { ...destination } : null; },

    /**
     * @param {number} dt seconds since last frame
     * @param {number} elapsed total time, forwarded to player.update for animation
     * @param {{x:number, z:number}} [inputDirection] world-space XZ, may be zero
     * @returns {{ moved: boolean, blocked: boolean, arrived: boolean }}
     *   blocked: a destination walk could not move (destination has been cleared;
     *   main.js shows the toast and hides the marker). arrived: destination reached
     *   this frame (destination cleared; hide the marker).
     */
    update(dt, elapsed, inputDirection) {
      const p = player.group.position;
      const step = stepMovement({
        position: p, input: inputDirection, destination,
        speed: player.stats.moveSpeed, dt, canStand,
      });
      if (step.clearDestination) destination = null;
      if (!step.direction) {
        player.update(elapsed, false);
        return { moved: false, blocked: false, arrived: step.arrived };
      }
      p.x = step.x; p.z = step.z;
      p.y = groundHeight(p.x, p.z);
      player.group.rotation.y = headingFor(step.direction);
      player.update(elapsed, step.moved);
      return { moved: step.moved, blocked: step.blocked, arrived: false };
    },
  };
}
