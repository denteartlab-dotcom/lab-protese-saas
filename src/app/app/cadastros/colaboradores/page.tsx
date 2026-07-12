"use client";

import { BriefcaseBusiness, CreditCard, Download, Edit3, Eye, Home, MapPin, Percent, Printer, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, Fragment } from "react";
import { CargaHorariaColaboradorModal } from "@/components/colaboradores/CargaHorariaColaboradorModal";
import { PdfViewerModal } from "@/components/dashboard/PdfViewerModal";
import { CampoDataBr } from "@/components/campo-data-br";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { ModuloCabecalho } from "@/components/ModuloCabecalho";
import { useI18n } from "@/components/i18n-provider";
import { compararTextoBr } from "@/lib/listagem-config";
import { exibirTelefone, formatarTelefone, PLACEHOLDER_TELEFONE_BR } from "@/lib/validar-documento";
import { usePageReady } from "@/hooks/use-page-ready";
import {
  clonarHorarioFuncionamento,
  type HorarioFuncionamentoConfig,
} from "@/lib/horario-funcionamento";
import { readStorage, writeStorage, readStorageArray } from "@/lib/persisted-storage";
import {
  formatValorMonetarioInput,
  formatarSalarioExibicao,
  montarTextoExemploRemuneracao,
  usaComissaoColaborador,
  usaSalarioColaborador,
} from "@/lib/colaborador-remuneracao";

type Colaborador = {
  id: string;
  nome: string;
  email: string;
  celular: string;
  whatsapp: string;
  setorAtuacao: string;
  setorCor: string;
  comissaoPercentual: string;
  dados?: Record<string, string>;
  cargaHoraria?: HorarioFuncionamentoConfig;
};

type Setor = {
  id?: string;
  nome: string;
  cor: string;
};

const SETORES_STORAGE_KEY = "labProteseSetores";
const COLABORADORES_STORAGE_KEY = "labProteseColaboradores";
const COLABORADORES_EXCLUIDOS_STORAGE_KEY = "labProteseColaboradoresExcluidos";

const formularioVazio = {
  nome: "",
  cro: "",
  cargo: "",
  cpf: "",
  email: "",
  dataNascimento: "",
  rg: "",
  telefoneResidencial: "",
  telefoneComercial: "",
  celular: "",
  whatsapp: "",
  dataContratacao: "",
  tipoContratacao: "Salário",
  valorSalario: "0,00",
  setor: "",
  pisPasep: "",
  numeroCtps: "",
  serie: "",
  uf: "",
  codigoBanco: "",
  agencia: "",
  conta: "",
  chavePix: "",
  valorComissao: "0,00",
  tipoValorComissao: "%",
  comissaoRepeticao: "0,00",
  tipoValorComissaoRepeticao: "%",
  descricaoComissao: "Não",
  cep: "",
  rua: "",
  numero: "",
  cidade: "",
  ufEndereco: "",
  bairro: "",
  complemento: "",
};

function formatCepInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPercentInput(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const formatMoneyInput = formatPercentInput;

function CampoValorSalario({
  label,
  valor,
  onChange,
  disabled = false,
}: {
  label: string;
  valor: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}) {
  const labelClass = "mb-1 block text-[9px] text-slate-500";
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div
        className={`flex h-8 overflow-hidden rounded border border-slate-300 bg-white ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <span className="flex w-9 shrink-0 items-center justify-center border-r border-slate-200 bg-white text-[10px] text-slate-500">
          R$
        </span>
        <input
          value={valor}
          disabled={disabled}
          onChange={(event) => onChange(formatValorMonetarioInput(event.target.value))}
          className="w-full px-2 text-[10px] text-slate-600 outline-none disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

function CampoValorComissao({
  label,
  valor,
  tipo,
  onValorChange,
  onTipoChange,
}: {
  label: string;
  valor: string;
  tipo: string;
  onValorChange: (valor: string) => void;
  onTipoChange: (tipo: string) => void;
}) {
  const { t } = useI18n();
  const labelClass = "mb-1 block text-[9px] text-slate-500";
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex h-8 overflow-hidden rounded border border-slate-300 bg-white">
        <select
          value={tipo}
          onChange={(event) => onTipoChange(event.target.value)}
          className="w-9 shrink-0 border-r border-slate-200 bg-white text-center text-[10px] text-slate-500 outline-none"
          aria-label={t("cadastros.comum.unidadeDe", { label })}
        >
          <option value="%">%</option>
          <option value="R$">R$</option>
        </select>
        <input
          value={valor}
          onChange={(event) =>
            onValorChange(
              tipo === "R$"
                ? formatMoneyInput(event.target.value)
                : formatPercentInput(event.target.value)
            )
          }
          className="w-full px-2 text-[10px] text-slate-600 outline-none"
        />
      </div>
    </div>
  );
}

function carregarSetoresCadastrados() {
  if (typeof window === "undefined") return [];
  const parsed = readStorage<Setor[]>(SETORES_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function carregarLista<T>(key: string, fallback: T[] = []) {
  if (typeof window === "undefined") return fallback;
  return readStorageArray(key, fallback);
}

export default function ColaboradoresPage() {
  const { t } = useI18n();
  const [busca, setBusca] = useState("");
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [colaboradoresExcluidos, setColaboradoresExcluidos] = useState<Colaborador[]>([]);
  const [colaboradoresCarregados, setColaboradoresCarregados] = useState(false);
  const [colaboradoresExcluidosCarregados, setColaboradoresExcluidosCarregados] = useState(false);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(formularioVazio);
  const [colaboradorEditando, setColaboradorEditando] = useState<Colaborador | null>(null);
  const [colaboradorAberto, setColaboradorAberto] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setoresCarregados, setSetoresCarregados] = useState(false);
  const [dropdownSetorAberto, setDropdownSetorAberto] = useState(false);
  const [modalSetorAberto, setModalSetorAberto] = useState(false);
  const [novoSetor, setNovoSetor] = useState({ nome: "", cor: "#5b5ce2" });
  const [pdfColaboradoresUrl, setPdfColaboradoresUrl] = useState<string | null>(null);
  const [modalCargaHorariaAberto, setModalCargaHorariaAberto] = useState(false);
  const [cargaHoraria, setCargaHoraria] = useState<HorarioFuncionamentoConfig>(() =>
    clonarHorarioFuncionamento()
  );

  const paginaPronta = usePageReady(() => {
    setColaboradores(carregarLista(COLABORADORES_STORAGE_KEY));
    setColaboradoresExcluidos(carregarLista(COLABORADORES_EXCLUIDOS_STORAGE_KEY, []));
    setColaboradoresCarregados(true);
    setColaboradoresExcluidosCarregados(true);
    setSetores(carregarSetoresCadastrados());
    setSetoresCarregados(true);
  });

  useEffect(() => {
    if (!paginaPronta) return;

    function carregarSetores() {
      setSetores(carregarSetoresCadastrados());
      setSetoresCarregados(true);
    }

    window.addEventListener("focus", carregarSetores);
    return () => window.removeEventListener("focus", carregarSetores);
  }, [paginaPronta]);

  useEffect(() => {
    if (!setoresCarregados) return;
    writeStorage(SETORES_STORAGE_KEY, setores);
  }, [setores, setoresCarregados]);

  useEffect(() => {
    if (!colaboradoresCarregados) return;
    writeStorage(COLABORADORES_STORAGE_KEY, colaboradores);
  }, [colaboradores, colaboradoresCarregados]);

  useEffect(() => {
    if (!colaboradoresExcluidosCarregados) return;
    writeStorage(COLABORADORES_EXCLUIDOS_STORAGE_KEY, colaboradoresExcluidos);
  }, [colaboradoresExcluidos, colaboradoresExcluidosCarregados]);

  const colaboradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = mostrarExcluidos ? colaboradoresExcluidos : colaboradores;
    if (!termo) return lista;

    return lista.filter((colaborador) =>
      [colaborador.nome, colaborador.email, colaborador.celular, colaborador.whatsapp, colaborador.setorAtuacao]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, colaboradores, colaboradoresExcluidos, mostrarExcluidos]);

  function excluirColaborador(id: string) {
    const colaborador = colaboradores.find((item) => item.id === id);
    if (colaborador) {
      setColaboradoresExcluidos((atuais) => {
        const atualizados = [...atuais, colaborador];
        writeStorage(COLABORADORES_EXCLUIDOS_STORAGE_KEY, atualizados);
        return atualizados;
      });
    }
    setColaboradores((atuais) => {
      const atualizados = atuais.filter((item) => item.id !== id);
      writeStorage(COLABORADORES_STORAGE_KEY, atualizados);
      return atualizados;
    });
    if (colaboradorAberto === id) setColaboradorAberto(null);
  }

  function restaurarColaborador(id: string) {
    const colaborador = colaboradoresExcluidos.find((item) => item.id === id);
    if (colaborador) {
      setColaboradores((atuais) => [...atuais, colaborador]);
    }
    setColaboradoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
  }

  function removerColaboradorDefinitivo(id: string) {
    setColaboradoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
    if (colaboradorAberto === id) setColaboradorAberto(null);
  }

  async function abrirPdfColaboradores() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const hoje = new Date().toLocaleDateString("pt-BR");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(t("cadastros.colaboradores.pdfTitulo"), 105, 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(hoje, 105, 24, { align: "center" });

    let y = 38;
    colaboradores.forEach((colaborador) => {
      const dados = colaborador.dados || {};
      if (y > 275) {
        doc.addPage();
        y = 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text(t("cadastros.colaboradores.pdfColaborador"), 22, y);
      doc.setFont("helvetica", "normal");
      doc.text(colaborador.nome || "-", 38, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${t("cadastros.comum.cpf")}:`, 73, y);
      doc.setFont("helvetica", "normal");
      doc.text(dados.cpf || "-", 81, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${t("cadastros.comum.cro")}:`, 105, y);
      doc.setFont("helvetica", "normal");
      doc.text(dados.cro || "-", 114, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${t("cadastros.comum.cnpj")}:`, 137, y);
      doc.setFont("helvetica", "normal");
      doc.text("-", 147, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${t("cadastros.comum.email")}:`, 154, y);
      doc.setFont("helvetica", "normal");
      doc.text(colaborador.email || "-", 165, y);

      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(t("cadastros.colaboradores.pdfCargo"), 22, y);
      doc.setFont("helvetica", "normal");
      doc.text(dados.cargo || colaborador.setorAtuacao || "-", 33, y);
      doc.setFont("helvetica", "bold");
      doc.text(t("cadastros.colaboradores.pdfDataContratacao"), 62, y);
      doc.setFont("helvetica", "normal");
      doc.text(dados.dataContratacao || "-", 88, y);
      doc.setFont("helvetica", "bold");
      doc.text(t("cadastros.colaboradores.pdfDataNascimento"), 112, y);
      doc.setFont("helvetica", "normal");
      doc.text(dados.dataNascimento || "-", 137, y);

      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(t("cadastros.colaboradores.pdfTelResidencial"), 22, y);
      doc.setFont("helvetica", "normal");
      doc.text(dados.telefoneResidencial || "-", 45, y);
      doc.setFont("helvetica", "bold");
      doc.text(t("cadastros.colaboradores.pdfTelComercial"), 70, y);
      doc.setFont("helvetica", "normal");
      doc.text(dados.telefoneComercial || "-", 91, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${t("cadastros.comum.celular")}:`, 112, y);
      doc.setFont("helvetica", "normal");
      doc.text(colaborador.celular || "-", 125, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${t("cadastros.comum.whatsapp")}:`, 145, y);
      doc.setFont("helvetica", "normal");
      doc.text(colaborador.whatsapp || "-", 162, y);

      y += 8;
    });

    const url = URL.createObjectURL(doc.output("blob"));
    if (pdfColaboradoresUrl) URL.revokeObjectURL(pdfColaboradoresUrl);
    setPdfColaboradoresUrl(url);
  }

  function fecharPdfColaboradores() {
    if (pdfColaboradoresUrl) URL.revokeObjectURL(pdfColaboradoresUrl);
    setPdfColaboradoresUrl(null);
  }

  function setCampo(campo: keyof typeof formularioVazio, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function cadastrarColaborador() {
    if (!form.nome.trim()) return;
    const setorSelecionado = setores.find((setor) => setor.nome === form.setor);

    if (colaboradorEditando) {
      setColaboradores((atuais) =>
        atuais.map((colaborador) =>
          colaborador.id === colaboradorEditando.id
            ? {
                ...colaborador,
                nome: form.nome.trim(),
                email: form.email,
                celular: form.celular,
                whatsapp: form.whatsapp,
                setorAtuacao: form.setor || form.cargo || "Prótese",
                setorCor: setorSelecionado?.cor || colaborador.setorCor,
                comissaoPercentual: form.valorComissao,
                dados: { ...form },
                cargaHoraria: clonarHorarioFuncionamento(cargaHoraria),
              }
            : colaborador
        )
      );
      setForm(formularioVazio);
      setColaboradorEditando(null);
      setCargaHoraria(clonarHorarioFuncionamento());
      setModalAberto(false);
      return;
    }

    setColaboradores((atuais) => [
      ...atuais,
      {
        id: `${Date.now()}`,
        nome: form.nome.trim(),
        email: form.email,
        celular: form.celular,
        whatsapp: form.whatsapp,
        setorAtuacao: form.setor || form.cargo || "Prótese",
        setorCor: setorSelecionado?.cor || "#3b82f6",
        comissaoPercentual: form.valorComissao,
        dados: { ...form },
        cargaHoraria: clonarHorarioFuncionamento(cargaHoraria),
      },
    ]);
    setForm(formularioVazio);
    setCargaHoraria(clonarHorarioFuncionamento());
    setModalAberto(false);
  }

  function abrirEdicaoColaborador(colaborador: Colaborador) {
    setColaboradorEditando(colaborador);
    const dados = colaborador.dados || {};
    const tipoRemuneracao =
      dados.tipoContratacao === "Terceirizado"
        ? t("cadastros.comum.remuneracaoSalarioComissao")
        : dados.tipoContratacao;
    setForm({
      ...formularioVazio,
      ...dados,
      nome: colaborador.nome,
      email: colaborador.email,
      celular: colaborador.celular,
      whatsapp: colaborador.whatsapp,
      setor: colaborador.setorAtuacao,
      valorComissao: colaborador.comissaoPercentual,
      tipoContratacao: tipoRemuneracao || formularioVazio.tipoContratacao,
      tipoValorComissao: dados.tipoValorComissao || formularioVazio.tipoValorComissao,
      tipoValorComissaoRepeticao:
        dados.tipoValorComissaoRepeticao || formularioVazio.tipoValorComissaoRepeticao,
    });
    setCargaHoraria(clonarHorarioFuncionamento(colaborador.cargaHoraria));
    setModalAberto(true);
  }

  function fecharModalColaborador() {
    setModalAberto(false);
    setColaboradorEditando(null);
    setForm(formularioVazio);
    setCargaHoraria(clonarHorarioFuncionamento());
    setModalCargaHorariaAberto(false);
  }

  function cadastrarSetor() {
    const nome = novoSetor.nome.trim();
    if (!nome) return;
    const setor = { id: crypto.randomUUID(), nome, cor: novoSetor.cor };
    setSetores((atuais) => {
      if (atuais.some((item) => item.nome.toLowerCase() === nome.toLowerCase())) return atuais;
      const atualizados = [...atuais, setor];
      writeStorage(SETORES_STORAGE_KEY, atualizados);
      return atualizados;
    });
    setCampo("setor", nome);
    setNovoSetor({ nome: "", cor: "#5b5ce2" });
    setModalSetorAberto(false);
    setDropdownSetorAberto(false);
  }

  function excluirSetor(nome: string) {
    setSetores((atuais) => {
      const atualizados = atuais.filter((setor) => setor.nome !== nome);
      writeStorage(SETORES_STORAGE_KEY, atualizados);
      return atualizados;
    });
    if (form.setor === nome) {
      setCampo("setor", "");
    }
  }

  async function buscarEnderecoPorCep(cepInformado = form.cep) {
    const cep = cepInformado.replace(/\D/g, "");
    if (cep.length !== 8) return;

    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data?.erro) return;

      setForm((atual) => ({
        ...atual,
        cep: formatCepInput(cep),
        rua: data.logradouro || atual.rua,
        bairro: data.bairro || atual.bairro,
        cidade: data.localidade || atual.cidade,
        ufEndereco: data.uf || atual.ufEndereco,
      }));
    } finally {
      setBuscandoCep(false);
    }
  }

  const inputClass = "h-8 w-full rounded border border-slate-300 bg-white px-2 text-[10px] text-slate-600 outline-none focus:border-blue-400";
  const labelClass = "mb-1 block text-[9px] text-slate-500";
  const textoExemploRemuneracao = montarTextoExemploRemuneracao(form);
  const exibeSalario = usaSalarioColaborador(form.tipoContratacao);
  const exibeComissao = usaComissaoColaborador(form.tipoContratacao);

  return (
    <div className="min-h-[calc(100vh-90px)] bg-slate-50 px-3 py-4 text-[11px] text-slate-600">
      <ModuloCabecalho moduloKey="nav.cadastros" tituloKey="nav.colaboradores" className="mb-3" />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setColaboradorEditando(null);
              setForm(formularioVazio);
              setCargaHoraria(clonarHorarioFuncionamento());
              setModalAberto(true);
            }}
            className="h-7 rounded bg-emerald-500 px-3 text-[10px] font-semibold text-white shadow-sm hover:bg-emerald-600"
          >
            + {t("cadastros.colaboradores.adicionar")}
          </button>
          <button
            type="button"
            onClick={() => setMostrarExcluidos((atual) => !atual)}
            className="h-7 rounded border border-blue-300 bg-white px-3 text-[10px] font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
          >
            {mostrarExcluidos ? t("cadastros.comum.verAtivos") : t("cadastros.comum.verExcluidos")}
          </button>
          <button
            type="button"
            onClick={abrirPdfColaboradores}
            className="flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white shadow-sm hover:bg-blue-600"
            aria-label={t("cadastros.comum.imprimir")}
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
            aria-label={t("cadastros.comum.exportarAria")}
          >
            <span className="text-xs font-bold">E</span>
          </button>
        </div>

        <div className="flex w-full max-w-[490px] justify-end">
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-7 w-full rounded-l border border-slate-300 bg-white px-3 text-[11px] text-slate-600 outline-none placeholder:text-slate-400 focus:border-blue-400"
            placeholder={t("cadastros.comum.procurar")}
          />
          <button
            type="button"
            onClick={() => setBusca("")}
            className="h-7 rounded-r bg-slate-500 px-4 text-[10px] font-semibold text-white hover:bg-slate-600"
          >
            Limpar
          </button>
        </div>
      </div>

      <ListagemPorNome
        storageKey="colaboradores"
        itens={paginaPronta ? colaboradoresFiltrados : []}
        opcoesExtras={[
          {
            valor: "email",
            label: t("cadastros.comum.email"),
            comparar: (a, b) => compararTextoBr(a.email, b.email),
          },
          {
            valor: "setorAtuacao",
            label: t("cadastros.comum.setor"),
            comparar: (a, b) => compararTextoBr(a.setorAtuacao, b.setorAtuacao),
          },
        ]}
      >
        {(itensPagina) => (
        <div className="overflow-x-auto bg-white">
        <table className="w-full min-w-[960px] border-collapse text-[10px]">
          <thead>
            <tr className="border-y border-slate-100 bg-[#f4f3fb] text-[9px] uppercase tracking-wide text-slate-500">
              <th className="w-[22%] px-4 py-2 text-left font-semibold">{t("cadastros.comum.nome")}</th>
              <th className="w-[22%] px-4 py-2 text-left font-semibold">{t("cadastros.comum.email")}</th>
              <th className="w-[18%] px-4 py-2 text-left font-semibold">{t("cadastros.comum.celular")}</th>
              <th className="w-[17%] px-4 py-2 text-left font-semibold">{t("cadastros.comum.whatsapp")}</th>
              <th className="w-[16%] px-4 py-2 text-center font-semibold">{t("cadastros.comum.setorAtuacao")}</th>
              <th className="w-[5%] px-4 py-2 text-center font-semibold">{t("cadastros.comum.opcoes")}</th>
            </tr>
          </thead>
          <tbody>
            {!paginaPronta ? (
              <ListaCarregando colSpan={6} />
            ) : (
            itensPagina.map((colaborador) => {
              const dados = colaborador.dados || {};
              const aberto = colaboradorAberto === colaborador.id;

              return (
                <Fragment key={colaborador.id}>
                  <tr className="border-b border-slate-50 bg-white text-slate-600 hover:bg-slate-50">
                    <td className="px-4 py-3">{colaborador.nome}</td>
                    <td className="px-4 py-3">{colaborador.email}</td>
                    <td className="px-4 py-3">{exibirTelefone(colaborador.celular)}</td>
                    <td className="px-4 py-3">{exibirTelefone(colaborador.whatsapp)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex h-5 items-center rounded px-3 text-[9px] font-semibold text-white"
                        style={{ backgroundColor: colaborador.setorCor }}
                      >
                        {colaborador.setorAtuacao}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setColaboradorAberto(aberto ? null : colaborador.id)}
                          className={aberto ? "text-blue-600" : "text-slate-500 hover:text-blue-600"}
                          aria-label={t("cadastros.comum.visualizar")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {!mostrarExcluidos && (
                          <>
                            <button
                              type="button"
                              onClick={() => abrirEdicaoColaborador(colaborador)}
                              className="text-slate-500 hover:text-blue-600"
                              aria-label={t("cadastros.comum.editar")}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirColaborador(colaborador.id)}
                              className="text-red-400 hover:text-red-600"
                              aria-label={t("cadastros.comum.excluir")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {mostrarExcluidos && (
                          <>
                            <button
                              type="button"
                              onClick={() => restaurarColaborador(colaborador.id)}
                              className="rounded bg-emerald-500 px-2 py-1 text-[9px] font-semibold text-white hover:bg-emerald-600"
                            >
                              Restaurar
                            </button>
                            <button
                              type="button"
                              onClick={() => removerColaboradorDefinitivo(colaborador.id)}
                              className="text-red-400 hover:text-red-600"
                              aria-label={t("cadastros.comum.removerDefinitivo")}
                              title={t("cadastros.comum.removerDefinitivo")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {aberto && (
                    <tr key={`${colaborador.id}-detalhes`} className="bg-white">
                      <td colSpan={6} className="px-3 pb-4">
                        <div className="rounded border border-slate-100 bg-white px-3 py-3 shadow-sm">
                          <div className="mb-4 border-b border-slate-100 pb-4">
                            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-600">
                              <UserRound className="h-3 w-3" />
                              {t("cadastros.comum.secaoDadosPessoais")}
                            </h3>
                            <div className="grid gap-x-10 gap-y-2 md:grid-cols-3">
                              <p><strong>{t("cadastros.colaboradores.detalheCpfCnpj")}</strong> {dados.cpf || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheDataNascimento")}</strong> {dados.dataNascimento || ""}</p>
                              <p><strong>{t("cadastros.comum.detalheCro")}</strong> {dados.cro || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheWhatsapp").replace("WHATSAPP", "EMAIL")}</strong> {dados.email || colaborador.email}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheDataContratacao")}</strong> {dados.dataContratacao || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheCargo")}</strong> {dados.cargo || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheTipoRemuneracao")}</strong> {dados.tipoContratacao || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheSalario")}</strong> {formatarSalarioExibicao(dados.valorSalario || "0,00")}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheTelResidencial")}</strong> {dados.telefoneResidencial || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheTelComercial")}</strong> {dados.telefoneComercial || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheCelular")}</strong> {dados.celular || colaborador.celular}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheWhatsapp")}</strong> {dados.whatsapp || colaborador.whatsapp}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheCep")}</strong> {dados.cep || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheEndereco")}</strong> {dados.rua || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheBairro")}</strong> {dados.bairro || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheCidade")}</strong> {dados.cidade || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheComplemento")}</strong> {dados.complemento || ""}</p>
                            </div>
                          </div>

                          <div className="mb-4 border-b border-slate-100 pb-4">
                            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-600">
                              <BriefcaseBusiness className="h-3 w-3" />
                              {t("cadastros.comum.secaoCarteiraTrabalho")}
                            </h3>
                            <div className="grid gap-x-10 gap-y-2 md:grid-cols-4">
                              <p><strong>{t("cadastros.colaboradores.detalhePisPasep")}</strong> {dados.pisPasep || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheNumeroCtps")}</strong> {dados.numeroCtps || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheSerie")}</strong> {dados.serie || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheUf")}</strong> {dados.uf || ""}</p>
                            </div>
                          </div>

                          <div>
                            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-600">
                              <CreditCard className="h-3 w-3" />
                              {t("cadastros.comum.secaoDadosBancarios")}
                            </h3>
                            <div className="grid gap-x-10 gap-y-2 md:grid-cols-4">
                              <p><strong>{t("cadastros.colaboradores.detalheCodigoBanco")}</strong> {dados.codigoBanco || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheAgencia")}</strong> {dados.agencia || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheConta")}</strong> {dados.conta || ""}</p>
                              <p><strong>{t("cadastros.colaboradores.detalheChavePix")}</strong> {dados.chavePix || ""}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setColaboradorAberto(null)}
                            className="mt-4 h-7 rounded border border-slate-300 bg-white px-3 text-[10px] text-slate-600 hover:bg-slate-50"
                          >
                            {t("cadastros.comum.fecharCadastro")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
            )}

            {paginaPronta && colaboradoresFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                  {t("cadastros.colaboradores.nenhumEncontrado")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        )}
      </ListagemPorNome>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-16">
          <div className="relative w-full max-w-[1180px] rounded bg-white shadow-2xl">
            <div className="flex h-9 items-center justify-between border-b border-slate-100 px-4">
              <h2 className="text-[11px] font-medium text-slate-700">
                {colaboradorEditando ? t("cadastros.colaboradores.modalTituloEditar") : t("cadastros.colaboradores.modalTituloCadastrar")}
              </h2>
              <button
                type="button"
                onClick={fecharModalColaborador}
                className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100"
                aria-label={t("cadastros.comum.fechar")}
              >
                ×
              </button>
            </div>

            <div className="max-h-[78vh] space-y-4 overflow-y-auto px-4 py-4 text-[10px] text-slate-600">
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <UserRound className="h-3.5 w-3.5" />
                  {t("cadastros.comum.secaoDadosColaborador")}
                </h3>
                <div className="grid gap-3 md:grid-cols-[1.2fr_0.55fr_0.55fr]">
                  <div>
                    <label className={labelClass}>{t("cadastros.colaboradores.campoNomeObrigatorio")}</label>
                    <input value={form.nome} onChange={(event) => setCampo("nome", event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.cro")}</label>
                    <input value={form.cro} onChange={(event) => setCampo("cro", event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.cargo")}</label>
                    <input value={form.cargo} onChange={(event) => setCampo("cargo", event.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.cpf")}</label>
                    <input value={form.cpf} onChange={(event) => setCampo("cpf", event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.email")}</label>
                    <input value={form.email} onChange={(event) => setCampo("email", event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <CampoDataBr
                      label={t("cadastros.comum.dataNascimento")}
                      value={form.dataNascimento}
                      onChange={(valor) => setCampo("dataNascimento", valor)}
                      placeholder={t("cadastros.comum.placeholderData")}
                      iconPosition="left"
                      calendarZIndex={9999}
                      inputClassName="h-8 rounded border-slate-300 px-2 pl-8 text-[10px] text-slate-600 shadow-none focus:border-blue-400 focus:ring-0"
                      className="[&_label]:mb-1 [&_label]:block [&_label]:text-[9px] [&_label]:font-normal [&_label]:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.rg")}</label>
                    <input value={form.rg} onChange={(event) => setCampo("rg", event.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.telefoneResidencial")}</label>
                    <input value={form.telefoneResidencial} placeholder={PLACEHOLDER_TELEFONE_BR} onChange={(event) => setCampo("telefoneResidencial", formatarTelefone(event.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.telefoneComercial")}</label>
                    <input value={form.telefoneComercial} placeholder={PLACEHOLDER_TELEFONE_BR} onChange={(event) => setCampo("telefoneComercial", formatarTelefone(event.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.celular")}</label>
                    <input value={form.celular} placeholder={PLACEHOLDER_TELEFONE_BR} onChange={(event) => setCampo("celular", formatarTelefone(event.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.whatsapp")}</label>
                    <input value={form.whatsapp} placeholder={PLACEHOLDER_TELEFONE_BR} onChange={(event) => setCampo("whatsapp", formatarTelefone(event.target.value))} className={inputClass} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[0.55fr_1fr_0.55fr]">
                  <label className="flex h-8 items-center gap-2 pt-4 text-[10px] text-slate-500">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-blue-600" />
                    {t("cadastros.comum.ativo")}
                  </label>
                  <div>
                    <label className={labelClass}>Tipo de {t("cadastros.comum.secaoRemuneracao")}</label>
                    <select value={form.tipoContratacao} onChange={(event) => setCampo("tipoContratacao", event.target.value)} className={inputClass}>
                      <option>{t("cadastros.comum.remuneracaoSalario")}</option>
                      <option>{t("cadastros.comum.secaoComissao")}</option>
                      <option>Salário + {t("cadastros.comum.secaoComissao")}</option>
                    </select>
                  </div>
                  <CampoValorSalario
                    label={t("cadastros.comum.valorSalario")}
                    valor={form.valorSalario}
                    onChange={(valor) => setCampo("valorSalario", valor)}
                    disabled={!exibeSalario}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_0.32fr]">
                  <div className="relative">
                    <label className={labelClass}>{t("cadastros.comum.setor")}</label>
                    <button
                      type="button"
                      onClick={() => setDropdownSetorAberto((aberto) => !aberto)}
                      className={`${inputClass} flex items-center justify-between text-left`}
                    >
                      <span>{form.setor}</span>
                      <span className="text-slate-400">⌃</span>
                    </button>
                    {dropdownSetorAberto && (
                      <div className="absolute left-0 top-full z-[70] mt-1 w-full overflow-hidden rounded border border-slate-200 bg-white text-[10px] shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setNovoSetor({ nome: "", cor: "#5b5ce2" });
                            setModalSetorAberto(true);
                          }}
                          className="flex w-full items-center px-3 py-2 text-left font-medium text-emerald-600 hover:bg-emerald-50"
                        >
                          {t("cadastros.comum.adicionarSetor")}
                        </button>
                        {setores.map((setor) => (
                          <div
                            key={setor.nome}
                            className={`flex w-full items-center justify-between px-3 py-2 ${
                              form.setor === setor.nome ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setCampo("setor", setor.nome);
                                setDropdownSetorAberto(false);
                              }}
                              className="flex-1 text-left"
                            >
                              {setor.nome}
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirSetor(setor.nome)}
                              className="ml-2 text-red-400 hover:text-red-600"
                              aria-label={t("cadastros.comum.excluirSetor", { nome: setor.nome })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalCargaHorariaAberto(true)}
                    className="mt-4 h-8 rounded bg-blue-500 px-3 text-[10px] font-semibold text-white hover:bg-blue-600"
                  >
                    {t("cadastros.comum.configurarCargaHoraria")}
                  </button>
                </div>
              </section>

              <section className="space-y-3 border-t border-slate-100 pt-3">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  {t("cadastros.comum.secaoCarteiraTrabalho")}
                </h3>
                <div className="grid gap-3 md:grid-cols-4">
                  <div><label className={labelClass}>{t("cadastros.comum.pisPasep")}</label><input value={form.pisPasep} onChange={(event) => setCampo("pisPasep", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.numeroCtps")}</label><input value={form.numeroCtps} onChange={(event) => setCampo("numeroCtps", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.serie")}</label><input value={form.serie} onChange={(event) => setCampo("serie", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.uf")}</label><input value={form.uf} onChange={(event) => setCampo("uf", event.target.value)} className={inputClass} /></div>
                </div>
              </section>

              <section className="space-y-3 border-t border-slate-100 pt-3">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t("cadastros.comum.secaoDadosBancarios")}
                </h3>
                <div className="grid gap-3 md:grid-cols-4">
                  <div><label className={labelClass}>{t("cadastros.comum.codigoBanco")}</label><input value={form.codigoBanco} onChange={(event) => setCampo("codigoBanco", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.agencia")}</label><input value={form.agencia} onChange={(event) => setCampo("agencia", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.conta")}</label><input value={form.conta} onChange={(event) => setCampo("conta", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.chavePix")}</label><input value={form.chavePix} onChange={(event) => setCampo("chavePix", event.target.value)} className={inputClass} /></div>
                </div>
              </section>

              {exibeComissao && (
              <section className="space-y-3 border-t border-slate-100 pt-3">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <Percent className="h-3.5 w-3.5" />
                  {t("cadastros.comum.secaoComissao")}
                </h3>
                <p className="text-[10px] text-slate-400">{textoExemploRemuneracao}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <CampoValorComissao
                    label={t("cadastros.comum.valorComissao")}
                    valor={form.valorComissao}
                    tipo={form.tipoValorComissao}
                    onValorChange={(valor) => setCampo("valorComissao", valor)}
                    onTipoChange={(tipo) => setCampo("tipoValorComissao", tipo)}
                  />
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.descontoComissao")}</label>
                    <select value={form.descricaoComissao} onChange={(event) => setCampo("descricaoComissao", event.target.value)} className={inputClass}>
                      <option>{t("cadastros.comum.nao")}</option>
                      <option>{t("cadastros.comum.sim")}</option>
                    </select>
                  </div>
                  <CampoValorComissao
                    label={t("cadastros.comum.valorComissaoRepeticao")}
                    valor={form.comissaoRepeticao}
                    tipo={form.tipoValorComissaoRepeticao}
                    onValorChange={(valor) => setCampo("comissaoRepeticao", valor)}
                    onTipoChange={(tipo) => setCampo("tipoValorComissaoRepeticao", tipo)}
                  />
                </div>
              </section>
              )}

              {!exibeComissao && (
              <section className="space-y-3 border-t border-slate-100 pt-3">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <Percent className="h-3.5 w-3.5" />
                  {t("cadastros.comum.secaoRemuneracao")}
                </h3>
                <p className="text-[10px] text-slate-400">{textoExemploRemuneracao}</p>
              </section>
              )}

              <section className="space-y-3 border-t border-slate-100 pt-3">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <MapPin className="h-3.5 w-3.5" />
                  {t("cadastros.comum.secaoEndereco")}
                </h3>
                <div className="grid gap-3 md:grid-cols-[0.7fr_1.5fr_0.7fr]">
                  <div>
                    <label className={labelClass}>{t("cadastros.comum.cep")}</label>
                    <div className="flex">
                      <input
                        value={form.cep}
                        onChange={(event) => {
                          const cep = formatCepInput(event.target.value);
                          setCampo("cep", cep);
                          if (cep.replace(/\D/g, "").length === 8) {
                            buscarEnderecoPorCep(cep);
                          }
                        }}
                        className={`${inputClass} rounded-r-none`}
                      />
                      <button
                        type="button"
                        onClick={() => buscarEnderecoPorCep()}
                        disabled={buscandoCep}
                        className="h-8 rounded-r border border-l-0 border-slate-300 bg-white px-3 text-[10px] text-blue-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {buscandoCep ? t("cadastros.comum.buscando") : t("cadastros.comum.buscarEndereco")}
                      </button>
                    </div>
                  </div>
                  <div><label className={labelClass}>{t("cadastros.comum.rua")}</label><input value={form.rua} onChange={(event) => setCampo("rua", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.numero")}</label><input value={form.numero} onChange={(event) => setCampo("numero", event.target.value)} className={inputClass} /></div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div><label className={labelClass}>{t("cadastros.comum.cidade")}</label><input value={form.cidade} onChange={(event) => setCampo("cidade", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.uf")}</label><input value={form.ufEndereco} onChange={(event) => setCampo("ufEndereco", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.bairro")}</label><input value={form.bairro} onChange={(event) => setCampo("bairro", event.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>{t("cadastros.comum.complemento")}</label><input value={form.complemento} onChange={(event) => setCampo("complemento", event.target.value)} className={inputClass} /></div>
                </div>
              </section>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={cadastrarColaborador}
                  className="h-8 rounded bg-blue-600 px-4 text-[10px] font-semibold text-white hover:bg-blue-700"
                >
                  {colaboradorEditando ? t("cadastros.comum.editarAlteracoes") : t("cadastros.comum.cadastrar")}
                </button>
                <button
                  type="button"
                  onClick={fecharModalColaborador}
                  className="h-8 rounded border border-slate-300 bg-white px-4 text-[10px] text-slate-600 hover:bg-slate-50"
                >
                  {colaboradorEditando ? t("cadastros.comum.cancelar") : t("cadastros.comum.fechar")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalSetorAberto && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 p-4 pt-24">
          <div className="relative w-full max-w-sm rounded bg-white shadow-2xl">
            <div className="flex h-9 items-center justify-between border-b border-slate-100 px-4">
              <h2 className="text-[11px] font-medium text-slate-700">{t("cadastros.setores.cadastrar")}</h2>
              <button
                type="button"
                onClick={() => setModalSetorAberto(false)}
                className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100"
                aria-label={t("cadastros.comum.fechar")}
              >
                ×
              </button>
            </div>
            <div className="space-y-4 px-4 py-4 text-[10px] text-slate-600">
              <div>
                <label className={labelClass}>{t("cadastros.comum.setor")}</label>
                <input
                  value={novoSetor.nome}
                  onChange={(event) => setNovoSetor((atual) => ({ ...atual, nome: event.target.value }))}
                  placeholder={t("cadastros.comum.placeholderNomeSetor")}
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>{t("cadastros.comum.cor")}</label>
                <input
                  type="color"
                  value={novoSetor.cor}
                  onChange={(event) => setNovoSetor((atual) => ({ ...atual, cor: event.target.value }))}
                  className="h-8 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cadastrarSetor}
                  className="h-8 rounded bg-blue-600 px-4 text-[10px] font-semibold text-white hover:bg-blue-700"
                >
                  {t("cadastros.setores.cadastrar")}
                </button>
                <button
                  type="button"
                  onClick={() => setModalSetorAberto(false)}
                  className="h-8 rounded border border-slate-300 bg-white px-4 text-[10px] text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CargaHorariaColaboradorModal
        open={modalCargaHorariaAberto}
        onClose={() => setModalCargaHorariaAberto(false)}
        colaboradorNome={form.nome}
        valorInicial={cargaHoraria}
        onSave={setCargaHoraria}
      />

      {pdfColaboradoresUrl ? (
        <PdfViewerModal
          titulo={t("cadastros.colaboradores.pdfTitulo")}
          pdfUrl={pdfColaboradoresUrl}
          nomeArquivo="colaboradores.pdf"
          iframeTitle={t("cadastros.colaboradores.pdfIframeTitle")}
          onFechar={fecharPdfColaboradores}
        />
      ) : null}
    </div>
  );
}
