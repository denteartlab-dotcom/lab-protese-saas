"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Eye, Home, Plus, Trash2, UserRound } from "lucide-react";
import {
  corTipoUsuario,
  rotuloTipoUsuario,
  usuarioEhProprietario,
  type UsuarioListagem,
} from "@/lib/usuarios-sistema";
import type { CotasUsuariosEmpresa } from "@/lib/limite-usuarios-empresa";
import { cn, exibirTexto } from "@/lib/utils";

const thClass =
  "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6b7280] dark:text-slate-400";
const tdClass = "px-3 py-2.5 align-middle text-[12px] text-[#374151] dark:text-slate-300";

export function MeusUsuariosTab() {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioListagem[]>([]);
  const [cotas, setCotas] = useState<CotasUsuariosEmpresa | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [erro, setErro] = useState("");

  const carregarUsuarios = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/usuarios?excluidos=${mostrarExcluidos ? "1" : "0"}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível carregar os usuários.");
        setUsuarios([]);
        setCotas(null);
        return;
      }
      setUsuarios(Array.isArray(data.usuarios) ? data.usuarios : []);
      setCotas(data.cotas ?? null);
    } catch {
      setErro("Erro de conexão ao carregar usuários.");
      setUsuarios([]);
    } finally {
      setCarregando(false);
    }
  }, [mostrarExcluidos]);

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        if (me.ok) {
          const json = await me.json();
          if (json?.podeGerenciarUsuarios) {
            setPodeGerenciar(true);
            return;
          }
        }
        const lista = await fetch("/api/usuarios?excluidos=0", { cache: "no-store" });
        setPodeGerenciar(lista.ok);
      } catch {
        setPodeGerenciar(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (podeGerenciar) void carregarUsuarios();
    else setCarregando(false);
  }, [podeGerenciar, carregarUsuarios]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter((u) =>
      [u.name, u.email, u.colaboradorNome || "", rotuloTipoUsuario(u.role)]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, usuarios]);

  async function excluir(usuario: UsuarioListagem) {
    if (!window.confirm(`Excluir o usuário ${usuario.name}?`)) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível excluir.");
        return;
      }
      await carregarUsuarios();
    } finally {
      setSalvando(false);
    }
  }

  async function restaurar(usuario: UsuarioListagem) {
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurar: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível restaurar o usuário.");
        return;
      }
      await carregarUsuarios();
    } finally {
      setSalvando(false);
    }
  }

  const textoCotas = cotas
    ? cotas.ilimitado
      ? `${cotas.total} usuários · plano ${cotas.planoLabel} (ilimitado)`
      : `${cotas.total} / ${cotas.limite} usuários · plano ${cotas.planoLabel}${
          cotas.restantes != null && cotas.restantes > 0
            ? ` · pode adicionar mais ${cotas.restantes}`
            : ""
        }`
    : null;

  if (!podeGerenciar) {
    return (
      <div className="py-16 text-center text-sm text-[#6b7280]">
        <p className="font-medium text-[#374151]">Acesso restrito</p>
        <p className="mt-2">Somente o proprietário pode gerenciar usuários do sistema.</p>
      </div>
    );
  }

  return (
    <div className="meus-usuarios text-[12px] text-[#374151]">
      <p className="mb-3 flex flex-wrap items-center gap-1 text-xs text-[#6b7280]">
        <Home className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#374151]">Configurações</span>
        <span className="text-[#d1d5db]">›</span>
        <span>Meus Usuários</span>
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {cotas?.podeAdicionar ? (
            <Link
              href="/app/configuracoes/usuarios/novo"
              className="inline-flex h-[34px] items-center gap-1.5 rounded-sm bg-[#5cb85c] px-4 text-[12px] font-normal text-white hover:bg-[#4cae4c]"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Usuário
            </Link>
          ) : (
            <span
              title="Limite de usuários do plano atingido"
              className="inline-flex h-[34px] cursor-not-allowed items-center gap-1.5 rounded-sm bg-[#9ca3af] px-4 text-[12px] font-normal text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Usuário
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setMostrarExcluidos((v) => !v);
              setBusca("");
            }}
            className={cn(
              "inline-flex h-[34px] items-center gap-1.5 rounded-sm border px-4 text-[12px]",
              mostrarExcluidos
                ? "border-[#4a90d9] bg-[#4a90d9] text-white"
                : "border-[#4a90d9] bg-white text-[#4a90d9] hover:bg-[#f0f7ff]"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {mostrarExcluidos ? "Ver Ativos" : "Ver Excluídos"}
          </button>
        </div>

        {textoCotas ? (
          <p className="w-full text-[11px] text-[#6b7280] sm:w-auto">{textoCotas}</p>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Procurar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-[34px] w-[200px] rounded-sm border border-[#d1d5db] bg-white px-3 text-[12px] outline-none focus:border-[#4a90d9] sm:w-[240px]"
          />
          <button
            type="button"
            onClick={() => setBusca("")}
            className="h-[34px] rounded-sm border border-[#d1d5db] bg-white px-3 text-[12px] text-[#374151] hover:bg-[#f9fafb]"
          >
            Limpar
          </button>
        </div>
      </div>

      {erro ? (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {erro}
        </p>
      ) : null}

      {cotas && !cotas.podeAdicionar && !cotas.ilimitado ? (
        <p className="mb-3 rounded-sm border border-[#f0ad4e] bg-[#fcf8e3] px-3 py-2 text-[12px] text-[#8a6d3b]">
          Limite do plano {cotas.planoLabel} atingido ({cotas.limite} usuário
          {cotas.limite === 1 ? "" : "s"}). Faça upgrade para adicionar mais usuários.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-sm border border-[#e5e7eb] bg-white">
        {carregando ? (
          <div className="px-3 py-10 text-center text-sm text-slate-400">
            Carregando usuários...
          </div>
        ) : (
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                <th className={cn(thClass, "w-[72px]")}>Avatar</th>
                <th className={thClass}>Nome</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>Funcionário</th>
                <th className={thClass}>Tipo Usuário</th>
                <th className={cn(thClass, "text-center")}>Módulo Produção</th>
                <th className={cn(thClass, "w-[80px] text-center")}>Opções</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#9ca3af]">
                    {mostrarExcluidos
                      ? "Nenhum usuário excluído."
                      : "Nenhum usuário encontrado."}
                  </td>
                </tr>
              ) : (
                filtrados.map((usuario) => (
                  <tr
                    key={usuario.id}
                    className="border-b border-[#f3f4f6] last:border-b-0 hover:bg-[#fafafa]"
                  >
                    <td className={tdClass}>
                      <div className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#e5e7eb] text-[#9ca3af]">
                        {usuario.permissoes.avatarDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={usuario.permissoes.avatarDataUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound className="h-5 w-5" />
                        )}
                      </div>
                    </td>
                    <td className={cn(tdClass, "font-medium")}>{usuario.name}</td>
                    <td className={tdClass}>{usuario.email}</td>
                    <td className={tdClass}>{exibirTexto(usuario.colaboradorNome)}</td>
                    <td className={cn(tdClass, "font-medium", corTipoUsuario(usuario.role))}>
                      {rotuloTipoUsuario(usuario.role)}
                    </td>
                    <td
                      className={cn(
                        tdClass,
                        "text-center font-medium",
                        usuario.moduloProducao ? "text-[#16a34a]" : "text-[#ef4444]"
                      )}
                    >
                      {usuario.moduloProducao ? "Sim" : "Não"}
                    </td>
                    <td className={cn(tdClass, "text-center")}>
                      {mostrarExcluidos ? (
                        cotas?.podeAdicionar ? (
                          <button
                            type="button"
                            title="Restaurar"
                            onClick={() => void restaurar(usuario)}
                            className="text-[11px] text-[#4a90d9] hover:underline"
                          >
                            Restaurar
                          </button>
                        ) : (
                          <span
                            title="Limite de usuários do plano atingido"
                            className="cursor-not-allowed text-[11px] text-[#9ca3af]"
                          >
                            Restaurar
                          </span>
                        )
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/app/configuracoes/usuarios/${usuario.id}/editar`}
                            title="Editar"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Link>
                          {!usuarioEhProprietario(usuario.role) ? (
                            <button
                              type="button"
                              title="Excluir"
                              disabled={salvando}
                              onClick={() => void excluir(usuario)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#6b7280] hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
