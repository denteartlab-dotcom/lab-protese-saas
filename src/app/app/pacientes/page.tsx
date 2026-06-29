"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
import { Button, Card, Input, Modal, SelectPesquisavel, Table } from "@/components/ui";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import { compararTextoBr } from "@/lib/listagem-config";
import { exibirTelefone } from "@/lib/validar-documento";

type Paciente = {
  id: string;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  cliente: { id: string; nome: string };
};

type Cliente = { id: string; nome: string };

export default function PacientesPage() {
  const [list, setList] = useState<Paciente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Paciente | null>(null);
  const [pacienteParaExcluir, setPacienteParaExcluir] = useState<Paciente | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    clienteId: "",
    observacoes: "",
  });

  async function load() {
    const [p, c] = await Promise.all([
      fetch(`/api/pacientes?q=${encodeURIComponent(q)}`).then((r) => r.json()),
      fetch("/api/clientes").then((r) => r.json()),
    ]);
    setList(p);
    setClientes(c);
  }

  useEffect(() => {
    load();
  }, [q]);

  const listagem = useListagemPaginada<Paciente, "nome" | "cliente">({
    storageKey: "pacientes",
    itens: list,
    padrao: { ordenarPor: "nome", direcao: "asc", porPagina: 50 },
    comparadores: {
      nome: (a, b) => compararTextoBr(a.nome, b.nome),
      cliente: (a, b) => compararTextoBr(a.cliente.nome, b.cliente.nome),
    },
  });

  function openNew() {
    setEditing(null);
    setForm({
      nome: "",
      cpf: "",
      telefone: "",
      clienteId: clientes[0]?.id || "",
      observacoes: "",
    });
    setOpen(true);
  }

  function openEdit(p: Paciente) {
    setEditing(p);
    setForm({
      nome: p.nome,
      cpf: p.cpf || "",
      telefone: p.telefone || "",
      clienteId: p.cliente.id,
      observacoes: "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/pacientes/${editing.id}` : "/api/pacientes";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setOpen(false);
    load();
  }

  async function confirmarExclusaoPaciente() {
    const paciente = pacienteParaExcluir;
    if (!paciente) return;
    setPacienteParaExcluir(null);
    setList((lista) => lista.filter((p) => p.id !== paciente.id));
    try {
      const res = await fetch(`/api/pacientes/${paciente.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error || "Não foi possível excluir o paciente.");
        void load();
      }
    } catch {
      alert("Não foi possível excluir o paciente.");
      void load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-slate-600">Pacientes vinculados aos clientes</p>
        </div>
        <Button onClick={openNew} disabled={clientes.length === 0}>
          <Plus className="h-4 w-4" /> Novo paciente
        </Button>
      </div>

      <Card>
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
              placeholder="Buscar paciente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
            { valor: "cliente", label: "Cliente" },
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
        <Table headers={["Nome", "Cliente", "CPF", "Telefone", "Ações"]}>
          {listagem.itensPagina.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">{p.nome}</td>
              <td className="px-4 py-3">{p.cliente.nome}</td>
              <td className="px-4 py-3">{p.cpf || ""}</td>
              <td className="px-4 py-3">{exibirTelefone(p.telefone)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPacienteParaExcluir(p)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        </BarraConfigListagem>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar paciente" : "Novo paciente"}
      >
        <form onSubmit={save} className="space-y-4">
          <SelectPesquisavel
            label="Cliente (dentista/clínica) *"
            value={form.clienteId}
            onChange={(clienteId) => setForm({ ...form, clienteId })}
            placeholder="Selecione..."
            required
            menuEmPortal
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          />
          <Input
            label="Nome do paciente *"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <Input
            label="CPF"
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
          />
          <Input
            label="Telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmacaoExclusaoModal
        open={!!pacienteParaExcluir}
        titulo="Excluir Paciente"
        mensagem="Deseja realmente excluir esse paciente?"
        detalhe={pacienteParaExcluir?.nome}
        onClose={() => setPacienteParaExcluir(null)}
        onConfirm={confirmarExclusaoPaciente}
      />
    </div>
  );
}
