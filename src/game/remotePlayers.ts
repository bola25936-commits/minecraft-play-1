import * as THREE from 'three';
import { getItemColor } from './entities';
import { RemotePlayerState } from './multiplayer';
import { DEFAULT_SKINS, PlayerSkin } from './skins';
import { BlockId } from './types';

export interface RemotePlayerAvatar {
  id: string;
  name: string;
  group: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  heldMesh: THREE.Mesh;
  nameSprite: THREE.Sprite;
  textures: THREE.Texture[];
  materials: THREE.Material[];
  targetPos: THREE.Vector3;
  targetYaw: number;
  targetPitch: number;
  isMoving: boolean;
  walkPhase: number;
  swingTimer: number;
  isSpeaking: boolean;
}

function makePixelCanvasTexture(
  grid: string[],
  gw: number,
  gh: number,
  flipY = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = gw * 4;
  canvas.height = gh * 4;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      ctx.fillStyle = grid[y * gw + x] || '#d69f7e';
      const dy = flipY ? gh - 1 - y : y;
      ctx.fillRect(x * 4, dy * 4, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeSolidPartTexture(hex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 4, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function paintNametagCanvas(canvas: HTMLCanvasElement, name: string, speaking: boolean) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const label = speaking ? `🔊 ${name}` : name;
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  const metrics = ctx.measureText(label);
  const padX = 18;
  const boxW = Math.min(248, Math.max(72, metrics.width + padX * 2));
  const boxX = (256 - boxW) / 2;

  ctx.fillStyle = speaking ? 'rgba(6, 55, 38, 0.88)' : 'rgba(10, 14, 22, 0.72)';
  ctx.fillRect(boxX, 8, boxW, 32);
  ctx.strokeStyle = speaking ? 'rgba(52, 211, 153, 0.95)' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = speaking ? 2.5 : 2;
  ctx.strokeRect(boxX, 8, boxW, 32);

  ctx.fillStyle = speaking ? '#a7f3d0' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 24);
}

function makeNametagSprite(name: string, speaking = false): { sprite: THREE.Sprite; tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  paintNametagCanvas(canvas, name, speaking);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.3, 1);
  sprite.position.set(0, 2.22, 0);
  sprite.renderOrder = 10;
  return { sprite, tex };
}

function buildHeadMaterials(skin: PlayerSkin, textures: THREE.Texture[], materials: THREE.Material[]) {
  const frontTex = makePixelCanvasTexture(skin.head, 8, 8);
  const hairTex = makeSolidPartTexture(skin.head[0] || '#4a2e1b');
  textures.push(frontTex, hairTex);

  const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.85 });
  const sideMat = new THREE.MeshStandardMaterial({ map: hairTex, roughness: 0.88 });
  materials.push(frontMat, sideMat);

  // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front/face), -Z (back)
  // Note: Player faces -Z in Three.js camera coords; we place face on -Z or rotate body yaw cleanly.
  // We'll place front face on -Z so yaw=0 looks forward along -Z matching player camera!
  return [sideMat, sideMat, sideMat, sideMat, sideMat, frontMat];
}

export function createRemotePlayerAvatar(state: RemotePlayerState): RemotePlayerAvatar {
  const skin = state.skin ?? DEFAULT_SKINS[0];
  const group = new THREE.Group();
  group.position.set(state.x, state.y, state.z);
  group.rotation.y = state.yaw;

  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const torsoTex = makePixelCanvasTexture(skin.torso, 8, 8);
  const armTex = makePixelCanvasTexture(skin.arm, 4, 8);
  const legTex = makePixelCanvasTexture(skin.leg, 4, 8);
  textures.push(torsoTex, armTex, legTex);

  const torsoMat = new THREE.MeshStandardMaterial({ map: torsoTex, roughness: 0.85 });
  const armMat = new THREE.MeshStandardMaterial({ map: armTex, roughness: 0.85 });
  const legMat = new THREE.MeshStandardMaterial({ map: legTex, roughness: 0.88 });
  materials.push(torsoMat, armMat, legMat);

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.38, 0);
  const headGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
  const headMats = buildHeadMaterials(skin, textures, materials);
  const headMesh = new THREE.Mesh(headGeo, headMats);
  headMesh.position.set(0, 0.24, 0);
  headMesh.castShadow = true;
  headGroup.add(headMesh);
  group.add(headGroup);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.48, 0.68, 0.24);
  const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
  torsoMesh.position.set(0, 1.04, 0);
  torsoMesh.castShadow = true;
  group.add(torsoMesh);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.2, 0.66, 0.2);
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.35, 1.34, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, armMat);
  leftArmMesh.position.set(0, -0.31, 0);
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);
  group.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.35, 1.34, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, armMat);
  rightArmMesh.position.set(0, -0.31, 0);
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);

  // Held Item mesh at right hand tip
  const heldGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const heldMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  materials.push(heldMat);
  const heldMesh = new THREE.Mesh(heldGeo, heldMat);
  heldMesh.position.set(0, -0.62, -0.14);
  heldMesh.visible = false;
  rightArmPivot.add(heldMesh);
  group.add(rightArmPivot);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12, 0.7, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, legMat);
  leftLegMesh.position.set(0, -0.35, 0);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12, 0.7, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, legMat);
  rightLegMesh.position.set(0, -0.35, 0);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);
  group.add(rightLegPivot);

  // Nametag
  const initialSpeaking = Boolean(state.isSpeaking);
  const { sprite: nameSprite, tex: nameTex } = makeNametagSprite(state.name, initialSpeaking);
  textures.push(nameTex);
  materials.push(nameSprite.material);
  group.add(nameSprite);

  const avatar: RemotePlayerAvatar = {
    id: state.id,
    name: state.name,
    group,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    heldMesh,
    nameSprite,
    textures,
    materials,
    targetPos: new THREE.Vector3(state.x, state.y, state.z),
    targetYaw: state.yaw,
    targetPitch: state.pitch,
    isMoving: state.isMoving,
    walkPhase: 0,
    swingTimer: 0,
    isSpeaking: initialSpeaking,
  };

  setAvatarHeldItem(avatar, state.heldItem);
  return avatar;
}

