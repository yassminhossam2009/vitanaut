import * as THREE from 'three';
import { GardenElement, MissionId } from '../../types.ts';

export interface IslandTheme {
  id: MissionId;
  skyHex: number;
  fogHex: number;
  topColor: string;
  topAccent: string;
  cliffColor: number;
  cliffStrataColor: number;
  keyLightColor: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  waterColor: number;
  starColor: number;
  starOpacity: number;
}

export const ISLAND_THEMES: Record<MissionId, IslandTheme> = {
  [MissionId.ISS]: {
    id: MissionId.ISS,
    skyHex: 0x050b18,
    fogHex: 0x050b18,
    topColor: '#24473c',
    topAccent: '#18332b',
    cliffColor: 0x334155,
    cliffStrataColor: 0x1e293b,
    keyLightColor: 0xfef9c3,
    hemiSkyColor: 0x38bdf8,
    hemiGroundColor: 0x0f172a,
    waterColor: 0x075985,
    starColor: 0xe2e8f0,
    starOpacity: 0.9,
  },
  [MissionId.LUNAR]: {
    id: MissionId.LUNAR,
    skyHex: 0x04070f,
    fogHex: 0x04070f,
    topColor: '#5c6570',
    topAccent: '#3e4650',
    cliffColor: 0x374151,
    cliffStrataColor: 0x1f2937,
    keyLightColor: 0xfef9c3,
    hemiSkyColor: 0x94a3b8,
    hemiGroundColor: 0x0f172a,
    waterColor: 0x0c4a6e,
    starColor: 0xf8fafc,
    starOpacity: 0.95,
  },
  [MissionId.MARS]: {
    id: MissionId.MARS,
    skyHex: 0x180c0a,
    fogHex: 0x180c0a,
    topColor: '#6f321e',
    topAccent: '#4a2013',
    cliffColor: 0x4a1d11,
    cliffStrataColor: 0x2e120a,
    keyLightColor: 0xfde68a,
    hemiSkyColor: 0xfb923c,
    hemiGroundColor: 0x1c0d09,
    waterColor: 0x0369a1,
    starColor: 0xfef3c7,
    starOpacity: 0.65,
  },
  [MissionId.DEEP_SPACE]: {
    id: MissionId.DEEP_SPACE,
    skyHex: 0x030712,
    fogHex: 0x030712,
    topColor: '#16383b',
    topAccent: '#0f272b',
    cliffColor: 0x1e293b,
    cliffStrataColor: 0x0f172a,
    keyLightColor: 0xfef08a,
    hemiSkyColor: 0x38bdf8,
    hemiGroundColor: 0x020617,
    waterColor: 0x0e7490,
    starColor: 0xbae6fd,
    starOpacity: 0.95,
  },
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSurfaceTexture(
  theme: IslandTheme,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = theme.topColor;
    ctx.fillRect(0, 0, size, size);

    const rand = mulberry32(theme.id.length * 9173 + 17);

    // Subtle geological strata & terrain variation
    for (let i = 0; i < 180; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 8 + rand() * 34;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = theme.topAccent;
      ctx.globalAlpha = 0.14 + rand() * 0.18;
      ctx.fill();
    }

    // Fine mineral grit
    for (let i = 0; i < 1000; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1 + rand() * 2;
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = rand() > 0.55 ? '#94a3b8' : '#090d16';
      ctx.fillRect(x, y, r, r);
    }

    if (theme.id === MissionId.LUNAR) {
      for (let i = 0; i < 24; i++) {
        const x = 60 + rand() * (size - 120);
        const y = 60 + rand() * (size - 120);
        const r = 12 + rand() * 26;
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, r * 0.78, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme.id === MissionId.MARS) {
      ctx.strokeStyle = '#3b150c';
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const y = rand() * size;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y - 14, size * 0.7, y + 14, size, y);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function groundHeightAt(x: number, z: number, missionId: MissionId): number {
  const dist = Math.sqrt(x * x + z * z);
  const edgeRoll = Math.max(0, 1 - Math.pow(dist / 6.2, 4));
  let ripple = 0.08 * Math.sin(x * 0.7) * Math.cos(z * 0.7);
  if (missionId === MissionId.MARS) {
    ripple += 0.13 * Math.sin(x * 0.45 + z * 0.35);
  } else if (missionId === MissionId.LUNAR) {
    const craterA = Math.exp(-((x + 1.8) ** 2 + (z - 1.4) ** 2) * 1.1);
    ripple -= 0.16 * craterA;
  }
  return 0.4 * edgeRoll + ripple * edgeRoll;
}

function tagElementGroup(group: THREE.Object3D, element: GardenElement) {
  group.userData.gardenElement = element;
  group.traverse((child) => {
    child.userData.gardenElement = element;
  });
}

/**
 * Builds a darker, aerospace-grade 3D floating mission diorama island.
 */
export function buildMissionIsland(
  missionId: MissionId,
  maxAnisotropy: number
): { group: THREE.Group; disposables: Array<{ dispose: () => void }> } {
  const theme = ISLAND_THEMES[missionId];
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const surfaceTex = createSurfaceTexture(theme, maxAnisotropy);
  disposables.push(surfaceTex);

  // 1. Sculpted Top Plateau
  const topGeo = new THREE.CylinderGeometry(5.6, 5.1, 0.85, 48, 4);
  const pos = topGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    if (vy > 0.1) {
      pos.setY(i, groundHeightAt(vx, vz, missionId));
    } else {
      pos.setY(i, -0.55);
    }
  }
  topGeo.computeVertexNormals();
  const topMat = new THREE.MeshStandardMaterial({
    map: surfaceTex,
    roughness: 0.9,
    metalness: 0.08,
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);
  disposables.push(topGeo, topMat);

  // 2. Dark Faceted Orbital / Asteroid Cliff Underside
  const underGeo = new THREE.ConeGeometry(5.05, 3.4, 14, 2);
  const underPos = underGeo.attributes.position;
  const rand = mulberry32(missionId.length * 131 + 42);
  for (let i = 0; i < underPos.count; i++) {
    const vy = underPos.getY(i);
    if (vy < 1.3 && vy > -1.4) {
      underPos.setX(i, underPos.getX(i) * (0.88 + rand() * 0.24));
      underPos.setZ(i, underPos.getZ(i) * (0.88 + rand() * 0.24));
    }
  }
  underGeo.computeVertexNormals();
  const underMat = new THREE.MeshStandardMaterial({
    color: theme.cliffColor,
    roughness: missionId === MissionId.ISS ? 0.42 : 0.9,
    metalness: missionId === MissionId.ISS ? 0.65 : 0.12,
    flatShading: true,
  });
  const underMesh = new THREE.Mesh(underGeo, underMat);
  underMesh.position.y = -2.22;
  underMesh.rotation.x = Math.PI;
  underMesh.castShadow = true;
  underMesh.receiveShadow = true;
  group.add(underMesh);
  disposables.push(underGeo, underMat);

  // Subtle Aerospace Rim Ring around the habitat island
  const trimGeo = new THREE.TorusGeometry(5.48, 0.08, 10, 64);
  const trimMat = new THREE.MeshStandardMaterial({
    color: missionId === MissionId.MARS ? 0x7c2d12 : 0x475569,
    metalness: 0.72,
    roughness: 0.32,
  });
  const trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.rotation.x = Math.PI / 2;
  trimMesh.position.y = -0.15;
  group.add(trimMesh);
  disposables.push(trimGeo, trimMat);

  // 3. Mission-Specific Space Surroundings
  if (missionId === MissionId.ISS) {
    // Sleek dark-anodized orbital truss ring + glowing Earth below in dark space
    const ringGeo = new THREE.TorusGeometry(6.35, 0.05, 8, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -0.35;
    group.add(ringMesh);
    disposables.push(ringGeo, ringMat);

    // Distant deep-ocean Earth curvature underneath
    const earthGeo = new THREE.SphereGeometry(20, 42, 26);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x075985,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.25,
      roughness: 0.72,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.position.set(0, -25.8, -6);
    group.add(earthMesh);
    disposables.push(earthGeo, earthMat);
  } else if (missionId === MissionId.LUNAR) {
    const craterCoords = [
      { x: -2.9, z: 2.2, r: 0.72 },
      { x: 3.1, z: -2.1, r: 0.58 },
      { x: -1.8, z: -3.2, r: 0.64 },
    ];
    const craterMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 0.94,
      metalness: 0.06,
      flatShading: true,
    });
    disposables.push(craterMat);
    for (const c of craterCoords) {
      const rimGeo = new THREE.TorusGeometry(c.r, 0.13, 8, 20);
      const rim = new THREE.Mesh(rimGeo, craterMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(c.x, groundHeightAt(c.x, c.z, missionId) + 0.04, c.z);
      rim.receiveShadow = true;
      rim.castShadow = true;
      group.add(rim);
      disposables.push(rimGeo);
    }

    const earthOrbGeo = new THREE.SphereGeometry(1.05, 24, 18);
    const earthOrbMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.65,
      roughness: 0.45,
    });
    const earthOrb = new THREE.Mesh(earthOrbGeo, earthOrbMat);
    earthOrb.position.set(-8.5, 6.4, -10.5);
    group.add(earthOrb);
    disposables.push(earthOrbGeo, earthOrbMat);
  } else if (missionId === MissionId.MARS) {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5c2414,
      roughness: 0.92,
      metalness: 0.06,
      flatShading: true,
    });
    disposables.push(rockMat);
    const ridgeCoords = [
      { x: -3.9, z: -1.8, s: 0.65 },
      { x: 3.7, z: -2.4, s: 0.72 },
      { x: 3.9, z: 1.9, s: 0.52 },
    ];
    for (const r of ridgeCoords) {
      const geo = new THREE.DodecahedronGeometry(r.s, 0);
      const mesh = new THREE.Mesh(geo, rockMat);
      mesh.scale.set(1.3, 0.75, 1.0);
      mesh.position.set(r.x, groundHeightAt(r.x, r.z, missionId) + r.s * 0.25, r.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      disposables.push(geo);
    }

    // Phobos moon speck in Martian dusk sky
    const moonGeo = new THREE.DodecahedronGeometry(0.42, 1);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0x9a8c82,
      roughness: 0.9,
      flatShading: true,
    });
    const phobos = new THREE.Mesh(moonGeo, moonMat);
    phobos.position.set(8.2, 6.8, -11.5);
    group.add(phobos);
    disposables.push(moonGeo, moonMat);
  } else if (missionId === MissionId.DEEP_SPACE) {
    const prismMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xa16207,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.7,
    });
    disposables.push(prismMat);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const px = Math.cos(ang) * 5.2;
      const pz = Math.sin(ang) * 5.2;
      const gemGeo = new THREE.OctahedronGeometry(0.24, 0);
      const gem = new THREE.Mesh(gemGeo, prismMat);
      gem.position.set(px, 0.15, pz);
      group.add(gem);
      disposables.push(gemGeo);
    }
  }

  // Deep Space Starfield Dome across ALL missions
  const starCount = 480;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const radius = 24 + rand() * 20;
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi) + 1.5;
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: theme.starColor,
    size: 0.18,
    transparent: true,
    opacity: theme.starOpacity,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);
  disposables.push(starGeo, starMat);

  return { group, disposables };
}

