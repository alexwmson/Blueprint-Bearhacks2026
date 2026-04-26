import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { PARTS_LIBRARY_PATH, buildLdrString } from '../lib/partsMap.js';

const CAMERA_PRESETS = {
  front: new THREE.Vector3(0, 0.5, 1),
  side:  new THREE.Vector3(1, 0.5, 0),
  top:   new THREE.Vector3(0, 1, 0.1),
};

/**
 * Dim a Three.js object's materials to simulate "placed in previous step".
 * Full-color pieces stay at opacity 1.0; dimmed pieces drop to 0.35.
 */
function applyHighlight(object, isHighlighted) {
  object.traverse((child) => {
    if (child.isMesh || child.isLineSegments) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (isHighlighted) {
          mat.opacity = 1.0;
          mat.transparent = mat.opacity < 1;
          if (mat.color && mat._originalColor) {
            mat.color.copy(mat._originalColor);
          }
        } else {
          if (!mat._originalColor && mat.color) {
            mat._originalColor = mat.color.clone();
          }
          mat.opacity = 0.35;
          mat.transparent = true;
          if (mat.color) {
            mat.color.lerp(new THREE.Color(0x888888), 0.5);
          }
        }
        mat.needsUpdate = true;
      });
    }
  });
}

/**
 * LDrawViewer — reusable Three.js + LDrawLoader renderer.
 *
 * Props:
 *   pieces      {Array}   Array of piece objects { description, x, y, z, rotation, highlight? }
 *   interactive {boolean} Enable OrbitControls (default false)
 *   cameraHint  {string}  "front" | "top" | "side" (default "front")
 *   width       {string}  CSS width (default "100%")
 *   height      {string}  CSS height (default "300px")
 *   className   {string}  Additional CSS class
 *   onLoad      {func}    Called when model finishes loading
 */
export default function LDrawViewer({
  pieces = [],
  interactive = false,
  cameraHint = 'front',
  width = '100%',
  height = '300px',
  className = '',
  onLoad,
}) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);
  const modelRef = useRef(null);
  // Incremented every time we start a new load; callbacks check against this
  // to discard results from superseded in-flight loads.
  const loadIdRef = useRef(0);

  const dispose = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (controlsRef.current) controlsRef.current.dispose();
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.domElement.remove();
    }
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    controlsRef.current = null;
    modelRef.current = null;
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Clear any previous renderer
    dispose();

    const w = mount.clientWidth || 400;
    const h = mount.clientHeight || 300;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-100, -50, -100);
    scene.add(fillLight);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enabled = interactive;
    controlsRef.current = controls;

    // Animation loop.
    // IMPORTANT: RAF is scheduled at the END so a throw inside r.render()
    // stops the loop instead of infinitely re-queuing a broken frame.
    function animate() {
      const r = rendererRef.current;
      const s = sceneRef.current;
      const c = cameraRef.current;
      const ctrl = controlsRef.current;

      // If the component has been disposed, stop the loop.
      if (!r || !s || !c) return;

      if (interactive && ctrl) ctrl.update();

      try {
        r.render(s, c);
      } catch (err) {
        console.error('[LDrawViewer] render crash — scanning scene for null materials:', err);
        // The crash is `object.material.visible` when LDrawLoader assigns null
        // for a color code not present in the material library. Find and patch
        // those meshes so the render loop can recover.
        const FALLBACK_MAT = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        let patchCount = 0;
        s.traverse((obj) => {
          if ((obj.isMesh || obj.isLine || obj.isPoints) && obj.material == null) {
            console.warn('[LDrawViewer] null material on', obj.name || obj.type,
              'userData:', obj.userData);
            obj.material = FALLBACK_MAT;
            patchCount++;
          }
        });
        if (patchCount === 0) {
          console.error('[LDrawViewer] no null materials found — stopping loop to prevent spam.');
          return;
        }
        console.warn(`[LDrawViewer] patched ${patchCount} null material(s) — resuming.`);
      }

      // Re-queue only after a successful (or recovered) frame.
      animFrameRef.current = requestAnimationFrame(animate);
    }
    animFrameRef.current = requestAnimationFrame(animate);

    // Resize observer
    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload model whenever pieces change
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera) return;

    // Remove old model
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    if (!pieces || pieces.length === 0) return;

    const ldrString = buildLdrString(pieces);

    // Stamp this load so stale callbacks from a previous load are ignored
    const loadId = ++loadIdRef.current;

    const loader = new LDrawLoader();
    loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    loader.smoothNormals = true;
    loader.setPartsLibraryPath(PARTS_LIBRARY_PATH);

    function onModelLoaded(group) {
      // Discard if a newer load has already started
      if (loadId !== loadIdRef.current) return;

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!scene || !camera) return;

      // LDraw coordinate system has -Y up; rotate 180° around X to correct
      group.rotation.x = Math.PI;
      scene.add(group);
      modelRef.current = group;

      // Apply highlight/dim per piece index
      const pieceHighlights = pieces.map((p) => p.highlight !== false);
      let meshIndex = 0;
      group.traverse((child) => {
        if (child.isGroup && child !== group) {
          applyHighlight(child, pieceHighlights[meshIndex] !== false);
          meshIndex++;
        }
      });

      // Fit camera to model bounding box
      const bbox = new THREE.Box3().setFromObject(group);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) * 0.5;

      const dir = (CAMERA_PRESETS[cameraHint] || CAMERA_PRESETS.front).clone().normalize();
      camera.position.copy(center).addScaledVector(dir, radius * 3.5);
      camera.lookAt(center);

      if (controls) {
        controls.target.copy(center);
        controls.update();
      }

      if (onLoad) onLoad();
    }

    function onModelError(err) {
      if (loadId !== loadIdRef.current) return;

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      console.warn('[LDrawViewer] LDrawLoader failed, using fallback geometry.');
      console.warn('[LDrawViewer]', err?.message || err);
      if (scene && camera) {
        renderFallbackCubes(scene, pieces, camera, controls, cameraHint);
      }
      if (onLoad) onLoad();
    }

    // preloadMaterials loads LDConfig.ldr which defines all standard LEGO color
    // codes. Without this, getMaterial() returns null for codes like 1 (Blue)
    // or 9 (Light Blue), causing Three.js to crash on mesh.material.visible.
    loader
      .preloadMaterials('/ldraw/LDConfig.ldr')
      .catch(() => {
        // If LDConfig.ldr is missing, fall back to the minimal seed so at
        // least codes 16 and 24 are defined and the render loop won't crash.
        console.warn('[LDrawViewer] LDConfig.ldr not found — colours may be wrong');
        loader.setMaterials([]);
      })
      .finally(() => {
        if (loadId !== loadIdRef.current) return;
        try {
          loader.parse(ldrString, onModelLoaded, onModelError);
        } catch (err) {
          onModelError(err);
        }
      });
  }, [pieces, cameraHint]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width, height, position: 'relative', overflow: 'hidden' }}
    />
  );
}

