import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMarcaDenteArt } from "@/components/LogoMarcaDenteArt";
import {
  ASAAS_CNPJ,
  ASAAS_CODIGO_BANCO,
  ASAAS_RAZAO_SOCIAL,
  ASAAS_SITE_URL,
  ASAAS_TERMOS_URL,
} from "@/lib/asaas-marca-baas";

type Props = {
  titulo: string;
  children: ReactNode;
};

export function PaginaLegalLayout({ titulo, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <LogoMarcaDenteArt variant="topo" className="!h-8 !w-auto max-w-[160px]" />
          </Link>
          <Link href="/login" className="text-sm font-medium text-[#0066FF] hover:underline">
            Entrar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <div className="prose prose-slate mt-6 max-w-none text-sm leading-relaxed prose-headings:text-slate-900 prose-a:text-[#0066FF]">
          {children}
        </div>
        <p className="mt-10 text-xs text-slate-500">
          <Link href="/" className="hover:underline">
            Voltar ao início
          </Link>
        </p>
      </main>
    </div>
  );
}

export function BlocoAsaasLegal() {
  return (
    <section className="not-prose mt-8 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-700">
      <h2 className="text-base font-semibold text-slate-900">Serviços financeiros (Asaas)</h2>
      <p className="mt-2">
        Quando o laboratório optar por utilizar conta digital, boletos, Pix, pagamentos ou
        transferências dentro da plataforma, tais serviços são prestados por{" "}
        <strong>{ASAAS_RAZAO_SOCIAL}</strong>, CNPJ {ASAAS_CNPJ}, instituição de pagamento
        autorizada pelo Banco Central do Brasil (código {ASAAS_CODIGO_BANCO}). O contrato de
        conta de pagamento é celebrado diretamente entre o laboratório e o Asaas, nos{" "}
        <a href={ASAAS_TERMOS_URL} target="_blank" rel="noopener noreferrer">
          termos e condições do Asaas
        </a>
        .
      </p>
      <p className="mt-2">
        A Lab Prótese Tecnologia LTDA atua como plataforma de software e integradora tecnológica,
        sem ser instituição financeira. Informações e suporte sobre movimentações financeiras devem
        ser consultados também em{" "}
        <a href={ASAAS_SITE_URL} target="_blank" rel="noopener noreferrer">
          {ASAAS_SITE_URL.replace(/^https:\/\//, "")}
        </a>
        .
      </p>
    </section>
  );
}
