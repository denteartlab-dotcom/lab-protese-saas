"use client";

import Link from "next/link";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  Package,
  Plus,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const principal = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/producao", label: "Produção", icon: ClipboardList, seta: true },
  { href: "/app/producao/agenda", label: "Agenda", icon: Calendar },
  { href: "/app/producao/os", label: "Ordens de Serviço", icon: FileText },
  { href: "/app/pacientes", label: "Pacientes", icon: Users },
  { href: "/app/financeiro", label: "Financeiro", icon: Wallet },
];

const relatorios = [
  { href: "/app/relatorios/producao", label: "Produção", icon: BarChart3 },
  { href: "/app/relatorios/tempo-producao", label: "Tempo por Etapa", icon: Clock, ativo: true },
  { href: "/app/relatorios/tempo-producao?apenasAtrasados=1", label: "Atrasos", icon: Clock },
  { href: "/app/relatorios/tempo-producao", label: "Colaboradores", icon: Users },
  { href: "/app/relatorios/controle-entregas", label: "Entrega", icon: Truck },
  { href: "/app/financeiro", label: "Faturamento", icon: Wallet },
];

const cadastros = [
  { href: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/app/cadastros/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/app/cadastros/tabela-precos", label: "Serviços", icon: Package },
];

export function ReportPremiumSidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/5 bg-[#0b1220] text-slate-300 lg:flex xl:w-[260px] tv:w-[280px]">
      <div className="border-b border-white/5 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <span className="text-sm font-black text-white">S</span>
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">smart prótese</p>
            <p className="text-[10px] font-medium text-violet-300/80">2.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Principal
          </p>
          <ul className="space-y-0.5">
            {principal.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="flex-1">{item.label}</span>
                  {item.seta ? <ChevronDown className="h-3.5 w-3.5 opacity-50" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Relatórios
          </p>
          <ul className="space-y-0.5">
            {relatorios.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    item.ativo
                      ? "bg-violet-600/25 text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)] ring-1 ring-violet-500/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", item.ativo && "text-violet-300")} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Cadastros
          </p>
          <ul className="space-y-0.5">
            {cadastros.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Atalhos rápidos</p>
          <Link
            href="/app/producao/os"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            Nova OS
          </Link>
        </div>
      </div>
    </aside>
  );
}
