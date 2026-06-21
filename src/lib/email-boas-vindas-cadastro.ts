import { enviarEmailResend, emailResendConfigurado } from "@/lib/email-resend";
import { DIAS_TESTE_GRATIS } from "@/lib/master-planos";
import { urlPublicaApp } from "@/lib/url-publica-app";

export type DadosEmailBoasVindasCadastro = {
  nome: string;
  email: string;
  laboratorio: string;
  slug: string;
};

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BENEFICIOS = [
  "Controle completo de trabalhos e ordens de serviço",
  "Gestão de produção por etapas e prazos",
  "Financeiro integrado: faturamento, contas a receber e relatórios",
  "Portal para dentistas acompanharem status e entregas",
  "Relatórios gerenciais para decisões no dia a dia",
  `Teste grátis de ${DIAS_TESTE_GRATIS} dias no plano Premium com acesso total`,
] as const;

/** Monta HTML responsivo com CSS inline (Gmail, Outlook, etc.). */
export function montarHtmlEmailBoasVindasCadastro(dados: {
  nome: string;
  email: string;
  laboratorio: string;
  loginUrl: string;
}): string {
  const nome = escapeHtml(dados.nome.trim() || "Cliente");
  const email = escapeHtml(dados.email.trim());
  const laboratorio = escapeHtml(dados.laboratorio.trim());
  const loginUrl = escapeHtml(dados.loginUrl.trim());
  const ano = new Date().getFullYear();
  const logoUrl = `${urlPublicaApp()}/images/lab-protese-logo.png`;

  const listaBeneficios = BENEFICIOS.map(
    (item) =>
      `<tr>
        <td style="padding:0 0 10px 0;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#334155;">
          <span style="color:#0066FF;font-weight:700;margin-right:8px;">✓</span>${escapeHtml(item)}
        </td>
      </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Bem-vindo ao Lab Prótese</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f9;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:32px 32px 24px 32px;text-align:center;border-bottom:1px solid #f1f5f9;">
              <img src="${logoUrl}" alt="Lab Prótese" width="180" height="48" style="display:block;margin:0 auto;max-width:180px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:Segoe UI,Arial,sans-serif;">
              <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;font-weight:700;color:#0f172a;text-align:center;">
                Bem-vindo ao Lab Prótese 🚀
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#475569;text-align:center;">
                Olá, <strong style="color:#0f172a;">${nome}</strong>!
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;text-align:center;">
                Seu cadastro foi realizado com <strong style="color:#0f172a;">sucesso</strong>.
                Estamos felizes em ter o laboratório <strong style="color:#0f172a;">${laboratorio}</strong> conosco.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;font-family:Segoe UI,Arial,sans-serif;">
              <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#0f172a;">
                O que você pode fazer no sistema:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${listaBeneficios}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 28px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="#0066FF" style="border-radius:10px;background-color:#0066FF;">
                    <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Acessar minha conta
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:20px 20px 8px 20px;font-family:Segoe UI,Arial,sans-serif;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">
                    Dados do cadastro
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 8px 20px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#334155;">
                    <strong style="color:#0f172a;">Nome do laboratório:</strong><br />
                    ${laboratorio}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 20px 20px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#334155;">
                    <strong style="color:#0f172a;">E-mail:</strong><br />
                    <a href="mailto:${email}" style="color:#0066FF;text-decoration:none;">${email}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;font-family:Segoe UI,Arial,sans-serif;">
              <p style="margin:0 0 6px 0;font-size:14px;font-weight:600;color:#0f172a;">
                Equipe Lab Prótese
              </p>
              <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#64748b;">
                Gestão inteligente para laboratórios odontológicos
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © ${ano} Lab Prótese — denteartlab.com.br
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function montarTextoEmailBoasVindasCadastro(dados: {
  nome: string;
  email: string;
  laboratorio: string;
  loginUrl: string;
}): string {
  const beneficios = BENEFICIOS.map((b) => `• ${b}`).join("\n");
  return `Bem-vindo ao Lab Prótese!

Olá, ${dados.nome.trim() || "Cliente"}!

Seu cadastro foi realizado com sucesso. Estamos felizes em ter o laboratório ${dados.laboratorio.trim()} conosco.

O que você pode fazer no sistema:
${beneficios}

Acessar minha conta: ${dados.loginUrl}

Dados do cadastro:
Nome do laboratório: ${dados.laboratorio.trim()}
E-mail: ${dados.email.trim()}

Equipe Lab Prótese
Gestão inteligente para laboratórios odontológicos
© ${new Date().getFullYear()} Lab Prótese`;
}

export async function enviarEmailBoasVindasCadastro(
  dados: DadosEmailBoasVindasCadastro
): Promise<{ ok: boolean; erro?: string }> {
  if (!emailResendConfigurado()) {
    return { ok: false, erro: "RESEND_API_KEY não configurada." };
  }

  const baseUrl = urlPublicaApp();
  const loginUrl = `${baseUrl}/login?cadastro=ok&lab=${encodeURIComponent(dados.slug.trim())}`;
  const payload = {
    nome: dados.nome,
    email: dados.email,
    laboratorio: dados.laboratorio,
    loginUrl,
  };

  const resultado = await enviarEmailResend({
    to: dados.email.trim(),
    subject: "Bem-vindo ao Lab Prótese 🚀",
    html: montarHtmlEmailBoasVindasCadastro(payload),
    text: montarTextoEmailBoasVindasCadastro(payload),
  });

  if (!resultado.ok) {
    console.error("[email-boas-vindas]", resultado.erro);
    return { ok: false, erro: resultado.erro };
  }

  return { ok: true };
}
