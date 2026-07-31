import path from "path";
import { rm } from "fs/promises";
import { pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { excluirPastaDriveEmpresa } from "@/lib/backup-google-drive";
import { excluirPastaBackupEmpresaOneDrive } from "@/lib/backup-onedrive-sync";
import { executarSemRls } from "@/lib/db";
import { excluirJsonStoreTenant } from "@/lib/json-store-tenant";
import { registrarLogMaster } from "@/lib/master-audit";
import {
  caminhoPastaUploads,
  normalizarSlugPastaUploads,
} from "@/lib/uploads-armazenamento-server";
import { excluirPastaUploadsEmpresaOneDrive } from "@/lib/upload-onedrive-storage";
import {
  DIAS_AVISO_INATIVIDADE_ANTES,
  DIAS_INATIVIDADE_PARA_EXCLUSAO,
  dataExclusaoPrevistaAviso,
  diasDesdeUltimoAcessoEmpresa,
  listarEmpresasElegiveisAvisoInatividade,
  listarEmpresasElegiveisExclusaoInatividade,
  marcarAvisoInatividadeEnviado,
  resolverEmailAvisoInatividade,
} from "@/lib/empresa-inatividade";
import { enviarEmailAvisoInatividade } from "@/lib/email-aviso-inatividade";

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

async function removerPastaComLog(caminho: string) {
  try {
    await rm(caminho, { recursive: true, force: true });
    console.log(`[exclusao-empresa] removido: ${caminho}`);
  } catch (erro) {
    console.warn(`[exclusao-empresa] falha ao remover ${caminho}:`, erro);
  }
}

/**
 * Apaga todas as pastas locais da empresa: backups, uploads atuais/legado e temp.
 * Não resta pasta de dados do laboratório no disco.
 */
async function excluirArquivosLocaisEmpresa(slug: string, nome: string, empresaId: string) {
  const slugNorm = normalizarSlugPastaUploads(slug);
  const caminhos = [
    pastaBackupEmpresa(slug, nome),
    pastaBackupEmpresa(slug), // legado: pasta só com slug
    caminhoPastaUploads(slug),
    path.join(process.cwd(), "public", "uploads", slugNorm),
    path.join(process.cwd(), ".tmp", "backup-jobs", empresaId),
  ];
  // Remove duplicatas de caminho
  const unicos = [...new Set(caminhos.map((c) => path.resolve(c)))];
  for (const caminho of unicos) {
    await removerPastaComLog(caminho);
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
      ? `Conta e TODOS os dados excluídos por inatividade (${DIAS_INATIVIDADE_PARA_EXCLUSAO}+ dias, após aviso de ${DIAS_AVISO_INATIVIDADE_ANTES} dias): ${empresa.nome}`
      : `Empresa e todos os dados excluídos: ${empresa.nome} (${empresa.codigo ?? empresa.id})`;
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

/**
 * Limpa nuvem + disco: Google Drive, OneDrive (pasta inteira do lab),
 * backups locais, uploads e temporários.
 */
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
    console.warn(`[exclusao-empresa] OneDrive backup ${slug}:`, onedrive.erro);
  }

  // Remove a pasta-raiz do lab no OneDrive (uploads + backups) — não sobra nada.
  const onedriveRaiz = await excluirPastaUploadsEmpresaOneDrive(slug);
  if (!onedriveRaiz.ok && onedriveRaiz.erro) {
    console.warn(`[exclusao-empresa] OneDrive raiz ${slug}:`, onedriveRaiz.erro);
  }

  await excluirArquivosLocaisEmpresa(slug, nome, empresaId);
}

/**
 * Exclusão total da conta: banco (cascade), JsonStore, nuvem e pastas locais.
 * Após concluir, não resta cadastro, arquivo nem pasta do laboratório.
 */
export async function excluirEmpresaCompleta(
  empresa: DadosEmpresaExclusao,
  opcoes: OpcoesExclusaoEmpresa
) {
  const aguardarArquivos = opcoes.aguardarArquivos !== false;

  // Arquivos/nuvem antes do JsonStore (Drive pode precisar do config em JsonStore).
  const limparArquivos = () =>
    limparArquivosEmpresaExcluida(empresa.slug, empresa.nome, empresa.id).catch((erro) => {
      console.error(`[exclusao-empresa] limpeza de arquivos ${empresa.slug}:`, erro);
    });

  if (aguardarArquivos) {
    await limparArquivos();
  } else {
    void limparArquivos();
  }

  await excluirJsonStoreTenant(empresa.id);
  // Cascade Prisma remove users, OS, clientes, financeiro, uploads DB, WhatsApp, etc.
  await executarSemRls((tx) => tx.empresa.delete({ where: { id: empresa.id } }));
  await registrarAuditoriaExclusao(empresa, opcoes);

  console.log(
    `[exclusao-empresa] limpeza total concluída: ${empresa.slug} — banco, arquivos e pastas removidos.`
  );
}

function formatarDataBr(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export async function enviarAvisosInatividadePendentes() {
  const elegiveis = await listarEmpresasElegiveisAvisoInatividade();
  const enviados: Array<{ id: string; slug: string; email: string }> = [];
  const falhas: Array<{ id: string; slug: string; erro: string }> = [];

  for (const empresa of elegiveis) {
    try {
      const destinatario = await resolverEmailAvisoInatividade(empresa);
      if (!destinatario) {
        falhas.push({
          id: empresa.id,
          slug: empresa.slug,
          erro: "sem e-mail de contato",
        });
        continue;
      }

      const diasInativos = diasDesdeUltimoAcessoEmpresa(empresa);
      const diasRestantes = Math.max(
        DIAS_AVISO_INATIVIDADE_ANTES,
        DIAS_INATIVIDADE_PARA_EXCLUSAO - diasInativos
      );
      const dataExclusao = dataExclusaoPrevistaAviso(empresa);

      const resultado = await enviarEmailAvisoInatividade({
        to: destinatario.email,
        nome: destinatario.nome,
        laboratorio: empresa.nome,
        diasRestantes,
        dataExclusaoPrevista: formatarDataBr(dataExclusao),
      });

      if (!resultado.ok) {
        falhas.push({
          id: empresa.id,
          slug: empresa.slug,
          erro: resultado.erro || "falha no envio",
        });
        continue;
      }

      await marcarAvisoInatividadeEnviado(empresa.id);
      enviados.push({
        id: empresa.id,
        slug: empresa.slug,
        email: destinatario.email,
      });
      console.log(
        `[limpeza-inativas] aviso enviado para ${empresa.slug} (${destinatario.email})`
      );
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      falhas.push({ id: empresa.id, slug: empresa.slug, erro: msg });
      console.error(`[limpeza-inativas] aviso falhou ${empresa.slug}:`, erro);
    }
  }

  return { total: enviados.length, enviados, falhas };
}

export async function executarLimpezaContasInativas(opcoes?: {
  simular?: boolean;
  masterId?: string;
}) {
  const avisos = opcoes?.simular
    ? { total: 0, enviados: [], falhas: [] }
    : await enviarAvisosInatividadePendentes();

  const elegiveis = await listarEmpresasElegiveisExclusaoInatividade();

  if (opcoes?.simular) {
    const avisaveis = await listarEmpresasElegiveisAvisoInatividade();
    return {
      simulacao: true,
      avisosPendentes: avisaveis.length,
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
      console.log(
        `[limpeza-inativas] exclusão TOTAL de ${empresa.slug}: banco + pastas + nuvem...`
      );
      await excluirEmpresaCompleta(empresa, {
        motivo: "inatividade",
        masterId: opcoes?.masterId,
        aguardarArquivos: true,
      });
      excluidas.push({ id: empresa.id, slug: empresa.slug, nome: empresa.nome });
    } catch (erro) {
      console.error(`[limpeza-inativas] falha ${empresa.slug}:`, erro);
    }
  }

  return {
    simulacao: false,
    avisosEnviados: avisos.total,
    avisosFalhas: avisos.falhas.length,
    total: excluidas.length,
    empresas: excluidas,
  };
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
          `[limpeza-inativas] concluída: ${resultado.avisosEnviados ?? 0} aviso(s), ${resultado.total} conta(s) excluída(s) por completo.`
        );
      } catch (erro) {
        console.error("[limpeza-inativas] erro:", erro);
      } finally {
        agendar();
      }
    }, msAteProximaExecucaoDiaria());
  };

  agendar();
  console.log(
    `[limpeza-inativas] agendada diariamente (~04:15). Aviso ${DIAS_AVISO_INATIVIDADE_ANTES} dias antes; exclusão TOTAL após ${DIAS_INATIVIDADE_PARA_EXCLUSAO} dias inativos.`
  );
}
