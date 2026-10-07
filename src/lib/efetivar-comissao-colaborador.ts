import { DIA_PAGAMENTO_COMISSAO_PADRAO } from "@/lib/comissao-colaboradores-pagamento";
import type { LinhaComissaoColaborador } from "@/lib/comissoes-colaboradores";
import {
  desmarcarLinhaComissaoEfetivada,
  lerComissoesEfetivadas,
  marcarLinhaComissaoEfetivada,
  salvarComissoesEfetivadas,
  totalEfetivadoColaboradorMes,
  type ComissoesEfetivadasStore,
} from "@/lib/comissoes-efetivadas";
import { carregarColaboradoresListagem } from "@/lib/colaboradores-listagem";
import { sincronizarDespesaComissaoColaborador } from "@/lib/despesa-comissao-colaborador";

export async function aplicarEfetivacaoComissoes(
  linhasAlvo: LinhaComissaoColaborador[],
  efetivar: boolean
): Promise<ComissoesEfetivadasStore> {
  let store = lerComissoesEfetivadas();
  if (linhasAlvo.length === 0) return store;

  const cadastro = carregarColaboradoresListagem();
  const grupos = new Map<string, { colaborador: string; mesCompetencia: string }>();

  for (const linha of linhasAlvo) {
    if (efetivar) {
      if (linha.comissaoValor <= 0) continue;
      store = marcarLinhaComissaoEfetivada(store, linha.id, {
        colaborador: linha.colaborador,
        mesCompetencia: linha.mesCompetencia,
        valor: linha.comissaoValor,
        numeroOs: linha.numeroOs,
        efetivadoEm: new Date().toISOString(),
      });
    } else {
      store = desmarcarLinhaComissaoEfetivada(store, linha.id);
    }
    grupos.set(`${linha.colaborador}::${linha.mesCompetencia}`, {
      colaborador: linha.colaborador,
      mesCompetencia: linha.mesCompetencia,
    });
  }

  for (const grupo of grupos.values()) {
    const dia =
      cadastro.find(
        (c) => c.nome.trim().toLowerCase() === grupo.colaborador.trim().toLowerCase()
      )?.diaPagamentoComissao ?? DIA_PAGAMENTO_COMISSAO_PADRAO;
    store = await sincronizarDespesaComissaoColaborador({
      store,
      colaborador: grupo.colaborador,
      mesCompetencia: grupo.mesCompetencia,
      valor: totalEfetivadoColaboradorMes(store, grupo.colaborador, grupo.mesCompetencia),
      diaPagamento: dia,
    });
  }

  salvarComissoesEfetivadas(store);
  return store;
}
