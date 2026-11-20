import * as THREE from 'three';
import { CARRIER_SUBSYSTEMS, MISSILE_ARSENAL, MISSILE_MAP } from '../data/arsenal';
import { soundEngine } from '../audio/SoundEngine';
import {
  ActiveInterceptorSnapshot,
  ActiveMissileSnapshot,
  BattleStats,
  CameraMode,
  CarrierSubsystemId,
  CombatLogEntry,
  EngineSnapshot,
  GameDifficulty,
  MissileId,
  MissileSpec,
  ShipId,
  ShipStateSnapshot,
  SubsystemState,
  TimeOfDay,
} from '../types/game';
import { OceanEnvironment } from './OceanEnvironment';
import { buildCoastalMilitaryBase, CoastalBaseBuildResult } from './models/BaseModels';
import { buildInterceptorMesh, buildMissileMesh, MissileMeshParts } from './models/MissileModels';
import { buildAbrahamLincolnCVN72, buildAegisDestroyer, createFA18Jet } from './models/ShipModels';
import { ParticleSystem } from './vfx/ParticleSystem';

interface InternalShip {
  id: ShipId;
  nameFa: string;
  nameEn: string;
  hullCode: string;
  roleFa: string;
  hp: number;
  maxHp: number;
  sunk: boolean;
  sinkProgress: number;
  group: THREE.Group;
  radars: THREE.Object3D[];
  ciwsTurrets: THREE.Object3D[];
  vlsLocalOffset: THREE.Vector3;
  ciwsLocalOffset: THREE.Vector3;
  baseFormationOffset: THREE.Vector3;
  aegisAmmo: number;
  aegisMaxAmmo: number;
  aegisCooldown: number;
  ciwsCooldown: number;
  subsystems?: (SubsystemState & { localOffset: THREE.Vector3 })[];
  hitRadius: number;
}

interface ActiveMissile {
  uid: string;
  spec: MissileSpec;
  parts: MissileMeshParts;
  startPos: THREE.Vector3;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  targetShipId: ShipId;
  targetSubsystem: CarrierSubsystemId;
  targetOffset: THREE.Vector3;
  progress: number; // 0 -> 1
  totalDistance: number;
  elapsed: number;
  trailTimer: number;
  hp: number;
  isSubmunition: boolean;
  mirvSplitDone: boolean;
  stageSepDone: boolean;
  sonicBoomPlayed: boolean;
  flankSign: number;
  arcHeight: number;
  speedMult: number;
  alive: boolean;
  targetedByCount: number;
}

interface ActiveInterceptor {
  uid: string;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  targetMissileUid: string;
  age: number;
  maxAge: number;
  trailTimer: number;
  launchPhase: number; // vertical boost time
  alive: boolean;
}

interface TumblingDebris {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  age: number;
  maxAge: number;
}

interface QueuedLaunch {
  delay: number;
  spec: MissileSpec;
  shipId: ShipId;
  subsystem: CarrierSubsystemId;
  offsetJitter: THREE.Vector3;
  autoTrack: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private environment: OceanEnvironment;
  private particles: ParticleSystem;
  private base: CoastalBaseBuildResult;

  private ships: Map<ShipId, InternalShip> = new Map();
  private missiles: ActiveMissile[] = [];
  private interceptors: ActiveInterceptor[] = [];
  private debris: TumblingDebris[] = [];
  private launchQueue: QueuedLaunch[] = [];
  private capJets: { mesh: THREE.Group; angle: number; radius: number; altitude: number; speed: number }[] = [];

  // Target lock holographic ring & 3D trajectory preview line
  private lockRingGroup: THREE.Group;
  private trajectoryLine: THREE.Line;
  private previewMissileId: MissileId = 'fattah';
  private flashLights: { light: THREE.PointLight; life: number; maxLife: number; peak: number }[] = [];

  // Fleet movement state
  private fleetCenter = new THREE.Vector3(0, 0, -320);
  private fleetHeading = Math.PI * 0.5; // Sailing broadside across strait for epic silhouette!
  private fleetSpeed = 5.2;

  // Camera orbit & smooth chase state
  private cameraMode: CameraMode = 'orbit';
  private orbitTarget = new THREE.Vector3(0, 12, -310);
  private desiredOrbitTarget = new THREE.Vector3(0, 12, -310);
  private orbitYaw = 0.65;
  private orbitPitch = 0.34;
  private orbitDist = 235;
  private isDragging = false;
  private isRightDragging = false;
  private lastPointer = { x: 0, y: 0 };
  private pointerDownPos = { x: 0, y: 0 };
  private shakeIntensity = 0;
  private postImpactHoldTimer = 0;
  private postImpactHoldPos = new THREE.Vector3();
  private autoTrackOnLaunch = true;

  // Gameplay state
  private difficulty: GameDifficulty = 'sandbox';
  private timeScale = 1.0;
  private elapsed = 0;
  private battleElapsed = 0;
  private selectedShipId: ShipId = 'cvn72';
  private selectedSubsystem: CarrierSubsystemId = 'island';
  private trackedMissileUid: string | null = null;
  private ammo: Record<MissileId, number> = {} as Record<MissileId, number>;
  private cooldowns: Record<MissileId, number> = {} as Record<MissileId, number>;
  private stats: BattleStats = {
    launched: 0,
    hits: 0,
    intercepted: 0,
    damageDealt: 0,
    shipsSunk: 0,
    elapsedSec: 0,
  };
  private victory = false;
  private defeat = false;
  private ciwsFiringThisFrame = false;

  // Loop & callbacks
  private rafId = 0;
  private lastFrameTime = 0;
  private snapshotTimer = 0;
  private uidCounter = 1;
  private disposed = false;

  private onSnapshot: (snap: EngineSnapshot) => void;
  private onLog: (entry: CombatLogEntry) => void;

  private raycaster = new THREE.Raycaster();

  constructor(
    container: HTMLElement,
    onSnapshot: (snap: EngineSnapshot) => void,
    onLog: (entry: CombatLogEntry) => void
  ) {
    this.container = container;
    this.onSnapshot = onSnapshot;
    this.onLog = onLog;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / Math.max(container.clientHeight, 1),
      1,
      4500
    );

    // Environment & VFX
    this.environment = new OceanEnvironment(this.scene, 'sunset');
    this.particles = new ParticleSystem(this.scene, 620);

    // Build Iranian Coastal Base (at z = +540)
    this.base = buildCoastalMilitaryBase(540);
    this.scene.add(this.base.group);

    // Target Lock Hologram Ring
    this.lockRingGroup = this.createLockRing();
    this.scene.add(this.lockRingGroup);

