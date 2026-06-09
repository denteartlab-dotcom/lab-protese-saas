import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listarContasBancariasServidor } from "@/lib/conta-bancaria-servidor";
import { contaOfxCombina, parseOfxArquivo } from "@/lib/extrato-ofx";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo OFX não enviado." },
        { status: 400 }
      );
    }

    const nome = arquivo.name.toLowerCase();
    if (!nome.endsWith(".ofx") && !nome.endsWith(".qfx")) {
      return NextResponse.json(
        { error: "Somente arquivos OFX são aceitos." },
        { status: 400 }
      );
    }

    const texto = await arquivo.text();
    const resultado = parseOfxArquivo(texto);
    const contas = await listarContasBancariasServidor();

    const contaEncontrada =
      contas.find((c) => contaOfxCombina(c, resultado.dadosConta)) ?? null;

    const numeroOfx = resultado.dadosConta.numeroConta.trim();
    const contaNaoCadastrada = Boolean(numeroOfx && !contaEncontrada);

    return NextResponse.json({
      parseResult: resultado,
      contaEncontrada,
      contaNaoCadastrada,
      dadosConta: resultado.dadosConta,
      contasCadastradas: contas.filter((c) => !c.excluida),
    });
  } catch (err) {
    console.error("[contas-bancarias/ofx POST]", err);
    return NextResponse.json(
      { error: "Falha ao ler o arquivo OFX." },
      { status: 500 }
    );
  }
}
