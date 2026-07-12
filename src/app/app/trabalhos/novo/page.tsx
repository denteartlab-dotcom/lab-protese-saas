"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Input, Select, SelectPesquisavel, Textarea } from "@/components/ui";
import { TIPOS_PROTESE } from "@/lib/utils";

type Cliente = { id: string; nome: string };
type Paciente = { id: string; nome: string; clienteId: string };

export default function NovaOSPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [form, setForm] = useState({
    clienteId: "",
    pacienteId: "",
    tipoProtese: TIPOS_PROTESE[0],
    dentes: "",
    cor: "",
    material: "",
    escala: "",
    dataPrevista: "",
    valor: "",
    observacoes: "",
    instrucoes: "",
  });

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClientes);
  }, []);

  useEffect(() => {
    if (!form.clienteId) {
      setPacientes([]);
      return;
    }
    fetch(`/api/pacientes?clienteId=${form.clienteId}`)
      .then((r) => r.json())
      .then(setPacientes);
  }, [form.clienteId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/trabalhos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        valor: parseFloat(form.valor) || 0,
      }),
    });
    if (res.ok) {
      const trabalho = await res.json();
      router.push(`/app/trabalhos/${trabalho.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/app/trabalhos"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" /> {t("cadastros.trabalhos.voltar")}
      </Link>
      <h1 className="text-2xl font-bold">{t("cadastros.trabalhos.novaTitulo")}</h1>
      <Card title={t("cadastros.trabalhos.requisicao")}>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <SelectPesquisavel
            label={`${t("relatorio.comum.cliente")} *`}
            value={form.clienteId}
            onChange={(clienteId) => setForm({ ...form, clienteId, pacienteId: "" })}
            placeholder={t("cadastros.trabalhos.clientePlaceholder")}
            required
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          />
          <SelectPesquisavel
            label={`${t("relatorio.comum.paciente")} *`}
            value={form.pacienteId}
            onChange={(pacienteId) => setForm({ ...form, pacienteId })}
            placeholder={t("cadastros.trabalhos.pacientePlaceholder")}
            required
            disabled={!form.clienteId}
            options={pacientes.map((p) => ({ value: p.id, label: p.nome }))}
          />
          <Select
            label={t("cadastros.trabalhos.campoTipoProtese")}
            value={form.tipoProtese}
            onChange={(e) => setForm({ ...form, tipoProtese: e.target.value })}
          >
            {TIPOS_PROTESE.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </Select>
          <Input
            label={t("cadastros.trabalhos.campoDentes")}
            value={form.dentes}
            onChange={(e) => setForm({ ...form, dentes: e.target.value })}
          />
          <Input
            label={t("cadastros.trabalhos.campoCor")}
            value={form.cor}
            onChange={(e) => setForm({ ...form, cor: e.target.value })}
          />
          <Input
            label={t("cadastros.trabalhos.campoMaterial")}
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
          />
          <Input
            label={t("cadastros.trabalhos.campoEscala")}
            value={form.escala}
            onChange={(e) => setForm({ ...form, escala: e.target.value })}
          />
          <Input
            label={t("cadastros.trabalhos.campoDataPrevista")}
            type="date"
            value={form.dataPrevista}
            onChange={(e) => setForm({ ...form, dataPrevista: e.target.value })}
          />
          <Input
            label={t("cadastros.trabalhos.campoValor")}
            type="number"
            step="0.01"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Textarea
              label={t("cadastros.trabalhos.campoInstrucoes")}
              value={form.instrucoes}
              onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label={t("cadastros.trabalhos.campoObservacoes")}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">{t("cadastros.trabalhos.criar")}</Button>
            <Link href="/app/trabalhos">
              <Button type="button" variant="outline">
                {t("cadastros.comum.cancelar")}
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
