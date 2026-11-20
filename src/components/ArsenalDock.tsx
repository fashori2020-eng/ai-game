import React, { useState } from 'react';
import { Flame, Layers, Rocket, ShieldOff, Sparkles, Waves, Zap } from 'lucide-react';
import { MISSILE_ARSENAL } from '../data/arsenal';
import { GameDifficulty, MissileCategory, MissileId, MissileSpec } from '../types/game';

interface ArsenalDockProps {
  selectedMissile: MissileId;
  onSelectMissile: (id: MissileId) => void;
  onLaunch: (id: MissileId) => void;
  onLaunchSalvo: (ids: MissileId[]) => void;
  ammo: Record<MissileId, number>;
  cooldowns: Record<MissileId, number>;
  difficulty: GameDifficulty;
  disabled?: boolean;
}

const CATEGORY_TABS: { id: 'all' | MissileCategory; label: string }[] = [
  { id: 'all', label: 'همه تسلیحات (۱۰)' },
  { id: 'hypersonic', label: 'هایپرسونیک' },
  { id: 'ballistic_heavy', label: 'بالستیک سنگین' },
  { id: 'ballistic_asbm', label: 'بالستیک ضدکشتی' },
  { id: 'cruise', label: 'کروز دریایی' },
  { id: 'drone_swarm', label: 'پهپاد انتحاری' },
  { id: 'torpedo', label: 'اژدر زیرآبی' },
];

