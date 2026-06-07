import type { Metadata } from "next";
import Script from "next/script";
import { AppVersionWatcher } from "@/components/AppVersionWatcher";
import { LabConfigProvider } from "@/components/LabConfigProvider";
import { LabDocumentHead } from "@/components/LabDocumentHead";
import { SiteTopoMarca } from "@/components/SiteTopoMarca";
import {
  FAVICON_PADRAO,
  montarTituloDocumento,
} from "@/lib/document-title";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { configParaLabImpressao } from "@/lib/lab-logo";
import "./globals.css";

export const metadata: Metadata = {
  title: montarTituloDocumento(),
  description: "Sistema completo para laboratório de prótese dentária",
  icons: {
    icon: [{ url: FAVICON_PADRAO, type: "image/svg+xml", sizes: "any" }],
    shortcut: [FAVICON_PADRAO],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configLaboratorio = await carregarConfigLaboratorioServidor();
  const lab = configParaLabImpressao(configLaboratorio);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script
          id="remove-cursor-test-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function clean() {
                  document.querySelectorAll('[data-cursor-ref]').forEach(function (node) {
                    node.removeAttribute('data-cursor-ref');
                  });
                }
                clean();
                new MutationObserver(clean).observe(document.documentElement, {
                  subtree: true,
                  childList: true,
                  attributes: true,
                  attributeFilter: ['data-cursor-ref']
                });
              })();
            `,
          }}
        />
        <Script
          id="bloquear-arraste-entre-campos"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function ehCampo(node) {
                  if (!node || !node.tagName) return false;
                  var tag = node.tagName;
                  if (tag === "TEXTAREA" || tag === "SELECT") return true;
                  if (tag !== "INPUT") return false;
                  var tipo = (node.type || "text").toLowerCase();
                  return tipo !== "checkbox" && tipo !== "radio" && tipo !== "file";
                }
                function bloquear(e) {
                  if (ehCampo(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }
                document.addEventListener("dragstart", bloquear, true);
                document.addEventListener("dragover", bloquear, true);
                document.addEventListener("drop", bloquear, true);
              })();
            `,
          }}
        />
      </head>
      <body>
        <AppVersionWatcher />
        <LabConfigProvider lab={lab} configLaboratorio={configLaboratorio}>
          <LabDocumentHead />
          <div className="flex min-h-screen flex-col">
            <SiteTopoMarca />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </LabConfigProvider>
      </body>
    </html>
  );
}
