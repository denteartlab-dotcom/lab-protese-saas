import { NextResponse } from "next/server";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import {
  MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO,
  montarAcompanhamentoPublico,
} from "@/lib/cliente-acompanhamento";
import { runWithTenantContext } from "@/lib/db";
import { carregarStoreUrgenciasCliente } from "@/lib/urgencia-cliente";
import { carregarStoreRecebimentosCliente } from "@/lib/recebimento-cliente";
import { carregarStoreObservacoesCliente } from "@/lib/observacao-cliente-trabalho";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  const resultado = await buscarClientePublicoPorToken(token);

  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  const { cliente, trabalhos, labNome, mapaEtapas } = resultado;
  const [storeUrgencias, storeRecebimentos, storeObservacoes] = await runWithTenantContext(
    cliente.empresaId,
    () =>
      Promise.all([
        carregarStoreUrgenciasCliente(cliente.empresaId),
        carregarStoreRecebimentosCliente(cliente.empresaId),
        carregarStoreObservacoesCliente(cliente.empresaId),
      ])
  );

  const payload = montarAcompanhamentoPublico(
    {
      id: cliente.id,
      nome: cliente.nome,
      razaoSocial: cliente.razaoSocial,
      observacoes: cliente.observacoes,
    },
    trabalhos,
    labNome,
    mapaEtapas,
    storeUrgencias.eventos,
    storeRecebimentos.eventos,
    storeObservacoes.eventos.filter((evento) => evento.clienteId === cliente.id)
  );

  return NextResponse.json(payload);
}
