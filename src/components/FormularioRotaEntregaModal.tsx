"use client";

import { useI18n } from "@/components/i18n-provider";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Truck, User } from "lucide-react";
import { Modal, SelectPesquisavel } from "@/components/ui";
import { CampoDataBr } from "@/components/campo-data-br";
import { partesEnderecoCliente } from "@/lib/cliente-endereco";
import {
  custoEntregaCliente,
  entregadorCliente,
  tipoEntregadorCliente,
} from "@/lib/cliente-entrega";
import { readStorage } from "@/lib/persisted-storage";
import { entregaJaExisteParaOs } from "@/lib/controle-entregas-automatico-cliente";
import {
  atualizarEntrega,
  carregarEntregas,
  criarEntrega,
  DESCRICOES_ENTREGA_PADRAO,
  entregaParaFormRota,
  formRotaEntregaPadrao,
  formRotaParaEntrega,
  formatarCepEntrega,
  formatarMoedaEntrega,
  TIPOS_DESTINATARIO_ENTREGA,
  TIPOS_ENTREGADOR,
  type EntregaControle,
  type FormRotaEntrega,
  type TipoDestinatarioEntregaForm,
} from "@/lib/controle-entregas";
import { carregarPrestadoresListagem } from "@/lib/prestadores-listagem";
import {
  carregarEntregadoresCadastro,
  ENTREGADORES_CADASTRO_EVENT,
  type EntregadorCadastro,
} from "@/lib/entregadores-cadastro";

const FORNECEDORES_STORAGE_KEY = "labProteseFornecedores";

type ClienteApi = {
  id: string;
  nome: string;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  observacoes?: string | null;
};

type TrabalhoApi = {
  id?: string;
  numeroOs: number;
  tipoProtese?: string | null;
  dataEntrada?: string | null;
  cliente?: { id?: string; nome?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

type FornecedorApi = {
  nome: string;
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  complemento?: string;
};

type Props = {
  open: boolean;
  editando: EntregaControle | null;
  onClose: () => void;
  onSalvo: () => void;
};

function labelCampo(texto: string) {
  return <span className="mb-0.5 block text-[11px] text-slate-600">{texto}</span>;
}

function inputClassName() {
  return "h-8 w-full rounded border border-[#d1d5db] bg-white px-2 text-[11px] text-slate-700 focus:border-blue-500 focus:outline-none";
}

function selectClassName() {
  return inputClassName();
}

function tituloSecao(icon: React.ReactNode, texto: string) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-semibold text-slate-700">
      {icon}
      {texto}
    </h3>
  );
}

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

