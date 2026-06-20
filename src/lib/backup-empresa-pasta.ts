import path from "path";
import { pastaBackupResolvida } from "@/lib/backup-automatico-servidor";

/** Nome seguro para pasta no disco — prioriza o nome da empresa. */
export function nomePastaBackupEmpresa(slug: string, nome?: string) {
  const doNome = (nome ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "")
    .slice(0, 48);

  if (doNome) return doNome;

  const doSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return doSlug || "empresa";
}

/** Caminho absoluto: `backups/{nome-empresa}/` */
export function pastaBackupEmpresa(slug: string, nome?: string) {
  return path.join(pastaBackupResolvida(), nomePastaBackupEmpresa(slug, nome));
}

/** Caminho relativo exibido na UI: `backups/DenteArt` */
export function caminhoRelativoPastaBackupEmpresa(slug: string, nome?: string) {
  return path
    .relative(process.cwd(), pastaBackupEmpresa(slug, nome))
    .replace(/\\/g, "/");
}

/** Caminho relativo dos anexos espelhados: `backups/DenteArt/uploads` */
export function caminhoRelativoUploadsBackupEmpresa(slug: string, nome?: string) {
  return `${caminhoRelativoPastaBackupEmpresa(slug, nome)}/uploads`;
}
