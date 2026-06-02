"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home } from "lucide-react";
import { Button } from "@/components/ui";
import { usePermissoesApp } from "@/components/PermissoesAppProvider";
import {
  DadosLaboratorioForm,
  type TipoMensagemForm,
} from "@/components/DadosLaboratorioForm";
import { HorarioFuncionamentoTab } from "@/components/HorarioFuncionamentoTab";
import { IdiomaLaboratorioTab } from "@/components/IdiomaLaboratorioTab";
import { ConfiguracoesBoletosTab } from "@/components/ConfiguracoesBoletosTab";
import { ConfiguracoesNfseTab } from "@/components/ConfiguracoesNfseTab";
import { MeusUsuariosTab } from "@/components/configuracoes/MeusUsuariosTab";
import { BackupLaboratorioTab } from "@/components/configuracoes/BackupLaboratorioTab";
import { LogoLaboratorioTab } from "@/components/LogoLaboratorioTab";
import { useI18n } from "@/components/i18n-provider";
import {
  carregarConfigLaboratorio,
  normalizarTipoPessoa,
  salvarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { persistirConfigLaboratorioServidor } from "@/lib/lab-config-sync";
import type { MessageKey } from "@/lib/i18n";
import { normalizarLogoTamanho } from "@/lib/lab-impressao";

const abasPagina: Array<{ id: string; labelKey: MessageKey; href?: string }> = [
  { id: "dados", labelKey: "settings.dadosLab" },
  { id: "cabecalho", labelKey: "settings.cabecalho", href: "/app/configuracoes/cabecalho" },
  { id: "logo", labelKey: "settings.logo" },
  { id: "idioma", labelKey: "settings.idioma" },
  { id: "horario", labelKey: "settings.horario" },
  { id: "nfse", labelKey: "settings.nfse" },
  { id: "boletos", labelKey: "settings.boletos" },
  { id: "gerais", labelKey: "settings.gerais" },
  { id: "mensagens", labelKey: "settings.mensagens" },
  { id: "os", labelKey: "settings.os" },
  { id: "faturas", labelKey: "settings.faturas" },
  { id: "etiquetas", labelKey: "settings.etiquetas" },
  { id: "usuarios", labelKey: "settings.usuarios" },
  { id: "backup", labelKey: "settings.backup" },
];

const abaPermissaoId: Record<string, string> = {
  dados: "configuracoes-dados",
  cabecalho: "configuracoes-cabecalho",
  logo: "configuracoes-logo",
  idioma: "configuracoes-idioma",
  horario: "configuracoes-horario",
  nfse: "configuracoes-nfse",
  boletos: "configuracoes-boletos",
  gerais: "configuracoes-gerais",
  mensagens: "configuracoes-mensagens",
  os: "configuracoes-os",
  faturas: "configuracoes-faturas",
  etiquetas: "configuracoes-etiquetas",
  usuarios: "configuracoes-usuarios",
  backup: "configuracoes-backup",
};

const titulosAbaKeys: Record<string, MessageKey> = {
  dados: "settings.dadosLabTitulo",
  logo: "settings.logo",
  idioma: "settings.idioma",
  horario: "settings.horario",
  nfse: "settings.nfse",
  cabecalho: "settings.cabecalho",
  gerais: "settings.gerais",
  boletos: "settings.boletos",
  mensagens: "settings.mensagens",
  os: "settings.os",
  faturas: "settings.faturas",
  etiquetas: "settings.etiquetas",
  usuarios: "settings.usuarios",
  migrar: "settings.migrar",
  integracoes: "settings.integracoes",
  backup: "settings.backupTitulo",
};

function ConfiguracoesConteudo() {
  const { t } = useI18n();
  const { acessoTotal, permissoesModulos } = usePermissoesApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const aba = searchParams.get("aba") || "dados";
  const titulo = titulosAbaKeys[aba] ? t(titulosAbaKeys[aba]) : t("settings.titulo");
  const abasPermitidas = abasPagina.filter((item) => {
    if (acessoTotal) return true;
    const permissaoId = abaPermissaoId[item.id];
    if (!permissaoId) return true;
    return permissoesModulos?.[permissaoId]?.ver !== false;
  });
  const abaNaPagina = abasPermitidas.some((item) => item.id === aba);

  const [form, setForm] = useState<ConfigLaboratorio | null>(null);
  const [inicial, setInicial] = useState<ConfigLaboratorio | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [mensagemTipo, setMensagemTipo] = useState<TipoMensagemForm>("info");

  useEffect(() => {
    if (aba === "cabecalho") {
      router.replace("/app/configuracoes/cabecalho");
      return;
    }
    if (!abasPermitidas.length) return;
    if (abasPermitidas.some((item) => item.id === aba)) return;
    router.replace(`/app/configuracoes?aba=${abasPermitidas[0].id}`);
  }, [aba, abasPermitidas, router]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      await import("@/lib/lab-config-sync").then((m) =>
        m.sincronizarConfigLaboratorioDoServidor()
      );
      if (!ativo) return;
      const carregado = carregarConfigLaboratorio();
      const tipo = normalizarTipoPessoa(carregado.tipoPessoa);
      const normalizado =
        carregado.tipoPessoa === tipo
          ? carregado
          : { ...carregado, tipoPessoa: tipo };
      setForm(normalizado);
      setInicial(normalizado);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    salvarConfigLaboratorio(form);
    try {
      await persistirConfigLaboratorioServidor(form);
      setInicial({ ...form });
      setMensagem(t("common.sucessoGravado"));
      setMensagemTipo("sucesso");
    } catch {
      setMensagem(
        "Salvo neste navegador, mas não foi possível gravar no servidor. Tente novamente."
      );
      setMensagemTipo("erro");
    } finally {
      setSalvando(false);
      window.setTimeout(() => setMensagem(""), 4000);
    }
  }

  function cancelar() {
    if (inicial) {
      setForm({ ...inicial });
      setMensagem("");
      setMensagemTipo("info");
    } else router.push("/app");
  }

  if (!form) {
    return <p className="p-6 text-sm text-slate-500">{t("common.carregando")}</p>;
  }

  const atualizarForm: React.Dispatch<React.SetStateAction<ConfigLaboratorio>> = (
    action
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      return typeof action === "function" ? action(prev) : action;
    });
  };

  return (
    <div className="min-h-full bg-[#e8eaed] pb-8">
      <div className="mx-auto max-w-[1100px] px-4 pt-4 md:px-6 md:pt-5">
        <h1 className="text-[17px] font-normal text-slate-800">{t("settings.titulo")}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-600">
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-[#4a90d9]"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
          <span className="text-slate-500">›</span>
          <span>{titulo}</span>
        </p>

        <div className="mt-3 flex flex-wrap gap-0">
          {abasPermitidas.map((item) => {
            const ativa = aba === item.id;
            const href = item.href ?? `/app/configuracoes?aba=${item.id}`;
            return (
              <Link
                key={item.id}
                href={href}
                className={`rounded-t px-3 py-2 text-[13px] font-normal transition ${
                  ativa
                    ? "bg-[#4a90d9] text-white"
                    : "bg-[#d8dce3] text-slate-700 hover:bg-[#cdd2db]"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>

        <div className="rounded-b rounded-tr bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
          {aba === "dados" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                salvar();
              }}
            >
              <DadosLaboratorioForm
                form={form}
                setForm={atualizarForm}
                onMensagem={(texto, tipo = "info") => {
                  setMensagem(texto);
                  setMensagemTipo(tipo);
                }}
              />
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={salvando}
                  className="rounded bg-[#4a90d9] px-5 py-2 text-sm font-normal text-white hover:bg-[#3d7fc4]"
                >
                  {salvando ? t("common.gravando") : t("common.gravarAlteracoes")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelar}
                  className="rounded border-slate-300 bg-white px-5 py-2 text-sm font-normal text-slate-700 hover:bg-slate-50"
                >
                  {t("common.cancelar")}
                </Button>
                {mensagem ? (
                  <span
                    role="alert"
                    className={`text-sm font-medium ${
                      mensagemTipo === "sucesso"
                        ? "text-emerald-600"
                        : mensagemTipo === "erro"
                          ? "text-red-600"
                          : "text-slate-600"
                    }`}
                  >
                    {mensagem}
                  </span>
                ) : null}
              </div>
            </form>
          ) : aba === "logo" ? (
            <LogoLaboratorioTab
              logoDataUrl={form.logoDataUrl || ""}
              logoTamanho={normalizarLogoTamanho(form.logoTamanho)}
              mensagem={mensagem}
              mensagemTipo={mensagemTipo}
              onChange={(patch) => {
                const novo = { ...form, ...patch };
                setForm(novo);
              }}
              onSalvar={async (patch) => {
                if (!form) return;
                const merged = { ...form, ...patch };
                setForm(merged);
                salvarConfigLaboratorio(merged);
                try {
                  await persistirConfigLaboratorioServidor(merged);
                  setInicial(merged);
                  window.dispatchEvent(new Event("lab-config-atualizada"));
                } catch {
                  setMensagem(
                    "Imagem salva neste navegador, mas falhou ao gravar no servidor. Clique em Gravar Imagem novamente."
                  );
                  setMensagemTipo("erro");
                }
              }}
              onMensagem={(texto, tipo = "info") => {
                setMensagem(texto);
                setMensagemTipo(tipo);
                if (tipo === "sucesso" || tipo === "info") {
                  window.setTimeout(() => setMensagem(""), 4000);
                }
              }}
            />
          ) : aba === "idioma" ? (
            <IdiomaLaboratorioTab
              form={form}
              onChange={(patch) => setForm((prev) => (prev ? { ...prev, ...patch } : prev))}
              onSalvar={salvar}
              salvando={salvando}
              mensagem={mensagem}
              mensagemTipo={mensagemTipo}
            />
          ) : aba === "nfse" ? (
            <ConfiguracoesNfseTab
              onMensagem={(texto, tipo = "info") => {
                setMensagem(texto);
                setMensagemTipo(tipo);
                if (tipo === "sucesso" || tipo === "info") {
                  window.setTimeout(() => setMensagem(""), 5000);
                }
              }}
            />
          ) : aba === "boletos" ? (
            <ConfiguracoesBoletosTab
              onMensagem={(texto, tipo = "info") => {
                setMensagem(texto);
                setMensagemTipo(tipo);
                if (tipo === "sucesso" || tipo === "info") {
                  window.setTimeout(() => setMensagem(""), 5000);
                }
              }}
            />
          ) : aba === "horario" ? (
            <>
              <HorarioFuncionamentoTab
                onMensagem={(texto, tipo = "info") => {
                  setMensagem(texto);
                  setMensagemTipo(tipo);
                  if (tipo === "sucesso" || tipo === "info") {
                    window.setTimeout(() => setMensagem(""), 4000);
                  }
                }}
              />
              {mensagem ? (
                <p
                  role="alert"
                  className={`mt-4 text-sm font-medium ${
                    mensagemTipo === "sucesso"
                      ? "text-emerald-600"
                      : mensagemTipo === "erro"
                        ? "text-red-600"
                        : "text-slate-600"
                  }`}
                >
                  {mensagem}
                </p>
              ) : null}
            </>
          ) : aba === "usuarios" ? (
            <MeusUsuariosTab />
          ) : aba === "backup" ? (
            <BackupLaboratorioTab
              onMensagem={(texto, tipo = "info") => {
                setMensagem(texto);
                setMensagemTipo(tipo);
                if (tipo === "sucesso" || tipo === "info") {
                  window.setTimeout(() => setMensagem(""), 6000);
                }
              }}
            />
          ) : abaNaPagina ? (
            <div className="py-16 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700">{titulo}</p>
              <p className="mt-2">{t("settings.emBreve")}</p>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700">{titulo}</p>
              <p className="mt-2">{t("settings.emBreveSecao")}</p>
              <Link
                href="/app/configuracoes?aba=dados"
                className="mt-4 inline-block text-xs font-medium text-[#4a90d9] hover:underline"
              >
                {t("settings.irDados")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">…</p>}>
      <ConfiguracoesConteudo />
    </Suspense>
  );
}