function formatCurrencyInput(value: string) {
  return parseCurrencyInput(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function FormularioRotaEntregaModal({
  open,
  editando,
  onClose,
  onSalvo,
}: Props) {
  const { t } = useI18n();

  const opcoesTipoDestinatario = useMemo(
    () =>
      TIPOS_DESTINATARIO_ENTREGA.map((item) => ({
        value: item.value,
        label:
          item.value === ""
            ? t("producao.entregas.rota.selecioneDestinatario")
            : item.value === "cliente"
              ? t("producao.entregas.rota.tipoCliente")
              : item.value === "fornecedor"
                ? t("producao.entregas.rota.tipoFornecedor")
                : t("producao.entregas.rota.tipoPrestador"),
      })),
    [t]
  );

  function labelNomeDestinatarioI18n(tipo: TipoDestinatarioEntregaForm) {
    if (tipo === "cliente") return t("producao.entregas.rota.nomeCliente");
    if (tipo === "fornecedor") return t("producao.entregas.rota.nomeFornecedor");
    if (tipo === "prestador") return t("producao.entregas.rota.nomePrestador");
    return t("producao.entregas.rota.nomeDestinatario");
  }

  const [form, setForm] = useState<FormRotaEntrega>(formRotaEntregaPadrao());
  const [clientes, setClientes] = useState<ClienteApi[]>([]);
  const [entregadoresCadastro, setEntregadoresCadastro] = useState<EntregadorCadastro[]>([]);
  const [buscandoOs, setBuscandoOs] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [osModalAberto, setOsModalAberto] = useState(false);
  const [osSaiuEntrega, setOsSaiuEntrega] = useState<TrabalhoApi[]>([]);
  const [osSelecionadas, setOsSelecionadas] = useState<number[]>([]);

  function recarregarEntregadoresCadastro() {
    setEntregadoresCadastro(carregarEntregadoresCadastro());
  }

  const prestadores = useMemo(() => carregarPrestadoresListagem(), [open]);
  const fornecedores = useMemo(() => {
    const lista = readStorage<FornecedorApi[]>(FORNECEDORES_STORAGE_KEY, []);
    return (Array.isArray(lista) ? lista : [])
      .map((item) => ({
        nome: item.nome?.trim() || "",
        cep: item.cep,
        rua: item.rua,
        numero: item.numero,
        cidade: item.cidade,
        uf: item.uf,
        bairro: item.bairro,
        complemento: item.complemento,
      }))
      .filter((item) => item.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForm(editando ? entregaParaFormRota(editando) : formRotaEntregaPadrao());
    setOsModalAberto(false);
    setOsSaiuEntrega([]);
    setOsSelecionadas([]);
    recarregarEntregadoresCadastro();
    void fetch("/api/clientes")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setClientes(Array.isArray(data) ? data : []))
      .catch(() => setClientes([]));
  }, [open, editando]);

  useEffect(() => {
    const atualizar = () => recarregarEntregadoresCadastro();
    window.addEventListener(ENTREGADORES_CADASTRO_EVENT, atualizar);
    return () => window.removeEventListener(ENTREGADORES_CADASTRO_EVENT, atualizar);
  }, []);

  const nomesDestinatario = useMemo(() => {
    if (form.tipoDestinatario === "cliente") {
      return clientes.map((item) => item.nome).filter(Boolean);
    }
    if (form.tipoDestinatario === "fornecedor") {
      return fornecedores.map((item) => item.nome);
    }
    if (form.tipoDestinatario === "prestador") {
      return prestadores.map((item) => item.nome);
    }
    return [];
  }, [form.tipoDestinatario, clientes, fornecedores, prestadores]);

  const descricoesSugeridas = useMemo(() => {
    const extras = editando?.descricao ? [editando.descricao] : [];
    return Array.from(new Set([...DESCRICOES_ENTREGA_PADRAO, ...extras])).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [editando]);

  const opcoesEntregador = useMemo(() => {
    const nomes = new Set(entregadoresCadastro.map((item) => item.nome));
    if (form.entregador.trim()) nomes.add(form.entregador.trim());
    return Array.from(nomes)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((nome) => ({ value: nome, label: nome }));
  }, [entregadoresCadastro, form.entregador]);

  function atualizar<K extends keyof FormRotaEntrega>(chave: K, valor: FormRotaEntrega[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function preencherEndereco(
    origem?: {
      cep?: string | null;
      rua?: string | null;
      endereco?: string | null;
      numero?: string | null;
      cidade?: string | null;
      uf?: string | null;
      bairro?: string | null;
      complemento?: string | null;
    } | null
  ) {
    if (!origem) return;
    setForm((atual) => ({
      ...atual,
      cep: origem.cep ? formatarCepEntrega(origem.cep) : atual.cep,
      rua: origem.rua || origem.endereco || atual.rua,
      numeroEndereco: origem.numero || atual.numeroEndereco,
      cidade: origem.cidade || atual.cidade,
      uf: origem.uf || atual.uf,
      bairro: origem.bairro || atual.bairro,
      complemento: origem.complemento || atual.complemento,
    }));
  }

  function aplicarEntregaCliente(observacoes?: string | null) {
    if (!observacoes) return {};
    const entregador = entregadorCliente(observacoes);
    const tipoEntregador = tipoEntregadorCliente(observacoes);
    const custo = custoEntregaCliente(observacoes);
    return {
      ...(entregador ? { entregador } : {}),
      ...(tipoEntregador ? { tipoEntregador } : {}),
      ...(custo > 0 ? { valor: formatarMoedaEntrega(custo) } : {}),
    };
  }

  function aoSelecionarEntregador(nome: string) {
    const cadastro = entregadoresCadastro.find((item) => item.nome === nome);
    setForm((atual) => ({
      ...atual,
      entregador: nome,
      ...(cadastro?.tipoEntregador ? { tipoEntregador: cadastro.tipoEntregador } : {}),
    }));
  }

  function clienteSelecionado() {
    if (form.tipoDestinatario !== "cliente") return undefined;
    const nome = form.nomeDestinatario.trim();
    if (!nome) return undefined;
    return clientes.find((item) => item.nome === nome);
  }

  function enderecoDoCliente(cliente?: ClienteApi | null) {
    const partes = partesEnderecoCliente(cliente?.observacoes, cliente?.endereco);
    return {
      cep: cliente?.cep ? formatarCepEntrega(cliente.cep) : "",
      rua: partes.rua,
      numeroEndereco: partes.numero,
      cidade: cliente?.cidade || "",
      uf: (cliente?.uf || "").toUpperCase().slice(0, 2),
      bairro: partes.bairro,
      complemento: partes.complemento,
    };
  }

  function aplicarClienteNoForm(
    atual: FormRotaEntrega,
    cliente: ClienteApi | undefined,
    extras: Partial<FormRotaEntrega>
  ): FormRotaEntrega {
    return {
      ...atual,
      ...extras,
      ...(cliente
        ? {
            ...enderecoDoCliente(cliente),
            ...aplicarEntregaCliente(cliente.observacoes),
          }
        : {}),
    };
  }

  function aoSelecionarDestinatario(nome: string) {
    if (form.tipoDestinatario === "cliente") {
      const cliente = clientes.find((item) => item.nome === nome);
      setForm((atual) => {
        if (!cliente) {
          return {
            ...atual,
            nomeDestinatario: nome,
            cep: "",
            rua: "",
            numeroEndereco: "",
            cidade: "",
            uf: "",
            bairro: "",
            complemento: "",
          };
        }
        return aplicarClienteNoForm(atual, cliente, {
          nomeDestinatario: nome,
          tipoDestinatario: "cliente",
        });
      });
      return;
    }
    if (form.tipoDestinatario === "fornecedor") {
      preencherEndereco(fornecedores.find((item) => item.nome === nome));
      atualizar("nomeDestinatario", nome);
      return;
    }
    atualizar("nomeDestinatario", nome);
  }

  function osJaNoControle(numeroOs: number) {
    return entregaJaExisteParaOs(carregarEntregas(), numeroOs);
  }

  async function abrirOsSaiuEntrega() {
    const cliente = clienteSelecionado();
    if (!cliente) {
      alert(t("producao.entregas.rota.selecioneClienteOs"));
      return;
    }
    setBuscandoOs(true);
    setOsModalAberto(true);
    setOsSelecionadas([]);
    try {
      const params = new URLSearchParams({
        status: "saiu_entrega",
        clienteId: cliente.id,
      });
      const res = await fetch(`/api/trabalhos?${params}`);
      const data = await res.json();
      const lista = (Array.isArray(data) ? data : []) as TrabalhoApi[];
      const nome = cliente.nome.trim().toLowerCase();
      const doCliente = lista.filter((item) => {
        const mesmoId = item.cliente?.id === cliente.id;
        const mesmoNome = (item.cliente?.nome || "").trim().toLowerCase() === nome;
        return mesmoId || mesmoNome;
      });
      const porOs = new Map<number, TrabalhoApi>();
      for (const item of doCliente) {
        const atual = porOs.get(item.numeroOs);
        if (!atual) {
          porOs.set(item.numeroOs, item);
          continue;
        }
        const servicos = [atual.tipoProtese, item.tipoProtese]
          .map((servico) => (servico || "").trim())
          .filter(Boolean);
        porOs.set(item.numeroOs, {
          ...atual,
          tipoProtese: Array.from(new Set(servicos)).join(", ") || atual.tipoProtese,
          paciente: atual.paciente?.nome ? atual.paciente : item.paciente,
        });
      }
      setOsSaiuEntrega(
        Array.from(porOs.values()).sort((a, b) => b.numeroOs - a.numeroOs)
      );
    } catch {
      setOsSaiuEntrega([]);
    } finally {
      setBuscandoOs(false);
    }
  }

  function usarOsNaEntrega(trabalho: TrabalhoApi) {
    const nomeCliente = trabalho.cliente?.nome || form.nomeDestinatario;
    const cliente =
      clientes.find((item) => item.id === trabalho.cliente?.id) ||
      clientes.find((item) => item.nome === nomeCliente) ||
      clienteSelecionado();
    setForm((atual) =>
      aplicarClienteNoForm(atual, cliente, {
        numeroOs: String(trabalho.numeroOs),
        tipoDestinatario: "cliente",
        nomeDestinatario: nomeCliente,
        descricao: trabalho.tipoProtese?.trim() || atual.descricao,
      })
    );
    setOsModalAberto(false);
  }

  function cadastrarOsSelecionadas() {
    if (!form.entregador.trim()) {
      alert(t("producao.entregas.rota.informeEntregador"));
      return;
    }
    const escolhidas = osSaiuEntrega.filter(
      (item) => osSelecionadas.includes(item.numeroOs) && !osJaNoControle(item.numeroOs)
    );
    if (escolhidas.length === 0) {
      alert(t("producao.entregas.rota.selecioneOs"));
      return;
    }
    const cliente = clienteSelecionado();
    let cadastradas = 0;
    for (const trabalho of escolhidas) {
      if (entregaJaExisteParaOs(carregarEntregas(), trabalho.numeroOs)) continue;
      const nomeCliente = trabalho.cliente?.nome || form.nomeDestinatario;
      const base = aplicarClienteNoForm(form, cliente, {
        numeroOs: String(trabalho.numeroOs),
        tipoDestinatario: "cliente",
        nomeDestinatario: nomeCliente,
        descricao: trabalho.tipoProtese?.trim() || form.descricao.trim() || "Entrega de prótese",
      });
      criarEntrega(formRotaParaEntrega(base, parseCurrencyInput));
      cadastradas += 1;
    }
    if (cadastradas === 0) {
      alert(t("producao.entregas.rota.osJaCadastrada"));
      return;
    }
    alert(t("producao.entregas.rota.osCadastradas", { n: cadastradas }));
    onSalvo();
    setOsModalAberto(false);
    onClose();
  }

  async function buscarOs() {
    const termo = form.numeroOs.trim();
    if (!termo) {
      await abrirOsSaiuEntrega();
      return;
    }
    setBuscandoOs(true);
    try {
      const res = await fetch(`/api/trabalhos?q=${encodeURIComponent(termo)}`);
      const data = await res.json();
      const trabalho = (Array.isArray(data) ? data[0] : null) as TrabalhoApi | null;
      if (!trabalho) {
        alert(t("producao.entregas.rota.osNaoEncontrada"));
        return;
      }
      const nomeCliente = trabalho.cliente?.nome || form.nomeDestinatario;
      const cliente =
        clientes.find((item) => item.id === trabalho.cliente?.id) ||
        clientes.find((item) => item.nome === nomeCliente);
      setForm((atual) =>
        aplicarClienteNoForm(atual, cliente, {
          numeroOs: String(trabalho.numeroOs),
          tipoDestinatario: "cliente",
          nomeDestinatario: nomeCliente,
          descricao: trabalho.tipoProtese || atual.descricao,
        })
      );
    } finally {
      setBuscandoOs(false);
    }
  }

  async function buscarCep() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        alert(t("cadastros.comum.alerta.cepNaoEncontrado"));
        return;
      }
      setForm((atual) => ({
        ...atual,
        rua: data.logradouro || atual.rua,
        bairro: data.bairro || atual.bairro,
        cidade: data.localidade || atual.cidade,
        uf: data.uf || atual.uf,
        complemento: data.complemento || atual.complemento,
      }));
    } finally {
      setBuscandoCep(false);
    }
  }

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!form.tipoDestinatario) return;
    if (!form.nomeDestinatario.trim()) return;
    if (!form.dataEntrega.trim()) return;
    if (!form.descricao.trim()) return;
    if (!form.entregador.trim()) return;
    const numeroOs = form.numeroOs.trim();
    const numeroOsNumero = Number(numeroOs);
    if (
      !editando &&
      numeroOs &&
      Number.isFinite(numeroOsNumero) &&
      entregaJaExisteParaOs(carregarEntregas(), numeroOsNumero)
    ) {
      alert(t("producao.entregas.rota.osJaCadastrada"));
      return;
    }

    const payload = formRotaParaEntrega(form, parseCurrencyInput);
    if (editando) {
      atualizarEntrega(editando.id, {
        ...payload,
        dataFinalizado:
          editando.situacao === "entregue"
            ? editando.dataFinalizado || payload.dataFinalizado
            : payload.dataFinalizado,
      });
    } else {
      criarEntrega(payload);
    }
    onSalvo();
    onClose();
  }

  const destinatarioRodape = form.nomeDestinatario.trim() || "—";

  const osPendentes = osSaiuEntrega.filter((item) => !osJaNoControle(item.numeroOs));

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={
        editando
          ? t("producao.entregas.rota.editarTitulo")
          : t("producao.entregas.rota.cadastrarTitulo")
      }
      size="xl"
    >
      <form onSubmit={salvar} className="space-y-5 text-[11px] text-slate-600">
        <section className="space-y-3">
          {tituloSecao(
            <User className="h-3.5 w-3.5" />,
            t("producao.entregas.rota.cadastrarTitulo")
          )}
          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_1fr]">
            <div>
              {labelCampo(t("producao.entregas.rota.numeroOsOpcional"))}
              <div className="flex gap-1">
                <input
                  value={form.numeroOs}
                  onChange={(e) => atualizar("numeroOs", e.target.value)}
                  placeholder={t("producao.entregas.rota.buscarInfoOs")}
                  className={inputClassName()}
                />
                <button
                  type="button"
                  onClick={() => void buscarOs()}
                  disabled={buscandoOs}
                  className="h-8 shrink-0 rounded border border-slate-300 bg-slate-100 px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-60"
                >
                  {buscandoOs ? "..." : t("cadastros.comum.buscar")}
                </button>
              </div>
            </div>
            <div>
              {labelCampo(t("producao.entregas.rota.tipoDestinatario"))}
              <select
                value={form.tipoDestinatario}
                onChange={(e) => {
                  const tipo = e.target.value as TipoDestinatarioEntregaForm;
                  setForm((atual) => ({
                    ...atual,
                    tipoDestinatario: tipo,
                    nomeDestinatario: "",
                    cep: "",
                    rua: "",
                    numeroEndereco: "",
                    cidade: "",
                    uf: "",
                    bairro: "",
                    complemento: "",
                  }));
                }}
                className={selectClassName()}
              >
                {opcoesTipoDestinatario.map((item) => (
                  <option key={item.value || "placeholder"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <SelectPesquisavel
                label={labelNomeDestinatarioI18n(form.tipoDestinatario)}
                value={form.nomeDestinatario}
                onChange={aoSelecionarDestinatario}
                placeholder={t("cadastros.comum.selecione")}
                disabled={!form.tipoDestinatario}
                inputClassName={selectClassName()}
                menuEmPortal
                options={nomesDestinatario.map((nome) => ({ value: nome, label: nome }))}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {tituloSecao(<MapPin className="h-3.5 w-3.5" />, t("cadastros.comum.endereco"))}
          <div className="grid gap-3 md:grid-cols-[0.9fr_1.6fr_0.5fr]">
            <div>
              {labelCampo(t("cadastros.comum.cep"))}
              <div className="flex gap-1">
                <input
                  value={form.cep}
                  onChange={(e) => atualizar("cep", formatarCepEntrega(e.target.value))}
                  placeholder={t("producao.entregas.rota.placeholderCep")}
                  className={inputClassName()}
                />
                <button
                  type="button"
                  onClick={() => void buscarCep()}
                  disabled={buscandoCep}
                  className="h-8 shrink-0 rounded border border-slate-300 bg-slate-100 px-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-60"
                >
                  {buscandoCep ? "..." : t("cadastros.comum.buscarEndereco")}
                </button>
              </div>
            </div>
            <div>
              {labelCampo(t("cadastros.comum.rua"))}
              <input
                value={form.rua}
                onChange={(e) => atualizar("rua", e.target.value)}
                className={inputClassName()}
              />
            </div>
            <div>
              {labelCampo(t("cadastros.comum.numero"))}
              <input
                value={form.numeroEndereco}
                onChange={(e) => atualizar("numeroEndereco", e.target.value)}
                className={inputClassName()}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              {labelCampo(t("cadastros.comum.cidade"))}
              <input
                value={form.cidade}
                onChange={(e) => atualizar("cidade", e.target.value)}
                className={inputClassName()}
              />
            </div>
            <div>
              {labelCampo(t("cadastros.comum.uf"))}
              <input
                value={form.uf}
                onChange={(e) => atualizar("uf", e.target.value.toUpperCase().slice(0, 2))}
                className={inputClassName()}
              />
            </div>
            <div>
              {labelCampo(t("cadastros.comum.bairro"))}
              <input
                value={form.bairro}
                onChange={(e) => atualizar("bairro", e.target.value)}
                className={inputClassName()}
              />
            </div>
            <div>
              {labelCampo(t("cadastros.comum.complemento"))}
              <input
                value={form.complemento}
                onChange={(e) => atualizar("complemento", e.target.value)}
                className={inputClassName()}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {tituloSecao(<Truck className="h-3.5 w-3.5" />, t("producao.comum.entregador"))}
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <SelectPesquisavel
                label={t("producao.entregas.rota.nomeEntregadorObrigatorio")}
                value={form.entregador}
                onChange={aoSelecionarEntregador}
                placeholder={t("cadastros.comum.selecione")}
                inputClassName={selectClassName()}
                menuEmPortal
                options={opcoesEntregador}
              />
              {entregadoresCadastro.length === 0 ? (
                <p className="mt-1 text-[10px] text-slate-500">
                  {t("producao.entregas.rota.semEntregadorCadastro")}
                </p>
              ) : null}
            </div>
            <div>
              <CampoDataBr
                label={`${t("producao.comum.data")}*`}
                value={form.dataEntrega}
                onChange={(valor) => atualizar("dataEntrega", valor)}
                placeholder={t("cadastros.comum.placeholderData")}
                inputClassName="h-8 text-[11px]"
                className="[&_label]:text-[11px]"
              />
            </div>
            <div>
              {labelCampo(t("producao.entregas.rota.hora"))}
              <input
                type="time"
                value={form.hora}
                onChange={(e) => atualizar("hora", e.target.value)}
                className={inputClassName()}
              />
            </div>
            <div>
              {labelCampo(t("producao.comum.valor"))}
              <div className="flex h-8 items-center overflow-hidden rounded border border-[#d1d5db] bg-white">
                <span className="border-r border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500">
                  R$
                </span>
                <input
                  value={form.valor.replace(/^R\$\s?/, "")}
                  onChange={(e) =>
                    atualizar("valor", formatCurrencyInput(`R$ ${e.target.value.replace(/\D/g, "")}`))
                  }
                  className="h-full w-full px-2 text-[11px] text-slate-700 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              {labelCampo(t("cadastros.comum.tipoEntregador"))}
              <select
                value={form.tipoEntregador}
                onChange={(e) => atualizar("tipoEntregador", e.target.value)}
                className={selectClassName()}
              >
                <option value="">{t("cadastros.comum.selecione")}</option>
                {TIPOS_ENTREGADOR.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {labelCampo(`${t("producao.comum.descricao")}*`)}
              <input
                list="descricoes-rota"
                value={form.descricao}
                onChange={(e) => atualizar("descricao", e.target.value)}
                placeholder={t("producao.entregas.rota.descricaoPlaceholder")}
                className={inputClassName()}
                required
              />
              <datalist id="descricoes-rota">
                {descricoesSugeridas.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
            <div>
              {labelCampo(t("producao.entregas.rota.observacao"))}
              <input
                value={form.observacao}
                onChange={(e) => atualizar("observacao", e.target.value)}
                className={inputClassName()}
              />
            </div>
          </div>
        </section>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded bg-[#4a90d9] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#3d7fc4]"
            >
              {t("common.gravarAlteracoes")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t("cadastros.comum.fechar")}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {t("producao.entregas.rota.destinatarioRodape")}{" "}
            <span className="font-medium text-slate-700">{destinatarioRodape}</span>
          </p>
        </div>
      </form>
    </Modal>

    <Modal
      open={osModalAberto}
      onClose={() => setOsModalAberto(false)}
      title={t("producao.entregas.rota.osSaiuEntregaTitulo")}
      size="lg"
      layerClassName="z-[60]"
    >
      <div className="space-y-3 text-[11px] text-slate-600">
        <p>
          {t("producao.entregas.rota.osSaiuEntregaCliente", {
            nome: form.nomeDestinatario.trim() || "—",
          })}
        </p>
        {buscandoOs ? (
          <p className="py-6 text-center text-slate-500">...</p>
        ) : osSaiuEntrega.length === 0 ? (
          <p className="py-6 text-center text-slate-500">
            {t("producao.entregas.rota.osSaiuEntregaVazio")}
          </p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto rounded border border-slate-200">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2 text-left">{t("producao.controle.tabela.os")}</th>
                  <th className="px-2 py-2 text-left">{t("producao.entregas.rota.paciente")}</th>
                  <th className="px-2 py-2 text-left">{t("producao.entregas.rota.servico")}</th>
                  <th className="px-2 py-2 text-right">{t("common.opcoes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {osSaiuEntrega.map((item) => {
                  const jaCadastrada = osJaNoControle(item.numeroOs);
                  return (
                    <tr key={item.id || item.numeroOs} className="hover:bg-slate-50">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={osSelecionadas.includes(item.numeroOs)}
                          disabled={jaCadastrada}
                          onChange={() =>
                            setOsSelecionadas((atual) =>
                              atual.includes(item.numeroOs)
                                ? atual.filter((numero) => numero !== item.numeroOs)
                                : [...atual, item.numeroOs]
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-2 py-2 font-semibold text-slate-700">{item.numeroOs}</td>
                      <td className="px-2 py-2">{item.paciente?.nome || "—"}</td>
                      <td className="px-2 py-2">
                        {item.tipoProtese || "—"}
                        {jaCadastrada ? (
                          <p className="mt-0.5 text-[10px] text-emerald-700">
                            {t("producao.entregas.rota.osJaCadastrada")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => usarOsNaEntrega(item)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t("producao.entregas.rota.usarOs")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={cadastrarOsSelecionadas}
            disabled={osPendentes.length === 0}
            className="rounded bg-[#4a90d9] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-50"
          >
            {t("producao.entregas.rota.cadastrarSelecionadas")}
          </button>
          <button
            type="button"
            onClick={() => setOsModalAberto(false)}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            {t("cadastros.comum.fechar")}
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}
