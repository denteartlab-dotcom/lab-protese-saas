"use client";

import { useEffect } from "react";
import { instalarRedirecionamentoSessaoExpirada } from "@/lib/redirecionar-login-sessao";

/** Enquanto o sistema está aberto, sessão caída leva ao login no próximo clique ou na próxima chamada. */
export function SessaoExpiradaRedirect() {
  useEffect(() => {
    instalarRedirecionamentoSessaoExpirada();
  }, []);
  return null;
}
