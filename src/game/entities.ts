import * as THREE from 'three';
import { BlockId, BLOCK_DEFS } from './types';

export type MobKind =
  | 'pig'
  | 'cow'
  | 'sheep'
  | 'chicken'
  | 'wolf'
  | 'zombie'
  | 'stalker'
  | 'skeleton'
  | 'spider';

export interface MobEntity {
  id: number;
  kind: MobKind;
  group: THREE.Group;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  onGround: boolean;
  walkPhase: number;
  wanderTimer: number;
  wanderAngle: number;
  panicTimer: number;
  aggroTimer: number; // for neutral mobs like wolf
  hitFlashTimer: number;
  attackCooldown: number;
  windupTimer: number;
  fuseTimer: number;
  scaleY: number;
  materials: THREE.MeshStandardMaterial[];
  baseColors: THREE.Color[];
}

export interface DroppedItem {
  id: number;
  itemId: BlockId;
  count: number;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  bobOffset: number;
}

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
}

const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

function makePartGeo(
  geo: THREE.BufferGeometry,
  colorHex: number,
  roughness: number,
  metalness = 0.04,
  matsOut?: THREE.MeshStandardMaterial[],
  colsOut?: THREE.Color[],
  emissiveHex?: number
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness,
    metalness,
    ...(emissiveHex !== undefined ? { emissive: emissiveHex, emissiveIntensity: 1.5 } : {}),
  });
  if (matsOut && colsOut) {
    matsOut.push(mat);
    colsOut.push(new THREE.Color(colorHex));
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

let nextEntityId = 1;

export function createMob(
  kind: MobKind,
  x: number,
  y: number,
  z: number,
  shadowDiscTexture?: THREE.Texture
): MobEntity {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const materials: THREE.MeshStandardMaterial[] = [];
  const baseColors: THREE.Color[] = [];
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  let head: THREE.Object3D = new THREE.Group();
  let maxHp = 10;

  if (shadowDiscTexture) {
    const shSize = kind === 'chicken' ? 0.65 : kind === 'spider' ? 1.45 : kind === 'cow' ? 1.35 : 1.1;
    const shGeo = new THREE.PlaneGeometry(shSize, shSize);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({
      map: shadowDiscTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const shMesh = new THREE.Mesh(shGeo, shMat);
    shMesh.position.y = 0.018;
    group.add(shMesh);
  }

  if (kind === 'pig') {
    maxHp = 10;
    const body = makePartGeo(new THREE.BoxGeometry(0.62, 0.52, 0.9), 0xeba0ab, 0.88, 0.02, materials, baseColors);
    body.position.set(0, 0.56, 0);
    group.add(body);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.65, 0.44);

    const headMesh = makePartGeo(new THREE.BoxGeometry(0.5, 0.48, 0.48), 0xf2adb7, 0.85, 0.02, materials, baseColors);
    headMesh.position.set(0, 0.02, 0.16);
    headPivot.add(headMesh);

    const earGeo = new THREE.BoxGeometry(0.1, 0.14, 0.1);
    const earL = makePartGeo(earGeo, 0xe08d99, 0.9, 0.02, materials, baseColors);
    earL.position.set(-0.24, 0.24, 0.1);
    const earR = makePartGeo(earGeo.clone(), 0xe08d99, 0.9, 0.02, materials, baseColors);
    earR.position.set(0.24, 0.24, 0.1);
    headPivot.add(earL, earR);

    const snout = makePartGeo(new THREE.BoxGeometry(0.26, 0.18, 0.12), 0xd87483, 0.52, 0.04, materials, baseColors);
    snout.position.set(0, -0.05, 0.42);
    headPivot.add(snout);

    const nosGeo = new THREE.BoxGeometry(0.05, 0.05, 0.03);
    const nosL = makePartGeo(nosGeo, 0x5c2a32, 0.7, 0.02);
    nosL.position.set(-0.06, -0.04, 0.48);
    const nosR = makePartGeo(nosGeo.clone(), 0x5c2a32, 0.7, 0.02);
    nosR.position.set(0.06, -0.04, 0.48);
    headPivot.add(nosL, nosR);

    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.03);
    const eyeL = makePartGeo(eyeGeo, 0x16181c, 0.12, 0.15);
    eyeL.position.set(-0.16, 0.08, 0.41);
    const eyeR = makePartGeo(eyeGeo.clone(), 0x16181c, 0.12, 0.15);
    eyeR.position.set(0.16, 0.08, 0.41);
    headPivot.add(eyeL, eyeR);

    group.add(headPivot);
    head = headPivot;

    const legCoords: [number, number][] = [
      [-0.18, 0.28],
      [0.18, 0.28],
      [-0.18, -0.28],
      [0.18, -0.28],
    ];
    for (const [lx, lz] of legCoords) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.35, lz);
      const upperLeg = makePartGeo(new THREE.BoxGeometry(0.18, 0.28, 0.18), 0xe68d9a, 0.88, 0.02, materials, baseColors);
      upperLeg.position.set(0, -0.14, 0);
      const hoof = makePartGeo(new THREE.BoxGeometry(0.18, 0.07, 0.18), 0x4b3b37, 0.45, 0.08);
      hoof.position.set(0, -0.315, 0);
      lp.add(upperLeg, hoof);
      group.add(lp);
      legs.push(lp);
    }
  } else if (kind === 'cow') {
    maxHp = 14;
    const body = makePartGeo(new THREE.BoxGeometry(0.74, 0.68, 1.12), 0x563e30, 0.88, 0.02, materials, baseColors);
    body.position.set(0, 0.84, 0);
    group.add(body);

    const patch1 = makePartGeo(new THREE.BoxGeometry(0.12, 0.4, 0.48), 0xefeae2, 0.9, 0.02, materials, baseColors);
    patch1.position.set(0.34, 0.92, 0.12);
    const patch2 = makePartGeo(new THREE.BoxGeometry(0.12, 0.36, 0.42), 0xefeae2, 0.9, 0.02, materials, baseColors);
    patch2.position.set(-0.34, 0.86, -0.2);
    const patchTop = makePartGeo(new THREE.BoxGeometry(0.42, 0.08, 0.46), 0xefeae2, 0.9, 0.02, materials, baseColors);
    patchTop.position.set(0.06, 1.17, -0.1);
    group.add(patch1, patch2, patchTop);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.96, 0.56);
    const skull = makePartGeo(new THREE.BoxGeometry(0.48, 0.48, 0.42), 0x5c4234, 0.86, 0.02, materials, baseColors);
    skull.position.set(0, 0.04, 0.18);
    const muzzle = makePartGeo(new THREE.BoxGeometry(0.36, 0.2, 0.12), 0xd8b2a6, 0.58, 0.03, materials, baseColors);
    muzzle.position.set(0, -0.09, 0.4);

    const hornGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
    const hornL = makePartGeo(hornGeo, 0xe2d8c5, 0.35, 0.1);
    hornL.position.set(-0.24, 0.28, 0.14);
    const hornR = makePartGeo(hornGeo.clone(), 0xe2d8c5, 0.35, 0.1);
    hornR.position.set(0.24, 0.28, 0.14);

    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.03);
    const eyeL = makePartGeo(eyeGeo, 0x161618, 0.12, 0.15);
    eyeL.position.set(-0.18, 0.1, 0.4);
    const eyeR = makePartGeo(eyeGeo.clone(), 0x161618, 0.12, 0.15);
    eyeR.position.set(0.18, 0.1, 0.4);

    headPivot.add(skull, muzzle, hornL, hornR, eyeL, eyeR);
    group.add(headPivot);
    head = headPivot;

    const legCoords: [number, number][] = [
      [-0.22, 0.34],
      [0.22, 0.34],
      [-0.22, -0.34],
      [0.22, -0.34],
    ];
    for (const [lx, lz] of legCoords) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.52, lz);
      const legM = makePartGeo(new THREE.BoxGeometry(0.2, 0.44, 0.2), 0x4f382b, 0.88, 0.02, materials, baseColors);
      legM.position.set(0, -0.22, 0);
      const hoof = makePartGeo(new THREE.BoxGeometry(0.2, 0.08, 0.2), 0x24201e, 0.4, 0.1);
      hoof.position.set(0, -0.48, 0);
      lp.add(legM, hoof);
      group.add(lp);
      legs.push(lp);
    }
  } else if (kind === 'sheep') {
    maxHp = 10;
    const woolCore = makePartGeo(new THREE.BoxGeometry(0.7, 0.62, 0.94), 0xf4f2eb, 0.96, 0.0, materials, baseColors);
    woolCore.position.set(0, 0.68, 0);
    group.add(woolCore);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.76, 0.46);
    const woolHead = makePartGeo(new THREE.BoxGeometry(0.42, 0.42, 0.38), 0xf7f5ef, 0.95, 0.0, materials, baseColors);
    woolHead.position.set(0, 0.04, 0.12);
    const face = makePartGeo(new THREE.BoxGeometry(0.34, 0.3, 0.14), 0xd8c6b4, 0.82, 0.02, materials, baseColors);
    face.position.set(0, 0.0, 0.28);
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.03);
    const eyeL = makePartGeo(eyeGeo, 0x161618, 0.12, 0.15);
    eyeL.position.set(-0.11, 0.06, 0.36);
    const eyeR = makePartGeo(eyeGeo.clone(), 0x161618, 0.12, 0.15);
    eyeR.position.set(0.11, 0.06, 0.36);
    headPivot.add(woolHead, face, eyeL, eyeR);
    group.add(headPivot);
    head = headPivot;

    const legCoords: [number, number][] = [
      [-0.18, 0.26],
      [0.18, 0.26],
      [-0.18, -0.26],
      [0.18, -0.26],
    ];
    for (const [lx, lz] of legCoords) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.4, lz);
      const lm = makePartGeo(new THREE.BoxGeometry(0.16, 0.4, 0.16), 0xc9b49f, 0.85, 0.02, materials, baseColors);
      lm.position.set(0, -0.2, 0);
      lp.add(lm);
      group.add(lp);
      legs.push(lp);
    }
  } else if (kind === 'chicken') {
    maxHp = 6;
    const body = makePartGeo(new THREE.BoxGeometry(0.38, 0.34, 0.5), 0xfafaf8, 0.92, 0.0, materials, baseColors);
    body.position.set(0, 0.42, 0);
    group.add(body);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.56, 0.22);
    const skull = makePartGeo(new THREE.BoxGeometry(0.24, 0.28, 0.24), 0xffffff, 0.9, 0.0, materials, baseColors);
    skull.position.set(0, 0.1, 0.04);
    const beak = makePartGeo(new THREE.BoxGeometry(0.16, 0.08, 0.14), 0xf09c24, 0.45, 0.04);
    beak.position.set(0, 0.06, 0.21);
    const wattle = makePartGeo(new THREE.BoxGeometry(0.1, 0.09, 0.08), 0xd62828, 0.65, 0.02);
    wattle.position.set(0, -0.02, 0.18);
    const comb = makePartGeo(new THREE.BoxGeometry(0.05, 0.08, 0.12), 0xd62828, 0.65, 0.02);
    comb.position.set(0, 0.26, 0.04);
    const eyeL = makePartGeo(new THREE.BoxGeometry(0.05, 0.05, 0.03), 0x141414, 0.1, 0.1);
    eyeL.position.set(-0.09, 0.13, 0.17);
    const eyeR = makePartGeo(new THREE.BoxGeometry(0.05, 0.05, 0.03), 0x141414, 0.1, 0.1);
    eyeR.position.set(0.09, 0.13, 0.17);
    headPivot.add(skull, beak, wattle, comb, eyeL, eyeR);
    group.add(headPivot);
    head = headPivot;

    // Square flapping wings
    const wingL = new THREE.Group();
    wingL.position.set(-0.2, 0.5, 0);
    const wingLM = makePartGeo(new THREE.BoxGeometry(0.06, 0.22, 0.34), 0xf0efe9, 0.92, 0.0, materials, baseColors);
    wingLM.position.set(-0.02, -0.08, 0);
    wingL.add(wingLM);
    const wingR = new THREE.Group();
    wingR.position.set(0.2, 0.5, 0);
    const wingRM = makePartGeo(new THREE.BoxGeometry(0.06, 0.22, 0.34), 0xf0efe9, 0.92, 0.0, materials, baseColors);
    wingRM.position.set(0.02, -0.08, 0);
    wingR.add(wingRM);
    group.add(wingL, wingR);
    arms.push(wingL, wingR);

    for (const lx of [-0.09, 0.09]) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.25, 0);
      const lm = makePartGeo(new THREE.BoxGeometry(0.06, 0.25, 0.06), 0xe69f28, 0.55, 0.04);
      lm.position.set(0, -0.125, 0);
      lp.add(lm);
      group.add(lp);
      legs.push(lp);
    }
  } else if (kind === 'wolf') {
    maxHp = 14;
    const body = makePartGeo(new THREE.BoxGeometry(0.38, 0.38, 0.64), 0x8c929a, 0.9, 0.02, materials, baseColors);
    body.position.set(0, 0.56, -0.06);
    const mane = makePartGeo(new THREE.BoxGeometry(0.48, 0.44, 0.38), 0xa8aeb6, 0.92, 0.02, materials, baseColors);
    mane.position.set(0, 0.6, 0.28);
    const tail = makePartGeo(new THREE.BoxGeometry(0.12, 0.12, 0.44), 0x7b818a, 0.9, 0.02, materials, baseColors);
    tail.position.set(0, 0.62, -0.52);
    tail.rotation.x = -0.65;
    group.add(body, mane, tail);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.66, 0.48);
    const skull = makePartGeo(new THREE.BoxGeometry(0.38, 0.36, 0.34), 0x9aa0a8, 0.88, 0.02, materials, baseColors);
    skull.position.set(0, 0.02, 0.12);
    const snout = makePartGeo(new THREE.BoxGeometry(0.18, 0.14, 0.22), 0xbfc4cc, 0.8, 0.02, materials, baseColors);
    snout.position.set(0, -0.06, 0.34);
    const nose = makePartGeo(new THREE.BoxGeometry(0.08, 0.06, 0.04), 0x1a1a1d, 0.2, 0.1);
    nose.position.set(0, -0.02, 0.45);
    const earGeo = new THREE.BoxGeometry(0.1, 0.12, 0.06);
    const earL = makePartGeo(earGeo, 0x727880, 0.9, 0.02, materials, baseColors);
    earL.position.set(-0.13, 0.24, 0.08);
    const earR = makePartGeo(earGeo.clone(), 0x727880, 0.9, 0.02, materials, baseColors);
    earR.position.set(0.13, 0.24, 0.08);
    const eyeL = makePartGeo(new THREE.BoxGeometry(0.06, 0.06, 0.03), 0xffe066, 0.15, 0.1);
    eyeL.position.set(-0.1, 0.08, 0.3);
    const eyeR = makePartGeo(new THREE.BoxGeometry(0.06, 0.06, 0.03), 0xffe066, 0.15, 0.1);
    eyeR.position.set(0.1, 0.08, 0.3);
    headPivot.add(skull, snout, nose, earL, earR, eyeL, eyeR);
    group.add(headPivot);
    head = headPivot;

    const legCoords: [number, number][] = [
      [-0.14, 0.28],
      [0.14, 0.28],
      [-0.14, -0.26],
      [0.14, -0.26],
    ];
    for (const [lx, lz] of legCoords) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.4, lz);
      const lm = makePartGeo(new THREE.BoxGeometry(0.12, 0.4, 0.12), 0x7e848c, 0.88, 0.02, materials, baseColors);
      lm.position.set(0, -0.2, 0);
      lp.add(lm);
      group.add(lp);
      legs.push(lp);
    }
  } else if (kind === 'zombie') {
    maxHp = 20;
    for (const lx of [-0.13, 0.13]) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.72, 0);
      const thigh = makePartGeo(new THREE.BoxGeometry(0.22, 0.58, 0.22), 0x2e3b68, 0.9, 0.02, materials, baseColors);
      thigh.position.set(0, -0.29, 0);
      const boot = makePartGeo(new THREE.BoxGeometry(0.23, 0.14, 0.25), 0x262322, 0.55, 0.12);
      boot.position.set(0, -0.65, 0.01);
      lp.add(thigh, boot);
      group.add(lp);
      legs.push(lp);
    }

    const torso = makePartGeo(new THREE.BoxGeometry(0.48, 0.68, 0.26), 0x277380, 0.86, 0.04, materials, baseColors);
    torso.position.set(0, 1.06, 0);
    group.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.4, 0);
    const skull = makePartGeo(new THREE.BoxGeometry(0.46, 0.46, 0.46), 0x528846, 0.76, 0.04, materials, baseColors);
    skull.position.set(0, 0.23, 0);
    headPivot.add(skull);

    const eyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.03);
    const eyeL = makePartGeo(eyeGeo, 0xd8f0b8, 0.15, 0.1);
    eyeL.position.set(-0.1, 0.26, 0.23);
    const eyeR = makePartGeo(eyeGeo.clone(), 0xd8f0b8, 0.15, 0.1);
    eyeR.position.set(0.1, 0.26, 0.23);
    headPivot.add(eyeL, eyeR);
    group.add(headPivot);
    head = headPivot;

    for (const ax of [-0.34, 0.34]) {
      const ap = new THREE.Group();
      ap.position.set(ax, 1.32, 0);
      const limb = makePartGeo(new THREE.BoxGeometry(0.2, 0.62, 0.2), 0x528846, 0.78, 0.04, materials, baseColors);
      limb.position.set(0, -0.25, 0);
      ap.add(limb);
      ap.rotation.x = -Math.PI * 0.42;
      group.add(ap);
      arms.push(ap);
    }
  } else if (kind === 'skeleton') {
    maxHp = 18;
    for (const lx of [-0.12, 0.12]) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.74, 0);
      const bone = makePartGeo(new THREE.BoxGeometry(0.11, 0.74, 0.11), 0xe6e2d5, 0.42, 0.06, materials, baseColors);
      bone.position.set(0, -0.37, 0);
      lp.add(bone);
      group.add(lp);
      legs.push(lp);
    }

    const spine = makePartGeo(new THREE.BoxGeometry(0.12, 0.66, 0.12), 0xdad5c7, 0.42, 0.06, materials, baseColors);
    spine.position.set(0, 1.07, 0);
    group.add(spine);
    for (let r = 0; r < 3; r++) {
      const rib = makePartGeo(new THREE.BoxGeometry(0.42, 0.08, 0.22), 0xe8e4d8, 0.42, 0.06, materials, baseColors);
      rib.position.set(0, 0.94 + r * 0.14, 0);
      group.add(rib);
    }

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.4, 0);
    const skull = makePartGeo(new THREE.BoxGeometry(0.44, 0.44, 0.44), 0xeeeae0, 0.4, 0.06, materials, baseColors);
    skull.position.set(0, 0.22, 0);
    const eyeL = makePartGeo(new THREE.BoxGeometry(0.09, 0.09, 0.03), 0x16161a, 0.2, 0.1);
    eyeL.position.set(-0.09, 0.24, 0.22);
    const eyeR = makePartGeo(new THREE.BoxGeometry(0.09, 0.09, 0.03), 0x16161a, 0.2, 0.1);
    eyeR.position.set(0.09, 0.24, 0.22);
    headPivot.add(skull, eyeL, eyeR);
    group.add(headPivot);
    head = headPivot;

    for (const ax of [-0.28, 0.28]) {
      const ap = new THREE.Group();
      ap.position.set(ax, 1.34, 0);
      const armBone = makePartGeo(new THREE.BoxGeometry(0.1, 0.62, 0.1), 0xe6e2d5, 0.42, 0.06, materials, baseColors);
      armBone.position.set(0, -0.26, 0);
      ap.add(armBone);
      ap.rotation.x = -Math.PI * 0.35;
      group.add(ap);
      arms.push(ap);
    }
  } else if (kind === 'spider') {
    maxHp = 16;
    const abdomen = makePartGeo(new THREE.BoxGeometry(0.66, 0.48, 0.72), 0x262328, 0.72, 0.08, materials, baseColors);
    abdomen.position.set(0, 0.44, -0.38);
    const thorax = makePartGeo(new THREE.BoxGeometry(0.42, 0.34, 0.36), 0x2e2a30, 0.68, 0.08, materials, baseColors);
    thorax.position.set(0, 0.4, 0.16);
    group.add(abdomen, thorax);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.4, 0.42);
    const headBall = makePartGeo(new THREE.BoxGeometry(0.42, 0.36, 0.34), 0x2a262c, 0.62, 0.1, materials, baseColors);
    headPivot.add(headBall);
    const eyeCoords: [number, number, number][] = [
      [-0.08, 0.05, 0.18],
      [0.08, 0.05, 0.18],
      [-0.15, 0.01, 0.18],
      [0.15, 0.01, 0.18],
    ];
    for (const [ex, ey, ez] of eyeCoords) {
      const eye = makePartGeo(new THREE.BoxGeometry(0.06, 0.06, 0.03), 0xff2a2a, 0.15, 0.1, undefined, undefined, 0xff1e1e);
      eye.position.set(ex, ey, ez);
      headPivot.add(eye);
    }
    group.add(headPivot);
    head = headPivot;

    // 8 articulated square spider legs
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const lp = new THREE.Group();
        lp.position.set(side * 0.2, 0.4, 0.25 - i * 0.16);
        const legMesh = makePartGeo(new THREE.BoxGeometry(0.09, 0.64, 0.09), 0x232025, 0.65, 0.1, materials, baseColors);
        legMesh.position.set(side * 0.28, -0.18, 0);
        legMesh.rotation.z = side * 0.92;
        lp.add(legMesh);
        group.add(lp);
        legs.push(lp);
      }
    }
  } else {
    // Classic boxy Stalker (Creeper silhouette)
    maxHp = 18;
    const torso = makePartGeo(new THREE.BoxGeometry(0.42, 0.72, 0.28), 0x2b8c3e, 0.86, 0.04, materials, baseColors);
    torso.position.set(0, 0.76, 0);
    group.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.12, 0);
    const headMesh = makePartGeo(new THREE.BoxGeometry(0.46, 0.46, 0.46), 0x35ab4b, 0.78, 0.04, materials, baseColors);
    headMesh.position.set(0, 0.23, 0);
    headPivot.add(headMesh);

    const eyeGeo = new THREE.BoxGeometry(0.09, 0.09, 0.03);
    const eyeL = makePartGeo(eyeGeo, 0x0d140d, 0.1, 0.2);
    eyeL.position.set(-0.1, 0.28, 0.23);
    const eyeR = makePartGeo(eyeGeo.clone(), 0x0d140d, 0.1, 0.2);
    eyeR.position.set(0.1, 0.28, 0.23);
    const mouth = makePartGeo(new THREE.BoxGeometry(0.16, 0.11, 0.03), 0x0d140d, 0.3, 0.1);
    mouth.position.set(0, 0.14, 0.23);
    headPivot.add(eyeL, eyeR, mouth);
    group.add(headPivot);
    head = headPivot;

    const legCoords: [number, number][] = [
      [-0.13, 0.16],
      [0.13, 0.16],
      [-0.13, -0.16],
      [0.13, -0.16],
    ];
    for (const [lx, lz] of legCoords) {
      const lp = new THREE.Group();
      lp.position.set(lx, 0.4, lz);
      const lm = makePartGeo(new THREE.BoxGeometry(0.18, 0.4, 0.18), 0x227832, 0.9, 0.04, materials, baseColors);
      lm.position.set(0, -0.2, 0);
      lp.add(lm);
      group.add(lp);
      legs.push(lp);
    }
  }

  return {
    id: nextEntityId++,
    kind,
    group,
    head,
    legs,
    arms,
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2,
    hp: maxHp,
    maxHp,
    onGround: false,
    walkPhase: Math.random() * Math.PI * 2,
    wanderTimer: 1 + Math.random() * 3,
    wanderAngle: Math.random() * Math.PI * 2,
    panicTimer: 0,
    aggroTimer: 0,
    hitFlashTimer: 0,
    attackCooldown: 0,
    windupTimer: 0,
    fuseTimer: 0,
    scaleY: 1,
    materials,
    baseColors,
  };
}

