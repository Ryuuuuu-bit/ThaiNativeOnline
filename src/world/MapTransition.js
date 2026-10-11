// Load off-scene before releasing the playable map. Failed loads never commit.
export async function transitionMap(manager, portal, to, delay) {
  if (manager.busy || !to) return false;
  manager.busy = true;
  manager.armed = false;
  const from = manager.map;
  let prepared;
  let run;
  try {
    manager.onLeave({ map: from, to });
    manager.fade(true, to);
    run = manager.loadingRun ?? manager.loadingScreen;
    run?.start('map');
    await delay(300);
    const started = performance.now();
    prepared = await manager.prepare(to.id);
    run?.complete('map');
    if (manager.commitPrepared) await manager.commitPrepared(prepared, portal.arrive, from);
    else {
      manager.unload();
      manager.install(prepared);
      manager.place(portal.arrive);
      manager.onChange({ map: manager.map, world: manager.world, npcs: manager.npcs, from });
      run?.start('render');
      await manager.renderReady?.();
      run?.complete('render');
    }
    prepared = null;
    manager.lastTravelMs = Math.round(performance.now() - started);
    manager.lastTravelError = null;
    return true;
  } catch (error) {
    try {
      prepared?.npcs?.dispose();
      prepared?.world.dispose();
    } catch (cleanupError) { console.error('Prepared map cleanup failed', cleanupError); }
    manager.lastTravelError = error;
    run?.fail('ไม่สามารถเตรียมแผนที่ได้ กรุณาลองใหม่', {
      retry: () => manager.travel(portal),
      cancel: () => {
        manager.armed = false;
        if (manager.overlay) { manager.overlay.style.opacity = '0'; manager.overlay.style.pointerEvents = 'none'; }
      },
    });
    console.error('Map transition failed', error);
    return false;
  } finally {
    manager.busy = false;
    manager.fade(false);
  }
}
