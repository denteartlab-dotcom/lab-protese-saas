import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import { LogoMarcaDenteArt } from "@/components/LogoMarcaDenteArt";
import { WHATSAPP_LANDING_URL } from "@/lib/landing-content";

export function LandingFooter() {
  return (
    <footer id="contato" className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="inline-block rounded-lg bg-white px-3 py-2">
              <LogoMarcaDenteArt variant="topo" className="!h-9 !w-auto max-w-[200px]" />
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              Software de gestão para laboratórios de prótese odontológica. Produção,
              financeiro, clientes e relatórios em uma única plataforma.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Links
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="/termos" className="transition hover:text-white">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="/privacidade" className="transition hover:text-white">
                  Política de Privacidade
                </a>
              </li>
              <li>
                <a href="/login" className="transition hover:text-white">
                  Login
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_LANDING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-white"
                >
                  Suporte
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Contato
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>Lab Prótese Tecnologia LTDA</li>
              <li>CNPJ: 65.881.387/0001-88</li>
              <li>
                <a
                  href="mailto:denteartlab@gmail.com"
                  className="transition hover:text-white"
                >
                  denteartlab@gmail.com
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_LANDING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-white"
                >
                  WhatsApp: (31) 98270-9866
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-8">
          <AsaasSeloInstitucional variante="escuro" className="mx-auto max-w-lg" />
          <p className="mt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Lab Prótese Tecnologia LTDA. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
