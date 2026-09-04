import {
  executarSemRls,
  runWithTenantContext,
} from "@/lib/db";
import { caminhoRelativoPastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { executarBackupNoServidor } from "@/lib/backup-runner-servidor";
import {
  calcularProximoBackupEm,
  carregarConfigBackupAutomatico,
  formatarDataBackup,
  msAteProximoAgendamento,
  type BackupAutomaticoConfig,
} from "@/lib/backup-automatico-config";
import {
  backupAutomaticoHabilitadoNoServidor,
  fusoBackupAutomatico,
  garantirPastaBackup,
  nomeArquivoBackupAutomatico,
} from "@/lib/backup-automatico-servidor";
import { sincronizarPastasDriveEmpresasAtivas } from "@/lib/backup-google-drive";

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

  try {
    return await runWithTenantContext(empresaId, () =>
      executarBackupNoServidor(empresaId, slug, nome)
    );
  } catch (erro) {
    console.error(`[backup-automatico] ${slug}: falha`, erro);
    return null;
  } finally {
    empresasEmExecucao().delete(chave);
  }
}

async function listarEmpresasAtivas(): Promise<EmpresaAtiva[]> {
  return executarSemRls((tx) =>
    tx.empresa.findMany({
      where: { status: "ativo" },
      select: { id: true, slug: true, nome: true },
      orderBy: { nome: "asc" },
    })
  );
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

async function reagendarBackupEmpresa(
  empresa: EmpresaAtiva,
  configJaCarregada?: BackupAutomaticoConfig
) {
  try {
    const config =
      configJaCarregada ?? (await carregarConfigBackupAutomatico(empresa.id));
    agendarProximoBackupEmpresa(empresa, config);
  } catch (erro) {
    console.error(`[backup-automatico] ${empresa.slug}: falha ao reagendar`, erro);
  }
}

/** Reagenda só uma empresa (usado ao salvar a config na UI). */
export async function reagendarBackupAutomaticoEmpresa(
  empresa: EmpresaAtiva,
  config?: BackupAutomaticoConfig
) {
  if (!backupAutomaticoHabilitadoNoServidor()) return;
  await reagendarBackupEmpresa(empresa, config);
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
    await sincronizarPastasDriveEmpresasAtivas();
    await reagendarBackupAutomatico();
  } catch (erro) {
    console.error("[backup-automatico] falha ao iniciar agendamento:", erro);
  }
}
