import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { LabConfigProvider } from "@/components/LabConfigProvider";
import { LabDocumentHead } from "@/components/LabDocumentHead";
import { I18nRoot } from "@/components/I18nRoot";
import { SiteTopoMarca } from "@/components/SiteTopoMarca";
import {
  FAVICON_PADRAO,
  montarTituloDocumento,
} from "@/lib/document-title";
import { getSession } from "@/lib/auth";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { configParaLabImpressao } from "@/lib/lab-logo";
import "./globals.css";

export const dynamic = "force-dynamic";

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
  const session = await getSession();
  const configLaboratorio = await carregarConfigLaboratorioServidor(
    session?.empresaId
  );
  const lab = configParaLabImpressao(configLaboratorio);
  const buildId = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? "dev";
  const devBoot = process.env.NEXT_PUBLIC_DEV_BOOT ?? "";
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script
          id="aplicar-tema-inicial"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var tema = localStorage.getItem("labProteseDarkMode");
                  if (tema === "dark") {
                    document.documentElement.classList.add("dark");
                  } else if (tema === "light") {
                    document.documentElement.classList.remove("dark");
                  }
                } catch (e) { /* ignore */ }
              })();
            `,
          }}
        />
        <Script
          id="aplicar-idioma-inicial"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var id = localStorage.getItem("labProteseIdioma");
                  if (id === "en") document.documentElement.lang = "en";
                  else if (id === "es") document.documentElement.lang = "es";
                  else if (id === "pt") document.documentElement.lang = "pt-BR";
                } catch (e) { /* ignore */ }
              })();
            `,
          }}
        />
        <Script
          id="app-build-cache-bust"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var buildId = ${JSON.stringify(buildId)};
                var devBoot = ${JSON.stringify(devBoot)};
                var key = "labProteseBuildId";
                var devKey = "labProteseDevBoot";
                try {
                  if (devBoot) {
                    var bootAnterior = sessionStorage.getItem(devKey);
                    sessionStorage.setItem(devKey, devBoot);
                    if (bootAnterior && bootAnterior !== devBoot) {
                      if (window.caches && window.caches.keys) {
                        window.caches.keys().then(function (keys) {
                          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
                        }).finally(function () { location.reload(); });
                      } else {
                        location.reload();
                      }
                      return;
                    }
                  }
                  if (!buildId || buildId === "dev") return;
                  var anterior = localStorage.getItem(key);
                  localStorage.setItem(key, buildId);
                  if (anterior && anterior !== buildId) {
                    if (window.caches && window.caches.keys) {
                      window.caches.keys().then(function (keys) {
                        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
                      }).finally(function () { location.reload(); });
                    } else {
                      location.reload();
                    }
                  }
                } catch (e) { /* ignore */ }
              })();
            `,
          }}
        />
        <Script
          id="remove-cursor-test-attrs"
          strategy="beforeInteractive"
          nonce={nonce}
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
          nonce={nonce}
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
        <LabConfigProvider lab={lab} configLaboratorio={configLaboratorio}>
          <I18nRoot>
            <LabDocumentHead />
            <div className="flex min-h-[calc(100dvh/var(--site-zoom,0.9))] flex-col">
              <SiteTopoMarca />
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </div>
          </I18nRoot>
        </LabConfigProvider>
      </body>
    </html>
  );
}
