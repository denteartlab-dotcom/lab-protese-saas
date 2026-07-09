"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Italic,
  List,
  Send,
  Strikethrough,
  Upload,
  Users,
} from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { WhatsAppPreview } from "@/components/disparos-whatsapp/WhatsAppPreview";
import {
  VARIAVEIS_MENSAGEM,
  estimarDuracaoDisparo,
  formatarTempoRestante,
} from "@/lib/whatsapp-disparos/mensagem-variaveis";
import type { ContatoImportado } from "@/lib/whatsapp-disparos/telefone-br";

type ContatoFila = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  horario: string;
  erro?: string | null;
};

type Props = {
  conectado: boolean;
  prontoParaEnvio?: boolean;
  warmupRestanteSegundos?: number;
  onSalvo: () => void;
  onIniciado?: () => void;
  fila: ContatoFila[];
  resetSignal?: number;
};

const ETAPAS = ["Contato", "Mensagem", "Configurações", "Resumo"] as const;

function labelStatusFila(status: string) {
  const map: Record<string, string> = {
    enviado: "Enviado",
    enviando: "Enviando…",
    aguardando: "Aguardando",
    falhou: "Falhou",
    pausado: "Pausado",
  };
  return map[status] || status;
}

function corStatusFila(status: string) {
  if (status === "enviado") return "text-emerald-600 bg-emerald-50";
  if (status === "enviando") return "text-blue-600 bg-blue-50";
  if (status === "aguardando") return "text-amber-600 bg-amber-50";
  if (status === "falhou") return "text-red-600 bg-red-50";
  return "text-slate-600 bg-slate-50";
}

