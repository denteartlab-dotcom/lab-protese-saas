import {
  carregarEntregas,
  ENTREGAS_STORAGE_KEY,
  salvarEntregas,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import {
  entregaParaHistorico,
  registrarHistoricoEntregas,
  registrarHistoricoEntregasServidor,
  type SituacaoHistoricoEntrega,
} from "@/lib/controle-entregas-historico";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

export const STATUS_ENTREGUE_CLIENTE = "entregue_cliente";

export type SituacaoConclusaoEntrega = Extract<SituacaoEntrega, "entregue" | "recebido">;

function situacaoHistoricoDeConclusao(
  situacao: SituacaoConclusaoEntrega
): SituacaoHistoricoEntrega {
  return situacao === "recebido" ? "recebido" : "entregue";
}

function deveArquivarEntrega(item: EntregaControle, novaSituacao: SituacaoConclusaoEntrega) {
  if (novaSituacao === "recebido") {
    return item.situacao === "pendente" || item.situacao === "em_rota" || item.situacao === "entregue";
  }
  return item.situacao === "pendente" || item.situacao === "em_rota";
}

function arquivarEntregasDaLista(
  lista: EntregaControle[],
  numeroOs: number,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
) {
  const alvo = String(numeroOs);
  const agora = new Date().toISOString();
  const restantes: EntregaControle[] = [];
  const historico = [];

  for (const item of lista) {
    if (String(item.numeroOs || "").trim() !== alvo) {
      restantes.push(item);
      continue;
    }
    if (!deveArquivarEntrega(item, opcoes.situacao)) {
      restantes.push(item);
      continue;
    }
    historico.push(
      entregaParaHistorico(item, {
        situacao: situacaoHistoricoDeConclusao(opcoes.situacao),
        nomeRecebedor: opcoes.nomeRecebedor,
        dataFinalizado: agora,
      })
    );
  }

  return { restantes, historico, mudou: historico.length > 0 };
}

/** Remove do controle ativo e grava no histórico (navegador). */
export function concluirEntregasControlePorNumeroOs(
  numeroOs: number,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
) {
  const { restantes, historico, mudou } = arquivarEntregasDaLista(
    carregarEntregas(),
    numeroOs,
    opcoes
  );
  if (!mudou) return false;
  salvarEntregas(restantes);
  registrarHistoricoEntregas(historico);
  return true;
}

/** Remove do controle ativo e grava no histórico (JsonStore do tenant). */
export async function concluirEntregasControlePorNumeroOsServidor(
  empresaId: string,
  numeroOs: number,
  opcoes: { situacao: SituacaoConclusaoEntrega; nomeRecebedor?: string }
) {
  const lista =
    (await lerJsonStoreTenant<EntregaControle[]>(empresaId, ENTREGAS_STORAGE_KEY)) ?? [];
  const normalizada = Array.isArray(lista) ? lista : [];
  const { restantes, historico, mudou } = arquivarEntregasDaLista(
    normalizada,
    numeroOs,
    opcoes
  );
  if (!mudou) return false;
  await salvarJsonStoreTenant(empresaId, ENTREGAS_STORAGE_KEY, restantes);
  await registrarHistoricoEntregasServidor(empresaId, historico);
  return true;
}