export function disposeMob(mob: MobEntity) {
  mob.group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
      else m.material.dispose();
    }
  });
}

export function getItemColor(id: BlockId): number {
  switch (id) {
    case BlockId.GRASS:
      return 0x5cae3a;
    case BlockId.DIRT:
      return 0x7d5535;
    case BlockId.STONE:
    case BlockId.COBBLESTONE:
    case BlockId.FURNACE:
      return 0x7e8287;
    case BlockId.MOSSY_COBBLESTONE:
      return 0x5d7a52;
    case BlockId.OAK_LOG:
      return 0x5c4128;
    case BlockId.OAK_PLANKS:
    case BlockId.CRAFTING_TABLE:
    case BlockId.CHEST:
    case BlockId.BOOKSHELF:
      return 0xb0864f;
    case BlockId.LEAVES:
      return 0x3e7e24;
    case BlockId.SAND:
    case BlockId.SANDSTONE:
      return 0xdfd097;
    case BlockId.COAL_ORE:
    case BlockId.COAL:
    case BlockId.GUNPOWDER:
      return 0x26282c;
    case BlockId.IRON_ORE:
    case BlockId.IRON_INGOT:
    case BlockId.IRON_BLOCK:
    case BlockId.IRON_PICKAXE:
    case BlockId.IRON_SWORD:
    case BlockId.IRON_AXE:
    case BlockId.IRON_SHOVEL:
      return 0xd6d8dc;
    case BlockId.GOLD_ORE:
    case BlockId.GOLD_INGOT:
    case BlockId.GOLD_BLOCK:
    case BlockId.GOLD_PICKAXE:
    case BlockId.GOLD_SWORD:
    case BlockId.GOLD_AXE:
    case BlockId.GOLD_SHOVEL:
    case BlockId.GOLDEN_APPLE:
      return 0xf2c929;
    case BlockId.DIAMOND_ORE:
    case BlockId.DIAMOND:
    case BlockId.DIAMOND_BLOCK:
    case BlockId.DIAMOND_PICKAXE:
    case BlockId.DIAMOND_SWORD:
    case BlockId.DIAMOND_AXE:
    case BlockId.DIAMOND_SHOVEL:
      return 0x33dde8;
    case BlockId.EMERALD_ORE:
    case BlockId.EMERALD:
    case BlockId.EMERALD_BLOCK:
      return 0x2ad45c;
    case BlockId.GLASS:
      return 0xb8e6f2;
    case BlockId.BRICK:
    case BlockId.TNT:
      return 0xb8382c;
    case BlockId.SNOW:
    case BlockId.WOOL:
    case BlockId.BONE:
    case BlockId.STRING:
    case BlockId.FEATHER:
      return 0xf0f4f8;
    case BlockId.OBSIDIAN:
      return 0x261a38;
    case BlockId.GLOWSTONE:
      return 0xffd262;
    case BlockId.CACTUS:
      return 0x357c2d;
    case BlockId.TORCH:
      return 0xffb833;
    case BlockId.RAW_PORK:
    case BlockId.RAW_CHICKEN:
      return 0xe68282;
    case BlockId.RAW_BEEF:
      return 0xb82828;
    case BlockId.COOKED_PORK:
    case BlockId.STEAK:
    case BlockId.COOKED_CHICKEN:
    case BlockId.LEATHER:
      return 0x9c5a2e;
    case BlockId.APPLE:
      return 0xd62828;
    case BlockId.DEEPSLATE:
      return 0x3b4252;
    case BlockId.CAVE_MOSS:
      return 0x4ca866;
    case BlockId.DRIPSTONE:
      return 0xb89f82;
    case BlockId.CRYSTAL_CLUSTER:
      return 0x70e4ff;
    case BlockId.GLOW_VINE:
      return 0xffc857;
    case BlockId.LEATHER_HELMET:
    case BlockId.LEATHER_CHESTPLATE:
    case BlockId.LEATHER_LEGGINGS:
    case BlockId.LEATHER_BOOTS:
      return 0x9c522b;
    case BlockId.IRON_HELMET:
    case BlockId.IRON_CHESTPLATE:
    case BlockId.IRON_LEGGINGS:
    case BlockId.IRON_BOOTS:
      return 0xd0d5db;
    case BlockId.GOLD_HELMET:
    case BlockId.GOLD_CHESTPLATE:
    case BlockId.GOLD_LEGGINGS:
    case BlockId.GOLD_BOOTS:
      return 0xf2c94c;
    case BlockId.DIAMOND_HELMET:
    case BlockId.DIAMOND_CHESTPLATE:
    case BlockId.DIAMOND_LEGGINGS:
    case BlockId.DIAMOND_BOOTS:
      return 0x2dd3e0;
    case BlockId.NETHERRACK:
      return 0x7c2929;
    case BlockId.NETHER_BRICKS:
      return 0x3b1b22;
    case BlockId.SOUL_SAND:
      return 0x523e31;
    case BlockId.QUARTZ_ORE:
    case BlockId.NETHER_QUARTZ:
      return 0xefe9e2;
    case BlockId.LAVA:
      return 0xff6218;
    case BlockId.NETHER_PORTAL:
      return 0xa033ff;
    case BlockId.FLINT:
    case BlockId.FLINT_AND_STEEL:
      return 0x505660;
    default:
      return 0xa0a0a0;
  }
}

