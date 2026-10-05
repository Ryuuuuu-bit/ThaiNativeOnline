// Movement step maths on plain {x, z} objects. Pure logic: no Three.js (runs under node --test).

export const ARRIVE_DISTANCE = .14;

/**
 * One movement tick, mirroring the original main.js movePlayer:
 *  - a non-zero input direction overrides the click destination;
 *  - otherwise head for the destination, arriving within ARRIVE_DISTANCE;
 *  - try the full step, else slide along x and/or z independently.
 *
 * @param {object} a
 * @param {{x:number,z:number}} a.position      current position (not mutated)
 * @param {{x:number,z:number}|null} a.input    world-space XZ direction, may be zero/null
 * @param {{x:number,z:number}|null} a.destination
 * @param {number} a.speed   units per second
 * @param {number} a.dt      seconds
 * @param {(x:number,z:number)=>boolean} a.canStand
 * @returns {{ x, z, moved, blocked, arrived, direction: {x,z}|null, clearDestination: boolean }}
 *   direction is the normalised heading (null when standing still).
 *   blocked: a destination walk could not move at all (destination should be dropped).
 */
export function stepMovement({ position, input, destination, speed, dt, canStand }) {
  let dx = input ? input.x || 0 : 0, dz = input ? input.z || 0 : 0;
  const result = { x: position.x, z: position.z, moved: false, blocked: false, arrived: false, direction: null, clearDestination: false };

  if (destination && dx * dx + dz * dz === 0) {
    dx = destination.x - position.x; dz = destination.z - position.z;
    if (Math.hypot(dx, dz) < ARRIVE_DISTANCE) {
      result.arrived = true; result.clearDestination = true;
      return result;
    }
  }
  const length = Math.hypot(dx, dz);
  if (length === 0) return result;
  dx /= length; dz /= length;
  result.direction = { x: dx, z: dz };

  const step = speed * dt;
  const x = position.x + dx * step, z = position.z + dz * step;
  if (canStand(x, z)) { result.x = x; result.z = z; result.moved = true; }
  else {
    if (canStand(x, result.z)) { result.x = x; result.moved = true; }
    if (canStand(result.x, z)) { result.z = z; result.moved = true; }
  }
  if (!result.moved && destination) { result.blocked = true; result.clearDestination = true; }
  return result;
}

/** Heading (rotation.y) for a normalised XZ direction; the model faces +z. */
export function headingFor(direction) { return Math.atan2(direction.x, direction.z); }
