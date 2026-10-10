// Combat takes place on XZ. Projectile artwork and monster height must not make
// an otherwise aligned impact miss the target's ground position.
export const nearXZ = (a, b, radius) => Math.hypot(a.x - b.x, a.z - b.z) <= radius;
