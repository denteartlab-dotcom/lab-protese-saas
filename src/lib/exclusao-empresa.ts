import { rm } from "fs/promises";
import { pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { excluirPastaDriveEmpresa } from "@/lib/backup-google-drive";
import { excluirPastaBackupEmpresaOneDrive } from "@/lib/backup-onedrive-sync";
import { prisma } from "@/lib/db";
import { excluirJsonStoreTenant } from "@/lib/json-store-tenant";
import { registrarLogMaster } from "@/lib/master-audit";
import { caminhoPastaUploads } from "@/lib/uploads-armazenamento-server";
import { listarEmpresasElegiveisExclusaoInatividade } from "@/lib/empresa-inatividade";

export type DadosEmpresaExclusao = {
  id: string;
  slug: string;
  nome: string;
  codigo?: string | null;
};

export type MotivoExclusaoEmpresa = "manual" | "inatividade";

export type OpcoesExclusaoEmpresa = {
  motivo: MotivoExclusaoEmpresa;
  masterId?: string;
  ip?: string;
  detalhesExtra?: string;
  /** false = remove do banco e limpa arquivos em segundo plano (resposta rápida na UI). */
  aguardarArquivos?: boolean;
};

async function excluirArquivosLocaisEmpresa(slug: string, nome: string) {
  const caminhos = [pastaBackupEmpresa(slug, nome), caminhoPastaUploads(slug)];
  for (const caminho of caminhos) {
    try {
      await rm(caminho, { recursive: true, force: true });
      console.log(`[exclusao-empresa] removido: ${caminho}`);
    } catch (erro) {
      console.warn(`[exclusao-empresa] falha ao remover ${caminho}:`, erro);
    }
  }
}

async function registrarAuditoriaExclusao(
  empresa: DadosEmpresaExclusao,
  opcoes: OpcoesExclusaoEmpresa
) {
  const acao =
    opcoes.motivo === "inatividade" ? "EXCLUIR_EMPRESA_INATIVA" : "EXCLUIR_EMPRESA";
  const detalhesBase =
    opcoes.motivo === "inatividade"
      ? `Conta excluída por inatividade (30+ dias sem acesso e sem assinatura paga): ${empresa.nome}`
      : `Empresa excluída: ${empresa.nome} (${empresa.codigo ?? empresa.id})`;
  const detalhes = opcoes.detalhesExtra
    ? `${detalhesBase}. ${opcoes.detalhesExtra}`
    : detalhesBase;

  if (opcoes.masterId) {
    await registrarLogMaster(opcoes.masterId, acao, {
      empresaId: empresa.id,
      detalhes,
      ip: opcoes.ip,
    });
    return;
  }

  console.log(`[exclusao-empresa] ${acao}: ${detalhes}`);
}

async function limparArquivosEmpresaExcluida(slug: string, nome: string, empresaId: string) {
  const drive = await excluirPastaDriveEmpresa({
    empresaId,
    slug,
    nome,
  });
  if (!drive.ok && drive.erro && drive.erro !== "desativado") {
    console.warn(`[exclusao-empresa] Drive ${slug}:`, drive.erro);
  }

  const onedrive = await excluirPastaBackupEmpresaOneDrive(slug, nome);
  if (!onedrive.ok && onedrive.erro && onedrive.erro !== "desativado") {
    console.warn(`[exclusao-empresa] OneDrive ${slug}:`, onedrive.erro);
  }

  await excluirArquivosLocaisEmpresa(slug, nome);
}

/** Remove backups (local, Drive, OneDrive), uploads, JsonStore e registro no banco. */
export async function excluirEmpresaCompleta(
  empresa: DadosEmpresaExclusao,
  opcoes: OpcoesExclusaoEmpresa
) {
  const aguardarArquivos = opcoes.aguardarArquivos !== false;

  await excluirJsonStoreTenant(empresa.id);
  await prisma.empresa.delete({ where: { id: empresa.id } });
  await registrarAuditoriaExclusao(empresa, opcoes);

  const limparArquivos = () =>
    limparArquivosEmpresaExcluida(empresa.slug, empresa.nome, empresa.id).catch((erro) => {
      console.error(`[exclusao-empresa] limpeza de arquivos ${empresa.slug}:`, erro);
    });

  if (aguardarArquivos) {
    await limparArquivos();
  } else {
    void limparArquivos();
  }
}

export async function executarLimpezaContasInativas(opcoes?: {
  simular?: boolean;
  masterId?: string;
}) {
  const elegiveis = await listarEmpresasElegiveisExclusaoInatividade();

  if (opcoes?.simular) {
    return {
      simulacao: true,
      total: elegiveis.length,
      empresas: elegiveis.map((e) => ({
        id: e.id,
        slug: e.slug,
        nome: e.nome,
        codigo: e.codigo,
      })),
    };
  }

  const excluidas: Array<{ id: string; slug: string; nome: string }> = [];
  for (const empresa of elegiveis) {
    try {
      await excluirEmpresaCompleta(empresa, {
        motivo: "inatividade",
        masterId: opcoes?.masterId,
      });
      excluidas.push({ id: empresa.id, slug: empresa.slug, nome: empresa.nome });
    } catch (erro) {
      console.error(`[limpeza-inativas] falha ${empresa.slug}:`, erro);
    }
  }

  return { simulacao: false, total: excluidas.length, empresas: excluidas };
}

let timerLimpezaInatividade: ReturnType<typeof setTimeout> | null = null;

function msAteProximaExecucaoDiaria(hora = 4, minuto = 15) {
  const agora = new Date();
  const proxima = new Date(agora);
  proxima.setHours(hora, minuto, 0, 0);
  if (proxima.getTime() <= agora.getTime()) {
    proxima.setDate(proxima.getDate() + 1);
  }
  return proxima.getTime() - agora.getTime();
}

/** Agenda limpeza diária de contas inativas (servidor VPS). */
export function iniciarLimpezaContasInativasDiaria() {
  if (process.env.LIMPEZA_INATIVOS_ENABLED === "0") return;

  const agendar = () => {
    timerLimpezaInatividade = setTimeout(async () => {
      try {
        const resultado = await executarLimpezaContasInativas();
        console.log(
          `[limpeza-inativas] concluída: ${resultado.total} conta(s) excluída(s).`
        );
      } catch (erro) {
        console.error("[limpeza-inativas] erro:", erro);
      } finally {
        agendar();
      }
    }, msAteProximaExecucaoDiaria());
  };

  agendar();
  console.log("[limpeza-inativas] agendada diariamente (~04:15).");
}
