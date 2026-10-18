"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { ehAcessoCelular, urlWhatsAppAppNativo } from "@/lib/whatsapp";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
};

/** No celular, o clique abre o app WhatsApp em vez de uma aba do navegador. */
export function LinkWhatsApp({
  href,
  onClick,
  target,
  rel,
  children,
  ...rest
}: Props) {
  function aoClicar(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || !href || !ehAcessoCelular()) return;
    const app = urlWhatsAppAppNativo(href);
    if (!app) return;
    e.preventDefault();
    window.location.href = app;
  }

  return (
    <a
      {...rest}
      href={href}
      target={target ?? "_blank"}
      rel={rel ?? "noopener noreferrer"}
      onClick={aoClicar}
    >
      {children}
    </a>
  );
}
