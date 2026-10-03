// The names of three.js the stage3d tier uses, and nothing else. `npx esbuild` bundles this file against the pinned
// three (0.186.1) into three.named.js (see PROVENANCE.md for the exact command). Add a name here only when a piece
// needs it, rebuild, and record the new size there.
export {
  WebGLRenderer, LinearSRGBColorSpace, Texture, NoColorSpace, LinearFilter, ClampToEdgeWrapping, WebGLRenderTarget,
  LinearMipmapLinearFilter, ShaderMaterial, Vector3, Scene, Mesh, PlaneGeometry, Camera, Vector2, PerspectiveCamera,
  // the turning pot (B5): a lathe and a torus and a tube, lit by two lights
  Group, LatheGeometry, TorusGeometry, CylinderGeometry, MeshLambertMaterial, AmbientLight, DirectionalLight, Color, DoubleSide,
} from 'three';
