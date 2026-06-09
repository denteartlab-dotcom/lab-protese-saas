/** Frases motivacionais — laboratório, disciplina, excelência e trabalho em equipe. */
export const FRASES_MOTIVACIONAIS_TV = [
  "Disciplina é fazer o que precisa ser feito, mesmo quando você não quer fazer. Excelência é o nosso padrão!",
  "Qualidade não é um ato, é um hábito. Cada prótese reflete o nosso compromisso.",
  "O detalhe que parece pequeno é o que separa o bom do extraordinário.",
  "Trabalho em equipe transforma esforço individual em resultados que encantam sorrisos.",
  "Prazo cumprido é respeito ao dentista e ao paciente que confia em nós.",
  "A perfeição não é destino — é a soma de pequenos acertos feitos com cuidado.",
  "Cada etapa concluída com rigor é um passo a mais rumo à excelência do laboratório.",
  "Orgulho do trabalho bem feito é a marca de quem entrega mais do que promete.",
  "Dedicação hoje garante a confiança que o cliente deposita amanhã.",
  "Processo disciplinado, resultado impecável — essa é a nossa receita.",
  "Não existe atalho para a qualidade: existe método, foco e persistência.",
  "Um laboratório de excelência é construído diariamente, peça por peça.",
  "Cuidado nos detalhes é o nosso diferencial — o paciente merece o melhor.",
  "Fazer bem feito na primeira vez economiza tempo e eleva o padrão de todos.",
  "Comprometimento com o prazo é comprometimento com a reputação do laboratório.",
  "A excelência técnica começa com a atitude de quem segura a ferramenta.",
  "Trabalhar com precisão é honrar a confiança de quem nos escolheu.",
  "Cada OS entregue no prazo é uma vitória da equipe inteira.",
  "Disciplina na bancada, excelência na entrega — simples assim.",
  "O padrão alto não se negocia: se faz ou se refaz até ficar certo.",
  "Motivação passa; disciplina permanece e produz resultados consistentes.",
  "Somos artesãos de sorrisos — cada trabalho carrega nossa assinatura de qualidade.",
  "Ritmo, foco e cuidado: a produção eficiente nasce da organização.",
  "Errar faz parte; corrigir com excelência é o que nos define.",
  "O melhor time não é o mais rápido, é o que não abre mão da qualidade.",
  "Paciente satisfeito começa com processo bem executado em cada setor.",
  "Amanhã agradece o esforço disciplinado que fazemos hoje.",
  "Pequenos gestos de cuidado na produção geram grandes sorrisos na entrega.",
  "Constância vence intensidade: faça bem hoje, repita amanhã.",
  "Excelência não é sorte — é preparo, técnica e atenção em cada detalhe.",
] as const;

export function fraseMotivacionalPorIndice(indice: number) {
  const lista = FRASES_MOTIVACIONAIS_TV;
  return lista[((indice % lista.length) + lista.length) % lista.length];
}
