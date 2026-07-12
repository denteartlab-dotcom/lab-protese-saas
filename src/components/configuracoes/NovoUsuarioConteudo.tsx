"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, Plus, UserCog } from "lucide-react";
import { PainelCarregando } from "@/components/ListaCarregando";
import { useI18n } from "@/components/i18n-provider";
import { carregarColaboradoresListagem } from "@/lib/colaboradores-listagem";
import {
  ROLES_USUARIO,
  rotuloTipoUsuario,
  type RoleUsuario,
} from "@/lib/usuarios-sistema";
import type { CotasUsuariosEmpresa } from "@/lib/limite-usuarios-empresa";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const inputClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";
const selectClass = inputClass;

const ROLES_NOVO = ROLES_USUARIO.filter((r) => r !== "proprietario");

type FormNovoUsuario = {
  name: string;
  email: string;
  moduloColaboradores: boolean;
  colaboradorId: string;
  colaboradorNome: string;
  role: RoleUsuario;
  permitirRetiradasCarteira: boolean;
  permitirAlterarChavePix: boolean;
  avatarDataUrl: string;
};

export function NovoUsuarioConteudo() {
  const { t } = useI18n();
  const router = useRouter();
  const inputImagemRef = useRef<HTMLInputElement>(null);
  const [verificando, setVerificando] = useState(true);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [cotas, setCotas] = useState<CotasUsuariosEmpresa | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState<FormNovoUsuario>({
    name: "",
    email: "",
    moduloColaboradores: false,
    colaboradorId: "",
    colaboradorNome: "",
    role: "usuario",
    permitirRetiradasCarteira: false,
    permitirAlterarChavePix: false,
    avatarDataUrl: "",
  });

  useEffect(() => {
    setColaboradores(
      carregarColaboradoresListagem().map((c) => ({ id: c.id, nome: c.nome }))
    );
    void (async () => {
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        if (me.ok) {
          const json = await me.json();
          if (json?.podeGerenciarUsuarios) {
            setPodeGerenciar(true);
            const lista = await fetch("/api/usuarios?excluidos=0", { cache: "no-store" });
            if (lista.ok) {
              const dados = await lista.json();
              setCotas(dados.cotas ?? null);
            }
            return;
          }
        }
        const lista = await fetch("/api/usuarios?excluidos=0", { cache: "no-store" });
        setPodeGerenciar(lista.ok);
        if (lista.ok) {
          const dados = await lista.json();
          setCotas(dados.cotas ?? null);
        }
      } catch {
        setPodeGerenciar(false);
      } finally {
        setVerificando(false);
      }
    })();
  }, []);

  function escolherImagem(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 400_000) {
      setErro(t("settings.imagemGrande", { kb: 400 }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      setForm((f) => ({ ...f, avatarDataUrl: url }));
      setErro("");
    };
    reader.readAsDataURL(file);
  }

  async function cadastrar() {
    if (!form.name.trim()) {
      setErro(t("settings.informeNome"));
      return;
    }
    if (!form.email.trim()) {
      setErro(t("settings.informeEmail"));
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          colaboradorId: form.colaboradorId || null,
          colaboradorNome: form.colaboradorNome || null,
          moduloProducao: form.moduloColaboradores,
          permissoes: {
            setores: [],
            permitirRetiradasCarteira: form.permitirRetiradasCarteira,
            permitirAlterarChavePix: form.permitirAlterarChavePix,
            ...(form.avatarDataUrl ? { avatarDataUrl: form.avatarDataUrl } : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || t("settings.erroCadastrarUsuario"));
        return;
      }
      const idNovo = data?.usuario?.id as string | undefined;
      if (idNovo) {
        router.push(`/app/configuracoes/usuarios/${idNovo}/editar`);
      } else {
        router.push("/app/configuracoes?aba=usuarios");
      }
      router.refresh();
    } catch {
      setErro(t("settings.erroConexaoCadastrar"));
    } finally {
      setSalvando(false);
    }
  }

  if (verificando) {
    return <PainelCarregando mensagem={t("common.carregando")} />;
  }

  if (!podeGerenciar) {
    return (
      <div className="py-16 text-center text-sm text-[#6b7280]">
        <p className="font-medium text-[#374151]">{t("settings.usuariosAcessoRestrito")}</p>
        <p className="mt-2">{t("settings.usuariosSomenteProprietarioCadastro")}</p>
        <Link
          href="/app/configuracoes?aba=usuarios"
          className="mt-4 inline-block text-[12px] text-[#4a90d9] hover:underline"
        >
          {t("settings.voltar")}
        </Link>
      </div>
    );
  }

  if (cotas && !cotas.podeAdicionar && !cotas.ilimitado) {
    return (
      <div className="novo-usuario text-[12px] text-[#374151]">
        <h1 className="text-[17px] font-normal text-slate-800">{t("settings.titulo")}</h1>
        <div className="mt-6 rounded-sm border border-[#f0ad4e] bg-[#fcf8e3] px-4 py-4 text-[12px] text-[#8a6d3b]">
          <p className="font-semibold">{t("settings.usuariosLimiteTitulo")}</p>
          <p className="mt-2">
            {t("settings.usuariosLimiteDescricao", {
              plano: cotas.planoLabel,
              limite: cotas.limite,
              total: cotas.total,
              s: cotas.limite === 1 ? "" : "s",
            })}
          </p>
          <Link
            href="/app/configuracoes?aba=usuarios"
            className="mt-4 inline-block text-[#4a90d9] hover:underline"
          >
            {t("settings.voltarMeusUsuarios")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="novo-usuario text-[12px] text-[#374151]">
      <h1 className="text-[17px] font-normal text-slate-800">{t("settings.titulo")}</h1>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-600">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-slate-600 hover:text-[#4a90d9]"
        >
          <Home className="h-3.5 w-3.5" />
        </Link>
        <span className="text-slate-500">›</span>
        <Link href="/app/configuracoes?aba=usuarios" className="hover:text-[#4a90d9]">
          {t("settings.titulo")}
        </Link>
        <span className="text-slate-500">›</span>
        <span>{t("settings.novoUsuario")}</span>
      </p>

      <div className="mt-4 rounded-sm bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
        <div className="mb-4 rounded-sm border border-[#f0ad4e] bg-[#fcf8e3] px-3 py-2.5 text-[12px] leading-snug text-[#8a6d3b]">
          <span className="font-semibold">{t("settings.obsAbrev")}</span> {t("settings.usuariosObsSenha")}
          {cotas && !cotas.ilimitado && cotas.restantes != null ? (
            <>
              {" "}
              {t("settings.usuariosPodeAdicionar", {
                n: cotas.restantes,
                plano: cotas.planoLabel,
                s: cotas.restantes === 1 ? "" : "s",
              })}
            </>
          ) : null}
        </div>

        <div className="mb-5 flex flex-wrap items-start gap-4">
          <div>
            <input
              ref={inputImagemRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => escolherImagem(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputImagemRef.current?.click()}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-sm bg-[#5cb85c] px-4 text-[12px] font-normal text-white hover:bg-[#4cae4c]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("settings.adicionarImagem")}
            </button>
            {form.avatarDataUrl ? (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.avatarDataUrl}
                  alt={t("settings.usuariosColAvatar")}
                  className="h-16 w-16 rounded-full border border-[#e5e7eb] object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t("settings.colNome")}</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>{t("settings.email")}</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>{t("settings.acessoModuloColaboradores")}</label>
            <select
              className={selectClass}
              value={form.moduloColaboradores ? "sim" : "nao"}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  moduloColaboradores: e.target.value === "sim",
                }))
              }
            >
              <option value="nao">{t("os.imprimir.nao")}</option>
              <option value="sim">{t("os.imprimir.sim")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("settings.funcionarioOpcional")}</label>
            <select
              className={selectClass}
              value={form.colaboradorId}
              onChange={(e) => {
                const id = e.target.value;
                const col = colaboradores.find((c) => c.id === id);
                setForm((f) => ({
                  ...f,
                  colaboradorId: id,
                  colaboradorNome: col?.nome || "",
                }));
              }}
            >
              <option value="">{t("settings.selecioneFuncionario")}</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("settings.usuariosColTipo")}</label>
            <select
              className={selectClass}
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as RoleUsuario }))
              }
            >
              {ROLES_NOVO.map((role) => (
                <option key={role} value={role}>
                  {rotuloTipoUsuario(role)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 border-t border-[#e5e7eb] pt-5">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#374151]">
            <UserCog className="h-4 w-4 text-[#6b7280]" />
            {t("settings.permissoesAdicionais")}
          </div>
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#374151]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded-sm border-[#d1d5db]"
                checked={form.permitirRetiradasCarteira}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    permitirRetiradasCarteira: e.target.checked,
                  }))
                }
              />
              {t("settings.permitirRetiradasCarteira")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#374151]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded-sm border-[#d1d5db]"
                checked={form.permitirAlterarChavePix}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    permitirAlterarChavePix: e.target.checked,
                  }))
                }
              />
              {t("settings.permitirAlterarChavePix")}
            </label>
          </div>
        </div>

        {erro ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={salvando}
            onClick={() => void cadastrar()}
            className="h-[34px] rounded-sm bg-[#4a90d9] px-5 text-[12px] font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-60"
          >
            {salvando ? t("settings.cadastrando") : t("settings.cadastrarUsuario")}
          </button>
          <Link
            href="/app/configuracoes?aba=usuarios"
            className="inline-flex h-[34px] items-center rounded-sm border border-[#d1d5db] bg-white px-5 text-[12px] font-normal text-[#374151] hover:bg-[#f9fafb]"
          >
            {t("settings.voltar")}
          </Link>
        </div>
      </div>
    </div>
  );
}
