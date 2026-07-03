import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import {
  marcarCodigoVerificacaoUsado,
  validarCodigoVerificacaoCadastro,
} from "@/lib/cadastro-verificacao-email";
import { enviarEmailBoasVindasCadastro } from "@/lib/email-boas-vindas-cadastro";
import { provisionarNovaEmpresa } from "@/lib/provisionar-empresa";
import { montarSessionUserComAssinatura } from "@/lib/sessao-assinatura";
import { PLANOS_EMPRESA, PERIODOS_COBRANCA, DIAS_TESTE_GRATIS } from "@/lib/master-planos";
import { apenasDigitos, validarCpfOuCnpj } from "@/lib/validar-documento";
import { validarForcaSenha } from "@/lib/validar-senha";

const schemaCompleto = z
  .object({
    nome: z.string().min(2, "Informe o nome do laboratório."),
    responsavel: z.string().min(2, "Informe o nome do responsável."),
    cnpj: z.string().min(11, "Informe CPF ou CNPJ válido."),
    telefone: z.string().min(10, "Informe um telefone válido."),
    whatsapp: z.string().optional(),
    emailLaboratorio: z.string().email("E-mail do laboratório inválido."),
    cidade: z.string().optional(),
    estado: z.string().optional(),
    plano: z.enum(PLANOS_EMPRESA).default("profissional"),
    periodoCobranca: z.enum(PERIODOS_COBRANCA).optional(),
    adminNome: z.string().min(2, "Informe o nome do administrador."),
    adminEmail: z.string().email("E-mail de login inválido."),
    adminSenha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
    confirmarSenha: z.string().min(8),
    aceiteTermos: z.literal(true, {
      errorMap: () => ({ message: "Aceite os termos para continuar." }),
    }),
    codigoVerificacao: z
      .string()
      .regex(/^\d{6}$/, "Informe o código de 6 dígitos enviado por e-mail."),
  })
  .refine((d) => d.adminSenha === d.confirmarSenha, {
    message: "As senhas não conferem.",
    path: ["confirmarSenha"],
  })
  .refine((d) => validarCpfOuCnpj(d.cnpj), {
    message: "CPF ou CNPJ inválido.",
    path: ["cnpj"],
  })
  .refine((d) => validarForcaSenha(d.adminSenha).valida, {
    message: "Senha fraca: use maiúscula, minúscula e número (mín. 8 caracteres).",
    path: ["adminSenha"],
  });

const schemaSimples = z
  .object({
    nome: z.string().min(2, "Informe o nome do laboratório."),
    email: z.string().email("E-mail inválido."),
    pais: z.string().optional(),
    codigoTelefone: z.string().default("+55"),
    whatsapp: z.string().min(8, "Informe um celular válido."),
    adminSenha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
    confirmarSenha: z.string().min(8),
    aceiteTermos: z.literal(true, {
      errorMap: () => ({ message: "Aceite os termos para continuar." }),
    }),
    plano: z.enum(PLANOS_EMPRESA).optional(),
    periodoCobranca: z.enum(PERIODOS_COBRANCA).optional(),
    codigoVerificacao: z
      .string()
      .regex(/^\d{6}$/, "Informe o código de 6 dígitos enviado por e-mail."),
  })
  .refine((d) => d.adminSenha === d.confirmarSenha, {
    message: "As senhas não conferem.",
    path: ["confirmarSenha"],
  })
  .refine((d) => validarForcaSenha(d.adminSenha).valida, {
    message: "Senha fraca: use maiúscula, minúscula e número (mín. 8 caracteres).",
    path: ["adminSenha"],
  });

function montarTelefone(codigoTelefone: string, whatsapp: string) {
  const numero = apenasDigitos(whatsapp);
  const codigo = apenasDigitos(codigoTelefone);
  return codigo && !numero.startsWith(codigo) ? `${codigo}${numero}` : numero;
}

