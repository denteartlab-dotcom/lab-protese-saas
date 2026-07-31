"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, FileImage, FileText, Plus, Save, Trash2 } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { WhatsAppPreview } from "@/components/disparos-whatsapp/WhatsAppPreview";
import {
  CHATBOT_CONFIG_PADRAO,
  CHATBOT_MAX_OPCOES,
  criarIdOpcaoChatbot,
  montarTextoMenuChat,
  type ChatbotAnexoConfig,
  type ChatbotConfigDados,
  type ChatbotOpcaoMenu,
  type ChatbotTipoOpcao,
} from "@/lib/whatsapp-chat/chatbot-config-types";
import { excluirUploadPorUrl } from "@/lib/uploads-armazenamento";

const TIPOS_OPCAO: { value: ChatbotTipoOpcao; label: string }[] = [
  { value: "sistema", label: "Ação do sistema" },
  { value: "mensagem", label: "Mensagem de resposta" },
  { value: "sim_nao", label: "Pergunta sim/não (com anexo)" },
];

const ACOES_SISTEMA = [
  { value: "listar_os", label: "Listar OS em andamento" },
  { value: "consultar_os", label: "Consultar OS por número" },
  { value: "link_acompanhamento", label: "Enviar link de acompanhamento" },
  { value: "atendente", label: "Falar com atendente" },
] as const;

function AnexoChatbotCampo({
  label,
  anexo,
  onChange,
}: {
  label: string;
  anexo: ChatbotAnexoConfig | null | undefined;
  onChange: (valor: ChatbotAnexoConfig | null) => void;
}) {
  const [enviando, setEnviando] = useState(false);

  async function enviarArquivo(file: File) {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      const res = await fetch("/api/disparos-whatsapp/anexo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload");
      const item = data.anexo;
      const anteriorUrl = anexo?.url?.trim();
      if (anteriorUrl) void excluirUploadPorUrl(anteriorUrl);
      onChange({
        uploadId: item.uploadId,
        nome: item.nome,
        mimeType: item.mimeType,
        tipo: item.tipo === "imagem" ? "imagem" : item.tipo === "pdf" ? "pdf" : "documento",
        url: item.url,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-medium text-slate-700">{label}</p>
      {anexo?.nome ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          {anexo.tipo === "imagem" ? (
            <FileImage className="h-4 w-4 text-emerald-600" />
          ) : (
            <FileText className="h-4 w-4 text-blue-600" />
          )}
          <span className="truncate">{anexo.nome}</span>
          <button
            type="button"
            onClick={() => {
              const url = anexo.url?.trim();
              onChange(null);
              if (url) void excluirUploadPorUrl(url);
            }}
            className="ml-auto text-red-600 hover:underline"
          >
            Remover
          </button>
        </div>
      ) : null}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void enviarArquivo(file);
            e.target.value = "";
          }}
        />
        {enviando ? "Enviando…" : "Anexar PDF ou imagem"}
      </label>
    </div>
  );
}