export function setAvatarSpeaking(avatar: RemotePlayerAvatar, speaking: boolean) {
  if (avatar.isSpeaking === speaking) return;
  avatar.isSpeaking = speaking;
  const mat = avatar.nameSprite.material as THREE.SpriteMaterial;
  const tex = mat.map as THREE.CanvasTexture | null;
  if (tex && tex.image instanceof HTMLCanvasElement) {
    paintNametagCanvas(tex.image, avatar.name, speaking);
    tex.needsUpdate = true;
  }
}

export function setAvatarHeldItem(avatar: RemotePlayerAvatar, itemId: BlockId | null) {
  if (!itemId) {
    avatar.heldMesh.visible = false;
    return;
  }
  avatar.heldMesh.visible = true;
  const mat = avatar.heldMesh.material as THREE.MeshStandardMaterial;
  mat.color.setHex(getItemColor(itemId));
}

export function updateAvatarSkin(avatar: RemotePlayerAvatar, skin: PlayerSkin | null) {
  const s = skin ?? DEFAULT_SKINS[0];
  const headMesh = avatar.headGroup.children[0] as THREE.Mesh | undefined;
  const torsoMesh = avatar.group.children.find(
    (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry && c !== headMesh
  ) as THREE.Mesh | undefined;
  const leftArmMesh = avatar.leftArmPivot.children[0] as THREE.Mesh | undefined;
  const rightArmMesh = avatar.rightArmPivot.children[0] as THREE.Mesh | undefined;
  const leftLegMesh = avatar.leftLegPivot.children[0] as THREE.Mesh | undefined;
  const rightLegMesh = avatar.rightLegPivot.children[0] as THREE.Mesh | undefined;

  if (headMesh) {
    const headMats = buildHeadMaterials(s, avatar.textures, avatar.materials);
    headMesh.material = headMats;
  }
  if (torsoMesh) {
    const tex = makePixelCanvasTexture(s.torso, 8, 8);
    avatar.textures.push(tex);
    const mat = torsoMesh.material as THREE.MeshStandardMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  }
  if (leftArmMesh && rightArmMesh) {
    const tex = makePixelCanvasTexture(s.arm, 4, 8);
    avatar.textures.push(tex);
    const mat = leftArmMesh.material as THREE.MeshStandardMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
    rightArmMesh.material = mat;
  }
  if (leftLegMesh && rightLegMesh) {
    const tex = makePixelCanvasTexture(s.leg, 4, 8);
    avatar.textures.push(tex);
    const mat = leftLegMesh.material as THREE.MeshStandardMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
    rightLegMesh.material = mat;
  }
}

export function animateRemotePlayerAvatar(avatar: RemotePlayerAvatar, dt: number) {
  avatar.group.position.x = THREE.MathUtils.damp(avatar.group.position.x, avatar.targetPos.x, 14, dt);
  avatar.group.position.y = THREE.MathUtils.damp(avatar.group.position.y, avatar.targetPos.y, 14, dt);
  avatar.group.position.z = THREE.MathUtils.damp(avatar.group.position.z, avatar.targetPos.z, 14, dt);

  // Shortest-angle yaw interpolation
  let diff = avatar.targetYaw - avatar.group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  avatar.group.rotation.y += diff * Math.min(1, dt * 14);
  avatar.headGroup.rotation.x = THREE.MathUtils.damp(avatar.headGroup.rotation.x, avatar.targetPitch, 14, dt);

  if (avatar.isMoving) {
    avatar.walkPhase += dt * 10;
  } else {
    avatar.walkPhase = THREE.MathUtils.damp(avatar.walkPhase, Math.round(avatar.walkPhase / Math.PI) * Math.PI, 8, dt);
  }

  const limbSwing = avatar.isMoving ? Math.sin(avatar.walkPhase) * 0.65 : 0;
  avatar.leftLegPivot.rotation.x = limbSwing;
  avatar.rightLegPivot.rotation.x = -limbSwing;
  avatar.leftArmPivot.rotation.x = -limbSwing * 0.85;

  let rightArmX = limbSwing * 0.85;
  if (avatar.swingTimer > 0) {
    avatar.swingTimer = Math.max(0, avatar.swingTimer - dt);
    const t = 1 - avatar.swingTimer / 0.24;
    rightArmX = Math.sin(t * Math.PI) * 1.15;
  }
  avatar.rightArmPivot.rotation.x = rightArmX;
}

export function disposeRemotePlayerAvatar(avatar: RemotePlayerAvatar) {
  avatar.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
      obj.geometry.dispose();
    }
  });
  for (const m of avatar.materials) m.dispose();
  for (const t of avatar.textures) t.dispose();
}