/**
 * 3D Sculpted Botanical Conservatory Tree (Multi-branch trunk + organic deep-forest canopy clusters)
 */
export function build3DTree(
  seed: number,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const rand = mulberry32(seed);
  const tree = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.92,
    metalness: 0.03,
  });
  const deepGreens = [0x14532d, 0x1b4332, 0x1e4d3b];
  const crownColor = deepGreens[Math.floor(rand() * deepGreens.length)];
  const leafMat = new THREE.MeshStandardMaterial({
    color: crownColor,
    roughness: 0.78,
    metalness: 0.04,
    flatShading: true,
  });
  const accentLeafMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a4f,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: true,
  });
  disposables.push(trunkMat, leafMat, accentLeafMat);

  // Root collar
  const rootGeo = new THREE.CylinderGeometry(0.11, 0.22, 0.18, 7);
  const rootMesh = new THREE.Mesh(rootGeo, trunkMat);
  rootMesh.position.y = 0.09;
  rootMesh.castShadow = true;
  tree.add(rootMesh);

  // Main Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.065, 0.12, 0.85, 7);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.position.y = 0.46;
  trunkMesh.castShadow = true;
  tree.add(trunkMesh);

  // Side Branch
  const branchGeo = new THREE.CylinderGeometry(0.03, 0.055, 0.42, 6);
  const branch = new THREE.Mesh(branchGeo, trunkMat);
  branch.position.set(0.14, 0.72, 0.04);
  branch.rotation.z = -0.65;
  branch.castShadow = true;
  tree.add(branch);

  // Sculpted organic polyhedral foliage clusters (sophisticated botanical silhouette)
  const c1Geo = new THREE.DodecahedronGeometry(0.44, 1);
  const c1 = new THREE.Mesh(c1Geo, leafMat);
  c1.scale.set(1.1, 0.85, 1.05);
  c1.position.set(0, 1.08, 0);
  c1.castShadow = true;
  c1.receiveShadow = true;
  tree.add(c1);

  const c2Geo = new THREE.DodecahedronGeometry(0.32, 1);
  const c2 = new THREE.Mesh(c2Geo, accentLeafMat);
  c2.scale.set(1.05, 0.8, 1.0);
  c2.position.set(0.24, 0.94, 0.12);
  c2.castShadow = true;
  tree.add(c2);

  const c3Geo = new THREE.DodecahedronGeometry(0.28, 1);
  const c3 = new THREE.Mesh(c3Geo, leafMat);
  c3.position.set(-0.2, 0.98, -0.1);
  c3.castShadow = true;
  tree.add(c3);

  disposables.push(rootGeo, trunkGeo, branchGeo, c1Geo, c2Geo, c3Geo);

  const scale = 0.88 + rand() * 0.32;
  tree.scale.setScalar(scale);
  tree.rotation.y = rand() * Math.PI * 2;
  tagElementGroup(tree, GardenElement.TREE);
  return tree;
}

