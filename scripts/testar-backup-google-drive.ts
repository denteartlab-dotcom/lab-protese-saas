import {
  caminhoBackupEhRemotoDrive,
} from "../src/lib/backup-automatico-config";
import {
  candidatosNomePastaEmpresaDrive,
  listarRefreshTokensGoogleDrive,
  normalizarPrivateKeyServiceAccount,
  pastaDriveJaEhRaizBackup,
  traduzirErroGoogleDrive,
} from "../src/lib/google-drive-shared";

function assert(condicao: boolean, mensagem: string) {
  if (!condicao) throw new Error(mensagem);
}

assert(
  caminhoBackupEhRemotoDrive(
    "Lab_Protese_Backups/DenteArt/backups/lab-protese-backup-2026-09-24.json"
  ),
  "caminho do Drive não pode ser tratado como arquivo local"
);
assert(
  caminhoBackupEhRemotoDrive("gdrive:1abcXYZ"),
  "prefixo gdrive: é remoto"
);
assert(
  caminhoBackupEhRemotoDrive("lab-protese-backup-2026-09-24.json"),
  "nome do JSON automático não deve apagar o status"
);
assert(
  caminhoBackupEhRemotoDrive("DenteArt/backups/lab-protese-backup-2026-09-24.json"),
  "caminho lógico Empresa/backups/arquivo é remoto"
);
assert(
  !caminhoBackupEhRemotoDrive("/var/app/backups/DenteArt/lab-protese-backup-2026-09-24.json"),
  "caminho absoluto local continua local"
);
assert(
  !caminhoBackupEhRemotoDrive("backups/DenteArt/lab-protese-backup-2026-09-24.json"),
  "pasta local relativa backups/ continua local"
);

assert(
  pastaDriveJaEhRaizBackup("Lab_Protese_Backups", "Lab_Protese_Backups"),
  "FOLDER_ID com o mesmo nome da raiz deve ser reutilizado"
);
assert(
  pastaDriveJaEhRaizBackup("lab_protese_backups", "Lab_Protese_Backups"),
  "comparação da raiz do Drive é case-insensitive"
);
assert(
  !pastaDriveJaEhRaizBackup("Meu Drive", "Lab_Protese_Backups"),
  "parent genérico não é a pasta raiz de backup"
);

const chave = normalizarPrivateKeyServiceAccount(
  "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n"
);
assert(chave.includes("\nABC\n"), `private_key deve expandir \\n: ${JSON.stringify(chave)}`);
assert(!chave.includes("\\n"), "private_key não pode ficar com barra-n literal");

const tokens = listarRefreshTokensGoogleDrive();
assert(Array.isArray(tokens), "lista de refresh tokens deve ser um array");
assert(new Set(tokens).size === tokens.length, "tokens de refresh não podem repetir");

const traduzido = traduzirErroGoogleDrive(
  new Error("invalid_grant: Token has been expired or revoked")
);
assert(
  /refresh_token expirado|revogado/i.test(traduzido.message),
  `invalid_grant deve virar mensagem amigável: ${traduzido.message}`
);

const candidatos = candidatosNomePastaEmpresaDrive("denteart-1", "Dente Art");
assert(candidatos[0] === "denteart-1", `slug deve vir primeiro: ${candidatos.join(",")}`);
assert(
  candidatos.some((nome) => /dente/i.test(nome) && nome !== "denteart-1"),
  `candidatos devem incluir o nome fantasia: ${candidatos.join(",")}`
);

console.log("ok: backup Google Drive (token, status, pasta raiz e pasta da empresa)");
