"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Save } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { WhatsAppPreview } from "@/components/disparos-whatsapp/WhatsAppPreview";
import {
  CHATBOT_CONFIG_PADRAO,
  montarTextoMenuChat,
  type ChatbotConfigDados,
} from "@/lib/whatsapp-chat/chatbot-config-types";

type OpcaoCampo = {
  ativaKey: keyof ChatbotConfigDados;
  textoKey: keyof ChatbotConfigDados;
  numero: string;
  acao: string;
};

const OPCOES: OpcaoCampo[] = [
  {
    numero: "1",
    acao: "Lista OS em andamento do cliente",
    ativaKey: "opcao1Ativa",
    textoKey: "opcao1Texto",
  },
  {
    numero: "2",
    acao: "Consulta OS por número",
    ativaKey: "opcao2Ativa",
    textoKey: "opcao2Texto",
  },
  {
    numero: "3",
    acao: "Envia link de acompanhamento online",
    ativaKey: "opcao3Ativa",
    textoKey: "opcao3Texto",
  },
  {
    numero: "4",
    acao: "Transfere para atendimento humano",
    ativaKey: "opcao4Ativa",
    textoKey: "opcao4Texto",
  },
];

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
              Configure as mensagens e opções do menu automático.
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
            <p className="text-sm font-semibold text-slate-800">Opções do menu</p>
            {OPCOES.map((op) => (
              <div
                key={op.numero}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Opção {op.numero}</p>
                    <p className="text-xs text-slate-500">{op.acao}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(config[op.ativaKey])}
                      onChange={(e) =>
                        atualizar(op.ativaKey, e.target.checked as ChatbotConfigDados[typeof op.ativaKey])
                      }
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    Ativa
                  </label>
                </div>
                <Input
                  label="Texto exibido no menu"
                  value={String(config[op.textoKey])}
                  onChange={(e) =>
                    atualizar(op.textoKey, e.target.value as ChatbotConfigDados[typeof op.textoKey])
                  }
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-800">Mensagens automáticas</p>
            <Textarea
              label="Ao escolher atendente (opção 4)"
              value={config.msgAtendente}
              onChange={(e) => atualizar("msgAtendente", e.target.value)}
              rows={3}
            />
            <Textarea
              label="Ao pedir número da OS (opção 2)"
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
          </div>
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <WhatsAppPreview mensagem={preview} />
          <p className="mt-3 text-xs text-slate-500">
            Palavras que reabrem o menu: oi, olá, menu, ajuda, bom dia, boa tarde, boa noite.
          </p>
        </div>
      </div>
    </div>
  );
}