export function CampanhaWizardInline({
  conectado,
  prontoParaEnvio = true,
  warmupRestanteSegundos = 0,
  onSalvo,
  onIniciado,
  fila,
  resetSignal = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [etapa, setEtapa] = useState(0);
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState<"pacientes" | "clientes" | "excel" | "csv">("clientes");
  const [mensagem, setMensagem] = useState(
    "Olá {nome}!\n\nTemos uma novidade para você.\n\nQualquer dúvida, estamos à disposição."
  );
  const [contatos, setContatos] = useState<ContatoImportado[]>([]);
  const [resumo, setResumo] = useState({ total: 0, validos: 0, invalidos: 0, duplicados: 0 });
  const [intervalo, setIntervalo] = useState(15);
  const [atrasoAleatorio, setAtrasoAleatorio] = useState(true);
  const [filtroDuplicados, setFiltroDuplicados] = useState(true);
  const [limiteHora, setLimiteHora] = useState("500");
  const [agendar, setAgendar] = useState(false);
  const [agendadoPara, setAgendadoPara] = useState("");
  const [arquivosImportados, setArquivosImportados] = useState<string[]>([]);
  const [anexo, setAnexo] = useState<{
    uploadId: string;
    nome: string;
    mimeType: string;
    tipo: string;
    url: string;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);

  const resetar = useCallback(() => {
    setEtapa(0);
    setNome("");
    setOrigem("clientes");
    setContatos([]);
    setResumo({ total: 0, validos: 0, invalidos: 0, duplicados: 0 });
    setErro("");
    setAnexo(null);
    setArquivosImportados([]);
    setAgendar(false);
    setAgendadoPara("");
    setMensagem(
      "Olá {nome}!\n\nTemos uma novidade para você.\n\nQualquer dúvida, estamos à disposição."
    );
  }, []);

  useEffect(() => {
    if (resetSignal > 0) resetar();
  }, [resetSignal, resetar]);

  async function carregarOrigem(tipo: "pacientes" | "clientes") {
    setImportando(true);
    setErro("");
    try {
      const res = await fetch(`/api/disparos-whatsapp/origem?origem=${tipo}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar contatos");
      setContatos(data.contatos || []);
      setResumo({
        total: data.total,
        validos: data.validos,
        invalidos: data.invalidos,
        duplicados: data.duplicados,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setImportando(false);
    }
  }

  async function importarArquivo(file: File) {
    setImportando(true);
    setErro("");
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      const res = await fetch("/api/disparos-whatsapp/importar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na importação");
      setContatos(data.contatos || []);
      setResumo({
        total: data.total,
        validos: data.validos,
        invalidos: data.invalidos,
        duplicados: data.duplicados,
      });
      setArquivosImportados((prev) => [...prev, file.name]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro na importação");
    } finally {
      setImportando(false);
    }
  }

  async function enviarAnexo(file: File) {
    const fd = new FormData();
    fd.append("arquivo", file);
    const res = await fetch("/api/disparos-whatsapp/anexo", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha no anexo");
    setAnexo(data.anexo);
  }

  function inserirVariavel(chave: string) {
    setMensagem((m) => `${m}{${chave}}`);
  }

  function wrapSelecao(prefix: string, suffix: string) {
    const el = document.getElementById("editor-mensagem-disparo") as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = mensagem.slice(start, end);
    const next = mensagem.slice(0, start) + prefix + sel + suffix + mensagem.slice(end);
    setMensagem(next);
  }

  async function salvar(iniciarApos = false) {
    if (!nome.trim()) {
      setErro("Informe o nome da campanha.");
      setEtapa(0);
      return;
    }
    if (!contatos.length) {
      setErro("Adicione pelo menos um contato válido.");
      setEtapa(0);
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/disparos-whatsapp/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          mensagem,
          origemContatos: origem,
          intervaloSegundos: intervalo,
          atrasoAleatorio,
          limitePorHora: limiteHora === "0" ? null : Number(limiteHora),
          agendadoPara: agendar && agendadoPara ? new Date(agendadoPara).toISOString() : null,
          status: agendar && agendadoPara ? "agendada" : "rascunho",
          anexoTipo: anexo?.tipo || null,
          anexoNome: anexo?.nome || null,
          anexoMime: anexo?.mimeType || null,
          anexoUploadId: anexo?.uploadId || null,
          contatos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");

      if (iniciarApos) {
        if (!conectado) throw new Error("Conecte o WhatsApp antes de iniciar o disparo.");
        if (!prontoParaEnvio) {
          throw new Error(
            warmupRestanteSegundos > 0
              ? `WhatsApp ainda aquecendo — aguarde ${warmupRestanteSegundos}s e tente novamente.`
              : "WhatsApp ainda não está pronto para envio. Aguarde alguns segundos após conectar."
          );
        }
        const startRes = await fetch(`/api/disparos-whatsapp/campanhas/${data.campanha.id}/iniciar`, {
          method: "POST",
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || "Falha ao iniciar disparo");
        onIniciado?.();
      }

      resetar();
      onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar campanha");
    } finally {
      setSalvando(false);
    }
  }

  const tempoEstimado = formatarTempoRestante(
    estimarDuracaoDisparo(resumo.validos, intervalo, atrasoAleatorio)
  );

  const previewContatos = contatos.slice(0, 5);

  return (
    <div ref={ref} className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Stepper */}
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          {ETAPAS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setEtapa(i)}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                etapa === i
                  ? "bg-indigo-600 text-white shadow-sm"
                  : i < etapa
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  etapa === i ? "bg-white/20 text-white" : "bg-white text-slate-600"
                }`}
              >
                {i + 1}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 p-6">
        {erro ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{erro}</p>
        ) : null}

        <Input
          label="Nome da campanha"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Promoção Julho 2026"
        />

        {/* Etapa 1 — 3 colunas */}
        <div className="grid gap-5 xl:grid-cols-3">
          {/* Importar contatos */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Importar contatos</p>
            <div className="grid grid-cols-2 gap-2">
              {(["clientes", "pacientes"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    setOrigem(tipo);
                    void carregarOrigem(tipo);
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                    origem === tipo
                      ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  {tipo === "clientes" ? "Clientes cadastrados" : "Pacientes cadastrados"}
                </button>
              ))}
            </div>
            <div
              className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setOrigem(file.name.endsWith(".csv") ? "csv" : "excel");
                  void importarArquivo(file);
                }
              }}
            >
              <Upload className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-xs font-medium text-slate-600">Arraste Excel ou CSV aqui</p>
              <p className="mt-0.5 text-[11px] text-slate-400">.xlsx, .xls, .csv</p>
              <label className="mt-3 inline-block cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-slate-200 hover:bg-indigo-50">
                Selecionar arquivo
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setOrigem(file.name.endsWith(".csv") ? "csv" : "excel");
                      void importarArquivo(file);
                    }
                  }}
                />
              </label>
            </div>
            {importando ? <p className="text-xs text-slate-500">Processando contatos…</p> : null}
            {arquivosImportados.length > 0 ? (
              <ul className="space-y-1.5">
                {arquivosImportados.map((arq) => (
                  <li
                    key={arq}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {arq}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Resumo + visualizar */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Resumo dos contatos</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total de contatos", valor: resumo.total, cor: "text-slate-800", dot: "bg-slate-400" },
                { label: "Válidos", valor: resumo.validos, cor: "text-emerald-700", dot: "bg-emerald-500" },
                { label: "Duplicados", valor: resumo.duplicados, cor: "text-amber-700", dot: "bg-amber-500" },
                { label: "Inválidos", valor: resumo.invalidos, cor: "text-red-600", dot: "bg-red-500" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                    <p className="text-[10px] text-slate-500">{item.label}</p>
                  </div>
                  <p className={`mt-0.5 text-lg font-bold ${item.cor}`}>
                    {item.valor.toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-slate-800">Visualizar contatos</p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Telefone</th>
                    <th className="px-3 py-2 font-medium">Cidade</th>
                  </tr>
                </thead>
                <tbody>
                  {previewContatos.length ? (
                    previewContatos.map((c, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{c.nome || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{c.telefone}</td>
                        <td className="px-3 py-2 text-slate-500">{c.cidade || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                        Importe ou selecione contatos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fila de envio */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              Fila de envio
              <span className="ml-1.5 text-xs font-normal text-indigo-600">(Em andamento)</span>
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Telefone</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Horário</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.slice(0, 6).length ? (
                    fila.slice(0, 6).map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{item.nome}</td>
                        <td className="px-3 py-2 text-slate-500">{item.telefone}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${corStatusFila(item.status)}`}
                          >
                            {labelStatusFila(item.status)}
                          </span>
                          {item.status === "falhou" && item.erro ? (
                            <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-red-600" title={item.erro}>
                              {item.erro}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          {new Date(item.horario).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        Nenhum envio em andamento
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Editor de mensagem</p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
                {[
                  { icon: Bold, action: () => wrapSelecao("*", "*") },
                  { icon: Italic, action: () => wrapSelecao("_", "_") },
                  { icon: Strikethrough, action: () => wrapSelecao("~", "~") },
                  { icon: List, action: () => setMensagem((m) => `${m}\n• `) },
                ].map(({ icon: Icon, action }, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={action}
                    className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              <textarea
                id="editor-mensagem-disparo"
                rows={8}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="w-full resize-none border-0 px-4 py-3 text-sm text-slate-800 outline-none focus:ring-0"
                placeholder="Digite sua mensagem..."
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Variáveis disponíveis</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIAVEIS_MENSAGEM.map((v) => (
                  <button
                    key={v.chave}
                    type="button"
                    onClick={() => inserirVariavel(v.chave)}
                    className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100"
                  >
                    {`{${v.chave}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <WhatsAppPreview mensagem={mensagem} />
        </div>

        {/* Anexos */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Anexos</p>
          <div className="flex flex-wrap gap-3">
            {[
              { tipo: "imagem", icon: FileImage, label: "Imagem", accept: "image/*" },
              { tipo: "pdf", icon: FileText, label: "PDF", accept: ".pdf" },
              { tipo: "documento", icon: File, label: "Documento", accept: ".doc,.docx" },
              { tipo: "video", icon: FileVideo, label: "Vídeo", accept: "video/*" },
              { tipo: "audio", icon: FileAudio, label: "Áudio", accept: "audio/*" },
            ].map((item) => (
              <label
                key={item.tipo}
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <item.icon className="h-5 w-5 text-slate-500" />
                <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
                <input
                  type="file"
                  accept={item.accept}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void enviarAnexo(file).catch(() => setErro("Falha ao enviar anexo"));
                  }}
                />
              </label>
            ))}
          </div>
          {anexo ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <FileText className="h-4 w-4 shrink-0" />
              <span>
                <strong>{anexo.nome}</strong> ({anexo.tipo})
              </span>
              {anexo.tipo === "imagem" ? (
                <img src={anexo.url} alt="" className="ml-auto max-h-12 rounded" />
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Configurações de envio */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-800">Configurações do envio</p>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Intervalo entre mensagens: <strong className="text-indigo-600">{intervalo}s</strong>
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={5}
                value={intervalo}
                onChange={(e) => setIntervalo(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-indigo-600"
              />
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
                {[5, 10, 15, 20, 30].map((v) => (
                  <span key={v} className={intervalo === v ? "font-semibold text-indigo-600" : ""}>
                    {v}s
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-xs text-slate-600">Filtro duplicados</span>
                <input
                  type="checkbox"
                  checked={filtroDuplicados}
                  onChange={(e) => setFiltroDuplicados(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-xs text-slate-600">Atraso variável</span>
                <input
                  type="checkbox"
                  checked={atrasoAleatorio}
                  onChange={(e) => setAtrasoAleatorio(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
              </label>
            </div>
            <div className="space-y-3">
              <Select label="Limite por hora" value={limiteHora} onChange={(e) => setLimiteHora(e.target.value)}>
                <option value="100">100 mensagens</option>
                <option value="250">250 mensagens</option>
                <option value="500">500 mensagens</option>
                <option value="1000">1000 mensagens</option>
                <option value="0">Sem limite</option>
              </Select>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={agendar}
                  onChange={(e) => setAgendar(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                Agendar disparo
              </label>
              {agendar ? (
                <Input
                  type="datetime-local"
                  label="Data e hora"
                  value={agendadoPara}
                  onChange={(e) => setAgendadoPara(e.target.value)}
                />
              ) : null}
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-indigo-50 px-4 py-2.5 text-xs text-indigo-900">
            Tempo estimado do disparo: <strong>{tempoEstimado}</strong> para{" "}
            {resumo.validos.toLocaleString("pt-BR")} contatos válidos.
          </p>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
        <Button variant="outline" onClick={resetar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="secondary" disabled={salvando} onClick={() => void salvar(false)}>
          Salvar rascunho
        </Button>
        <Button
          disabled={salvando}
          onClick={() => void salvar(true)}
          className="bg-indigo-600 px-6 hover:bg-indigo-700"
        >
          <Send className="h-4 w-4" />
          Iniciar disparo
        </Button>
      </div>
    </div>
  );
}
