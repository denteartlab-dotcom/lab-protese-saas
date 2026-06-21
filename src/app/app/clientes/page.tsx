"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Eye, MessageCircle, Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { BotoesListagemClientes } from "@/components/clientes/BotoesListagemClientes";
import { ImportarClientesExcelModal } from "@/components/clientes/ImportarClientesExcelModal";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { Input, Modal } from "@/components/ui";
import { abrirWhatsAppAcompanhamentoCliente } from "@/lib/whatsapp";
import {
  abreviacaoCliente,
  dataNascimentoCliente,
  descontoGeralClienteObservacoes,
  descontoGeralTipoClienteObservacoes,
  mesclarObservacoesComDataNascimento,
  observacoesTextoLivreCliente,
  tipoClienteCadastro,
} from "@/lib/cliente-observacoes";
import {
  carregarNomesTabelasPreco,
  carregarNomesTabelasPrecoRemoto,
  TABELA_PRECOS_EVENT,
} from "@/lib/tabela-precos-os";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import { compararTextoBr } from "@/lib/listagem-config";
import { buscarEnderecoPorCep as buscarCepApi } from "@/lib/cep-lookup";
import { validarNomeCliente } from "@/lib/cliente-validacao";
import { formatCepInput } from "@/lib/documento-br";
import {
  custoEntregaCliente,
  entregadorCliente,
  formatarCustoEntregaCliente,
  mesclarObservacoesComEntregaCliente,
  tipoEntregadorCliente,
} from "@/lib/cliente-entrega";
import { carregarEntregadores, TIPOS_ENTREGADOR } from "@/lib/controle-entregas";
import { ENTREGADORES_CADASTRO_EVENT } from "@/lib/entregadores-cadastro";
import {
  exportarClientesExcel,
  gerarListaClientesPdf,
} from "@/lib/clientes-lista-export";
import { configValueFromObservacoes } from "@/lib/cliente-financeiro";
import {
  nomeRepresentanteColaboradorCliente,
  resolverRepresentanteColaboradorId,
} from "@/lib/cliente-representante";
import {
  carregarColaboradoresListagem,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import { abrirPdfGerando } from "@/lib/pdf-viewer";

type Cliente = {
  id: string;
  nome: string;
  razaoSocial?: string | null;
  cnpjCpf?: string | null;
  cro?: string | null;
  telefone?: string | null;
  celular?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  observacoes?: string | null;
  representanteColaboradorId?: string | null;
  _count?: { pacientes: number; trabalhos: number };
};

function IconWhatsApp({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function CampoCliente({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[11px] font-normal text-slate-600">{label}</label>
      <input
        className="h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30"
        {...props}
      />
    </div>
  );
}

function SelectCliente({
  label,
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[11px] font-normal text-slate-600">{label}</label>
      <select
        className="h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

const empty = {
  tipoCliente: "Dentista",
  abreviacao: "",
  nome: "",
  razaoSocial: "",
  cnpjCpf: "",
  cpf: "",
  rg: "",
  dataNascimento: "",
  cro: "",
  telefone: "",
  telefoneComercial: "",
  celular: "",
  whatsapp: "",
  email: "",
  contato: "",
  contatoTelefoneComercial: "",
  contatoWhatsapp: "",
  contatoEmail: "",
  representanteColaboradorId: "",
  descricaoEndereco: "Endereço Principal",
  rua: "",
  numero: "",
  bairro: "",
  complemento: "",
  entregador: "",
  tipoEntregador: "",
  custoEntrega: "0,00",
  tabelaPreco: "Tabela Principal",
  descontoGeral: "0,00",
  descontoGeralTipo: "percentual" as "percentual" | "valor",
  limiteSaldoDevedor: "0,00",
  diaCobranca: "",
  endereco: "",
  cidade: "",
  uf: "",
  cep: "",
  observacoes: "",
};

export default function ClientesPage() {
  const [list, setList] = useState<Cliente[]>([]);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [detalhe, setDetalhe] = useState<Cliente | null>(null);
  const [abaModal, setAbaModal] = useState("dados");
  const [form, setForm] = useState(empty);
  const [enviandoWhatsAppId, setEnviandoWhatsAppId] = useState<string | null>(null);
  const [tabelasPreco, setTabelasPreco] = useState<string[]>(["Tabela Principal"]);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [colaboradores, setColaboradores] = useState<ColaboradorListagem[]>([]);
  const [entregadores, setEntregadores] = useState<string[]>([]);
  const [importarAberto, setImportarAberto] = useState(false);
  const [processandoLista, setProcessandoLista] = useState(false);
  const [idsSelecionados, setIdsSelecionados] = useState<Set<string>>(() => new Set());
  const [exclusaoMultiplaAberta, setExclusaoMultiplaAberta] = useState(false);
  const ultimoCepBuscado = useRef("");

  const recarregarTabelasPreco = async () => {
    const nomes = await carregarNomesTabelasPrecoRemoto();
    setTabelasPreco(nomes);
  };

  async function load() {
    const params = new URLSearchParams({ q });
    if (mostrarExcluidos) params.set("excluidos", "1");
    const res = await fetch(`/api/clientes?${params}`);
    if (!res.ok) {
      setList([]);
      return;
    }
    const data = await res.json();
    setList(Array.isArray(data) ? data : []);
  }

  function formatDateInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    if (digits.length <= 2) return day;
    if (digits.length <= 4) return `${day}/${month}`;
    return `${day}/${month}/${year}`;
  }

  function formatDecimalInput(value: string) {
    const amount = Number(value.replace(/\D/g, "")) / 100;
    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatCurrencyInput(value: string) {
    const amount = Number(value.replace(/\D/g, "")) / 100;
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function configValue(observacoes: string | null | undefined, prefix: string) {
    return configValueFromObservacoes(observacoes, prefix);
  }

  function aplicarEnderecoCep(
    endereco: NonNullable<Awaited<ReturnType<typeof buscarCepApi>>>
  ) {
    setForm((current) => {
      const rua = endereco.rua || current.rua;
      const bairro = endereco.bairro || current.bairro;
      const cidade = endereco.cidade || current.cidade;
      const uf = endereco.uf || current.uf;
      return {
        ...current,
        rua,
        bairro,
        cidade,
        uf,
        cep: endereco.cep,
        endereco: [rua, current.numero, bairro, current.complemento]
          .filter(Boolean)
          .join(", "),
      };
    });
  }

  async function buscarEnderecoPorCep(cepInformado = form.cep) {
    const cep = cepInformado.replace(/\D/g, "");
    if (cep.length !== 8) {
      alert("Informe um CEP com 8 números.");
      return;
    }

    ultimoCepBuscado.current = cep;
    setBuscandoCep(true);
    try {
      const endereco = await buscarCepApi(cepInformado);
      if (!endereco) {
        alert("CEP não encontrado.");
        return;
      }
      aplicarEnderecoCep(endereco);
    } catch {
      alert("Não foi possível consultar o CEP. Tente novamente.");
    } finally {
      setBuscandoCep(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length === 8 && cep !== ultimoCepBuscado.current) {
      void buscarEnderecoPorCep(form.cep);
    }
  }, [form.cep, open]);

  useEffect(() => {
    void load();
    limparSelecao();
  }, [q, mostrarExcluidos]);

  useEffect(() => {
    setIdsSelecionados((atual) => {
      const idsValidos = new Set(list.map((c) => c.id));
      const proximo = new Set([...atual].filter((id) => idsValidos.has(id)));
      return proximo.size === atual.size ? atual : proximo;
    });
  }, [list]);

  useEffect(() => {
    if (!open) return;
    const atualizar = () => setEntregadores(carregarEntregadores());
    atualizar();
    window.addEventListener(ENTREGADORES_CADASTRO_EVENT, atualizar);
    return () => window.removeEventListener(ENTREGADORES_CADASTRO_EVENT, atualizar);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setColaboradores(carregarColaboradoresListagem());
  }, [open]);

  useEffect(() => {
    const local = carregarNomesTabelasPreco();
    if (local.length) setTabelasPreco(local);
    void recarregarTabelasPreco();
    setColaboradores(carregarColaboradoresListagem());
    const aoAtualizar = () => void recarregarTabelasPreco();
    window.addEventListener(TABELA_PRECOS_EVENT, aoAtualizar);
    return () => {
      window.removeEventListener(TABELA_PRECOS_EVENT, aoAtualizar);
    };
  }, []);

  useEffect(() => {
    if (open && abaModal === "configuracao") void recarregarTabelasPreco();
  }, [open, abaModal]);

  const opcoesTabelaPreco = useMemo(() => {
    const base = [...tabelasPreco];
    if (form.tabelaPreco && !base.includes(form.tabelaPreco)) {
      base.unshift(form.tabelaPreco);
    }
    return base;
  }, [tabelasPreco, form.tabelaPreco]);

  const listagem = useListagemPaginada<Cliente, "nome" | "cidade" | "email">({
    storageKey: "clientes",
    itens: list,
    padrao: { ordenarPor: "nome", direcao: "asc", porPagina: 50 },
    comparadores: {
      nome: (a, b) => compararTextoBr(a.nome, b.nome),
      cidade: (a, b) => compararTextoBr(a.cidade || "", b.cidade || ""),
      email: (a, b) => compararTextoBr(a.email || "", b.email || ""),
    },
  });

  const idsPaginaAtual = useMemo(
    () => listagem.itensPagina.map((c) => c.id),
    [listagem.itensPagina]
  );

  const quantidadeSelecionados = idsSelecionados.size;

  const todosPaginaSelecionados =
    idsPaginaAtual.length > 0 &&
    idsPaginaAtual.every((id) => idsSelecionados.has(id));

  const algumPaginaSelecionado = idsPaginaAtual.some((id) =>
    idsSelecionados.has(id)
  );

  function alternarSelecao(id: string) {
    setIdsSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function alternarSelecaoPaginaAtual() {
    setIdsSelecionados((atual) => {
      const proximo = new Set(atual);
      if (todosPaginaSelecionados) {
        idsPaginaAtual.forEach((id) => proximo.delete(id));
      } else {
        idsPaginaAtual.forEach((id) => proximo.add(id));
      }
      return proximo;
    });
  }

  function limparSelecao() {
    setIdsSelecionados(new Set());
  }

  function openNew() {
    const tabelasLocal = carregarNomesTabelasPreco();
    const tabelas = tabelasLocal.length ? tabelasLocal : tabelasPreco;
    setEditing(null);
    ultimoCepBuscado.current = "";
    setForm({
      ...empty,
      tabelaPreco: tabelas[0] || "Tabela Principal",
    });
    setAbaModal("dados");
    setOpen(true);
    void recarregarTabelasPreco();
  }

  function openEdit(c: Cliente) {
    const cols = carregarColaboradoresListagem();
    setColaboradores(cols);
    setEditing(c);
    ultimoCepBuscado.current = (c.cep || "").replace(/\D/g, "");
    setForm({
      tipoCliente: tipoClienteCadastro(c.observacoes) || "Dentista",
      abreviacao: abreviacaoCliente(c.observacoes),
      nome: c.nome,
      razaoSocial: c.razaoSocial || "",
      cnpjCpf: c.cnpjCpf || "",
      cpf: "",
      rg: configValue(c.observacoes, "RG:"),
      dataNascimento: dataNascimentoCliente(c.observacoes),
      cro: c.cro || "",
      telefone: c.telefone || "",
      telefoneComercial: c.telefone || "",
      celular: c.celular || "",
      whatsapp: c.celular || "",
      email: c.email || "",
      contato: configValue(c.observacoes, "Contato:"),
      contatoTelefoneComercial: configValue(c.observacoes, "Telefone Contato:"),
      contatoWhatsapp: configValue(c.observacoes, "WhatsApp Contato:"),
      contatoEmail: configValue(c.observacoes, "Email Contato:"),
      representanteColaboradorId: resolverRepresentanteColaboradorId(c, cols),
      descricaoEndereco: "Endereço Principal",
      rua: c.endereco || "",
      numero: "",
      bairro: "",
      complemento: "",
      entregador: entregadorCliente(c.observacoes),
      tipoEntregador: tipoEntregadorCliente(c.observacoes),
      custoEntrega: formatarCustoEntregaCliente(custoEntregaCliente(c.observacoes)),
      tabelaPreco: configValue(c.observacoes, "Tabela de Preço:") || "Tabela Principal",
      descontoGeral: descontoGeralClienteObservacoes(c.observacoes) || "0,00",
      descontoGeralTipo: descontoGeralTipoClienteObservacoes(c.observacoes),
      limiteSaldoDevedor: configValue(c.observacoes, "Limite Saldo Devedor:") || "0,00",
      diaCobranca: configValue(c.observacoes, "Dia da Cobrança:"),
      endereco: c.endereco || "",
      cidade: c.cidade || "",
      uf: c.uf || "",
      cep: c.cep || "",
      observacoes: observacoesTextoLivreCliente(c.observacoes),
    });
    setAbaModal("dados");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nomeValidado = validarNomeCliente(form.nome);
    if (!nomeValidado.ok) {
      alert(nomeValidado.message);
      return;
    }
    const url = editing ? `/api/clientes/${editing.id}` : "/api/clientes";
    const payload = {
      nome: nomeValidado.nome,
      razaoSocial: form.razaoSocial,
      cnpjCpf: form.cnpjCpf || form.cpf,
      cro: form.cro,
      telefone: form.telefoneComercial || form.telefone,
      celular: form.whatsapp || form.celular,
      email: form.email || form.contatoEmail,
      endereco: form.endereco || [form.rua, form.numero, form.bairro, form.complemento].filter(Boolean).join(", "),
      cidade: form.cidade,
      uf: form.uf,
      cep: form.cep,
      representanteColaboradorId: form.representanteColaboradorId.trim() || null,
      observacoes: mesclarObservacoesComDataNascimento(
        mesclarObservacoesComEntregaCliente(
          [
            observacoesTextoLivreCliente(form.observacoes),
            form.tipoCliente ? `Tipo de Cliente: ${form.tipoCliente}` : "",
            form.abreviacao ? `Abreviação: ${form.abreviacao}` : "",
            form.contato ? `Contato: ${form.contato}` : "",
            form.contatoTelefoneComercial ? `Telefone Contato: ${form.contatoTelefoneComercial}` : "",
            form.contatoWhatsapp ? `WhatsApp Contato: ${form.contatoWhatsapp}` : "",
            form.rg ? `RG: ${form.rg}` : "",
            form.tabelaPreco ? `Tabela de Preço: ${form.tabelaPreco}` : "",
            `Desconto Geral: ${form.descontoGeral || "0,00"}`,
            `Desconto Geral Tipo: ${form.descontoGeralTipo || "percentual"}`,
            form.limiteSaldoDevedor ? `Limite Saldo Devedor: ${form.limiteSaldoDevedor}` : "",
            form.diaCobranca ? `Dia da Cobrança: ${form.diaCobranca}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          {
            entregador: form.entregador,
            tipoEntregador: form.tipoEntregador,
            custoEntrega: form.custoEntrega,
          }
        ),
        form.dataNascimento
      ),
    };
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error || "Não foi possível salvar o cliente.");
      return;
    }
    setOpen(false);
    load();
  }

  async function confirmarExclusaoMultipla() {
    const ids = [...idsSelecionados];
    if (!ids.length) return;
    const idsSet = new Set(ids);

    setExclusaoMultiplaAberta(false);
    setList((lista) => lista.filter((c) => !idsSet.has(c.id)));
    limparSelecao();

    const erros: string[] = [];
    for (const id of ids) {
      try {
        const url = mostrarExcluidos
          ? `/api/clientes/${id}?permanente=1`
          : `/api/clientes/${id}`;
        const res = await fetch(url, { method: "DELETE" });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          erros.push(data.error || "Falha ao excluir um cliente.");
        }
      } catch {
        erros.push("Falha ao excluir um cliente.");
      }
    }

    await load();
    if (erros.length) {
      alert(erros[0]);
    }
  }

  async function confirmarExclusaoCliente() {
    const cliente = clienteParaExcluir;
    if (!cliente) return;
    setClienteParaExcluir(null);
    setList((lista) => lista.filter((c) => c.id !== cliente.id));
    try {
      const url = mostrarExcluidos
        ? `/api/clientes/${cliente.id}?permanente=1`
        : `/api/clientes/${cliente.id}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "Não foi possível excluir o cliente.");
        void load();
        return;
      }
      void load();
    } catch {
      alert("Não foi possível excluir o cliente.");
      void load();
    }
  }

  async function restaurarCliente(cliente: Cliente) {
    const res = await fetch(`/api/clientes/${cliente.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: true }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error || "Não foi possível restaurar o cliente.");
      return;
    }
    setMostrarExcluidos(false);
    await load();
  }

  async function imprimirListaClientes() {
    if (!list.length) {
      alert("Não há clientes para imprimir.");
      return;
    }
    setProcessandoLista(true);
    try {
      await abrirPdfGerando(
        () => gerarListaClientesPdf(list),
        "lista-clientes.pdf",
        "Lista de Clientes Cadastrados"
      );
    } catch {
      alert("Não foi possível gerar a impressão.");
    } finally {
      setProcessandoLista(false);
    }
  }

  async function exportarListaClientes() {
    if (!list.length) {
      alert("Não há clientes para exportar.");
      return;
    }
    setProcessandoLista(true);
    try {
      await exportarClientesExcel(list);
    } catch {
      alert("Não foi possível exportar a planilha.");
    } finally {
      setProcessandoLista(false);
    }
  }

  async function enviarAcompanhamentoWhatsApp(cliente: Cliente) {
    const telefone = (cliente.celular || cliente.telefone || "").trim();
    if (!telefone) {
      alert(
        "Cadastre o celular ou WhatsApp do cliente para enviar o link de acompanhamento."
      );
      return;
    }

    setEnviandoWhatsAppId(cliente.id);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}/acompanhamento`);
      const data = await res.json();
      if (!res.ok || !data.publicUrl) {
        alert(data.error || "Não foi possível gerar o link de acompanhamento.");
        return;
      }
      const ok = abrirWhatsAppAcompanhamentoCliente(
        telefone,
        cliente.nome,
        data.publicUrl
      );
      if (!ok) {
        alert(
          "Link gerado, mas não foi possível abrir o WhatsApp. Verifique o número do cliente."
        );
      }
    } catch {
      alert("Erro ao preparar o envio pelo WhatsApp.");
    } finally {
      setEnviandoWhatsAppId(null);
    }
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-medium text-slate-700">Cadastros</h1>
        <span className="text-slate-300">/</span>
        <span>Clientes</span>
      </div>

      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Cliente
            </button>
            <button
              type="button"
              onClick={() => setMostrarExcluidos((atual) => !atual)}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
              {mostrarExcluidos ? "Ver Ativos" : "Lixeira"}
            </button>
            <BotoesListagemClientes
              onImprimir={() => void imprimirListaClientes()}
              onImportar={() => setImportarAberto(true)}
              onExportarExcel={() => void exportarListaClientes()}
              quantidadeSelecionados={quantidadeSelecionados}
              onExcluirSelecionados={() => setExclusaoMultiplaAberta(true)}
              tituloExcluirSelecionados={
                mostrarExcluidos
                  ? "Excluir definitivamente os selecionados"
                  : "Enviar selecionados para a lixeira"
              }
              processando={processandoLista}
              disabled={mostrarExcluidos}
            />
          </div>

          <div className="flex min-w-[320px] max-w-lg flex-1 justify-end">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 w-full rounded border border-slate-300 py-1 pl-8 pr-16 text-xs outline-none focus:border-primary-400"
                placeholder="Procurar"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-0 top-0 h-8 rounded-r bg-slate-500 px-4 text-[11px] font-semibold text-white hover:bg-slate-600"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <BarraConfigListagem
          embutido
          configAberto={listagem.configAberto}
          onToggleConfig={() =>
            listagem.configAberto ? listagem.fecharConfig() : listagem.abrirConfig()
          }
          onFecharConfig={listagem.fecharConfig}
          rascunho={listagem.rascunho}
          opcoesOrdenacao={[
            { valor: "nome", label: "Nome" },
            { valor: "cidade", label: "Cidade" },
            { valor: "email", label: "E-mail" },
          ]}
          onAlterarOrdenarPor={(valor) => listagem.atualizarRascunho({ ordenarPor: valor })}
          onAlterarDirecao={(direcao) => listagem.atualizarRascunho({ direcao })}
          onAlterarPorPagina={(porPagina) => listagem.atualizarRascunho({ porPagina })}
          onGravarConfig={listagem.gravarConfig}
          pagina={listagem.pagina}
          totalPaginas={listagem.totalPaginas}
          onPagina={listagem.setPagina}
          totalItens={listagem.totalItens}
        >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                <th className="w-8 px-3 py-2 text-left font-semibold">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary-600"
                    checked={todosPaginaSelecionados}
                    ref={(el) => {
                      if (el) el.indeterminate = algumPaginaSelecionado && !todosPaginaSelecionados;
                    }}
                    onChange={alternarSelecaoPaginaAtual}
                    aria-label="Selecionar todos desta página"
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold">NOME</th>
                <th className="px-3 py-2 text-left font-semibold">CONTATO</th>
                <th className="px-3 py-2 text-left font-semibold">CELULAR</th>
                <th className="px-3 py-2 text-left font-semibold">WHATSAPP</th>
                <th className="px-3 py-2 text-left font-semibold">EMAIL</th>
                <th className="px-3 py-2 text-center font-semibold">OPÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listagem.itensPagina.map((c) => {
                const aberto = detalhe?.id === c.id;
                const selecionado = idsSelecionados.has(c.id);
                return (
                  <Fragment key={c.id}>
                    <tr
                      className={
                        selecionado
                          ? "bg-red-50/80"
                          : aberto
                            ? "bg-blue-50/40"
                            : "hover:bg-slate-50"
                      }
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-primary-600"
                          checked={selecionado}
                          onChange={() => alternarSelecao(c.id)}
                          aria-label={`Selecionar ${c.nome}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-600">{c.nome}</td>
                      <td className="px-3 py-2 text-slate-500">{c.telefone || ""}</td>
                      <td className="px-3 py-2 text-slate-500">{c.celular || ""}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {c.celular ? (
                          <a
                            href={`https://wa.me/${c.celular.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{c.email || ""}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-2 text-slate-500">
                          <button
                            type="button"
                            onClick={() => void enviarAcompanhamentoWhatsApp(c)}
                            disabled={enviandoWhatsAppId === c.id}
                            title="Enviar link de acompanhamento da produção no WhatsApp"
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <IconWhatsApp />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetalhe(aberto ? null : c)}
                            title="Visualizar"
                            className={`rounded p-1 hover:bg-blue-50 hover:text-blue-600 ${aberto ? "bg-blue-50 text-blue-500" : ""}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => openEdit(c)} title="Editar" className="hover:text-primary-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {mostrarExcluidos ? (
                            <button
                              type="button"
                              onClick={() => void restaurarCliente(c)}
                              title="Restaurar cliente"
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50"
                            >
                              Restaurar
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setClienteParaExcluir(c)}
                            title={mostrarExcluidos ? "Excluir definitivamente" : "Enviar para a lixeira"}
                            className="hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="bg-white">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="rounded border border-slate-100 bg-white p-3 text-[10px] text-slate-600">
                            <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-600">
                              <Eye className="h-3.5 w-3.5" />
                              {c.nome}
                            </div>
                            <div className="grid gap-x-8 gap-y-3 border-b border-slate-100 pb-3 md:grid-cols-4">
                              <p><span className="font-semibold text-slate-700">Nome:</span> {c.nome}</p>
                              <p><span className="font-semibold text-slate-700">Razão Social:</span> {c.razaoSocial || ""}</p>
                              <p><span className="font-semibold text-slate-700">CPF/CNPJ:</span> {c.cnpjCpf || ""}</p>
                              <p><span className="font-semibold text-slate-700">CRO:</span> {c.cro || ""}</p>
                              <p><span className="font-semibold text-slate-700">Telefone:</span> {c.telefone || ""}</p>
                              <p><span className="font-semibold text-slate-700">Celular:</span> {c.celular || ""}</p>
                              <p><span className="font-semibold text-slate-700">Email:</span> {c.email || ""}</p>
                              <p><span className="font-semibold text-slate-700">Cidade/UF:</span> {[c.cidade, c.uf].filter(Boolean).join(" / ")}</p>
                              <p className="md:col-span-2"><span className="font-semibold text-slate-700">Endereço:</span> {c.endereco || ""}</p>
                              <p><span className="font-semibold text-slate-700">Representante:</span> {nomeRepresentanteColaboradorCliente(c, colaboradores) || ""}</p>
                              <p className="md:col-span-2"><span className="font-semibold text-slate-700">Observações:</span> {observacoesTextoLivreCliente(c.observacoes) || ""}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDetalhe(null)}
                              className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                            >
                              Fechar Detalhes
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {listagem.totalItens === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </BarraConfigListagem>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar Cliente" : "Cadastro de Cliente"}
        size="smart"
      >
        <form onSubmit={save} className="space-y-4 text-xs text-slate-800">
          <div className="flex flex-wrap gap-1 border-b border-slate-200">
            {[
              { id: "dados", label: "Dados do Cliente" },
              { id: "endereco", label: "Endereço" },
              { id: "configuracao", label: "Configuração" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAbaModal(tab.id)}
                className={`rounded-t px-4 py-2.5 text-[13px] font-normal transition ${
                  abaModal === tab.id
                    ? "bg-[#4a90d9] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {abaModal === "dados" && (
          <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SelectCliente
              label="Tipo de Cliente"
              value={form.tipoCliente}
              onChange={(e) => setForm({ ...form, tipoCliente: e.target.value })}
            >
              <option>Dentista</option>
              <option>Clínica</option>
              <option>Laboratório</option>
            </SelectCliente>
            <SelectCliente
              label="Abreviação"
              value={form.abreviacao}
              onChange={(e) => setForm({ ...form, abreviacao: e.target.value })}
            >
              <option value=""></option>
              <option>Dr.</option>
              <option>Dra.</option>
            </SelectCliente>
            <CampoCliente label="Razão Social" value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} />
            <CampoCliente label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            <CampoCliente label="Data de Nascimento" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: formatDateInput(e.target.value) })} placeholder="dd/mm/aaaa" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <CampoCliente label="CRO Responsável" value={form.cro} onChange={(e) => setForm({ ...form, cro: e.target.value })} />
            <CampoCliente label="CNPJ" value={form.cnpjCpf} onChange={(e) => setForm({ ...form, cnpjCpf: e.target.value })} />
            <CampoCliente label="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            <CampoCliente label="RG" value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
            <CampoCliente label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CampoCliente label="Telefone Residencial" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            <CampoCliente label="Telefone Comercial" value={form.telefoneComercial} onChange={(e) => setForm({ ...form, telefoneComercial: e.target.value })} />
            <CampoCliente label="Celular" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
            <CampoCliente label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>

          <div className="space-y-1 pt-1">
            <label className="block text-[11px] font-normal text-slate-600">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Digite aqui as observações..."
              rows={4}
              className="min-h-[88px] w-full resize-y rounded border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30"
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-slate-700">
              <User className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
              <span>Contato</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CampoCliente label="Contato" value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
              <CampoCliente label="Telefone Comercial" value={form.contatoTelefoneComercial} onChange={(e) => setForm({ ...form, contatoTelefoneComercial: e.target.value })} />
              <CampoCliente label="WhatsApp" value={form.contatoWhatsapp} onChange={(e) => setForm({ ...form, contatoWhatsapp: e.target.value })} />
              <CampoCliente label="Email" type="email" value={form.contatoEmail} onChange={(e) => setForm({ ...form, contatoEmail: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1 md:max-w-md">
            <label className="flex items-center gap-1.5 text-[11px] font-normal text-slate-600">
              Representante (Colaborador)
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#4a90d9] text-[10px] font-bold text-white"
                title="Colaborador responsável pelos trabalhos deste cliente nas ordens de serviço"
              >
                i
              </span>
            </label>
            <select
              value={form.representanteColaboradorId}
              onChange={(e) =>
                setForm({ ...form, representanteColaboradorId: e.target.value })
              }
              className="h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-sm outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30"
            >
              <option value="">Selecione um colaborador...</option>
              {colaboradores.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome}
                </option>
              ))}
            </select>
          </div>
          </>
          )}

          {abaModal === "endereco" && (
            <div className="space-y-7">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span>Endereço Principal</span>
              </div>

              <div className="grid gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Input
                    label="Descrição (Apelido)"
                    value={form.descricaoEndereco}
                    onChange={(e) => setForm({ ...form, descricaoEndereco: e.target.value })}
                    placeholder="Endereço Principal"
                  />
                </div>

                <div className="md:col-span-4 md:col-start-1">
                  <Input
                    label="CEP"
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: formatCepInput(e.target.value) })}
                  />
                </div>
                <div className="flex items-end md:col-span-2">
                  <button
                    type="button"
                    onClick={() => void buscarEnderecoPorCep()}
                    disabled={buscandoCep}
                    className="h-9 w-full whitespace-nowrap rounded border border-primary-500 bg-white px-3 text-[11px] text-primary-700 hover:bg-primary-50 disabled:opacity-60"
                  >
                    {buscandoCep ? "Buscando..." : "Buscar CEP"}
                  </button>
                </div>
                <div className="md:col-span-5">
                  <Input label="Rua" value={form.rua} onChange={(e) => setForm({ ...form, rua: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                </div>

                <div className="md:col-span-3">
                  <Input label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Input label="UF" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} />
                </div>
                <div className="md:col-span-4">
                  <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <Input label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                </div>

                <div className="space-y-1 md:col-span-4">
                  <label className="block text-[11px] text-slate-600">Entregador</label>
                  <input
                    list="entregadores-cliente"
                    value={form.entregador}
                    onChange={(e) => setForm({ ...form, entregador: e.target.value })}
                    placeholder="Selecione ou digite"
                    className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-primary-500"
                  />
                  <datalist id="entregadores-cliente">
                    {entregadores.map((nome) => (
                      <option key={nome} value={nome} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1 md:col-span-4">
                  <label className="block text-[11px] text-slate-600">Tipo Entregador</label>
                  <select
                    value={form.tipoEntregador}
                    onChange={(e) => setForm({ ...form, tipoEntregador: e.target.value })}
                    className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-primary-500"
                  >
                    <option value="">Selecione...</option>
                    {TIPOS_ENTREGADOR.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-4">
                  <label className="block text-[11px] text-slate-600">Custo de Entrega</label>
                  <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                    <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">
                      R$
                    </span>
                    <input
                      value={form.custoEntrega}
                      onChange={(e) =>
                        setForm({ ...form, custoEntrega: formatDecimalInput(e.target.value) })
                      }
                      className="w-full px-2 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <button
                  type="button"
                  className="rounded bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  + Endereço Extra
                </button>
              </div>
            </div>
          )}

          {abaModal === "configuracao" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span className="text-base">$</span>
                <span>Cobranças</span>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Tabela de Preço</label>
                  <select
                    value={form.tabelaPreco}
                    onChange={(e) => setForm({ ...form, tabelaPreco: e.target.value })}
                    className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-primary-500"
                  >
                    {opcoesTabelaPreco.length === 0 ? (
                      <option value="Tabela Principal">Tabela Principal</option>
                    ) : (
                      opcoesTabelaPreco.map((nome) => (
                        <option key={nome} value={nome}>
                          {nome}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Esta tabela será usada na ordem de serviço deste cliente. Cadastre
                    novas tabelas em Cadastros → Tabela de Preços.
                  </p>
                  {tabelasPreco.length <= 1 ? (
                    <p className="mt-0.5 text-[10px] text-amber-700">
                      Só uma tabela encontrada — abra Tabela de Preços uma vez para
                      sincronizar as demais.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Desconto Geral</label>
                  <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                    <select
                      value={form.descontoGeralTipo}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          descontoGeralTipo: e.target.value as "percentual" | "valor",
                          descontoGeral:
                            e.target.value === "valor" ? "R$ 0,00" : "0,00",
                        })
                      }
                      className="w-11 border-r border-slate-200 bg-white px-1 text-center text-xs text-slate-600 outline-none"
                    >
                      <option value="percentual">%</option>
                      <option value="valor">$</option>
                    </select>
                    <input
                      value={form.descontoGeral}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          descontoGeral:
                            form.descontoGeralTipo === "valor"
                              ? formatCurrencyInput(e.target.value)
                              : formatDecimalInput(e.target.value),
                        })
                      }
                      className="w-full px-2 text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Limite Saldo Devedor</label>
                  <div className="flex h-9 overflow-hidden rounded border border-slate-300 bg-white">
                    <span className="flex w-9 items-center justify-center border-r border-slate-200 text-xs text-slate-500">$</span>
                    <input
                      value={form.limiteSaldoDevedor}
                      onChange={(e) => setForm({ ...form, limiteSaldoDevedor: formatDecimalInput(e.target.value) })}
                      className="w-full px-2 text-xs outline-none"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Ao atingir este limite com títulos em aberto há mais de 30 dias, novas ordens de
                    serviço para este cliente serão bloqueadas.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600">Dia da Cobrança</label>
                  <div className="relative">
                    <input
                      value={form.diaCobranca}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          diaCobranca: e.target.value.replace(/\D/g, "").slice(0, 2),
                        })
                      }
                      placeholder="1 a 31"
                      className="h-9 w-full rounded border border-emerald-300 px-2 pr-8 text-xs outline-none focus:border-emerald-500"
                    />
                    {form.diaCobranca ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                        ✓
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    No dia {form.diaCobranca || "—"} de cada mês você recebe um lembrete no
                    sino para cobrar este cliente.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="submit"
              className="rounded bg-[#4a90d9] px-5 py-2 text-sm font-normal text-white hover:bg-[#3d7fc4]"
            >
              {editing ? "Gravar Alterações" : "Cadastrar Cliente"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-slate-300 bg-white px-5 py-2 text-sm font-normal text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </form>
      </Modal>

      <ImportarClientesExcelModal
        aberto={importarAberto}
        onFechar={() => setImportarAberto(false)}
        onImportado={() => void load()}
      />

      <ConfirmacaoExclusaoModal
        open={exclusaoMultiplaAberta}
        titulo={
          mostrarExcluidos
            ? "Excluir clientes definitivamente"
            : "Enviar clientes para a lixeira"
        }
        mensagem={
          mostrarExcluidos
            ? `Deseja remover ${quantidadeSelecionados} cliente(s) do sistema? Só é possível se não houver OS, pacientes ou lançamentos vinculados.`
            : `Deseja enviar ${quantidadeSelecionados} cliente(s) para a lixeira? Eles sairão da lista de ativos, mas OS e histórico permanecem.`
        }
        aviso={
          mostrarExcluidos
            ? "Se ainda existir vínculo, o cadastro continuará apenas inativo."
            : "Clientes com OS ou pacientes ficam inativos (não apagam o histórico)."
        }
        onClose={() => setExclusaoMultiplaAberta(false)}
        onConfirm={confirmarExclusaoMultipla}
      />

      <ConfirmacaoExclusaoModal
        open={!!clienteParaExcluir}
        titulo={mostrarExcluidos ? "Excluir definitivamente" : "Enviar para a lixeira"}
        mensagem={
          mostrarExcluidos
            ? "Deseja remover este cliente do sistema? Só é possível se não houver OS, pacientes ou lançamentos vinculados."
            : "Deseja enviar este cliente para a lixeira? Ele sairá da lista de ativos, mas OS e histórico permanecem."
        }
        aviso={
          mostrarExcluidos
            ? "Se ainda existir vínculo, o cadastro continuará apenas inativo."
            : "Clientes com OS ou pacientes ficam inativos (não apagam o histórico)."
        }
        detalhe={clienteParaExcluir?.nome}
        onClose={() => setClienteParaExcluir(null)}
        onConfirm={confirmarExclusaoCliente}
      />
    </div>
  );
}

