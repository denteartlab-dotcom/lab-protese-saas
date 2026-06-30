import { enviarEmailResend } from "@/lib/email-resend";
import { montarUrlPublica } from "@/lib/app-url";

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function enviarEmailSenhaNovoUsuario(params: {
  email: string;
  nome: string;
  senha: string;
  nomeLaboratorio?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const email = params.email.trim().toLowerCase();
  const nome = params.nome.trim();
  const lab = params.nomeLaboratorio?.trim() || "Lab Prótese";
  const loginUrl = montarUrlPublica("/login");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px;color:#1e3a8a">Acesso ao ${escapeHtml(lab)}</h1>
      <p>Olá, <strong>${escapeHtml(nome)}</strong>!</p>
      <p>Seu usuário foi cadastrado no sistema. Use as credenciais abaixo para entrar:</p>
      <table style="margin:20px 0;border-collapse:collapse;width:100%">
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-size:13px;color:#64748b;width:100px">E-mail</td>
          <td style="padding:8px 12px;background:#f8fafc;font-size:14px;font-weight:600">${escapeHtml(email)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-size:13px;color:#64748b">Senha</td>
          <td style="padding:8px 12px;background:#f8fafc;font-size:14px;font-weight:600;letter-spacing:1px">${escapeHtml(params.senha)}</td>
        </tr>
      </table>
      <p style="margin:24px 0">
        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:4px;font-size:14px">Acessar o sistema</a>
      </p>
      <p style="font-size:13px;color:#64748b">Por segurança, altere sua senha após o primeiro acesso em <strong>Alterar senha</strong>.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:32px">Lab Prótese — denteartlab.com.br</p>
    </div>
  `;

  const text = [
    `Olá, ${nome}!`,
    "",
    `Seu usuário foi cadastrado no ${lab}.`,
    "",
    `E-mail: ${email}`,
    `Senha: ${params.senha}`,
    "",
    `Acesse: ${loginUrl}`,
    "",
    "Altere sua senha após o primeiro acesso.",
  ].join("\n");

  const resultado = await enviarEmailResend({
    to: email,
    subject: `Seu acesso ao ${lab}`,
    html,
    text,
  });

  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro || "Não foi possível enviar o e-mail com a senha." };
  }

  return { ok: true };
}
