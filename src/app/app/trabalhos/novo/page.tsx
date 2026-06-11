"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, Card, Input, Select, SelectPesquisavel, Textarea } from "@/components/ui";
import { TIPOS_PROTESE } from "@/lib/utils";

type Cliente = { id: string; nome: string };
type Paciente = { id: string; nome: string; clienteId: string };

export default function NovaOSPage() {
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
      const t = await res.json();
      router.push(`/app/trabalhos/${t.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/app/trabalhos"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold">Nova Ordem de Serviço</h1>
      <Card title="Requisição de trabalho">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <SelectPesquisavel
            label="Cliente *"
            value={form.clienteId}
            onChange={(clienteId) => setForm({ ...form, clienteId, pacienteId: "" })}
            placeholder="Selecione o dentista/clínica"
            required
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          />
          <SelectPesquisavel
            label="Paciente *"
            value={form.pacienteId}
            onChange={(pacienteId) => setForm({ ...form, pacienteId })}
            placeholder="Selecione o paciente"
            required
            disabled={!form.clienteId}
            options={pacientes.map((p) => ({ value: p.id, label: p.nome }))}
          />
          <Select
            label="Tipo de prótese *"
            value={form.tipoProtese}
            onChange={(e) => setForm({ ...form, tipoProtese: e.target.value })}
          >
            {TIPOS_PROTESE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            label="Dentes (ex: 16, 17)"
            value={form.dentes}
            onChange={(e) => setForm({ ...form, dentes: e.target.value })}
          />
          <Input
            label="Cor"
            value={form.cor}
            onChange={(e) => setForm({ ...form, cor: e.target.value })}
          />
          <Input
            label="Material"
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
          />
          <Input
            label="Escala"
            value={form.escala}
            onChange={(e) => setForm({ ...form, escala: e.target.value })}
          />
          <Input
            label="Data prevista"
            type="date"
            value={form.dataPrevista}
            onChange={(e) => setForm({ ...form, dataPrevista: e.target.value })}
          />
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Instruções técnicas"
              value={form.instrucoes}
              onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Observações"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">Criar OS</Button>
            <Link href="/app/trabalhos">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
