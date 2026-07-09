"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import {
  adicionarCorOsCadastro,
  carregarCoresOsCadastro,
  CORES_OS_ATUALIZADA_EVENT,
  removerCorOsCadastro,
} from "@/lib/cores-os-cadastro";
import {
  adicionarProdutoEscalaOs,
  excluirProdutoEscalaOs,
  produtosEscalaOs,
  TABELA_PRECOS_EVENT,
  type CategoriaTabelaPrecoOs,
  type ServicoTabelaPrecoOs,
} from "@/lib/tabela-precos-os";
import { cn } from "@/lib/utils";

type OpcaoLista = {
  id: string;
  nome: string;
  podeExcluir?: boolean;
};

type OsSelectOpcoesListaProps = {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoLista[];
  placeholder?: string;
  vazio?: string;
  onExcluir?: (opcao: OpcaoLista) => void;
  acaoAdicionar?: { label: string; onClick: () => void };
  className?: string;
};

function OsSelectOpcoesLista({
  label,
  value,
  onChange,
  opcoes,
  placeholder = "Selecione",
  vazio = "Nenhuma opção cadastrada",
  onExcluir,
  acaoAdicionar,
  className,
}: OsSelectOpcoesListaProps) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const rotulo = value || placeholder;

  return (
    <div ref={ref} className={cn("relative space-y-1", className)}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <span className={cn("truncate", !value && "text-slate-400")}>{rotulo}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            aberto && "rotate-180"
          )}
        />
      </button>

      {aberto ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-[120] mt-0 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {acaoAdicionar ? (
            <button
              type="button"
              onClick={() => {
                acaoAdicionar.onClick();
                setAberto(false);
              }}
              className="flex w-full items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-left text-[12px] font-medium text-[#2e9e5b] hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              {acaoAdicionar.label}
            </button>
          ) : null}

          {opcoes.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-slate-500">{vazio}</p>
          ) : (
            opcoes.map((opcao) => {
              const ativo = opcao.nome === value;
              const exibirExcluir = Boolean(onExcluir && opcao.podeExcluir !== false);
              return (
                <div
                  key={opcao.id}
                  className={cn(
                    "flex min-h-[36px] items-center gap-0.5 pr-1",
                    ativo ? "bg-primary-50" : "hover:bg-slate-50"
                  )}
                >
                  {exibirExcluir ? (
                    <button
                      type="button"
                      title="Excluir"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExcluir?.(opcao);
                      }}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Excluir ${opcao.nome}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : (
                    <span className="inline-block w-8 shrink-0" aria-hidden />
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    onClick={() => {
                      onChange(opcao.nome);
                      setAberto(false);
                    }}
                    className="min-w-0 flex-1 py-2 pr-2 text-left text-sm text-slate-800"
                  >
                    {opcao.nome}
                  </button>
                </div>
              );
            })
          )}

        </div>
      ) : null}
    </div>
  );
}

type EscalaCorCamposOsProps = {
  escala: string;
  cor: string;
  onEscalaChange: (valor: string) => void;
  onCorChange: (valor: string) => void;
  categoriasTabela: CategoriaTabelaPrecoOs[];
  nomeTabelaPreco: string;
  onTabelaPrecoAlterada?: () => void;
  className?: string;
};

