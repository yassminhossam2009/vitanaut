import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GARDEN_ELEMENT_META } from '../data/nasaResources.ts';
import { MISSION_LANDSCAPES } from '../data/missionLandscapes.ts';
import { CrewState, GardenElement, MissionId } from '../types.ts';
import { birdAudio } from '../utils/birdAudio.ts';
import {
  build3DBird,
  build3DFlower,
  build3DLakeWithLantern,
  build3DStoneCairn,
  build3DTree,
  buildMissionIsland,
  groundHeightAt,
  ISLAND_THEMES,
} from './landscape3d/buildDiorama.ts';

interface LandscapePageProps {
  crewState: CrewState;
  onChangeMission: (missionId: MissionId) => void;
  onGoToTasks: () => void;
}

const ELEMENT_SHORT_LABELS: Record<GardenElement, string> = {
  [GardenElement.TREE]: 'Tree',
  [GardenElement.STONE]: 'Stone Cairn',
  [GardenElement.FLOWER]: 'Wildflower',
  [GardenElement.SUNBEAM]: 'Lake & Circadian Lantern',
  [GardenElement.BIRD]: 'Songbird',
};

const TREE_SLOTS: Array<[number, number]> = [
  [-2.6, -1.8],
  [2.5, -1.7],
  [-3.2, 0.7],
  [3.0, 1.1],
  [-1.1, -3.1],
  [1.3, -3.0],
  [-2.2, 2.7],
  [2.2, 2.6],
  [0.0, -3.8],
  [-3.8, -0.7],
  [3.8, -0.4],
  [0.2, 3.6],
];

const STONE_SLOTS: Array<[number, number]> = [
  [-1.7, 1.5],
  [2.0, 0.1],
  [-0.9, 2.5],
  [1.4, -1.5],
  [-2.7, -0.4],
  [2.8, 2.1],
  [-1.9, -2.5],
  [0.4, -2.3],
  [3.3, -1.3],
  [-3.4, 1.8],
];

const FLOWER_SLOTS: Array<[number, number]> = [
  [1.2, 1.4],
  [-0.8, 1.3],
  [1.8, -0.8],
  [-1.5, -1.0],
  [0.6, 2.4],
  [-2.1, 0.5],
  [2.5, 0.8],
  [-0.3, -1.7],
  [1.1, -2.4],
  [-2.7, 1.9],
  [2.9, -1.8],
  [0.1, 3.0],
];

const LAKE_SLOTS: Array<[number, number, number]> = [
  [0.0, 0.2, 1.05],
  [-1.85, 2.0, 0.72],
  [2.05, 1.95, 0.68],
  [0.1, -2.15, 0.65],
];