    // 3D Projected Trajectory Preview Arc
    const trajGeo = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 48 }, () => new THREE.Vector3())
    );
    const trajMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 12,
      gapSize: 7,
      transparent: true,
      opacity: 0.52,
    });
    this.trajectoryLine = new THREE.Line(trajGeo, trajMat);
    this.scene.add(this.trajectoryLine);

    // Dynamic PointLight pool for explosion & launch flashes
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xff8c2b, 0, 260);
      this.scene.add(light);
      this.flashLights.push({ light, life: 0, maxLife: 0.4, peak: 0 });
    }

    // Build Carrier Strike Group + CAP Air Patrol
    this.buildFleet();
    this.buildCapPatrol();

    // Initialize default sandbox state
    this.resetMission('sandbox');

    // Attach pointer & resize listeners
    this.bindEvents();

    // Start render loop
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  private createLockRing(): THREE.Group {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(new THREE.RingGeometry(11, 12.6, 32), ringMat);
    outer.rotation.x = -Math.PI / 2;
    g.add(outer);

    const inner = new THREE.Mesh(
      new THREE.RingGeometry(4.5, 5.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    inner.rotation.x = -Math.PI / 2;
    g.add(inner);

    // Vertical laser beam indicator
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 34, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.35 })
    );
    beam.position.y = 17;
    g.add(beam);

    return g;
  }

  private buildFleet() {
    // Clear existing if resetting
    for (const s of this.ships.values()) {
      this.scene.remove(s.group);
    }
    this.ships.clear();

    // 1. USS Abraham Lincoln (CVN-72) — Centerpiece!
    const cvn = buildAbrahamLincolnCVN72();
    cvn.group.userData = { shipId: 'cvn72' };
    this.scene.add(cvn.group);

    const subsystems = CARRIER_SUBSYSTEMS.map((sub) => ({
      id: sub.id,
      nameFa: sub.nameFa,
      nameEn: sub.nameEn,
      hp: sub.maxHp,
      maxHp: sub.maxHp,
      destroyed: false,
      effectFa: sub.effectFa,
      localOffset: new THREE.Vector3(...sub.localOffset),
    }));

    this.ships.set('cvn72', {
      id: 'cvn72',
      nameFa: 'ناو هواپیمابر آبراهام لینکلن',
      nameEn: 'USS Abraham Lincoln',
      hullCode: 'CVN-72',
      roleFa: 'سرفرماندهی ناوگروه اتمی',
      hp: 2600,
      maxHp: 2600,
      sunk: false,
      sinkProgress: 0,
      group: cvn.group,
      radars: cvn.radars,
      ciwsTurrets: cvn.ciwsTurrets,
      vlsLocalOffset: new THREE.Vector3(0, 12, 0),
      ciwsLocalOffset: new THREE.Vector3(-15, 11, 20),
      baseFormationOffset: new THREE.Vector3(0, 0, 0),
      aegisAmmo: 0, // Carrier relies on Sea Sparrow / CIWS + Escort Aegis!
      aegisMaxAmmo: 0,
      aegisCooldown: 0,
      ciwsCooldown: 0,
      subsystems,
      hitRadius: 56,
    });

    // 2. USS Mobile Bay (CG-53) — Ticonderoga Aegis Cruiser Vanguard
    const cg = buildAegisDestroyer(true);
    cg.group.userData = { shipId: 'cg53' };
    this.scene.add(cg.group);
    this.ships.set('cg53', {
      id: 'cg53',
      nameFa: 'رزم‌ناو تیکوندروگا موبایل‌بی',
      nameEn: 'USS Mobile Bay',
      hullCode: 'CG-53',
      roleFa: 'فرماندهی پدافند هوایی ایجیس',
      hp: 950,
      maxHp: 950,
      sunk: false,
      sinkProgress: 0,
      group: cg.group,
      radars: cg.radars,
      ciwsTurrets: [],
      vlsLocalOffset: cg.vlsOrigin,
      ciwsLocalOffset: cg.ciwsOrigin,
      baseFormationOffset: new THREE.Vector3(10, 0, 145), // Screen toward coastal launch zone
      aegisAmmo: 22,
      aegisMaxAmmo: 22,
      aegisCooldown: 0,
      ciwsCooldown: 0,
      hitRadius: 28,
    });

    // 3. USS Spruance (DDG-111) — Arleigh Burke Destroyer Starboard Flank
    const ddg1 = buildAegisDestroyer(false);
    ddg1.group.userData = { shipId: 'ddg111' };
    this.scene.add(ddg1.group);
    this.ships.set('ddg111', {
      id: 'ddg111',
      nameFa: 'ناوشکن آرلی‌برک اسپرونس',
      nameEn: 'USS Spruance',
      hullCode: 'DDG-111',
      roleFa: 'اسکورت پدافندی جناح راست',
      hp: 780,
      maxHp: 780,
      sunk: false,
      sinkProgress: 0,
      group: ddg1.group,
      radars: ddg1.radars,
      ciwsTurrets: [],
      vlsLocalOffset: ddg1.vlsOrigin,
      ciwsLocalOffset: ddg1.ciwsOrigin,
      baseFormationOffset: new THREE.Vector3(165, 0, 40),
      aegisAmmo: 16,
      aegisMaxAmmo: 16,
      aegisCooldown: 0,
      ciwsCooldown: 0,
      hitRadius: 25,
    });

    // 4. USS O'Kane (DDG-77) — Arleigh Burke Destroyer Port Flank
    const ddg2 = buildAegisDestroyer(false);
    ddg2.group.userData = { shipId: 'ddg77' };
    this.scene.add(ddg2.group);
    this.ships.set('ddg77', {
      id: 'ddg77',
      nameFa: 'ناوشکن آرلی‌برک اوکین',
      nameEn: "USS O'Kane",
      hullCode: 'DDG-77',
      roleFa: 'اسکورت پدافندی جناح چپ',
      hp: 780,
      maxHp: 780,
      sunk: false,
      sinkProgress: 0,
      group: ddg2.group,
      radars: ddg2.radars,
      ciwsTurrets: [],
      vlsLocalOffset: ddg2.vlsOrigin,
      ciwsLocalOffset: ddg2.ciwsOrigin,
      baseFormationOffset: new THREE.Vector3(-165, 0, 55),
      aegisAmmo: 16,
      aegisMaxAmmo: 16,
      aegisCooldown: 0,
      ciwsCooldown: 0,
      hitRadius: 25,
    });

    this.positionFleetImmediate();
  }

  private buildCapPatrol() {
    for (let i = 0; i < 2; i++) {
      const jet = createFA18Jet(1.35);
      this.scene.add(jet);
      this.capJets.push({
        mesh: jet,
        angle: i * Math.PI,
        radius: 175 + i * 45,
        altitude: 105 + i * 24,
        speed: 0.32 + i * 0.06,
      });
    }
  }

  private positionFleetImmediate() {
    for (const ship of this.ships.values()) {
      ship.group.position.copy(this.fleetCenter).add(ship.baseFormationOffset);
      ship.group.rotation.set(0, this.fleetHeading, 0);
    }
  }

  public resetMission(difficulty: GameDifficulty) {
    this.difficulty = difficulty;
    this.victory = false;
    this.defeat = false;
    this.battleElapsed = 0;
    this.timeScale = 1.0;
    this.fleetCenter.set(0, 0, -320);
    this.fleetHeading = Math.PI * 0.48;
    this.selectedShipId = 'cvn72';
    this.selectedSubsystem = 'island';
    this.trackedMissileUid = null;
    this.launchQueue = [];

    // Remove active missiles/interceptors/debris
    for (const m of this.missiles) this.scene.remove(m.parts.group);
    this.missiles = [];
    for (const ic of this.interceptors) this.scene.remove(ic.mesh);
    this.interceptors = [];
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris = [];
    this.particles.clearAll();

    // Rebuild fleet fresh
    this.buildFleet();

    // Tune escort Aegis ammo by difficulty
    for (const ship of this.ships.values()) {
      if (ship.id === 'cvn72') continue;
      if (difficulty === 'sandbox') {
        ship.aegisAmmo = 10;
        ship.aegisMaxAmmo = 10;
      } else if (difficulty === 'standard') {
        ship.aegisAmmo = ship.id === 'cg53' ? 18 : 12;
        ship.aegisMaxAmmo = ship.aegisAmmo;
      } else {
        ship.aegisAmmo = ship.id === 'cg53' ? 28 : 20;
        ship.aegisMaxAmmo = ship.aegisAmmo;
      }
    }

    // Reset ammo & cooldowns
    for (const spec of MISSILE_ARSENAL) {
      this.ammo[spec.id] =
        difficulty === 'sandbox' ? 999 : difficulty === 'standard' ? spec.ammoStandard : spec.ammoHard;
      this.cooldowns[spec.id] = 0;
    }

    this.stats = {
      launched: 0,
      hits: 0,
      intercepted: 0,
      damageDealt: 0,
      shipsSunk: 0,
      elapsedSec: 0,
    };

    this.setCameraMode('orbit');
    this.focusCameraOn('fleet');

    const modeName =
      difficulty === 'sandbox' ? 'تمرین آزاد (مهمات نامحدود)' : difficulty === 'standard' ? 'عملیات طوفان (تاکتیکی)' : 'نبرد تمام‌عیار (سخت)';
    this.pushLog(`عملیات جدید آغاز شد — حالت: ${modeName}. ناوگروه آبراهام لینکلن در تیررس قرار دارد.`, 'info');
    this.emitSnapshot();
  }

  public setTimeOfDay(tod: TimeOfDay) {
    this.environment.setTimeOfDay(tod, this.scene);
  }

  public setTimeScale(scale: number) {
    this.timeScale = scale;
    this.emitSnapshot();
  }

  public setAutoTrack(enabled: boolean) {
    this.autoTrackOnLaunch = enabled;
  }

  public setPreviewMissile(id: MissileId) {
    this.previewMissileId = id;
  }

  private spawnFlash(pos: THREE.Vector3, colorHex: number, peak = 180, duration = 0.45) {
    const slot = this.flashLights.find((f) => f.life <= 0) ?? this.flashLights[0];
    slot.light.color.setHex(colorHex);
    slot.light.position.copy(pos).add(new THREE.Vector3(0, 6, 0));
    slot.light.intensity = peak;
    slot.peak = peak;
    slot.life = duration;
    slot.maxLife = duration;
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    if (mode === 'missile' && !this.trackedMissileUid && this.missiles.length > 0) {
      this.trackedMissileUid = this.missiles[this.missiles.length - 1].uid;
    }
    this.emitSnapshot();
  }

  public focusCameraOn(target: 'fleet' | 'base' | 'overview') {
    this.cameraMode = 'orbit';
    if (target === 'fleet') {
      const ship = this.ships.get(this.selectedShipId) ?? this.ships.get('cvn72');
      if (ship) {
        this.desiredOrbitTarget.copy(ship.group.position).add(new THREE.Vector3(0, 12, 0));
      }
      this.orbitDist = 220;
      this.orbitPitch = 0.34;
    } else if (target === 'base') {
      this.desiredOrbitTarget.set(0, 22, 535);
      this.orbitDist = 230;
      this.orbitPitch = 0.36;
      this.orbitYaw = Math.PI + 0.45;
    } else {
      this.desiredOrbitTarget.set(0, 15, 80);
      this.orbitDist = 760;
      this.orbitPitch = 0.56;
      this.orbitYaw = 0.92;
    }
    this.emitSnapshot();
  }

  public selectTarget(shipId: ShipId, subsystem?: CarrierSubsystemId) {
    const ship = this.ships.get(shipId);
    if (!ship || ship.sunk) return;
    this.selectedShipId = shipId;
    if (subsystem && shipId === 'cvn72') {
      this.selectedSubsystem = subsystem;
    }
    soundEngine.playLockOn();
    if (this.cameraMode === 'orbit') {
      this.desiredOrbitTarget.copy(ship.group.position).add(new THREE.Vector3(0, 10, 0));
    }
    this.emitSnapshot();
  }

  public trackMissile(uid: string) {
    const found = this.missiles.find((m) => m.uid === uid && m.alive);
    if (found) {
      this.trackedMissileUid = uid;
      this.cameraMode = 'missile';
      this.emitSnapshot();
    }
  }

  public launchMissile(id: MissileId, ignoreCooldown = false): boolean {
    if (this.victory || this.defeat) return false;
    const spec = MISSILE_MAP[id];
    if (!spec) return false;

    if (this.difficulty !== 'sandbox' && this.ammo[id] <= 0) {
      this.pushLog(`مهمات سامانه ${spec.nameFa} به اتمام رسیده است!`, 'critical');
      return false;
    }
    if (!ignoreCooldown && this.cooldowns[id] > 0.05) {
      return false;
    }

    // Ensure selected target is still alive; otherwise fallback to CVN-72 or any live ship
    let targetShip = this.ships.get(this.selectedShipId);
    if (!targetShip || targetShip.sunk) {
      targetShip = Array.from(this.ships.values()).find((s) => !s.sunk);
      if (!targetShip) return false;
      this.selectedShipId = targetShip.id;
    }

    if (this.difficulty !== 'sandbox') {
      this.ammo[id] = Math.max(0, this.ammo[id] - 1);
    }
    this.cooldowns[id] = this.difficulty === 'sandbox' ? Math.min(spec.cooldownSec * 0.4, 2.2) : spec.cooldownSec;

    // Queue salvo (e.g. 5 drones for Shahed-136, 2 cruises for Noor/Qader, 1 for ballistic/hypersonic)
    const count = spec.salvoCount;
    for (let i = 0; i < count; i++) {
      const jitter = new THREE.Vector3(
        (i - (count - 1) / 2) * (spec.category === 'drone_swarm' ? 14 : 8),
        0,
        (Math.random() - 0.5) * 10
      );
      this.launchQueue.push({
        delay: i * (spec.category === 'drone_swarm' ? 0.35 : 0.42),
        spec,
        shipId: targetShip.id,
        subsystem: this.selectedSubsystem,
        offsetJitter: jitter,
        autoTrack: i === 0 && this.autoTrackOnLaunch,
      });
    }

    const subText =
      targetShip.id === 'cvn72'
        ? ` (${CARRIER_SUBSYSTEMS.find((s) => s.id === this.selectedSubsystem)?.nameFa ?? ''})`
        : '';
    this.pushLog(
      `🚀 شلیک ${spec.nameFa}${count > 1 ? ` (رگبار ${count} فروندی)` : ''} به سمت ${targetShip.nameFa}${subText}`,
      'launch'
    );

    this.emitSnapshot();
    return true;
  }

  public launchCombinedSalvo(ids: MissileId[]) {
    if (ids.length === 0) return;
    let launchedAny = false;
    ids.forEach((id, idx) => {
      const spec = MISSILE_MAP[id];
      if (!spec) return;
      if (this.difficulty !== 'sandbox' && this.ammo[id] <= 0) return;
      if (this.difficulty !== 'sandbox') {
        this.ammo[id] = Math.max(0, this.ammo[id] - 1);
      }
      this.cooldowns[id] = this.difficulty === 'sandbox' ? 2.0 : spec.cooldownSec;

      let targetShip = this.ships.get(this.selectedShipId);
      if (!targetShip || targetShip.sunk) {
        targetShip = Array.from(this.ships.values()).find((s) => !s.sunk);
      }
      if (!targetShip) return;

      for (let i = 0; i < spec.salvoCount; i++) {
        this.launchQueue.push({
          delay: idx * 0.5 + i * 0.32,
          spec,
          shipId: targetShip.id,
          subsystem: this.selectedSubsystem,
          offsetJitter: new THREE.Vector3((Math.random() - 0.5) * 18, 0, (Math.random() - 0.5) * 14),
          autoTrack: idx === ids.length - 1 && i === 0 && this.autoTrackOnLaunch,
        });
      }
      launchedAny = true;
    });

    if (launchedAny) {
      this.pushLog(`🔥 عملیات حمله ترکیبی اشباع! ${ids.length} سامانه همزمان شلیک شدند!`, 'launch');
      this.emitSnapshot();
    }
  }

  private spawnMissileImmediate(q: QueuedLaunch) {
    const spec = q.spec;
    const origin = this.base.launchPoints[spec.launchOrigin].clone().add(
      new THREE.Vector3(q.offsetJitter.x * 0.6, 0, q.offsetJitter.z * 0.3)
    );
    const targetShip = this.ships.get(q.shipId);
    if (!targetShip) return;

    const parts = buildMissileMesh(spec.id, false);
    parts.group.position.copy(origin);
    this.scene.add(parts.group);

    // Launch audio & exhaust blast
    if (spec.underwater) {
      soundEngine.playTorpedoLaunch();
      this.particles.emitExplosion(new THREE.Vector3(origin.x, 0.5, origin.z), 0.7, true);
      this.spawnFlash(origin, 0x38bdf8, 120, 0.35);
    } else if (spec.category === 'drone_swarm') {
      soundEngine.playDroneLaunch();
      this.particles.emitTrail(origin, 'rocket');
      this.spawnFlash(origin, 0xffaa33, 95, 0.25);
    } else {
      soundEngine.playLaunch(spec.category === 'ballistic_heavy', spec.category === 'hypersonic');
      this.particles.emitExplosion(origin, 0.55, false);
      this.spawnFlash(origin, spec.hypersonicWeave ? 0x38bdf8 : 0xff8c24, 240, 0.5);
    }

    // Target offset (carrier subsystem or center)
    const targetOffset = new THREE.Vector3();
    if (targetShip.id === 'cvn72' && targetShip.subsystems) {
      const sub = targetShip.subsystems.find((s) => s.id === q.subsystem);
      if (sub) {
        targetOffset.copy(sub.localOffset);
      }
    } else {
      targetOffset.set(0, 5, 0);
    }
    if (spec.underwater) {
      targetOffset.y = -1.5; // Always hits waterline hull!
    }

    const uid = `m-${this.uidCounter++}`;
    const targetWorld = targetOffset.clone().applyQuaternion(targetShip.group.quaternion).add(targetShip.group.position);
    const dist = origin.distanceTo(targetWorld);

    const active: ActiveMissile = {
      uid,
      spec,
      parts,
      startPos: origin.clone(),
      pos: origin.clone(),
      prevPos: origin.clone(),
      targetShipId: q.shipId,
      targetSubsystem: q.subsystem,
      targetOffset,
      progress: 0,
      totalDistance: Math.max(dist, 50),
      elapsed: 0,
      trailTimer: 0,
      hp: spec.category === 'ballistic_heavy' ? 2 : 1,
      isSubmunition: false,
      mirvSplitDone: false,
      stageSepDone: false,
      sonicBoomPlayed: false,
      flankSign: Math.random() > 0.5 ? 1 : -1,
      arcHeight: spec.arcHeight,
      speedMult: 1.0,
      alive: true,
      targetedByCount: 0,
    };

    this.missiles.push(active);
    this.stats.launched += 1;

    if (q.autoTrack) {
      this.trackedMissileUid = uid;
      if (this.cameraMode !== 'carrier' && this.cameraMode !== 'launch') {
        this.cameraMode = 'missile';
      }
    }
  }

  private spawnMirvSubmunitions(parent: ActiveMissile) {
    parent.mirvSplitDone = true;
    soundEngine.playStageSep();
    this.particles.emitInterceptPop(parent.pos);
    this.pushLog(`⚡ جدایش کلاهک چندگانه (MIRV) خرمشهر-۴ — رهاسازی ۳ کلاهک مستقل!`, 'critical');

    const subTargets: CarrierSubsystemId[] = ['island', 'flight_deck', 'hangar'];
    const liveShips = Array.from(this.ships.values()).filter((s) => !s.sunk);

    for (let i = 0; i < (parent.spec.mirvCount ?? 3); i++) {
      const parts = buildMissileMesh(parent.spec.id, true);
      parts.group.position.copy(parent.pos);
      this.scene.add(parts.group);

      const targetShip =
        i === 0
          ? this.ships.get(parent.targetShipId) ?? liveShips[0]
          : parent.targetShipId === 'cvn72'
          ? this.ships.get('cvn72')!
          : liveShips[i % liveShips.length];
      if (!targetShip) continue;

      const subId = subTargets[i % subTargets.length];
      const offset = new THREE.Vector3((i - 1) * 14, 7, (i - 1) * 10);
      if (targetShip.id === 'cvn72' && targetShip.subsystems) {
        const sub = targetShip.subsystems.find((s) => s.id === subId);
        if (sub) offset.copy(sub.localOffset);
      }

      const startPos = parent.pos.clone().add(new THREE.Vector3((i - 1) * 6, (i - 1) * 2, 0));
      const targetWorld = offset.clone().applyQuaternion(targetShip.group.quaternion).add(targetShip.group.position);

      const uid = `mirv-${this.uidCounter++}`;
      const subMissile: ActiveMissile = {
        uid,
        spec: parent.spec,
        parts,
        startPos,
        pos: startPos.clone(),
        prevPos: startPos.clone(),
        targetShipId: targetShip.id,
        targetSubsystem: subId,
        targetOffset: offset,
        progress: 0,
        totalDistance: Math.max(startPos.distanceTo(targetWorld), 40),
        elapsed: 0,
        trailTimer: 0,
        hp: 1,
        isSubmunition: true,
        mirvSplitDone: true,
        stageSepDone: true,
        sonicBoomPlayed: true,
        flankSign: i - 1,
        arcHeight: 45,
        speedMult: 1.38,
        alive: true,
        targetedByCount: 0,
      };
      this.missiles.push(subMissile);

      // Transfer camera tracking to first MIRV warhead if user was tracking parent!
      if (i === 0 && this.trackedMissileUid === parent.uid) {
        this.trackedMissileUid = uid;
      }
    }

    // Remove carrier bus
    parent.alive = false;
    this.scene.remove(parent.parts.group);
  }

  private detachSejjilStage(m: ActiveMissile) {
    m.stageSepDone = true;
    m.speedMult = 1.42;
    soundEngine.playStageSep();
    this.particles.emitInterceptPop(m.pos);
    this.pushLog(`🔥 جدایش مرحله اول موشک سجیل — اشتعال موتور مرحله دوم!`, 'info');

    if (m.parts.boosterStage) {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      m.parts.boosterStage.getWorldPosition(worldPos);
      m.parts.boosterStage.getWorldQuaternion(worldQuat);
      m.parts.group.remove(m.parts.boosterStage);

      m.parts.boosterStage.position.copy(worldPos);
      m.parts.boosterStage.quaternion.copy(worldQuat);
      this.scene.add(m.parts.boosterStage);

      this.debris.push({
        mesh: m.parts.boosterStage,
        vel: new THREE.Vector3((Math.random() - 0.5) * 18, -12, 22),
        rotVel: new THREE.Vector3(2.2, 1.4, 3.1),
        age: 0,
        maxAge: 5.5,
      });
      m.parts.boosterStage = undefined;
    }
  }

  private computeMissilePosition(m: ActiveMissile, t: number, targetWorld: THREE.Vector3): THREE.Vector3 {
    const out = new THREE.Vector3().lerpVectors(m.startPos, targetWorld, t);

    if (m.isSubmunition) {
      // Steep MIRV reentry arc from split point straight down onto target
      const arch = Math.sin(t * Math.PI) * m.arcHeight * (1 - t * 0.5);
      out.y = THREE.MathUtils.lerp(m.startPos.y, targetWorld.y, Math.pow(t, 1.35)) + arch;
      out.x += Math.sin(t * Math.PI) * m.flankSign * 26;
      return out;
    }

    if (m.spec.underwater) {
      // Hoot supercavitating underwater straight run
      out.y = -1.8;
      return out;
    }

    if (m.spec.seaSkimming) {
      // Cruise missile / Shahed-136: pops up at launch, then drops to skim the waves!
      const cruiseAlt = m.spec.category === 'drone_swarm' ? 19 : 4.8;
      if (t < 0.08) {
        const lt = t / 0.08;
        out.y = THREE.MathUtils.lerp(m.startPos.y, cruiseAlt + 12, lt);
      } else if (t < 0.92) {
        const ct = (t - 0.08) / 0.84;
        const bob = Math.sin(ct * Math.PI * 6) * 0.7;
        out.y = THREE.MathUtils.lerp(cruiseAlt + 12, cruiseAlt, Math.min(ct * 4, 1)) + bob;
      } else {
        // Terminal pop-up & slam into ship deck/hull
        const ft = (t - 0.92) / 0.08;
        out.y = THREE.MathUtils.lerp(cruiseAlt, targetWorld.y, ft);
      }

      // Flanking curve for Abu Mahdi stealth cruise!
      if (m.spec.flanking) {
        out.x += Math.sin(t * Math.PI) * 210 * m.flankSign;
      } else if (m.spec.category === 'drone_swarm') {
        out.x += Math.sin(t * Math.PI * 2.5) * 18 * m.flankSign;
      }
      return out;
    }

    // Ballistic & Hypersonic Glide profiles
    const peak = m.arcHeight;
    if (m.spec.hypersonicWeave) {
      // Fattah-2 Boost-Glide: lower flatter glide trajectory with fierce S-curve terminal weave!
      const glideCurve = Math.sin(Math.pow(t, 0.78) * Math.PI) * peak;
      out.y = THREE.MathUtils.lerp(m.startPos.y, targetWorld.y, t) + glideCurve;
      if (t > 0.35 && t < 0.96) {
        const weaveEnv = Math.sin(((t - 0.35) / 0.61) * Math.PI);
        out.x += Math.sin(t * 26) * 34 * weaveEnv;
      }
      return out;
    }

    // Classic Ballistic Arc + steep terminal dive
    const arc = Math.sin(Math.pow(t, 0.85) * Math.PI) * peak;
    out.y = THREE.MathUtils.lerp(m.startPos.y, targetWorld.y, t) + arc;
    return out;
  }

  private updateMissiles(dt: number) {
    for (const m of this.missiles) {
      if (!m.alive) continue;

      const targetShip = this.ships.get(m.targetShipId);
      if (!targetShip) {
        m.alive = false;
        this.scene.remove(m.parts.group);
        continue;
      }

      const targetWorld = m.targetOffset
        .clone()
        .applyQuaternion(targetShip.group.quaternion)
        .add(targetShip.group.position);

      m.prevPos.copy(m.pos);
      m.elapsed += dt;

      // Dynamic speed multiplier (accelerates dramatically during terminal dive!)
      const terminalBoost = !m.spec.seaSkimming && !m.spec.underwater && m.progress > 0.65 ? 1.48 : 1.0;
      const stepDist = m.spec.simSpeed * m.speedMult * terminalBoost * dt;
      m.progress += stepDist / m.totalDistance;

      // Trigger Sejjil Stage 1 separation at 42%
      if (m.spec.twoStage && !m.stageSepDone && m.progress >= 0.42) {
        this.detachSejjilStage(m);
      }

      // Trigger Khorramshahr-4 MIRV split at 54%
      if (m.spec.mirvCount && !m.mirvSplitDone && m.progress >= 0.54) {
        this.spawnMirvSubmunitions(m);
        continue;
      }

      // Hypersonic sonic boom on terminal dive
      if (m.spec.hypersonicWeave && !m.sonicBoomPlayed && m.progress >= 0.72) {
        m.sonicBoomPlayed = true;
        soundEngine.playSonicBoom();
      }

      // Update position & orientation
      const clampedT = Math.min(m.progress, 1.0);
      const nextPos = this.computeMissilePosition(m, clampedT, targetWorld);
      m.pos.copy(nextPos);
      m.parts.group.position.copy(m.pos);

      const moveDir = m.pos.clone().sub(m.prevPos);
      if (moveDir.lengthSq() > 0.0001) {
        m.parts.group.lookAt(m.pos.clone().add(moveDir));
      }

      // Animate visual parts (flame flicker, spinning Shahed propeller, plasma shimmer)
      if (m.parts.flame) {
        const flicker = 0.82 + Math.random() * 0.42;
        m.parts.flame.scale.set(1, 1, flicker);
      }
      if (m.parts.propeller) {
        m.parts.propeller.rotation.z += dt * 48;
      }
      if (m.parts.plasmaCone) {
        const mat = m.parts.plasmaCone.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.25 + Math.sin(this.elapsed * 22) * 0.14;
      }

      // Exhaust trails
      m.trailTimer += dt;
      const trailInterval = m.spec.underwater ? 0.035 : m.spec.category === 'drone_swarm' ? 0.08 : 0.025;
      if (m.trailTimer >= trailInterval) {
        m.trailTimer = 0;
        const kind = m.spec.underwater
          ? 'torpedo'
          : m.spec.hypersonicWeave
          ? 'hypersonic'
          : m.spec.category === 'drone_swarm'
          ? 'drone'
          : 'rocket';
        this.particles.emitTrail(m.pos, kind);
      }

      // Impact check!
      if (m.progress >= 1.0) {
        this.handleMissileImpact(m, targetShip, targetWorld);
      }
    }

    this.missiles = this.missiles.filter((m) => m.alive);
  }

  private handleMissileImpact(m: ActiveMissile, ship: InternalShip, impactPos: THREE.Vector3) {
    m.alive = false;
    this.scene.remove(m.parts.group);

    // If tracking this missile, hold dramatic camera on explosion for 2.2 seconds!
    if (this.trackedMissileUid === m.uid) {
      this.postImpactHoldTimer = 2.2;
      this.postImpactHoldPos.copy(impactPos);
      this.trackedMissileUid = null;
    }

    const scale =
      m.spec.damage >= 420 ? 2.1 : m.spec.damage >= 300 ? 1.55 : m.spec.damage >= 200 ? 1.15 : 0.78;
    const isWater = Boolean(m.spec.underwater) || ship.sunk;

    this.particles.emitExplosion(impactPos, scale, isWater);
    soundEngine.playExplosion(scale >= 1.8 ? 'massive' : scale >= 1.1 ? 'medium' : 'small');
    this.spawnFlash(impactPos, isWater ? 0x7dd3fc : 0xff7722, 260 * scale, 0.55);

    // Camera shake scaled by distance
    const camDist = this.camera.position.distanceTo(impactPos);
    this.shakeIntensity = Math.max(this.shakeIntensity, Math.min(4.8, (320 / Math.max(camDist, 45)) * scale));

    if (ship.sunk) return;

    this.stats.hits += 1;

    // Calculate damage (Zolfaghar Basir gets +35% bonus to subsystems, Hoot gets +30% hull bonus)
    let dmg = m.spec.damage;
    if (m.spec.id === 'zolfaghar_basir' && ship.id === 'cvn72') dmg = Math.round(dmg * 1.35);
    if (m.spec.id === 'hoot') dmg = Math.round(dmg * 1.25);

    // Apply damage to carrier subsystem if CVN-72
    let extraLog = '';
    if (ship.id === 'cvn72' && ship.subsystems) {
      const sub = ship.subsystems.find((s) => s.id === m.targetSubsystem);
      if (sub && !sub.destroyed) {
        sub.hp = Math.max(0, sub.hp - dmg);
        if (sub.hp <= 0) {
          sub.destroyed = true;
          extraLog = ` — ${sub.nameFa} منهدم شد!`;
          // Hangar & Magazine explosion triggers massive secondary detonation!
          if (sub.id === 'hangar') {
            dmg += 350;
            this.particles.emitExplosion(impactPos.clone().add(new THREE.Vector3(0, 8, 0)), 2.6, false);
            soundEngine.playExplosion('massive');
            extraLog = ` — 💥 انفجار ثانویه مهیب در آشیانه و انبار مهمات!`;
          }
        }
      }
    }

    ship.hp = Math.max(0, ship.hp - dmg);
    this.stats.damageDealt += dmg;

    // Attach persistent fire at local impact site
    const localHit = impactPos.clone();
    ship.group.worldToLocal(localHit);
    localHit.y = Math.max(localHit.y, 4.5);
    this.particles.addPersistentFire(ship.group, localHit, scale * 0.75);

    this.pushLog(
      `💥 اصابت مستقیم ${m.spec.nameFa} به ${ship.nameFa} (${dmg} خسارت)${extraLog}`,
      'hit'
    );

    // Check if ship is sunk!
    if (ship.hp <= 0 && !ship.sunk) {
      ship.sunk = true;
      this.stats.shipsSunk += 1;
      soundEngine.playExplosion('massive');
      this.particles.emitExplosion(ship.group.position.clone().add(new THREE.Vector3(0, 12, 0)), 3.1, true);
      this.shakeIntensity = Math.max(this.shakeIntensity, 5.5);

      this.pushLog(`⚓🔥 ${ship.nameFa} (${ship.hullCode}) به طور کامل منهدم و در حال غرق شدن است!`, 'victory');

      // Check victory condition: CVN-72 sunk!
      if (ship.id === 'cvn72') {
        this.victory = true;
        this.pushLog(`🏆 پیروزی کامل عملیات! ناو هواپیمابر آبراهام لینکلن (CVN-72) منهدم شد!`, 'victory');
      } else {
        // Auto-switch target back to CVN-72 if an escort sank
        const cvn = this.ships.get('cvn72');
        if (cvn && !cvn.sunk) {
          this.selectedShipId = 'cvn72';
        }
      }
    }
  }

  private updateAirDefenseAI(dt: number) {
    this.ciwsFiringThisFrame = false;

    const cvn = this.ships.get('cvn72');
    const islandDestroyed = Boolean(cvn?.subsystems?.find((s) => s.id === 'island')?.destroyed);
    const cvnCiwsDestroyed = Boolean(cvn?.subsystems?.find((s) => s.id === 'ciws')?.destroyed);

    const radarEfficiency = islandDestroyed ? 0.55 : 1.0;
    const diffMult = this.difficulty === 'hard' ? 1.35 : this.difficulty === 'standard' ? 1.0 : 0.62;

    for (const ship of this.ships.values()) {
      if (ship.sunk) continue;

      ship.aegisCooldown = Math.max(0, ship.aegisCooldown - dt);
      ship.ciwsCooldown = Math.max(0, ship.ciwsCooldown - dt);

      // 1. AEGIS SM-2 / SM-6 VLS Interceptors (Destroyers & Cruiser)
      if (ship.aegisAmmo > 0 && ship.aegisCooldown <= 0) {
        let bestTarget: ActiveMissile | null = null;
        let bestDist = Infinity;

        for (const m of this.missiles) {
          if (!m.alive || m.spec.underwater) continue; // Air defense CANNOT detect/hit Hoot torpedo!
          if (m.targetedByCount >= (this.difficulty === 'hard' ? 2 : 1)) continue;

          const dist = ship.group.position.distanceTo(m.pos);
          // Detection range scales by RCS and sea-skimming altitude!
          const maxDetect = m.spec.seaSkimming ? 330 : 720;
          const effectiveRange = maxDetect * radarEfficiency * (0.55 + m.spec.rcs * 0.65);

          if (dist < effectiveRange && dist > 65 && dist < bestDist) {
            bestDist = dist;
            bestTarget = m;
          }
        }

        if (bestTarget) {
          this.fireAegisInterceptor(ship, bestTarget);
          ship.aegisAmmo -= 1;
          ship.aegisCooldown = (this.difficulty === 'hard' ? 1.35 : this.difficulty === 'standard' ? 2.1 : 3.2) / radarEfficiency;
        }
      }

      // 2. PHALANX CIWS Close-In Defense (CVN-72 & Escorts)
      const ciwsEnabled = ship.id === 'cvn72' ? !cvnCiwsDestroyed : true;
      if (ciwsEnabled && ship.ciwsCooldown <= 0) {
        let closeTarget: ActiveMissile | null = null;
        let closeDist = 155;

        for (const m of this.missiles) {
          if (!m.alive || m.spec.underwater) continue;
          const d = ship.group.position.distanceTo(m.pos);
          if (d < closeDist) {
            closeDist = d;
            closeTarget = m;
          }
        }

        if (closeTarget) {
          this.ciwsFiringThisFrame = true;
          ship.ciwsCooldown = 0.085;
          soundEngine.playCiwsBurst();

          // Fire tracer bolt from turret
          let originWorld = ship.ciwsLocalOffset
            .clone()
            .applyQuaternion(ship.group.quaternion)
            .add(ship.group.position);

          if (ship.ciwsTurrets.length > 0) {
            const turret = ship.ciwsTurrets[Math.floor(Math.random() * ship.ciwsTurrets.length)];
            originWorld = new THREE.Vector3();
            turret.getWorldPosition(originWorld);
            originWorld.y += 1.6;
            turret.lookAt(closeTarget.pos);
          }

          this.particles.emitCiwsTracer(originWorld, closeTarget.pos);

          // Probabilistic intercept roll per burst (hypersonics almost immune, slow drones very vulnerable!)
          const baseChance = (1 - closeTarget.spec.evasion) * 0.14 * diffMult * radarEfficiency;
          if (Math.random() < baseChance) {
            closeTarget.hp -= 1;
            if (closeTarget.hp <= 0) {
              this.interceptMissile(closeTarget, `توپ فالانکس CIWS ${ship.hullCode}`);
            }
          }
        }
      }
    }
  }

  private fireAegisInterceptor(ship: InternalShip, target: ActiveMissile) {
    const vlsWorld = ship.vlsLocalOffset
      .clone()
      .applyQuaternion(ship.group.quaternion)
      .add(ship.group.position);

    const mesh = buildInterceptorMesh();
    mesh.position.copy(vlsWorld);
    this.scene.add(mesh);

    target.targetedByCount += 1;
    soundEngine.playInterceptorLaunch();
    this.particles.emitTrail(vlsWorld, 'interceptor');

    this.interceptors.push({
      uid: `ic-${this.uidCounter++}`,
      mesh,
      pos: vlsWorld.clone(),
      vel: new THREE.Vector3(0, 125, 0), // Vertical VLS cold/hot launch!
      targetMissileUid: target.uid,
      age: 0,
      maxAge: 6.2,
      trailTimer: 0,
      launchPhase: 0.42,
      alive: true,
    });
  }

  private updateInterceptors(dt: number) {
    const diffMult = this.difficulty === 'hard' ? 1.25 : this.difficulty === 'standard' ? 0.95 : 0.58;

    for (const ic of this.interceptors) {
      if (!ic.alive) continue;
      ic.age += dt;
      if (ic.age >= ic.maxAge) {
        ic.alive = false;
        this.scene.remove(ic.mesh);
        continue;
      }

      const target = this.missiles.find((m) => m.uid === ic.targetMissileUid && m.alive);
      if (!target) {
        // Self-destruct in air if target already destroyed
        this.particles.emitInterceptPop(ic.pos);
        ic.alive = false;
        this.scene.remove(ic.mesh);
        continue;
      }

      const speed = 285;
      if (ic.age > ic.launchPhase) {
        // Lead pursuit guidance toward target missile
        const toTarget = target.pos.clone().sub(ic.pos);
        const dist = toTarget.length();
        toTarget.normalize();
        const desiredVel = toTarget.multiplyScalar(speed);
        ic.vel.lerp(desiredVel, Math.min(1, dt * 6.5));

        // Proximity fuze detonation check!
        if (dist < 14) {
          ic.alive = false;
          this.scene.remove(ic.mesh);

          // Check whether missile evades the Aegis warhead!
          const hitProb = Math.max(0.06, (1 - target.spec.evasion * 0.88) * diffMult);
          if (Math.random() < hitProb) {
            target.hp -= 1;
            if (target.hp <= 0) {
              this.interceptMissile(target, 'موشک پدافندی ایجیس SM-6');
            } else {
              this.particles.emitInterceptPop(ic.pos);
              soundEngine.playIntercept();
            }
          } else {
            // Near miss! Missile dodged the interceptor!
            this.particles.emitInterceptPop(ic.pos);
            soundEngine.playIntercept();
            if (target.spec.hypersonicWeave) {
              this.pushLog(`⚡ موشک ${target.spec.nameFa} با مانور هایپرسونیک از رهگیر ایجیس گریخت!`, 'info');
            }
          }
          continue;
        }
      }

      ic.pos.addScaledVector(ic.vel, dt);
      ic.mesh.position.copy(ic.pos);
      ic.mesh.lookAt(ic.pos.clone().add(ic.vel));

      ic.trailTimer += dt;
      if (ic.trailTimer >= 0.03) {
        ic.trailTimer = 0;
        this.particles.emitTrail(ic.pos, 'interceptor');
      }
    }

    this.interceptors = this.interceptors.filter((i) => i.alive);
  }

  private interceptMissile(m: ActiveMissile, sourceLabel: string) {
    m.alive = false;
    this.scene.remove(m.parts.group);
    this.particles.emitInterceptPop(m.pos);
    soundEngine.playIntercept();
    this.stats.intercepted += 1;

    if (this.trackedMissileUid === m.uid) {
      this.postImpactHoldTimer = 1.4;
      this.postImpactHoldPos.copy(m.pos);
      this.trackedMissileUid = null;
    }

    this.pushLog(`🛡️ ${m.spec.nameFa} توسط ${sourceLabel} در آسمان رهگیری شد.`, 'intercept');
  }

  private updateFleetAndWorld(dt: number) {
    // Gently sail the fleet broadside & slightly weave on Hard mode
    const weave = this.difficulty === 'hard' ? Math.sin(this.elapsed * 0.14) * 0.25 : 0;
    const vx = Math.sin(this.fleetHeading + weave) * this.fleetSpeed;
    const vz = Math.cos(this.fleetHeading + weave) * this.fleetSpeed;
    this.fleetCenter.x += vx * dt;
    this.fleetCenter.z += vz * dt;

    // Keep fleet within dramatic operational zone (loop gently back so it never sails off map)
    if (this.fleetCenter.x > 260) {
      this.fleetHeading = -Math.PI * 0.48;
    } else if (this.fleetCenter.x < -260) {
      this.fleetHeading = Math.PI * 0.48;
    }

    for (const ship of this.ships.values()) {
      // Spin radars
      for (const r of ship.radars) {
        r.rotation.y += dt * (ship.sunk ? 0 : 1.7);
      }

      if (ship.sunk) {
        // Dramatic listing & sinking beneath the waves!
        ship.sinkProgress = Math.min(1, ship.sinkProgress + dt * 0.085);
        ship.group.position.y = THREE.MathUtils.lerp(0, -26, ship.sinkProgress);
        ship.group.rotation.z = THREE.MathUtils.lerp(0, 0.42, ship.sinkProgress);
        ship.group.rotation.x = THREE.MathUtils.lerp(0, -0.18, ship.sinkProgress);
        continue;
      }

      const desiredPos = this.fleetCenter.clone().add(ship.baseFormationOffset);
      ship.group.position.x = THREE.MathUtils.lerp(ship.group.position.x, desiredPos.x, dt * 1.2);
      ship.group.position.z = THREE.MathUtils.lerp(ship.group.position.z, desiredPos.z, dt * 1.2);

      // Realistic ocean pitch/roll bobbing + damage listing!
      const damageRatio = 1 - ship.hp / ship.maxHp;
      const listAngle = damageRatio * 0.12;
      ship.group.position.y = Math.sin(this.elapsed * 1.2 + ship.baseFormationOffset.x * 0.02) * 0.45 - damageRatio * 1.5;
      ship.group.rotation.z = Math.sin(this.elapsed * 0.9 + ship.baseFormationOffset.z * 0.01) * 0.018 + listAngle;
      ship.group.rotation.x = Math.cos(this.elapsed * 0.7) * 0.012;

      // Smooth yaw toward heading
      const targetYaw = this.fleetHeading + weave;
      ship.group.rotation.y = THREE.MathUtils.lerp(ship.group.rotation.y, targetYaw, dt * 0.8);
    }

    // Rotate friendly base radars & patrol fast boats
    for (const r of this.base.radars) {
      r.rotation.y += dt * 1.4;
    }
    this.base.fastBoats.forEach((boat, idx) => {
      const t = this.elapsed * (0.45 + idx * 0.15) + idx * 2.0;
      boat.position.x = -75 + Math.sin(t) * 55 + idx * 35;
      boat.position.y = 0.25 + Math.sin(this.elapsed * 3 + idx) * 0.25;
      boat.rotation.y = Math.PI + Math.cos(t) * 0.35;
    });
    this.base.submarine.position.y = -0.3 + Math.sin(this.elapsed * 0.9) * 0.22;

    // Patrolling F/A-18 CAP Fighter Jets circling overhead!
    for (const cap of this.capJets) {
      cap.angle += cap.speed * dt;
      const cx = this.fleetCenter.x + Math.cos(cap.angle) * cap.radius;
      const cz = this.fleetCenter.z + Math.sin(cap.angle) * cap.radius;
      const nextX = this.fleetCenter.x + Math.cos(cap.angle + 0.05) * cap.radius;
      const nextZ = this.fleetCenter.z + Math.sin(cap.angle + 0.05) * cap.radius;
      cap.mesh.position.set(cx, cap.altitude + Math.sin(cap.angle * 2) * 5, cz);
      cap.mesh.lookAt(nextX, cap.altitude, nextZ);
      cap.mesh.rotateZ(-0.32); // Realistic banking turn!
    }

    // Update tumbling spent booster debris
    for (const d of this.debris) {
      d.age += dt;
      d.vel.y -= 28 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      d.mesh.rotation.z += d.rotVel.z * dt;
      if (d.age >= d.maxAge || d.mesh.position.y < -4) {
        this.scene.remove(d.mesh);
      }
    }
    this.debris = this.debris.filter((d) => d.age < d.maxAge && d.mesh.position.y >= -4);

    // Update holographic target lock ring on selected ship/subsystem
    const lockedShip = this.ships.get(this.selectedShipId);
    if (lockedShip && !lockedShip.sunk) {
      this.lockRingGroup.visible = true;
      const offset = new THREE.Vector3(0, 14, 0);
      if (lockedShip.id === 'cvn72' && lockedShip.subsystems) {
        const sub = lockedShip.subsystems.find((s) => s.id === this.selectedSubsystem);
        if (sub) offset.copy(sub.localOffset).add(new THREE.Vector3(0, 4, 0));
      }
      offset.applyQuaternion(lockedShip.group.quaternion).add(lockedShip.group.position);
      this.lockRingGroup.position.copy(offset);
      this.lockRingGroup.rotation.y += dt * 1.4;
      const pulse = 1 + Math.sin(this.elapsed * 5) * 0.08;
      this.lockRingGroup.scale.setScalar(pulse);

      // Update 3D dashed trajectory preview arc from launch point to locked target
      const previewSpec = MISSILE_MAP[this.previewMissileId];
      if (previewSpec && this.cameraMode !== 'missile') {
        this.trajectoryLine.visible = true;
        const startPos = this.base.launchPoints[previewSpec.launchOrigin];
        const targetPos = offset.clone();
        const attr = this.trajectoryLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        const n = attr.count;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const p = new THREE.Vector3().lerpVectors(startPos, targetPos, t);
          if (previewSpec.underwater) {
            p.y = 1.6;
          } else if (previewSpec.seaSkimming) {
            const alt = previewSpec.category === 'drone_swarm' ? 19 : 5.5;
            p.y = t < 0.08 ? THREE.MathUtils.lerp(startPos.y, alt + 10, t / 0.08) : alt;
            if (previewSpec.flanking) {
              p.x += Math.sin(t * Math.PI) * 210;
            }
          } else if (previewSpec.hypersonicWeave) {
            p.y = THREE.MathUtils.lerp(startPos.y, targetPos.y, t) + Math.sin(Math.pow(t, 0.78) * Math.PI) * previewSpec.arcHeight;
            if (t > 0.35 && t < 0.96) {
              const env = Math.sin(((t - 0.35) / 0.61) * Math.PI);
              p.x += Math.sin(t * 26) * 34 * env;
            }
          } else {
            p.y = THREE.MathUtils.lerp(startPos.y, targetPos.y, t) + Math.sin(Math.pow(t, 0.85) * Math.PI) * previewSpec.arcHeight;
          }
          attr.setXYZ(i, p.x, p.y, p.z);
        }
        attr.needsUpdate = true;
        this.trajectoryLine.computeLineDistances();
        (this.trajectoryLine.material as THREE.LineDashedMaterial).color.set(previewSpec.accentColor);
      } else {
        this.trajectoryLine.visible = false;
      }
    } else {
      this.lockRingGroup.visible = false;
      this.trajectoryLine.visible = false;
    }

    // Decay dynamic PointLight flashes
    for (const f of this.flashLights) {
      if (f.life > 0) {
        f.life = Math.max(0, f.life - dt);
        f.light.intensity = f.peak * (f.life / f.maxLife);
      }
    }
  }

  private updateCamera(rawDt: number) {
    // Decay screen shake
    this.shakeIntensity = Math.max(0, this.shakeIntensity - rawDt * 7.5);
    const shakeOffset = new THREE.Vector3(
      (Math.random() - 0.5) * this.shakeIntensity,
      (Math.random() - 0.5) * this.shakeIntensity,
      (Math.random() - 0.5) * this.shakeIntensity
    );

    if (this.cameraMode === 'missile') {
      const m = this.missiles.find((x) => x.uid === this.trackedMissileUid && x.alive);
      if (m) {
        const velDir = m.pos.clone().sub(m.prevPos);
        if (velDir.lengthSq() < 0.0001) velDir.set(0, 0, -1);
        velDir.normalize();

        const backDist = m.spec.underwater ? 24 : m.spec.category === 'ballistic_heavy' ? 32 : 26;
        const upOffset = m.spec.underwater ? 10 : 8.5;
        const desiredCamPos = m.pos
          .clone()
          .addScaledVector(velDir, -backDist)
          .add(new THREE.Vector3(6, upOffset, 0));
        desiredCamPos.y = Math.max(desiredCamPos.y, 4.5);

        this.camera.position.lerp(desiredCamPos, Math.min(1, rawDt * 7.5));
        this.camera.position.add(shakeOffset);
        const lookAhead = m.pos.clone().addScaledVector(velDir, 35);
        this.camera.lookAt(lookAhead);
        return;
      } else if (this.postImpactHoldTimer > 0) {
        this.postImpactHoldTimer -= rawDt;
        const holdCam = this.postImpactHoldPos.clone().add(new THREE.Vector3(75, 48, 85));
        this.camera.position.lerp(holdCam, Math.min(1, rawDt * 3.5));
        this.camera.position.add(shakeOffset);
        this.camera.lookAt(this.postImpactHoldPos);
        return;
      } else if (this.missiles.length > 0) {
        this.trackedMissileUid = this.missiles[this.missiles.length - 1].uid;
      } else {
        // Gracefully return to fleet orbit view
        this.cameraMode = 'orbit';
      }
    }

    if (this.cameraMode === 'carrier') {
      const cvn = this.ships.get('cvn72');
      if (cvn) {
        // Dramatic perspective right off the bow/island of USS Abraham Lincoln!
        const localCam = new THREE.Vector3(24, 24, 58);
        const camPos = localCam.applyQuaternion(cvn.group.quaternion).add(cvn.group.position);
        const lookTarget = new THREE.Vector3(0, 16, -22)
          .applyQuaternion(cvn.group.quaternion)
          .add(cvn.group.position);

        // If a missile is incoming close, glance slightly toward it!
        if (this.missiles.length > 0) {
          lookTarget.lerp(this.missiles[0].pos, 0.35);
        }

        this.camera.position.lerp(camPos, Math.min(1, rawDt * 5));
        this.camera.position.add(shakeOffset);
        this.camera.lookAt(lookTarget);
        return;
      }
    }

    if (this.cameraMode === 'launch') {
      const camPos = new THREE.Vector3(105, 58, 635);
      const lookAt = new THREE.Vector3(-15, 22, 480);
      this.camera.position.lerp(camPos, Math.min(1, rawDt * 4.5));
      this.camera.position.add(shakeOffset);
      this.camera.lookAt(lookAt);
      return;
    }

    if (this.cameraMode === 'cinema') {
      const a = this.elapsed * 0.14;
      const focus = this.fleetCenter.clone().add(new THREE.Vector3(0, 15, 30));
      const camPos = new THREE.Vector3(
        focus.x + Math.cos(a) * 320,
        92 + Math.sin(a * 1.7) * 32,
        focus.z + Math.sin(a) * 320
      );
      this.camera.position.lerp(camPos, Math.min(1, rawDt * 2.5));
      this.camera.position.add(shakeOffset);
      this.camera.lookAt(focus);
      return;
    }

    // Default Orbit Camera (tracks fleet softly if user focused on fleet)
    const selectedShip = this.ships.get(this.selectedShipId);
    if (selectedShip && !this.isRightDragging && this.desiredOrbitTarget.z < 180) {
      this.desiredOrbitTarget.lerp(selectedShip.group.position.clone().add(new THREE.Vector3(0, 10, 0)), rawDt * 0.9);
    }

    this.orbitTarget.lerp(this.desiredOrbitTarget, Math.min(1, rawDt * 6));
    const camX = this.orbitTarget.x + this.orbitDist * Math.cos(this.orbitPitch) * Math.sin(this.orbitYaw);
    const camY = Math.max(8, this.orbitTarget.y + this.orbitDist * Math.sin(this.orbitPitch));
    const camZ = this.orbitTarget.z + this.orbitDist * Math.cos(this.orbitPitch) * Math.cos(this.orbitYaw);

    this.camera.position.set(camX, camY, camZ).add(shakeOffset);
    this.camera.lookAt(this.orbitTarget);
  }

  private checkDefeatCondition() {
    if (this.difficulty === 'sandbox' || this.victory || this.defeat) return;
    if (this.missiles.length > 0 || this.launchQueue.length > 0) return;

    const totalAmmoLeft = Object.values(this.ammo).reduce((a, b) => a + b, 0);
    if (totalAmmoLeft === 0) {
      this.defeat = true;
      this.pushLog(`⚠️ تمام مهمات پایگاه به اتمام رسید و ناو هواپیمابر همچنان عملیاتی است.`, 'critical');
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const rawDt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    const simDt = rawDt * this.timeScale;

    this.elapsed += simDt;
    if (!this.victory && !this.defeat) {
      this.battleElapsed += simDt;
      this.stats.elapsedSec = Math.floor(this.battleElapsed);
    }

    // Cooldowns
    for (const id of Object.keys(this.cooldowns) as MissileId[]) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - simDt);
      }
    }

    // Launch queue processing
    for (const q of this.launchQueue) {
      q.delay -= simDt;
      if (q.delay <= 0) {
        this.spawnMissileImmediate(q);
      }
    }
    this.launchQueue = this.launchQueue.filter((q) => q.delay > 0);

    // Core simulation updates
    this.environment.update(simDt, this.elapsed);
    this.updateFleetAndWorld(simDt);
    this.updateMissiles(simDt);
    this.updateAirDefenseAI(simDt);
    this.updateInterceptors(simDt);
    this.particles.update(simDt);
    this.checkDefeatCondition();

    this.updateCamera(rawDt);
    this.renderer.render(this.scene, this.camera);

    // Emit HUD state at ~15Hz
    this.snapshotTimer += rawDt;
    if (this.snapshotTimer >= 0.065) {
      this.snapshotTimer = 0;
      this.emitSnapshot();
    }
  };

  private emitSnapshot() {
    const shipsSnap: ShipStateSnapshot[] = Array.from(this.ships.values()).map((s) => ({
      id: s.id,
      nameFa: s.nameFa,
      nameEn: s.nameEn,
      hullCode: s.hullCode,
      roleFa: s.roleFa,
      hp: Math.round(s.hp),
      maxHp: s.maxHp,
      sunk: s.sunk,
      x: s.group.position.x,
      z: s.group.position.z,
      heading: s.group.rotation.y,
      aegisAmmo: s.aegisAmmo,
      aegisMaxAmmo: s.aegisMaxAmmo,
      ciwsActive: s.id === 'cvn72' ? !s.subsystems?.find((sub) => sub.id === 'ciws')?.destroyed && !s.sunk : !s.sunk,
      subsystems: s.subsystems?.map((sub) => ({
        id: sub.id,
        nameFa: sub.nameFa,
        nameEn: sub.nameEn,
        hp: Math.round(sub.hp),
        maxHp: sub.maxHp,
        destroyed: sub.destroyed,
        effectFa: sub.effectFa,
      })),
    }));

    const missilesSnap: ActiveMissileSnapshot[] = this.missiles.map((m) => {
      const targetShip = this.ships.get(m.targetShipId);
      const distUnits = targetShip ? m.pos.distanceTo(targetShip.group.position) : 0;
      const distKm = Number((distUnits * 0.085).toFixed(1));
      const etaSec = Number(Math.max(0, distUnits / Math.max(m.spec.simSpeed * m.speedMult, 1)).toFixed(1));

      let phaseFa = 'فاز اوج‌گیری و شتاب';
      if (m.spec.underwater) phaseFa = 'حرکت سوپرکاویتاسیون زیرآبی';
      else if (m.spec.seaSkimming && m.progress > 0.1) phaseFa = 'پرواز ارتفاع پست روی موج‌ها';
      else if (m.spec.hypersonicWeave && m.progress > 0.35) phaseFa = 'گلاید هایپرسونیک و مانور S';
      else if (m.isSubmunition) phaseFa = 'شیرجه کلاهک مستقل MIRV';
      else if (m.progress > 0.65) phaseFa = 'شیرجه نهایی به سمت هدف';
      else if (m.progress > 0.35) phaseFa = 'عبور از اوج مدار (Mid-Course)';

      return {
        uid: m.uid,
        specId: m.spec.id,
        nameFa: m.isSubmunition ? `${m.spec.nameFa} (کلاهک MIRV)` : m.spec.nameFa,
        category: m.spec.category,
        x: m.pos.x,
        y: m.pos.y,
        z: m.pos.z,
        speedMach: Number((m.spec.speedMach * (m.progress > 0.65 && !m.spec.seaSkimming ? 1.15 : 1.0)).toFixed(1)),
        altitudeM: Math.max(0, Math.round(m.pos.y * 18)),
        distanceToTargetKm: distKm,
        etaSec,
        phaseFa,
        targetShipId: m.targetShipId,
        targetSubsystem: m.targetSubsystem,
        isSubmunition: m.isSubmunition,
        accentColor: m.spec.accentColor,
        underwater: m.spec.underwater,
      };
    });

    const interceptorsSnap: ActiveInterceptorSnapshot[] = this.interceptors.map((ic) => ({
      uid: ic.uid,
      x: ic.pos.x,
      y: ic.pos.y,
      z: ic.pos.z,
    }));

    this.onSnapshot({
      ships: shipsSnap,
      missiles: missilesSnap,
      interceptors: interceptorsSnap,
      selectedShipId: this.selectedShipId,
      selectedSubsystem: this.selectedSubsystem,
      trackedMissileUid: this.trackedMissileUid,
      cameraMode: this.cameraMode,
      timeScale: this.timeScale,
      ammo: { ...this.ammo },
      cooldowns: { ...this.cooldowns },
      stats: { ...this.stats },
      victory: this.victory,
      defeat: this.defeat,
      incomingAlert: this.missiles.some((m) => m.progress > 0.62),
      ciwsFiring: this.ciwsFiringThisFrame,
      difficulty: this.difficulty,
    });
  }

  private pushLog(text: string, level: CombatLogEntry['level']) {
    const mins = String(Math.floor(this.battleElapsed / 60)).padStart(2, '0');
    const secs = String(Math.floor(this.battleElapsed % 60)).padStart(2, '0');
    this.onLog({
      id: `log-${this.uidCounter++}`,
      timestamp: `${mins}:${secs}`,
      text,
      level,
    });
  }

  // ===== POINTER & KEYBOARD INPUT =====
  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (e.button === 2 || e.button === 1) {
      this.isRightDragging = true;
    } else {
      this.isDragging = true;
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDragging && !this.isRightDragging) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };

    if (this.cameraMode !== 'orbit') {
      this.cameraMode = 'orbit';
    }

    if (this.isDragging) {
      this.orbitYaw -= dx * 0.0055;
      this.orbitPitch = Math.max(0.06, Math.min(1.42, this.orbitPitch + dy * 0.0055));
    } else if (this.isRightDragging) {
      const panScale = this.orbitDist * 0.0018;
      const right = new THREE.Vector3(Math.cos(this.orbitYaw), 0, -Math.sin(this.orbitYaw));
      const forward = new THREE.Vector3(-Math.sin(this.orbitYaw), 0, -Math.cos(this.orbitYaw));
      this.desiredOrbitTarget.addScaledVector(right, -dx * panScale);
      this.desiredOrbitTarget.addScaledVector(forward, dy * panScale);
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (this.isDragging && moveDist < 6) {
      this.tryClickSelectShip(e.clientX, e.clientY);
    }
    this.isDragging = false;
    this.isRightDragging = false;
  };

  private tryClickSelectShip(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);

    const shipGroups = Array.from(this.ships.values())
      .filter((s) => !s.sunk)
      .map((s) => s.group);
    const hits = this.raycaster.intersectObjects(shipGroups, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData?.shipId) {
        obj = obj.parent;
      }
      if (obj?.userData?.shipId) {
        this.selectTarget(obj.userData.shipId as ShipId);
      }
    }
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.orbitDist = Math.max(58, Math.min(1250, this.orbitDist * (1 + Math.sign(e.deltaY) * 0.1)));
  };

  private handleContextMenu = (e: MouseEvent) => e.preventDefault();

  private handleResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('wheel', this.handleWheel, { passive: false });
    dom.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('resize', this.handleResize);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('wheel', this.handleWheel);
    dom.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
