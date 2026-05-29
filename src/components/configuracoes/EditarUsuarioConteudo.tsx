"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Home } from "lucide-react";
import { GradePermissoesUsuario } from "@/components/configuracoes/GradePermissoesUsuario";
import { carregarSetoresCadastro } from "@/lib/setores-cadastro";
import {
  mesclarModulosPermissoes,
  normalizarPermissoesCompletas,
} from "@/lib/usuarios-menu-permissoes";
import {
  ROLES_USUARIO,
  rotuloTipoUsuario,
  type PermissaoCrud,
  type PermissoesUsuario,
  type RoleUsuario,
  type UsuarioListagem,
} from "@/lib/usuarios-sistema";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const inputClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";
const selectClass = inputClass;

type AbaEdicao = "informacoes" | "senha";

export function EditarUsuarioConteudo() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<AbaEdicao>("informacoes");
  const [usuario, setUsuario] = useState<UsuarioListagem | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");
  const [situacao, setSituacao] = useState<"ativo" | "inativo">("ativo");
  const [role, setRole] = useState<RoleUsuario>("usuario");
  const [moduloProducao, setModuloProducao] = useState(false);
  const [colaboradorId, setColaboradorId] = useState("");
  const [colaboradorNome, setColaboradorNome] = useState("");
  const [modulos, setModulos] = useState<Record<string, PermissaoCrud>>({});
  const [permitirAlterarSenha, setPermitirAlterarSenha] = useState(true);
  const [acessoMobile, setAcessoMobile] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [setores, setSetores] = useState<{ nome: string }[]>([]);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/usuarios/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Usuário não encontrado.");
        setUsuario(null);
        return;
      }
      const u = data.usuario as UsuarioListagem;
      setUsuario(u);
      setName(u.name);
      setEmail(u.email);
      setSetor(u.permissoes.setores[0] || "");
      setSituacao(u.permissoes.situacao === "inativo" ? "inativo" : "ativo");
      setRole(
        (ROLES_USUARIO.includes(u.role as RoleUsuario) ? u.role : "usuario") as RoleUsuario
      );
      setModuloProducao(u.moduloProducao);
      setColaboradorId(u.colaboradorId || "");
      setColaboradorNome(u.colaboradorNome || "");
      setPermitirAlterarSenha(u.permissoes.permitirAlterarSenha !== false);
      setAcessoMobile(Boolean(u.permissoes.acessoMobile));
      const perm = normalizarPermissoesCompletas(u.permissoes, u.role);
      setModulos(mesclarModulosPermissoes(perm.modulos));
    } catch {
      setErro("Erro ao carregar usuário.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    setSetores(carregarSetoresCadastro().map((s) => ({ nome: s.nome })));
    void carregar();
  }, [carregar]);

  function montarPermissoes(): PermissoesUsuario {
    return normalizarPermissoesCompletas(
      {
        setores: setor.trim() ? [setor.trim()] : [],
        modulos,
        situacao,
        permitirAlterarSenha,
        acessoMobile,
        permitirRetiradasCarteira: usuario?.permissoes.permitirRetiradasCarteira,
        permitirAlterarChavePix: usuario?.permissoes.permitirAlterarChavePix,
        avatarDataUrl: usuario?.permissoes.avatarDataUrl,
      },
      role
    );
  }

  async function atualizar() {
    if (!usuario) return;
    if (aba === "senha" && novaSenha && novaSenha !== confirmarSenha) {
      setErro("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        role,
        colaboradorId: colaboradorId || null,
        colaboradorNome: colaboradorNome || null,
        moduloProducao,
        permissoes: montarPermissoes(),
      };
      if (aba === "senha" && novaSenha.trim().length >= 6) {
        payload.password = novaSenha.trim();
      }

      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível atualizar.");
        return;
      }
      router.push("/app/configuracoes?aba=usuarios");
      router.refresh();
    } catch {
      setErro("Erro de conexão ao atualizar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="rounded-sm bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
        Carregando usuário...
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="py-16 text-center text-sm text-[#6b7280]">
        <p className="font-medium text-[#374151]">{erro || "Usuário não encontrado."}</p>
        <Link
          href="/app/configuracoes?aba=usuarios"
          className="mt-4 inline-block text-[12px] text-[#4a90d9] hover:underline"
        >
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="editar-usuario text-[12px] text-[#374151]">
      <h1 className="text-[17px] font-normal text-slate-800">Configurações</h1>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-600">
        <Link href="/app" className="inline-flex items-center text-slate-600 hover:text-[#4a90d9]">
          <Home className="h-3.5 w-3.5" />
        </Link>
        <span className="text-slate-500">›</span>
        <Link href="/app/configuracoes?aba=usuarios" className="hover:text-[#4a90d9]">
          Configurações
        </Link>
        <span className="text-slate-500">›</span>
        <span>Editar Usuário</span>
      </p>

      <div className="mt-4 rounded-sm bg-white shadow-sm">
        <div className="flex border-b border-[#e5e7eb]">
          <button
            type="button"
            onClick={() => setAba("informacoes")}
            className={cn(
              "px-5 py-2.5 text-[12px] font-medium transition",
              aba === "informacoes"
                ? "bg-[#5cb85c] text-white"
                : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]"
            )}
          >
            Informações
          </button>
          <button
            type="button"
            onClick={() => setAba("senha")}
            className={cn(
              "px-5 py-2.5 text-[12px] font-medium transition",
              aba === "senha"
                ? "bg-[#4a90d9] text-white"
                : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]"
            )}
          >
            Senha
          </button>
        </div>

        <div className="p-5 md:p-6">
          {aba === "informacoes" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome</label>
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Setor</label>
                  <select
                    className={selectClass}
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {setores.map((s) => (
                      <option key={s.nome} value={s.nome}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Situação</label>
                  <select
                    className={selectClass}
                    value={situacao}
                    onChange={(e) =>
                      setSituacao(e.target.value === "inativo" ? "inativo" : "ativo")
                    }
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tipo Usuário</label>
                  <select
                    className={selectClass}
                    value={role}
                    onChange={(e) => setRole(e.target.value as RoleUsuario)}
                  >
                    {ROLES_USUARIO.map((r) => (
                      <option key={r} value={r}>
                        {rotuloTipoUsuario(r)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <GradePermissoesUsuario
                  modulos={modulos}
                  onChange={setModulos}
                />
              </div>

              <div className="mt-5 space-y-2 border-t border-[#e5e7eb] pt-4">
                <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded-sm border-[#d1d5db] accent-[#4a90d9]"
                    checked={permitirAlterarSenha}
                    onChange={(e) => setPermitirAlterarSenha(e.target.checked)}
                  />
                  Permitir Alteração de Senha
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded-sm border-[#d1d5db] accent-[#4a90d9]"
                    checked={acessoMobile}
                    onChange={(e) => setAcessoMobile(e.target.checked)}
                  />
                  Acesso Mobile
                </label>
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-md space-y-4">
              <div>
                <label className={labelClass}>Nova senha</label>
                <input
                  type="password"
                  className={inputClass}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className={labelClass}>Confirmar nova senha</label>
                <input
                  type="password"
                  className={inputClass}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <p className="text-[11px] text-[#9ca3af]">
                Deixe em branco para manter a senha atual. Mínimo de 6 caracteres.
              </p>
            </div>
          )}

          {erro ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {erro}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void atualizar()}
              className="h-[36px] rounded-sm bg-[#4a90d9] px-6 text-[12px] font-semibold uppercase tracking-wide text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              {salvando ? "Atualizando..." : "Atualizar"}
            </button>
            <Link
              href="/app/configuracoes?aba=usuarios"
              className="inline-flex h-[36px] items-center rounded-sm border border-[#d1d5db] bg-[#f3f4f6] px-5 text-[12px] font-semibold uppercase tracking-wide text-[#374151] hover:bg-[#e5e7eb]"
            >
              Fechar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