export const LandscapePage: React.FC<LandscapePageProps> = ({
  crewState,
  onChangeMission,
  onGoToTasks,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);

  const [selectedElement, setSelectedElement] = useState<GardenElement | null>(
    null
  );
  const [hoveredInfo, setHoveredInfo] = useState<{
    element: GardenElement;
    x: number;
    y: number;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const mission = MISSION_LANDSCAPES[crewState.missionId];

  const elementCounts = useMemo(() => {
    const counts: Record<GardenElement, number> = {
      [GardenElement.STONE]: 0,
      [GardenElement.BIRD]: 0,
      [GardenElement.FLOWER]: 0,
      [GardenElement.SUNBEAM]: 0,
      [GardenElement.TREE]: 0,
    };

    for (const log of crewState.history) {
      counts[log.gardenElement] = (counts[log.gardenElement] ?? 0) + 1;
    }
    for (const hab of crewState.habits) {
      if (hab.completedToday) {
        counts[hab.gardenElement] = (counts[hab.gardenElement] ?? 0) + 1;
      }
    }
    return counts;
  }, [crewState.history, crewState.habits]);

  const treeCount = Math.min(TREE_SLOTS.length, Math.max(1, elementCounts[GardenElement.TREE] + 1));
  const stoneCount = Math.min(STONE_SLOTS.length, Math.max(1, elementCounts[GardenElement.STONE] + 1));
  const flowerCount = Math.min(FLOWER_SLOTS.length, Math.max(2, elementCounts[GardenElement.FLOWER] + 1));
  const lakeCount = Math.min(LAKE_SLOTS.length, Math.max(1, elementCounts[GardenElement.SUNBEAM]));
  const birdCount = Math.min(7, Math.max(1, elementCounts[GardenElement.BIRD]));

  useEffect(() => {
    return () => {
      birdAudio.stop();
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const theme = ISLAND_THEMES[crewState.missionId];
    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 620;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.skyHex);
    scene.fog = new THREE.FogExp2(theme.fogHex, 0.018);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);
    const defaultCamPos = new THREE.Vector3(8.2, 6.8, 8.6);
    camera.position.copy(defaultCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.4, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5.5;
    controls.maxDistance = 19;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.25;
    controls.autoRotate = !isSoftwareGl;
    controls.autoRotateSpeed = 0.4;
    controls.update();

    resetCameraRef.current = () => {
      camera.position.copy(defaultCamPos);
      controls.target.set(0, 0.4, 0);
      controls.update();
    };

    // Moody Aerospace 3-Point Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      theme.hemiSkyColor,
      theme.hemiGroundColor,
      0.72
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(theme.keyLightColor, 1.85);
    keyLight.position.set(7.5, 11, 5.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-8, 4, -7);
    scene.add(rimLight);

    const disposables: Array<{ dispose: () => void }> = [envTex];
    const dioramaRoot = new THREE.Group();
    scene.add(dioramaRoot);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const islandBuilt = buildMissionIsland(crewState.missionId, maxAniso);
    dioramaRoot.add(islandBuilt.group);
    disposables.push(...islandBuilt.disposables);

    const interactiveObjects: THREE.Object3D[] = [];

    const waterMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < lakeCount; i++) {
      const [lx, lz, lr] = LAKE_SLOTS[i];
      const { group, waterMesh } = build3DLakeWithLantern(theme, lr, disposables);
      const y = groundHeightAt(lx, lz, crewState.missionId);
      group.position.set(lx, y - 0.02, lz);
      dioramaRoot.add(group);
      interactiveObjects.push(group);
      waterMeshes.push(waterMesh);
    }

    for (let i = 0; i < treeCount; i++) {
      const [tx, tz] = TREE_SLOTS[i];
      const tree = build3DTree(100 + i * 37, disposables);
      tree.position.set(tx, groundHeightAt(tx, tz, crewState.missionId), tz);
      dioramaRoot.add(tree);
      interactiveObjects.push(tree);
    }

    for (let i = 0; i < stoneCount; i++) {
      const [sx, sz] = STONE_SLOTS[i];
      const cairn = build3DStoneCairn(500 + i * 53, disposables);
      cairn.position.set(sx, groundHeightAt(sx, sz, crewState.missionId), sz);
      dioramaRoot.add(cairn);
      interactiveObjects.push(cairn);
    }

    for (let i = 0; i < flowerCount; i++) {
      const [fx, fz] = FLOWER_SLOTS[i];
      const flower = build3DFlower(900 + i * 71, disposables);
      flower.position.set(fx, groundHeightAt(fx, fz, crewState.missionId), fz);
      dioramaRoot.add(flower);
      interactiveObjects.push(flower);
    }

    const animatedBirds: Array<{
      group: THREE.Group;
      leftWing: THREE.Mesh;
      rightWing: THREE.Mesh;
      radius: number;
      speed: number;
      phase: number;
      altitude: number;
    }> = [];
    for (let i = 0; i < birdCount; i++) {
      const builtBird = build3DBird(1400 + i * 89, disposables);
      const radius = 1.6 + (i % 3) * 0.95;
      const altitude = 2.1 + (i % 3) * 0.55;
      const phase = (i / Math.max(1, birdCount)) * Math.PI * 2;
      builtBird.group.position.set(
        Math.cos(phase) * radius,
        altitude,
        Math.sin(phase) * radius
      );
      dioramaRoot.add(builtBird.group);
      interactiveObjects.push(builtBird.group);
      animatedBirds.push({
        ...builtBird,
        radius,
        speed: 0.42 + (i % 3) * 0.12,
        phase,
        altitude,
      });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster for hover tooltip & click inspection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 35) return;
      lastHoverCheck = now;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveObjects, true);
      if (hits.length > 0) {
        const el = hits[0].object.userData.gardenElement as GardenElement | undefined;
        if (el) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredInfo({
            element: el,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
          return;
        }
      }
      renderer.domElement.style.cursor = 'grab';
      setHoveredInfo(null);
    };

    const onPointerLeave = () => {
      renderer.domElement.style.cursor = 'grab';
      setHoveredInfo(null);
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveObjects, true);
      if (hits.length > 0) {
        const el = hits[0].object.userData.gardenElement as GardenElement | undefined;
        if (el) {
          setSelectedElement(el);
          setDockCollapsed(false);
          if (el === GardenElement.BIRD) {
            birdAudio.playSingleChirp();
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1000;
      const h = container.clientHeight || 620;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let disposed = false;
    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const elapsed = clock.getElapsedTime();

      dioramaRoot.position.y = Math.sin(elapsed * 0.8) * 0.08;

      for (let i = 0; i < waterMeshes.length; i++) {
        waterMeshes[i].position.y = 0.04 + Math.sin(elapsed * 2.1 + i) * 0.008;
      }

      for (const b of animatedBirds) {
        const t = elapsed * b.speed + b.phase;
        const nx = Math.cos(t) * b.radius;
        const nz = Math.sin(t) * b.radius;
        const ny = b.altitude + Math.sin(elapsed * 2.2 + b.phase) * 0.14;
        b.group.position.set(nx, ny, nz);
        b.group.rotation.y = -t;
        const flap = Math.sin(elapsed * 11 + b.phase) * 0.55;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
    };
  }, [
    crewState.missionId,
    treeCount,
    stoneCount,
    flowerCount,
    lakeCount,
    birdCount,
  ]);

  const toggleSound = () => {
    if (soundEnabled) {
      birdAudio.stop();
      setSoundEnabled(false);
    } else {
      birdAudio.start(birdCount);
      setSoundEnabled(true);
    }
  };

  const inspectElement = (el: GardenElement) => {
    setSelectedElement((prev) => (prev === el ? null : el));
    if (el === GardenElement.BIRD) {
      birdAudio.playSingleChirp();
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-66px)] min-h-[560px] overflow-hidden bg-[#050B18]">
      {/* Isolated Full-Viewport 3D WebGL Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#0B1724] text-white">
          <div className="max-w-md text-center space-y-2">
            <h2 className="text-lg font-bold">3D Viewport Unavailable</h2>
            <p className="text-sm text-slate-300">
              WebGL context could not be initialized on this browser. Please enable hardware acceleration or reload the tab.
            </p>
          </div>
        </div>
      )}

      {/* Hover Rectangular Tooltip Box for 3D Elements */}
      {hoveredInfo && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg bg-[#091521]/95 border border-[#334E68] px-3.5 py-2 shadow-xl max-w-[240px]"
          style={{
            left: Math.min(hoveredInfo.x + 14, (mountRef.current?.clientWidth ?? 900) - 255),
            top: Math.max(12, hoveredInfo.y - 68),
          }}
        >
          <div className="text-xs font-bold text-[#FEF08A]">
            {ELEMENT_SHORT_LABELS[hoveredInfo.element]}
          </div>
          <div className="text-xs text-slate-100 mt-0.5">
            Represents: <strong className="text-[#86EFAC]">{GARDEN_ELEMENT_META[hoveredInfo.element].represents}</strong>
          </div>
        </div>
      )}

      {/* Minimal Top-Left Mission Spec Badge */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="pointer-events-auto px-3.5 py-2 rounded-xl bg-[#0B1724]/88 border border-[#2A3F54] text-xs shadow-sm flex items-center gap-3 text-slate-100">
          <span className="font-bold text-white">{mission.shortName}</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-[#7DD3FC]">{mission.gravity}</span>
          <span className="hidden sm:inline text-slate-400">·</span>
          <span className="hidden sm:inline text-slate-300">
            Hover any 3D object to see what it represents
          </span>
        </div>
      </div>

      {/* Unified Collapsible Bottom Control Dock */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-20 w-[min(940px,94vw)] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1.5 px-3.5 py-1 rounded-t-xl rounded-b-md bg-[#0B1724]/92 border border-[#2A3F54] text-[11px] font-semibold text-slate-100 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Garden Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full rounded-2xl bg-[#0B1724]/92 border border-[#2A3F54] shadow-xl p-3.5 sm:p-4 space-y-3 text-slate-100">
            {selectedElement && (
              <div className="p-3 rounded-xl bg-[#112233] border border-[#2A435C] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-white">
                    {GARDEN_ELEMENT_META[selectedElement].pluralName}
                  </span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="font-semibold text-[#86EFAC]">
                    {GARDEN_ELEMENT_META[selectedElement].represents}
                  </span>
                  <p className="text-slate-300 mt-0.5">
                    {GARDEN_ELEMENT_META[selectedElement].description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGoToTasks}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Grow More
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Mission Ground Switcher */}
              <div className="flex flex-wrap items-center gap-1.5">
                {Object.values(MISSION_LANDSCAPES).map((m) => {
                  const active = m.id === crewState.missionId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChangeMission(m.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#0284C7] text-white border-[#38BDF8]'
                          : 'bg-[#112233] text-slate-200 border-[#2A3F54] hover:border-[#38BDF8]'
                      }`}
                    >
                      {m.shortName}
                    </button>
                  );
                })}
              </div>

              {/* Audio + Reset View */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                    soundEnabled
                      ? 'bg-[#15803D] text-white border-[#4ADE80]'
                      : 'bg-[#112233] text-[#86EFAC] border-[#2A4A3E] hover:bg-[#17332A]'
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                  <span>{soundEnabled ? 'Birdsong On' : 'Birdsong'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => resetCameraRef.current?.()}
                  title="Reset 3D camera"
                  className="p-1.5 rounded-lg bg-[#112233] border border-[#2A3F54] text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3D Object Count Bar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#1E3347]">
              {[
                { el: GardenElement.STONE, label: '3D Stones', count: stoneCount },
                { el: GardenElement.FLOWER, label: '3D Flowers', count: flowerCount },
                { el: GardenElement.SUNBEAM, label: '3D Lakes', count: lakeCount },
                { el: GardenElement.TREE, label: '3D Trees', count: treeCount },
                { el: GardenElement.BIRD, label: '3D Birds', count: birdCount },
              ].map((item) => {
                const active = selectedElement === item.el;
                return (
                  <button
                    key={item.el}
                    type="button"
                    onClick={() => inspectElement(item.el)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#FEF08A] text-[#0F2922] border-[#FDE047]'
                        : 'bg-[#112233] text-slate-200 border-[#2A3F54] hover:border-[#38BDF8]'
                    }`}
                  >
                    {item.label}: <span className="font-mono font-semibold">{item.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
