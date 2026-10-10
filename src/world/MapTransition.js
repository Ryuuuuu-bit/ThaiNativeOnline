// Load off-scene before releasing the playable map. Failed loads never commit.
export async function transitionMap(manager, portal, to, delay) {
  if (manager.busy || !to) return false;
  manager.busy = true;
  manager.armed = false;
  const from = manager.map;
  let prepared;
  try {
    manager.onLeave({ map: from, to });
    manager.fade(true, to);
    await delay(300);
    const started = performance.now();
    prepared = await manager.prepare(to.id);
    manager.unload();
    manager.install(prepared);
    prepared = null;
    manager.place(portal.arrive);
    manager.lastTravelMs = Math.round(performance.now() - started);
    manager.onChange({ map: manager.map, world: manager.world, npcs: manager.npcs, from });
    manager.lastTravelError = null;
    return true;
  } catch (error) {
    try {
      prepared?.npcs?.dispose();
      prepared?.world.dispose();
    } catch (cleanupError) { console.error('Prepared map cleanup failed', cleanupError); }
    manager.lastTravelError = error;
    console.error('Map transition failed', error);
    return false;
  } finally {
    manager.busy = false;
    manager.fade(false);
  }
}