export function EscalaCorCamposOs({
  escala,
  cor,
  onEscalaChange,
  onCorChange,
  categoriasTabela,
  nomeTabelaPreco,
  onTabelaPrecoAlterada,
  className,
}: EscalaCorCamposOsProps) {
  const [produtosEscala, setProdutosEscala] = useState<ServicoTabelaPrecoOs[]>([]);
  const [cores, setCores] = useState<string[]>([]);
  const [modalCorAberto, setModalCorAberto] = useState(false);
  const [modalEscalaAberto, setModalEscalaAberto] = useState(false);
  const [novaCor, setNovaCor] = useState("");
  const [novaEscala, setNovaEscala] = useState("");

  const recarregarEscala = useCallback(() => {
    setProdutosEscala(produtosEscalaOs(categoriasTabela));
  }, [categoriasTabela]);

  const recarregarCores = useCallback(() => {
    setCores(carregarCoresOsCadastro());
  }, []);

  useEffect(() => {
    recarregarEscala();
  }, [recarregarEscala]);

  useEffect(() => {
    recarregarCores();
  }, [recarregarCores]);

  useEffect(() => {
    function atualizar() {
      recarregarEscala();
      onTabelaPrecoAlterada?.();
    }
    window.addEventListener(TABELA_PRECOS_EVENT, atualizar);
    return () => window.removeEventListener(TABELA_PRECOS_EVENT, atualizar);
  }, [recarregarEscala, onTabelaPrecoAlterada]);

  useEffect(() => {
    const handler = () => recarregarCores();
    window.addEventListener(CORES_OS_ATUALIZADA_EVENT, handler);
    return () => window.removeEventListener(CORES_OS_ATUALIZADA_EVENT, handler);
  }, [recarregarCores]);

  const opcoesEscala: OpcaoLista[] = produtosEscala.map((item) => ({
    id: item.id,
    nome: item.nome,
    podeExcluir: true,
  }));

  const opcoesCor: OpcaoLista[] = cores.map((nome) => ({
    id: nome,
    nome,
    podeExcluir: true,
  }));

  function excluirEscala(opcao: OpcaoLista) {
    if (!window.confirm(`Excluir a escala "${opcao.nome}" da tabela de preços?`)) return;
    if (excluirProdutoEscalaOs(nomeTabelaPreco, opcao.id)) {
      recarregarEscala();
      onTabelaPrecoAlterada?.();
      if (escala === opcao.nome) onEscalaChange("");
    }
  }

  function excluirCor(opcao: OpcaoLista) {
    if (!window.confirm(`Excluir a cor "${opcao.nome}"?`)) return;
    const proximas = removerCorOsCadastro(opcao.nome, cores);
    setCores(proximas);
    if (cor === opcao.nome) onCorChange("");
  }

  async function salvarNovaCor() {
    const nome = novaCor.trim();
    if (!nome) return;
    try {
      const proximas = adicionarCorOsCadastro(nome, cores);
      setCores(proximas);
      onCorChange(nome);
      setNovaCor("");
      setModalCorAberto(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível salvar a cor.");
    }
  }

  async function salvarNovaEscala() {
    const nome = novaEscala.trim();
    if (!nome) return;
    const criado = adicionarProdutoEscalaOs(nomeTabelaPreco, nome);
    if (!criado) {
      alert("Esta escala já existe na categoria DENTES.");
      return;
    }
    recarregarEscala();
    onTabelaPrecoAlterada?.();
    onEscalaChange(nome);
    setNovaEscala("");
    setModalEscalaAberto(false);
  }

  return (
    <>
      <div className={cn("contents", className)}>
        <OsSelectOpcoesLista
          label="Escala"
          value={escala}
          onChange={onEscalaChange}
          opcoes={opcoesEscala}
          placeholder="Selecione a escala"
          vazio="Cadastre produtos na categoria DENTES da tabela de preços"
          onExcluir={excluirEscala}
          acaoAdicionar={{
            label: "+ adicionar escala",
            onClick: () => {
              setNovaEscala("");
              setModalEscalaAberto(true);
            },
          }}
        />
        <OsSelectOpcoesLista
          label="Cor"
          value={cor}
          onChange={onCorChange}
          opcoes={opcoesCor}
          placeholder="Selecione a cor"
          vazio="Nenhuma cor cadastrada"
          onExcluir={excluirCor}
          acaoAdicionar={{
            label: "+ adicionar cor",
            onClick: () => {
              setNovaCor("");
              setModalCorAberto(true);
            },
          }}
        />
      </div>

      <Modal
        open={modalEscalaAberto}
        onClose={() => setModalEscalaAberto(false)}
        title="Adicionar escala"
      >
        <div className="space-y-4">
          <Input
            label="Escala"
            value={novaEscala}
            onChange={(e) => setNovaEscala(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void salvarNovaEscala();
              }
            }}
            placeholder="Ex.: Trilux, Vitapan…"
            autoFocus
          />
          <p className="text-[12px] text-slate-500">
            A escala será salva na categoria DENTES da tabela de preços.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalEscalaAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void salvarNovaEscala()}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalCorAberto}
        onClose={() => setModalCorAberto(false)}
        title="Adicionar cor"
      >
        <div className="space-y-4">
          <Input
            label="Cor"
            value={novaCor}
            onChange={(e) => setNovaCor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void salvarNovaCor();
              }
            }}
            placeholder="Ex.: A2, BL3…"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalCorAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void salvarNovaCor()}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
