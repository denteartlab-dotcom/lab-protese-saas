import type { Metadata } from "next";
import Script from "next/script";
import { LabDocumentHead } from "@/components/LabDocumentHead";
import {
  FAVICON_PADRAO,
  montarTituloDocumento,
} from "@/lib/document-title";
import "./globals.css";

export const metadata: Metadata = {
  title: montarTituloDocumento(),
  description: "Sistema completo para laboratório de prótese dentária",
  icons: {
    icon: [{ url: FAVICON_PADRAO, type: "image/svg+xml", sizes: "any" }],
    shortcut: [FAVICON_PADRAO],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      </head>
      <body>
        <LabDocumentHead />
        {children}
      </body>
    </html>
  );
}
