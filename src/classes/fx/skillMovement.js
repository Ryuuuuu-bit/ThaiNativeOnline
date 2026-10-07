// Sweep skill displacement instead of teleporting the avatar inside scenery.
export function moveSkillPlayer(position, x, z, canStand = () => true) {
  const dx = x - position.x, dz = z - position.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
  for (let i = 0; i < steps; i++) {
    const nx = position.x + dx / steps, nz = position.z + dz / steps;
    if (canStand(nx, nz)) { position.x = nx; position.z = nz; }
    else {
      let moved = false;
      if (canStand(nx, position.z)) { position.x = nx; moved = true; }
      if (canStand(position.x, nz)) { position.z = nz; moved = true; }
      if (!moved) break;
    }
  }
}
