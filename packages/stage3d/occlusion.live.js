// The silhouette of three.js meshes on the screen: what occlusion.core.js turns into a shape. A live file (it needs three).

/**
 * The meshes' own vertices through the camera as canvas px [[x, y], …] (y down): what three drew, read on demand (a layout, a
 * check), not every frame. Call after the meshes' world matrices are current.
 * @param {any} THREE  the module loadThree() resolved
 * @param {{ wc: number, hc: number }} frame  the canvas size in CSS px
 */
export function projectMeshes(THREE, camera, meshes, { wc, hc }) {
  const V = new THREE.Vector3(), pts = [];
  for (const mesh of meshes) {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { V.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(camera); pts.push([(V.x * 0.5 + 0.5) * wc, (1 - (V.y * 0.5 + 0.5)) * hc]); }
  }
  return pts;
}
