import { enviarEmailResend, emailResendConfigurado } from "@/lib/email-resend";
import { urlPublicaApp } from "@/lib/url-publica-app";

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function montarHtmlAvisoInatividade(dados: {
  nome: string;
  laboratorio: string;
  diasRestantes: number;
  dataExclusaoPrevista: string;
  loginUrl: string;
}): string {
  const nome = escapeHtml(dados.nome.trim() || "Cliente");
  const laboratorio = escapeHtml(dados.laboratorio.trim());
  const loginUrl = escapeHtml(dados.loginUrl.trim());
  const dataExclusao = escapeHtml(dados.dataExclusaoPrevista);
  const dias = String(dados.diasRestantes);
  const ano = new Date().getFullYear();
  const logoUrl = `${urlPublicaApp()}/images/lab-protese-logo.png`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aviso de exclusão por inatividade</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f9;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px 20px 32px;text-align:center;border-bottom:1px solid #f1f5f9;">
              <img src="${logoUrl}" alt="Lab Prótese" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;font-family:Segoe UI,Arial,sans-serif;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a;text-align:center;">
                Sua conta pode ser excluída por inatividade
              </h1>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#475569;">
                Olá, <strong style="color:#0f172a;">${nome}</strong>.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#475569;">
                Detectamos que o laboratório <strong style="color:#0f172a;">${laboratorio}</strong>
                está há vários dias sem acesso e sem assinatura ativa.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#475569;">
                Se não houver novo acesso, a conta será excluída em
                <strong style="color:#b91c1c;">${dias} dia(s)</strong>
                (previsão: <strong>${dataExclusao}</strong>).
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#7f1d1d;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;">
                <strong>Atenção:</strong> após a exclusão, você perderá
                <strong>todos os dados do sistema</strong> — cadastros, OS, clientes,
                financeiro, imagens, anexos, backups e pastas de arquivos na nuvem e no servidor.
                <strong>Não restará nada</strong> da conta. Essa ação é irreversível.
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#475569;">
                Para manter a conta e todos os dados, basta entrar novamente no sistema.
                Ao voltar a usar, a exclusão é cancelada automaticamente.
              </p>
              <p style="text-align:center;margin:0 0 8px 0;">
                <a href="${loginUrl}" style="display:inline-block;background:#0066FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:10px;">
                  Acessar minha conta
                </a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px 32px;font-family:Segoe UI,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
              Lab Prótese · ${ano}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function enviarEmailAvisoInatividade(params: {
  to: string;
  nome: string;
  laboratorio: string;
  diasRestantes: number;
  dataExclusaoPrevista: string;
}): Promise<{ ok: boolean; erro?: string }> {
  if (!emailResendConfigurado()) {
    return { ok: false, erro: "RESEND_API_KEY não configurada." };
  }
  const loginUrl = `${urlPublicaApp()}/login`;
  const html = montarHtmlAvisoInatividade({
    nome: params.nome,
    laboratorio: params.laboratorio,
    diasRestantes: params.diasRestantes,
    dataExclusaoPrevista: params.dataExclusaoPrevista,
    loginUrl,
  });
  const text = [
    `Olá, ${params.nome}.`,
    `O laboratório ${params.laboratorio} está inativo.`,
    `Sem novo acesso, a conta será excluída em ${params.diasRestantes} dia(s) (previsão ${params.dataExclusaoPrevista}).`,
    `ATENÇÃO: após a exclusão você perderá TODOS os dados do sistema (cadastros, OS, clientes, financeiro, imagens, anexos, backups e pastas de arquivos). Não restará nada. Ação irreversível.`,
    `Para permanecer no sistema e manter os dados, acesse: ${loginUrl}`,
  ].join("\n");

  return enviarEmailResend({
    to: params.to,
    subject: `Aviso: exclusão total da conta em ${params.diasRestantes} dia(s) — ${params.laboratorio}`,
    html,
    text,
  });
}
