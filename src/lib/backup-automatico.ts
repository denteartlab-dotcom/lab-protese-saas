import { access, writeFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { caminhoRelativoPastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { exportarBackupEmpresa } from "@/lib/backup-laboratorio";
import {
  calcularProximoBackupEm,
  carregarConfigBackupAutomatico,
  formatarDataBackup,
  msAteProximoAgendamento,
  registrarExecucaoBackupAutomatico,
  type BackupAutomaticoConfig,
} from "@/lib/backup-automatico-config";
import {
  backupAutomaticoHabilitadoNoServidor,
  caminhoArquivoBackupAutomaticoEmpresa,
  fusoBackupAutomatico,
  garantirPastaBackup,
  garantirPastaBackupEmpresa,
  nomeArquivoBackupAutomatico,
} from "@/lib/backup-automatico-servidor";

type EmpresaAtiva = { id: string; slug: string; nome: string };

const globalBackup = globalThis as typeof globalThis & {
  __backupTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __backupExecutando?: Set<string>;
};

function timersPorEmpresa() {
  if (!globalBackup.__backupTimers) {
    globalBackup.__backupTimers = new Map();
  }
  return globalBackup.__backupTimers;
}

function empresasEmExecucao() {
  if (!globalBackup.__backupExecutando) {
    globalBackup.__backupExecutando = new Set();
  }
  return globalBackup.__backupExecutando;
}

export { BACKUP_ARQUIVO_PADRAO } from "@/lib/backup-automatico-servidor";

/** Gera backup da empresa na pasta `backups/{nome}/`. */
export async function executarBackupAutomatico(
  empresaId: string,
  slug: string,
  nome?: string
) {
  const chave = empresaId;
  if (empresasEmExecucao().has(chave)) {
    console.warn(`[backup-automatico] ${slug}: execução já em andamento.`);
    return null;
  }

  empresasEmExecucao().add(chave);
  const fuso = fusoBackupAutomatico();
  const agora = new Date();

  try {
    await garantirPastaBackup();
    await garantirPastaBackupEmpresa(slug, nome);
    const destino = caminhoArquivoBackupAutomaticoEmpresa(slug, nome, agora, fuso);
    const backup = await exportarBackupEmpresa(prisma, empresaId);
    const conteudo = JSON.stringify(backup, null, 2);
    await writeFile(destino, conteudo, "utf8");

    try {
      await access(destino);
    } catch {
      throw new Error(`Arquivo de backup não encontrado após gravação: ${destino}`);
    }

    await registrarExecucaoBackupAutomatico(empresaId, backup.exportedAt, destino);
    console.log(
      `[backup-automatico] ${slug}: gravado em ${destino} (${backup.exportedAt})`
    );
    return { destino, exportedAt: backup.exportedAt, slug, empresaId };
  } catch (erro) {
    console.error(`[backup-automatico] ${slug}: falha`, erro);
    return null;
  } finally {
    empresasEmExecucao().delete(chave);
  }
}

async function listarEmpresasAtivas(): Promise<EmpresaAtiva[]> {
  return prisma.empresa.findMany({
    where: { status: "ativo" },
    select: { id: true, slug: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

function agendarProximoBackupEmpresa(
  empresa: EmpresaAtiva,
  config: BackupAutomaticoConfig
) {
  const mapa = timersPorEmpresa();
  const timerAtual = mapa.get(empresa.id);
  if (timerAtual) clearTimeout(timerAtual);

  if (!config.ativo) return;

  const fuso = fusoBackupAutomatico();
  const atraso = msAteProximoAgendamento(config, fuso);

  const timer = setTimeout(() => {
    void executarBackupAutomatico(empresa.id, empresa.slug, empresa.nome)
      .catch((erro) => {
        console.error(`[backup-automatico] ${empresa.slug}: falha`, erro);
      })
      .finally(() => {
        void reagendarBackupEmpresa(empresa);
      });
  }, atraso);

  mapa.set(empresa.id, timer);

  const proximo = calcularProximoBackupEm(config, fuso);
  const proximoTexto = formatarDataBackup(proximo, fuso) ?? "—";
  console.log(
    `[backup-automatico] ${empresa.slug}: próximo ${proximoTexto} (em ${Math.round(atraso / 1000)}s)`
  );
}

async function reagendarBackupEmpresa(empresa: EmpresaAtiva) {
  try {
    const config = await carregarConfigBackupAutomatico(empresa.id);
    agendarProximoBackupEmpresa(empresa, config);
  } catch (erro) {
    console.error(`[backup-automatico] ${empresa.slug}: falha ao reagendar`, erro);
  }
}

export async function reagendarBackupAutomatico() {
  if (!backupAutomaticoHabilitadoNoServidor()) return;
  try {
    const empresas = await listarEmpresasAtivas();
    await Promise.all(empresas.map((empresa) => reagendarBackupEmpresa(empresa)));
  } catch (erro) {
    console.error("[backup-automatico] falha ao reagendar:", erro);
  }
}

export async function iniciarBackupAutomaticoDiario() {
  if (!backupAutomaticoHabilitadoNoServidor()) {
    console.log("[backup-automatico] desativado (BACKUP_AUTOMATICO_ENABLED=false).");
    return;
  }

  try {
    await garantirPastaBackup();
    const empresas = await listarEmpresasAtivas();
    const exemplo = empresas[0];
    const pastaExemplo = exemplo
      ? caminhoRelativoPastaBackupEmpresa(exemplo.slug, exemplo.nome)
      : "backups/{empresa}";
    console.log(
      `[backup-automatico] pastas por empresa: ${pastaExemplo}/${nomeArquivoBackupAutomatico()} fuso=${fusoBackupAutomatico()}`
    );
    await reagendarBackupAutomatico();
  } catch (erro) {
    console.error("[backup-automatico] falha ao iniciar agendamento:", erro);
  }
}
