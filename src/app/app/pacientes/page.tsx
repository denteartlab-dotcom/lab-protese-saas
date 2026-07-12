"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Input, Modal, SelectPesquisavel, Table } from "@/components/ui";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import { compararTextoBr } from "@/lib/listagem-config";
import { exibirTelefone, formatarTelefone, PLACEHOLDER_TELEFONE_BR } from "@/lib/validar-documento";

type Paciente = {
  id: string;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  cliente: { id: string; nome: string };
};

type Cliente = { id: string; nome: string };

type PainelPacienteResumo = {
  pacienteId: string;
  pacienteNome: string;
  cliente: { id: string; nome: string; telefone: string | null } | null;
  ultimoTrabalhoEm: string;
  totalTrabalhos: number;
};

type PainelPacientesResposta = {
  pacientes: PainelPacienteResumo[];
  total: number;
};

export default function PacientesPage() {
  const { t } = useI18n();
  const [list, setList] = useState<Paciente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [painel, setPainel] = useState<PainelPacienteResumo[]>([]);
  const [totalPainel, setTotalPainel] = useState(0);
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

  const load = useCallback(async () => {
    const [p, c, painelRes] = await Promise.all([
      fetch(`/api/pacientes?q=${encodeURIComponent(q)}`).then((r) => r.json()),
      fetch("/api/clientes").then((r) => r.json()),
      fetch(`/api/pacientes/painel?busca=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? (r.json() as Promise<PainelPacientesResposta>) : null))
        .catch(() => null),
    ]);
    setList(p);
    setClientes(c);
    if (painelRes) {
      setPainel(painelRes.pacientes || []);
      setTotalPainel(painelRes.total || 0);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

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
    void load();
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
        alert(data.error || t("cadastros.pacientes.erroExcluir"));
        void load();
      }
    } catch {
      alert(t("cadastros.pacientes.erroExcluir"));
      void load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("cadastros.pacientes.titulo")}</h1>
          <p className="text-slate-600">{t("cadastros.pacientes.subtitulo")}</p>
        </div>
        <Button onClick={openNew} disabled={clientes.length === 0}>
          <Plus className="h-4 w-4" /> {t("cadastros.pacientes.novo")}
        </Button>
      </div>

      {totalPainel > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {t("cadastros.pacientes.comTrabalho")}
                </p>
                <p className="text-lg font-semibold">{totalPainel}</p>
              </div>
            </div>
          </Card>
          {painel.slice(0, 2).map((p) => (
            <Card key={p.pacienteId} className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                {t("cadastros.pacientes.maisRecente")}
              </p>
              <p className="font-semibold">{p.pacienteNome}</p>
              <p className="text-xs text-slate-500">
                {p.cliente?.nome || "—"} · {t("cadastros.pacientes.trabalhos", { n: p.totalTrabalhos })}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
              placeholder={t("cadastros.pacientes.buscarPlaceholder")}
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
            { valor: "nome", label: t("cadastros.comum.nome") },
            { valor: "cliente", label: t("relatorio.comum.cliente") },
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
        <Table headers={[
          t("cadastros.comum.nome"),
          t("relatorio.comum.cliente"),
          t("cadastros.pacientes.campoCpf"),
          t("cadastros.pacientes.campoTelefone"),
          t("cadastros.comum.acoes"),
        ]}>
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
        title={editing ? t("cadastros.pacientes.editar") : t("cadastros.pacientes.novo")}
      >
        <form onSubmit={save} className="space-y-4">
          <SelectPesquisavel
            label={t("cadastros.pacientes.campoCliente")}
            value={form.clienteId}
            onChange={(clienteId) => setForm({ ...form, clienteId })}
            placeholder={t("cadastros.comum.selecione")}
            required
            menuEmPortal
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          />
          <Input
            label={t("cadastros.pacientes.campoNome")}
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <Input
            label={t("cadastros.pacientes.campoCpf")}
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
          />
          <Input
            label={t("cadastros.pacientes.campoTelefone")}
            placeholder={PLACEHOLDER_TELEFONE_BR}
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cadastros.comum.cancelar")}
            </Button>
            <Button type="submit">{t("cadastros.comum.salvar")}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmacaoExclusaoModal
        open={!!pacienteParaExcluir}
        titulo={t("cadastros.pacientes.excluirTitulo")}
        mensagem={t("cadastros.pacientes.excluirConfirmacao")}
        detalhe={pacienteParaExcluir?.nome}
        onClose={() => setPacienteParaExcluir(null)}
        onConfirm={confirmarExclusaoPaciente}
      />
    </div>
  );
}
