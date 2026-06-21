import { NextResponse } from "next/server";
import { z } from "zod";
import { provisionarNovaEmpresa } from "@/lib/provisionar-empresa";
import { PLANOS_EMPRESA, PERIODOS_COBRANCA } from "@/lib/master-planos";
import { validarCpfOuCnpj } from "@/lib/validar-documento";
import { validarForcaSenha } from "@/lib/validar-senha";

const schema = z
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dados inválidos." },
      { status: 400 }
    );
  }

  const { confirmarSenha: _c, aceiteTermos: _a, ...dados } = parsed.data;

  try {
    const empresa = await provisionarNovaEmpresa(dados);
    return NextResponse.json(
      {
        ok: true,
        mensagem: "Conta criada com sucesso!",
        empresa: {
          id: empresa.empresaId,
          codigo: empresa.codigo,
          nome: empresa.nome,
          slug: empresa.slug,
          urlApp: `/app/${empresa.slug}`,
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
