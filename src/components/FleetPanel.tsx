import React from 'react';
import { Crosshair, ShieldAlert, Skull, Target } from 'lucide-react';
import { CarrierSubsystemId, ShipId, ShipStateSnapshot } from '../types/game';

interface FleetPanelProps {
  ships: ShipStateSnapshot[];
  selectedShipId: ShipId;
  selectedSubsystem: CarrierSubsystemId;
  onSelectTarget: (shipId: ShipId, subsystem?: CarrierSubsystemId) => void;
}

export const FleetPanel: React.FC<FleetPanelProps> = ({
  ships,
  selectedShipId,
  selectedSubsystem,
  onSelectTarget,
}) => {
  const cvn = ships.find((s) => s.id === 'cvn72');
  const escorts = ships.filter((s) => s.id !== 'cvn72');

  return (
    <div className="tac-panel rounded-2xl p-3 w-72 flex flex-col gap-2.5 max-h-[54vh] overflow-y-auto tac-scroll">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
        <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
          <Target className="w-4 h-4" />
          <span>اهداف ناوگروه آبراهام لینکلن</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono-tech">CSG-3</span>
      </div>

      {/* USS Abraham Lincoln CVN-72 Main Card */}
      {cvn && (
        <div
          onClick={() => !cvn.sunk && onSelectTarget('cvn72', selectedSubsystem)}
          className={`rounded-xl p-2.5 border transition cursor-pointer ${
            cvn.sunk
              ? 'bg-slate-900/50 border-slate-800 opacity-60'
              : selectedShipId === 'cvn72'
              ? 'bg-red-950/35 border-red-500/70 shadow-lg shadow-red-950/40'
              : 'bg-slate-900/60 border-slate-700/60 hover:border-red-500/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold text-slate-100 flex items-center gap-1.5">
                {cvn.sunk ? (
                  <Skull className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5 text-red-400" />
                )}
                <span>ناو آبراهام لینکلن</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono-tech">USS Abraham Lincoln · CVN-72</div>
            </div>
            <span
              className={`text-[11px] font-bold font-mono-tech px-1.5 py-0.5 rounded ${
                cvn.sunk ? 'bg-red-950 text-red-400' : 'bg-slate-800 text-amber-300'
              }`}
            >
              {cvn.sunk ? 'غرق شد' : `${Math.round((cvn.hp / cvn.maxHp) * 100)}%`}
            </span>
          </div>

          {/* Main HP Bar */}
          <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 bg-gradient-to-l from-red-500 via-amber-500 to-emerald-500"
              style={{ width: `${(cvn.hp / cvn.maxHp) * 100}%` }}
            />
          </div>

          {/* Clickable 5 Subsystems on Carrier! */}
          {!cvn.sunk && cvn.subsystems && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
              <div className="text-[10px] text-amber-300/90 font-semibold mb-1">
                انتخاب نقطه حساس جهت قفل نقطه‌زن:
              </div>
              {cvn.subsystems.map((sub) => {
                const isSelected = selectedShipId === 'cvn72' && selectedSubsystem === sub.id;
                const pct = Math.round((sub.hp / sub.maxHp) * 100);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTarget('cvn72', sub.id);
                    }}
                    className={`w-full text-right px-2 py-1 rounded-lg border text-[11px] transition flex flex-col gap-0.5 ${
                      sub.destroyed
                        ? 'bg-red-950/20 border-red-900/40 text-slate-500 line-through'
                        : isSelected
                        ? 'bg-amber-500/20 border-amber-400/70 text-amber-100'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                    title={sub.effectFa}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate font-medium">{sub.nameFa}</span>
                      <span className="font-mono-tech text-[10px] opacity-85">
                        {sub.destroyed ? 'منهدم' : `${pct}%`}
                      </span>
                    </div>
                    {!sub.destroyed && (
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            pct > 55 ? 'bg-sky-400' : pct > 25 ? 'bg-amber-400' : 'bg-red-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Escort Ships (Aegis Destroyers & Cruiser) */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 px-0.5">
          <ShieldAlert className="w-3 h-3 text-sky-400" />
          <span>ناوهای اسکورت پدافندی (ایجیس):</span>
        </div>
        {escorts.map((ship) => {
          const isSel = selectedShipId === ship.id;
          const pct = Math.round((ship.hp / ship.maxHp) * 100);
          return (
            <button
              key={ship.id}
              type="button"
              disabled={ship.sunk}
              onClick={() => onSelectTarget(ship.id)}
              className={`w-full text-right p-2 rounded-xl border transition ${
                ship.sunk
                  ? 'bg-slate-900/40 border-slate-800/60 opacity-45 cursor-not-allowed'
                  : isSel
                  ? 'bg-amber-500/15 border-amber-400/75'
                  : 'bg-slate-900/65 border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-200 truncate">{ship.nameFa}</span>
                <span className="font-mono-tech text-[10px] text-sky-300">{ship.hullCode}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>موشک ایجیس: {ship.sunk ? 0 : ship.aegisAmmo}</span>
                <span className="font-mono-tech">{ship.sunk ? 'غرق شد' : `${pct}%`}</span>
              </div>
              <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-orange-500 to-sky-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