export function ChatbotConfigConteudo() {
  const [config, setConfig] = useState<ChatbotConfigDados>(CHATBOT_CONFIG_PADRAO);
  const [nomeLab, setNomeLab] = useState("Laboratório");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/disparos-whatsapp/chatbot", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar configuração");
      setConfig(data.config);
      if (data.nomeLab) setNomeLab(data.nomeLab);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const preview = useMemo(
    () => montarTextoMenuChat(config, nomeLab),
    [config, nomeLab]
  );

  function atualizar<K extends keyof ChatbotConfigDados>(chave: K, valor: ChatbotConfigDados[K]) {
    setConfig((prev) => ({ ...prev, [chave]: valor }));
    setSucesso(false);
  }

  function atualizarOpcao(id: string, patch: Partial<ChatbotOpcaoMenu>) {
    setConfig((prev) => ({
      ...prev,
      opcoes: prev.opcoes.map((op) => (op.id === id ? { ...op, ...patch } : op)),
    }));
    setSucesso(false);
  }

  function adicionarOpcao() {
    if (config.opcoes.length >= CHATBOT_MAX_OPCOES) return;
    setConfig((prev) => ({
      ...prev,
      opcoes: [
        ...prev.opcoes,
        {
          id: criarIdOpcaoChatbot(),
          ativa: true,
          texto: "Nova opção",
          tipo: "mensagem",
          mensagem: "Digite sua mensagem aqui.",
        },
      ],
    }));
    setSucesso(false);
  }

  function removerOpcao(id: string) {
    if (config.opcoes.length <= 1) return;
    setConfig((prev) => ({
      ...prev,
      opcoes: prev.opcoes.filter((op) => op.id !== id),
    }));
    setSucesso(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setSucesso(false);
    try {
      const res = await fetch("/api/disparos-whatsapp/chatbot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setConfig(data.config);
      setSucesso(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Carregando configuração do chatbot…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Chatbot WhatsApp</h1>
            <p className="text-sm text-slate-500">
              Crie opções no menu, respostas sim/não e envio de PDF ou imagem.
            </p>
          </div>
        </div>
        <Button onClick={salvar} disabled={salvando}>
          <Save className="mr-2 h-4 w-4" />
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erro}
        </div>
      ) : null}

      {sucesso ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Configuração salva com sucesso.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Responder números sem cadastro</p>
                <p className="text-xs text-slate-500">
                  Quando ativo, qualquer WhatsApp recebe o menu e opções personalizadas — mesmo sem
                  estar no cadastro de clientes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.responderSemCadastro}
                onChange={(e) => atualizar("responderSemCadastro", e.target.checked)}
                className="h-5 w-5 rounded accent-indigo-600"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Chatbot ativo</p>
                <p className="text-xs text-slate-500">
                  Quando desligado, mensagens recebidas não geram resposta automática.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.ativo}
                onChange={(e) => atualizar("ativo", e.target.checked)}
                className="h-5 w-5 rounded accent-indigo-600"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-800">Mensagem de boas-vindas</p>
            <Textarea
              label="Introdução"
              value={config.intro}
              onChange={(e) => atualizar("intro", e.target.value)}
              rows={3}
            />
            <p className="text-xs text-slate-500">Use {"{laboratorio}"} para inserir o nome do laboratório.</p>
            <Textarea
              label="Rodapé do menu"
              value={config.rodapeMenu}
              onChange={(e) => atualizar("rodapeMenu", e.target.value)}
              rows={2}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">
                Opções do menu ({config.opcoes.filter((o) => o.ativa).length} ativas)
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={adicionarOpcao}
                disabled={config.opcoes.length >= CHATBOT_MAX_OPCOES}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar opção
              </Button>
            </div>

            {config.opcoes.map((op, idx) => (
              <div
                key={op.id}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Opção {idx + 1}
                      {!op.ativa ? (
                        <span className="ml-2 text-xs font-normal text-slate-400">(inativa)</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={op.ativa}
                        onChange={(e) => atualizarOpcao(op.id, { ativa: e.target.checked })}
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                      Ativa
                    </label>
                    {config.opcoes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removerOpcao(op.id)}
                        className="text-red-600 hover:text-red-700"
                        aria-label="Remover opção"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <Input
                  label="Texto exibido no menu"
                  value={op.texto}
                  onChange={(e) => atualizarOpcao(op.id, { texto: e.target.value })}
                />

                <Select
                  label="Tipo de resposta"
                  value={op.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as ChatbotTipoOpcao;
                    const patch: Partial<ChatbotOpcaoMenu> = { tipo };
                    if (tipo === "sistema" && !op.acao) patch.acao = "listar_os";
                    if (tipo === "mensagem" && !op.mensagem) patch.mensagem = "";
                    if (tipo === "sim_nao" && !op.pergunta) patch.pergunta = "Deseja receber o material?";
                    atualizarOpcao(op.id, patch);
                  }}
                >
                  {TIPOS_OPCAO.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>

                {op.tipo === "sistema" ? (
                  <Select
                    label="Ação do sistema"
                    value={op.acao || "listar_os"}
                    onChange={(e) =>
                      atualizarOpcao(op.id, {
                        acao: e.target.value as ChatbotOpcaoMenu["acao"],
                      })
                    }
                  >
                    {ACOES_SISTEMA.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                ) : null}

                {op.tipo === "mensagem" ? (
                  <Textarea
                    label="Mensagem enviada ao escolher esta opção"
                    value={op.mensagem || ""}
                    onChange={(e) => atualizarOpcao(op.id, { mensagem: e.target.value })}
                    rows={3}
                  />
                ) : null}

                {op.tipo === "sim_nao" ? (
                  <div className="space-y-3 border-t border-slate-200 pt-3">
                    <Textarea
                      label="Pergunta enviada ao cliente"
                      value={op.pergunta || ""}
                      onChange={(e) => atualizarOpcao(op.id, { pergunta: e.target.value })}
                      rows={2}
                    />
                    <Textarea
                      label="Resposta se digitar SIM"
                      value={op.respostaSimTexto || ""}
                      onChange={(e) => atualizarOpcao(op.id, { respostaSimTexto: e.target.value })}
                      rows={2}
                    />
                    <AnexoChatbotCampo
                      label="Anexo ao responder SIM (opcional)"
                      anexo={op.respostaSimAnexo}
                      onChange={(valor) => atualizarOpcao(op.id, { respostaSimAnexo: valor })}
                    />
                    <Textarea
                      label="Resposta se digitar NÃO"
                      value={op.respostaNaoTexto || ""}
                      onChange={(e) => atualizarOpcao(op.id, { respostaNaoTexto: e.target.value })}
                      rows={2}
                    />
                    <AnexoChatbotCampo
                      label="Anexo ao responder NÃO (opcional)"
                      anexo={op.respostaNaoAnexo}
                      onChange={(valor) => atualizarOpcao(op.id, { respostaNaoAnexo: valor })}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-800">Mensagens automáticas</p>
            <Textarea
              label="Ao transferir para atendente"
              value={config.msgAtendente}
              onChange={(e) => atualizar("msgAtendente", e.target.value)}
              rows={3}
            />
            <Textarea
              label="Ao pedir número da OS"
              value={config.msgAguardandoOs}
              onChange={(e) => atualizar("msgAguardandoOs", e.target.value)}
              rows={2}
            />
            <Textarea
              label="Quando não entender a mensagem"
              value={config.msgNaoEntendi}
              onChange={(e) => atualizar("msgNaoEntendi", e.target.value)}
              rows={2}
            />
            <Textarea
              label="Quando tentar OS/link sem cadastro"
              value={config.msgSemCadastro}
              onChange={(e) => atualizar("msgSemCadastro", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <WhatsAppPreview mensagem={preview} />
          <p className="mt-3 text-xs text-slate-500">
            Palavras que reabrem o menu: oi, olá, menu, ajuda, bom dia, boa tarde, boa noite.
            <br />
            No fluxo sim/não o cliente responde <strong>sim</strong> ou <strong>não</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
