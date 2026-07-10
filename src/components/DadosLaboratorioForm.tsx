"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui";
import {
  criarFormularioLaboratorioLimpo,
  nomeExibicaoLaboratorio,
  normalizarTipoPessoa,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import type { DadosCnpjConsulta } from "@/lib/cnpj-lookup";
import {
  formatCepInput,
  formatCnpjInput,
  formatCpfInput,
} from "@/lib/documento-br";
import { formatarTelefone, PLACEHOLDER_TELEFONE_BR } from "@/lib/validar-documento";

export type TipoMensagemForm = "sucesso" | "erro" | "info";

function Campo({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[13px] font-normal text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function inputClassName(bloqueado = false) {
  const base =
    "w-full rounded border px-3 py-[7px] text-sm shadow-sm focus:outline-none focus:ring-1";
  if (bloqueado) {
    return `${base} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500`;
  }
  return `${base} border-slate-300 bg-white text-slate-800 focus:border-[#4a90d9] focus:ring-[#4a90d9]/30 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:ring-primary-500/30`;
}

function SecaoTitulo({
  icon: Icon,
  titulo,
}: {
  icon: typeof Building2;
  titulo: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" strokeWidth={1.75} />
      <h2 className="text-[15px] font-normal">{titulo}</h2>
    </div>
  );
}

export function DadosLaboratorioForm({
  form,
  setForm,
  onMensagem,
}: {
  form: ConfigLaboratorio;
  setForm: React.Dispatch<React.SetStateAction<ConfigLaboratorio>>;
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
}) {
  const tipoPessoa = normalizarTipoPessoa(form.tipoPessoa);
  const ehFisica = tipoPessoa === "Física";
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const ultimoCep = useRef("");
  const ultimoCnpj = useRef("");

  useEffect(() => {
    ultimoCep.current = form.cep.replace(/\D/g, "");
    ultimoCnpj.current = form.cnpj.replace(/\D/g, "");
    onMensagem?.("");
  }, []);

  function alterarTipoPessoa(tipo: "Física" | "Jurídica") {
    if (tipoPessoa === tipo) return;
    ultimoCep.current = "";
    ultimoCnpj.current = "";
    setForm({
      ...criarFormularioLaboratorioLimpo(tipo),
      nomeLaboratorio: form.nomeLaboratorio,
      responsavel: form.nomeLaboratorio || form.responsavel,
      logoDataUrl: form.logoDataUrl,
      logoTamanho: form.logoTamanho,
    });
    onMensagem?.("");
  }

  function atualizarTelefone(
    campo: "telefoneComercial" | "celular" | "whatsapp",
    valor: string
  ) {
    setForm((atual) => ({
      ...atual,
      [campo]: formatarTelefone(valor),
    }));
  }

  function aplicarDadosCnpjJuridica(dados: DadosCnpjConsulta) {
    setForm((atual) => ({
      ...atual,
      razaoSocial: dados.razaoSocial || atual.razaoSocial,
      nomeFantasia: dados.nomeFantasia || atual.nomeFantasia,
      telefoneComercial: dados.telefoneComercial
        ? formatarTelefone(dados.telefoneComercial)
        : atual.telefoneComercial,
      whatsapp: dados.whatsapp ? formatarTelefone(dados.whatsapp) : atual.whatsapp,
      inscricaoEstadual: dados.inscricaoEstadual || atual.inscricaoEstadual,
      inscricaoMunicipal: dados.inscricaoMunicipal || atual.inscricaoMunicipal,
      cep: dados.cep || atual.cep,
      rua: dados.rua || atual.rua,
      numero: dados.numero || atual.numero,
      complemento: dados.complemento || atual.complemento,
      bairro: dados.bairro || atual.bairro,
      cidade: dados.cidade || atual.cidade,
      uf: dados.uf || atual.uf,
      codMunicipio: dados.codMunicipio || atual.codMunicipio,
    }));
  }

  async function buscarEnderecoPorCep(
    cepInformado = form.cep,
    opts?: { notificar?: boolean }
  ) {
    const cep = cepInformado.replace(/\D/g, "");
    if (cep.length !== 8) return;
    ultimoCep.current = cep;
    setBuscandoCep(true);
    try {
      const { buscarEnderecoPorCep: buscarCep } = await import("@/lib/cep-lookup");
      const endereco = await buscarCep(cepInformado);
      if (!endereco) {
        onMensagem?.("CEP não encontrado.", "erro");
        return;
      }
      setForm((atual) => ({
        ...atual,
        cep: endereco.cep,
        rua: endereco.rua || atual.rua,
        bairro: endereco.bairro || atual.bairro,
        cidade: endereco.cidade || atual.cidade,
        uf: endereco.uf || atual.uf,
        codMunicipio: endereco.codMunicipio || atual.codMunicipio,
      }));
      if (opts?.notificar !== false) {
        onMensagem?.(
          endereco.codMunicipio
            ? "Endereço e código municipal (IBGE) preenchidos pelo CEP."
            : "Endereço preenchido pelo CEP.",
          "sucesso"
        );
      }
    } finally {
      setBuscandoCep(false);
    }
  }

  async function buscarPorCnpj(
    cnpjInformado = form.cnpj,
    opts?: { notificar?: boolean }
  ) {
    const cnpj = cnpjInformado.replace(/\D/g, "");
    if (cnpj.length !== 14) return;
    ultimoCnpj.current = cnpj;
    setBuscandoCnpj(true);
    try {
      const response = await fetch(`/api/cnpj/${cnpj}`);
      const data = await response.json();
      if (!response.ok) {
        onMensagem?.(data.error || "Não foi possível consultar o CNPJ.", "erro");
        return;
      }
      aplicarDadosCnpjJuridica(data as DadosCnpjConsulta);
      if (opts?.notificar !== false) {
        onMensagem?.("Dados do CNPJ preenchidos automaticamente.", "sucesso");
      }
    } finally {
      setBuscandoCnpj(false);
    }
  }

  useEffect(() => {
    if (ehFisica) return;
    const cnpj = form.cnpj.replace(/\D/g, "");
    if (cnpj.length === 14 && cnpj !== ultimoCnpj.current) {
      ultimoCnpj.current = cnpj;
      void buscarPorCnpj(form.cnpj, { notificar: false });
    }
  }, [form.cnpj, ehFisica]);

  useEffect(() => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length === 8 && cep !== ultimoCep.current) {
      ultimoCep.current = cep;
      void buscarEnderecoPorCep(form.cep, { notificar: false });
    }
  }, [form.cep]);

  return (
    <div className="space-y-6">
      <section>
        <SecaoTitulo icon={Building2} titulo="Dados do Laboratório" />
        <div
          key={tipoPessoa}
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-12"
        >
          <Campo label="Nome do laboratório" className="lg:col-span-12">
            <input
              className={inputClassName()}
              value={form.nomeLaboratorio?.trim() || nomeExibicaoLaboratorio(form)}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  nomeLaboratorio: v,
                  responsavel: v,
                  nome: ehFisica ? v : form.nome,
                });
              }}
              placeholder="Nome exibido no sistema e nas impressões"
            />
          </Campo>

          <Campo label="Tipo Pessoa" className="lg:col-span-3">
            <div className="flex h-[34px] items-center gap-6 pt-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="radio"
                  name="tipoPessoa"
                  checked={ehFisica}
                  onChange={() => alterarTipoPessoa("Física")}
                  className="h-4 w-4 accent-[#4a90d9]"
                />
                Física
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="radio"
                  name="tipoPessoa"
                  checked={!ehFisica}
                  onChange={() => alterarTipoPessoa("Jurídica")}
                  className="h-4 w-4 accent-[#4a90d9]"
                />
                Jurídica
              </label>
            </div>
          </Campo>

          <Campo label="Razão Social" className="lg:col-span-4">
            <input
              className={inputClassName(ehFisica)}
              value={ehFisica ? "" : form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
              disabled={ehFisica}
              readOnly={ehFisica}
              tabIndex={ehFisica ? -1 : 0}
              aria-disabled={ehFisica}
              title={
                ehFisica
                  ? "Razão social não se aplica a pessoa física"
                  : undefined
              }
            />
          </Campo>

          {ehFisica ? (
            <Campo label="Nome" className="lg:col-span-5">
              <input
                className={inputClassName()}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </Campo>
          ) : (
            <Campo label="Nome Fantasia" className="lg:col-span-5">
              <input
                className={inputClassName()}
                value={form.nomeFantasia}
                onChange={(e) =>
                  setForm({ ...form, nomeFantasia: e.target.value })
                }
              />
            </Campo>
          )}

          {ehFisica ? (
            <Campo label="CPF" className="lg:col-span-3">
              <input
                className={inputClassName()}
                value={form.cpf}
                onChange={(e) =>
                  setForm({ ...form, cpf: formatCpfInput(e.target.value) })
                }
                placeholder="000.000.000-00"
              />
            </Campo>
          ) : (
            <Campo label="CNPJ" className="lg:col-span-3">
              <input
                className={inputClassName()}
                value={form.cnpj}
                onChange={(e) =>
                  setForm({ ...form, cnpj: formatCnpjInput(e.target.value) })
                }
                onBlur={() => {
                  const digits = form.cnpj.replace(/\D/g, "");
                  if (digits.length === 14) void buscarPorCnpj(form.cnpj);
                }}
                placeholder="00.000.000/0000-00"
                disabled={buscandoCnpj}
              />
            </Campo>
          )}

          <Campo label="CRO Responsável" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.croResponsavel}
              onChange={(e) =>
                setForm({ ...form, croResponsavel: e.target.value })
              }
            />
          </Campo>

          <Campo label="Inscrição Municipal" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.inscricaoMunicipal}
              onChange={(e) =>
                setForm({ ...form, inscricaoMunicipal: e.target.value })
              }
            />
          </Campo>

          <Campo label="Inscrição Estadual" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.inscricaoEstadual}
              onChange={(e) =>
                setForm({ ...form, inscricaoEstadual: e.target.value })
              }
            />
          </Campo>

          <Campo label="Email" className="lg:col-span-3">
            <input
              type="email"
              className={inputClassName()}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Campo>

          <Campo label="Telefone Comercial" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.telefoneComercial}
              onChange={(e) => atualizarTelefone("telefoneComercial", e.target.value)}
              inputMode="tel"
              placeholder={PLACEHOLDER_TELEFONE_BR}
            />
          </Campo>

          <Campo label="Celular" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.celular}
              onChange={(e) => atualizarTelefone("celular", e.target.value)}
              inputMode="tel"
              placeholder={PLACEHOLDER_TELEFONE_BR}
            />
          </Campo>

          <Campo label="WhatsApp" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.whatsapp}
              onChange={(e) => atualizarTelefone("whatsapp", e.target.value)}
              inputMode="tel"
              placeholder={PLACEHOLDER_TELEFONE_BR}
            />
          </Campo>

          <Campo label="Site" className="lg:col-span-6">
            <input
              className={inputClassName()}
              value={form.site}
              onChange={(e) => setForm({ ...form, site: e.target.value })}
            />
          </Campo>

          <Campo label="Redes Sociais" className="lg:col-span-6">
            <input
              className={inputClassName()}
              value={form.redesSociais}
              onChange={(e) =>
                setForm({ ...form, redesSociais: e.target.value })
              }
            />
          </Campo>
        </div>
      </section>

      <section>
        <SecaoTitulo icon={MapPin} titulo="Endereço" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-12">
          <Campo label="CEP" className="lg:col-span-4">
            <div className="flex gap-2">
              <input
                value={form.cep}
                onChange={(e) =>
                  setForm({ ...form, cep: formatCepInput(e.target.value) })
                }
                className={`${inputClassName()} max-w-[140px]`}
                placeholder="00000-000"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap rounded border-[#4a90d9] bg-white px-3 py-1.5 text-[13px] font-normal text-[#4a90d9] hover:bg-[#4a90d9]/5 dark:border-primary-500 dark:bg-slate-800 dark:text-primary-400 dark:hover:bg-primary-950/40"
                disabled={buscandoCep}
                onClick={() => void buscarEnderecoPorCep()}
              >
                {buscandoCep ? "..." : "Buscar Endereço"}
              </Button>
            </div>
          </Campo>

          <Campo label="Rua" className="lg:col-span-5">
            <input
              className={inputClassName()}
              value={form.rua}
              onChange={(e) => setForm({ ...form, rua: e.target.value })}
            />
          </Campo>

          <Campo label="Número" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
            />
          </Campo>

          <Campo label="Cidade" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            />
          </Campo>

          <Campo label="UF" className="lg:col-span-2">
            <input
              className={inputClassName()}
              value={form.uf}
              onChange={(e) =>
                setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })
              }
              maxLength={2}
            />
          </Campo>

          <Campo label="Bairro" className="lg:col-span-3">
            <input
              className={inputClassName()}
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
            />
          </Campo>

          <Campo label="Complemento" className="lg:col-span-2">
            <input
              className={inputClassName()}
              value={form.complemento}
              onChange={(e) =>
                setForm({ ...form, complemento: e.target.value })
              }
            />
          </Campo>

          <Campo label="Cód. Município (IBGE)" className="lg:col-span-2">
            <input
              className={inputClassName()}
              value={form.codMunicipio}
              onChange={(e) =>
                setForm({ ...form, codMunicipio: e.target.value.replace(/\D/g, "").slice(0, 7) })
              }
              placeholder="7 dígitos — preenchido pelo CEP"
              title="Código IBGE do município para emissão de NFS-e na prefeitura"
            />
          </Campo>
        </div>
      </section>
    </div>
  );
}