/**
 * 3D Composite Mineral Stone Cairn (dark basalt/slate boulders on dark moss ring)
 */
export function build3DStoneCairn(
  seed: number,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const rand = mulberry32(seed);
  const cairn = new THREE.Group();

  const padMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a2f,
    roughness: 0.92,
    metalness: 0.02,
  });
  const baseStoneMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.86,
    metalness: 0.14,
    flatShading: true,
  });
  const topStoneMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.68,
    metalness: 0.18,
    flatShading: true,
  });
  disposables.push(padMat, baseStoneMat, topStoneMat);

  const padGeo = new THREE.CylinderGeometry(0.34, 0.38, 0.05, 12);
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = 0.025;
  pad.receiveShadow = true;
  cairn.add(pad);

  const s1Geo = new THREE.DodecahedronGeometry(0.3, 1);
  const s1 = new THREE.Mesh(s1Geo, baseStoneMat);
  s1.scale.set(1.18, 0.54, 0.96);
  s1.position.y = 0.18;
  s1.castShadow = true;
  s1.receiveShadow = true;
  cairn.add(s1);

  const s2Geo = new THREE.DodecahedronGeometry(0.21, 1);
  const s2 = new THREE.Mesh(s2Geo, topStoneMat);
  s2.scale.set(1.1, 0.52, 0.92);
  s2.position.set(0.02, 0.39, -0.01);
  s2.rotation.y = 0.8;
  s2.castShadow = true;
  cairn.add(s2);

  const s3Geo = new THREE.DodecahedronGeometry(0.13, 1);
  const s3 = new THREE.Mesh(s3Geo, baseStoneMat);
  s3.scale.set(1.05, 0.56, 0.9);
  s3.position.set(-0.01, 0.54, 0.01);
  s3.rotation.y = 1.6;
  s3.castShadow = true;
  cairn.add(s3);

  disposables.push(padGeo, s1Geo, s2Geo, s3Geo);

  const scale = 0.88 + rand() * 0.28;
  cairn.scale.setScalar(scale);
  cairn.rotation.y = rand() * Math.PI * 2;
  tagElementGroup(cairn, GardenElement.STONE);
  return cairn;
}

