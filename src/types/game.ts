export type MissileId =
  | 'fattah'
  | 'khalij_fars'
  | 'khorramshahr4'
  | 'sejjil'
  | 'noor_qader'
  | 'abu_mahdi'
  | 'shahed136'
  | 'zolfaghar_basir'
  | 'emad'
  | 'hoot';

export type MissileCategory =
  | 'hypersonic'
  | 'ballistic_asbm'
  | 'ballistic_heavy'
  | 'cruise'
  | 'drone_swarm'
  | 'torpedo';

export type LaunchOrigin = 'tel_north' | 'tel_south' | 'silo' | 'coastal_battery' | 'submarine' | 'fast_boat';

export interface MissileSpec {
  id: MissileId;
  nameFa: string;
  nameEn: string;
  category: MissileCategory;
  categoryFa: string;
  descriptionFa: string;
  tacticalTipFa: string;
  speedMach: number; // Display Mach
  simSpeed: number; // World units per second (base)
  damage: number;
  blastRadius: number;
  evasion: number; // 0 to 1 (resistance to Aegis/CIWS)
  rcs: number; // 0 to 1 (lower = harder to detect early)
  salvoCount: number; // e.g., 5 for Shahed-136, 1 for others
  mirvCount?: number; // e.g., 3 for Khorramshahr-4
  twoStage?: boolean;
  underwater?: boolean;
  seaSkimming?: boolean;
  flanking?: boolean;
  hypersonicWeave?: boolean;
  arcHeight: number;
  cooldownSec: number;
  ammoStandard: number;
  ammoHard: number;
  launchOrigin: LaunchOrigin;
  accentColor: string;
  badgeColor: string;
  rangeKm: number;
  warheadKg: number;
}

export type ShipId = 'cvn72' | 'ddg111' | 'ddg77' | 'cg53';

export type CarrierSubsystemId = 'island' | 'flight_deck' | 'hull' | 'hangar' | 'ciws';

export interface SubsystemState {
  id: CarrierSubsystemId;
  nameFa: string;
  nameEn: string;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  effectFa: string;
}

export interface ShipStateSnapshot {
  id: ShipId;
  nameFa: string;
  nameEn: string;
  hullCode: string;
  roleFa: string;
  hp: number;
  maxHp: number;
  sunk: boolean;
  x: number;
  z: number;
  heading: number;
  aegisAmmo: number;
  aegisMaxAmmo: number;
  ciwsActive: boolean;
  subsystems?: SubsystemState[];
}

export interface ActiveMissileSnapshot {
  uid: string;
  specId: MissileId;
  nameFa: string;
  category: MissileCategory;
  x: number;
  y: number;
  z: number;
  speedMach: number;
  altitudeM: number;
  distanceToTargetKm: number;
  etaSec: number;
  phaseFa: string;
  targetShipId: ShipId;
  targetSubsystem?: CarrierSubsystemId;
  isSubmunition?: boolean;
  accentColor: string;
  underwater?: boolean;
}

export interface ActiveInterceptorSnapshot {
  uid: string;
  x: number;
  y: number;
  z: number;
}

export type CameraMode = 'orbit' | 'missile' | 'carrier' | 'launch' | 'cinema';
export type OpticsMode = 'normal' | 'nvg' | 'flir';
export type TimeOfDay = 'sunset' | 'day' | 'night';
export type GameDifficulty = 'sandbox' | 'standard' | 'hard';

export interface CombatLogEntry {
  id: string;
  timestamp: string;
  text: string;
  level: 'info' | 'launch' | 'hit' | 'intercept' | 'critical' | 'victory';
}

export interface BattleStats {
  launched: number;
  hits: number;
  intercepted: number;
  damageDealt: number;
  shipsSunk: number;
  elapsedSec: number;
}

export interface EngineSnapshot {
  ships: ShipStateSnapshot[];
  missiles: ActiveMissileSnapshot[];
  interceptors: ActiveInterceptorSnapshot[];
  selectedShipId: ShipId;
  selectedSubsystem: CarrierSubsystemId;
  trackedMissileUid: string | null;
  cameraMode: CameraMode;
  timeScale: number;
  ammo: Record<MissileId, number>;
  cooldowns: Record<MissileId, number>;
  stats: BattleStats;
  victory: boolean;
  defeat: boolean;
  incomingAlert: boolean;
  ciwsFiring: boolean;
  difficulty: GameDifficulty;
}
