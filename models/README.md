# Modelos 3D (rover Perseverance)

Origen oficial: NASA/JPL-Caltech (repo `nasa/NASA-3D-Resources`). Necesita Node 18+. Desde `models/`:

```bash
mkdir -p source && curl -L -o source/perseverance-nasa.glb "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Mars%202020%20Perseverance%20Rover/Mars%202020%20Perseverance%20Rover.glb"
npm install && node prep.mjs   # descomprime Draco, quita animaciones/transmission, centra en el suelo -> source/rover-prep.glb
npx -y @gltf-transform/cli optimize source/rover-prep.glb ../docs/assets/rover.glb --compress quantize --texture-compress webp --texture-size 1024 --simplify-ratio 0.3 --simplify-error 0.003
npx -y @gltf-transform/cli optimize source/rover-prep.glb ../docs/assets/rover-lite.glb --compress quantize --texture-compress webp --texture-size 512 --simplify-ratio 0.07 --simplify-error 0.015
npx -y @gltf-transform/cli inspect ../docs/assets/rover.glb   # comprobar tamaño y triángulos
```

Sin Draco ni meshopt (no hace falta decodificador). Orientación: Y arriba, escala en metros (~3 m), origen en el suelo entre las ruedas, el frente (brazo) mira a +Z.
`models/source/` está en `.gitignore`.