/**
 * 3D Composite Wildflower (deep emerald stem + jewel-toned petals)
 */
export function build3DFlower(
  seed: number,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const rand = mulberry32(seed);
  const flower = new THREE.Group();

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    roughness: 0.78,
  });
  const petalPalette = [0x0369a1, 0xd97706, 0x0284c7, 0xca8a04, 0x0f766e];
  const petalColor = petalPalette[Math.floor(rand() * petalPalette.length)];
  const petalMat = new THREE.MeshStandardMaterial({
    color: petalColor,
    emissive: petalColor,
    emissiveIntensity: 0.14,
    roughness: 0.45,
    metalness: 0.08,
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
    roughness: 0.45,
  });
  disposables.push(stemMat, petalMat, centerMat);

  const stemGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.42, 6);
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.21;
  stem.castShadow = true;
  flower.add(stem);

  const leafGeo = new THREE.SphereGeometry(0.075, 8, 6);
  for (let i = 0; i < 2; i++) {
    const leaf = new THREE.Mesh(leafGeo, stemMat);
    leaf.scale.set(1.5, 0.32, 0.65);
    leaf.position.set(i === 0 ? 0.08 : -0.08, 0.16 + i * 0.05, 0);
    leaf.rotation.z = i === 0 ? 0.4 : -0.4;
    flower.add(leaf);
  }

  const head = new THREE.Group();
  head.position.y = 0.43;
  head.rotation.x = 0.25;

  const centerGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const center = new THREE.Mesh(centerGeo, centerMat);
  head.add(center);

  const petalGeo = new THREE.SphereGeometry(0.072, 8, 6);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.scale.set(1.25, 0.34, 0.78);
    petal.position.set(Math.cos(angle) * 0.1, 0, Math.sin(angle) * 0.1);
    petal.rotation.y = -angle;
    petal.castShadow = true;
    head.add(petal);
  }

  flower.add(head);
  disposables.push(stemGeo, leafGeo, centerGeo, petalGeo);

  const scale = 0.9 + rand() * 0.3;
  flower.scale.setScalar(scale);
  flower.rotation.y = rand() * Math.PI * 2;
  tagElementGroup(flower, GardenElement.FLOWER);
  return flower;
}

