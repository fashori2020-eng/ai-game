import React, { useState } from 'react';
import { BookOpen, Rocket, Shield, Ship, X } from 'lucide-react';
import { ENEMY_EQUIPMENT_INFO, FRIENDLY_EQUIPMENT_INFO, MISSILE_ARSENAL } from '../data/arsenal';

interface EncyclopediaModalProps {
  open: boolean;
  onClose: () => void;
}

export const EncyclopediaModal: React.FC<EncyclopediaModalProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState<'missiles' | 'friendly' | 'enemy'>('missiles');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="tac-panel rounded-3xl w-full max-w-4xl max-h-[86vh] flex flex-col overflow-hidden border-sky-400/35">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-black text-slate-100">دایرةالمعارف تسلیحات و تجهیزات نظامی</h2>
              <p className="text-[11px] text-slate-400">مشخصات فنی موشک‌های ایرانی، پایگاه ساحلی و ناوگروه آبراهام لینکلن</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-slate-950/50 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => setTab('missiles')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              tab === 'missiles'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span>زرادخانه موشکی ایران (۱۰ سامانه)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('friendly')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              tab === 'friendly'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>تجهیزات پایگاه ساحلی خودی</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('enemy')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              tab === 'enemy'
                ? 'bg-red-500/20 border-red-400 text-red-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Ship className="w-4 h-4" />
            <span>ناوگروه آبراهام لینکلن و پدافند</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto tac-scroll grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {tab === 'missiles' &&
            MISSILE_ARSENAL.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl p-4 bg-slate-900/75 border border-slate-800 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-slate-100">{m.nameFa}</div>
                    <div className="text-[11px] text-slate-400 font-mono-tech">{m.nameEn}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${m.badgeColor}`}>
                    {m.categoryFa}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{m.descriptionFa}</p>
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800 text-center text-[10px]">
                  <div className="bg-slate-950/70 rounded-lg py-1">
                    <div className="text-slate-500">سرعت</div>
                    <div className="font-mono-tech font-bold text-sky-300">
                      {m.underwater ? '200 KT' : `M ${m.speedMach}`}
                    </div>
                  </div>
                  <div className="bg-slate-950/70 rounded-lg py-1">
                    <div className="text-slate-500">برد</div>
                    <div className="font-mono-tech font-bold text-emerald-300">{m.rangeKm} km</div>
                  </div>
                  <div className="bg-slate-950/70 rounded-lg py-1">
                    <div className="text-slate-500">سرجنگی</div>
                    <div className="font-mono-tech font-bold text-amber-300">{m.warheadKg} kg</div>
                  </div>
                  <div className="bg-slate-950/70 rounded-lg py-1">
                    <div className="text-slate-500">گریز پدافند</div>
                    <div className="font-mono-tech font-bold text-purple-300">
                      {Math.round(m.evasion * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {tab === 'friendly' &&
            FRIENDLY_EQUIPMENT_INFO.map((item) => (
              <div
                key={item.nameEn}
                className="rounded-2xl p-4 bg-emerald-950/20 border border-emerald-500/25 flex flex-col gap-1.5"
              >
                <div className="text-sm font-black text-emerald-200">{item.nameFa}</div>
                <div className="text-[11px] font-mono-tech text-emerald-400/75">{item.nameEn}</div>
                <p className="text-xs text-slate-300 leading-relaxed mt-1">{item.roleFa}</p>
              </div>
            ))}

          {tab === 'enemy' &&
            ENEMY_EQUIPMENT_INFO.map((item) => (
              <div
                key={item.nameEn}
                className="rounded-2xl p-4 bg-red-950/20 border border-red-500/25 flex flex-col gap-1.5"
              >
                <div className="text-sm font-black text-red-200">{item.nameFa}</div>
                <div className="text-[11px] font-mono-tech text-red-400/75">{item.nameEn}</div>
                <p className="text-xs text-slate-300 leading-relaxed mt-1">{item.roleFa}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
