import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { soundEngine } from './audio';
import {
  canCraftFromInventory,
  canSmeltFromInventory,
  CRAFT_RECIPES,
  CraftingRecipe,
  getRecipeIngredients,
  matchCraftingGrid,
  RECIPES,
} from './crafting';
import {
  createDroppedItemMesh,
  createMob,
  disposeMob,
  DroppedItem,
  getItemColor,
  MobEntity,
  MobKind,
  ParticlePool,
} from './entities';
import {
  buildStyledResourceAtlas,
  clearItemIconCache,
  createTerrainAtlas,
  getItemIconUrl,
  paintSquarePackAtlas,
  RESOURCE_PACK_VISUALS,
  TexturePackId,
} from './textures';
import { BehaviorPackId } from './marketplace';
import { addBlockToEngineInventory, createEmptyBlockInventory, TOTAL_SLOTS } from './inventory';
import { RemotePlayerState, RoomInfo } from './multiplayer';
import {
  animateRemotePlayerAvatar,
  createRemotePlayerAvatar,
  disposeRemotePlayerAvatar,
  RemotePlayerAvatar,
  setAvatarHeldItem,
  setAvatarSpeaking,
  updateAvatarSkin,
} from './remotePlayers';
import { buildArmSkinCanvas, DEFAULT_SKINS, getActiveSkin, PlayerSkin } from './skins';
import {
  ArmorSlotKey,
  BlockId,
  BLOCK_DEFS,
  createEmptyArmor,
  DimensionId,
  EquippedArmor,
  GameMode,
  GamePhase,
  HudSnapshot,
  InventorySlot,
  SavedWorldData,
  StationKind,
  WorldType,
} from './types';
import { PARKOUR_100_LEVELS } from './parkour100';
import { CHUNK_H, NETHER_LAVA_LEVEL, SEA_LEVEL, VoxelWorld } from './world';
import { createWorldId } from './worldsStorage';
import { WOULD_YOU_RATHER_LEVELS, WYR_FINISH_Y, WYR_FINISH_Z0, WYR_FINISH_Z1 } from './wouldYouRather100';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _m4 = new THREE.Matrix4();
const _rot4 = new THREE.Matrix4();
const _col = new THREE.Color();

const PLAYER_HALF_W = 0.28;
const PLAYER_H = 1.78;
const PLAYER_EYE = 1.6;
const GRAVITY = 26.0;
const JUMP_VEL = 9.0;
const DAY_LENGTH_SEC = 2400; // 40 minutes per full cycle (20 minutes day, 20 minutes night)

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onSaveWorld?: (save: SavedWorldData) => void;
  onLocalBlockSet?: (wx: number, wy: number, wz: number, blockId: BlockId) => void;
  onLocalChestUpdate?: (key: string, slots: (InventorySlot | null)[]) => void;
  onLocalMove?: (
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    heldItem: BlockId | null,
    isMoving: boolean
  ) => void;
  onLocalSwing?: () => void;
  onOpenChat?: () => void;
  onToggleVoice?: () => void;
}