function normalizarCadastro(body: unknown) {
  if (!body || typeof body !== "object") return null;

  const dados = body as Record<string, unknown>;
  if ("emailLaboratorio" in dados || "adminEmail" in dados) {
    const parsed = schemaCompleto.safeParse(body);
    if (!parsed.success) return { ok: false as const, error: parsed.error };
    const {
      confirmarSenha: _c,
      aceiteTermos: _a,
      codigoVerificacao,
      ...resto
    } = parsed.data;
    return {
      ok: true as const,
      dados: resto,
      codigoVerificacao,
      emailVerificacao: parsed.data.adminEmail,
    };
  }

  const parsed = schemaSimples.safeParse(body);
  if (!parsed.success) return { ok: false as const, error: parsed.error };

  const { email, whatsapp, codigoTelefone, nome, codigoVerificacao, ...resto } = parsed.data;
  const telefone = montarTelefone(codigoTelefone, whatsapp);

  return {
    ok: true as const,
    dados: {
      nome,
      responsavel: nome,
      cnpj: "",
      telefone,
      whatsapp: telefone,
      emailLaboratorio: email,
      adminNome: nome,
      adminEmail: email,
      adminSenha: resto.adminSenha,
      plano: "premium" as const,
      periodoCobranca: resto.periodoCobranca,
    },
    codigoVerificacao,
    emailVerificacao: email,
  };
}

const MENSAGENS: Record<string, string> = {
  SLUG_INVALIDO: "Não foi possível gerar o identificador do laboratório.",
  SLUG_EM_USO: "Este laboratório já possui cadastro. Tente outro nome.",
  LABORATORIO_EXISTE: "Já existe um laboratório com este nome.",
  EMAIL_RESERVADO: "Este e-mail não pode ser utilizado no cadastro.",
  NOME_INVALIDO: "Nome do laboratório inválido.",
  RESPONSAVEL_INVALIDO: "Nome do responsável inválido.",
  DOCUMENTO_INVALIDO: "CPF ou CNPJ inválido.",
  TELEFONE_INVALIDO: "Telefone inválido.",
  EMAIL_LAB_INVALIDO: "E-mail do laboratório inválido.",
  CIDADE_INVALIDA: "Cidade inválida.",
  ESTADO_INVALIDO: "Estado inválido.",
  ADMIN_NOME_INVALIDO: "Nome do administrador inválido.",
  EMAIL_INVALIDO: "E-mail de login inválido.",
  SENHA_FRACA: "Senha fraca: use maiúscula, minúscula e número (mín. 8 caracteres).",
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = normalizarCadastro(body);
  if (!parsed) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dados inválidos." },
      { status: 400 }
    );
  }

  const dados = parsed.dados;

  const verificacao = await validarCodigoVerificacaoCadastro(
    parsed.emailVerificacao,
    parsed.codigoVerificacao
  );
  if (!verificacao.ok) {
    return NextResponse.json(
      { error: verificacao.erro || "Código de verificação inválido." },
      { status: 400 }
    );
  }

  try {
    const empresa = await provisionarNovaEmpresa(dados);
    if (verificacao.registroId) {
      await marcarCodigoVerificacaoUsado(verificacao.registroId);
    }

    void enviarEmailBoasVindasCadastro({
      nome: dados.adminNome,
      email: dados.adminEmail,
      laboratorio: empresa.nome,
      slug: empresa.slug,
    }).catch((erro) => {
      console.warn("[cadastro/boas-vindas]", erro);
    });

    /** Auto-login pós-cadastro (issue 021): já cria sessão para evitar redirect duplo. */
    let autoLogin = false;
    try {
      const sessionUser = await montarSessionUserComAssinatura(empresa.adminId);
      if (sessionUser) {
        await createSession(sessionUser, { remember: false });
        autoLogin = true;
      }
    } catch (erro) {
      console.warn("[cadastro/auto-login]", erro);
    }

    const urlApp = `/app/${empresa.slug}`;
    return NextResponse.json(
      {
        ok: true,
        mensagem: `Conta criada! Você tem ${DIAS_TESTE_GRATIS} dias de teste grátis no plano Premium.`,
        autoLogin,
        redirect: autoLogin ? urlApp : `/login?cadastro=ok&lab=${empresa.slug}`,
        empresa: {
          id: empresa.empresaId,
          codigo: empresa.codigo,
          nome: empresa.nome,
          slug: empresa.slug,
          urlApp,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const codigo = err instanceof Error ? err.message : "ERRO";
    const mensagem = MENSAGENS[codigo] || "Não foi possível criar o laboratório.";
    const status =
      codigo === "SLUG_EM_USO" ||
      codigo === "LABORATORIO_EXISTE" ||
      codigo === "EMAIL_RESERVADO"
        ? 409
        : 400;
    return NextResponse.json({ error: mensagem, code: codigo }, { status });
  }
}