/**
 * 3D Reflective Space Oasis Lake + Circadian Lantern
 */
export function build3DLakeWithLantern(
  theme: IslandTheme,
  radius: number,
  disposables: Array<{ dispose: () => void }>
): { group: THREE.Group; waterMesh: THREE.Mesh } {
  const lake = new THREE.Group();

  const rimGeo = new THREE.TorusGeometry(radius, 0.11, 8, 28);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.18,
    flatShading: true,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.04;
  rim.receiveShadow = true;
  lake.add(rim);

  const waterGeo = new THREE.CylinderGeometry(radius * 0.96, radius * 0.92, 0.08, 28);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: theme.waterColor,
    roughness: 0.1,
    metalness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.9,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0.04;
  waterMesh.receiveShadow = true;
  lake.add(waterMesh);

  const padGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.78 });
  const pad1 = new THREE.Mesh(padGeo, padMat);
  pad1.position.set(radius * 0.35, 0.09, radius * 0.2);
  lake.add(pad1);

  const postMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.78,
    roughness: 0.28,
  });
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xeab308,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });
  const postGeo = new THREE.CylinderGeometry(0.026, 0.04, 0.65, 8);
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(-radius * 0.98, 0.33, -radius * 0.25);
  post.castShadow = true;
  lake.add(post);

  const orbGeo = new THREE.SphereGeometry(0.095, 14, 12);
  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.set(-radius * 0.98, 0.71, -radius * 0.25);
  lake.add(orb);

  disposables.push(rimGeo, rimMat, waterGeo, waterMat, padGeo, padMat, postMat, orbMat, postGeo, orbGeo);
  tagElementGroup(lake, GardenElement.SUNBEAM);
  return { group: lake, waterMesh };
}

/**
 * 3D Composite Songbird (dark-cerulean / luminescent blue)
 */
export function build3DBird(
  seed: number,
  disposables: Array<{ dispose: () => void }>
): { group: THREE.Group; leftWing: THREE.Mesh; rightWing: THREE.Mesh } {
  const rand = mulberry32(seed);
  const bird = new THREE.Group();

  const bodyColors = [0x0369a1, 0x0284c7, 0x0ea5e9];
  const bodyColor = bodyColors[Math.floor(rand() * bodyColors.length)];
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    emissive: 0x075985,
    emissiveIntensity: 0.22,
    roughness: 0.45,
    metalness: 0.14,
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.4,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x0c4a6e,
    roughness: 0.48,
  });
  disposables.push(bodyMat, beakMat, wingMat);

  const bodyGeo = new THREE.SphereGeometry(0.12, 12, 10);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(0.88, 0.82, 1.35);
  body.castShadow = true;
  bird.add(body);

  const headGeo = new THREE.SphereGeometry(0.08, 10, 8);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 0.085, 0.13);
  bird.add(head);

  const beakGeo = new THREE.ConeGeometry(0.028, 0.085, 6);
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.075, 0.22);
  bird.add(beak);

  const tailGeo = new THREE.ConeGeometry(0.055, 0.15, 4);
  const tail = new THREE.Mesh(tailGeo, wingMat);
  tail.rotation.x = -Math.PI / 2.4;
  tail.position.set(0, 0.035, -0.19);
  bird.add(tail);

  const wingGeo = new THREE.BoxGeometry(0.22, 0.018, 0.1);
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(-0.13, 0.04, 0.02);
  bird.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(0.13, 0.04, 0.02);
  bird.add(rightWing);

  disposables.push(bodyGeo, headGeo, beakGeo, tailGeo, wingGeo);
  tagElementGroup(bird, GardenElement.BIRD);
  return { group: bird, leftWing, rightWing };
}
