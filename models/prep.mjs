// Prepara el GLB oficial de NASA: lo descomprime (Draco), quita animaciones/skin,
// quita extensiones PBR pesadas (transmission, clearcoat...), y recoloca el modelo:
// Y arriba, origen en el suelo y centrado entre las ruedas, escala en metros, mira a +Z.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const [src = 'source/perseverance-nasa.glb', dst = 'source/rover-prep.glb'] = process.argv.slice(2);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.listScenes()[0];
doc.createExtension(KHRDracoMeshCompression).dispose(); // escribir sin Draco

// 1) Sin animaciones ni skin (la app lo muestra estatico)
root.listAnimations().forEach((a) => a.dispose());
const skinned = root.listNodes().filter((n) => n.getSkin());
const armatures = new Set(skinned.flatMap((n) => n.getParentNode() ? [n.getParentNode()] : []));
skinned.forEach((n) => n.dispose());
armatures.forEach((n) => n.dispose());
root.listSkins().forEach((s) => s.dispose());

// 2) Materiales ligeros: MeshStandardMaterial en three.js (sin pase de transmision)
const physical = ['KHR_materials_transmission', 'KHR_materials_clearcoat', 'KHR_materials_specular', 'KHR_materials_ior'];
for (const m of root.listMaterials()) {
  const glass = /glass/i.test(m.getName());
  if (glass) { // cristal -> oscuro opaco
    m.setBaseColorTexture(null).setBaseColorFactor([0.04, 0.06, 0.08, 1]).setMetallicFactor(0.3).setRoughnessFactor(0.15);
  }
}

// quitar las extensiones del documento (y con ellas sus propiedades en cada material)
root.listExtensionsUsed().filter((e) => physical.includes(e.extensionName)).forEach((e) => e.dispose());

// 3) Origen en el suelo, centrado entre las ruedas
const wheels = root.listNodes().find((n) => n.getName() === 'Wheels_objs');
const wb = getBounds(wheels);
const cx = (wb.min[0] + wb.max[0]) / 2, cz = (wb.min[2] + wb.max[2]) / 2, y0 = wb.min[1];
const holder = doc.createNode('Rover').setTranslation([-cx, -y0, -cz]);
scene.listChildren().forEach((c) => { scene.removeChild(c); holder.addChild(c); });
scene.addChild(holder);

await io.write(dst, doc);
const b = getBounds(scene);
console.log('shift', [-cx, -y0, -cz].map((v) => +v.toFixed(3)), 'bbox min', b.min.map((v) => +v.toFixed(2)), 'max', b.max.map((v) => +v.toFixed(2)));
