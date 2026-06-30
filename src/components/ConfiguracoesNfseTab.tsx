"use client";

import { useEffect, useState } from "react";
import { Button, SelectPesquisavel } from "@/components/ui";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";
import {
  carregarConfigLaboratorio,
  nomeExibicaoLaboratorio,
  normalizarTipoPessoa,
} from "@/lib/configuracoes-lab";
import { prepararAbaPdf, visualizarPdfUrl } from "@/lib/pdf-viewer";

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:ring-primary-500";

type ClienteOpt = { id: string; nome: string; cnpjCpf?: string | null };

type NotaHistorico = {
  id: string;
  valor: number;
  descricao: string;
  status: string;
  numeroNfse?: string | null;
  codigoVerificacao?: string | null;
  pdfUrl?: string | null;
  mensagemErro?: string | null;
  createdAt: string;
  cliente?: { nome: string } | null;
};

type Props = {
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
};

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ConfiguracoesNfseTab({ onMensagem }: Props) {
  const lab = carregarConfigLaboratorio();
  const ehFisica = normalizarTipoPessoa(lab.tipoPessoa) === "Física";
  const docLab = ehFisica ? lab.cpf : lab.cnpj;

  const [provedor, setProvedor] = useState<"plugnotas" | "nuvemfiscal">("plugnotas");
  const [ambiente, setAmbiente] = useState<"homologacao" | "producao">("homologacao");
  const [apiKey, setApiKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [credenciaisOk, setCredenciaisOk] = useState(false);
  const [codigoNacional, setCodigoNacional] = useState("041201");
  const [codigoMunicipal, setCodigoMunicipal] = useState("");
  const [aliquotaIss, setAliquotaIss] = useState("2");
  const [descricaoPadrao, setDescricaoPadrao] = useState("Serviços de prótese dentária");
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [historico, setHistorico] = useState<NotaHistorico[]>([]);

  async function carregarHistorico() {
    const res = await fetch("/api/nfse/historico", { cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) setHistorico(data);
  }

  useEffect(() => {
    void fetch("/api/nfse/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.provedor) setProvedor(data.config.provedor);
        if (data.config?.ambiente) setAmbiente(data.config.ambiente);
        setCredenciaisOk(Boolean(data.config?.credenciaisConfiguradas));
        setCodigoNacional(data.config?.codigoServicoNacional || "041201");
        setCodigoMunicipal(data.config?.codigoServicoMunicipal || "");
        setAliquotaIss(String(data.config?.aliquotaIss ?? 2));
        setDescricaoPadrao(
          data.config?.descricaoServicoPadrao || "Serviços de prótese dentária"
        );
      });
    void fetch("/api/clientes", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClientes(data);
      });
    void carregarHistorico();
  }, []);

  async function salvarConfig() {
    setSalvandoConfig(true);
    try {
      const res = await fetch("/api/nfse/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provedor,
          ambiente,
          apiKey: apiKey.trim() || undefined,
          manterApiKey: provedor === "plugnotas" && !apiKey.trim() && credenciaisOk,
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
          manterSecret:
            provedor === "nuvemfiscal" && !clientSecret.trim() && credenciaisOk,
          codigoServicoNacional: codigoNacional,
          codigoServicoMunicipal: codigoMunicipal,
          aliquotaIss: Number(aliquotaIss.replace(",", ".")) || 0,
          descricaoServicoPadrao: descricaoPadrao,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setApiKey("");
      setClientId("");
      setClientSecret("");
      setCredenciaisOk(true);
      onMensagem?.("Configuração de NFS-e salva.", "sucesso");
    } catch {
      onMensagem?.("Não foi possível salvar a configuração.", "erro");
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function emitirNota() {
    const valorNum = Number(
      valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
    );
    if (!clienteId || !valorNum || valorNum <= 0) {
      onMensagem?.("Selecione o cliente e informe o valor.", "erro");
      return;
    }
    setEmitindo(true);
    const janela = prepararAbaPdf();
    try {
      const res = await fetch("/api/nfse/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          valor: valorNum,
          descricao: descricao.trim() || descricaoPadrao,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Falha ao emitir nota."
        );
      }
      if (data.status === "erro") {
        onMensagem?.(data.mensagemErro || "Nota rejeitada.", "erro");
      } else {
        onMensagem?.(
          provedor === "plugnotas"
            ? "NFS-e enviada à prefeitura (via PlugNotas)."
            : "NFS-e enviada à prefeitura (via Nuvem Fiscal).",
          "sucesso"
        );
        if (data.pdfUrl) {
          visualizarPdfUrl(data.pdfUrl, "nfse.pdf", "NFS-e", {
            revogarAoFechar: false,
            janela,
          });
        } else {
          janela?.close();
        }
        setValor("");
        setDescricao("");
      }
      void carregarHistorico();
    } catch (e) {
      janela?.close();
      onMensagem?.(e instanceof Error ? e.message : "Erro ao emitir.", "erro");
    } finally {
      setEmitindo(false);
    }
  }

  const labOk =
    docLab.replace(/\D/g, "").length >= 11 &&
    lab.codMunicipio.replace(/\D/g, "").length === 7 &&
    lab.inscricaoMunicipal?.trim();

  return (
    <div className="space-y-8 text-sm">
      <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-[12px] text-slate-700">
        <p className="font-semibold text-slate-800">Emissão na prefeitura do seu município</p>
        <p className="mt-1">
          O sistema envia a NFS-e por um <strong>provedor fiscal</strong> (recomendado:{" "}
          <strong>PlugNotas</strong>), que se comunica com a prefeitura ou o Sistema Nacional NFS-e.
          Não é login direto no site da prefeitura — é API, como a maioria dos ERPs usa. CNPJ,
          inscrição municipal e código IBGE vêm de{" "}
          <a href="/app/configuracoes?aba=dados" className="text-[#4a90d9] underline">
            Dados do laboratório
          </a>
          . A Nuvem Fiscal anunciou encerramento; use PlugNotas para novas integrações.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Prestador (laboratório)</h3>
        <ul className="grid gap-1 text-[12px] text-slate-600 sm:grid-cols-2">
          <li>
            <strong>Nome:</strong> {nomeExibicaoLaboratorio(lab)}
          </li>
          <li>
            <strong>{ehFisica ? "CPF" : "CNPJ"}:</strong> {docLab || "—"}
          </li>
          <li>
            <strong>Inscrição municipal:</strong> {lab.inscricaoMunicipal || "—"}
          </li>
          <li>
            <strong>Cód. município (IBGE):</strong> {lab.codMunicipio || "—"}
          </li>
          <li>
            <strong>Cidade:</strong> {lab.cidade}/{lab.uf}
          </li>
        </ul>
        {!labOk ? (
          <p className="mt-2 text-[11px] font-medium text-amber-800">
            Complete CNPJ/CPF, inscrição municipal e CEP (para código IBGE) em Dados do laboratório.
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Provedor de emissão</h3>
        <div className="grid max-w-xl gap-3">
          <div>
            <label className={labelClass}>Provedor</label>
            <select
              value={provedor}
              onChange={(e) =>
                setProvedor(e.target.value === "nuvemfiscal" ? "nuvemfiscal" : "plugnotas")
              }
              className={inputClass}
            >
              <option value="plugnotas">PlugNotas (TecnoSpeed) — recomendado</option>
              <option value="nuvemfiscal">Nuvem Fiscal (legado)</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-500">
            {provedor === "plugnotas" ? (
              <>
                Conta em{" "}
                <a
                  href="https://plugnotas.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4a90d9] underline"
                >
                  plugnotas.com.br
                </a>
                : cadastre o CNPJ do laboratório, certificado A1 (produção) e use o token API
                (x-api-key) no painel.
              </>
            ) : (
              <>
                Conta em{" "}
                <a
                  href="https://www.nuvemfiscal.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4a90d9] underline"
                >
                  nuvemfiscal.com.br
                </a>{" "}
                (serviço em descontinuação). Client ID e Secret OAuth.
              </>
            )}
          </p>
          <div>
            <label className={labelClass}>Ambiente</label>
            <select
              value={ambiente}
              onChange={(e) =>
                setAmbiente(e.target.value === "producao" ? "producao" : "homologacao")
              }
              className={inputClass}
            >
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
          {provedor === "plugnotas" ? (
            <div>
              <label className={labelClass}>Token API (x-api-key)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClass}
                placeholder={credenciaisOk ? "Deixe em branco para manter" : ""}
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Client ID</label>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={inputClass}
                  placeholder={credenciaisOk ? "Deixe em branco para manter" : ""}
                />
              </div>
              <div>
                <label className={labelClass}>Client Secret</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className={inputClass}
                  placeholder={credenciaisOk ? "Deixe em branco para manter" : ""}
                />
              </div>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Cód. serviço nacional</label>
              <input
                value={codigoNacional}
                onChange={(e) => setCodigoNacional(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cód. serviço municipal</label>
              <input
                value={codigoMunicipal}
                onChange={(e) => setCodigoMunicipal(e.target.value)}
                className={inputClass}
                placeholder="Lista da prefeitura"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Alíquota ISS (%)</label>
              <input
                value={aliquotaIss}
                onChange={(e) => setAliquotaIss(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Descrição padrão do serviço</label>
              <input
                value={descricaoPadrao}
                onChange={(e) => setDescricaoPadrao(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <Button type="button" onClick={() => void salvarConfig()} disabled={salvandoConfig}>
            {salvandoConfig ? "Salvando…" : "Gravar configuração NFS-e"}
          </Button>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <h3 className="text-sm font-semibold text-slate-800">Emitir nota fiscal</h3>
        <div className="grid max-w-xl gap-3">
          <div>
            <SelectPesquisavel
              label="Cliente (tomador)"
              value={clienteId}
              onChange={setClienteId}
              placeholder="Selecione"
              inputClassName={inputClass}
              options={clientes.map((c) => ({
                value: c.id,
                label: c.cnpjCpf ? `${c.nome} — ${c.cnpjCpf}` : c.nome,
              }))}
            />
          </div>
          <div>
            <label className={labelClass}>Valor do serviço (R$)</label>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputClass}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className={labelClass}>Descrição (opcional)</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={inputClass}
              placeholder={descricaoPadrao}
            />
          </div>
          <Button
            type="button"
            onClick={() => void emitirNota()}
            disabled={emitindo || !labOk || !credenciaisOk}
          >
            {emitindo ? "Emitindo…" : "Emitir NFS-e"}
          </Button>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <h3 className="text-sm font-semibold text-slate-800">Últimas notas emitidas</h3>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[640px] text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Nº / PDF</th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    Nenhuma nota emitida ainda.
                  </td>
                </tr>
              ) : (
                historico.map((n) => (
                  <tr key={n.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">{n.cliente?.nome || "—"}</td>
                    <td className="px-3 py-2 text-right">{money(n.valor)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          n.status === "autorizada"
                            ? "text-emerald-700"
                            : n.status === "erro"
                              ? "text-red-600"
                              : "text-amber-700"
                        }
                      >
                        {n.status}
                        {n.mensagemErro ? ` — ${n.mensagemErro}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {n.numeroNfse ? <span>{n.numeroNfse} </span> : null}
                      {n.pdfUrl ? (
                        <a
                          href={n.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#4a90d9] underline"
                        >
                          PDF
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
