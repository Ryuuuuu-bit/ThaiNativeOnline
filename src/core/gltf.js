// The one GLTF loader for the game's models. Every .glb under public/models is packed with
// gltfpack (tools/models/pack-glb.mjs): quantised attributes (KHR_mesh_quantization) and
// meshopt-compressed buffers (EXT_meshopt_compression), about a third of the plain file, so a
// loader needs the meshopt decoder or those files fail to parse. Plain .glb files load too.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export function gltfLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}
