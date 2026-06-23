export function TermosEncerramentoServico() {
  return (
    <section className="not-prose mt-8 rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Encerramento da plataforma e continuidade dos serviços financeiros
      </h2>
      <p className="mt-3">
        Os recursos financeiros disponibilizados por meio da conta digital integrada (boletos,
        Pix, pagamentos, transferências, saldo e extrato) são prestados pelo{" "}
        <strong>Asaas Gestão Financeira Instituição de Pagamento S.A.</strong>, nos termos da
        relação contratual firmada diretamente entre o laboratório cliente e o Asaas. O Lab
        Prótese atua exclusivamente como plataforma tecnológica de gestão e canal de acesso a
        esses serviços, sem custodiar, deter ou movimentar, em nome próprio, recursos
        financeiros pertencentes aos laboratórios.
      </p>
      <p className="mt-3">
        Na hipótese de descontinuação definitiva da plataforma Lab Prótese — por decisão
        comercial, encerramento das atividades ou qualquer outro motivo — os saldos e
        obrigações financeiras de cada laboratório permanecem vinculados à respectiva subconta
        de pagamento mantida junto ao Asaas, em nome do CNPJ do laboratório titular, e não
        serão transferidos à Lab Prótese Tecnologia LTDA.
      </p>
      <p className="mt-3">
        O laboratório titular poderá, a qualquer tempo e especialmente em caso de
        indisponibilidade prolongada ou encerramento do sistema, buscar orientação e suporte
        diretamente junto ao Asaas pelos canais oficiais da instituição de pagamento (
        <a
          href="https://www.asaas.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0066FF] hover:underline"
        >
          www.asaas.com
        </a>
        ), para consulta de saldo, encerramento de conta, transferências ou demais
        procedimentos aplicáveis à sua subconta.
      </p>
      <p className="mt-3">
        A Lab Prótese compromete-se, quando aplicável e dentro dos limites técnicos e
        contratuais com o Asaas, a colaborar de boa-fé com a transição dos laboratórios
        afetados, comunicando previamente sobre o encerramento sempre que possível e
        preservando o acesso às informações necessárias à regularização das contas digitais,
        sem reter indevidamente valores de terceiros.
      </p>
    </section>
  );
}

/** Texto para incluir no PDF de termos (copiar e colar no Termo.pdf). */
export const TEXTO_ENCERRAMENTO_TERMOS = `Encerramento da plataforma e continuidade dos serviços financeiros

Os recursos financeiros disponibilizados por meio da conta digital integrada (boletos, Pix, pagamentos, transferências, saldo e extrato) são prestados pelo Asaas Gestão Financeira Instituição de Pagamento S.A., CNPJ 19.540.550/0001-21, nos termos da relação contratual firmada diretamente entre o laboratório cliente e o Asaas. O Lab Prótese atua exclusivamente como plataforma tecnológica de gestão e canal de acesso a esses serviços, sem custodiar, deter ou movimentar, em nome próprio, recursos financeiros pertencentes aos laboratórios.

Na hipótese de descontinuação definitiva da plataforma Lab Prótese — por decisão comercial, encerramento das atividades ou qualquer outro motivo — os saldos e obrigações financeiras de cada laboratório permanecem vinculados à respectiva subconta de pagamento mantida junto ao Asaas, em nome do CNPJ do laboratório titular, e não serão transferidos à Lab Prótese Tecnologia LTDA.

O laboratório titular poderá, a qualquer tempo e especialmente em caso de indisponibilidade prolongada ou encerramento do sistema, buscar orientação e suporte diretamente junto ao Asaas pelos canais oficiais da instituição de pagamento (www.asaas.com), para consulta de saldo, encerramento de conta, transferências ou demais procedimentos aplicáveis à sua subconta.

A Lab Prótese compromete-se, quando aplicável e dentro dos limites técnicos e contratuais com o Asaas, a colaborar de boa-fé com a transição dos laboratórios afetados, comunicando previamente sobre o encerramento sempre que possível e preservando o acesso às informações necessárias à regularização das contas digitais, sem reter indevidamente valores de terceiros.`;
