"use client";

type LegendaItem = { label: string; valor: number; cor: string };

export function ProgressoCircular({
  percentual,
  tamanho = 150,
  legenda,
}: {
  percentual: number;
  tamanho?: number;
  legenda?: LegendaItem[];
}) {
  const raio = (tamanho - 18) / 2;
  const circ = 2 * Math.PI * raio;
  const offset = circ - (percentual / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: tamanho, height: tamanho }}>
        <svg width={tamanho} height={tamanho} className="-rotate-90">
          <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="#eef2ff" strokeWidth={12} />
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            stroke="#6366f1"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute text-center">
          <p className="text-3xl font-bold text-slate-800">{percentual}%</p>
        </div>
      </div>
      {legenda?.length ? (
        <div className="mt-4 grid w-full grid-cols-2 gap-x-6 gap-y-2 text-center sm:grid-cols-4">
          {legenda.map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-slate-500">{item.label}</p>
              <p className={`text-sm font-semibold ${item.cor}`}>
                {item.valor.toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
