"use client";

export function ProgressoCircular({
  percentual,
  tamanho = 140,
}: {
  percentual: number;
  tamanho?: number;
}) {
  const raio = (tamanho - 16) / 2;
  const circ = 2 * Math.PI * raio;
  const offset = circ - (percentual / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={10}
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="#6366f1"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold text-slate-800">{percentual}%</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-500">concluído</p>
      </div>
    </div>
  );
}