export class ParticlePool {
  public mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private readonly maxCount = 140;

  constructor(scene: THREE.Scene) {
    // Pure square voxel cube particles
    const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxCount);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.maxCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(0xffffff),
        life: 0,
        maxLife: 0.5,
        size: 0.14,
      });
      _mat4.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _mat4);
      this.mesh.setColorAt(i, this.particles[i].color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  public spawnBurst(x: number, y: number, z: number, colorHex: number, count = 14, speed = 4.2) {
    let spawned = 0;
    for (let i = 0; i < this.maxCount && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.pos.set(
          x + (Math.random() - 0.5) * 0.65,
          y + (Math.random() - 0.5) * 0.65,
          z + (Math.random() - 0.5) * 0.65
        );
        p.vel.set(
          (Math.random() - 0.5) * speed,
          Math.random() * speed * 0.8 + 1.4,
          (Math.random() - 0.5) * speed
        );
        p.color.setHex(colorHex);
        p.color.multiplyScalar(0.85 + Math.random() * 0.3);
        p.maxLife = 0.35 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.size = 0.09 + Math.random() * 0.09;
        spawned++;
      }
    }
  }

  public update(dt: number, getBlockSolid: (x: number, y: number, z: number) => boolean) {
    let dirty = false;
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _mat4);
        dirty = true;
        continue;
      }

      p.vel.y -= 18 * dt;
      const nx = p.pos.x + p.vel.x * dt;
      const ny = p.pos.y + p.vel.y * dt;
      const nz = p.pos.z + p.vel.z * dt;

      if (getBlockSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        p.vel.y = Math.abs(p.vel.y) * 0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      } else {
        p.pos.set(nx, ny, nz);
      }

      const s = p.size * (p.life / p.maxLife);
      _euler.set(p.life * 7, p.life * 5, 0);
      _quat.setFromEuler(_euler);
      _scale.set(s, s, s);
      _mat4.compose(p.pos, _quat, _scale);
      this.mesh.setMatrixAt(i, _mat4);
      this.mesh.setColorAt(i, p.color);
      dirty = true;
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  public dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export function createDroppedItemMesh(id: BlockId): THREE.Mesh {
  const def = BLOCK_DEFS[id];
  const isBlock = def?.isBlock && id !== BlockId.TORCH;
  // Every dropped item uses crisp square BoxGeometry
  const geo = isBlock
    ? new THREE.BoxGeometry(0.28, 0.28, 0.28)
    : new THREE.BoxGeometry(0.24, 0.24, 0.08);

  const isMetal =
    (id >= BlockId.IRON_INGOT && id <= BlockId.EMERALD) ||
    (id >= BlockId.IRON_HELMET && id <= BlockId.DIAMOND_BOOTS) ||
    id === BlockId.GOLD_BLOCK ||
    id === BlockId.IRON_BLOCK ||
    id === BlockId.DIAMOND_BLOCK ||
    id === BlockId.EMERALD_BLOCK ||
    id === BlockId.GOLDEN_APPLE;

  const mat = new THREE.MeshStandardMaterial({
    color: getItemColor(id),
    roughness: isMetal ? 0.22 : 0.65,
    metalness: isMetal ? 0.72 : 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}
