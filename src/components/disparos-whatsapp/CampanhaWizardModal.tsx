"use client";

import { useCallback, useState } from "react";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { WhatsAppPreview } from "@/components/disparos-whatsapp/WhatsAppPreview";
import { VARIAVEIS_MENSAGEM, estimarDuracaoDisparo, formatarTempoRestante } from "@/lib/whatsapp-disparos/mensagem-variaveis";
import {
  DISPARO_INTERVALO_MAX_SEG,
  DISPARO_INTERVALO_MIN_SEG,
  DISPARO_INTERVALO_PADRAO_SEG,
  DISPARO_INTERVALO_STEP_SEG,
  MARCAS_INTERVALO_DISPARO_SEG,
  formatarIntervaloDisparo,
} from "@/lib/whatsapp-disparos/disparo-intervalo";
import type { ContatoImportado } from "@/lib/whatsapp-disparos/telefone-br";
import { FileAudio, FileImage, FileText, FileVideo, Upload } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSalvo: () => void;
  conectado: boolean;
};

const ETAPAS = ["Contatos", "Mensagem", "Anexos", "Configurações"] as const;

export function CampanhaWizardModal({ open, onClose, onSalvo, conectado }: Props) {
  const [etapa, setEtapa] = useState(0);
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState<"pacientes" | "clientes" | "excel" | "csv">("clientes");
  const [mensagem, setMensagem] = useState(
    "Olá {nome}!\n\nTemos uma novidade para você.\n\nQualquer dúvida, estamos à disposição."
  );
  const [contatos, setContatos] = useState<ContatoImportado[]>([]);
  const [resumo, setResumo] = useState({ total: 0, validos: 0, invalidos: 0, duplicados: 0 });
  const [intervalo, setIntervalo] = useState(DISPARO_INTERVALO_PADRAO_SEG);
  const [atrasoAleatorio, setAtrasoAleatorio] = useState(true);
  const [limiteHora, setLimiteHora] = useState<string>("30");
  const [agendar, setAgendar] = useState(false);
  const [agendadoPara, setAgendadoPara] = useState("");
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
    setAgendar(false);
    setAgendadoPara("");
  }, []);

  function fechar() {
    resetar();
    onClose();
  }

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

  async function salvar(iniciarApos = false) {
    if (!nome.trim()) {
      setErro("Informe o nome da campanha.");
      return;
    }
    if (!contatos.length) {
      setErro("Adicione pelo menos um contato válido.");
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
        const startRes = await fetch(`/api/disparos-whatsapp/campanhas/${data.campanha.id}/iniciar`, {
          method: "POST",
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || "Falha ao iniciar disparo");
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

  return (
    <Modal open={open} onClose={fechar} title="Nova campanha WhatsApp" size="2xl">
      <div className="mb-6 flex flex-wrap gap-2">
        {ETAPAS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setEtapa(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              etapa === i ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {erro ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      {etapa === 0 ? (
        <div className="space-y-4">
          <Input label="Nome da campanha" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            {(["clientes", "pacientes"] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => {
                  setOrigem(tipo);
                  void carregarOrigem(tipo);
                }}
                className={`rounded-lg border p-4 text-left text-sm ${
                  origem === tipo ? "border-primary-500 bg-primary-50" : "border-slate-200"
                }`}
              >
                <p className="font-medium">{tipo === "clientes" ? "Clientes cadastrados" : "Pacientes cadastrados"}</p>
                <p className="mt-1 text-xs text-slate-500">Carregar do banco de dados</p>
              </button>
            ))}
          </div>
          <div
            className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center"
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
            <Upload className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">Arraste Excel (.xlsx, .xls) ou CSV</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="mt-3 text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setOrigem(file.name.endsWith(".csv") ? "csv" : "excel");
                  void importarArquivo(file);
                }
              }}
            />
          </div>
          {importando ? <p className="text-sm text-slate-500">Processando contatos…</p> : null}
          {resumo.total > 0 ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4">
              <div><span className="text-slate-500">Total</span><p className="font-semibold">{resumo.total}</p></div>
              <div><span className="text-slate-500">Válidos</span><p className="font-semibold text-emerald-700">{resumo.validos}</p></div>
              <div><span className="text-slate-500">Inválidos</span><p className="font-semibold text-red-700">{resumo.invalidos}</p></div>
              <div><span className="text-slate-500">Duplicados</span><p className="font-semibold text-amber-700">{resumo.duplicados}</p></div>
            </div>
          ) : null}
        </div>
      ) : null}

      {etapa === 1 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Textarea
              label="Mensagem"
              rows={12}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">Variáveis disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {VARIAVEIS_MENSAGEM.map((v) => (
                  <button
                    key={v.chave}
                    type="button"
                    onClick={() => inserirVariavel(v.chave)}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    {`{${v.chave}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <WhatsAppPreview mensagem={mensagem} />
        </div>
      ) : null}

      {etapa === 2 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { tipo: "imagem", icon: FileImage, label: "Imagem" },
              { tipo: "pdf", icon: FileText, label: "PDF" },
              { tipo: "documento", icon: FileText, label: "Documento" },
              { tipo: "video", icon: FileVideo, label: "Vídeo" },
              { tipo: "audio", icon: FileAudio, label: "Áudio" },
            ].map((item) => (
              <label
                key={item.tipo}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
              >
                <item.icon className="h-6 w-6 text-slate-500" />
                <span className="text-xs">{item.label}</span>
                <input
                  type="file"
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
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              Anexo: <strong>{anexo.nome}</strong> ({anexo.tipo})
              {anexo.tipo === "imagem" ? (
                <img src={anexo.url} alt="" className="mt-2 max-h-40 rounded" />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Anexo opcional. Máximo 4 MB.</p>
          )}
        </div>
      ) : null}

      {etapa === 3 ? (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Intervalo entre mensagens: {formatarIntervaloDisparo(intervalo)}
            </label>
            <input
              type="range"
              min={DISPARO_INTERVALO_MIN_SEG}
              max={DISPARO_INTERVALO_MAX_SEG}
              step={DISPARO_INTERVALO_STEP_SEG}
              value={intervalo}
              onChange={(e) => setIntervalo(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              {MARCAS_INTERVALO_DISPARO_SEG.map((v) => (
                <span key={v}>{formatarIntervaloDisparo(v)}</span>
              ))}
            </div>
          </div>
          <Select
            label="Atraso aleatório"
            value={atrasoAleatorio ? "sim" : "nao"}
            onChange={(e) => setAtrasoAleatorio(e.target.value === "sim")}
          >
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </Select>
          <Select label="Limite por hora" value={limiteHora} onChange={(e) => setLimiteHora(e.target.value)}>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="0">Sem limite</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agendar} onChange={(e) => setAgendar(e.target.checked)} />
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
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
            Tempo estimado do disparo: <strong>{tempoEstimado}</strong> para {resumo.validos} contatos.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          {etapa > 0 ? (
            <Button variant="outline" onClick={() => setEtapa((e) => e - 1)}>
              Voltar
            </Button>
          ) : (
            <Button variant="outline" onClick={fechar}>
              Cancelar
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {etapa === ETAPAS.length - 1 ? (
            <>
              <Button variant="secondary" disabled={salvando} onClick={() => void salvar(false)}>
                Salvar rascunho
              </Button>
              <Button disabled={salvando} onClick={() => void salvar(true)}>
                Iniciar disparo
              </Button>
            </>
          ) : (
            <Button onClick={() => setEtapa((e) => e + 1)}>Próximo</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
