"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePermissoesApp } from "@/components/PermissoesAppProvider";
import { podeAcessarRota, primeiroHrefPermitidoSistema } from "@/lib/permissoes-acesso";

type Props = {
  children: ReactNode;
};

export function GuardPermissaoRota({ children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { acessoTotal, permissoesModulos } = usePermissoesApp();

  const search = useMemo(() => {
    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }, [searchParams]);

  useEffect(() => {
    if (podeAcessarRota(acessoTotal, permissoesModulos, pathname, search)) return;
    const destino = primeiroHrefPermitidoSistema(acessoTotal, permissoesModulos);
    if (destino !== pathname && `${destino}${search}` !== `${pathname}${search}`) {
      router.replace(destino);
    }
  }, [acessoTotal, permissoesModulos, pathname, router, search]);

  return <>{children}</>;
}
