import React, { useEffect, useRef } from 'react';
import { ActiveInterceptorSnapshot, ActiveMissileSnapshot, ShipId, ShipStateSnapshot } from '../types/game';

interface RadarScopeProps {
  ships: ShipStateSnapshot[];
  missiles: ActiveMissileSnapshot[];
  interceptors: ActiveInterceptorSnapshot[];
  selectedShipId: ShipId;
  onSelectShip: (id: ShipId) => void;
}

export const RadarScope: React.FC<RadarScopeProps> = ({
  ships,
  missiles,
  interceptors,
  selectedShipId,
  onSelectShip,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepRef = useRef(0);
  const dataRef = useRef({ ships, missiles, interceptors, selectedShipId });
  dataRef.current = { ships, missiles, interceptors, selectedShipId };

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = canvas.width;
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 6;

      // Map world coords: X in [-620, 620], Z in [-620, 650] -> center around Z = +80
      const worldToRadar = (wx: number, wz: number): [number, number] => {
        const scale = r / 680;
        const rx = cx + wx * scale;
        const ry = cy + (wz - 90) * scale;
        return [rx, ry];
      };

      ctx.clearRect(0, 0, size, size);

      // Dark tactical scope background
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      const bgGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      bgGrad.addColorStop(0, '#04231c');
      bgGrad.addColorStop(1, '#020c10');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // Range rings & crosshair
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Rotating green radar sweep wedge
      sweepRef.current = (sweepRef.current + 0.032) % (Math.PI * 2);
      const sweep = sweepRef.current;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, sweep - 0.55, sweep);
      ctx.closePath();
      const wedgeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      wedgeGrad.addColorStop(0, 'rgba(16, 185, 129, 0.04)');
      wedgeGrad.addColorStop(1, 'rgba(16, 185, 129, 0.28)');
      ctx.fillStyle = wedgeGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
      ctx.stroke();

      // Friendly coastal base marker (south)
      const [bx, by] = worldToRadar(0, 540);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(bx - 14, by - 3, 28, 6);
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillStyle = '#86efac';
      ctx.textAlign = 'center';
      ctx.fillText('BASE', bx, by + 13);

      const { ships: curShips, missiles: curMissiles, interceptors: curIc, selectedShipId: selId } = dataRef.current;

      // Enemy Fleet Ships
      for (const s of curShips) {
        if (s.sunk) continue;
        const [sx, sy] = worldToRadar(s.x, s.z);
        const isCvn = s.id === 'cvn72';
        const isSel = s.id === selId;

        if (isSel) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, isCvn ? 10 : 7, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isCvn ? '#ef4444' : '#fb923c';
        ctx.beginPath();
        if (isCvn) {
          ctx.rect(sx - 5, sy - 3, 10, 6);
        } else {
          ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        }
        ctx.fill();

        if (isCvn) {
          ctx.fillStyle = '#fca5a5';
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CVN-72', sx, sy - 11);
        }
      }

      // Active Player Missiles
      for (const m of curMissiles) {
        const [mx, my] = worldToRadar(m.x, m.z);
        ctx.fillStyle = m.underwater ? '#06b6d4' : m.accentColor;
        ctx.beginPath();
        ctx.arc(mx, my, m.isSubmunition ? 2.4 : 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Glow halo
        ctx.strokeStyle = m.accentColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(mx, my, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Enemy Aegis Interceptors
      ctx.fillStyle = '#f43f5e';
      for (const ic of curIc) {
        const [ix, iy] = worldToRadar(ic.x, ic.z);
        ctx.beginPath();
        ctx.arc(ix, iy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Outer bezel ring
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleRadarClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const size = rect.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;
    const scale = r / 680;

    let closest: ShipId | null = null;
    let bestD = 18;
    for (const s of ships) {
      if (s.sunk) continue;
      const sx = cx + s.x * scale;
      const sy = cy + (s.z - 90) * scale;
      const d = Math.hypot(clickX - sx, clickY - sy);
      if (d < bestD) {
        bestD = d;
        closest = s.id;
      }
    }
    if (closest) onSelectShip(closest);
  };

  return (
    <div className="tac-panel rounded-2xl p-2.5 flex flex-col items-center gap-1.5">
      <div className="w-full flex items-center justify-between px-1 text-[11px] text-emerald-300/90">
        <span className="font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          رادار تاکتیکی خلیج فارس
        </span>
        <span className="font-mono-tech text-[10px] text-emerald-400/75">R: 120 KM</span>
      </div>
      <canvas
        ref={canvasRef}
        width={174}
        height={174}
        onClick={handleRadarClick}
        className="cursor-crosshair rounded-full"
        title="برای قفل روی هر شناور، روی نقطه آن در رادار کلیک کنید"
      />
      <div className="w-full flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> ناوگروه
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> موشک خودی
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> پایگاه
        </span>
      </div>
    </div>
  );
};
