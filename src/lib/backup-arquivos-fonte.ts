import {
  caminhoRelativoPastaBackupEmpresa,
} from "@/lib/backup-empresa-pasta";
import {
  excluirArquivosPastaBackupEmpresa,
  lerArquivoBackupPastaEmpresa,
  listarArquivosPastaBackupEmpresa,
  type ArquivoPastaBackup,
} from "@/lib/backup-automatico-servidor";
import {
  caminhoDriveEmpresa,
  excluirArquivosBackupEmpresaGoogleDrive,
  googleDriveBackupHabilitado,
  lerArquivoBackupEmpresaGoogleDrive,
  listarArquivosBackupEmpresaGoogleDrive,
  statusGoogleDriveBackup,
} from "@/lib/backup-google-drive";

export type OrigemBackupArquivos = "gdrive" | "local";

export type ListaBackupFonte = {
  origem: OrigemBackupArquivos;
  pasta: string;
  arquivos: ArquivoPastaBackup[];
};

function driveProntoParaListar() {
  const status = statusGoogleDriveBackup();
  return status.habilitado && status.configurado;
}

/** Lista backups no Google Drive. Só usa a pasta local se o Drive não estiver configurado. */
export async function listarArquivosBackupFonte(params: {
  empresaId: string;
  slug: string;
  nome?: string;
}): Promise<ListaBackupFonte> {
  if (driveProntoParaListar()) {
    try {
      const arquivos = await listarArquivosBackupEmpresaGoogleDrive(params);
      return {
        origem: "gdrive",
        pasta: caminhoDriveEmpresa(params.slug, params.nome),
        arquivos: arquivos.map(({ nome, bytes, modificadoEm }) => ({
          nome,
          bytes,
          modificadoEm,
        })),
      };
    } catch (erro) {
      console.warn(
        "[backup-fonte] Drive indisponível na listagem, usando pasta local:",
        erro
      );
    }
  } else if (googleDriveBackupHabilitado()) {
    return {
      origem: "gdrive",
      pasta: caminhoDriveEmpresa(params.slug, params.nome),
      arquivos: [],
    };
  }

  const arquivos = await listarArquivosPastaBackupEmpresa(params.slug, params.nome);
  return {
    origem: "local",
    pasta: caminhoRelativoPastaBackupEmpresa(params.slug, params.nome),
    arquivos,
  };
}

export async function lerArquivoBackupFonte(params: {
  empresaId: string;
  slug: string;
  nome?: string;
  nomeArquivo: string;
}) {
  if (driveProntoParaListar()) {
    try {
      return await lerArquivoBackupEmpresaGoogleDrive(params);
    } catch (erro) {
      console.warn("[backup-fonte] Drive indisponível, tentando pasta local:", erro);
    }
  }
  return lerArquivoBackupPastaEmpresa(params.slug, params.nomeArquivo, params.nome);
}

export async function excluirArquivosBackupFonte(params: {
  empresaId: string;
  slug: string;
  nome?: string;
  nomes: string[];
}) {
  if (driveProntoParaListar()) {
    return excluirArquivosBackupEmpresaGoogleDrive(params);
  }
  return excluirArquivosPastaBackupEmpresa(params.slug, params.nomes, params.nome);
}