export const ArsenalDock: React.FC<ArsenalDockProps> = ({
  selectedMissile,
  onSelectMissile,
  onLaunch,
  onLaunchSalvo,
  ammo,
  cooldowns,
  difficulty,
  disabled,
}) => {
  const [filter, setFilter] = useState<'all' | MissileCategory>('all');
  const [salvoMode, setSalvoMode] = useState(false);
  const [salvoQueue, setSalvoQueue] = useState<MissileId[]>(['shahed136', 'noor_qader', 'fattah']);

  const filtered =
    filter === 'all' ? MISSILE_ARSENAL : MISSILE_ARSENAL.filter((m) => m.category === filter);

  const activeSpec: MissileSpec =
    MISSILE_ARSENAL.find((m) => m.id === selectedMissile) ?? MISSILE_ARSENAL[0];

  const activeCooldown = cooldowns[activeSpec.id] ?? 0;
  const activeAmmo = ammo[activeSpec.id] ?? 0;
  const canFireSingle =
    !disabled && activeCooldown <= 0.05 && (difficulty === 'sandbox' || activeAmmo > 0);

  const toggleSalvoItem = (id: MissileId) => {
    setSalvoQueue((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleFireSalvo = () => {
    if (disabled || salvoQueue.length === 0) return;
    onLaunchSalvo(salvoQueue);
  };

  const renderCategoryIcon = (cat: MissileCategory) => {
    switch (cat) {
      case 'hypersonic':
        return <Zap className="w-3.5 h-3.5 text-sky-400" />;
      case 'torpedo':
        return <Waves className="w-3.5 h-3.5 text-cyan-400" />;
      case 'drone_swarm':
        return <Sparkles className="w-3.5 h-3.5 text-yellow-400" />;
      default:
        return <Rocket className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="tac-panel rounded-2xl p-3 flex flex-col gap-2.5 w-full max-w-[1160px] mx-auto">
      {/* Top bar: category filters + Salvo Mode toggle + Fire button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto tac-scroll pb-0.5">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition border ${
                filter === tab.id
                  ? 'bg-sky-500/25 border-sky-400/70 text-sky-200'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSalvoMode((s) => !s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              salvoMode
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-amber-500/50'
            }`}
            title="انتخاب همزمان تا ۵ سامانه برای حمله اشباع ترکیبی!"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{salvoMode ? `حالت رگبار (${salvoQueue.length}/۵)` : 'حمله ترکیبی (رگبار)'}</span>
          </button>

          {salvoMode ? (
            <button
              type="button"
              disabled={disabled || salvoQueue.length === 0}
              onClick={handleFireSalvo}
              className="px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 bg-gradient-to-l from-red-600 via-orange-500 to-amber-500 text-white shadow-lg shadow-red-600/35 hover:brightness-110 active:scale-95 transition disabled:opacity-40"
            >
              <Flame className="w-4 h-4" />
              <span>شلیک همزمان ({salvoQueue.length} سامانه)</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canFireSingle}
              onClick={() => onLaunch(activeSpec.id)}
              className="px-5 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 bg-gradient-to-l from-red-600 to-amber-500 text-white shadow-lg shadow-red-600/35 hover:brightness-110 active:scale-95 transition disabled:opacity-40"
            >
              <Rocket className="w-4 h-4" />
              <span>
                {activeCooldown > 0.05
                  ? `آماده‌سازی (${activeCooldown.toFixed(1)}s)`
                  : `شلیک ${activeSpec.nameFa}`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal scrollable Missile Cards */}
      <div className="flex gap-2 overflow-x-auto tac-scroll pb-1">
        {filtered.map((m) => {
          const isSelected = salvoMode ? salvoQueue.includes(m.id) : selectedMissile === m.id;
          const cd = cooldowns[m.id] ?? 0;
          const count = ammo[m.id] ?? 0;
          const outOfAmmo = difficulty !== 'sandbox' && count <= 0;

          return (
            <button
              key={m.id}
              type="button"
              disabled={outOfAmmo}
              onClick={() => {
                if (salvoMode) {
                  toggleSalvoItem(m.id);
                } else {
                  onSelectMissile(m.id);
                }
              }}
              onDoubleClick={() => {
                if (!salvoMode && !outOfAmmo) onLaunch(m.id);
              }}
              className={`relative shrink-0 w-44 text-right rounded-xl p-2 border transition flex flex-col justify-between gap-1.5 overflow-hidden ${
                outOfAmmo
                  ? 'bg-slate-950/60 border-slate-800/60 opacity-40 cursor-not-allowed'
                  : isSelected
                  ? 'bg-slate-800/95 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/75 border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/70'
              }`}
            >
              {/* Cooldown sweep overlay */}
              {cd > 0.05 && (
                <div
                  className="absolute inset-0 bg-slate-950/65 pointer-events-none"
                  style={{
                    width: `${Math.min(100, (cd / m.cooldownSec) * 100)}%`,
                  }}
                />
              )}

              <div className="relative z-10 flex items-start justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  {renderCategoryIcon(m.category)}
                  <span className="text-[11px] font-extrabold text-slate-100 truncate">
                    {m.nameFa}
                  </span>
                </div>
                <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950/80 text-emerald-300 shrink-0">
                  {difficulty === 'sandbox' ? '∞' : `×${count}`}
                </span>
              </div>

              <div className="relative z-10 flex items-center justify-between text-[10px]">
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${m.badgeColor}`}>
                  {m.categoryFa}
                </span>
                <span className="font-mono-tech text-slate-300 font-bold">
                  {m.underwater ? '200 KT' : `M ${m.speedMach}`}
                </span>
              </div>

              <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                <span>تخریب: {m.mirvCount ? `${m.damage}×۳` : m.salvoCount > 1 ? `${m.damage}×${m.salvoCount}` : m.damage}</span>
                <span className="flex items-center gap-0.5 text-sky-300">
                  <ShieldOff className="w-3 h-3" />
                  {Math.round(m.evasion * 100)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tactical info strip for active missile */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-950/55 rounded-xl px-3 py-1.5 border border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeSpec.accentColor }}
          />
          <span className="font-bold text-amber-300 shrink-0">{activeSpec.nameFa}:</span>
          <span className="text-slate-300 truncate">{activeSpec.tacticalTipFa}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono-tech text-slate-400 shrink-0">
          <span>RANGE: {activeSpec.rangeKm} KM</span>
          <span>WARHEAD: {activeSpec.warheadKg} KG</span>
          <span className="text-sky-400 hidden sm:inline">دبل‌کلیک = شلیک سریع | SPACE = شلیک</span>
        </div>
      </div>
    </div>
  );
};
