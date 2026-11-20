import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Anchor,
  BookOpen,
  Camera,
  Clock,
  Compass,
  Crosshair,
  Eye,
  Film,
  Flame,
  Gauge,
  Moon,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sun,
  Sunrise,
  Trophy,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from './audio/SoundEngine';
import { ArsenalDock } from './components/ArsenalDock';
import { EncyclopediaModal } from './components/EncyclopediaModal';
import { FleetPanel } from './components/FleetPanel';
import { RadarScope } from './components/RadarScope';
import { GameEngine } from './game/GameEngine';
import {
  CameraMode,
  CarrierSubsystemId,
  CombatLogEntry,
  EngineSnapshot,
  GameDifficulty,
  MissileId,
  OpticsMode,
  ShipId,
  TimeOfDay,
} from './types/game';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [logs, setLogs] = useState<CombatLogEntry[]>([]);
  const [selectedMissile, setSelectedMissile] = useState<MissileId>('fattah');
  const [optics, setOptics] = useState<OpticsMode>('normal');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('sunset');
  const [muted, setMuted] = useState(false);
  const [autoTrack, setAutoTrack] = useState(true);
  const [showBriefing, setShowBriefing] = useState(true);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);

  const handleLog = useCallback((entry: CombatLogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 18));
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new GameEngine(mountRef.current, setSnapshot, handleLog);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleLog]);

  useEffect(() => {
    engineRef.current?.setPreviewMissile(selectedMissile);
  }, [selectedMissile]);

  // Keyboard shortcuts: Space to fire selected missile, 1-5 camera modes, H toggle HUD
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showBriefing || showEncyclopedia) return;
      if (e.code === 'Space') {
        e.preventDefault();
        engineRef.current?.launchMissile(selectedMissile);
      } else if (e.key === 'h' || e.key === 'H') {
        setHudHidden((v) => !v);
      } else if (e.key === '1') {
        engineRef.current?.setCameraMode('orbit');
      } else if (e.key === '2') {
        engineRef.current?.setCameraMode('missile');
      } else if (e.key === '3') {
        engineRef.current?.setCameraMode('carrier');
      } else if (e.key === '4') {
        engineRef.current?.setCameraMode('launch');
      } else if (e.key === '5') {
        engineRef.current?.setCameraMode('cinema');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMissile, showBriefing, showEncyclopedia]);

  const startMission = (diff: GameDifficulty) => {
    setLogs([]);
    engineRef.current?.resetMission(diff);
    setShowBriefing(false);
    soundEngine.playLockOn();
  };

  const handleSelectTarget = (shipId: ShipId, sub?: CarrierSubsystemId) => {
    engineRef.current?.selectTarget(shipId, sub);
  };

  const handleTimeOfDay = (tod: TimeOfDay) => {
    setTimeOfDay(tod);
    engineRef.current?.setTimeOfDay(tod);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const toggleAutoTrack = () => {
    const next = !autoTrack;
    setAutoTrack(next);
    engineRef.current?.setAutoTrack(next);
  };

  const trackedMissile =
    snapshot?.missiles.find((m) => m.uid === snapshot.trackedMissileUid) ?? snapshot?.missiles[0] ?? null;

  const opticsClass =
    optics === 'nvg' ? 'optics-nvg' : optics === 'flir' ? 'optics-flir' : 'optics-normal';

  const accuracyPct =
    snapshot && snapshot.stats.launched > 0
      ? Math.min(100, Math.round((snapshot.stats.hits / snapshot.stats.launched) * 100))
      : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 3D WebGL Viewport */}
      <div
        ref={mountRef}
        className={`absolute inset-0 w-full h-full transition-all duration-300 ${opticsClass}`}
      />

      {/* NVG / FLIR Optics Overlays */}
      {optics !== 'normal' && <div className="absolute inset-0 scanlines-overlay z-10" />}
      {optics === 'nvg' && <div className="absolute inset-0 nvg-vignette z-10" />}
      {optics === 'flir' && <div className="absolute inset-0 flir-vignette z-10" />}

      {/* Center subtle tactical crosshair in missile/carrier optics */}
      {!showBriefing && optics !== 'normal' && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center opacity-50">
          <div className="w-24 h-24 border border-emerald-400/60 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        </div>
      )}

      {/* Hide/Show HUD floating button when HUD is hidden */}
      {hudHidden && (
        <button
          type="button"
          onClick={() => setHudHidden(false)}
          className="fixed top-4 left-4 z-30 tac-panel px-3 py-1.5 rounded-xl text-xs font-bold text-sky-300 hover:text-white flex items-center gap-1.5"
        >
          <Eye className="w-4 h-4" />
          <span>نمایش پنل فرماندهی (H)</span>
        </button>
      )}

      {/* ===== MAIN TACTICAL HUD ===== */}
      {!hudHidden && snapshot && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 gap-2">
          {/* TOP COMMAND BAR */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2">
            {/* Title & Mode Pill */}
            <div className="tac-panel rounded-2xl px-3.5 py-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
                <Crosshair className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                  <span>طوفان خلیج ۳D</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
                    {snapshot.difficulty === 'sandbox'
                      ? 'تمرین آزاد'
                      : snapshot.difficulty === 'standard'
                      ? 'تاکتیکی'
                      : 'نبرد سخت'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  شبیه‌ساز تاکتیکی موشکی و ناوگروه آبراهام لینکلن
                </div>
              </div>
            </div>

            {/* Camera & Focus Toolbar */}
            <div className="tac-panel rounded-2xl px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 pl-1 border-l border-slate-700/70">
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>دوربین:</span>
              </div>
              {(
                [
                  { id: 'orbit', label: 'آزاد', icon: Compass },
                  { id: 'missile', label: 'تعقیب موشک', icon: Video },
                  { id: 'carrier', label: 'عرشه ناو', icon: Anchor },
                  { id: 'launch', label: 'پایگاه پرتاب', icon: Flame },
                  { id: 'cinema', label: 'سینمایی', icon: Film },
                ] as { id: CameraMode; label: string; icon: React.ComponentType<{ className?: string }> }[]
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => engineRef.current?.setCameraMode(id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition border ${
                    snapshot.cameraMode === id
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}

              <div className="h-5 w-px bg-slate-700/70 mx-0.5 hidden lg:block" />

              <button
                type="button"
                onClick={() => engineRef.current?.focusCameraOn('fleet')}
                className="px-2 py-1 rounded-lg text-[10px] bg-slate-900/80 hover:bg-slate-800 text-red-300 border border-slate-800"
              >
                ناوگروه
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.focusCameraOn('base')}
                className="px-2 py-1 rounded-lg text-[10px] bg-slate-900/80 hover:bg-slate-800 text-emerald-300 border border-slate-800"
              >
                پایگاه ساحلی
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.focusCameraOn('overview')}
                className="px-2 py-1 rounded-lg text-[10px] bg-slate-900/80 hover:bg-slate-800 text-amber-300 border border-slate-800"
              >
                نمای کل تنگه
              </button>
            </div>

            {/* Right Controls: Time of Day, Optics, Speed, Audio, Encyclopedia, Reset */}
            <div className="tac-panel rounded-2xl px-2.5 py-1.5 flex items-center gap-1.5">
              {/* Time of Day */}
              <div className="flex items-center bg-slate-900/80 rounded-xl p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTimeOfDay('sunset')}
                  title="غروب خلیج فارس"
                  className={`p-1.5 rounded-lg transition ${
                    timeOfDay === 'sunset' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sunrise className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeOfDay('day')}
                  title="روز آفتابی"
                  className={`p-1.5 rounded-lg transition ${
                    timeOfDay === 'day' ? 'bg-sky-500/30 text-sky-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeOfDay('night')}
                  title="عملیات شبانه"
                  className={`p-1.5 rounded-lg transition ${
                    timeOfDay === 'night' ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Optics Switch */}
              <div className="flex items-center bg-slate-900/80 rounded-xl p-0.5 border border-slate-800 text-[10px] font-bold">
                {(
                  [
                    { id: 'normal', label: 'عادی' },
                    { id: 'nvg', label: 'NVG' },
                    { id: 'flir', label: 'حرارتی' },
                  ] as { id: OpticsMode; label: string }[]
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOptics(o.id)}
                    className={`px-2 py-1 rounded-lg transition ${
                      optics === o.id ? 'bg-emerald-500/30 text-emerald-200' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Slow-motion Time Scale */}
              <div className="hidden xl:flex items-center bg-slate-900/80 rounded-xl p-0.5 border border-slate-800 text-[10px] font-mono-tech">
                {[0.25, 0.5, 1, 2].map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => engineRef.current?.setTimeScale(sc)}
                    className={`px-1.5 py-1 rounded-lg transition ${
                      snapshot.timeScale === sc ? 'bg-amber-500/30 text-amber-200 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sc}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleAutoTrack}
                title="تعقیب خودکار موشک هنگام شلیک"
                className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                  autoTrack
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                تعقیب خودکار
              </button>

              <button
                type="button"
                onClick={() => setShowEncyclopedia(true)}
                title="دایرةالمعارف تسلیحات"
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 hover:bg-slate-800 transition"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleMute}
                title={muted ? 'فعال کردن صدا' : 'قطع صدا'}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
              >
                {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => setHudHidden(true)}
                title="مخفی کردن پنل‌ها برای نمای سینمایی (H)"
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowBriefing(true)}
                title="تغییر حالت بازی / شروع مجدد"
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MIDDLE SECTION: Fleet Panel (Right in RTL) & Radar + Live Telemetry (Left in RTL) */}
          <div className="flex-1 flex items-start justify-between gap-3 min-h-0 overflow-hidden py-1">
            {/* RIGHT COLUMN (RTL Start): Fleet Status & Carrier Subsystems */}
            <div className="pointer-events-auto hidden md:flex flex-col gap-2">
              <FleetPanel
                ships={snapshot.ships}
                selectedShipId={snapshot.selectedShipId}
                selectedSubsystem={snapshot.selectedSubsystem}
                onSelectTarget={handleSelectTarget}
              />
            </div>

            {/* CENTER ALERTS (CIWS Firing / Terminal Dive Warning) */}
            <div className="flex flex-col items-center gap-2 mx-auto mt-1">
              {snapshot.ciwsFiring && (
                <div className="px-4 py-1.5 rounded-full bg-red-950/85 border border-red-500 animate-alert-border text-red-200 text-xs font-black flex items-center gap-2 shadow-lg shadow-red-950/60">
                  <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                  <span>هشدار: شلیک رگبار پدافند نزدیک فالانکس (CIWS) ناوگروه!</span>
                </div>
              )}

              {/* Active Missiles Quick Switcher Pills */}
              {snapshot.missiles.length > 0 && (
                <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5 max-w-md">
                  {snapshot.missiles.slice(0, 6).map((m) => (
                    <button
                      key={m.uid}
                      type="button"
                      onClick={() => engineRef.current?.trackMissile(m.uid)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md transition flex items-center gap-1.5 ${
                        snapshot.trackedMissileUid === m.uid
                          ? 'bg-amber-500/30 border-amber-400 text-amber-100'
                          : 'bg-slate-950/75 border-slate-700 text-slate-300 hover:border-sky-400'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: m.accentColor }}
                      />
                      <span>{m.nameFa}</span>
                      <span className="font-mono-tech text-sky-300">{m.distanceToTargetKm}km</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* LEFT COLUMN (RTL End): Radar + Telemetry + Combat Log */}
            <div className="pointer-events-auto flex flex-col gap-2 w-56 sm:w-64 items-end">
              <RadarScope
                ships={snapshot.ships}
                missiles={snapshot.missiles}
                interceptors={snapshot.interceptors}
                selectedShipId={snapshot.selectedShipId}
                onSelectShip={(id) => handleSelectTarget(id)}
              />

              {/* Live Missile Telemetry Box */}
              {trackedMissile && (
                <div className="tac-panel-amber rounded-2xl p-2.5 w-full space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                    <span className="flex items-center gap-1.5 truncate">
                      <Activity className="w-3.5 h-3.5 animate-pulse" />
                      {trackedMissile.nameFa}
                    </span>
                    <span className="font-mono-tech text-[10px] text-amber-200">LIVE</span>
                  </div>
                  <div className="text-[10px] text-sky-300 font-medium bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-800">
                    {trackedMissile.phaseFa}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="bg-slate-950/65 rounded-lg p-1.5 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Gauge className="w-3 h-3" /> سرعت
                      </span>
                      <span className="font-mono-tech font-bold text-sky-300">
                        {trackedMissile.underwater ? '200 KT' : `M ${trackedMissile.speedMach}`}
                      </span>
                    </div>
                    <div className="bg-slate-950/65 rounded-lg p-1.5 flex items-center justify-between">
                      <span className="text-slate-400">ارتفاع</span>
                      <span className="font-mono-tech font-bold text-emerald-300">
                        {trackedMissile.underwater ? '-4 m' : `${trackedMissile.altitudeM} m`}
                      </span>
                    </div>
                    <div className="bg-slate-950/65 rounded-lg p-1.5 flex items-center justify-between">
                      <span className="text-slate-400">فاصله</span>
                      <span className="font-mono-tech font-bold text-amber-300">
                        {trackedMissile.distanceToTargetKm} km
                      </span>
                    </div>
                    <div className="bg-slate-950/65 rounded-lg p-1.5 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> اصابت
                      </span>
                      <span className="font-mono-tech font-bold text-red-300">{trackedMissile.etaSec}s</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Compact Combat Log Feed */}
              <div className="tac-panel rounded-2xl p-2.5 w-full hidden lg:flex flex-col gap-1 max-h-36 overflow-y-auto tac-scroll">
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 border-b border-slate-800 pb-1">
                  <Radio className="w-3 h-3 text-sky-400" />
                  <span>گزارش لحظه‌ای مرکز فرماندهی</span>
                </div>
                {logs.length === 0 && (
                  <div className="text-[10px] text-slate-500 py-1">آماده دریافت دستور شلیک...</div>
                )}
                {logs.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className={`text-[10px] leading-snug ${
                      entry.level === 'victory'
                        ? 'text-emerald-300 font-bold'
                        : entry.level === 'hit'
                        ? 'text-amber-300'
                        : entry.level === 'intercept'
                        ? 'text-rose-300'
                        : entry.level === 'critical'
                        ? 'text-red-400 font-semibold'
                        : entry.level === 'launch'
                        ? 'text-sky-300'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="font-mono-tech text-slate-500 ml-1">[{entry.timestamp}]</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM ARSENAL DOCK */}
          <div className="pointer-events-auto">
            <ArsenalDock
              selectedMissile={selectedMissile}
              onSelectMissile={setSelectedMissile}
              onLaunch={(id) => engineRef.current?.launchMissile(id)}
              onLaunchSalvo={(ids) => engineRef.current?.launchCombinedSalvo(ids)}
              ammo={snapshot.ammo}
              cooldowns={snapshot.cooldowns}
              difficulty={snapshot.difficulty}
              disabled={snapshot.victory || snapshot.defeat}
            />
          </div>
        </div>
      )}

      {/* ===== MISSION BRIEFING / START SCREEN ===== */}
      {showBriefing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4">
          <div className="tac-panel rounded-3xl max-w-3xl w-full p-6 sm:p-8 border-amber-400/35 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto tac-scroll">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>شبیه‌ساز تاکتیکی موشکی و دریایی سه‌بعدی</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  عملیات طوفان خلیج <span className="text-amber-400">۳D</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  فرماندهی پایگاه موشکی ساحلی، زیردریایی کلاس غدیر و سامانه باور-۳۷۳ در برابر ناوگروه تهاجمی{' '}
                  <strong className="text-red-300">ناو هواپیمابر آبراهام لینکلن (CVN-72)</strong> و ناوشکن‌های
                  پدافندی ایجیس! از موشک‌های هایپرسونیک فتاح، خرمشهر-۴ چندکلاهکه، سجیل دومرحله‌ای، کروز ارتفاع‌پست
                  ابومهدی و اژدر زیرآبی حوت برای شکستن سپر پدافندی دشمن استفاده کنید.
                </p>
              </div>
            </div>

            {/* 3 Game Modes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => startMission('sandbox')}
                className="text-right rounded-2xl p-4 bg-emerald-950/35 border border-emerald-500/45 hover:border-emerald-300 hover:bg-emerald-950/55 transition flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="text-sm font-black text-emerald-300 group-hover:text-emerald-200">
                    🎯 تمرین آزاد (نامحدود)
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    مهمات نامحدود از تمام ۱۰ سامانه موشکی! آزادانه رگبار ترکیبی، جدایش کلاهک MIRV و دوربین تعقیب موشک
                    را تجربه کنید.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-400">ورود به میدان ←</span>
              </button>

              <button
                type="button"
                onClick={() => startMission('standard')}
                className="text-right rounded-2xl p-4 bg-amber-950/35 border border-amber-500/50 hover:border-amber-300 hover:bg-amber-950/55 transition flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="text-sm font-black text-amber-300 group-hover:text-amber-200">
                    ⚔️ عملیات طوفان (تاکتیکی)
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    مهمات واقعی و پدافند فعال ایجیس و فالانکس CIWS. با ترکیب پهپاد شاهد و موشک‌های سنگین ناوگروه را
                    غرق کنید.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-amber-400">آغاز عملیات ←</span>
              </button>

              <button
                type="button"
                onClick={() => startMission('hard')}
                className="text-right rounded-2xl p-4 bg-red-950/35 border border-red-500/50 hover:border-red-300 hover:bg-red-950/55 transition flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="text-sm font-black text-red-300 group-hover:text-red-200">
                    🔥 نبرد تمام‌عیار (سخت)
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    حداکثر آماده‌باش راداری ایجیس، مانور گریز ناوگروه و رهگیری سنگین! نیازمند تاکتیک اشباع و هدف‌گیری
                    پل فرماندهی.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-red-400">چالش نهایی ←</span>
              </button>
            </div>

            {/* Quick Controls Guide */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-slate-300">
              <div>
                <div className="text-sky-400 font-bold mb-0.5">چرخش دوربین ۳D</div>
                <div>کشیدن کلیک چپ + اسکرول</div>
              </div>
              <div>
                <div className="text-amber-400 font-bold mb-0.5">قفل روی هدف</div>
                <div>کلیک روی ناو یا پنل راست</div>
              </div>
              <div>
                <div className="text-emerald-400 font-bold mb-0.5">شلیک سریع</div>
                <div>دکمه SPACE یا دبل‌کلیک</div>
              </div>
              <div>
                <div className="text-purple-400 font-bold mb-0.5">تغییر دوربین</div>
                <div>کلیدهای ۱ تا ۵ · H مخفی‌سازی</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowEncyclopedia(true)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-2 transition"
              >
                <BookOpen className="w-4 h-4" />
                <span>مشاهده دایرةالمعارف کامل تسلیحات</span>
              </button>
              <span className="text-[11px] text-slate-400 font-mono-tech">Three.js WebGL Engine · 60 FPS</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== VICTORY / DEFEAT BATTLE REPORT ===== */}
      {snapshot && (snapshot.victory || snapshot.defeat) && !showBriefing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="tac-panel rounded-3xl max-w-lg w-full p-6 border-amber-400/50 text-center space-y-5">
            <div
              className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
                snapshot.victory
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/40'
                  : 'bg-gradient-to-br from-red-600 to-rose-700 shadow-lg shadow-red-600/40'
              }`}
            >
              {snapshot.victory ? (
                <Trophy className="w-9 h-9 text-white" />
              ) : (
                <ShieldAlert className="w-9 h-9 text-white" />
              )}
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">
                {snapshot.victory ? 'پیروزی قاطع عملیات!' : 'پایان مهمات عملیات'}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {snapshot.victory
                  ? 'ناو هواپیمابر آبراهام لینکلن (CVN-72) منهدم شد و به زیر آب فرو رفت!'
                  : 'مهمات پایگاه به اتمام رسید؛ با ترکیب پهپاد شاهد و اژدر حوت دوباره تلاش کنید.'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
                <div className="text-[10px] text-slate-400">موشک شلیک‌شده</div>
                <div className="text-lg font-black font-mono-tech text-sky-300">{snapshot.stats.launched}</div>
              </div>
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
                <div className="text-[10px] text-slate-400">اصابت مستقیم</div>
                <div className="text-lg font-black font-mono-tech text-emerald-300">{snapshot.stats.hits}</div>
              </div>
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
                <div className="text-[10px] text-slate-400">رهگیری دشمن</div>
                <div className="text-lg font-black font-mono-tech text-rose-300">{snapshot.stats.intercepted}</div>
              </div>
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
                <div className="text-[10px] text-slate-400">دقت اصابت</div>
                <div className="text-lg font-black font-mono-tech text-amber-300">{accuracyPct}%</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => startMission(snapshot.difficulty)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-red-600 text-white text-xs font-black hover:brightness-110 transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تکرار همین عملیات</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBriefing(true)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-800 transition"
              >
                انتخاب سطح دیگر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weapon Encyclopedia Modal */}
      <EncyclopediaModal open={showEncyclopedia} onClose={() => setShowEncyclopedia(false)} />
    </div>
  );
}
