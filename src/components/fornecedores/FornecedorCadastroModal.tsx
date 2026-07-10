"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Trash2, UserRound } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import {
  aplicarEspelhoContatoCadastro,
  ESPELHOS_CONTATO_FORNECEDOR,
  type CampoContatoPrincipal,
} from "@/lib/espelhar-contato-cadastro";
import { formatarTelefone, PLACEHOLDER_TELEFONE_BR } from "@/lib/validar-documento";
import {
  carregarCategoriasFornecedor,
  formatCepInput,
  fornecedorFormularioVazio,
  salvarCategoriasFornecedor,
  salvarNovoFornecedor,
  type FornecedorCadastro,
  type FornecedorFormulario,
} from "@/lib/fornecedores-cadastro";

type Props = {
  open: boolean;
  onClose: () => void;
  onSalvo?: (fornecedor: FornecedorCadastro) => void;
};

export function FornecedorCadastroModal({ open, onClose, onSalvo }: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [form, setForm] = useState<FornecedorFormulario>(fornecedorFormularioVazio);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const ultimoCepBuscado = useRef("");

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(fornecedorFormularioVazio());
    setNovaCategoria("");
    setModalCategoriaAberto(false);
    ultimoCepBuscado.current = "";

    void (async () => {
      try {
        const res = await fetch("/api/cadastros/contexto?tipo=fornecedor", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { categorias?: string[] };
          if (Array.isArray(data.categorias) && data.categorias.length > 0) {
            setCategorias(data.categorias);
            return;
          }
        }
      } catch {
        /* fallback local */
      }
      setCategorias(carregarCategoriasFornecedor());
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const cep = (form.cep ?? "").replace(/\D/g, "");
    if (cep.length === 8 && cep !== ultimoCepBuscado.current) {
      void buscarEnderecoPorCep(form.cep ?? "");
    }
  }, [open, form.cep]);

  function atualizarEspelho(campo: CampoContatoPrincipal, valor: string) {
    setForm((atual) =>
      aplicarEspelhoContatoCadastro(atual, campo, valor, ESPELHOS_CONTATO_FORNECEDOR)
    );
  }

  async function buscarEnderecoPorCep(cepInformado = form.cep ?? "") {
    const cep = cepInformado.replace(/\D/g, "");
    if (cep.length !== 8) return;

    ultimoCepBuscado.current = cep;
    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setForm((current) => ({
          ...current,
          rua: data.logradouro || current.rua,
          bairro: data.bairro || current.bairro,
          cidade: data.localidade || current.cidade,
          uf: data.uf || current.uf,
        }));
      }
    } finally {
      setBuscandoCep(false);
    }
  }

  function adicionarCategoria(event: React.FormEvent) {
    event.preventDefault();
    const nome = novaCategoria.trim();
    if (!nome) return;

    setCategorias((atuais) => {
      if (atuais.some((categoria) => categoria.toLowerCase() === nome.toLowerCase())) {
        return atuais;
      }
      const atualizadas = [...atuais, nome];
      salvarCategoriasFornecedor(atualizadas);
      return atualizadas;
    });
    setForm((current) => ({ ...current, categoria: nome }));
    setNovaCategoria("");
    setModalCategoriaAberto(false);
  }

  function removerCategoria(nome: string) {
    if (!nome) return;
    setCategorias((atuais) => {
      const atualizadas = atuais.filter((categoria) => categoria !== nome);
      salvarCategoriasFornecedor(atualizadas);
      return atualizadas;
    });
    setForm((current) => ({
      ...current,
      categoria: current.categoria === nome ? "" : current.categoria,
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const salvo = salvarNovoFornecedor(form);
    if (!salvo) return;
    onSalvo?.(salvo);
    onClose();
  }

  if (!open || !portalPronto) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10060] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fornecedor-cadastro-titulo"
      >
        <div className="absolute inset-0" onClick={onClose} aria-hidden />
        <div className="relative my-auto w-full max-w-4xl rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
            <h2
              id="fornecedor-cadastro-titulo"
              className="text-[15px] font-normal text-slate-800"
            >
              Cadastrar Fornecedor
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-lg leading-none text-slate-400 hover:text-slate-600"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto px-4 py-4 text-[11px] text-slate-600">
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <UserRound className="h-3.5 w-3.5" />
                Dados do Fornecedor
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Nome do Fornecedor *"
                  value={form.nome}
                  onChange={(event) => setForm({ ...form, nome: event.target.value })}
                  required
                />
                <Input
                  label="CPF"
                  value={form.cpf}
                  onChange={(event) => setForm({ ...form, cpf: event.target.value })}
                />
                <Input
                  label="CNPJ"
                  value={form.cnpj}
                  onChange={(event) => setForm({ ...form, cnpj: event.target.value })}
                />
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-slate-700">Categoria</label>
                    <button
                      type="button"
                      onClick={() => setModalCategoriaAberto(true)}
                      className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600"
                    >
                      + Adicionar Categoria
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={form.categoria}
                      onChange={(event) => setForm({ ...form, categoria: event.target.value })}
                      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                        form.categoria ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      <option value="" hidden>
                        Selecione
                      </option>
                      {categorias.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removerCategoria(form.categoria || "")}
                      disabled={!form.categoria}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Remover categoria selecionada"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) => atualizarEspelho("email", event.target.value)}
                  className="md:col-span-2"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  label="Telefone Residencial"
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  value={form.telefoneResidencial}
                  onChange={(event) =>
                    setForm({ ...form, telefoneResidencial: formatarTelefone(event.target.value) })
                  }
                />
                <Input
                  label="Telefone Comercial"
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  value={form.telefoneComercial}
                  onChange={(event) =>
                    atualizarEspelho("telefoneComercial", formatarTelefone(event.target.value))
                  }
                />
                <Input
                  label="Celular"
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  value={form.celular}
                  onChange={(event) => setForm({ ...form, celular: formatarTelefone(event.target.value) })}
                />
                <Input
                  label="WhatsApp"
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  value={form.whatsapp}
                  onChange={(event) => atualizarEspelho("whatsapp", formatarTelefone(event.target.value))}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <MapPin className="h-3.5 w-3.5" />
                Endereço
              </h3>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_2fr_1fr]">
                <Input
                  label="CEP"
                  value={form.cep}
                  onChange={(event) =>
                    setForm({ ...form, cep: formatCepInput(event.target.value) })
                  }
                />
                <button
                  type="button"
                  onClick={() => void buscarEnderecoPorCep()}
                  disabled={buscandoCep}
                  className="mt-6 h-10 rounded border border-slate-300 px-3 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                >
                  {buscandoCep ? "Buscando..." : "Buscar Endereço"}
                </button>
                <Input
                  label="Rua"
                  value={form.rua}
                  onChange={(event) => setForm({ ...form, rua: event.target.value })}
                />
                <Input
                  label="Número"
                  value={form.numero}
                  onChange={(event) => setForm({ ...form, numero: event.target.value })}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_1.5fr_1fr]">
                <Input
                  label="Cidade"
                  value={form.cidade}
                  onChange={(event) => setForm({ ...form, cidade: event.target.value })}
                />
                <Input
                  label="UF"
                  value={form.uf}
                  onChange={(event) =>
                    setForm({ ...form, uf: event.target.value.toUpperCase().slice(0, 2) })
                  }
                />
                <Input
                  label="Bairro"
                  value={form.bairro}
                  onChange={(event) => setForm({ ...form, bairro: event.target.value })}
                />
                <Input
                  label="Complemento"
                  value={form.complemento}
                  onChange={(event) => setForm({ ...form, complemento: event.target.value })}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <UserRound className="h-3.5 w-3.5" />
                Contato do Representante
              </h3>
              <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_1.5fr]">
                <Input
                  label="Contato"
                  value={form.contato}
                  onChange={(event) => setForm({ ...form, contato: event.target.value })}
                />
                <Input
                  label="Telefone Comercial"
                  value={form.representanteTelefoneComercial}
                  onChange={(event) =>
                    setForm({ ...form, representanteTelefoneComercial: event.target.value })
                  }
                />
                <Input
                  label="WhatsApp"
                  value={form.representanteWhatsapp}
                  onChange={(event) =>
                    setForm({ ...form, representanteWhatsapp: event.target.value })
                  }
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.representanteEmail}
                  onChange={(event) =>
                    setForm({ ...form, representanteEmail: event.target.value })
                  }
                />
              </div>
            </section>

            <div className="flex justify-start gap-2 border-t border-slate-100 pt-4">
              <Button type="submit" size="sm">
                Cadastrar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </form>
        </div>
      </div>

      <Modal
        open={modalCategoriaAberto}
        onClose={() => setModalCategoriaAberto(false)}
        title="Adicionar Categoria"
        size="sm"
      >
        <form onSubmit={adicionarCategoria} className="space-y-4">
          <Input
            label="Nome da Categoria"
            value={novaCategoria}
            onChange={(event) => setNovaCategoria(event.target.value)}
            placeholder="Digite o nome da categoria"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalCategoriaAberto(false)}>
              Fechar
            </Button>
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </Modal>
    </>,
    document.body
  );
}