/**
 * Render simple colored boxes as a fallback when LDraw part files are not available.
 * Boxes are sized proportionally based on the piece description (e.g. "2x4 brick").
 */
function renderFallbackCubes(scene, pieces, camera, controls, cameraHint) {
  const colorMap = {
    red: 0xe84040, blue: 0x3a7bdd, yellow: 0xf5c518, green: 0x3dba4e,
    white: 0xf0f0f0, black: 0x222222, gray: 0x888888, grey: 0x888888,
    orange: 0xf58220, purple: 0x9b59b6, brown: 0x8b5a2b, tan: 0xd2b48c,
    pink: 0xff69b4, lime: 0x80e040,
  };

  const group = new THREE.Group();

  pieces.forEach((piece) => {
    const desc = (piece.description || '').toLowerCase();
    const sizeMatch = desc.match(/(\d+)x(\d+)/);
    const studsW = sizeMatch ? parseInt(sizeMatch[1]) : 2;
    const studsD = sizeMatch ? parseInt(sizeMatch[2]) : 4;
    const isPlate = desc.includes('plate') || desc.includes('tile');
    const brickH = isPlate ? 8 : 24;

    const colorKey = Object.keys(colorMap).find((c) => desc.startsWith(c));
    const color = colorKey ? colorMap[colorKey] : 0xcccccc;

    const geo = new THREE.BoxGeometry(studsW * 20, brickH, studsD * 20);
    const mat = new THREE.MeshPhongMaterial({
      color,
      opacity: piece.highlight === false ? 0.35 : 1.0,
      transparent: piece.highlight === false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // LDraw Y is inverted; fallback uses same coordinate system
    mesh.position.set(piece.x ?? 0, -(piece.y ?? 0), piece.z ?? 0);
    mesh.rotation.y = ((piece.rotation ?? 0) * Math.PI) / 180;
    group.add(mesh);
  });

  group.rotation.x = 0;
  scene.add(group);

  const bbox = new THREE.Box3().setFromObject(group);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 60;

  const dir = (CAMERA_PRESETS[cameraHint] || CAMERA_PRESETS.front).clone().normalize();
  camera.position.copy(center).addScaledVector(dir, radius * 3.5);
  camera.lookAt(center);
  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
}
