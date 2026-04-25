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

    // Animation loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      if (interactive) controls.update();
      renderer.render(scene, camera);
    }
    animate();

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
    const dataUrl = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(ldrString)))}`;

    const loader = new LDrawLoader();
    loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    loader.smoothNormals = true;
    loader.setPartsLibraryPath(PARTS_LIBRARY_PATH);

    loader.load(
      dataUrl,
      (group) => {
        // LDraw uses inverted Y — rotate 180° around X
        group.rotation.x = Math.PI;
        scene.add(group);
        modelRef.current = group;

        // Apply highlight/dim per piece
        const pieceHighlights = pieces.map((p) => p.highlight !== false);
        let meshIndex = 0;
        group.traverse((child) => {
          if (child.isGroup && child !== group) {
            const highlighted = pieceHighlights[meshIndex] !== false;
            applyHighlight(child, highlighted);
            meshIndex++;
          }
        });

        // Fit camera to model
        const bbox = new THREE.Box3().setFromObject(group);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) * 0.5;

        const dir = (CAMERA_PRESETS[cameraHint] || CAMERA_PRESETS.front).clone().normalize();
        const distance = radius * 3.5;

        camera.position.copy(center).addScaledVector(dir, distance);
        camera.lookAt(center);

        if (controls) {
          controls.target.copy(center);
          controls.update();
        }

        if (onLoad) onLoad();
      },
      undefined,
      (err) => {
        console.warn('LDrawLoader error (parts library may not be populated yet):', err);
        // Show a placeholder cube so the UI doesn't feel broken
        renderFallbackCubes(scene, pieces, camera, controls, cameraHint);
        if (onLoad) onLoad();
      }
    );
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