export class VoxelGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private world!: VoxelWorld;
  private opaqueMat!: THREE.MeshStandardMaterial;
  private cutoutMat!: THREE.MeshStandardMaterial;
  private waterMat!: THREE.MeshPhysicalMaterial;
  private waterTexture!: THREE.CanvasTexture;
  private waterNormalTexture!: THREE.CanvasTexture;
  private shadowDiscTexture!: THREE.CanvasTexture;
  private pbrOpaqueTex!: THREE.CanvasTexture;
  private pbrCutoutTex!: THREE.CanvasTexture;
  private pbrNormalTex!: THREE.CanvasTexture;
  private pbrRoughnessTex!: THREE.CanvasTexture;
  private pbrMetalnessTex!: THREE.CanvasTexture;
  private pbrAtlasCanvas!: HTMLCanvasElement;
  private squareOpaqueTex!: THREE.CanvasTexture;
  private squareCutoutTex!: THREE.CanvasTexture;
  private squareAtlasCanvas!: HTMLCanvasElement;
  private squareNativeCanvas!: HTMLCanvasElement;
  private styledPackCache = new Map<
    TexturePackId,
    { canvas: HTMLCanvasElement; opaqueTexture: THREE.CanvasTexture; cutoutTexture: THREE.CanvasTexture }
  >();
  private bloomPass: UnrealBloomPass | null = null;
  private activeBehaviorPacks = new Set<BehaviorPackId>();
  public texturePack: TexturePackId = 'pbr';
  private pbrTextures: THREE.Texture[] = [];
  private crackTextures: THREE.CanvasTexture[] = [];
  public atlasCanvas!: HTMLCanvasElement;

  private shaderTimeUniform = { value: 0 };
  private shaderDayFactorUniform = { value: 1.0 };
  private shaderWetnessUniform = { value: 0.0 };
  private shaderSunDirUniform = { value: new THREE.Vector3(0.4, 0.8, -0.28).normalize() };
  private shaderHorizonColorUniform = { value: new THREE.Color(0xa6d6f8) };

  private skyMesh!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private grassTuftMesh!: THREE.InstancedMesh;
  private grassTuftMat!: THREE.MeshStandardMaterial;
  private grassDirty = true;
  private lastGrassX = 99999;
  private lastGrassZ = 99999;
  private moteMesh!: THREE.InstancedMesh;
  private moteData: { x: number; y: number; z: number; phase: number; speed: number }[] = [];
  private rainMesh!: THREE.InstancedMesh;
  private rainData: { x: number; y: number; z: number; speed: number }[] = [];
  public weatherMode: 'auto' | 'clear' | 'rain' = 'auto';
  private weatherTimer = 115;
  private isRainingAuto = false;
  private rainIntensity = 0;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private torchLight!: THREE.PointLight;
  private moonMesh!: THREE.Mesh;

  private targetOutline!: THREE.LineSegments;
  private crackMesh!: THREE.Mesh;
  private crackMat!: THREE.MeshBasicMaterial;
  private viewModelGroup!: THREE.Group;
  private viewArmMesh!: THREE.Mesh;
  private viewItemMesh!: THREE.Mesh;
  private playerArmTex: THREE.CanvasTexture | null = null;

  private particles!: ParticlePool;
  private mobs: MobEntity[] = [];
  private droppedItems: DroppedItem[] = [];
  private nextDropId = 1;
  private remotePlayers = new Map<string, RemotePlayerAvatar>();
  private isMultiplayer = false;
  private isApplyingRemoteUpdate = false;
  private inputSuppressed = false;

  // Game state
  public phase: GamePhase = 'title';
  public mode: GameMode = 'survival';
  public worldType: WorldType = 'normal';
  public dimension: DimensionId = 'overworld';
  public worldId: string = createWorldId();
  public worldName = 'Emerald Valley';
  public seed = 'voxel-valley-2026';
  public renderDistance = 5;
  public mouseSensitivity = 0.0022;
  private createdAt = Date.now();
  private autoSaveAccum = 0;

  private overworldModifiedBlocks = new Map<string, BlockId>();
  private netherModifiedBlocks = new Map<string, BlockId>();
  private overworldReturnPos = new THREE.Vector3(0.5, 30, 0.5);
  private netherReturnPos = new THREE.Vector3(0.5, 22, 0.5);

  // Player state
  private playerPos = new THREE.Vector3(0, 34, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private yaw = 0;
  private pitch = -0.15;
  private onGround = false;
  private isFlying = false;
  private isUnderwater = false;
  private inLavaUnderwater = false;
  private isUnderground = false;
  private caveDepthFactor = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private lastSpacePressTime = -1;
  private fallPeakY = 0;
  private portalChargeTimer = 0;
  private portalCooldown = 0;
  private lavaDamageTimer = 0;

  private health = 20;
  private maxHealth = 20;
  private hunger = 20;
  private maxHunger = 20;
  private hungerTimer = 0;
  private regenTimer = 0;

  private inventory: (InventorySlot | null)[] = createEmptyBlockInventory();
  private armor: EquippedArmor = createEmptyArmor();
  private selectedSlot = 0;
  private craftingGridSize: 2 | 3 = 2;
  private activeStation: StationKind = 'inventory';
  private activeChestPos: { x: number; y: number; z: number } | null = null;
  private chestInventories = new Map<string, (InventorySlot | null)[]>();

  // Time & Stats
  private timeOfDay = 0.055; // start early morning (~20 min until nightfall)
  private dayCount = 1;
  private blocksMined = 0;
  private blocksPlaced = 0;
  private mobsDefeated = 0;
  private statusMessage: string | null = null;
  private statusTimer = 0;
  private lastTutorialZone = '';
  private parkourCheckpoint = new THREE.Vector3(0.5, 32.5, 0.5);
  private parkourStage = 0;
  private parkourStartTime: number | null = null;
  private parkourFinished = false;
  private wyrStage = 0;
  private wyrChoices: ('A' | 'B')[] = [];
  private wyrLastChoice: 'A' | 'B' | null = null;
  private wyrP2Choice: 'A' | 'B' | null = null;
  private wyrFinished = false;
  private hardcoreDead = false;
  private spectating = false;

  private get isSurvivalLike(): boolean {
    return (this.mode === 'survival' || this.mode === 'hardcore') && !this.spectating;
  }

  // Mining & Combat feel
  private miningTarget: { x: number; y: number; z: number; id: BlockId } | null = null;
  private miningProgress = 0;
  private digSoundTimer = 0;
  private swingTimer = 0;
  private swingDuration = 0.22;
  private walkBobPhase = 0;
  private stepDistAccum = 0;
  private landingDip = 0;
  private baseFov = 72;
  private currentFov = 72;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private attackCooldown = 0;
  private mobSpawnTimer = 2.0;

  // Input
  private heldKeys = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private placeCooldown = 0;
  private pointerLocked = false;
  private pointerLockPending = false;
  private lastPointerUnlockTime = -10000;
  private lastPointerLockReqTime = -10000;
  private isDraggingFallback = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Player 1 HUD & avatars / Two-player split-screen state
  private twoPlayerMode = false;
  private p2Camera!: THREE.PerspectiveCamera;
  private p2TargetOutline!: THREE.LineSegments;
  private p2CrackMesh!: THREE.Mesh;
  private p2CrackMat!: THREE.MeshBasicMaterial;
  private p2ViewModelGroup!: THREE.Group;
  private p2ViewArmMesh!: THREE.Mesh;
  private p2ViewItemMesh!: THREE.Mesh;
  private p1Avatar: RemotePlayerAvatar | null = null;
  private p2Avatar: RemotePlayerAvatar | null = null;
  private currentSkin: PlayerSkin = getActiveSkin();
  private oneBlockCount = 0;

  private p2Pos = new THREE.Vector3(1.5, 34, 0.5);
  private p2Vel = new THREE.Vector3(0, 0, 0);
  private p2Yaw = 0;
  private p2Pitch = -0.15;
  private p2OnGround = false;
  private p2IsFlying = false;
  private p2IsUnderwater = false;
  private p2InLavaUnderwater = false;
  private p2CoyoteTimer = 0;
  private p2JumpBufferTimer = 0;
  private p2LastJumpPressTime = -1;
  private p2FallPeakY = 0;
  private p2LavaDamageTimer = 0;
  private p2Health = 20;
  private p2MaxHealth = 20;
  private p2Hunger = 20;
  private p2MaxHunger = 20;
  private p2HungerTimer = 0;
  private p2RegenTimer = 0;
  private p2Inventory: (InventorySlot | null)[] = createEmptyBlockInventory();
  private p2SelectedSlot = 0;
  private p2MiningTarget: { x: number; y: number; z: number; id: BlockId } | null = null;
  private p2MiningProgress = 0;
  private p2DigSoundTimer = 0;
  private p2SwingTimer = 0;
  private p2WalkBobPhase = 0;
  private p2StepDistAccum = 0;
  private p2LandingDip = 0;
  private p2AttackCooldown = 0;
  private p2PlaceCooldown = 0;

  // Loop
  private frameId = 0;
  private lastTime = performance.now();
  private hudEmitAccum = 0;
  private titlePanAngle = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks, initialWorld?: SavedWorldData) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec5f8);
    this.scene.fog = new THREE.Fog(0x8ec5f8, 36, 92);

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 220);
    this.scene.add(this.camera);

    this.p2Camera = new THREE.PerspectiveCamera(72, Math.max(0.5, aspect * 0.5), 0.1, 220);
    this.scene.add(this.p2Camera);

    // Studio environment map (mandatory per Three.js skill)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.44;
    pmrem.dispose();

    this.initTexturesAndMaterials();
    this.initLightingAndSky();
    this.initHelpersAndViewmodel();
    this.initTwoPlayerHelpers();

    this.particles = new ParticlePool(this.scene);

    if (initialWorld) {
      this.loadSavedWorld(initialWorld, false);
    } else {
      this.createNewWorld(this.seed, 'survival', false, 'Emerald Valley');
    }

    if (!this.isSoftwareGl) {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.5, 0.85);
      this.bloomPass = bloomPass;
      this.composer.addPass(bloomPass);
      this.composer.addPass(new OutputPass());
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.lastTime = performance.now();
    this.tick();
  }

  private initTexturesAndMaterials() {
    const atlas = createTerrainAtlas(this.renderer);
    this.waterTexture = atlas.waterTexture;
    this.waterNormalTexture = atlas.waterNormalTexture;
    this.shadowDiscTexture = atlas.shadowDiscTexture;
    this.crackTextures = atlas.crackTextures;
    this.pbrOpaqueTex = atlas.opaqueTexture;
    this.pbrCutoutTex = atlas.cutoutTexture;
    this.pbrNormalTex = atlas.normalTexture;
    this.pbrRoughnessTex = atlas.roughnessTexture;
    this.pbrMetalnessTex = atlas.metalnessTexture;
    this.pbrAtlasCanvas = atlas.atlasCanvas;
    this.squareOpaqueTex = atlas.squareOpaqueTexture;
    this.squareCutoutTex = atlas.squareCutoutTexture;
    this.squareAtlasCanvas = atlas.squareAtlasCanvas;
    this.squareNativeCanvas = atlas.squareNativeCanvas;
    this.atlasCanvas = this.texturePack === 'square' ? this.squareAtlasCanvas : this.pbrAtlasCanvas;
    this.pbrTextures.push(
      atlas.opaqueTexture,
      atlas.cutoutTexture,
      atlas.squareOpaqueTexture,
      atlas.squareCutoutTexture,
      atlas.normalTexture,
      atlas.roughnessTexture,
      atlas.metalnessTexture,
      atlas.emissiveTexture,
      atlas.waterNormalTexture,
      atlas.moonTexture,
      atlas.grassBladeTexture,
      atlas.moteTexture,
      atlas.shadowDiscTexture
    );

    const isSquare = this.texturePack === 'square';
    this.opaqueMat = new THREE.MeshStandardMaterial({
      map: isSquare ? this.squareOpaqueTex : this.pbrOpaqueTex,
      normalMap: isSquare ? null : this.pbrNormalTex,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: isSquare ? null : this.pbrRoughnessTex,
      roughness: isSquare ? 0.92 : 1.0,
      metalnessMap: isSquare ? null : this.pbrMetalnessTex,
      metalness: isSquare ? 0.0 : 1.0,
      emissiveMap: atlas.emissiveTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.35,
      vertexColors: true,
    });

    // Real-life world-space wet shoreline sheen, rain puddles, underwater sunlit caustics & macro variation
    this.opaqueMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.shaderTimeUniform;
      shader.uniforms.uDayFactor = this.shaderDayFactorUniform;
      shader.uniforms.uWetness = this.shaderWetnessUniform;
      shader.uniforms.uSeaLevel = { value: SEA_LEVEL + 0.88 };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTerrainWorldPos;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uDayFactor;
          uniform float uWetness;
          uniform float uSeaLevel;
          varying vec3 vTerrainWorldPos;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float macroVar = 0.94 + 0.06 * sin(vTerrainWorldPos.x * 0.11 + cos(vTerrainWorldPos.z * 0.09) * 1.4);
          diffuseColor.rgb *= macroVar;

          // Rain dampens exposed outdoor soil, wood, and stone
          if (uWetness > 0.01) {
            diffuseColor.rgb *= mix(1.0, 0.78, uWetness * 0.8);
          }

          // Wet shoreline darkening near sea level
          float wetBand = clamp(1.0 - abs(vTerrainWorldPos.y - uSeaLevel) / 1.1, 0.0, 1.0) * step(vTerrainWorldPos.y, uSeaLevel + 0.55);
          diffuseColor.rgb *= mix(1.0, 0.72, wetBand);

          // Shimmering sunlit underwater caustics on submerged terrain
          if (vTerrainWorldPos.y < uSeaLevel + 0.05 && vTerrainWorldPos.y > uSeaLevel - 11.0) {
            float depthFade = clamp(1.0 - (uSeaLevel - vTerrainWorldPos.y) / 11.0, 0.12, 1.0);
            float c1 = sin(vTerrainWorldPos.x * 2.1 + uTime * 1.9 + sin(vTerrainWorldPos.z * 1.8 - uTime * 1.3));
            float c2 = cos(vTerrainWorldPos.z * 2.4 - uTime * 1.7 + cos(vTerrainWorldPos.x * 1.6 + uTime * 1.5));
            float caustic = pow(clamp((c1 * c2) * 0.5 + 0.5, 0.0, 1.0), 4.0);
            diffuseColor.rgb += vec3(0.16, 0.34, 0.38) * caustic * depthFade * (0.25 + 0.75 * uDayFactor);
          }`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float wetGloss = clamp(1.0 - abs(vTerrainWorldPos.y - uSeaLevel) / 0.95, 0.0, 1.0) * step(vTerrainWorldPos.y, uSeaLevel + 0.45);
          roughnessFactor = mix(roughnessFactor, 0.14, max(wetGloss, uWetness * 0.72));`
        );
    };

    this.cutoutMat = new THREE.MeshStandardMaterial({
      map: isSquare ? this.squareCutoutTex : this.pbrCutoutTex,
      normalMap: isSquare ? null : this.pbrNormalTex,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: isSquare ? null : this.pbrRoughnessTex,
      roughness: isSquare ? 0.92 : 1.0,
      emissiveMap: atlas.emissiveTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.6,
      vertexColors: true,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
    });

    // Organic foliage wind sway via onBeforeCompile
    this.cutoutMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.shaderTimeUniform;
      shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sway = sin(uTime * 1.9 + position.x * 0.7 + position.z * 0.5 + position.y * 0.4) * 0.035;
        transformed.x += sway;
        transformed.z += cos(uTime * 1.5 + position.z * 0.8) * 0.025;`
      );
    };

    this.waterMat = new THREE.MeshPhysicalMaterial({
      map: this.waterTexture,
      normalMap: this.waterNormalTexture,
      normalScale: new THREE.Vector2(0.95, 0.95),
      color: new THREE.Color(0x5ab9eb),
      roughness: 0.06,
      metalness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      ior: 1.333,
      reflectivity: 0.95,
      envMapIntensity: 2.1,
      transparent: true,
      opacity: 0.74,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Real-life water: Gerstner wave motion + Fresnel sky reflection + sparkling sun glints
    this.waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.shaderTimeUniform;
      shader.uniforms.uSunDir = this.shaderSunDirUniform;
      shader.uniforms.uHorizonColor = this.shaderHorizonColorUniform;
      shader.uniforms.uDayFactor = this.shaderDayFactorUniform;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          varying vec3 vWaterWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.y += (sin(position.x * 1.35 + uTime * 2.1) * 0.55 + cos(position.z * 1.45 - uTime * 1.75) * 0.45 + sin((position.x + position.z) * 2.6 + uTime * 2.9) * 0.22) * 0.035;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform vec3 uSunDir;
          uniform vec3 uHorizonColor;
          uniform float uDayFactor;
          varying vec3 vWaterWorldPos;`
        )
        .replace(
          '#include <opaque_fragment>',
          `vec3 wViewDir = normalize(cameraPosition - vWaterWorldPos);
          vec3 wRippleN = normalize(vec3(
            sin(vWaterWorldPos.x * 3.8 + uTime * 2.7 + cos(vWaterWorldPos.z * 2.9 - uTime * 1.9)) * 0.11,
            1.0,
            cos(vWaterWorldPos.z * 3.6 - uTime * 2.3 + sin(vWaterWorldPos.x * 3.1 + uTime * 1.7)) * 0.11
          ));
          float wFresnel = pow(1.0 - clamp(dot(wViewDir, wRippleN), 0.0, 1.0), 3.6);
          vec3 skyRefl = uHorizonColor * (0.68 + 0.42 * uDayFactor);
          outgoingLight = mix(outgoingLight, skyRefl, wFresnel * 0.72);
          vec3 wReflDir = reflect(-wViewDir, wRippleN);
          float sunGlint = pow(max(dot(wReflDir, normalize(uSunDir)), 0.0), 88.0);
          outgoingLight += vec3(1.0, 0.94, 0.82) * sunGlint * 1.85 * uDayFactor;
          diffuseColor.a = mix(0.68, 0.94, wFresnel);
          #include <opaque_fragment>`
        );
    };

    // Instanced Wild Grass Tufts (crossed quad geometry with wind sway)
    const tuftGeo = new THREE.BufferGeometry();
    const hw = 0.38;
    const h = 0.62;
    const positions = new Float32Array([
      -hw, 0, -hw,  hw, 0, hw,  hw, h, hw,  -hw, h, -hw,
      -hw, 0, hw,   hw, 0, -hw, hw, h, -hw, -hw, h, hw,
    ]);
    const normals = new Float32Array([
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ]);
    const uvs = new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
    ]);
    tuftGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tuftGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    tuftGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    tuftGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);

    this.grassTuftMat = new THREE.MeshStandardMaterial({
      map: atlas.grassBladeTexture,
      alphaTest: 0.38,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.grassTuftMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.shaderTimeUniform;
      shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tip = clamp(position.y / 0.62, 0.0, 1.0);
        vec4 iPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float gust = sin(uTime * 2.2 + iPos.x * 0.45 + iPos.z * 0.35) * 0.095 + sin(uTime * 4.5 + iPos.x * 1.1) * 0.025;
        transformed.x += gust * tip * tip;
        transformed.z += cos(uTime * 1.7 + iPos.z * 0.5) * 0.045 * tip * tip;`
      );
    };

    this.grassTuftMesh = new THREE.InstancedMesh(tuftGeo, this.grassTuftMat, 1800);
    this.grassTuftMesh.frustumCulled = false;
    this.grassTuftMesh.setColorAt(0, _col.setHex(0xffffff));
    this.grassTuftMesh.count = 0;
    this.scene.add(this.grassTuftMesh);

    // Floating Atmospheric Pollen / Night Fireflies (Square InstancedMesh)
    const moteGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
    });
    const moteCount = 90;
    this.moteMesh = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    this.moteMesh.frustumCulled = false;
    for (let i = 0; i < moteCount; i++) {
      this.moteData.push({
        x: (Math.random() - 0.5) * 32,
        y: 0.4 + Math.random() * 5.5,
        z: (Math.random() - 0.5) * 32,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.7,
      });
    }
    this.scene.add(this.moteMesh);

    // Dynamic 3D Rain Streaks (InstancedMesh)
    const rainGeo = new THREE.BoxGeometry(0.016, 0.48, 0.016);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xbcd8f5,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const rainCount = 260;
    this.rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    for (let i = 0; i < rainCount; i++) {
      this.rainData.push({
        x: (Math.random() - 0.5) * 28,
        y: Math.random() * 18,
        z: (Math.random() - 0.5) * 28,
        speed: 17 + Math.random() * 6,
      });
    }
    this.scene.add(this.rainMesh);

    // Prepare cratered moon texture reference for initLightingAndSky
    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 8.5, 8.5),
      new THREE.MeshBasicMaterial({ map: atlas.moonTexture, color: 0xe6efff, fog: false })
    );
  }

  private initLightingAndSky() {
    this.hemiLight = new THREE.HemisphereLight(0xa3d8ff, 0x4f4132, 0.78);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.15);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const d = 42;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 165;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.torchLight = new THREE.PointLight(0xff9f40, 0, 16, 1.5);
    this.scene.add(this.torchLight);

    // Photorealistic Rayleigh/Mie Atmospheric Sky Dome + Volumetric FBM Clouds + Natural Solar Disc
    const skyGeo = new THREE.SphereGeometry(185, 36, 24);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSunDir: this.shaderSunDirUniform,
        uZenithColor: { value: new THREE.Color(0x2a6fc9) },
        uHorizonColor: this.shaderHorizonColorUniform,
        uSunColor: { value: new THREE.Color(0xfff1c9) },
        uNightFactor: { value: 0.0 },
        uWetness: this.shaderWetnessUniform,
        uTime: this.shaderTimeUniform,
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldDir;
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform float uNightFactor;
        uniform float uWetness;
        uniform float uTime;

        float hash2(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
            mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float cloudFbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise2(p);
            p = rot * p * 2.06 + vec2(13.1, 7.7);
            a *= 0.5;
          }
          return v;
        }

        float hash3(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          vec3 sunD = normalize(uSunDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uZenithColor, pow(h, 0.52));

          // Mie solar scatter, corona & warm natural solar disc
          float sunDot = max(dot(dir, sunD), 0.0);
          float corona = pow(sunDot, 12.0) * 0.42 + pow(sunDot, 110.0) * 0.95;
          float sunDisc = smoothstep(0.9986, 0.99945, sunDot) * 2.6;
          sky += uSunColor * (corona + sunDisc) * (1.0 - uNightFactor * 0.92) * (1.0 - uWetness * 0.78);

          // Procedural twinkling starfield at night (dimmed by rain clouds)
          if (uNightFactor > 0.05 && dir.y > 0.02 && uWetness < 0.85) {
            vec3 starCell = floor(dir * 230.0);
            float s = hash3(starCell);
            if (s > 0.9925) {
              float twinkle = 0.62 + 0.38 * sin(uTime * 3.0 + s * 100.0);
              sky += vec3(0.85, 0.92, 1.0) * uNightFactor * (1.0 - uWetness) * twinkle * smoothstep(0.02, 0.25, dir.y);
            }
          }

          // Multi-octave perspective volumetric FBM clouds with overcast rain darkening
          if (dir.y > 0.015) {
            vec2 cloudUv = dir.xz / (dir.y + 0.14) * 1.1 + vec2(uTime * 0.018, uTime * 0.007);
            float d = cloudFbm(cloudUv);
            float coverLo = mix(0.47, 0.26, uWetness);
            float coverHi = mix(0.78, 0.60, uWetness);
            float cov = smoothstep(coverLo, coverHi, d);
            float horizonFade = smoothstep(0.015, 0.22, dir.y);
            float shadowSample = cloudFbm(cloudUv + sunD.xz * 0.14);
            float lit = clamp(0.68 + (d - shadowSample) * 2.3, 0.28, 1.18);
            float silver = pow(sunDot, 8.0) * 0.46 * (1.0 - uNightFactor) * (1.0 - uWetness * 0.8);
            vec3 dayCloud = mix(vec3(0.68, 0.74, 0.84), vec3(1.0, 0.99, 0.96), lit);
            dayCloud = mix(dayCloud, vec3(0.42, 0.47, 0.54), uWetness * 0.72);
            vec3 nightCloud = mix(vec3(0.11, 0.15, 0.24), vec3(0.07, 0.09, 0.14), uWetness);
            vec3 cloudCol = mix(nightCloud, dayCloud, 1.0 - uNightFactor * 0.88) + uSunColor * silver;
            cloudCol = mix(cloudCol, uHorizonColor * 1.04, 0.22 * (1.0 - horizonFade));
            sky = mix(sky, cloudCol, cov * horizonFade * mix(0.84, 0.96, uWetness));
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);

    this.scene.add(this.moonMesh);
  }

  private initHelpersAndViewmodel() {
    // Target block wireframe
    const box = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    this.targetOutline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75 })
    );
    this.targetOutline.visible = false;
    this.scene.add(this.targetOutline);

    // Mining crack overlay
    const crackBox = new THREE.BoxGeometry(1.008, 1.008, 1.008);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.crackMesh = new THREE.Mesh(crackBox, this.crackMat);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    // First-person viewmodel attached to camera
    this.viewModelGroup = new THREE.Group();
    this.viewModelGroup.position.set(0.36, -0.32, -0.52);

    const armGeo = new THREE.BoxGeometry(0.16, 0.16, 0.54);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xd69f7e, roughness: 0.85, metalness: 0.02 });
    this.viewArmMesh = new THREE.Mesh(armGeo, armMat);
    this.viewArmMesh.rotation.set(0.15, -0.25, 0);

    const itemGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const itemMat = new THREE.MeshStandardMaterial({ color: 0x5cae3a, roughness: 0.75, metalness: 0.05 });
    this.viewItemMesh = new THREE.Mesh(itemGeo, itemMat);
    this.viewItemMesh.position.set(-0.04, 0.04, -0.08);
    this.viewItemMesh.rotation.set(0.1, 0.45, 0);
    this.viewItemMesh.visible = false;

    this.viewModelGroup.add(this.viewArmMesh, this.viewItemMesh);
    this.camera.add(this.viewModelGroup);
    this.setPlayerSkin(getActiveSkin());
  }

  public setPlayerSkin(skin: PlayerSkin) {
    this.currentSkin = skin;
    if (this.p1Avatar) {
      updateAvatarSkin(this.p1Avatar, skin);
    }
    if (!this.viewArmMesh) return;
    const canvas = buildArmSkinCanvas(skin);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    this.playerArmTex?.dispose();
    this.playerArmTex = tex;

    const mat = this.viewArmMesh.material as THREE.MeshStandardMaterial;
    mat.map = tex;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
  }

  private initTwoPlayerHelpers() {
    const p2Box = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const p2Edges = new THREE.EdgesGeometry(p2Box);
    p2Box.dispose();
    this.p2TargetOutline = new THREE.LineSegments(
      p2Edges,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    this.p2TargetOutline.visible = false;
    this.scene.add(this.p2TargetOutline);

    const p2CrackBox = new THREE.BoxGeometry(1.009, 1.009, 1.009);
    this.p2CrackMat = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.p2CrackMesh = new THREE.Mesh(p2CrackBox, this.p2CrackMat);
    this.p2CrackMesh.visible = false;
    this.scene.add(this.p2CrackMesh);

    this.p2ViewModelGroup = new THREE.Group();
    this.p2ViewModelGroup.position.set(0.36, -0.32, -0.52);

    const p2Skin = DEFAULT_SKINS[1] ?? DEFAULT_SKINS[0];
    const p2ArmCanvas = buildArmSkinCanvas(p2Skin);
    const p2ArmTex = new THREE.CanvasTexture(p2ArmCanvas);
    p2ArmTex.magFilter = THREE.NearestFilter;
    p2ArmTex.minFilter = THREE.NearestFilter;
    p2ArmTex.colorSpace = THREE.SRGBColorSpace;
    p2ArmTex.needsUpdate = true;

    const armGeo = new THREE.BoxGeometry(0.16, 0.16, 0.54);
    const armMat = new THREE.MeshStandardMaterial({ map: p2ArmTex, roughness: 0.85, metalness: 0.02 });
    this.p2ViewArmMesh = new THREE.Mesh(armGeo, armMat);
    this.p2ViewArmMesh.rotation.set(0.15, -0.25, 0);

    const itemGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const itemMat = new THREE.MeshStandardMaterial({ color: 0x5cae3a, roughness: 0.75, metalness: 0.05 });
    this.p2ViewItemMesh = new THREE.Mesh(itemGeo, itemMat);
    this.p2ViewItemMesh.position.set(-0.04, 0.04, -0.08);
    this.p2ViewItemMesh.rotation.set(0.1, 0.45, 0);
    this.p2ViewItemMesh.visible = false;

    this.p2ViewModelGroup.add(this.p2ViewArmMesh, this.p2ViewItemMesh);
    this.p2Camera.add(this.p2ViewModelGroup);

    this.p1Avatar = createRemotePlayerAvatar({
      id: 'local_p1',
      name: 'P1',
      skin: this.currentSkin,
      x: this.playerPos.x,
      y: this.playerPos.y,
      z: this.playerPos.z,
      yaw: this.yaw,
      pitch: this.pitch,
      heldItem: null,
      isMoving: false,
    });
    this.p1Avatar.group.visible = false;
    this.scene.add(this.p1Avatar.group);

    this.p2Avatar = createRemotePlayerAvatar({
      id: 'local_p2',
      name: 'P2',
      skin: p2Skin,
      x: this.p2Pos.x,
      y: this.p2Pos.y,
      z: this.p2Pos.z,
      yaw: this.p2Yaw,
      pitch: this.p2Pitch,
      heldItem: null,
      isMoving: false,
    });
    this.p2Avatar.group.visible = false;
    this.scene.add(this.p2Avatar.group);
  }

  public isTwoPlayerMode(): boolean {
    return this.twoPlayerMode;
  }

  public setTwoPlayerMode(enabled: boolean) {
    if (this.twoPlayerMode === enabled) return;
    this.twoPlayerMode = enabled;
    if (enabled) {
      this.spawnPlayer2NearP1(true);
      this.showStatus('2-Player Split-Screen Enabled! P1: WASD+Mouse · P2: Arrows+IJKL, R-Shift Jump, O Mine, P Place', 5.0);
    } else {
      if (this.p1Avatar) this.p1Avatar.group.visible = false;
      if (this.p2Avatar) this.p2Avatar.group.visible = false;
      this.p2TargetOutline.visible = false;
      this.p2CrackMesh.visible = false;
      this.p2MiningTarget = null;
      this.p2MiningProgress = 0;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.showStatus('Single-Player View Restored', 2.4);
    }
    this.emitHud();
  }

  private updateP2ViewModelItem() {
    if (!this.p2ViewArmMesh || !this.p2ViewItemMesh) return;
    const held = this.p2Inventory[this.p2SelectedSlot];
    if (!held) {
      this.p2ViewArmMesh.visible = true;
      this.p2ViewItemMesh.visible = false;
      return;
    }
    this.p2ViewArmMesh.visible = false;
    this.p2ViewItemMesh.visible = true;
    const mat = this.p2ViewItemMesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(getItemColor(held.id));
    const def = BLOCK_DEFS[held.id];
    if (def?.isBlock && held.id !== BlockId.TORCH) {
      this.p2ViewItemMesh.scale.set(1, 1, 1);
    } else if (held.id === BlockId.TORCH) {
      this.p2ViewItemMesh.scale.set(0.32, 1.35, 0.32);
    } else {
      this.p2ViewItemMesh.scale.set(0.45, 1.25, 0.16);
    }
  }

  private spawnPlayer2NearP1(resetInventory = false) {
    if (this.worldType === 'oneblock') {
      this.p2Pos.set(0.7, Math.max(33.5, this.playerPos.y), 0.5);
    } else if (this.worldType === 'skyblock' || this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      const candX = this.playerPos.x + 0.8;
      const candZ = this.playerPos.z;
      const sy = this.world ? this.world.getSurfaceY(candX, candZ) : this.playerPos.y;
      if (sy > 1) {
        this.p2Pos.set(candX, sy + 0.3, candZ);
      } else {
        this.p2Pos.set(this.playerPos.x, this.playerPos.y + 0.2, this.playerPos.z);
      }
    } else {
      const candX = this.playerPos.x + 1.4;
      const candZ = this.playerPos.z;
      const sy = this.world ? this.world.getSurfaceY(candX, candZ) : this.playerPos.y;
      this.p2Pos.set(candX, Math.max(this.playerPos.y, sy + 0.3), candZ);
    }
    this.p2Vel.set(0, 0, 0);
    this.p2Yaw = this.yaw;
    this.p2Pitch = this.pitch;
    this.p2FallPeakY = this.p2Pos.y;
    this.p2Health = 20;
    this.p2Hunger = 20;
    this.p2IsFlying = this.mode === 'creative';
    this.p2MiningTarget = null;
    this.p2MiningProgress = 0;
    if (resetInventory) {
      this.setupP2InitialInventory(this.mode);
    }
  }

  private setupP2InitialInventory(mode: GameMode) {
    this.p2Inventory = createEmptyBlockInventory();
    if (mode === 'creative') {
      const creativeKit: BlockId[] = [
        BlockId.GRASS,
        BlockId.OAK_PLANKS,
        BlockId.COBBLESTONE,
        BlockId.OBSIDIAN,
        BlockId.GLOWSTONE,
        BlockId.TORCH,
        BlockId.GLASS,
        BlockId.TNT,
        BlockId.CRAFTING_TABLE,
        BlockId.DIAMOND_PICKAXE,
        BlockId.DIAMOND_SWORD,
        BlockId.GOLDEN_APPLE,
      ];
      creativeKit.forEach((id, i) => {
        if (i < TOTAL_SLOTS) this.p2Inventory[i] = { id, count: BLOCK_DEFS[id].stackMax };
      });
    } else if (this.worldType === 'oneblock') {
      this.p2Inventory[0] = { id: BlockId.WOOD_PICKAXE, count: 1 };
      this.p2Inventory[1] = { id: BlockId.APPLE, count: 3 };
      this.p2Inventory[2] = { id: BlockId.TORCH, count: 2 };
    } else if (this.worldType === 'skyblock') {
      this.p2Inventory[0] = { id: BlockId.WOOD_PICKAXE, count: 1 };
      this.p2Inventory[1] = { id: BlockId.COBBLESTONE, count: 8 };
      this.p2Inventory[2] = { id: BlockId.TORCH, count: 2 };
      this.p2Inventory[3] = { id: BlockId.APPLE, count: 2 };
    } else if (this.worldType === 'tutorial') {
      this.p2Inventory[0] = { id: BlockId.WOOD_PICKAXE, count: 1 };
      this.p2Inventory[1] = { id: BlockId.WOOD_AXE, count: 1 };
      this.p2Inventory[2] = { id: BlockId.WOOD_SWORD, count: 1 };
      this.p2Inventory[3] = { id: BlockId.OAK_PLANKS, count: 16 };
      this.p2Inventory[4] = { id: BlockId.APPLE, count: 4 };
    } else if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      this.p2Inventory[0] = { id: BlockId.APPLE, count: 6 };
      this.p2Inventory[1] = { id: BlockId.BREAD, count: 4 };
      this.p2Inventory[2] = { id: BlockId.GOLDEN_APPLE, count: 1 };
    } else {
      this.p2Inventory[0] = { id: BlockId.WOOD_PICKAXE, count: 1 };
      this.p2Inventory[1] = { id: BlockId.TORCH, count: 4 };
      this.p2Inventory[2] = { id: BlockId.APPLE, count: 3 };
    }
    this.p2SelectedSlot = 0;
    this.updateP2ViewModelItem();
  }

  private getOneBlockPhaseInfo(count: number): { phaseName: string; pool: BlockId[] } {
    if (count < 12) {
      return {
        phaseName: 'Phase 1 · Plains Meadow',
        pool: [BlockId.GRASS, BlockId.DIRT, BlockId.OAK_LOG, BlockId.LEAVES, BlockId.GRASS, BlockId.OAK_LOG, BlockId.DIRT],
      };
    }
    if (count < 25) {
      return {
        phaseName: 'Phase 2 · Oak Timberlands',
        pool: [BlockId.OAK_LOG, BlockId.OAK_PLANKS, BlockId.GRASS, BlockId.LEAVES, BlockId.DIRT, BlockId.STONE, BlockId.COAL_ORE],
      };
    }
    if (count < 42) {
      return {
        phaseName: 'Phase 3 · Stone Cavern',
        pool: [BlockId.STONE, BlockId.COBBLESTONE, BlockId.COAL_ORE, BlockId.IRON_ORE, BlockId.GRAVEL, BlockId.DEEPSLATE, BlockId.OAK_LOG],
      };
    }
    if (count < 60) {
      return {
        phaseName: 'Phase 4 · Sunlit Mesa',
        pool: [BlockId.SAND, BlockId.SANDSTONE, BlockId.CACTUS, BlockId.COAL_ORE, BlockId.IRON_ORE, BlockId.GOLD_ORE, BlockId.GLASS],
      };
    }
    if (count < 80) {
      return {
        phaseName: 'Phase 5 · Crystal Grotto',
        pool: [BlockId.DEEPSLATE, BlockId.CAVE_MOSS, BlockId.DRIPSTONE, BlockId.CRYSTAL_CLUSTER, BlockId.IRON_ORE, BlockId.GOLD_ORE, BlockId.DIAMOND_ORE],
      };
    }
    if (count < 100) {
      return {
        phaseName: 'Phase 6 · Nether Forge',
        pool: [BlockId.NETHERRACK, BlockId.SOUL_SAND, BlockId.QUARTZ_ORE, BlockId.GLOWSTONE, BlockId.NETHER_BRICKS, BlockId.GOLD_ORE, BlockId.OBSIDIAN],
      };
    }
    return {
      phaseName: 'Phase 7 · Diamond Odyssey',
      pool: [BlockId.DIAMOND_ORE, BlockId.EMERALD_ORE, BlockId.OBSIDIAN, BlockId.GOLD_ORE, BlockId.IRON_ORE, BlockId.CRYSTAL_CLUSTER, BlockId.GLOWSTONE, BlockId.OAK_LOG, BlockId.GRASS],
    };
  }

  private regenerateOneBlockCore() {
    const prevPhase = this.getOneBlockPhaseInfo(this.oneBlockCount).phaseName;
    this.oneBlockCount++;
    const nextInfo = this.getOneBlockPhaseInfo(this.oneBlockCount);

    let nextBlock: BlockId;
    if (this.oneBlockCount % 20 === 0) {
      nextBlock = BlockId.CHEST;
      const chest = this.createEmptyChest();
      chest[0] = { id: BlockId.OAK_PLANKS, count: 8 };
      chest[1] = { id: BlockId.APPLE, count: 4 };
      chest[2] = { id: BlockId.TORCH, count: 4 };
      chest[3] = { id: BlockId.IRON_INGOT, count: 3 };
      if (this.oneBlockCount >= 40) {
        chest[4] = { id: BlockId.DIAMOND, count: 2 };
      }
      if (this.oneBlockCount >= 60) {
        chest[5] = { id: BlockId.GOLDEN_APPLE, count: 1 };
      }
      this.chestInventories.set(this.chestKey(0, 32, 0), chest);
      this.showStatus(`Bonus Supply Chest spawned on Block #${this.oneBlockCount}! Right-Click to loot`, 3.6);
    } else {
      const idx = (this.oneBlockCount * 7 + Math.floor(Math.random() * nextInfo.pool.length)) % nextInfo.pool.length;
      nextBlock = nextInfo.pool[idx];
    }

    this.world.setBlock(0, 32, 0, nextBlock);
    if (!this.isApplyingRemoteUpdate) {
      this.callbacks.onLocalBlockSet?.(0, 32, 0, nextBlock);
    }
    this.particles.spawnBurst(0.5, 33.1, 0.5, 0x34d399, 14, 4.0);

    if (nextInfo.phaseName !== prevPhase) {
      this.particles.spawnBurst(0.5, 33.6, 0.5, 0xfbbf24, 24, 5.2);
      this.showStatus(`One Block Level Up! ${nextInfo.phaseName}`, 4.5);
    }

    if (this.oneBlockCount % 12 === 0) {
      // Spawn a friendly animal on adjacent expanded platform if player built footing, else pop a bonus item
      let spawnedMob = false;
      for (let dx = -2; dx <= 2 && !spawnedMob; dx++) {
        for (let dz = -2; dz <= 2 && !spawnedMob; dz++) {
          if (dx === 0 && dz === 0) continue;
          if (this.isBlockSolid(dx, 32, dz) && !this.isBlockSolid(dx, 33, dz) && !this.isBlockSolid(dx, 34, dz)) {
            const kinds: MobKind[] = ['pig', 'cow', 'sheep', 'chicken'];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            const mob = createMob(kind, dx + 0.5, 33, dz + 0.5, this.shadowDiscTexture);
            this.mobs.push(mob);
            this.scene.add(mob.group);
            spawnedMob = true;
          }
        }
      }
      if (!spawnedMob) {
        const bonusPool = [BlockId.APPLE, BlockId.BREAD, BlockId.OAK_LOG, BlockId.TORCH, BlockId.COAL];
        const bonus = bonusPool[Math.floor(Math.random() * bonusPool.length)];
        this.spawnDroppedItem(bonus, 1, 0.5, 33.5, 0.5, 0, 3.8, 0);
      }
    }
  }

  private syncActiveDimensionState() {
    if (!this.world) return;
    if (this.dimension === 'nether') {
      this.netherModifiedBlocks = new Map(this.world.modifiedBlocks);
      this.netherReturnPos.copy(this.playerPos);
    } else {
      this.overworldModifiedBlocks = new Map(this.world.modifiedBlocks);
      this.overworldReturnPos.copy(this.playerPos);
    }
  }

  public exportWorldSave(): SavedWorldData {
    this.syncActiveDimensionState();
    return {
      id: this.worldId,
      name: this.worldName,
      seed: this.seed,
      mode: this.mode,
      hardcoreDead: this.mode === 'hardcore' && this.hardcoreDead ? true : undefined,
      worldType: this.worldType,
      oneBlockCount: this.oneBlockCount,
      wyrStage: this.wyrStage,
      wyrChoices: this.worldType === 'wouldyourather' ? [...this.wyrChoices] : undefined,
      createdAt: this.createdAt,
      lastPlayedAt: Date.now(),
      dayCount: this.dayCount,
      timeOfDay: this.timeOfDay,
      blocksMined: this.blocksMined,
      blocksPlaced: this.blocksPlaced,
      mobsDefeated: this.mobsDefeated,
      playerPos: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      hunger: this.hunger,
      isFlying: this.isFlying,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      armor: this.cloneArmor(),
      chestInventories: Object.fromEntries(
        Array.from(this.chestInventories.entries()).map(([k, slots]) => [
          k,
          slots.map((s) => (s ? { ...s } : null)),
        ])
      ),
      modifiedBlocks: Array.from(this.overworldModifiedBlocks.entries()),
      dimension: this.dimension,
      netherModifiedBlocks: Array.from(this.netherModifiedBlocks.entries()),
      overworldPos: [this.overworldReturnPos.x, this.overworldReturnPos.y, this.overworldReturnPos.z],
      netherPos: [this.netherReturnPos.x, this.netherReturnPos.y, this.netherReturnPos.z],
    };
  }

  public triggerAutoSave() {
    if (!this.world || this.isMultiplayer) return;
    this.callbacks.onSaveWorld?.(this.exportWorldSave());
  }

  public renameCurrentWorld(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.worldName = trimmed;
    this.emitHud();
  }

  private clearRemotePlayers() {
    for (const avatar of this.remotePlayers.values()) {
      this.scene.remove(avatar.group);
      disposeRemotePlayerAvatar(avatar);
    }
    this.remotePlayers.clear();
  }

  private clearWorldObjects() {
    this.clearRemotePlayers();
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    for (const m of this.mobs) {
      this.scene.remove(m.group);
      disposeMob(m);
    }
    this.mobs = [];
    for (const d of this.droppedItems) {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    }
    this.droppedItems = [];
  }

  public createNewWorld(
    seed: string,
    mode: GameMode,
    startPlaying: boolean,
    worldName?: string,
    worldId?: string,
    worldType?: WorldType
  ) {
    this.isMultiplayer = false;
    this.dimension = 'overworld';
    this.overworldModifiedBlocks.clear();
    this.netherModifiedBlocks.clear();
    this.portalChargeTimer = 0;
    this.portalCooldown = 0;
    this.lavaDamageTimer = 0;
    this.inLavaUnderwater = false;
    this.worldId = worldId || createWorldId();
    this.seed = seed.trim() || 'voxel-valley-2026';
    const lowerSeed = this.seed.toLowerCase();
    this.worldType =
      worldType ??
      (lowerSeed.startsWith('oneblock')
        ? 'oneblock'
        : lowerSeed.startsWith('wouldyourather') || lowerSeed.startsWith('wyr100')
          ? 'wouldyourather'
          : lowerSeed.startsWith('skyblock')
            ? 'skyblock'
            : lowerSeed.startsWith('tutorial')
              ? 'tutorial'
              : lowerSeed.startsWith('parkour100')
                ? 'parkour100'
                : lowerSeed.startsWith('parkour')
                  ? 'parkour'
                  : 'normal');
    this.worldName =
      worldName?.trim() ||
      (this.worldType === 'oneblock'
        ? 'One Block Challenge'
        : this.worldType === 'wouldyourather'
          ? '100-Level Would You Rather'
          : this.worldType === 'skyblock'
            ? 'Skyblock Island'
            : this.worldType === 'tutorial'
              ? 'Tutorial World'
              : this.worldType === 'parkour100'
                ? '100-Level Parkour'
                : this.worldType === 'parkour'
                  ? 'Parkour Course'
                  : 'New World');
    this.mode = mode;
    this.hardcoreDead = false;
    this.spectating = false;
    this.createdAt = Date.now();
    this.autoSaveAccum = 0;
    this.oneBlockCount = 0;
    this.lastTutorialZone = '';
    this.resetParkourProgress();
    this.resetWyrProgress();
    this.activeStation = 'inventory';
    this.activeChestPos = null;
    this.chestInventories.clear();
    this.seedDefaultWorldChests();

    this.clearWorldObjects();

    this.world = new VoxelWorld(this.seed, this.opaqueMat, this.cutoutMat, this.waterMat, this.worldType, 'overworld');
    this.scene.add(this.world.group);

    // Pre-generate spawn chunks synchronously so player & title camera land on solid terrain
    const minCz =
      this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather'
        ? -4
        : -3;
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = minCz; cz <= 3; cz++) {
        const ch = this.world.generateChunk(cx, cz);
        this.world.rebuildChunkMesh(ch);
      }
    }

    const spawnY = this.world.getSurfaceY(0, 0) + 0.5;
    if (this.worldType === 'oneblock') {
      this.playerPos.set(0.32, Math.max(33.5, spawnY), 0.5);
    } else if (this.worldType === 'skyblock') {
      this.playerPos.set(0.5, Math.max(33.5, spawnY), 0.5);
    } else if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      this.playerPos.set(0.5, Math.max(32.5, spawnY), 0.5);
    } else if (this.worldType === 'tutorial') {
      this.playerPos.set(0.5, Math.max(26.5, spawnY), 0.5);
    } else {
      this.playerPos.set(0.5, Math.max(SEA_LEVEL + 2, spawnY), 0.5);
    }
    this.overworldReturnPos.copy(this.playerPos);
    this.netherReturnPos.set(0.5, 22, 0.5);
    this.playerVel.set(0, 0, 0);
    this.fallPeakY = this.playerPos.y;
    this.yaw =
      this.worldType === 'tutorial' ||
      this.worldType === 'parkour' ||
      this.worldType === 'parkour100' ||
      this.worldType === 'wouldyourather'
        ? 0
        : 0.4;
    this.pitch = -0.15;

    this.health = 20;
    this.hunger = 20;
    this.dayCount = 1;
    this.timeOfDay = 0.055;
    this.blocksMined = 0;
    this.blocksPlaced = 0;
    this.mobsDefeated = 0;
    this.isFlying = mode === 'creative';
    this.armor = createEmptyArmor();

    this.setupInitialInventory(mode);
    this.spawnPlayer2NearP1(true);
    this.spawnInitialMobs();
    this.grassDirty = true;

    if (startPlaying) {
      this.setPhase('playing');
      this.requestPointerLock();
      this.triggerAutoSave();
      if (this.mode === 'hardcore') {
        this.showStatus('HARDCORE MODE — 1 Life, Tougher Mobs, No Respawn!', 5.0);
      } else if (this.worldType === 'oneblock') {
        this.showStatus('One Block — Mine the single floating block beneath you to evolve through 7 Phases!', 5.0);
      } else if (this.worldType === 'wouldyourather') {
        this.showStatus('Would You Rather (100 Levels) — Walk through Emerald Gate (A) or Gold Gate (B) each stage! (R = Checkpoint)', 5.2);
      } else if (this.worldType === 'skyblock') {
        this.showStatus('Skyblock Island — Bridge to nearby floating islands & survive!');
      } else if (this.worldType === 'tutorial') {
        this.lastTutorialZone = 'courtyard';
        this.showStatus('Welcome to Tutorial World! Walk with WASD, Press E for Crafting', 4.5);
      } else if (this.worldType === 'parkour100') {
        this.showStatus('100-Level Parkour — Conquer all 100 Levels across 10 Biomes! (R = Checkpoint)', 5.2);
      } else if (this.worldType === 'parkour') {
        this.showStatus('Sky Parkour — Reach the Gold Checkpoints & Diamond Summit! (R = Reset)', 4.8);
      }
    } else {
      this.setPhase('title');
    }
    this.emitHud();
  }

  public loadSavedWorld(save: SavedWorldData, startPlaying: boolean) {
    this.isMultiplayer = false;
    this.worldId = save.id;
    this.worldName = save.name || 'Saved World';
    this.seed = save.seed || 'voxel-valley-2026';
    this.mode = save.mode || 'survival';
    this.hardcoreDead = this.mode === 'hardcore' && Boolean(save.hardcoreDead);
    this.spectating = this.hardcoreDead;
    const lowerSeed = this.seed.toLowerCase();
    this.worldType =
      save.worldType ??
      (lowerSeed.startsWith('oneblock')
        ? 'oneblock'
        : lowerSeed.startsWith('wouldyourather') || lowerSeed.startsWith('wyr100')
          ? 'wouldyourather'
          : lowerSeed.startsWith('skyblock')
            ? 'skyblock'
            : lowerSeed.startsWith('tutorial')
              ? 'tutorial'
              : lowerSeed.startsWith('parkour100')
                ? 'parkour100'
                : lowerSeed.startsWith('parkour')
                  ? 'parkour'
                  : 'normal');
    this.oneBlockCount = typeof save.oneBlockCount === 'number' ? save.oneBlockCount : 0;
    this.createdAt = save.createdAt || Date.now();
    this.autoSaveAccum = 0;
    this.lastTutorialZone = '';
    this.resetParkourProgress();
    this.resetWyrProgress();
    if (this.worldType === 'wouldyourather') {
      this.wyrStage = Math.max(0, Math.min(100, typeof save.wyrStage === 'number' ? save.wyrStage : 0));
      this.wyrChoices = Array.isArray(save.wyrChoices) ? save.wyrChoices.slice(0, 100) : [];
      this.wyrFinished = this.wyrStage >= 100;
      const cpLvl = WOULD_YOU_RATHER_LEVELS[Math.min(100, this.wyrStage)];
      if (cpLvl && cpLvl.level > 0) {
        this.parkourCheckpoint.set(0.5, cpLvl.y + 1.4, (cpLvl.exitZ1 + cpLvl.exitZ0) * 0.5);
      }
    }
    this.activeStation = 'inventory';
    this.activeChestPos = null;
    this.chestInventories.clear();
    if (save.chestInventories && typeof save.chestInventories === 'object') {
      for (const [k, rawSlots] of Object.entries(save.chestInventories)) {
        if (Array.isArray(rawSlots)) {
          const chest = this.createEmptyChest();
          for (let i = 0; i < chest.length; i++) {
            const s = rawSlots[i];
            chest[i] = s ? { id: s.id, count: s.count } : null;
          }
          this.chestInventories.set(k, chest);
        }
      }
    }

    this.clearWorldObjects();

    this.dimension = save.dimension === 'nether' ? 'nether' : 'overworld';
    this.portalChargeTimer = 0;
    this.portalCooldown = 1.5;
    this.lavaDamageTimer = 0;
    this.inLavaUnderwater = false;
    this.overworldModifiedBlocks.clear();
    if (Array.isArray(save.modifiedBlocks)) {
      for (const [k, v] of save.modifiedBlocks) {
        this.overworldModifiedBlocks.set(k, v);
      }
    }
    this.netherModifiedBlocks.clear();
    if (Array.isArray(save.netherModifiedBlocks)) {
      for (const [k, v] of save.netherModifiedBlocks) {
        this.netherModifiedBlocks.set(k, v);
      }
    }
    this.overworldReturnPos.set(
      save.overworldPos?.[0] ?? save.playerPos?.[0] ?? 0.5,
      save.overworldPos?.[1] ?? save.playerPos?.[1] ?? 30,
      save.overworldPos?.[2] ?? save.playerPos?.[2] ?? 0.5
    );
    this.netherReturnPos.set(
      save.netherPos?.[0] ?? 0.5,
      save.netherPos?.[1] ?? 22,
      save.netherPos?.[2] ?? 0.5
    );

    this.world = new VoxelWorld(this.seed, this.opaqueMat, this.cutoutMat, this.waterMat, this.worldType, this.dimension);
    const activeModMap = this.dimension === 'nether' ? this.netherModifiedBlocks : this.overworldModifiedBlocks;
    for (const [k, v] of activeModMap) {
      this.world.modifiedBlocks.set(k, v);
    }
    this.scene.add(this.world.group);

    const px = save.playerPos?.[0] ?? 0.5;
    const pz = save.playerPos?.[2] ?? 0.5;
    const baseCx = Math.floor(px / 16);
    const baseCz = Math.floor(pz / 16);
    for (let cx = baseCx - 3; cx <= baseCx + 3; cx++) {
      for (let cz = baseCz - 3; cz <= baseCz + 3; cz++) {
        const ch = this.world.generateChunk(cx, cz);
        this.world.rebuildChunkMesh(ch);
      }
    }
    if (Math.abs(baseCx) > 3 || Math.abs(baseCz) > 3) {
      for (let cx = -2; cx <= 2; cx++) {
        for (let cz = -2; cz <= 2; cz++) {
          const ch = this.world.generateChunk(cx, cz);
          this.world.rebuildChunkMesh(ch);
        }
      }
    }

    const fallbackY = this.world.getSurfaceY(px, pz) + 0.5;
    const safeMinY =
      this.worldType === 'skyblock' || this.worldType === 'oneblock'
        ? 33.5
        : this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather'
          ? 32.5
          : SEA_LEVEL + 2;
    this.playerPos.set(px, save.playerPos?.[1] ?? Math.max(safeMinY, fallbackY), pz);
    this.playerVel.set(0, 0, 0);
    this.fallPeakY = this.playerPos.y;
    this.yaw = typeof save.yaw === 'number' ? save.yaw : 0.4;
    this.pitch = typeof save.pitch === 'number' ? save.pitch : -0.15;

    this.health = typeof save.health === 'number' ? save.health : 20;
    this.hunger = typeof save.hunger === 'number' ? save.hunger : 20;
    this.dayCount = typeof save.dayCount === 'number' ? save.dayCount : 1;
    this.timeOfDay = typeof save.timeOfDay === 'number' ? save.timeOfDay : 0.055;
    this.blocksMined = save.blocksMined || 0;
    this.blocksPlaced = save.blocksPlaced || 0;
    this.mobsDefeated = save.mobsDefeated || 0;
    this.isFlying = Boolean(save.isFlying);

    this.inventory = createEmptyBlockInventory();
    if (Array.isArray(save.inventory)) {
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        const s = save.inventory[i];
        this.inventory[i] = s ? { id: s.id, count: s.count } : null;
      }
    } else {
      this.setupInitialInventory(this.mode);
    }
    this.armor = createEmptyArmor();
    if (save.armor && typeof save.armor === 'object') {
      const keys: ArmorSlotKey[] = ['helmet', 'chestplate', 'leggings', 'boots'];
      for (const k of keys) {
        const piece = save.armor[k];
        this.armor[k] = piece ? { id: piece.id, count: piece.count } : null;
      }
    }
    this.selectedSlot = 0;
    this.updateViewModelItem();
    this.spawnPlayer2NearP1(true);

    this.spawnInitialMobs();
    this.grassDirty = true;
    this.updateDayNightAndLighting(0);

    if (this.spectating) {
      this.isFlying = true;
      this.p2IsFlying = true;
    }

    if (startPlaying) {
      if (this.hardcoreDead) {
        this.spectateHardcoreWorld();
      } else {
        this.setPhase('playing');
        this.requestPointerLock();
      }
    } else {
      this.setPhase('title');
    }
    this.emitHud();
  }

  private setupInitialInventory(mode: GameMode) {
    this.inventory = createEmptyBlockInventory();
    if (mode === 'creative') {
      const creativeKit: BlockId[] = [
        BlockId.GRASS,
        BlockId.OAK_PLANKS,
        BlockId.COBBLESTONE,
        BlockId.OBSIDIAN,
        BlockId.FLINT_AND_STEEL,
        BlockId.NETHERRACK,
        BlockId.NETHER_BRICKS,
        BlockId.GLOWSTONE,
        BlockId.TORCH,
        BlockId.SOUL_SAND,
        BlockId.QUARTZ_ORE,
        BlockId.LAVA,
        BlockId.GLASS,
        BlockId.TNT,
        BlockId.CHEST,
        BlockId.BOOKSHELF,
        BlockId.STONE,
        BlockId.DEEPSLATE,
        BlockId.CAVE_MOSS,
        BlockId.DRIPSTONE,
        BlockId.CRYSTAL_CLUSTER,
        BlockId.GLOW_VINE,
        BlockId.OAK_LOG,
        BlockId.BRICK,
        BlockId.GOLD_BLOCK,
        BlockId.IRON_BLOCK,
        BlockId.DIAMOND_BLOCK,
        BlockId.CRAFTING_TABLE,
        BlockId.FURNACE,
        BlockId.DIAMOND_PICKAXE,
        BlockId.DIAMOND_SWORD,
        BlockId.DIAMOND_AXE,
        BlockId.GOLDEN_APPLE,
        BlockId.DIAMOND_HELMET,
        BlockId.DIAMOND_CHESTPLATE,
        BlockId.DIAMOND_BOOTS,
      ];
      creativeKit.forEach((id, i) => {
        if (i < TOTAL_SLOTS) this.inventory[i] = { id, count: BLOCK_DEFS[id].stackMax };
      });
    } else if (this.worldType === 'oneblock') {
      this.inventory[0] = { id: BlockId.WOOD_PICKAXE, count: 1 };
      this.inventory[1] = { id: BlockId.APPLE, count: 3 };
      this.inventory[2] = { id: BlockId.TORCH, count: 2 };
    } else if (this.worldType === 'skyblock') {
      this.inventory[0] = { id: BlockId.WOOD_PICKAXE, count: 1 };
      this.inventory[1] = { id: BlockId.COBBLESTONE, count: 8 };
      this.inventory[2] = { id: BlockId.TORCH, count: 2 };
      this.inventory[3] = { id: BlockId.APPLE, count: 2 };
    } else if (this.worldType === 'tutorial') {
      this.inventory[0] = { id: BlockId.WOOD_PICKAXE, count: 1 };
      this.inventory[1] = { id: BlockId.WOOD_AXE, count: 1 };
      this.inventory[2] = { id: BlockId.WOOD_SHOVEL, count: 1 };
      this.inventory[3] = { id: BlockId.WOOD_SWORD, count: 1 };
      this.inventory[4] = { id: BlockId.OAK_PLANKS, count: 16 };
      this.inventory[5] = { id: BlockId.COBBLESTONE, count: 16 };
      this.inventory[6] = { id: BlockId.TORCH, count: 8 };
      this.inventory[7] = { id: BlockId.APPLE, count: 4 };
    } else if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      this.inventory[0] = { id: BlockId.APPLE, count: 6 };
      this.inventory[1] = { id: BlockId.BREAD, count: 4 };
      this.inventory[2] = { id: BlockId.GOLDEN_APPLE, count: 1 };
      this.inventory[3] = { id: BlockId.TORCH, count: 4 };
    }
    this.selectedSlot = 0;
    this.updateViewModelItem();
  }

  private pickPassiveMobKind(biome: string): MobKind {
    const r = Math.random();
    if (biome === 'Alpine Peaks') {
      if (r < 0.36) return 'wolf';
      if (r < 0.72) return 'sheep';
      if (r < 0.88) return 'pig';
      return 'chicken';
    }
    if (biome === 'Oak Forest') {
      if (r < 0.24) return 'wolf';
      if (r < 0.46) return 'pig';
      if (r < 0.68) return 'cow';
      if (r < 0.88) return 'chicken';
      return 'sheep';
    }
    if (biome === 'Desert') {
      if (r < 0.45) return 'chicken';
      if (r < 0.75) return 'wolf';
      return 'sheep';
    }
    if (r < 0.25) return 'pig';
    if (r < 0.5) return 'cow';
    if (r < 0.74) return 'sheep';
    if (r < 0.93) return 'chicken';
    return 'wolf';
  }

  private pickHostileMobKind(): MobKind {
    const r = Math.random();
    if (r < 0.34) return 'zombie';
    if (r < 0.6) return 'skeleton';
    if (r < 0.82) return 'spider';
    return 'stalker';
  }

  private spawnInitialMobs() {
    if (this.worldType === 'oneblock') {
      return;
    }
    if (this.worldType === 'skyblock') {
      // Spawn one friendly sheep on a nearby solid island if available
      const sy = this.world.getSurfaceY(20, 0);
      if (sy > 1 && this.isBlockSolid(20, sy - 1, 0)) {
        const mob = createMob('sheep', 20.5, sy, 0.5, this.shadowDiscTexture);
        this.mobs.push(mob);
        this.scene.add(mob.group);
      }
      return;
    }
    if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      return;
    }
    if (this.worldType === 'tutorial') {
      const farmSpots: [MobKind, number, number][] = [
        ['pig', -2.5, 11.5],
        ['cow', 2.5, 11.5],
        ['sheep', -2.5, 14.5],
        ['chicken', 2.5, 14.5],
      ];
      for (const [kind, mx, mz] of farmSpots) {
        const sy = this.world.getSurfaceY(mx, mz);
        if (sy > 1 && this.isBlockSolid(Math.floor(mx), sy - 1, Math.floor(mz))) {
          const mob = createMob(kind, mx, sy, mz, this.shadowDiscTexture);
          this.mobs.push(mob);
          this.scene.add(mob.group);
        }
      }
      return;
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 9 + Math.random() * 18;
      const mx = this.playerPos.x + Math.cos(angle) * dist;
      const mz = this.playerPos.z + Math.sin(angle) * dist;
      const my = this.world.getSurfaceY(mx, mz);
      if (my > SEA_LEVEL && this.isBlockSolid(Math.floor(mx), my - 1, Math.floor(mz))) {
        const { biome } = this.world.getBiomeAt(Math.floor(mx), Math.floor(mz));
        const kind = this.pickPassiveMobKind(biome);
        const mob = createMob(kind, mx, my, mz, this.shadowDiscTexture);
        this.mobs.push(mob);
        this.scene.add(mob.group);
      }
    }
  }

  public setPhase(next: GamePhase) {
    const wasPlaying = this.phase === 'playing';
    this.phase = next;
    if (next !== 'playing') {
      if (wasPlaying && (next === 'paused' || next === 'inventory' || next === 'title')) {
        this.triggerAutoSave();
      }
      this.heldKeys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
      this.miningTarget = null;
      this.miningProgress = 0;
      this.crackMesh.visible = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        this.lastPointerUnlockTime = performance.now();
        this.pointerLockPending = false;
        try {
          document.exitPointerLock?.();
        } catch {
          // Ignore exit errors
        }
      }
    }
    if (next === 'playing') {
      this.camera.up.set(0, 1, 0);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
    this.callbacks.onPhaseChange(next);
    this.emitHud();
  }

  public startGame(mode?: GameMode, seed?: string, worldType?: WorldType) {
    if ((seed && seed !== this.seed) || (worldType && worldType !== this.worldType)) {
      this.createNewWorld(seed ?? this.seed, mode ?? this.mode, true, this.worldName, this.worldId, worldType);
      return;
    }
    if (mode && mode !== this.mode) {
      this.setGameMode(mode);
      this.setupInitialInventory(mode);
    }
    this.setPhase('playing');
    this.requestPointerLock();
    this.triggerAutoSave();
  }

  public respawn() {
    if (this.mode === 'hardcore') {
      this.setPhase('gameover');
      return;
    }
    if ((this.worldType === 'skyblock' || this.worldType === 'oneblock') && !this.isBlockSolid(0, 32, 0)) {
      this.world.setBlock(0, 32, 0, BlockId.GRASS);
    }
    if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      this.teleportToParkourCheckpoint();
      this.health = 20;
      this.hunger = 20;
      this.setPhase('playing');
      this.requestPointerLock();
      return;
    }
    const sy = this.world.getSurfaceY(0, 0) + 0.5;
    const minY =
      this.worldType === 'skyblock' || this.worldType === 'oneblock'
        ? 33.5
        : this.worldType === 'tutorial'
          ? 26.5
          : SEA_LEVEL + 2;
    this.playerPos.set(this.worldType === 'oneblock' ? 0.32 : 0.5, Math.max(minY, sy), 0.5);
    this.playerVel.set(0, 0, 0);
    this.fallPeakY = this.playerPos.y;
    this.health = 20;
    this.hunger = 20;
    this.armor = createEmptyArmor();
    this.setupInitialInventory(this.mode);
    if (this.twoPlayerMode) {
      this.spawnPlayer2NearP1(true);
    }
    this.setPhase('playing');
    this.requestPointerLock();
    this.triggerAutoSave();
  }

  public spectateHardcoreWorld() {
    if (this.mode !== 'hardcore') return;
    this.hardcoreDead = true;
    this.spectating = true;
    this.isFlying = true;
    this.p2IsFlying = true;
    this.playerVel.set(0, 0, 0);
    this.setPhase('playing');
    this.requestPointerLock();
    this.showStatus('Spectating Fallen Hardcore World (Read-Only Flight)', 4.5);
    this.triggerAutoSave();
    this.emitHud();
  }

  public setGameMode(mode: GameMode) {
    if (this.mode === 'hardcore' && mode !== 'hardcore' && this.phase !== 'title') {
      this.showStatus('Hardcore Mode is locked for this world!');
      this.emitHud();
      return;
    }
    this.mode = mode;
    this.hardcoreDead = false;
    this.spectating = false;
    if (mode === 'creative') {
      this.health = 20;
      this.hunger = 20;
      this.p2Health = 20;
      this.p2Hunger = 20;
      this.showStatus('Creative Mode — Flight & Unlimited Blocks');
    } else if (mode === 'hardcore') {
      this.isFlying = false;
      this.p2IsFlying = false;
      this.showStatus('Hardcore Mode — 1 Life, Tougher Mobs & Permadeath');
    } else {
      this.isFlying = false;
      this.p2IsFlying = false;
      this.showStatus('Survival Mode — Gather, Craft & Survive');
    }
    this.emitHud();
  }

  public setSelectedSlot(idx: number) {
    this.selectedSlot = ((idx % 9) + 9) % 9;
    this.miningProgress = 0;
    this.updateViewModelItem();
    this.emitHud();
  }

  private chestKey(wx: number, wy: number, wz: number): string {
    return `${wx},${wy},${wz}`;
  }

  private createEmptyChest(): (InventorySlot | null)[] {
    return Array(27).fill(null);
  }

  private getOrCreateChest(wx: number, wy: number, wz: number): (InventorySlot | null)[] {
    const key = this.chestKey(wx, wy, wz);
    let slots = this.chestInventories.get(key);
    if (!slots) {
      slots = this.createEmptyChest();
      this.chestInventories.set(key, slots);
    }
    return slots;
  }

  private dropAndClearChestAt(wx: number, wy: number, wz: number) {
    const key = this.chestKey(wx, wy, wz);
    const slots = this.chestInventories.get(key);
    if (slots) {
      for (const slot of slots) {
        if (slot && slot.count > 0) {
          this.spawnDroppedItem(
            slot.id,
            slot.count,
            wx + 0.5,
            wy + 0.5,
            wz + 0.5,
            (Math.random() - 0.5) * 2.4,
            3.0,
            (Math.random() - 0.5) * 2.4
          );
        }
      }
      this.chestInventories.delete(key);
    }
    if (
      this.activeChestPos &&
      this.activeChestPos.x === wx &&
      this.activeChestPos.y === wy &&
      this.activeChestPos.z === wz
    ) {
      this.activeChestPos = null;
      if (this.activeStation === 'chest') {
        this.activeStation = 'inventory';
      }
    }
  }

  private seedDefaultWorldChests() {
    const putItems = (wx: number, wy: number, wz: number, items: InventorySlot[]) => {
      const slots = this.createEmptyChest();
      items.slice(0, slots.length).forEach((item, idx) => {
        slots[idx] = { ...item };
      });
      this.chestInventories.set(this.chestKey(wx, wy, wz), slots);
    };

    if (this.worldType === 'skyblock') {
      putItems(2, 33, -1, [
        { id: BlockId.OAK_LOG, count: 4 },
        { id: BlockId.COAL, count: 6 },
        { id: BlockId.APPLE, count: 4 },
        { id: BlockId.BONE, count: 2 },
        { id: BlockId.STRING, count: 2 },
      ]);
      putItems(19, 34, 1, [
        { id: BlockId.SAND, count: 4 },
        { id: BlockId.IRON_INGOT, count: 3 },
        { id: BlockId.BREAD, count: 4 },
        { id: BlockId.GOLDEN_APPLE, count: 1 },
      ]);
    } else if (this.worldType === 'tutorial') {
      putItems(3, 26, -9, [
        { id: BlockId.TORCH, count: 8 },
        { id: BlockId.BREAD, count: 4 },
        { id: BlockId.COAL, count: 8 },
        { id: BlockId.IRON_ORE, count: 4 },
        { id: BlockId.RAW_PORK, count: 2 },
      ]);
      putItems(-11, 26, -3, [
        { id: BlockId.OAK_PLANKS, count: 16 },
        { id: BlockId.COBBLESTONE, count: 16 },
        { id: BlockId.BRICK, count: 8 },
        { id: BlockId.GLASS, count: 8 },
        { id: BlockId.WOOL, count: 8 },
      ]);
    } else if (this.worldType === 'parkour') {
      putItems(2, 32, 1, [
        { id: BlockId.APPLE, count: 8 },
        { id: BlockId.BREAD, count: 8 },
        { id: BlockId.TORCH, count: 8 },
      ]);
      putItems(0, 52, -132, [
        { id: BlockId.DIAMOND, count: 12 },
        { id: BlockId.EMERALD, count: 8 },
        { id: BlockId.GOLDEN_APPLE, count: 4 },
        { id: BlockId.DIAMOND_SWORD, count: 1 },
        { id: BlockId.TNT, count: 6 },
      ]);
    } else if (this.worldType === 'parkour100') {
      const finishLvl = PARKOUR_100_LEVELS[PARKOUR_100_LEVELS.length - 1];
      const fMidX = Math.floor((finishLvl.x0 + finishLvl.x1) / 2);
      putItems(2, 32, 1, [
        { id: BlockId.APPLE, count: 12 },
        { id: BlockId.BREAD, count: 12 },
        { id: BlockId.GOLDEN_APPLE, count: 2 },
      ]);
      putItems(fMidX, finishLvl.y + 1, finishLvl.z0 + 1, [
        { id: BlockId.DIAMOND, count: 64 },
        { id: BlockId.EMERALD, count: 32 },
        { id: BlockId.GOLDEN_APPLE, count: 8 },
        { id: BlockId.DIAMOND_SWORD, count: 1 },
        { id: BlockId.DIAMOND_HELMET, count: 1 },
        { id: BlockId.DIAMOND_CHESTPLATE, count: 1 },
      ]);
    } else if (this.worldType === 'wouldyourather') {
      putItems(2, 32, 1, [
        { id: BlockId.APPLE, count: 10 },
        { id: BlockId.BREAD, count: 10 },
        { id: BlockId.GOLDEN_APPLE, count: 2 },
        { id: BlockId.TORCH, count: 8 },
      ]);
      for (const lvl of WOULD_YOU_RATHER_LEVELS) {
        if (lvl.level > 0 && lvl.isMilestone) {
          putItems(-2, lvl.y + 1, lvl.exitZ1, [
            { id: BlockId.DIAMOND, count: 4 },
            { id: BlockId.EMERALD, count: 6 },
            { id: BlockId.GOLDEN_APPLE, count: 2 },
          ]);
        }
      }
      putItems(0, WYR_FINISH_Y + 1, WYR_FINISH_Z0 + 1, [
        { id: BlockId.DIAMOND, count: 64 },
        { id: BlockId.EMERALD, count: 64 },
        { id: BlockId.GOLDEN_APPLE, count: 16 },
        { id: BlockId.DIAMOND_SWORD, count: 1 },
        { id: BlockId.DIAMOND_CHESTPLATE, count: 1 },
        { id: BlockId.DIAMOND_HELMET, count: 1 },
      ]);
    }
  }

  public openInventory() {
    this.activeStation = 'inventory';
    this.activeChestPos = null;
    this.craftingGridSize = 2;
    this.setPhase('inventory');
  }

  public swapInventorySlots(fromIdx: number, toIdx: number) {
    this.transferContainerSlots('player', fromIdx, 'player', toIdx);
  }

  public transferContainerSlots(
    fromContainer: 'player' | 'chest',
    fromIdx: number,
    toContainer: 'player' | 'chest',
    toIdx: number
  ) {
    if (fromContainer === toContainer && fromIdx === toIdx) return;
    const chestSlots = this.activeChestPos
      ? this.getOrCreateChest(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z)
      : null;
    const srcArr = fromContainer === 'chest' ? chestSlots : this.inventory;
    const dstArr = toContainer === 'chest' ? chestSlots : this.inventory;
    if (!srcArr || !dstArr) return;
    if (fromIdx < 0 || fromIdx >= srcArr.length || toIdx < 0 || toIdx >= dstArr.length) return;

    const a = srcArr[fromIdx];
    const b = dstArr[toIdx];
    if (a && b && a.id === b.id) {
      const max = BLOCK_DEFS[a.id]?.stackMax ?? 64;
      const move = Math.min(max - b.count, a.count);
      if (move > 0) {
        b.count += move;
        a.count -= move;
        if (a.count <= 0) srcArr[fromIdx] = null;
        if ((fromContainer === 'chest' || toContainer === 'chest') && this.activeChestPos) {
          const key = this.chestKey(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z);
          this.callbacks.onLocalChestUpdate?.(key, chestSlots ? chestSlots.map((s) => (s ? { ...s } : null)) : []);
        }
        this.updateViewModelItem();
        this.emitHud();
        return;
      }
    }
    srcArr[fromIdx] = b;
    dstArr[toIdx] = a;
    if ((fromContainer === 'chest' || toContainer === 'chest') && this.activeChestPos) {
      const key = this.chestKey(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z);
      this.callbacks.onLocalChestUpdate?.(key, chestSlots ? chestSlots.map((s) => (s ? { ...s } : null)) : []);
    }
    this.updateViewModelItem();
    this.emitHud();
  }

  public quickTransferContainerSlot(fromContainer: 'player' | 'chest', fromIdx: number) {
    if (this.activeStation !== 'chest' || !this.activeChestPos) return;
    const chestSlots = this.getOrCreateChest(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z);
    const srcArr = fromContainer === 'chest' ? chestSlots : this.inventory;
    const dstArr = fromContainer === 'chest' ? this.inventory : chestSlots;
    const item = srcArr[fromIdx];
    if (!item || item.count <= 0) return;

    const max = BLOCK_DEFS[item.id]?.stackMax ?? 64;
    let remaining = item.count;

    // 1. Fill matching partial stacks in target
    for (let i = 0; i < dstArr.length && remaining > 0; i++) {
      const target = dstArr[i];
      if (target && target.id === item.id && target.count < max) {
        const move = Math.min(max - target.count, remaining);
        target.count += move;
        remaining -= move;
      }
    }

    // 2. Place remainder in empty target slots
    for (let i = 0; i < dstArr.length && remaining > 0; i++) {
      if (!dstArr[i]) {
        const move = Math.min(max, remaining);
        dstArr[i] = { id: item.id, count: move };
        remaining -= move;
      }
    }

    srcArr[fromIdx] = remaining > 0 ? { id: item.id, count: remaining } : null;
    const key = this.chestKey(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z);
    this.callbacks.onLocalChestUpdate?.(key, chestSlots.map((s) => (s ? { ...s } : null)));
    this.updateViewModelItem();
    this.emitHud();
  }

  private cloneArmor(): EquippedArmor {
    return {
      helmet: this.armor.helmet ? { ...this.armor.helmet } : null,
      chestplate: this.armor.chestplate ? { ...this.armor.chestplate } : null,
      leggings: this.armor.leggings ? { ...this.armor.leggings } : null,
      boots: this.armor.boots ? { ...this.armor.boots } : null,
    };
  }

  private getArmorDefense(): number {
    const keys: ArmorSlotKey[] = ['helmet', 'chestplate', 'leggings', 'boots'];
    let total = 0;
    for (const k of keys) {
      const piece = this.armor[k];
      if (piece) {
        total += BLOCK_DEFS[piece.id]?.armorDefense ?? 0;
      }
    }
    return Math.min(20, total);
  }

  public interactArmorSlot(
    slotKey: ArmorSlotKey,
    container?: 'player' | 'chest',
    idx?: number
  ) {
    const chestSlots =
      container === 'chest' && this.activeChestPos
        ? this.getOrCreateChest(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z)
        : null;
    const arr = container === 'chest' ? chestSlots : container === 'player' ? this.inventory : null;

    if (arr && idx !== undefined && idx >= 0 && idx < arr.length) {
      const item = arr[idx];
      if (item) {
        const def = BLOCK_DEFS[item.id];
        if (def?.armorSlot !== slotKey) {
          this.showStatus(`Only ${slotKey} armor fits in that slot`);
          this.emitHud();
          return;
        }
        const prev = this.armor[slotKey];
        this.armor[slotKey] = { id: item.id, count: 1 };
        arr[idx] = prev;
        soundEngine.playPlace(def.sound);
      } else if (this.armor[slotKey]) {
        arr[idx] = this.armor[slotKey];
        this.armor[slotKey] = null;
        soundEngine.playPickup();
      }
      if (container === 'chest' && this.activeChestPos && chestSlots) {
        const key = this.chestKey(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z);
        this.callbacks.onLocalChestUpdate?.(key, chestSlots.map((s) => (s ? { ...s } : null)));
      }
      this.updateViewModelItem();
      this.emitHud();
      return;
    }

    // No container slot specified: unequip into first free player inventory slot
    const worn = this.armor[slotKey];
    if (!worn) return;
    const emptyIdx = this.inventory.findIndex((s) => s === null);
    if (emptyIdx === -1) {
      this.showStatus('Inventory full — cannot unequip armor');
      this.emitHud();
      return;
    }
    this.inventory[emptyIdx] = worn;
    this.armor[slotKey] = null;
    soundEngine.playPickup();
    this.updateViewModelItem();
    this.emitHud();
  }

  public quickEquipArmorFromSlot(container: 'player' | 'chest', idx: number): boolean {
    const chestSlots =
      container === 'chest' && this.activeChestPos
        ? this.getOrCreateChest(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z)
        : null;
    const arr = container === 'chest' ? chestSlots : this.inventory;
    if (!arr || idx < 0 || idx >= arr.length) return false;
    const item = arr[idx];
    if (!item) return false;
    const def = BLOCK_DEFS[item.id];
    if (!def?.armorSlot) return false;

    const prev = this.armor[def.armorSlot];
    this.armor[def.armorSlot] = { id: item.id, count: 1 };
    arr[idx] = prev;
    soundEngine.playPlace(def.sound);
    if (container === 'chest' && this.activeChestPos && chestSlots) {
      const key = this.chestKey(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z);
      this.callbacks.onLocalChestUpdate?.(key, chestSlots.map((s) => (s ? { ...s } : null)));
    }
    this.updateViewModelItem();
    this.emitHud();
    return true;
  }

  public joinMultiplayerRoom(payload: {
    room: RoomInfo;
    modifiedBlocks: [string, BlockId][];
    chests: Record<string, (InventorySlot | null)[]>;
    players: RemotePlayerState[];
  }) {
    this.isMultiplayer = true;
    this.worldId = `mp_${payload.room.id}`;
    this.worldName = payload.room.name;
    this.seed = payload.room.seed;
    this.worldType = payload.room.worldType;
    this.mode = payload.room.mode;
    this.hardcoreDead = false;
    this.spectating = false;
    this.createdAt = Date.now();
    this.autoSaveAccum = 0;
    this.lastTutorialZone = '';
    this.resetParkourProgress();
    this.resetWyrProgress();
    this.activeStation = 'inventory';
    this.activeChestPos = null;
    this.chestInventories.clear();
    this.seedDefaultWorldChests();

    for (const [k, rawSlots] of Object.entries(payload.chests)) {
      if (Array.isArray(rawSlots)) {
        const chest = this.createEmptyChest();
        for (let i = 0; i < chest.length; i++) {
          const s = rawSlots[i];
          chest[i] = s ? { id: s.id, count: s.count } : null;
        }
        this.chestInventories.set(k, chest);
      }
    }

    this.dimension = 'overworld';
    this.overworldModifiedBlocks.clear();
    this.netherModifiedBlocks.clear();
    this.portalChargeTimer = 0;
    this.portalCooldown = 0;
    this.lavaDamageTimer = 0;
    this.inLavaUnderwater = false;

    this.clearWorldObjects();

    this.world = new VoxelWorld(this.seed, this.opaqueMat, this.cutoutMat, this.waterMat, this.worldType, 'overworld');
    for (const [k, blockId] of payload.modifiedBlocks) {
      this.world.modifiedBlocks.set(k, blockId);
    }
    this.scene.add(this.world.group);

    const minCz =
      this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather'
        ? -4
        : -3;
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = minCz; cz <= 3; cz++) {
        const ch = this.world.generateChunk(cx, cz);
        this.world.rebuildChunkMesh(ch);
      }
    }

    const spawnY = this.world.getSurfaceY(0, 0) + 0.5;
    if (this.worldType === 'oneblock') {
      this.playerPos.set(0.32, Math.max(33.5, spawnY), 0.5);
    } else if (this.worldType === 'skyblock') {
      this.playerPos.set(0.5, Math.max(33.5, spawnY), 0.5);
    } else if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      this.playerPos.set(0.5, Math.max(32.5, spawnY), 0.5);
    } else if (this.worldType === 'tutorial') {
      this.playerPos.set(0.5, Math.max(26.5, spawnY), 0.5);
    } else {
      this.playerPos.set(0.5, Math.max(SEA_LEVEL + 2, spawnY), 0.5);
    }
    this.playerVel.set(0, 0, 0);
    this.fallPeakY = this.playerPos.y;
    this.yaw = 0;
    this.pitch = -0.15;

    this.health = 20;
    this.hunger = 20;
    this.dayCount = payload.room.dayCount || 1;
    this.timeOfDay = typeof payload.room.timeOfDay === 'number' ? payload.room.timeOfDay : 0.055;
    this.isFlying = this.mode === 'creative';
    this.armor = createEmptyArmor();
    this.setupInitialInventory(this.mode);
    this.spawnInitialMobs();

    for (const p of payload.players) {
      this.upsertRemotePlayer(p);
    }

    this.grassDirty = true;
    this.updateDayNightAndLighting(0);
    this.setPhase('playing');
    this.requestPointerLock();
    this.showStatus(`Connected to ${payload.room.name} (${payload.room.id})`, 3.5);
    this.emitHud();
  }

  public leaveMultiplayerRoom() {
    this.isMultiplayer = false;
    this.clearRemotePlayers();
  }

  public upsertRemotePlayer(state: RemotePlayerState) {
    if (this.remotePlayers.has(state.id)) return; // Idempotent guard
    const avatar = createRemotePlayerAvatar(state);
    this.remotePlayers.set(state.id, avatar);
    this.scene.add(avatar.group);
  }

  public removeRemotePlayer(playerId: string) {
    const avatar = this.remotePlayers.get(playerId);
    if (!avatar) return;
    this.scene.remove(avatar.group);
    disposeRemotePlayerAvatar(avatar);
    this.remotePlayers.delete(playerId);
  }

  public moveRemotePlayer(data: {
    playerId: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    heldItem: BlockId | null;
    isMoving: boolean;
  }) {
    const avatar = this.remotePlayers.get(data.playerId);
    if (!avatar) return;
    avatar.targetPos.set(data.x, data.y, data.z);
    avatar.targetYaw = data.yaw;
    avatar.targetPitch = data.pitch;
    avatar.isMoving = data.isMoving;
    setAvatarHeldItem(avatar, data.heldItem);
  }

  public swingRemotePlayer(playerId: string) {
    const avatar = this.remotePlayers.get(playerId);
    if (!avatar) return;
    avatar.swingTimer = 0.24;
  }

  public skinRemotePlayer(playerId: string, skin: PlayerSkin | null) {
    const avatar = this.remotePlayers.get(playerId);
    if (!avatar) return;
    updateAvatarSkin(avatar, skin);
  }

  public setRemotePlayerSpeaking(playerId: string, speaking: boolean) {
    const avatar = this.remotePlayers.get(playerId);
    if (!avatar) return;
    setAvatarSpeaking(avatar, speaking);
  }

  public getSpatialVoiceState(): {
    selfPos: { x: number; y: number; z: number };
    peerPositions: Map<string, { x: number; y: number; z: number }>;
  } {
    const peerPositions = new Map<string, { x: number; y: number; z: number }>();
    for (const [id, avatar] of this.remotePlayers) {
      peerPositions.set(id, {
        x: avatar.group.position.x,
        y: avatar.group.position.y,
        z: avatar.group.position.z,
      });
    }
    return {
      selfPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      peerPositions,
    };
  }

  public applyRemoteBlock(wx: number, wy: number, wz: number, blockId: BlockId) {
    if (!this.world) return;
    this.isApplyingRemoteUpdate = true;
    try {
      if (blockId === BlockId.AIR && this.world.getBlock(wx, wy, wz) === BlockId.CHEST) {
        this.chestInventories.delete(this.chestKey(wx, wy, wz));
      }
      this.world.setBlock(wx, wy, wz, blockId);
      this.grassDirty = true;
    } finally {
      this.isApplyingRemoteUpdate = false;
    }
  }

  public applyRemoteChest(key: string, slots: (InventorySlot | null)[]) {
    const chest = this.createEmptyChest();
    for (let i = 0; i < chest.length; i++) {
      const s = slots[i];
      chest[i] = s ? { id: s.id, count: s.count } : null;
    }
    this.chestInventories.set(key, chest);
    this.emitHud();
  }

  public setInputSuppressed(suppressed: boolean) {
    this.inputSuppressed = suppressed;
    if (suppressed) {
      this.heldKeys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        this.lastPointerUnlockTime = performance.now();
        this.pointerLockPending = false;
        try {
          document.exitPointerLock?.();
        } catch {
          // Ignore
        }
      }
    }
  }

  public craftRecipe(recipe: CraftingRecipe): boolean {
    if (this.activeStation === 'chest') {
      return false;
    }
    if (recipe.category === 'smelt') {
      if (this.activeStation !== 'furnace') return false;
      if (!canSmeltFromInventory(recipe, this.inventory)) return false;
    } else {
      if (this.activeStation !== 'inventory' && this.activeStation !== 'crafting_table') {
        return false;
      }
      if (!canCraftFromInventory(recipe, this.inventory, this.craftingGridSize)) {
        return false;
      }
    }
    const reqs = getRecipeIngredients(recipe);
    // Deduct ingredients
    for (const req of reqs) {
      let rem = req.count;
      for (let i = 0; i < this.inventory.length && rem > 0; i++) {
        const slot = this.inventory[i];
        if (slot && slot.id === req.id) {
          const take = Math.min(slot.count, rem);
          slot.count -= take;
          rem -= take;
          if (slot.count <= 0) this.inventory[i] = null;
        }
      }
    }
    this.addItemToInventory(recipe.output.id, recipe.output.count);
    soundEngine.playCraft();
    this.updateViewModelItem();
    this.emitHud();
    return true;
  }

  public craftFromGrid(grid: (InventorySlot | null)[], gridSize: 2 | 3): { crafted: InventorySlot | null; remainingGrid: (InventorySlot | null)[] } {
    if (this.activeStation !== 'inventory' && this.activeStation !== 'crafting_table') {
      return { crafted: null, remainingGrid: grid };
    }
    const recipe = matchCraftingGrid(grid, gridSize);
    if (!recipe) return { crafted: null, remainingGrid: grid };
    const nextGrid = grid.map((s) => {
      if (!s) return null;
      const nextCount = s.count - 1;
      return nextCount > 0 ? { id: s.id, count: nextCount } : null;
    });
    this.addItemToInventory(recipe.output.id, recipe.output.count);
    soundEngine.playCraft();
    this.updateViewModelItem();
    this.emitHud();
    return { crafted: { ...recipe.output }, remainingGrid: nextGrid };
  }

  public giveCreativeItem(id: BlockId) {
    if (this.mode !== 'creative' || this.activeStation !== 'inventory') return;
    const def = BLOCK_DEFS[id];
    if (!def) return;
    this.inventory[this.selectedSlot] = { id, count: def.stackMax };
    this.updateViewModelItem();
    this.emitHud();
  }

  public getAllRecipes() {
    return this.activeStation === 'furnace' ? RECIPES.filter((r) => r.category === 'smelt') : CRAFT_RECIPES;
  }

  public getIcon(id: BlockId): string {
    return getItemIconUrl(id, this.atlasCanvas);
  }

  public setMuted(muted: boolean) {
    soundEngine.muted = muted;
  }

  public setRenderDistance(dist: number) {
    this.renderDistance = Math.max(3, Math.min(7, dist));
  }

  public setSensitivity(sens: number) {
    this.mouseSensitivity = sens;
  }

  public setFov(fov: number) {
    this.baseFov = Math.max(55, Math.min(105, fov));
    this.currentFov = this.baseFov;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    if (this.p2Camera) {
      this.p2Camera.fov = this.baseFov;
      this.p2Camera.updateProjectionMatrix();
    }
  }

  public setWeatherMode(mode: 'auto' | 'clear' | 'rain') {
    this.weatherMode = mode;
    if (mode === 'rain') this.isRainingAuto = true;
    if (mode === 'clear') this.isRainingAuto = false;
  }

  public setTimeOfDay(tod: number) {
    this.timeOfDay = ((tod % 1) + 1) % 1;
    this.updateDayNightAndLighting(0);
    this.emitHud();
  }

  public setTexturePack(pack: TexturePackId) {
    this.texturePack = pack;
    const isSquare = pack === 'square';
    const isPbr = pack === 'pbr';
    const vis = RESOURCE_PACK_VISUALS[pack] ?? RESOURCE_PACK_VISUALS.pbr;

    if (isPbr || isSquare) {
      this.opaqueMat.map = isSquare ? this.squareOpaqueTex : this.pbrOpaqueTex;
      this.opaqueMat.normalMap = isSquare ? null : this.pbrNormalTex;
      this.opaqueMat.roughnessMap = isSquare ? null : this.pbrRoughnessTex;
      this.opaqueMat.roughness = isSquare ? 0.92 : 1.0;
      this.opaqueMat.metalnessMap = isSquare ? null : this.pbrMetalnessTex;
      this.opaqueMat.metalness = isSquare ? 0.0 : 1.0;

      this.cutoutMat.map = isSquare ? this.squareCutoutTex : this.pbrCutoutTex;
      this.cutoutMat.normalMap = isSquare ? null : this.pbrNormalTex;
      this.cutoutMat.roughnessMap = isSquare ? null : this.pbrRoughnessTex;
      this.cutoutMat.roughness = isSquare ? 0.92 : 1.0;

      this.atlasCanvas = isSquare ? this.squareAtlasCanvas : this.pbrAtlasCanvas;
    } else {
      let cached = this.styledPackCache.get(pack);
      if (!cached) {
        cached = buildStyledResourceAtlas(
          this.pbrAtlasCanvas,
          pack,
          Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
        );
        this.styledPackCache.set(pack, cached);
      }
      this.opaqueMat.map = cached.opaqueTexture;
      this.opaqueMat.normalMap = this.pbrNormalTex;
      this.opaqueMat.roughnessMap = this.pbrRoughnessTex;
      this.opaqueMat.roughness = 1.0;
      this.opaqueMat.metalnessMap = this.pbrMetalnessTex;
      this.opaqueMat.metalness = 1.0;

      this.cutoutMat.map = cached.cutoutTexture;
      this.cutoutMat.normalMap = this.pbrNormalTex;
      this.cutoutMat.roughnessMap = this.pbrRoughnessTex;
      this.cutoutMat.roughness = 1.0;

      this.atlasCanvas = cached.canvas;
    }

    this.opaqueMat.needsUpdate = true;
    this.cutoutMat.needsUpdate = true;

    if (this.waterMat) {
      this.waterMat.color.setHex(vis.waterColor);
      this.waterMat.needsUpdate = true;
    }
    if (this.bloomPass) {
      this.bloomPass.strength = vis.bloomStrength;
    }

    clearItemIconCache();
    this.updateDayNightAndLighting(0);
    this.emitHud();
  }

  public setActiveBehaviorPacks(packs: BehaviorPackId[]) {
    this.activeBehaviorPacks = new Set(packs);
    if (this.activeBehaviorPacks.has('peaceful_aura')) {
      // Calm down any currently aggroed mobs
      for (const m of this.mobs) {
        m.aggroTimer = 0;
        m.fuseTimer = 0;
      }
    }
    this.emitHud();
  }

  public grantMarketplaceItems(items: { id: BlockId; count: number }[]) {
    let addedAny = false;
    for (const item of items) {
      const def = BLOCK_DEFS[item.id];
      if (!def) continue;
      let remaining = item.count;
      const stackMax = def.stackMax || 64;
      while (remaining > 0) {
        const chunk = Math.min(stackMax, remaining);
        const rem = this.addItemToInventoryWithRemainder(item.id, chunk);
        if (rem < chunk) addedAny = true;
        if (rem > 0) {
          this.spawnDroppedItem(item.id, rem, this.playerPos.x, this.playerPos.y + 1, this.playerPos.z);
        }
        remaining -= chunk;
      }
    }
    if (addedAny) {
      soundEngine.playPickup();
    }
    this.updateViewModelItem();
    this.triggerAutoSave();
    this.emitHud();
  }

  public regenerateSquareTexturePack() {
    paintSquarePackAtlas(this.pbrAtlasCanvas, this.squareNativeCanvas, this.squareAtlasCanvas);
    this.squareOpaqueTex.needsUpdate = true;
    this.squareCutoutTex.needsUpdate = true;
    if (this.texturePack !== 'square') {
      this.setTexturePack('square');
      return;
    }
    clearItemIconCache();
    this.emitHud();
  }

  public requestPointerLock() {
    if (this.disposed || this.pointerLocked || this.pointerLockPending) return;
    if (this.phase !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) return;

    const now = performance.now();
    // Browsers block pointer lock for ~1.25s after user exit and rate-limit bursts
    if (now - this.lastPointerUnlockTime < 1350) return;
    if (now - this.lastPointerLockReqTime < 650) return;

    const dom = this.renderer.domElement;
    const req = dom.requestPointerLock;
    if (typeof req !== 'function') return;

    this.lastPointerLockReqTime = now;
    this.pointerLockPending = true;
    try {
      const result = req.call(dom) as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {
          this.pointerLockPending = false;
          this.lastPointerUnlockTime = performance.now();
        });
      }
    } catch {
      this.pointerLockPending = false;
      this.lastPointerUnlockTime = performance.now();
    }
  }

  private showStatus(msg: string, duration = 2.6) {
    this.statusMessage = msg;
    this.statusTimer = duration;
  }

  private updateViewModelItem() {
    const held = this.inventory[this.selectedSlot];
    if (!held) {
      this.viewArmMesh.visible = true;
      this.viewItemMesh.visible = false;
      return;
    }
    this.viewArmMesh.visible = false;
    this.viewItemMesh.visible = true;
    const mat = this.viewItemMesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(getItemColor(held.id));
    const def = BLOCK_DEFS[held.id];
    if (def?.isBlock && held.id !== BlockId.TORCH) {
      this.viewItemMesh.scale.set(1, 1, 1);
    } else if (held.id === BlockId.TORCH) {
      this.viewItemMesh.scale.set(0.32, 1.35, 0.32);
    } else {
      this.viewItemMesh.scale.set(0.45, 1.25, 0.16);
    }
  }

  public addItemToInventoryWithRemainder(id: BlockId, count: number): number {
    const { updatedSlots, remaining } = addBlockToEngineInventory(this.inventory, id, count, (itemId) =>
      this.getIcon(itemId)
    );
    if (remaining < count) {
      this.inventory = updatedSlots;
      this.updateViewModelItem();
    }
    return remaining;
  }

  public addItemToInventory(id: BlockId, count: number): boolean {
    return this.addItemToInventoryWithRemainder(id, count) < count;
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    document.addEventListener('mousemove', this.onMouseMove);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const effW = this.twoPlayerMode && this.phase === 'playing' ? Math.floor(w / 2) : w;
    this.camera.aspect = effW / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    if (this.p2Camera) {
      this.p2Camera.aspect = Math.max(1, w - Math.floor(w / 2)) / Math.max(1, h);
      this.p2Camera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  private onWindowBlur = () => {
    this.heldKeys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this.isDraggingFallback = false;
  };

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (this.pointerLocked && !locked) {
      this.lastPointerUnlockTime = performance.now();
    }
    this.pointerLocked = locked;
    this.pointerLockPending = false;
    this.emitHud();
  };

  private onPointerLockError = () => {
    this.pointerLockPending = false;
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked) {
      this.lastPointerUnlockTime = performance.now();
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.inputSuppressed) return;

    if (this.phase === 'title') {
      if (e.code === 'Enter') {
        this.startGame();
      }
      return;
    }

    if (e.code === 'Escape') {
      if (this.phase === 'playing') {
        this.setPhase('paused');
      } else if (this.phase === 'paused' || this.phase === 'inventory') {
        this.setPhase('playing');
        this.requestPointerLock();
      }
      return;
    }

    if (e.code === 'KeyE') {
      if (this.phase === 'playing') {
        this.openInventory();
      } else if (this.phase === 'inventory') {
        this.setPhase('playing');
        this.requestPointerLock();
      }
      return;
    }

    if (this.phase === 'playing' && e.code === 'KeyT' && this.isMultiplayer) {
      e.preventDefault();
      this.callbacks.onOpenChat?.();
      return;
    }

    if (this.phase === 'playing' && e.code === 'KeyV' && this.isMultiplayer) {
      e.preventDefault();
      this.callbacks.onToggleVoice?.();
      return;
    }

    if (this.phase !== 'playing') return;

    // Prevent browser scrolling on Space/Arrow/Slot keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'BracketLeft', 'BracketRight'].includes(e.code)) {
      e.preventDefault();
    }

    // Edge-triggered actions
    if (!this.heldKeys.has(e.code)) {
      if (e.code === 'Space') {
        const now = performance.now() / 1000;
        if (this.mode === 'creative' && now - this.lastSpacePressTime < 0.28) {
          this.isFlying = !this.isFlying;
          this.playerVel.y = 0;
          this.showStatus(this.isFlying ? 'Flight Enabled' : 'Flight Disabled');
        }
        this.lastSpacePressTime = now;
        this.jumpBufferTimer = 0.13;
      }

      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) this.setSelectedSlot(n - 1);
      }

      if (e.code === 'KeyQ') {
        this.dropSelectedItem();
      }

      if (e.code === 'KeyR' && (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather')) {
        this.teleportToParkourCheckpoint(true);
      }

      if (e.code === 'KeyM') {
        if (this.mode === 'hardcore') {
          this.showStatus('Hardcore Mode is locked — no switching!');
        } else {
          this.setGameMode(this.mode === 'survival' ? 'creative' : 'survival');
        }
      }

      if (this.twoPlayerMode) {
        if (e.code === 'ShiftRight' || e.code === 'Numpad0') {
          const now = performance.now() / 1000;
          if (this.mode === 'creative' && now - this.p2LastJumpPressTime < 0.28) {
            this.p2IsFlying = !this.p2IsFlying;
            this.p2Vel.y = 0;
          }
          this.p2LastJumpPressTime = now;
          this.p2JumpBufferTimer = 0.13;
        }
        if (e.code === 'BracketLeft') {
          this.p2SelectedSlot = (this.p2SelectedSlot + 8) % 9;
          this.p2MiningProgress = 0;
          this.updateP2ViewModelItem();
          this.emitHud();
        }
        if (e.code === 'BracketRight') {
          this.p2SelectedSlot = (this.p2SelectedSlot + 1) % 9;
          this.p2MiningProgress = 0;
          this.updateP2ViewModelItem();
          this.emitHud();
        }
        if (e.code === 'KeyO') {
          this.p2SwingTimer = this.swingDuration;
          this.tryAttackMobP2();
        }
        if (e.code === 'KeyP') {
          this.tryUseOrPlaceBlockP2();
          this.p2PlaceCooldown = 0.22;
        }
      }
    }

    this.heldKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing' || this.inputSuppressed) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.setSelectedSlot(this.selectedSlot + dir);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.inputSuppressed) return;

    if (!this.pointerLocked) {
      this.requestPointerLock();
      this.isDraggingFallback = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }

    if (e.button === 0) {
      this.mouseLeftDown = true;
      this.triggerSwing();
      this.tryAttackMob();
    } else if (e.button === 2) {
      this.mouseRightDown = true;
      this.tryUseOrPlaceBlock();
      this.placeCooldown = 0.22;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseLeftDown = false;
      this.miningProgress = 0;
      this.crackMesh.visible = false;
    }
    if (e.button === 2) {
      this.mouseRightDown = false;
    }
    this.isDraggingFallback = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;

    let dx = 0;
    let dy = 0;
    if (this.pointerLocked) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (this.isDraggingFallback) {
      dx = e.clientX - this.lastPointerX;
      dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else {
      return;
    }

    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity;
    this.pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, this.pitch));
  };

  private triggerSwing() {
    this.swingTimer = this.swingDuration;
    if (this.isMultiplayer) {
      this.callbacks.onLocalSwing?.();
    }
  }

  private dropSelectedItem() {
    const slot = this.inventory[this.selectedSlot];
    if (!slot) return;
    const dropId = slot.id;
    slot.count -= 1;
    if (slot.count <= 0) this.inventory[this.selectedSlot] = null;
    this.updateViewModelItem();

    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.spawnDroppedItem(
      dropId,
      1,
      this.playerPos.x + dir.x * 0.9,
      this.playerPos.y + PLAYER_EYE - 0.2,
      this.playerPos.z + dir.z * 0.9,
      dir.x * 5,
      2.5,
      dir.z * 5
    );
    this.emitHud();
  }

  private spawnDroppedItem(id: BlockId, count: number, x: number, y: number, z: number, vx = 0, vy = 3.2, vz = 0) {
    const mesh = createDroppedItemMesh(id);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.droppedItems.push({
      id: this.nextDropId++,
      itemId: id,
      count,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(vx, vy, vz),
      age: 0,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  // Exact 3D DDA Voxel Raycast (Amanatides & Woo)
  private raycastVoxel(maxDist = 5.5, cam: THREE.PerspectiveCamera = this.camera): {
    hit: boolean;
    wx: number;
    wy: number;
    wz: number;
    nx: number;
    ny: number;
    nz: number;
    blockId: BlockId;
    dist: number;
  } {
    const ox = cam.position.x;
    const oy = cam.position.y;
    const oz = cam.position.z;

    _v1.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    const dx = _v1.x;
    const dy = _v1.y;
    const dz = _v1.z;

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tDeltaX = dx === 0 ? 1e9 : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? 1e9 : Math.abs(1 / dy);
    const tDeltaZ = dz === 0 ? 1e9 : Math.abs(1 / dz);

    let tMaxX = dx === 0 ? 1e9 : (dx > 0 ? x + 1 - ox : ox - x) * tDeltaX;
    let tMaxY = dy === 0 ? 1e9 : (dy > 0 ? y + 1 - oy : oy - y) * tDeltaY;
    let tMaxZ = dz === 0 ? 1e9 : (dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ;

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let dist = 0;

    for (let i = 0; i < 48; i++) {
      const id = this.world.getBlock(x, y, z);
      if (id !== BlockId.AIR && id !== BlockId.WATER && id !== BlockId.LAVA) {
        return { hit: true, wx: x, wy: y, wz: z, nx, ny, nz, blockId: id, dist };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          x += stepX;
          tMaxX += tDeltaX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          y += stepY;
          tMaxY += tDeltaY;
          nx = 0;
          ny = -stepY;
          nz = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      }

      if (dist > maxDist) break;
    }

    return { hit: false, wx: 0, wy: 0, wz: 0, nx: 0, ny: 0, nz: 0, blockId: BlockId.AIR, dist: maxDist };
  }

  private tryAttackMob(): boolean {
    if (this.attackCooldown > 0) return false;
    const hit = this.tryAttackMobWithCamera(this.camera, this.playerPos, this.inventory[this.selectedSlot], false);
    if (hit) this.attackCooldown = 0.28;
    return hit;
  }

  private tryAttackMobP2(): boolean {
    if (this.p2AttackCooldown > 0) return false;
    const hit = this.tryAttackMobWithCamera(this.p2Camera, this.p2Pos, this.p2Inventory[this.p2SelectedSlot], true);
    if (hit) this.p2AttackCooldown = 0.28;
    return hit;
  }

  private tryAttackMobWithCamera(
    cam: THREE.PerspectiveCamera,
    attackerPos: THREE.Vector3,
    held: InventorySlot | null,
    isP2: boolean
  ): boolean {
    _v1.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    _raycaster.set(cam.position, _v1);
    _raycaster.far = 4.0;

    let hitMob: MobEntity | null = null;
    let minD = 4.0;
    for (const m of this.mobs) {
      const intersects = _raycaster.intersectObject(m.group, true);
      if (intersects.length > 0 && intersects[0].distance < minD) {
        minD = intersects[0].distance;
        hitMob = m;
      }
    }

    if (!hitMob) return false;

    const baseDmg = (held && BLOCK_DEFS[held.id]?.attackDamage) || 2;
    const strMult = this.activeBehaviorPacks.has('titan_strength') ? 3.0 : 1.0;
    const dmg = Math.round(baseDmg * strMult);
    hitMob.hp -= dmg;
    hitMob.hitFlashTimer = 0.16;
    hitMob.scaleY = 1.24;
    if (hitMob.kind === 'pig' || hitMob.kind === 'cow' || hitMob.kind === 'sheep' || hitMob.kind === 'chicken') {
      hitMob.panicTimer = 4.0;
    } else if (hitMob.kind === 'wolf') {
      hitMob.aggroTimer = 18.0;
    }

    // Knockback away from attacking player
    const kx = hitMob.pos.x - attackerPos.x;
    const kz = hitMob.pos.z - attackerPos.z;
    const len = Math.hypot(kx, kz) || 1;
    const kbMult = this.activeBehaviorPacks.has('titan_strength') ? 1.7 : 1.0;
    hitMob.vel.x = (kx / len) * 6.2 * kbMult;
    hitMob.vel.z = (kz / len) * 6.2 * kbMult;
    hitMob.vel.y = 4.2;
    hitMob.onGround = false;

    soundEngine.playHitMob();
    this.particles.spawnBurst(hitMob.pos.x, hitMob.pos.y + 0.8, hitMob.pos.z, 0xe03c3c, 12, 4.5);

    if (hitMob.hp <= 0) {
      this.hitstopTimer = 0.045;
      if (!isP2) this.cameraShake = Math.min(1, this.cameraShake + 0.18);
      this.mobsDefeated++;
      if (this.activeBehaviorPacks.has('vampiric_regen') && this.isSurvivalLike) {
        if (isP2) {
          this.p2Health = Math.min(this.p2MaxHealth, this.p2Health + 4);
        } else {
          this.health = Math.min(this.maxHealth, this.health + 4);
        }
      }
      if (hitMob.kind === 'pig') {
        this.spawnDroppedItem(BlockId.RAW_PORK, 1 + Math.floor(Math.random() * 2), hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
      } else if (hitMob.kind === 'cow') {
        this.spawnDroppedItem(BlockId.RAW_BEEF, 1 + Math.floor(Math.random() * 2), hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        this.spawnDroppedItem(BlockId.LEATHER, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
      } else if (hitMob.kind === 'sheep') {
        this.spawnDroppedItem(BlockId.RAW_PORK, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        this.spawnDroppedItem(BlockId.WOOL, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
      } else if (hitMob.kind === 'chicken') {
        this.spawnDroppedItem(BlockId.RAW_CHICKEN, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        this.spawnDroppedItem(BlockId.FEATHER, 1 + Math.floor(Math.random() * 2), hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
      } else if (hitMob.kind === 'wolf') {
        this.spawnDroppedItem(BlockId.BONE, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        if (Math.random() < 0.5) {
          this.spawnDroppedItem(BlockId.LEATHER, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        }
      } else if (hitMob.kind === 'skeleton') {
        this.spawnDroppedItem(BlockId.BONE, 1 + Math.floor(Math.random() * 2), hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        this.spawnDroppedItem(BlockId.STICK, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
      } else if (hitMob.kind === 'spider') {
        this.spawnDroppedItem(BlockId.STRING, 1 + Math.floor(Math.random() * 2), hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        if (Math.random() < 0.3) {
          this.spawnDroppedItem(BlockId.IRON_INGOT, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        }
      } else if (hitMob.kind === 'zombie') {
        this.spawnDroppedItem(Math.random() > 0.4 ? BlockId.COAL : BlockId.IRON_INGOT, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
      } else {
        this.spawnDroppedItem(BlockId.GUNPOWDER, 1 + Math.floor(Math.random() * 2), hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
        this.spawnDroppedItem(BlockId.COAL, 1, hitMob.pos.x, hitMob.pos.y + 0.5, hitMob.pos.z);
      }
      this.scene.remove(hitMob.group);
      disposeMob(hitMob);
      this.mobs = this.mobs.filter((m) => m !== hitMob);
    }
    return true;
  }

  private tryUseOrPlaceBlock() {
    if (this.spectating) return;
    const held = this.inventory[this.selectedSlot];

    // Check interactive blocks first (Crafting Table, Furnace, Chest, TNT)
    const ray = this.raycastVoxel(5.5);
    if (ray.hit) {
      if (ray.blockId === BlockId.CRAFTING_TABLE) {
        this.activeStation = 'crafting_table';
        this.activeChestPos = null;
        this.craftingGridSize = 3;
        this.setPhase('inventory');
        return;
      }
      if (ray.blockId === BlockId.FURNACE) {
        this.activeStation = 'furnace';
        this.activeChestPos = null;
        this.craftingGridSize = 2;
        this.setPhase('inventory');
        this.showStatus('Furnace — Smelt Ores, Sand, Clay & Food with Coal');
        return;
      }
      if (ray.blockId === BlockId.CHEST) {
        this.activeStation = 'chest';
        this.activeChestPos = { x: ray.wx, y: ray.wy, z: ray.wz };
        this.getOrCreateChest(ray.wx, ray.wy, ray.wz);
        this.craftingGridSize = 2;
        this.setPhase('inventory');
        this.showStatus('Chest — Store & retrieve items');
        return;
      }
      if (ray.blockId === BlockId.TNT) {
        this.world.setBlock(ray.wx, ray.wy, ray.wz, BlockId.AIR);
        if (!this.isApplyingRemoteUpdate) {
          this.callbacks.onLocalBlockSet?.(ray.wx, ray.wy, ray.wz, BlockId.AIR);
        }
        this.grassDirty = true;
        this.triggerExplosion(ray.wx + 0.5, ray.wy + 0.5, ray.wz + 0.5, 3.2);
        this.showStatus('TNT Detonated!');
        return;
      }
    }

    if (!held) return;
    const def = BLOCK_DEFS[held.id];
    if (!def) return;

    // Equip armor piece from hotbar on Right-Click
    if (def.armorSlot) {
      const prevEquipped = this.armor[def.armorSlot];
      this.armor[def.armorSlot] = { id: held.id, count: 1 };
      this.inventory[this.selectedSlot] = prevEquipped;
      soundEngine.playPlace(def.sound);
      this.triggerSwing();
      this.updateViewModelItem();
      this.showStatus(`Equipped ${def.name} (+${def.armorDefense ?? 0} Armor)`);
      this.emitHud();
      return;
    }

    // Eat food in Survival/Hardcore mode
    if (def.foodRestore && this.isSurvivalLike && (this.hunger < this.maxHunger || this.health < this.maxHealth)) {
      this.hunger = Math.min(this.maxHunger, this.hunger + def.foodRestore);
      this.health = Math.min(this.maxHealth, this.health + Math.ceil(def.foodRestore * 0.5));
      held.count -= 1;
      if (held.count <= 0) this.inventory[this.selectedSlot] = null;
      soundEngine.playEat();
      this.triggerSwing();
      this.updateViewModelItem();
      this.emitHud();
      return;
    }

    // Flint & Steel ignites Obsidian Nether Portal frames
    if (held.id === BlockId.FLINT_AND_STEEL && ray.hit) {
      const tx = ray.wx + ray.nx;
      const ty = ray.wy + ray.ny;
      const tz = ray.wz + ray.nz;
      soundEngine.playPlace('stone');
      this.triggerSwing();
      this.particles.spawnBurst(tx + 0.5, ty + 0.5, tz + 0.5, 0xff9a28, 12, 3.6);
      const ignited = this.tryIgniteNetherPortal(tx, ty, tz) || this.tryIgniteNetherPortal(ray.wx, ray.wy, ray.wz);
      if (ignited) {
        soundEngine.playPlace('glass');
        this.particles.spawnBurst(tx + 0.5, ty + 1.0, tz + 0.5, 0xb84dff, 22, 4.5);
        this.showStatus('Nether Portal ignited! Step inside to travel between dimensions');
      } else {
        this.showStatus('Build a closed Obsidian frame (at least 4 wide × 5 tall) to ignite a Portal');
      }
      this.emitHud();
      return;
    }

    // Place block
    if (!def.isBlock || !ray.hit) return;

    const px = ray.wx + ray.nx;
    const py = ray.wy + ray.ny;
    const pz = ray.wz + ray.nz;
    if (py <= 0 || py >= CHUNK_H) return;

    // Prevent placing inside player AABB if solid
    if (def.solid) {
      const overlapsPlayer = (pos: THREE.Vector3) => {
        const pMinX = pos.x - PLAYER_HALF_W;
        const pMaxX = pos.x + PLAYER_HALF_W;
        const pMinY = pos.y;
        const pMaxY = pos.y + PLAYER_H;
        const pMinZ = pos.z - PLAYER_HALF_W;
        const pMaxZ = pos.z + PLAYER_HALF_W;
        return (
          px + 1 > pMinX &&
          px < pMaxX &&
          py + 1 > pMinY &&
          py < pMaxY &&
          pz + 1 > pMinZ &&
          pz < pMaxZ
        );
      };
      if (overlapsPlayer(this.playerPos) || (this.twoPlayerMode && overlapsPlayer(this.p2Pos))) return;
    }

    this.world.setBlock(px, py, pz, held.id);
    if (!this.isApplyingRemoteUpdate) {
      this.callbacks.onLocalBlockSet?.(px, py, pz, held.id);
    }
    this.grassDirty = true;
    this.blocksPlaced++;
    soundEngine.playPlace(def.sound);
    this.triggerSwing();

    if (this.isSurvivalLike) {
      held.count -= 1;
      if (held.count <= 0) this.inventory[this.selectedSlot] = null;
      this.updateViewModelItem();
    }
    this.emitHud();
  }

  private tryUseOrPlaceBlockP2() {
    if (this.spectating) return;
    const held = this.p2Inventory[this.p2SelectedSlot];
    const ray = this.raycastVoxel(5.5, this.p2Camera);
    if (ray.hit && ray.blockId === BlockId.TNT) {
      this.world.setBlock(ray.wx, ray.wy, ray.wz, BlockId.AIR);
      if (!this.isApplyingRemoteUpdate) {
        this.callbacks.onLocalBlockSet?.(ray.wx, ray.wy, ray.wz, BlockId.AIR);
      }
      this.grassDirty = true;
      this.triggerExplosion(ray.wx + 0.5, ray.wy + 0.5, ray.wz + 0.5, 3.2);
      this.showStatus('P2 Detonated TNT!');
      return;
    }

    if (!held) return;
    const def = BLOCK_DEFS[held.id];
    if (!def) return;

    if (def.foodRestore && this.isSurvivalLike && (this.p2Hunger < this.p2MaxHunger || this.p2Health < this.p2MaxHealth)) {
      this.p2Hunger = Math.min(this.p2MaxHunger, this.p2Hunger + def.foodRestore);
      this.p2Health = Math.min(this.p2MaxHealth, this.p2Health + Math.ceil(def.foodRestore * 0.5));
      held.count -= 1;
      if (held.count <= 0) this.p2Inventory[this.p2SelectedSlot] = null;
      soundEngine.playEat();
      this.p2SwingTimer = this.swingDuration;
      this.updateP2ViewModelItem();
      this.emitHud();
      return;
    }

    if (held.id === BlockId.FLINT_AND_STEEL && ray.hit) {
      const tx = ray.wx + ray.nx;
      const ty = ray.wy + ray.ny;
      const tz = ray.wz + ray.nz;
      soundEngine.playPlace('stone');
      this.p2SwingTimer = this.swingDuration;
      this.particles.spawnBurst(tx + 0.5, ty + 0.5, tz + 0.5, 0xff9a28, 12, 3.6);
      this.tryIgniteNetherPortal(tx, ty, tz);
      this.emitHud();
      return;
    }

    if (!def.isBlock || !ray.hit) return;

    const px = ray.wx + ray.nx;
    const py = ray.wy + ray.ny;
    const pz = ray.wz + ray.nz;
    if (py <= 0 || py >= CHUNK_H) return;

    if (def.solid) {
      const overlapsPlayer = (pos: THREE.Vector3) => {
        const pMinX = pos.x - PLAYER_HALF_W;
        const pMaxX = pos.x + PLAYER_HALF_W;
        const pMinY = pos.y;
        const pMaxY = pos.y + PLAYER_H;
        const pMinZ = pos.z - PLAYER_HALF_W;
        const pMaxZ = pos.z + PLAYER_HALF_W;
        return (
          px + 1 > pMinX &&
          px < pMaxX &&
          py + 1 > pMinY &&
          py < pMaxY &&
          pz + 1 > pMinZ &&
          pz < pMaxZ
        );
      };
      if (overlapsPlayer(this.playerPos) || overlapsPlayer(this.p2Pos)) return;
    }

    this.world.setBlock(px, py, pz, held.id);
    if (!this.isApplyingRemoteUpdate) {
      this.callbacks.onLocalBlockSet?.(px, py, pz, held.id);
    }
    this.grassDirty = true;
    this.blocksPlaced++;
    soundEngine.playPlace(def.sound);
    this.p2SwingTimer = this.swingDuration;

    if (this.isSurvivalLike) {
      held.count -= 1;
      if (held.count <= 0) this.p2Inventory[this.p2SelectedSlot] = null;
      this.updateP2ViewModelItem();
    }
    this.emitHud();
  }

  private isBlockSolid(wx: number, wy: number, wz: number): boolean {
    const id = this.world.getBlock(wx, wy, wz);
    return !!BLOCK_DEFS[id]?.solid;
  }

  private collidesAABB(pos: THREE.Vector3): boolean {
    const minX = Math.floor(pos.x - PLAYER_HALF_W);
    const maxX = Math.floor(pos.x + PLAYER_HALF_W);
    const minY = Math.floor(pos.y + 0.01);
    const maxY = Math.floor(pos.y + PLAYER_H - 0.01);
    const minZ = Math.floor(pos.z - PLAYER_HALF_W);
    const maxZ = Math.floor(pos.z + PLAYER_HALF_W);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.isBlockSolid(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  private damagePlayer(amount: number, bypassArmor = false) {
    if (!this.isSurvivalLike || this.phase !== 'playing' || amount <= 0) return;
    const rawDamage = this.mode === 'hardcore' && !bypassArmor ? Math.max(1, Math.round(amount * 1.5)) : amount;
    let finalDamage = rawDamage;
    if (!bypassArmor) {
      const def = this.getArmorDefense();
      if (def > 0) {
        const reduction = Math.min(0.8, (def / 20) * 0.8);
        finalDamage = Math.max(1, Math.round(rawDamage * (1 - reduction)));
      }
    }
    this.health = Math.max(0, this.health - finalDamage);
    this.cameraShake = Math.min(1, this.cameraShake + 0.45);
    soundEngine.playHurt();
    if (this.health <= 0) {
      if (this.mode === 'hardcore') {
        this.hardcoreDead = true;
        this.triggerAutoSave();
      }
      this.setPhase('gameover');
    } else {
      this.emitHud();
    }
  }

  private damageP2(amount: number) {
    if (!this.twoPlayerMode || !this.isSurvivalLike || this.phase !== 'playing' || amount <= 0) return;
    const finalAmount = this.mode === 'hardcore' ? Math.max(1, Math.round(amount * 1.5)) : amount;
    this.p2Health = Math.max(0, this.p2Health - finalAmount);
    soundEngine.playHurt();
    if (this.p2Health <= 0) {
      if (this.mode === 'hardcore') {
        this.hardcoreDead = true;
        this.triggerAutoSave();
        this.setPhase('gameover');
        return;
      }
      this.particles.spawnBurst(this.p2Pos.x, this.p2Pos.y + 0.9, this.p2Pos.z, 0xf43f5e, 20, 5.0);
      this.spawnPlayer2NearP1(false);
      this.p2Health = 20;
      this.p2Hunger = 20;
      this.showStatus('Player 2 respawned next to Player 1!', 2.6);
    }
    this.emitHud();
  }

  private findPortalInteriorInPlane(
    sx: number,
    sy: number,
    sz: number,
    axis: 'x' | 'z'
  ): [number, number, number][] | null {
    const canBeInterior = (x: number, y: number, z: number) => {
      const id = this.world.getBlock(x, y, z);
      return id === BlockId.AIR || id === BlockId.NETHER_PORTAL;
    };
    const isFrame = (x: number, y: number, z: number) => this.world.getBlock(x, y, z) === BlockId.OBSIDIAN;
    const step = (base: number, d: number, yOff: number): [number, number, number] =>
      axis === 'x' ? [sx + d, sy + yOff, sz] : [sx, sy + yOff, sz + d];
    void step;

    if (!canBeInterior(sx, sy, sz)) return null;

    // Scan bottom & top bounds vertically
    let minY = sy;
    while (sy - minY < 6 && canBeInterior(sx, minY - 1, sz)) minY--;
    if (!isFrame(sx, minY - 1, sz)) return null;

    let maxY = sy;
    while (maxY - minY < 6 && canBeInterior(sx, maxY + 1, sz)) maxY++;
    if (!isFrame(sx, maxY + 1, sz)) return null;

    const h = maxY - minY + 1;
    if (h < 3 || h > 5) return null;

    // Scan left & right bounds along axis
    const coord = axis === 'x' ? sx : sz;
    let minC = coord;
    while (coord - minC < 6) {
      const nc = minC - 1;
      const x = axis === 'x' ? nc : sx;
      const z = axis === 'z' ? nc : sz;
      if (!canBeInterior(x, sy, z)) break;
      minC = nc;
    }
    let maxC = coord;
    while (maxC - minC < 6) {
      const nc = maxC + 1;
      const x = axis === 'x' ? nc : sx;
      const z = axis === 'z' ? nc : sz;
      if (!canBeInterior(x, sy, z)) break;
      maxC = nc;
    }

    const w = maxC - minC + 1;
    if (w < 2 || w > 5) return null;

    const cells: [number, number, number][] = [];
    for (let c = minC; c <= maxC; c++) {
      const bx = axis === 'x' ? c : sx;
      const bz = axis === 'z' ? c : sz;
      if (!isFrame(bx, minY - 1, bz) || !isFrame(bx, maxY + 1, bz)) return null;
      for (let y = minY; y <= maxY; y++) {
        if (!canBeInterior(bx, y, bz)) return null;
        cells.push([bx, y, bz]);
      }
    }

    for (let y = minY; y <= maxY; y++) {
      const lx = axis === 'x' ? minC - 1 : sx;
      const lz = axis === 'z' ? minC - 1 : sz;
      const rx = axis === 'x' ? maxC + 1 : sx;
      const rz = axis === 'z' ? maxC + 1 : sz;
      if (!isFrame(lx, y, lz) || !isFrame(rx, y, rz)) return null;
    }

    return cells;
  }

  private tryIgniteNetherPortal(wx: number, wy: number, wz: number): boolean {
    const candidates: [number, number, number][] = [
      [wx, wy, wz],
      [wx, wy + 1, wz],
      [wx + 1, wy + 1, wz],
      [wx - 1, wy + 1, wz],
      [wx, wy + 1, wz + 1],
      [wx, wy + 1, wz - 1],
    ];
    for (const [cx, cy, cz] of candidates) {
      const cells =
        this.findPortalInteriorInPlane(cx, cy, cz, 'x') ??
        this.findPortalInteriorInPlane(cx, cy, cz, 'z');
      if (cells && cells.length >= 6) {
        for (const [px, py, pz] of cells) {
          this.world.setBlock(px, py, pz, BlockId.NETHER_PORTAL);
          if (!this.isApplyingRemoteUpdate) {
            this.callbacks.onLocalBlockSet?.(px, py, pz, BlockId.NETHER_PORTAL);
          }
        }
        return true;
      }
    }
    return false;
  }

  private clearConnectedPortalNear(wx: number, wy: number, wz: number) {
    const visited = new Set<string>();
    const queue: [number, number, number][] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const x = wx + dx;
          const y = wy + dy;
          const z = wz + dz;
          if (this.world.getBlock(x, y, z) === BlockId.NETHER_PORTAL) {
            queue.push([x, y, z]);
          }
        }
      }
    }
    while (queue.length > 0) {
      const [cx, cy, cz] = queue.shift()!;
      const k = `${cx},${cy},${cz}`;
      if (visited.has(k)) continue;
      visited.add(k);
      if (this.world.getBlock(cx, cy, cz) !== BlockId.NETHER_PORTAL) continue;
      this.world.setBlock(cx, cy, cz, BlockId.AIR);
      if (!this.isApplyingRemoteUpdate) {
        this.callbacks.onLocalBlockSet?.(cx, cy, cz, BlockId.AIR);
      }
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        queue.push([cx + dx, cy + dy, cz + dz]);
      }
    }
  }

  private ensureArrivalPortal(targetDim: DimensionId, nearX: number, nearY: number, nearZ: number): THREE.Vector3 {
    const px = Math.floor(nearX);
    const pz = Math.floor(nearZ);
    // Look for an existing Nether Portal within 12 blocks horizontally
    let bestPortal: { x: number; y: number; z: number; dist: number } | null = null;
    for (let dx = -12; dx <= 12; dx++) {
      for (let dz = -12; dz <= 12; dz++) {
        for (let y = 4; y < CHUNK_H - 5; y++) {
          if (this.world.getBlock(px + dx, y, pz + dz) === BlockId.NETHER_PORTAL) {
            const d = Math.hypot(dx, dz);
            if (!bestPortal || d < bestPortal.dist) {
              bestPortal = { x: px + dx, y, z: pz + dz, dist: d };
            }
          }
        }
      }
    }
    if (bestPortal) {
      return new THREE.Vector3(bestPortal.x + 0.5, bestPortal.y, bestPortal.z + 1.5);
    }

    // Build a safe landing platform + lit 4x5 Obsidian Nether Portal
    const baseFloorY =
      targetDim === 'nether'
        ? Math.max(NETHER_LAVA_LEVEL + 4, Math.min(38, this.world.getSurfaceY(px, pz) - 1))
        : Math.max(SEA_LEVEL + 1, Math.min(CHUNK_H - 8, this.world.getSurfaceY(px, pz) - 1));

    const padMat = targetDim === 'nether' ? BlockId.NETHER_BRICKS : BlockId.OBSIDIAN;
    for (let dx = -2; dx <= 3; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        this.world.setBlock(px + dx, baseFloorY, pz + dz, padMat);
        for (let dy = 1; dy <= 5; dy++) {
          this.world.setBlock(px + dx, baseFloorY + dy, pz + dz, BlockId.AIR);
        }
      }
    }
    // 4 wide (dx = -1..2) x 5 tall (dy = 1..5) Obsidian frame
    for (let dx = -1; dx <= 2; dx++) {
      this.world.setBlock(px + dx, baseFloorY + 1, pz, BlockId.OBSIDIAN);
      this.world.setBlock(px + dx, baseFloorY + 5, pz, BlockId.OBSIDIAN);
    }
    for (let dy = 1; dy <= 5; dy++) {
      this.world.setBlock(px - 1, baseFloorY + dy, pz, BlockId.OBSIDIAN);
      this.world.setBlock(px + 2, baseFloorY + dy, pz, BlockId.OBSIDIAN);
    }
    for (let dx = 0; dx <= 1; dx++) {
      for (let dy = 2; dy <= 4; dy++) {
        this.world.setBlock(px + dx, baseFloorY + dy, pz, BlockId.NETHER_PORTAL);
      }
    }
    return new THREE.Vector3(px + 1.0, baseFloorY + 1.2, pz + 1.5);
  }

  public switchDimension(target: DimensionId) {
    if (this.dimension === target) return;
    this.syncActiveDimensionState();

    this.dimension = target;
    this.portalChargeTimer = 0;
    this.portalCooldown = 3.5;
    this.clearWorldObjects();

    this.world = new VoxelWorld(this.seed, this.opaqueMat, this.cutoutMat, this.waterMat, this.worldType, target);
    const targetModMap = target === 'nether' ? this.netherModifiedBlocks : this.overworldModifiedBlocks;
    for (const [k, v] of targetModMap) {
      this.world.modifiedBlocks.set(k, v);
    }
    this.scene.add(this.world.group);

    const anchor = target === 'nether' ? this.netherReturnPos : this.overworldReturnPos;
    const baseCx = Math.floor(anchor.x / 16);
    const baseCz = Math.floor(anchor.z / 16);
    for (let cx = baseCx - 3; cx <= baseCx + 3; cx++) {
      for (let cz = baseCz - 3; cz <= baseCz + 3; cz++) {
        const ch = this.world.generateChunk(cx, cz);
        this.world.rebuildChunkMesh(ch);
      }
    }

    const landing = this.ensureArrivalPortal(target, anchor.x, anchor.y, anchor.z);
    for (let cx = baseCx - 1; cx <= baseCx + 1; cx++) {
      for (let cz = baseCz - 1; cz <= baseCz + 1; cz++) {
        const ch = this.world.chunks.get(this.world.chunkKey(cx, cz));
        if (ch?.dirty) this.world.rebuildChunkMesh(ch);
      }
    }

    this.playerPos.copy(landing);
    this.playerVel.set(0, 0, 0);
    this.fallPeakY = landing.y;
    this.grassDirty = true;
    this.updateDayNightAndLighting(0);
    soundEngine.playPlace('glass');
    this.particles.spawnBurst(landing.x, landing.y + 1.0, landing.z, 0xb84dff, 26, 5.2);
    this.showStatus(
      target === 'nether'
        ? 'Entered The Nether! Beware Lava seas, Soul Sand & Nether Fortresses'
        : 'Returned to the Overworld!',
      4.5
    );
    this.triggerAutoSave();
    this.emitHud();
  }

  private updatePlayer(dt: number) {
    // Check underwater / lava / soul sand / Nether portal
    const headBlock = this.world.getBlock(this.playerPos.x, this.playerPos.y + PLAYER_EYE, this.playerPos.z);
    const feetBlock = this.world.getBlock(this.playerPos.x, this.playerPos.y + 0.3, this.playerPos.z);
    const bodyMidBlock = this.world.getBlock(this.playerPos.x, this.playerPos.y + 0.9, this.playerPos.z);
    const underBlock = this.world.getBlock(this.playerPos.x, this.playerPos.y - 0.15, this.playerPos.z);
    this.isUnderwater = headBlock === BlockId.WATER;
    this.inLavaUnderwater = headBlock === BlockId.LAVA;
    const inWater = feetBlock === BlockId.WATER || this.isUnderwater;
    const inLava = feetBlock === BlockId.LAVA || bodyMidBlock === BlockId.LAVA || this.inLavaUnderwater;
    const onSoulSand = underBlock === BlockId.SOUL_SAND;

    if (inLava && this.isSurvivalLike) {
      this.lavaDamageTimer += dt;
      if (this.lavaDamageTimer >= 0.65) {
        this.lavaDamageTimer = 0;
        this.damagePlayer(4);
      }
    } else {
      this.lavaDamageTimer = 0.45;
    }

    this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    const inPortal = feetBlock === BlockId.NETHER_PORTAL || bodyMidBlock === BlockId.NETHER_PORTAL;
    if (inPortal && this.portalCooldown <= 0 && !this.isMultiplayer) {
      const chargeNeed = this.mode === 'creative' ? 0.5 : 1.5;
      this.portalChargeTimer += dt;
      if (this.portalChargeTimer >= chargeNeed) {
        this.switchDimension(this.dimension === 'overworld' ? 'nether' : 'overworld');
        return;
      }
    } else {
      this.portalChargeTimer = Math.max(0, this.portalChargeTimer - dt * 2.5);
    }

    // Movement vector from yaw
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveX = 0;
    let moveZ = 0;
    const allowArrowsForP1 = !this.twoPlayerMode;
    if (this.heldKeys.has('KeyW') || (allowArrowsForP1 && this.heldKeys.has('ArrowUp'))) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (this.heldKeys.has('KeyS') || (allowArrowsForP1 && this.heldKeys.has('ArrowDown'))) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (this.heldKeys.has('KeyD') || (allowArrowsForP1 && this.heldKeys.has('ArrowRight'))) {
      moveX += rightX;
      moveZ += rightZ;
    }
    if (this.heldKeys.has('KeyA') || (allowArrowsForP1 && this.heldKeys.has('ArrowLeft'))) {
      moveX -= rightX;
      moveZ -= rightZ;
    }

    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const sprinting = this.heldKeys.has('ShiftLeft') || (allowArrowsForP1 && this.heldKeys.has('ShiftRight'));
    const speedPackMult = this.activeBehaviorPacks.has('hyper_sprint') ? 1.65 : 1.0;
    const soulMult = onSoulSand && !this.isFlying ? 0.58 : 1.0;
    const baseSpeed = (this.isFlying ? 11.5 : inLava ? 2.1 : inWater ? 3.4 : sprinting ? 6.8 : 4.6) * speedPackMult * soulMult;
    const targetVx = moveX * baseSpeed;
    const targetVz = moveZ * baseSpeed;

    const accel = this.onGround || this.isFlying ? 18 : 7.5;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, accel, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, accel, dt);

    const gravMult = this.activeBehaviorPacks.has('lunar_gravity') ? 0.45 : 1.0;
    if (this.isFlying) {
      let targetVy = 0;
      if (this.heldKeys.has('Space')) targetVy += 8.0;
      if (this.heldKeys.has('KeyC') || this.heldKeys.has('ControlLeft')) targetVy -= 8.0;
      this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, targetVy, 12, dt);
    } else if (inWater || inLava) {
      this.playerVel.y -= GRAVITY * (inLava ? 0.16 : 0.25) * gravMult * dt;
      if (this.heldKeys.has('Space')) {
        this.playerVel.y = Math.min(inLava ? 3.5 : 4.8, this.playerVel.y + 18 * dt);
      }
      this.playerVel.y = Math.max(inLava ? -2.8 : -4.5, this.playerVel.y);
      this.fallPeakY = this.playerPos.y;
    } else {
      this.playerVel.y -= GRAVITY * gravMult * dt;
      this.playerVel.y = Math.max(-32, this.playerVel.y);
    }

    // Coyote time & jump buffer
    if (this.onGround) {
      this.coyoteTimer = 0.11;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (!this.isFlying && this.coyoteTimer > 0) {
        const jumpMult = this.activeBehaviorPacks.has('hyper_sprint') ? 1.18 : 1.0;
        this.playerVel.y = JUMP_VEL * jumpMult;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }
    }

    // Separate-axis AABB resolution
    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;

    this.playerPos.x += this.playerVel.x * dt;
    if (this.collidesAABB(this.playerPos)) {
      this.playerPos.x = prevX;
      this.playerVel.x = 0;
    }

    this.playerPos.z += this.playerVel.z * dt;
    if (this.collidesAABB(this.playerPos)) {
      this.playerPos.z = prevZ;
      this.playerVel.z = 0;
    }

    const prevY = this.playerPos.y;
    const prevVy = this.playerVel.y;
    const wasOnGround = this.onGround;
    this.playerPos.y += this.playerVel.y * dt;
    if (this.collidesAABB(this.playerPos)) {
      if (this.playerVel.y < 0) {
        this.playerPos.y = Math.floor(this.playerPos.y + 0.01) + 1;
        // Physical landing knee dip + fall damage check
        if (!wasOnGround && !this.isFlying) {
          this.landingDip = Math.max(this.landingDip, Math.min(0.22, Math.abs(prevVy) * 0.012));
        }
        if (!wasOnGround && !this.isFlying && !inWater && this.worldType !== 'parkour' && this.worldType !== 'parkour100' && this.worldType !== 'wouldyourather') {
          const fallDist = this.fallPeakY - this.playerPos.y;
          const safeFall = this.activeBehaviorPacks.has('lunar_gravity') ? 9.5 : 3.8;
          if (fallDist > safeFall) {
            const dmg = Math.floor(fallDist - (safeFall - 0.8));
            if (dmg > 0) this.damagePlayer(dmg);
          }
        }
        this.onGround = true;
        this.fallPeakY = this.playerPos.y;
      } else {
        this.playerPos.y = prevY;
      }
      this.playerVel.y = 0;
    } else {
      this.onGround = false;
      if (this.playerPos.y > this.fallPeakY) {
        this.fallPeakY = this.playerPos.y;
      }
    }

    // Void hazard on Skyblock/OneBlock, Checkpoint recovery on Parkour/WouldYouRather, or solid world floor clamp
    if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      const voidY = this.worldType === 'parkour100' || this.worldType === 'wouldyourather' ? 14 : 18;
      if (this.playerPos.y < voidY && !this.isFlying) {
        this.teleportToParkourCheckpoint(false);
      }
    } else if (this.worldType === 'skyblock' || this.worldType === 'oneblock') {
      if (this.playerPos.y < 1.5) {
        if (this.isSurvivalLike && !this.isFlying) {
          if (this.twoPlayerMode) {
            if (!this.isBlockSolid(0, 32, 0)) {
              this.world.setBlock(0, 32, 0, BlockId.GRASS);
            }
            this.playerPos.set(this.worldType === 'oneblock' ? 0.32 : 0.5, 34.5, 0.5);
            this.playerVel.set(0, 0, 0);
            this.fallPeakY = 34.5;
            this.damagePlayer(6, true);
          } else {
            this.damagePlayer(20, true);
          }
        } else {
          this.playerPos.y = 1.5;
          this.playerVel.y = 0;
        }
      }
    } else if (this.playerPos.y < 1.5) {
      this.playerPos.y = 1.5;
      this.playerVel.y = 0;
      this.onGround = true;
    }

    // Footsteps & walk bob
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.onGround && horizSpeed > 0.6) {
      this.walkBobPhase += dt * horizSpeed * 2.1;
      this.stepDistAccum += horizSpeed * dt;
      if (this.stepDistAccum > 1.85) {
        this.stepDistAccum = 0;
        const underId = this.world.getBlock(this.playerPos.x, this.playerPos.y - 0.2, this.playerPos.z);
        const cat = BLOCK_DEFS[underId]?.sound ?? 'grass';
        soundEngine.playStep(cat);
      }
    } else {
      this.walkBobPhase = THREE.MathUtils.damp(this.walkBobPhase, Math.round(this.walkBobPhase / Math.PI) * Math.PI, 8, dt);
    }

    // Survival/Hardcore hunger & regen (keep hunger full on Parkour so sprint-jumps never stall)
    if (this.isSurvivalLike && this.worldType !== 'parkour' && this.worldType !== 'parkour100' && this.worldType !== 'wouldyourather') {
      this.hungerTimer += dt * (sprinting && horizSpeed > 1 ? 2.2 : 1.0);
      if (this.hungerTimer >= 16) {
        this.hungerTimer = 0;
        if (this.hunger > 0) this.hunger--;
      }
      const vampiric = this.activeBehaviorPacks.has('vampiric_regen');
      const regenInterval = vampiric ? 0.9 : 2.5;
      const minHungerForRegen = vampiric ? 6 : 16;
      if (this.hunger >= minHungerForRegen && this.health < this.maxHealth) {
        this.regenTimer += dt;
        if (this.regenTimer >= regenInterval) {
          this.regenTimer = 0;
          this.health = Math.min(this.maxHealth, this.health + 1);
        }
      } else if (this.hunger === 0) {
        this.regenTimer += dt;
        if (this.regenTimer >= 4.0) {
          this.regenTimer = 0;
          if (this.health > 1) this.damagePlayer(1, true);
        }
      }
    }

    // Real-life camera immersion: walk bob, breathing, landing impact dip, sprint FOV kick
    this.landingDip = THREE.MathUtils.damp(this.landingDip, 0, 12, dt);
    const breathY = Math.sin(this.shaderTimeUniform.value * 1.45) * 0.011;
    const bobY = this.onGround && horizSpeed > 0.6 ? Math.sin(this.walkBobPhase * 2) * 0.045 : breathY;
    const shakeX = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.16 : 0;
    const shakeY = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.16 : 0;
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.4);

    const targetFov = this.baseFov + (sprinting && horizSpeed > 1.8 ? 4.5 : 0) - (this.isUnderwater ? 5.5 : 0);
    const nextFov = THREE.MathUtils.damp(this.currentFov, targetFov, 9, dt);
    if (Math.abs(nextFov - this.currentFov) > 0.02) {
      this.currentFov = nextFov;
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.set(
      this.playerPos.x + shakeX,
      this.playerPos.y + PLAYER_EYE + bobY - this.landingDip + shakeY,
      this.playerPos.z
    );
    this.camera.up.set(0, 1, 0);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Viewmodel swing & bob
    let swingAngle = 0;
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const t = 1 - this.swingTimer / this.swingDuration;
      swingAngle = Math.sin(t * Math.PI) * 0.95;
    }
    this.viewModelGroup.position.set(
      0.36 + Math.cos(this.walkBobPhase) * 0.018,
      -0.32 + Math.abs(Math.sin(this.walkBobPhase)) * -0.018 - swingAngle * 0.08,
      -0.52 - swingAngle * 0.14
    );
    this.viewModelGroup.rotation.set(-swingAngle * 0.9, swingAngle * 0.35, 0);
  }

  private updateMiningAndTarget(dt: number) {
    const ray = this.raycastVoxel(5.5);
    if (ray.hit) {
      this.targetOutline.visible = true;
      this.targetOutline.position.set(ray.wx + 0.5, ray.wy + 0.5, ray.wz + 0.5);
    } else {
      this.targetOutline.visible = false;
    }

    if (this.mouseRightDown) {
      this.placeCooldown -= dt;
      if (this.placeCooldown <= 0) {
        this.tryUseOrPlaceBlock();
        this.placeCooldown = 0.2;
      }
    }

    if (this.spectating || !this.mouseLeftDown || !ray.hit) {
      this.miningTarget = null;
      this.miningProgress = 0;
      this.crackMesh.visible = false;
      return;
    }

    const def = BLOCK_DEFS[ray.blockId];
    if (!def || def.hardness < 0) {
      this.crackMesh.visible = false;
      return;
    }

    // Creative mode instant break
    if (this.mode === 'creative') {
      if (this.placeCooldown <= 0) {
        this.breakBlockAt(ray.wx, ray.wy, ray.wz, ray.blockId, false);
        this.triggerSwing();
        this.placeCooldown = 0.16;
      }
      this.placeCooldown -= dt;
      return;
    }

    // Check if target block changed
    if (
      !this.miningTarget ||
      this.miningTarget.x !== ray.wx ||
      this.miningTarget.y !== ray.wy ||
      this.miningTarget.z !== ray.wz
    ) {
      this.miningTarget = { x: ray.wx, y: ray.wy, z: ray.wz, id: ray.blockId };
      this.miningProgress = 0;
    }

    // Compute mining speed multiplier from held tool
    const held = this.inventory[this.selectedSlot];
    const heldDef = held ? BLOCK_DEFS[held.id] : null;
    let speedMult = 1.0;
    if (heldDef?.toolType && heldDef.toolType === def.preferredTool && heldDef.miningSpeed) {
      speedMult = heldDef.miningSpeed;
    } else if (def.preferredTool === 'pickaxe' && (!heldDef || heldDef.toolType !== 'pickaxe')) {
      speedMult = 0.35; // punching stone with bare hands is slow
    }
    if (this.activeBehaviorPacks.has('titan_haste')) {
      speedMult *= 4.0;
    }

    this.miningProgress += (dt * speedMult) / def.hardness;
    this.digSoundTimer -= dt;
    if (this.digSoundTimer <= 0) {
      this.digSoundTimer = 0.24;
      soundEngine.playDigTick(def.sound);
      this.triggerSwing();
    }

    const stage = Math.min(9, Math.floor(this.miningProgress * 10));
    this.crackMat.map = this.crackTextures[stage];
    this.crackMat.needsUpdate = true;
    this.crackMesh.position.set(ray.wx + 0.5, ray.wy + 0.5, ray.wz + 0.5);
    this.crackMesh.visible = true;

    if (this.miningProgress >= 1.0) {
      const canHarvest =
        !def.minTier ||
        (heldDef?.toolType === def.preferredTool && (heldDef.toolTier ?? 0) >= def.minTier);
      this.breakBlockAt(ray.wx, ray.wy, ray.wz, ray.blockId, canHarvest);
      this.miningProgress = 0;
      this.miningTarget = null;
      this.crackMesh.visible = false;
    }
  }

  private addItemToP2InventoryWithRemainder(id: BlockId, count: number): number {
    const { updatedSlots, remaining } = addBlockToEngineInventory(this.p2Inventory, id, count, (itemId) =>
      this.getIcon(itemId)
    );
    if (remaining < count) {
      this.p2Inventory = updatedSlots;
      this.updateP2ViewModelItem();
    }
    return remaining;
  }

  private updatePlayer2(dt: number) {
    this.p2AttackCooldown = Math.max(0, this.p2AttackCooldown - dt);

    // Keyboard Look (IJKL)
    const yawSpeed = 2.25;
    const pitchSpeed = 1.65;
    if (this.heldKeys.has('KeyJ')) this.p2Yaw += yawSpeed * dt;
    if (this.heldKeys.has('KeyL')) this.p2Yaw -= yawSpeed * dt;
    if (this.heldKeys.has('KeyI')) this.p2Pitch += pitchSpeed * dt;
    if (this.heldKeys.has('KeyK')) this.p2Pitch -= pitchSpeed * dt;
    this.p2Pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, this.p2Pitch));

    const headBlock = this.world.getBlock(this.p2Pos.x, this.p2Pos.y + PLAYER_EYE, this.p2Pos.z);
    const feetBlock = this.world.getBlock(this.p2Pos.x, this.p2Pos.y + 0.3, this.p2Pos.z);
    const bodyMidBlock = this.world.getBlock(this.p2Pos.x, this.p2Pos.y + 0.9, this.p2Pos.z);
    const underBlock = this.world.getBlock(this.p2Pos.x, this.p2Pos.y - 0.15, this.p2Pos.z);
    this.p2IsUnderwater = headBlock === BlockId.WATER;
    this.p2InLavaUnderwater = headBlock === BlockId.LAVA;
    const inWater = feetBlock === BlockId.WATER || this.p2IsUnderwater;
    const inLava = feetBlock === BlockId.LAVA || bodyMidBlock === BlockId.LAVA || this.p2InLavaUnderwater;
    const onSoulSand = underBlock === BlockId.SOUL_SAND;

    if (inLava && this.isSurvivalLike) {
      this.p2LavaDamageTimer += dt;
      if (this.p2LavaDamageTimer >= 0.65) {
        this.p2LavaDamageTimer = 0;
        this.damageP2(4);
      }
    } else {
      this.p2LavaDamageTimer = 0.45;
    }

    const forwardX = -Math.sin(this.p2Yaw);
    const forwardZ = -Math.cos(this.p2Yaw);
    const rightX = Math.cos(this.p2Yaw);
    const rightZ = -Math.sin(this.p2Yaw);

    let moveX = 0;
    let moveZ = 0;
    if (this.heldKeys.has('ArrowUp')) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (this.heldKeys.has('ArrowDown')) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (this.heldKeys.has('ArrowRight')) {
      moveX += rightX;
      moveZ += rightZ;
    }
    if (this.heldKeys.has('ArrowLeft')) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const speedPackMult = this.activeBehaviorPacks.has('hyper_sprint') ? 1.65 : 1.0;
    const soulMult = onSoulSand && !this.p2IsFlying ? 0.58 : 1.0;
    const baseSpeed = (this.p2IsFlying ? 11.5 : inLava ? 2.1 : inWater ? 3.4 : 4.9) * speedPackMult * soulMult;
    const accel = this.p2OnGround || this.p2IsFlying ? 18 : 7.5;
    this.p2Vel.x = THREE.MathUtils.damp(this.p2Vel.x, moveX * baseSpeed, accel, dt);
    this.p2Vel.z = THREE.MathUtils.damp(this.p2Vel.z, moveZ * baseSpeed, accel, dt);

    const gravMult = this.activeBehaviorPacks.has('lunar_gravity') ? 0.45 : 1.0;
    if (this.p2IsFlying) {
      let targetVy = 0;
      if (this.heldKeys.has('ShiftRight') || this.heldKeys.has('Numpad0')) targetVy += 8.0;
      if (this.heldKeys.has('Slash') || this.heldKeys.has('Backslash')) targetVy -= 8.0;
      this.p2Vel.y = THREE.MathUtils.damp(this.p2Vel.y, targetVy, 12, dt);
    } else if (inWater || inLava) {
      this.p2Vel.y -= GRAVITY * (inLava ? 0.16 : 0.25) * gravMult * dt;
      if (this.heldKeys.has('ShiftRight') || this.heldKeys.has('Numpad0')) {
        this.p2Vel.y = Math.min(inLava ? 3.5 : 4.8, this.p2Vel.y + 18 * dt);
      }
      this.p2Vel.y = Math.max(inLava ? -2.8 : -4.5, this.p2Vel.y);
      this.p2FallPeakY = this.p2Pos.y;
    } else {
      this.p2Vel.y -= GRAVITY * gravMult * dt;
      this.p2Vel.y = Math.max(-32, this.p2Vel.y);
    }

    if (this.p2OnGround) {
      this.p2CoyoteTimer = 0.11;
    } else {
      this.p2CoyoteTimer = Math.max(0, this.p2CoyoteTimer - dt);
    }

    if (this.p2JumpBufferTimer > 0) {
      this.p2JumpBufferTimer -= dt;
      if (!this.p2IsFlying && this.p2CoyoteTimer > 0) {
        const jumpMult = this.activeBehaviorPacks.has('hyper_sprint') ? 1.18 : 1.0;
        this.p2Vel.y = JUMP_VEL * jumpMult;
        this.p2OnGround = false;
        this.p2CoyoteTimer = 0;
        this.p2JumpBufferTimer = 0;
      }
    }

    const prevX = this.p2Pos.x;
    const prevZ = this.p2Pos.z;
    this.p2Pos.x += this.p2Vel.x * dt;
    if (this.collidesAABB(this.p2Pos)) {
      this.p2Pos.x = prevX;
      this.p2Vel.x = 0;
    }
    this.p2Pos.z += this.p2Vel.z * dt;
    if (this.collidesAABB(this.p2Pos)) {
      this.p2Pos.z = prevZ;
      this.p2Vel.z = 0;
    }

    const prevY = this.p2Pos.y;
    const prevVy = this.p2Vel.y;
    const wasOnGround = this.p2OnGround;
    this.p2Pos.y += this.p2Vel.y * dt;
    if (this.collidesAABB(this.p2Pos)) {
      if (this.p2Vel.y < 0) {
        this.p2Pos.y = Math.floor(this.p2Pos.y + 0.01) + 1;
        if (!wasOnGround && !this.p2IsFlying) {
          this.p2LandingDip = Math.max(this.p2LandingDip, Math.min(0.22, Math.abs(prevVy) * 0.012));
        }
        if (!wasOnGround && !this.p2IsFlying && !inWater && this.worldType !== 'parkour' && this.worldType !== 'parkour100' && this.worldType !== 'wouldyourather') {
          const fallDist = this.p2FallPeakY - this.p2Pos.y;
          const safeFall = this.activeBehaviorPacks.has('lunar_gravity') ? 9.5 : 3.8;
          if (fallDist > safeFall) {
            const dmg = Math.floor(fallDist - (safeFall - 0.8));
            if (dmg > 0) this.damageP2(dmg);
          }
        }
        this.p2OnGround = true;
        this.p2FallPeakY = this.p2Pos.y;
      } else {
        this.p2Pos.y = prevY;
      }
      this.p2Vel.y = 0;
    } else {
      this.p2OnGround = false;
      if (this.p2Pos.y > this.p2FallPeakY) {
        this.p2FallPeakY = this.p2Pos.y;
      }
    }

    // P2 Void / Parkour / WouldYouRather recovery
    if (this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather') {
      const voidY = this.worldType === 'parkour100' || this.worldType === 'wouldyourather' ? 14 : 18;
      if (this.p2Pos.y < voidY && !this.p2IsFlying) {
        this.p2Pos.copy(this.parkourCheckpoint).add(new THREE.Vector3(0.8, 0, 0));
        this.p2Vel.set(0, 0, 0);
        this.p2FallPeakY = this.p2Pos.y;
      }
    } else if (this.worldType === 'skyblock' || this.worldType === 'oneblock') {
      if (this.p2Pos.y < 1.5) {
        if (this.isSurvivalLike && !this.p2IsFlying) {
          if (!this.isBlockSolid(0, 32, 0)) {
            this.world.setBlock(0, 32, 0, BlockId.GRASS);
          }
          this.p2Pos.set(0.7, 34.5, 0.5);
          this.p2Vel.set(0, 0, 0);
          this.p2FallPeakY = 34.5;
          this.damageP2(6);
        } else {
          this.p2Pos.y = 1.5;
          this.p2Vel.y = 0;
        }
      }
    } else if (this.p2Pos.y < 1.5) {
      this.p2Pos.y = 1.5;
      this.p2Vel.y = 0;
      this.p2OnGround = true;
    }

    const horizSpeed = Math.hypot(this.p2Vel.x, this.p2Vel.z);
    if (this.p2OnGround && horizSpeed > 0.6) {
      this.p2WalkBobPhase += dt * horizSpeed * 2.1;
      this.p2StepDistAccum += horizSpeed * dt;
      if (this.p2StepDistAccum > 1.85) {
        this.p2StepDistAccum = 0;
      }
    } else {
      this.p2WalkBobPhase = THREE.MathUtils.damp(this.p2WalkBobPhase, Math.round(this.p2WalkBobPhase / Math.PI) * Math.PI, 8, dt);
    }

    if (this.isSurvivalLike && this.worldType !== 'parkour' && this.worldType !== 'parkour100' && this.worldType !== 'wouldyourather') {
      this.p2HungerTimer += dt;
      if (this.p2HungerTimer >= 16) {
        this.p2HungerTimer = 0;
        if (this.p2Hunger > 0) this.p2Hunger--;
      }
      const vampiric = this.activeBehaviorPacks.has('vampiric_regen');
      const regenInterval = vampiric ? 0.9 : 2.5;
      const minHungerForRegen = vampiric ? 6 : 16;
      if (this.p2Hunger >= minHungerForRegen && this.p2Health < this.p2MaxHealth) {
        this.p2RegenTimer += dt;
        if (this.p2RegenTimer >= regenInterval) {
          this.p2RegenTimer = 0;
          this.p2Health = Math.min(this.p2MaxHealth, this.p2Health + 1);
        }
      }
    }

    this.p2LandingDip = THREE.MathUtils.damp(this.p2LandingDip, 0, 12, dt);
    const breathY = Math.sin(this.shaderTimeUniform.value * 1.45 + 1.2) * 0.011;
    const bobY = this.p2OnGround && horizSpeed > 0.6 ? Math.sin(this.p2WalkBobPhase * 2) * 0.045 : breathY;

    this.p2Camera.position.set(this.p2Pos.x, this.p2Pos.y + PLAYER_EYE + bobY - this.p2LandingDip, this.p2Pos.z);
    this.p2Camera.up.set(0, 1, 0);
    this.p2Camera.rotation.set(this.p2Pitch, this.p2Yaw, 0, 'YXZ');

    let swingAngle = 0;
    if (this.p2SwingTimer > 0) {
      this.p2SwingTimer = Math.max(0, this.p2SwingTimer - dt);
      const t = 1 - this.p2SwingTimer / this.swingDuration;
      swingAngle = Math.sin(t * Math.PI) * 0.95;
    }
    this.p2ViewModelGroup.position.set(
      0.36 + Math.cos(this.p2WalkBobPhase) * 0.018,
      -0.32 + Math.abs(Math.sin(this.p2WalkBobPhase)) * -0.018 - swingAngle * 0.08,
      -0.52 - swingAngle * 0.14
    );
    this.p2ViewModelGroup.rotation.set(-swingAngle * 0.9, swingAngle * 0.35, 0);

    // Sync local P1 & P2 3D avatars for cross-screen visibility
    if (this.p1Avatar) {
      this.p1Avatar.targetPos.copy(this.playerPos);
      this.p1Avatar.group.position.copy(this.playerPos);
      this.p1Avatar.targetYaw = this.yaw;
      this.p1Avatar.group.rotation.y = this.yaw;
      this.p1Avatar.targetPitch = this.pitch;
      this.p1Avatar.isMoving = Math.hypot(this.playerVel.x, this.playerVel.z) > 0.35;
      if (this.swingTimer > 0) this.p1Avatar.swingTimer = this.swingTimer;
      setAvatarHeldItem(this.p1Avatar, this.inventory[this.selectedSlot]?.id ?? null);
      animateRemotePlayerAvatar(this.p1Avatar, dt);
    }
    if (this.p2Avatar) {
      this.p2Avatar.targetPos.copy(this.p2Pos);
      this.p2Avatar.group.position.copy(this.p2Pos);
      this.p2Avatar.targetYaw = this.p2Yaw;
      this.p2Avatar.group.rotation.y = this.p2Yaw;
      this.p2Avatar.targetPitch = this.p2Pitch;
      this.p2Avatar.isMoving = horizSpeed > 0.35;
      if (this.p2SwingTimer > 0) this.p2Avatar.swingTimer = this.p2SwingTimer;
      setAvatarHeldItem(this.p2Avatar, this.p2Inventory[this.p2SelectedSlot]?.id ?? null);
      animateRemotePlayerAvatar(this.p2Avatar, dt);
    }
  }

  private updatePlayer2MiningAndActions(dt: number) {
    const ray = this.raycastVoxel(5.5, this.p2Camera);
    if (ray.hit) {
      this.p2TargetOutline.visible = true;
      this.p2TargetOutline.position.set(ray.wx + 0.5, ray.wy + 0.5, ray.wz + 0.5);
    } else {
      this.p2TargetOutline.visible = false;
    }

    if (this.heldKeys.has('KeyP')) {
      this.p2PlaceCooldown -= dt;
      if (this.p2PlaceCooldown <= 0) {
        this.tryUseOrPlaceBlockP2();
        this.p2PlaceCooldown = 0.2;
      }
    }

    if (this.spectating || !this.heldKeys.has('KeyO') || !ray.hit) {
      this.p2MiningTarget = null;
      this.p2MiningProgress = 0;
      this.p2CrackMesh.visible = false;
      return;
    }

    const def = BLOCK_DEFS[ray.blockId];
    if (!def || def.hardness < 0) {
      this.p2CrackMesh.visible = false;
      return;
    }

    if (this.mode === 'creative') {
      if (this.p2PlaceCooldown <= 0) {
        this.breakBlockAt(ray.wx, ray.wy, ray.wz, ray.blockId, false);
        this.p2SwingTimer = this.swingDuration;
        this.p2PlaceCooldown = 0.16;
      }
      this.p2PlaceCooldown -= dt;
      return;
    }

    if (
      !this.p2MiningTarget ||
      this.p2MiningTarget.x !== ray.wx ||
      this.p2MiningTarget.y !== ray.wy ||
      this.p2MiningTarget.z !== ray.wz
    ) {
      this.p2MiningTarget = { x: ray.wx, y: ray.wy, z: ray.wz, id: ray.blockId };
      this.p2MiningProgress = 0;
    }

    const held = this.p2Inventory[this.p2SelectedSlot];
    const heldDef = held ? BLOCK_DEFS[held.id] : null;
    let speedMult = 1.0;
    if (heldDef?.toolType && heldDef.toolType === def.preferredTool && heldDef.miningSpeed) {
      speedMult = heldDef.miningSpeed;
    } else if (def.preferredTool === 'pickaxe' && (!heldDef || heldDef.toolType !== 'pickaxe')) {
      speedMult = 0.35;
    }
    if (this.activeBehaviorPacks.has('titan_haste')) {
      speedMult *= 4.0;
    }

    this.p2MiningProgress += (dt * speedMult) / def.hardness;
    this.p2DigSoundTimer -= dt;
    if (this.p2DigSoundTimer <= 0) {
      this.p2DigSoundTimer = 0.24;
      soundEngine.playDigTick(def.sound);
      this.p2SwingTimer = this.swingDuration;
    }

    const stage = Math.min(9, Math.floor(this.p2MiningProgress * 10));
    this.p2CrackMat.map = this.crackTextures[stage];
    this.p2CrackMat.needsUpdate = true;
    this.p2CrackMesh.position.set(ray.wx + 0.5, ray.wy + 0.5, ray.wz + 0.5);
    this.p2CrackMesh.visible = true;

    if (this.p2MiningProgress >= 1.0) {
      const canHarvest =
        !def.minTier ||
        (heldDef?.toolType === def.preferredTool && (heldDef.toolTier ?? 0) >= def.minTier);
      this.breakBlockAt(ray.wx, ray.wy, ray.wz, ray.blockId, canHarvest);
      this.p2MiningProgress = 0;
      this.p2MiningTarget = null;
      this.p2CrackMesh.visible = false;
    }
  }

  private breakBlockAt(wx: number, wy: number, wz: number, id: BlockId, shouldDrop: boolean) {
    const def = BLOCK_DEFS[id];
    if (!def) return;
    if (id === BlockId.CHEST) {
      this.dropAndClearChestAt(wx, wy, wz);
    }
    this.world.setBlock(wx, wy, wz, BlockId.AIR);
    if (!this.isApplyingRemoteUpdate) {
      this.callbacks.onLocalBlockSet?.(wx, wy, wz, BlockId.AIR);
    }
    if (id === BlockId.OBSIDIAN || id === BlockId.NETHER_PORTAL) {
      this.clearConnectedPortalNear(wx, wy, wz);
    }
    this.grassDirty = true;
    this.blocksMined++;
    soundEngine.playBreak(def.sound);
    this.particles.spawnBurst(wx + 0.5, wy + 0.5, wz + 0.5, getItemColor(id), 16, 4.4);

    const isOneBlockCore = this.worldType === 'oneblock' && wx === 0 && wy === 32 && wz === 0;
    const effectiveDrop = isOneBlockCore || shouldDrop;

    if (effectiveDrop && (this.isSurvivalLike || isOneBlockCore)) {
      const dropId =
        id === BlockId.GRAVEL && Math.random() < 0.35
          ? BlockId.FLINT
          : (def.dropId ?? id);
      const baseDropCount = def.dropCount ?? 1;
      const dropCount = this.activeBehaviorPacks.has('double_loot') ? baseDropCount * 2 : baseDropCount;
      this.spawnDroppedItem(
        dropId,
        dropCount,
        wx + 0.5,
        wy + (isOneBlockCore ? 1.15 : 0.45),
        wz + 0.5,
        (Math.random() - 0.5) * (isOneBlockCore ? 0.9 : 2.2),
        isOneBlockCore ? 3.8 : 3.2,
        (Math.random() - 0.5) * (isOneBlockCore ? 0.9 : 2.2)
      );
      if (id === BlockId.LEAVES && Math.random() < 0.16) {
        this.spawnDroppedItem(BlockId.APPLE, 1, wx + 0.5, wy + (isOneBlockCore ? 1.15 : 0.45), wz + 0.5);
      }
    }

    if (isOneBlockCore) {
      this.regenerateOneBlockCore();
    }
  }

  private updateDroppedItems(dt: number) {
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      item.age += dt;
      item.vel.y -= 18 * dt;

      const nx = item.pos.x + item.vel.x * dt;
      const ny = item.pos.y + item.vel.y * dt;
      const nz = item.pos.z + item.vel.z * dt;

      if (this.isBlockSolid(Math.floor(nx), Math.floor(ny - 0.15), Math.floor(nz))) {
        item.vel.y = 0;
        item.vel.x *= 0.8;
        item.vel.z *= 0.8;
      } else {
        item.pos.set(nx, ny, nz);
      }

      // Magnetize toward closest player (P1 or P2 in 2-player mode)
      const dx1 = this.playerPos.x - item.pos.x;
      const dy1 = this.playerPos.y + 0.85 - item.pos.y;
      const dz1 = this.playerPos.z - item.pos.z;
      const d1 = Math.hypot(dx1, dy1, dz1);

      let targetP2 = false;
      let dx = dx1;
      let dy = dy1;
      let dz = dz1;
      let dist = d1;

      if (this.twoPlayerMode) {
        const dx2 = this.p2Pos.x - item.pos.x;
        const dy2 = this.p2Pos.y + 0.85 - item.pos.y;
        const dz2 = this.p2Pos.z - item.pos.z;
        const d2 = Math.hypot(dx2, dy2, dz2);
        if (d2 < d1) {
          targetP2 = true;
          dx = dx2;
          dy = dy2;
          dz = dz2;
          dist = d2;
        }
      }

      if (this.phase === 'playing' && item.age > 0.25 && dist < 2.6) {
        const pull = (1 - dist / 2.6) * 14 * dt;
        item.pos.x += (dx / (dist || 1)) * pull;
        item.pos.y += (dy / (dist || 1)) * pull;
        item.pos.z += (dz / (dist || 1)) * pull;
      }

      if (this.phase === 'playing' && item.age > 0.25 && dist < 0.95) {
        const remaining = targetP2
          ? this.addItemToP2InventoryWithRemainder(item.itemId, item.count)
          : this.addItemToInventoryWithRemainder(item.itemId, item.count);
        if (remaining < item.count) {
          soundEngine.playPickup();
          if (remaining <= 0) {
            this.scene.remove(item.mesh);
            item.mesh.geometry.dispose();
            (item.mesh.material as THREE.Material).dispose();
            this.droppedItems.splice(i, 1);
            this.emitHud();
            continue;
          }
          item.count = remaining;
          this.emitHud();
        }
      }

      if (item.age > 90) {
        this.scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        (item.mesh.material as THREE.Material).dispose();
        this.droppedItems.splice(i, 1);
        continue;
      }

      item.mesh.position.set(
        item.pos.x,
        item.pos.y + Math.sin(item.age * 3.2 + item.bobOffset) * 0.08,
        item.pos.z
      );
      item.mesh.rotation.y += dt * 2.2;
    }
  }

  private updateMobs(dt: number, isNight: boolean) {
    // Spawn biome & day/night mobs around player up to cap (disabled on Parkour)
    this.mobSpawnTimer -= dt;
    const mobCap = this.mode === 'hardcore' ? 28 : 22;
    if (this.worldType !== 'parkour' && this.worldType !== 'parkour100' && this.worldType !== 'oneblock' && this.worldType !== 'wouldyourather' && this.mobSpawnTimer <= 0 && this.mobs.length < mobCap && this.phase === 'playing') {
      this.mobSpawnTimer = isNight ? (this.mode === 'hardcore' ? 2.2 : 2.8) : 4.8;
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 18;
      const sx = this.playerPos.x + Math.cos(angle) * dist;
      const sz = this.playerPos.z + Math.sin(angle) * dist;
      const sy = this.world.getSurfaceY(sx, sz);
      const minMobY = this.dimension === 'nether' ? NETHER_LAVA_LEVEL + 1 : this.worldType === 'skyblock' ? 2 : SEA_LEVEL + 1;
      if (sy >= minMobY && this.isBlockSolid(Math.floor(sx), sy - 1, Math.floor(sz))) {
        let kind: MobKind | null = null;
        if (this.dimension === 'nether') {
          if (this.isSurvivalLike && !this.activeBehaviorPacks.has('peaceful_aura')) {
            kind = Math.random() < 0.65 ? 'skeleton' : 'spider';
          }
        } else {
          const { biome } = this.world.getBiomeAt(Math.floor(sx), Math.floor(sz));
          kind = this.pickPassiveMobKind(biome);
          if (
            isNight &&
            this.isSurvivalLike &&
            this.worldType !== 'tutorial' &&
            !this.activeBehaviorPacks.has('peaceful_aura') &&
            Math.random() < (this.mode === 'hardcore' ? 0.84 : 0.72)
          ) {
            kind = this.pickHostileMobKind();
          }
        }
        if (kind) {
          const mob = createMob(kind, sx, sy, sz, this.shadowDiscTexture);
          this.mobs.push(mob);
          this.scene.add(mob.group);
        }
      }
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dP1 = Math.hypot(this.playerPos.x - m.pos.x, this.playerPos.z - m.pos.z);
      const dP2 = this.twoPlayerMode
        ? Math.hypot(this.p2Pos.x - m.pos.x, this.p2Pos.z - m.pos.z)
        : Infinity;
      const targetIsP2 = dP2 < dP1;
      const targetPos = targetIsP2 ? this.p2Pos : this.playerPos;
      const distToPlayer = Math.min(dP1, dP2);

      // Despawn very distant mobs
      if (distToPlayer > 56) {
        this.scene.remove(m.group);
        disposeMob(m);
        this.mobs.splice(i, 1);
        continue;
      }

      m.attackCooldown = Math.max(0, m.attackCooldown - dt);
      m.panicTimer = Math.max(0, m.panicTimer - dt);
      m.aggroTimer = Math.max(0, m.aggroTimer - dt);
      m.scaleY = THREE.MathUtils.damp(m.scaleY, 1, 10, dt);

      // Hit flash update
      if (m.hitFlashTimer > 0) {
        m.hitFlashTimer -= dt;
        m.materials.forEach((mat) => mat.color.setHex(0xff5555));
      } else if (m.kind === 'stalker' && m.fuseTimer > 0) {
        const pulse = Math.sin(m.fuseTimer * 24) > 0;
        m.materials.forEach((mat, idx) =>
          mat.color.setHex(pulse ? 0xffffff : m.baseColors[idx].getHex())
        );
      } else {
        m.materials.forEach((mat, idx) => mat.color.copy(m.baseColors[idx]));
      }

      // Daylight burn for Undead (Zombies & Skeletons)
      if ((m.kind === 'zombie' || m.kind === 'skeleton') && !isNight && this.isSurvivalLike) {
        m.hp -= dt * 2.2;
        if (Math.random() < dt * 4) m.hitFlashTimer = 0.08;
        if (m.hp <= 0) {
          this.particles.spawnBurst(
            m.pos.x,
            m.pos.y + 0.9,
            m.pos.z,
            m.kind === 'skeleton' ? 0xe6e2d5 : 0x4f8a42,
            12,
            3.5
          );
          this.scene.remove(m.group);
          disposeMob(m);
          this.mobs.splice(i, 1);
          continue;
        }
      }

      // AI Steering
      let speed = m.kind === 'cow' ? 1.35 : m.kind === 'chicken' ? 1.85 : 1.6;
      let moveDirX = 0;
      let moveDirZ = 0;

      const isPassive =
        m.kind === 'pig' ||
        m.kind === 'cow' ||
        m.kind === 'sheep' ||
        m.kind === 'chicken' ||
        this.activeBehaviorPacks.has('peaceful_aura') ||
        (m.kind === 'wolf' && m.aggroTimer <= 0);

      if (isPassive) {
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderTimer = 2 + Math.random() * 4;
          m.wanderAngle = Math.random() * Math.PI * 2;
        }
        if (m.panicTimer > 0) {
          speed = m.kind === 'cow' ? 3.2 : 3.9;
        }
        if (m.wanderTimer > 0.8 || m.panicTimer > 0) {
          moveDirX = Math.sin(m.wanderAngle);
          moveDirZ = Math.cos(m.wanderAngle);
        }
      } else {
        // Hostile / Aggravated Wolf AI
        const aggroRange = m.kind === 'wolf' ? 28 : 22;
        const canSeePlayer =
          this.isSurvivalLike && this.phase === 'playing' && distToPlayer < aggroRange;
        if (canSeePlayer) {
          const dx = targetPos.x - m.pos.x;
          const dz = targetPos.z - m.pos.z;
          const len = Math.hypot(dx, dz) || 1;
          moveDirX = dx / len;
          moveDirZ = dz / len;
          m.yaw = Math.atan2(moveDirX, moveDirZ);
          speed =
            m.kind === 'spider'
              ? 3.55
              : m.kind === 'wolf'
                ? 3.45
                : m.kind === 'stalker'
                  ? 2.9
                  : m.kind === 'skeleton'
                    ? 2.85
                    : 2.65;

          const dealDmg = (amount: number) => {
            if (targetIsP2) this.damageP2(amount);
            else this.damagePlayer(amount);
          };

          if (m.kind === 'zombie' || m.kind === 'skeleton') {
            if (distToPlayer < 2.0 && Math.abs(targetPos.y - m.pos.y) < 1.8 && m.attackCooldown <= 0) {
              if (m.windupTimer <= 0) {
                m.windupTimer = 0.28;
              }
            }
            if (m.windupTimer > 0) {
              m.windupTimer -= dt;
              speed = 0.5;
              m.arms.forEach((a) => (a.rotation.x = -Math.PI * 0.85));
              if (m.windupTimer <= 0 && distToPlayer < 2.3) {
                dealDmg(m.kind === 'skeleton' ? 4 : 3);
                m.attackCooldown = m.kind === 'skeleton' ? 1.2 : 1.1;
              }
            } else {
              m.arms.forEach(
                (a) => (a.rotation.x = THREE.MathUtils.damp(a.rotation.x, -Math.PI * 0.44, 10, dt))
              );
            }
          } else if (m.kind === 'spider') {
            if (m.onGround && distToPlayer < 5.0 && distToPlayer > 1.8 && Math.random() < dt * 2.4) {
              m.vel.y = 5.2;
              m.vel.x = moveDirX * 5.8;
              m.vel.z = moveDirZ * 5.8;
              m.onGround = false;
              m.scaleY = 1.18;
            }
            if (distToPlayer < 1.95 && Math.abs(targetPos.y - m.pos.y) < 1.8 && m.attackCooldown <= 0) {
              dealDmg(3);
              m.attackCooldown = 0.95;
            }
          } else if (m.kind === 'wolf') {
            if (distToPlayer < 1.85 && Math.abs(targetPos.y - m.pos.y) < 1.6 && m.attackCooldown <= 0) {
              dealDmg(3);
              m.attackCooldown = 1.0;
            }
          } else if (m.kind === 'stalker') {
            if (distToPlayer < 3.2) {
              if (m.fuseTimer === 0) soundEngine.playHiss();
              m.fuseTimer += dt;
              speed = 0.4;
              m.scaleY = 1 + Math.sin(m.fuseTimer * 18) * 0.12 + m.fuseTimer * 0.2;
              if (m.fuseTimer >= 1.35) {
                this.triggerExplosion(m.pos.x, m.pos.y + 0.6, m.pos.z, 2.8);
                this.scene.remove(m.group);
                disposeMob(m);
                this.mobs.splice(i, 1);
                continue;
              }
            } else {
              m.fuseTimer = Math.max(0, m.fuseTimer - dt * 1.5);
            }
          }
        } else {
          m.wanderTimer -= dt;
          if (m.wanderTimer <= 0) {
            m.wanderTimer = 2 + Math.random() * 3;
            m.wanderAngle = Math.random() * Math.PI * 2;
          }
          moveDirX = Math.sin(m.wanderAngle);
          moveDirZ = Math.cos(m.wanderAngle);
        }
      }

      if (moveDirX !== 0 || moveDirZ !== 0) {
        m.yaw = Math.atan2(moveDirX, moveDirZ);
      }

      m.vel.x = THREE.MathUtils.damp(m.vel.x, moveDirX * speed, 8, dt);
      m.vel.z = THREE.MathUtils.damp(m.vel.z, moveDirZ * speed, 8, dt);
      const mobGravity = m.kind === 'chicken' && m.vel.y < 0 ? GRAVITY * 0.42 : GRAVITY;
      m.vel.y -= mobGravity * dt;

      // Auto-jump over 1-block ledges
      const aheadX = Math.floor(m.pos.x + moveDirX * 0.7);
      const aheadZ = Math.floor(m.pos.z + moveDirZ * 0.7);
      const footY = Math.floor(m.pos.y + 0.1);
      if (m.onGround && this.isBlockSolid(aheadX, footY, aheadZ) && !this.isBlockSolid(aheadX, footY + 1, aheadZ)) {
        m.vel.y = 7.4;
        m.onGround = false;
        m.scaleY = 1.15;
      }

      // Move X/Z/Y
      const prevMX = m.pos.x;
      m.pos.x += m.vel.x * dt;
      if (this.isBlockSolid(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.4), Math.floor(m.pos.z))) {
        m.pos.x = prevMX;
        m.vel.x = 0;
        m.wanderAngle += Math.PI * 0.5;
      }

      const prevMZ = m.pos.z;
      m.pos.z += m.vel.z * dt;
      if (this.isBlockSolid(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.4), Math.floor(m.pos.z))) {
        m.pos.z = prevMZ;
        m.vel.z = 0;
        m.wanderAngle += Math.PI * 0.5;
      }

      m.pos.y += m.vel.y * dt;
      if (this.isBlockSolid(Math.floor(m.pos.x), Math.floor(m.pos.y), Math.floor(m.pos.z))) {
        m.pos.y = Math.floor(m.pos.y) + 1;
        m.vel.y = 0;
        m.onGround = true;
      } else {
        m.onGround = false;
      }

      // Animate legs & wings
      const mHoriz = Math.hypot(m.vel.x, m.vel.z);
      if (mHoriz > 0.25) {
        m.walkPhase += dt * mHoriz * (m.kind === 'spider' ? 6.2 : 4.2);
        const swing = Math.sin(m.walkPhase) * 0.65;
        if (m.kind === 'spider') {
          m.legs.forEach((leg, idx) => {
            leg.rotation.y = (idx % 2 === 0 ? 1 : -1) * swing * 0.55;
            leg.rotation.z = Math.cos(m.walkPhase + idx) * 0.14;
          });
        } else {
          m.legs.forEach((leg, idx) => {
            leg.rotation.x = idx % 2 === 0 ? swing : -swing;
          });
        }
      } else {
        m.legs.forEach((leg) => {
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, 0, 10, dt);
          if (m.kind === 'spider') {
            leg.rotation.y = THREE.MathUtils.damp(leg.rotation.y, 0, 10, dt);
            leg.rotation.z = THREE.MathUtils.damp(leg.rotation.z, 0, 10, dt);
          }
        });
      }

      if (m.kind === 'chicken' && m.arms.length >= 2) {
        const flapping = !m.onGround || m.panicTimer > 0;
        const targetFlap = flapping ? 0.55 + Math.sin(this.shaderTimeUniform.value * 26) * 0.55 : 0.04;
        m.arms[0].rotation.z = THREE.MathUtils.damp(m.arms[0].rotation.z, -targetFlap, 18, dt);
        m.arms[1].rotation.z = THREE.MathUtils.damp(m.arms[1].rotation.z, targetFlap, 18, dt);
      }

      m.group.position.copy(m.pos);
      m.group.rotation.y = m.yaw;
      const sxz = 1 / Math.sqrt(m.scaleY);
      m.group.scale.set(sxz, m.scaleY, sxz);
    }
  }

  private triggerExplosion(cx: number, cy: number, cz: number, radius: number) {
    const megaTnt = this.activeBehaviorPacks.has('mega_tnt');
    const effRadius = megaTnt ? radius * 1.85 : radius;
    soundEngine.playExplosion();
    this.cameraShake = 1.0;
    this.hitstopTimer = 0.055;

    const rCeil = Math.ceil(effRadius);
    for (let dx = -rCeil; dx <= rCeil; dx++) {
      for (let dy = -rCeil; dy <= rCeil; dy++) {
        for (let dz = -rCeil; dz <= rCeil; dz++) {
          const dist = Math.hypot(dx, dy, dz);
          if (dist <= effRadius) {
            const wx = Math.floor(cx + dx);
            const wy = Math.floor(cy + dy);
            const wz = Math.floor(cz + dz);
            if (this.worldType === 'oneblock' && wx === 0 && wy === 32 && wz === 0) continue;
            const id = this.world.getBlock(wx, wy, wz);
            if (id !== BlockId.AIR && id !== BlockId.BEDROCK && id !== BlockId.WATER) {
              if (id === BlockId.CHEST) {
                this.dropAndClearChestAt(wx, wy, wz);
              }
              this.world.setBlock(wx, wy, wz, BlockId.AIR);
              if (!this.isApplyingRemoteUpdate) {
                this.callbacks.onLocalBlockSet?.(wx, wy, wz, BlockId.AIR);
              }
              if (Math.random() < 0.45) {
                this.particles.spawnBurst(wx + 0.5, wy + 0.5, wz + 0.5, getItemColor(id), 4, 7.5);
              }
            }
          }
        }
      }
    }
    this.particles.spawnBurst(cx, cy + 0.5, cz, 0xffaa33, 28, 9.0);

    const pDist = Math.hypot(this.playerPos.x - cx, this.playerPos.y - cy, this.playerPos.z - cz);
    if (pDist < effRadius * 2.1) {
      const rawDmg = Math.max(2, Math.round((1 - pDist / (effRadius * 2.1)) * 12));
      this.damagePlayer(megaTnt ? Math.max(1, Math.floor(rawDmg * 0.5)) : rawDmg);
    }
    if (this.twoPlayerMode) {
      const p2Dist = Math.hypot(this.p2Pos.x - cx, this.p2Pos.y - cy, this.p2Pos.z - cz);
      if (p2Dist < effRadius * 2.1) {
        const rawDmg2 = Math.max(2, Math.round((1 - p2Dist / (effRadius * 2.1)) * 12));
        this.damageP2(megaTnt ? Math.max(1, Math.floor(rawDmg2 * 0.5)) : rawDmg2);
      }
    }
  }

  private updateDayNightAndLighting(dt: number) {
    this.timeOfDay += dt / DAY_LENGTH_SEC;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.dayCount++;
    }

    // 0.25 = Noon, 0.75 = Midnight
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunY = Math.cos(sunAngle);
    const sunX = Math.sin(sunAngle);

    // Position Cratered Lunar Sphere opposite the Sun
    const orbitDist = 92;
    this.moonMesh.position.set(
      this.playerPos.x - sunX * orbitDist,
      this.playerPos.y - sunY * orbitDist,
      this.playerPos.z + 25
    );
    this.moonMesh.lookAt(this.playerPos);
    this.moonMesh.visible = sunY < 0.25;

    // Key directional light follows sun during day, soft moonlight at night (texel-snapped target)
    const isDay = sunY >= 0;
    const lx = (isDay ? sunX : -sunX) * 58;
    const ly = Math.max(12, Math.abs(sunY) * 68);
    const snapX = Math.floor(this.playerPos.x);
    const snapY = Math.floor(this.playerPos.y);
    const snapZ = Math.floor(this.playerPos.z);
    this.sunLight.position.set(snapX + lx, snapY + ly, snapZ - 22);
    this.sunLight.target.position.set(snapX, snapY, snapZ);
    this.sunLight.target.updateMatrixWorld();

    // Underground / cave biome atmosphere detection
    const effBiome =
      this.phase === 'title'
        ? { biome: 'Plains', isUnderground: false, surfaceHeight: SEA_LEVEL + 6 }
        : this.world.getEffectiveBiomeAt(this.playerPos.x, this.playerPos.y + PLAYER_EYE, this.playerPos.z);
    this.isUnderground = effBiome.isUnderground;
    const depthBelow = this.isUnderground
      ? Math.max(0, effBiome.surfaceHeight - (this.playerPos.y + PLAYER_EYE))
      : 0;
    const targetCaveFactor = this.isUnderground
      ? THREE.MathUtils.clamp(0.32 + depthBelow / 9.0, 0.35, 1.0)
      : 0;
    this.caveDepthFactor = THREE.MathUtils.damp(this.caveDepthFactor, targetCaveFactor, 3.4, dt || 0.016);

    // Dynamic weather progression (natural sun/rain transitions)
    if (this.weatherMode === 'auto' && dt > 0) {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        this.isRainingAuto = !this.isRainingAuto;
        this.weatherTimer = this.isRainingAuto ? 45 + Math.random() * 45 : 130 + Math.random() * 140;
      }
    }
    const targetWet = this.weatherMode === 'rain' ? 1 : this.weatherMode === 'clear' ? 0 : this.isRainingAuto ? 1 : 0;
    this.rainIntensity = THREE.MathUtils.damp(this.rainIntensity, targetWet, 0.65, dt || 0.016);
    this.shaderWetnessUniform.value = this.rainIntensity * (1 - this.caveDepthFactor * 0.9);

    // Sky & Fog colors with Rayleigh/Mie horizon blending + storm overcast + cave atmosphere
    const dayFactor = THREE.MathUtils.smoothstep(sunY, -0.18, 0.28);
    const duskFactor = Math.max(0, 1 - Math.abs(sunY) * 4.2);

    const zenithColor = new THREE.Color(0x070d1d).lerp(new THREE.Color(0x286ec8), dayFactor);
    const horizonColor = new THREE.Color(0x111c33).lerp(new THREE.Color(0xa6d6f8), dayFactor);
    if (duskFactor > 0) {
      horizonColor.lerp(new THREE.Color(0xf08c54), duskFactor * 0.72 * (1 - this.rainIntensity * 0.65));
      zenithColor.lerp(new THREE.Color(0x524075), duskFactor * 0.45 * (1 - this.rainIntensity * 0.65));
    }
    if (this.rainIntensity > 0.01) {
      zenithColor.lerp(new THREE.Color(0x3a4656).multiplyScalar(0.35 + dayFactor * 0.65), this.rainIntensity * 0.68);
      horizonColor.lerp(new THREE.Color(0x6c7c8e).multiplyScalar(0.35 + dayFactor * 0.65), this.rainIntensity * 0.68);
    }
    if (this.caveDepthFactor > 0.01 && !this.isUnderwater) {
      const caveTint =
        effBiome.biome === 'Crystal Cavern'
          ? 0x16122c
          : effBiome.biome === 'Lush Cavern'
            ? 0x0f241d
            : effBiome.biome === 'Dripstone Caves'
              ? 0x1e1814
              : 0x11151b;
      horizonColor.lerp(new THREE.Color(caveTint), this.caveDepthFactor * 0.92);
      zenithColor.lerp(new THREE.Color(caveTint), this.caveDepthFactor * 0.92);
    }
    if (this.dimension === 'nether') {
      this.moonMesh.visible = false;
      this.rainIntensity = 0;
      this.shaderWetnessUniform.value = 0;

      const isSoulValley = effBiome.biome === 'Soul Sand Valley';
      const horizonHex = isSoulValley ? 0x1b262a : 0x3a0f0c;
      const zenithHex = isSoulValley ? 0x0b1216 : 0x1b0505;
      horizonColor.setHex(horizonHex);
      zenithColor.setHex(zenithHex);
      if (this.inLavaUnderwater && this.phase === 'playing') {
        horizonColor.setHex(0xb83208);
        zenithColor.setHex(0x882004);
      }

      (this.scene.background as THREE.Color).copy(horizonColor);
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.copy(horizonColor);
        this.scene.fog.near = this.inLavaUnderwater ? 0.8 : 6.0;
        this.scene.fog.far = this.inLavaUnderwater ? 6.5 : Math.min(this.renderDistance * 16 - 4, 48.0);
      }

      this.skyMesh.position.copy(this.camera.position);
      this.shaderSunDirUniform.value.set(0.2, 0.85, -0.3).normalize();
      this.shaderDayFactorUniform.value = 0.25;
      this.shaderHorizonColorUniform.value.copy(horizonColor);
      this.skyMat.uniforms.uZenithColor.value.copy(zenithColor);
      this.skyMat.uniforms.uSunColor.value.setHex(0xff6b2b);
      this.skyMat.uniforms.uNightFactor.value = 0.7;

      this.sunLight.intensity = 0.72;
      this.sunLight.color.setHex(0xff8e5c);
      this.hemiLight.intensity = 0.62;
    } else {
      if (this.inLavaUnderwater && this.phase === 'playing') {
        horizonColor.setHex(0xb83208);
        zenithColor.setHex(0x882004);
      } else if (this.isUnderwater && this.phase === 'playing') {
        horizonColor.setHex(0x124d78);
        zenithColor.setHex(0x0b3354);
      } else {
        const packVis = RESOURCE_PACK_VISUALS[this.texturePack];
        if (packVis?.skyTint !== undefined && packVis.skyBlend > 0) {
          const tint = new THREE.Color(packVis.skyTint);
          horizonColor.lerp(tint, packVis.skyBlend);
          zenithColor.lerp(tint, packVis.skyBlend * 1.05);
        }
      }

      (this.scene.background as THREE.Color).copy(horizonColor);
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.copy(horizonColor);
        const maxFog = this.renderDistance * 16 - 4;
        const surfaceNear = maxFog * (0.42 - this.rainIntensity * 0.16);
        const surfaceFar = maxFog * (1 - this.rainIntensity * 0.22);
        const caveNear = Math.min(surfaceNear, 8.0);
        const caveFar = Math.min(surfaceFar, 42.0);
        this.scene.fog.near = this.inLavaUnderwater
          ? 0.8
          : this.isUnderwater
            ? 2.5
            : THREE.MathUtils.lerp(surfaceNear, caveNear, this.caveDepthFactor);
        this.scene.fog.far = this.inLavaUnderwater
          ? 6.5
          : this.isUnderwater
            ? 20
            : THREE.MathUtils.lerp(surfaceFar, caveFar, this.caveDepthFactor);
      }

      // Update sky dome & water/terrain shared uniforms
      this.skyMesh.position.copy(this.camera.position);
      this.shaderSunDirUniform.value.set(sunX, sunY, -0.28).normalize();
      this.shaderDayFactorUniform.value = dayFactor;
      this.shaderHorizonColorUniform.value.copy(horizonColor);
      this.skyMat.uniforms.uZenithColor.value.copy(zenithColor);
      this.skyMat.uniforms.uSunColor.value.setHex(duskFactor > 0.35 ? 0xffa652 : 0xfff2cf);
      this.skyMat.uniforms.uNightFactor.value = 1 - dayFactor;

      const sunOcclusion = 1 - this.caveDepthFactor * 0.88;
      this.sunLight.intensity = (isDay ? 0.45 + dayFactor * 1.8 : 0.28) * (1 - this.rainIntensity * 0.55) * sunOcclusion;
      this.sunLight.color.setHex(isDay ? (duskFactor > 0.3 ? 0xffb870 : 0xfff4df) : 0x8db4ff);
      const baseHemi = 0.24 + dayFactor * 0.64;
      this.hemiLight.intensity = Math.max(0.24, baseHemi * (1 - this.caveDepthFactor * 0.58));
    }

    // Handheld / nearby Torch, Glowstone, Crystal Cluster, Glow Vine, Lava & Portal light with organic flicker
    const held = this.inventory[this.selectedSlot];
    const holdingTorch = held?.id === BlockId.TORCH;
    const holdingGlowstone = held?.id === BlockId.GLOWSTONE;
    const holdingCrystal = held?.id === BlockId.CRYSTAL_CLUSTER;
    const holdingVine = held?.id === BlockId.GLOW_VINE;

    let nearWarm = false;
    let nearCrystal = false;
    let nearPortal = false;
    const px = Math.floor(this.playerPos.x);
    const py = Math.floor(this.playerPos.y + 1);
    const pz = Math.floor(this.playerPos.z);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -1; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          const id = this.world.getBlock(px + dx, py + dy, pz + dz);
          if (id === BlockId.TORCH || id === BlockId.GLOWSTONE || id === BlockId.LAVA) nearWarm = true;
          else if (id === BlockId.CRYSTAL_CLUSTER || id === BlockId.GLOW_VINE) nearCrystal = true;
          else if (id === BlockId.NETHER_PORTAL) nearPortal = true;
        }
      }
    }

    this.torchLight.position.copy(this.camera.position);
    const flicker = 0.92 + Math.sin(this.shaderTimeUniform.value * 14.0) * 0.08;
    const baseIntensity = holdingGlowstone
      ? 3.4
      : holdingTorch
        ? 3.0
        : holdingCrystal || holdingVine
          ? 2.8
          : nearWarm
            ? 2.5
            : nearPortal
              ? 2.5
              : nearCrystal
                ? 2.4
                : this.dimension === 'nether'
                  ? 1.15
                  : this.caveDepthFactor * 0.72;
    if (holdingCrystal || holdingVine || (!holdingTorch && !holdingGlowstone && !nearWarm && nearCrystal)) {
      this.torchLight.color.setHex(effBiome.biome === 'Lush Cavern' ? 0x7ff5be : 0x7defff);
    } else if (nearPortal && !holdingTorch && !holdingGlowstone && !nearWarm) {
      this.torchLight.color.setHex(0xc066ff);
    } else if (this.dimension === 'nether' && !nearWarm) {
      this.torchLight.color.setHex(0xff8444);
    } else if (this.caveDepthFactor > 0.25 && !holdingTorch && !holdingGlowstone && !nearWarm) {
      this.torchLight.color.setHex(0xa8bdd8);
    } else {
      this.torchLight.color.setHex(0xffb76b);
    }
    this.torchLight.intensity = baseIntensity * flicker;

    // Animated water albedo + ripple normal map
    this.waterTexture.offset.x += dt * 0.05;
    this.waterTexture.offset.y += dt * 0.03;
    this.waterNormalTexture.offset.x -= dt * 0.07;
    this.waterNormalTexture.offset.y += dt * 0.05;

    return sunY < -0.05;
  }

  private refreshGrassTufts(cxCenter: number, czCenter: number) {
    const distMoved = Math.hypot(cxCenter - this.lastGrassX, czCenter - this.lastGrassZ);
    if (!this.grassDirty && distMoved < 3.5) return;
    this.grassDirty = false;
    this.lastGrassX = cxCenter;
    this.lastGrassZ = czCenter;

    const px = Math.floor(cxCenter);
    const pz = Math.floor(czCenter);
    const radius = 20;
    const maxTufts = 1800;
    let count = 0;

    for (let x = px - radius; x <= px + radius && count < maxTufts; x++) {
      for (let z = pz - radius; z <= pz + radius && count < maxTufts; z++) {
        // Deterministic spatial hash so tufts stay rooted to the exact world coordinate
        let h = (x * 374761393 + z * 668265263) | 0;
        h = (h ^ (h >>> 13)) | 0;
        h = Math.imul(h, 1274126177);
        const r = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
        if (r < 0.64) continue;

        const sy = this.world.getSurfaceY(x, z);
        if (sy <= SEA_LEVEL + 1 || sy >= CHUNK_H - 2) continue;
        const surfId = this.world.getBlock(x, sy - 1, z);
        if (surfId !== BlockId.GRASS) continue;
        if (this.world.getBlock(x, sy, z) !== BlockId.AIR) continue;

        const subR = ((h * 1664525 + 1013904223) >>> 0) / 4294967295;
        const ox = ((r - 0.64) / 0.36 - 0.5) * 0.55;
        const oz = (subR - 0.5) * 0.55;
        const s = 0.72 + subR * 0.55;

        _rot4.makeRotationY(subR * Math.PI);
        _m4.makeScale(s, s, s);
        _m4.premultiply(_rot4);
        _m4.setPosition(x + 0.5 + ox, sy - 0.02, z + 0.5 + oz);
        this.grassTuftMesh.setMatrixAt(count, _m4);

        // Rich natural meadow tint variation (emerald -> warm olive -> sunlit straw)
        _col.setHSL(0.24 + (subR - 0.5) * 0.06, 0.55 + r * 0.2, 0.42 + subR * 0.14);
        this.grassTuftMesh.setColorAt(count, _col);
        count++;
      }
    }

    this.grassTuftMesh.count = count;
    this.grassTuftMesh.instanceMatrix.needsUpdate = true;
    if (this.grassTuftMesh.instanceColor) this.grassTuftMesh.instanceColor.needsUpdate = true;
  }

  private updateMotes(dt: number, cx: number, cy: number, cz: number, isNight: boolean) {
    const mat = this.moteMesh.material as THREE.MeshBasicMaterial;
    if (this.isUnderground && this.phase !== 'title') {
      mat.color.setHex(0x88ffe3);
      mat.opacity = 0.78;
    } else if (isNight) {
      mat.color.setHex(0xd4ff6b);
      mat.opacity = 0.85;
    } else {
      mat.color.setHex(0xfff5d4);
      mat.opacity = 0.42;
    }
    const t = this.shaderTimeUniform.value;
    for (let i = 0; i < this.moteData.length; i++) {
      const m = this.moteData[i];
      m.x += Math.sin(t * m.speed + m.phase) * dt * 0.5;
      m.z += Math.cos(t * m.speed * 0.8 + m.phase) * dt * 0.5;
      if (m.x > 16) m.x -= 32;
      if (m.x < -16) m.x += 32;
      if (m.z > 16) m.z -= 32;
      if (m.z < -16) m.z += 32;
      const pulse = 0.65 + 0.35 * Math.sin(t * 2.8 + m.phase);
      const s = (isNight || this.isUnderground ? 1.35 : 0.75) * pulse;
      _m4.makeScale(s, s, s);
      const rawY = cy - 1.5 + m.y + Math.sin(t * 1.4 + m.phase) * 0.35;
      _m4.setPosition(
        cx + m.x,
        this.isUnderground ? Math.max(2, rawY) : Math.max(SEA_LEVEL + 0.5, rawY),
        cz + m.z
      );
      this.moteMesh.setMatrixAt(i, _m4);
    }
    this.moteMesh.instanceMatrix.needsUpdate = true;
  }

  private updateRain(dt: number, cx: number, cy: number, cz: number) {
    if (this.rainIntensity <= 0.03 || this.isUnderwater || this.caveDepthFactor > 0.45) {
      this.rainMesh.visible = false;
      return;
    }
    this.rainMesh.visible = true;
    const mat = this.rainMesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.44 * this.rainIntensity;
    for (let i = 0; i < this.rainData.length; i++) {
      const r = this.rainData[i];
      r.y -= r.speed * dt;
      r.x -= dt * 1.8;
      if (r.y < -4) r.y += 18;
      if (r.x < -14) r.x += 28;
      _m4.makeRotationZ(0.08);
      _m4.setPosition(cx + r.x, cy + r.y, cz + r.z);
      this.rainMesh.setMatrixAt(i, _m4);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
  }

  private emitHud() {
    const ray = this.phase === 'playing' ? this.raycastVoxel(5.5) : null;
    const targetBlockName = ray?.hit ? BLOCK_DEFS[ray.blockId]?.name ?? null : null;
    const { biome, isUnderground } = this.world.getEffectiveBiomeAt(
      this.playerPos.x,
      this.playerPos.y + PLAYER_EYE,
      this.playerPos.z
    );
    const p2Ray = this.phase === 'playing' && this.twoPlayerMode ? this.raycastVoxel(5.5, this.p2Camera) : null;
    const p2TargetBlockName = p2Ray?.hit ? BLOCK_DEFS[p2Ray.blockId]?.name ?? null : null;

    const isWyr = this.worldType === 'wouldyourather';
    const activeWyrIdx = Math.min(100, this.wyrStage + 1);
    const activeWyrLvl = WOULD_YOU_RATHER_LEVELS[activeWyrIdx];
    const wyrA = this.wyrChoices.filter((c) => c === 'A').length;
    const wyrB = this.wyrChoices.filter((c) => c === 'B').length;

    this.callbacks.onHudUpdate({
      worldId: this.worldId,
      worldName: this.worldName,
      worldType: this.worldType,
      oneBlockCount: this.worldType === 'oneblock' ? this.oneBlockCount : undefined,
      oneBlockPhase: this.worldType === 'oneblock' ? this.getOneBlockPhaseInfo(this.oneBlockCount).phaseName : undefined,
      wyrLevel: isWyr ? (this.wyrFinished ? 100 : activeWyrLvl.level) : undefined,
      wyrChapter: isWyr ? (this.wyrFinished ? 'Legend Endgame' : activeWyrLvl.chapter) : undefined,
      wyrOptionA: isWyr ? activeWyrLvl.optionA : undefined,
      wyrOptionB: isWyr ? activeWyrLvl.optionB : undefined,
      wyrChoicesA: isWyr ? wyrA : undefined,
      wyrChoicesB: isWyr ? wyrB : undefined,
      wyrLastChoice: isWyr ? this.wyrLastChoice : undefined,
      wyrP2Choice: isWyr ? this.wyrP2Choice : undefined,
      wyrFinished: isWyr ? this.wyrFinished : undefined,
      dimension: this.dimension,
      portalChargeProgress: Math.min(1, this.portalChargeTimer / (this.mode === 'creative' ? 0.5 : 1.5)),
      health: this.health,
      maxHealth: this.maxHealth,
      hunger: this.hunger,
      maxHunger: this.maxHunger,
      armor: this.cloneArmor(),
      armorDefense: this.getArmorDefense(),
      selectedSlot: this.selectedSlot,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      mode: this.mode,
      hardcoreDead: this.hardcoreDead,
      spectating: this.spectating,
      dayCount: this.dayCount,
      timeOfDay: this.timeOfDay,
      coords: {
        x: Math.floor(this.playerPos.x),
        y: Math.floor(this.playerPos.y),
        z: Math.floor(this.playerPos.z),
      },
      biome,
      isUnderground,
      isFlying: this.isFlying,
      isUnderwater: this.isUnderwater,
      pointerLocked: this.pointerLocked,
      targetBlockName,
      breakProgress: this.miningProgress,
      blocksMined: this.blocksMined,
      blocksPlaced: this.blocksPlaced,
      mobsDefeated: this.mobsDefeated,
      craftingGridSize: this.craftingGridSize,
      activeStation: this.activeStation,
      activeChestPos: this.activeChestPos ? { ...this.activeChestPos } : null,
      chestSlots:
        this.activeStation === 'chest' && this.activeChestPos
          ? this.getOrCreateChest(this.activeChestPos.x, this.activeChestPos.y, this.activeChestPos.z).map((s) =>
              s ? { ...s } : null
            )
          : [],
      statusMessage: this.statusMessage,
      twoPlayerMode: this.twoPlayerMode,
      p2: this.twoPlayerMode
        ? {
            health: this.p2Health,
            maxHealth: this.p2MaxHealth,
            hunger: this.p2Hunger,
            maxHunger: this.p2MaxHunger,
            selectedSlot: this.p2SelectedSlot,
            inventory: this.p2Inventory.map((s) => (s ? { ...s } : null)),
            coords: {
              x: Math.floor(this.p2Pos.x),
              y: Math.floor(this.p2Pos.y),
              z: Math.floor(this.p2Pos.z),
            },
            targetBlockName: p2TargetBlockName,
            breakProgress: this.p2MiningProgress,
            isFlying: this.p2IsFlying,
          }
        : undefined,
    });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private renderScene() {
    if (this.twoPlayerMode && this.phase === 'playing') {
      const w = Math.max(2, this.container.clientWidth || window.innerWidth);
      const h = Math.max(2, this.container.clientHeight || window.innerHeight);
      const leftW = Math.floor(w / 2);
      const rightW = Math.max(1, w - leftW);

      const p1OutlineVis = this.targetOutline.visible;
      const p1CrackVis = this.crackMesh.visible;
      const p2OutlineVis = this.p2TargetOutline.visible;
      const p2CrackVis = this.p2CrackMesh.visible;

      this.renderer.setScissorTest(true);

      // Left viewport: Player 1
      this.camera.aspect = leftW / h;
      this.camera.updateProjectionMatrix();
      if (this.p1Avatar) this.p1Avatar.group.visible = false;
      if (this.p2Avatar) this.p2Avatar.group.visible = true;
      this.targetOutline.visible = p1OutlineVis;
      this.crackMesh.visible = p1CrackVis;
      this.p2TargetOutline.visible = false;
      this.p2CrackMesh.visible = false;
      this.skyMesh.position.copy(this.camera.position);
      this.renderer.setViewport(0, 0, leftW, h);
      this.renderer.setScissor(0, 0, leftW, h);
      this.renderer.render(this.scene, this.camera);

      // Right viewport: Player 2
      this.p2Camera.aspect = rightW / h;
      this.p2Camera.updateProjectionMatrix();
      if (this.p1Avatar) this.p1Avatar.group.visible = true;
      if (this.p2Avatar) this.p2Avatar.group.visible = false;
      this.targetOutline.visible = false;
      this.crackMesh.visible = false;
      this.p2TargetOutline.visible = p2OutlineVis;
      this.p2CrackMesh.visible = p2CrackVis;
      this.skyMesh.position.copy(this.p2Camera.position);
      this.renderer.setViewport(leftW, 0, rightW, h);
      this.renderer.setScissor(leftW, 0, rightW, h);
      this.renderer.render(this.scene, this.p2Camera);

      // Restore clean state
      if (this.p1Avatar) this.p1Avatar.group.visible = false;
      if (this.p2Avatar) this.p2Avatar.group.visible = false;
      this.targetOutline.visible = p1OutlineVis;
      this.crackMesh.visible = p1CrackVis;
      this.p2TargetOutline.visible = p2OutlineVis;
      this.p2CrackMesh.visible = p2CrackVis;
      this.skyMesh.position.copy(this.camera.position);
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      return;
    }

    if (this.p1Avatar) this.p1Avatar.group.visible = false;
    if (this.p2Avatar) this.p2Avatar.group.visible = false;

    if (!this.isSoftwareGl && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateTutorialHints() {
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    let zone = '';
    let tip = '';

    if (x >= 7 && x <= 18 && z >= -5 && z <= 5) {
      zone = 'quarry';
      tip = 'Ore Quarry: Left-Click with Pickaxe (1) to mine Coal, Iron, Gold & Diamond!';
    } else if (x <= -6 && x >= -16 && z >= -5 && z <= 5) {
      zone = 'workshop';
      tip = 'Workshop Yard: Right-Click Crafting Table to craft tools, or build with blocks!';
    } else if (x >= -6 && x <= 6 && z >= -11 && z <= -3) {
      zone = 'cabin';
      tip = 'Starter Cabin: Use the Crafting Table, Furnace & Chest inside!';
    } else if (x >= -6 && x <= 6 && z >= 7 && z <= 17) {
      zone = 'farm';
      tip = 'Farm Pasture: Meet Pigs, Cows, Sheep & Chickens — Right-Click Apples to heal!';
    } else if (x >= 8 && x <= 19 && z >= 7 && z <= 17) {
      zone = 'grotto';
      tip = 'Crystal Grotto: Walk down the stairs to discover Glow Moss, Dripstone & Crystals!';
    } else if (x <= -8 && x >= -16 && z >= 7 && z <= 14) {
      zone = 'tnt';
      tip = 'Blast Range: Right-Click the TNT block to trigger a safe test explosion!';
    } else if (Math.abs(x) <= 5 && Math.abs(z) <= 5) {
      zone = 'courtyard';
      tip = 'Courtyard Hub: Follow cobblestone paths to Quarry (E), Workshop (W), Cabin (N) & Farm (S)';
    }

    if (zone && zone !== this.lastTutorialZone) {
      this.lastTutorialZone = zone;
      this.showStatus(tip, 4.2);
    }
  }

  private resetParkourProgress() {
    this.parkourCheckpoint.set(0.5, 32.5, 0.5);
    this.parkourStage = 0;
    this.parkourStartTime = null;
    this.parkourFinished = false;
  }

  private resetWyrProgress() {
    this.wyrStage = 0;
    this.wyrChoices = [];
    this.wyrLastChoice = null;
    this.wyrP2Choice = null;
    this.wyrFinished = false;
  }

  private updateWouldYouRatherCourse() {
    if (this.wyrFinished) return;
    const nextIdx = Math.min(100, this.wyrStage + 1);
    const lvl = WOULD_YOU_RATHER_LEVELS[nextIdx];
    if (!lvl) return;

    // Track P2 optional side vote in 2-player mode
    if (this.twoPlayerMode && this.p2Pos.y >= lvl.y + 0.4 && this.p2Pos.y <= lvl.y + 3.2) {
      if (this.p2Pos.z >= lvl.forkZ0 - 0.5 && this.p2Pos.z <= lvl.forkZ1 + 0.8) {
        if (this.p2Pos.x >= -5.5 && this.p2Pos.x <= -1.4 && this.wyrP2Choice !== 'A') {
          this.wyrP2Choice = 'A';
          this.particles.spawnBurst(this.p2Pos.x, lvl.y + 1.5, this.p2Pos.z, 0x34d399, 10, 3.2);
          soundEngine.playPickup();
        } else if (this.p2Pos.x >= 1.4 && this.p2Pos.x <= 5.5 && this.wyrP2Choice !== 'B') {
          this.wyrP2Choice = 'B';
          this.particles.spawnBurst(this.p2Pos.x, lvl.y + 1.5, this.p2Pos.z, 0xfbbf24, 10, 3.2);
          soundEngine.playPickup();
        }
      }
    }

    // Either player stepping through A or B completes the stage and unlocks next question
    const checkChoiceFor = (pos: THREE.Vector3): 'A' | 'B' | null => {
      if (pos.y < lvl.y + 0.4 || pos.y > lvl.y + 3.2) return null;
      if (pos.z < lvl.forkZ0 - 0.5 || pos.z > lvl.forkZ1 + 0.8) return null;
      if (pos.x >= -5.5 && pos.x <= -1.4) return 'A';
      if (pos.x >= 1.4 && pos.x <= 5.5) return 'B';
      return null;
    };

    const p1Pick = checkChoiceFor(this.playerPos);
    const p2Pick = this.twoPlayerMode ? checkChoiceFor(this.p2Pos) : null;
    // If someone flew ahead past exitZ0 in creative, advance cleanly too
    const picked = p1Pick ?? (p2Pick && this.wyrP2Choice ? null : p2Pick);
    if (!picked) return;

    this.wyrChoices[lvl.level - 1] = picked;
    this.wyrStage = lvl.level;
    this.wyrLastChoice = picked;
    this.wyrP2Choice = null;
    this.parkourCheckpoint.set(0.5, lvl.y + 1.4, (lvl.exitZ1 + lvl.exitZ0) * 0.5);

    const reward = picked === 'A' ? lvl.rewardA : lvl.rewardB;
    if (reward && this.isSurvivalLike) {
      this.addItemToInventory(reward.id, reward.count);
    }

    const burstX = picked === 'A' ? -3.5 : 3.5;
    const burstZ = (lvl.forkZ0 + lvl.forkZ1) * 0.5;
    const burstColor = picked === 'A' ? 0x34d399 : 0xfbbf24;

    if (lvl.level === 100) {
      this.wyrFinished = true;
      soundEngine.playPlace('glass');
      const finZ = (WYR_FINISH_Z0 + WYR_FINISH_Z1) * 0.5;
      this.particles.spawnBurst(0.5, WYR_FINISH_Y + 2.0, finZ, 0x34d399, 36, 6.5);
      this.particles.spawnBurst(0.5, WYR_FINISH_Y + 2.5, finZ, 0x38bdf8, 32, 6.0);
      this.showStatus(`100/100 COMPLETE! Open the Champion Trophy Chest ahead!`, 6.5);
    } else if (lvl.isMilestone) {
      soundEngine.playPlace('stone');
      this.particles.spawnBurst(burstX, lvl.y + 1.8, burstZ, 0xffd700, 22, 4.6);
      this.showStatus(`Milestone ${lvl.level}/100! Picked ${picked}: "${picked === 'A' ? lvl.optionA : lvl.optionB}"`, 3.6);
    } else {
      soundEngine.playPickup();
      this.particles.spawnBurst(burstX, lvl.y + 1.6, burstZ, burstColor, 14, 3.6);
      this.showStatus(`Q${lvl.level}/100 Picked ${picked}: ${picked === 'A' ? lvl.optionA : lvl.optionB}`, 2.4);
    }
    this.emitHud();
  }

  private teleportToParkourCheckpoint(manualReset = false) {
    this.playerPos.copy(this.parkourCheckpoint);
    this.playerVel.set(0, 0, 0);
    this.fallPeakY = this.parkourCheckpoint.y;
    this.yaw = 0;
    this.pitch = -0.12;
    this.health = 20;
    this.hunger = 20;
    if (manualReset && this.parkourStage === 0) {
      this.parkourStartTime = null;
      this.parkourFinished = false;
    }
    soundEngine.playPlace('glass');
    if (this.worldType === 'wouldyourather') {
      if (this.wyrStage === 0) {
        this.showStatus('Returned to Would You Rather Start Hall! (Press R anytime)', 2.8);
      } else {
        this.showStatus(`Returned to Question ${Math.min(100, this.wyrStage)}/100 Checkpoint!`, 2.6);
      }
      return;
    }
    if (this.worldType === 'parkour100') {
      if (this.parkourStage === 0) {
        this.showStatus(manualReset ? 'Reset to Start Plaza! (0/100)' : 'Fell! Returned to Start Plaza (Press R anytime)', 2.8);
      } else if (this.parkourStage >= 100) {
        this.showStatus('Returned to Level 100 Diamond Summit!', 2.6);
      } else {
        this.showStatus(`Returned to Level ${this.parkourStage}/100 Checkpoint!`, 2.6);
      }
      return;
    }
    if (this.parkourStage === 0) {
      this.showStatus(manualReset ? 'Reset to Start Plaza!' : 'Fell! Returned to Start Plaza (Press R anytime)', 2.8);
    } else if (this.parkourStage >= 4) {
      this.showStatus('Returned to Diamond Summit!', 2.6);
    } else {
      this.showStatus(`Returned to Checkpoint ${this.parkourStage}/3!`, 2.6);
    }
  }

  private updateParkourCourse() {
    if (!this.parkourStartTime && this.playerPos.z < -2.3 && !this.parkourFinished) {
      this.parkourStartTime = performance.now();
    }
    if (!this.onGround) return;

    const x = this.playerPos.x;
    const y = this.playerPos.y;
    const z = this.playerPos.z;

    if (this.worldType === 'parkour100') {
      for (let i = this.parkourStage + 1; i < PARKOUR_100_LEVELS.length; i++) {
        const lvl = PARKOUR_100_LEVELS[i];
        if (
          x >= lvl.x0 - 0.35 &&
          x <= lvl.x1 + 1.35 &&
          z >= lvl.z0 - 0.35 &&
          z <= lvl.z1 + 1.35 &&
          y >= lvl.y + 0.5 &&
          y <= lvl.y + 2.4
        ) {
          const midX = (lvl.x0 + lvl.x1 + 1) * 0.5;
          const midZ = (lvl.z0 + lvl.z1 + 1) * 0.5;
          this.parkourStage = lvl.level;
          this.parkourCheckpoint.set(midX, lvl.y + 1.4, midZ);

          if (lvl.level === 100 && !this.parkourFinished) {
            this.parkourFinished = true;
            const elapsedSec = this.parkourStartTime ? (performance.now() - this.parkourStartTime) / 1000 : 0;
            soundEngine.playPlace('glass');
            this.particles.spawnBurst(midX, lvl.y + 2.0, midZ, 0x34d399, 32, 6.2);
            this.particles.spawnBurst(midX, lvl.y + 2.6, midZ, 0x38bdf8, 28, 5.6);
            const timeStr = elapsedSec > 0 ? ` in ${elapsedSec.toFixed(1)}s` : '';
            this.showStatus(`LEVEL 100/100 COMPLETE${timeStr}! Open the Diamond Chest for your Trophy!`, 6.5);
          } else if (lvl.isMilestone) {
            soundEngine.playPlace('stone');
            this.particles.spawnBurst(midX, lvl.y + 1.8, midZ, 0xffd700, 22, 4.6);
            this.showStatus(`Milestone Checkpoint! Level ${lvl.level}/100 · ${lvl.zone}`, 3.8);
          } else {
            soundEngine.playPickup();
            this.particles.spawnBurst(midX, lvl.y + 1.4, midZ, 0x38bdf8, 8, 3.0);
            this.showStatus(`Level ${lvl.level}/100 · ${lvl.zone}`, 1.8);
          }
          break;
        }
      }
      return;
    }

    if (this.parkourStage < 1 && x >= -2.3 && x <= 3.3 && z >= -34.5 && z <= -29.5 && y >= 34.4 && y <= 36.5) {
      this.parkourStage = 1;
      this.parkourCheckpoint.set(0.5, 35.4, -31.5);
      soundEngine.playPlace('stone');
      this.particles.spawnBurst(0.5, 36.0, -31.5, 0xffd700, 18, 4.2);
      this.showStatus('Checkpoint 1/3! Stage 2: Hold Shift to Sprint-Jump Brick gaps!', 4.2);
    } else if (this.parkourStage < 2 && x >= -2.3 && x <= 3.3 && z >= -70.5 && z <= -65.5 && y >= 39.4 && y <= 41.5) {
      this.parkourStage = 2;
      this.parkourCheckpoint.set(0.5, 40.4, -67.5);
      soundEngine.playPlace('stone');
      this.particles.spawnBurst(0.5, 41.0, -67.5, 0xffd700, 18, 4.2);
      this.showStatus('Checkpoint 2/3! Stage 3: Climb the Crystal Cave Spire!', 4.2);
    } else if (this.parkourStage < 3 && x >= -2.3 && x <= 3.3 && z >= -101.5 && z <= -96.5 && y >= 46.4 && y <= 48.5) {
      this.parkourStage = 3;
      this.parkourCheckpoint.set(0.5, 47.4, -98.5);
      soundEngine.playPlace('stone');
      this.particles.spawnBurst(0.5, 48.0, -98.5, 0x38bdf8, 20, 4.5);
      this.showStatus('Checkpoint 3/3! Final Stage: Obsidian Sky Sprint!', 4.2);
    } else if (!this.parkourFinished && x >= -4.3 && x <= 5.3 && z >= -133.5 && z <= -124.5 && y >= 51.4 && y <= 54.0) {
      this.parkourFinished = true;
      this.parkourStage = 4;
      this.parkourCheckpoint.set(0.5, 52.4, -128.5);
      const elapsedSec = this.parkourStartTime ? (performance.now() - this.parkourStartTime) / 1000 : 0;
      soundEngine.playPlace('glass');
      this.particles.spawnBurst(0.5, 53.5, -128.5, 0x34d399, 28, 6.0);
      this.particles.spawnBurst(0.5, 54.2, -128.5, 0x38bdf8, 24, 5.5);
      const timeStr = elapsedSec > 0 ? ` in ${elapsedSec.toFixed(1)}s` : '';
      this.showStatus(`PARKOUR COMPLETE${timeStr}! Open the Diamond Chest for your trophy!`, 6.0);
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // clamp dt for stability
    this.shaderTimeUniform.value += dt;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.renderScene();
      this.scheduleNextTick();
      return;
    }

    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) this.statusMessage = null;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const isNight = this.updateDayNightAndLighting(
      this.phase === 'playing' ? dt : this.phase === 'title' ? dt * 0.25 : 0
    );

    if (this.phase === 'title') {
      // Atmospheric orbital pan over the live procedural voxel terrain or Skyblock/One Block/Parkour island!
      this.titlePanAngle += dt * 0.12;
      const isSky = this.worldType === 'skyblock' || this.worldType === 'oneblock';
      const isParkour =
        this.worldType === 'parkour' || this.worldType === 'parkour100' || this.worldType === 'wouldyourather';
      const rad = isSky || isParkour ? 18 : 26;
      const cx = Math.cos(this.titlePanAngle) * rad;
      const cz = (isParkour ? -12 : 0) + Math.sin(this.titlePanAngle) * rad;
      const groundH = isSky ? 33 : isParkour ? 34 : this.world.getSurfaceY(cx, cz);
      this.camera.up.set(0, 1, 0);
      this.camera.rotation.order = 'XYZ';
      this.camera.position.set(cx, isSky ? 41 : isParkour ? 42 : Math.max(SEA_LEVEL + 14, groundH + 11), cz);
      _v2.set(0, isSky || isParkour ? 34 : Math.max(SEA_LEVEL + 3, this.world.getSurfaceY(0, 0)), isParkour ? -12 : 0);
      this.camera.lookAt(_v2);
      this.viewModelGroup.visible = false;
      this.targetOutline.visible = false;
      this.crackMesh.visible = false;
      this.p2TargetOutline.visible = false;
      this.p2CrackMesh.visible = false;
      this.world.updateChunksAround(0, 0, Math.min(4, this.renderDistance), 2);
      this.refreshGrassTufts(0, 0);
      this.updateMotes(dt, 0, isSky || isParkour ? 35 : Math.max(SEA_LEVEL + 6, groundH + 2), 0, isNight);
      this.updateRain(dt, cx, isSky || isParkour ? 39 : Math.max(SEA_LEVEL + 8, groundH + 6), cz);
    } else {
      this.viewModelGroup.visible = true;
      if (this.phase === 'playing') {
        this.updatePlayer(dt);
        this.updateMiningAndTarget(dt);
        if (this.twoPlayerMode) {
          this.updatePlayer2(dt);
          this.updatePlayer2MiningAndActions(dt);
        }
        if (this.worldType === 'parkour' || this.worldType === 'parkour100') {
          this.updateParkourCourse();
        } else if (this.worldType === 'wouldyourather') {
          this.updateWouldYouRatherCourse();
        }
      }
      this.world.updateChunksAround(this.playerPos.x, this.playerPos.z, this.renderDistance, 2);
      if (this.twoPlayerMode) {
        this.world.updateChunksAround(this.p2Pos.x, this.p2Pos.z, Math.max(3, this.renderDistance - 1), 1);
      }
      this.refreshGrassTufts(this.playerPos.x, this.playerPos.z);
      this.updateMotes(dt, this.playerPos.x, this.playerPos.y, this.playerPos.z, isNight);
      this.updateRain(dt, this.playerPos.x, this.playerPos.y, this.playerPos.z);
      this.updateDroppedItems(dt);
      this.updateMobs(dt, isNight);
      this.particles.update(dt, (x, y, z) => this.isBlockSolid(x, y, z));
      if (this.isMultiplayer) {
        if (this.phase === 'playing') {
          const isMoving = Math.hypot(this.playerVel.x, this.playerVel.z) > 0.35;
          const held = this.inventory[this.selectedSlot];
          this.callbacks.onLocalMove?.(
            this.playerPos.x,
            this.playerPos.y,
            this.playerPos.z,
            this.yaw,
            this.pitch,
            held ? held.id : null,
            isMoving
          );
        }
        for (const avatar of this.remotePlayers.values()) {
          animateRemotePlayerAvatar(avatar, dt);
        }
      }
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08 && this.phase === 'playing') {
      this.hudEmitAccum = 0;
      if (this.worldType === 'tutorial') {
        this.updateTutorialHints();
      }
      this.emitHud();
    }

    if (this.phase === 'playing') {
      this.autoSaveAccum += dt;
      if (this.autoSaveAccum >= 10) {
        this.autoSaveAccum = 0;
        this.triggerAutoSave();
      }
    }

    this.renderScene();
    this.scheduleNextTick();
  };

  private scheduleNextTick() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.onMouseDown);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('contextmenu', this.onContextMenu);

    this.clearRemotePlayers();
    if (this.p1Avatar) {
      disposeRemotePlayerAvatar(this.p1Avatar);
      this.scene.remove(this.p1Avatar.group);
      this.p1Avatar = null;
    }
    if (this.p2Avatar) {
      disposeRemotePlayerAvatar(this.p2Avatar);
      this.scene.remove(this.p2Avatar.group);
      this.p2Avatar = null;
    }
    this.p2TargetOutline?.geometry.dispose();
    (this.p2TargetOutline?.material as THREE.Material | undefined)?.dispose();
    this.p2CrackMesh?.geometry.dispose();
    this.p2CrackMat?.dispose();
    this.p2ViewArmMesh?.geometry.dispose();
    (this.p2ViewArmMesh?.material as THREE.Material | undefined)?.dispose();
    this.p2ViewItemMesh?.geometry.dispose();
    (this.p2ViewItemMesh?.material as THREE.Material | undefined)?.dispose();
    this.world?.dispose();
    this.particles?.dispose();
    this.mobs.forEach((m) => disposeMob(m));
    this.droppedItems.forEach((d) => {
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    });
    this.skyMesh.geometry.dispose();
    this.skyMat.dispose();
    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as THREE.Material).dispose();
    this.grassTuftMesh.geometry.dispose();
    this.grassTuftMat.dispose();
    this.moteMesh.geometry.dispose();
    (this.moteMesh.material as THREE.Material).dispose();
    this.rainMesh.geometry.dispose();
    (this.rainMesh.material as THREE.Material).dispose();
    this.opaqueMat.dispose();
    this.cutoutMat.dispose();
    this.waterMat.dispose();
    this.waterTexture.dispose();
    this.playerArmTex?.dispose();
    this.pbrTextures.forEach((t) => t.dispose());
    for (const cached of this.styledPackCache.values()) {
      cached.opaqueTexture.dispose();
      cached.cutoutTexture.dispose();
    }
    this.styledPackCache.clear();
    this.crackTextures.forEach((t) => t.dispose());
    this.composer?.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
