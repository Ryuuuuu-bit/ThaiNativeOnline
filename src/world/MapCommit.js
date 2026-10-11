// DOM-free commit seam: retain the previous world until the destination render succeeds.
export async function commitPreparedMap(manager, prepared, arrival, from) {
  const previous = { map: manager.map, world: manager.world, npcs: manager.npcs, portals: manager.portals,
    hunting: manager.hunting, respawn: { ...manager.respawn } };
  const position = { x: manager.player.position.x, z: manager.player.position.z, facing: manager.player.group.rotation.y };
  const run = manager.loadingRun;
  previous.world.root.visible = false;
  try {
    manager.install(prepared);
    manager.place(arrival);
    manager.onChange({ map: manager.map, world: manager.world, npcs: manager.npcs, from });
    run?.start('render');
    await manager.renderReady();
    run?.complete('render');
  } catch (error) {
    prepared.world.root.removeFromParent();
    manager.install(previous);
    previous.world.root.visible = true;
    manager.place(position);
    manager.onChange({ map: manager.map, world: manager.world, npcs: manager.npcs, from: prepared.map });
    throw error;
  }
  manager.releaseMonsters(prepared.map.id);
  // Readiness has committed; cleanup and optional connectivity must not dispose
  // the destination or present a false asset failure after that point.
  try { previous.npcs.dispose(); previous.world.dispose(); }
  catch (error) { console.error('Previous map cleanup failed', error); }
  try { manager.onCommitted?.(prepared.map); }
  catch (error) { console.error('Optional map connectivity failed', error); }
}
