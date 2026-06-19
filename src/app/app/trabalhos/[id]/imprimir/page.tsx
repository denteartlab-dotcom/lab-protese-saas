import { getSession } from "@/lib/auth";
import { ImprimirOsLoader } from "./imprimir-os-loader";

export const dynamic = "force-dynamic";

function ErroImpressao({
  titulo,
  detalhe,
}: {
  titulo: string;
  detalhe: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
      <p className="font-semibold">{titulo}</p>
      <p className="mt-2 text-sm">{detalhe}</p>
    </div>
  );
}

function montarQueryString(sp: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(sp)) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) {
      for (const item of valor) {
        if (item) params.append(chave, item);
      }
      continue;
    }
    if (valor) params.set(chave, valor);
  }
  return params.toString();
}

export default async function ImprimirOSPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) {
    return (
      <ErroImpressao
        titulo="Sessão expirada."
        detalhe="Faça login novamente para imprimir a OS."
      />
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const empresaId = session.empresaId?.trim();

  if (!empresaId) {
    return (
      <ErroImpressao
        titulo="Sessão incompleta."
        detalhe="Faça logout e login novamente para imprimir a OS."
      />
    );
  }

  return (
    <ImprimirOsLoader trabalhoId={id} queryString={montarQueryString(sp)} />
  );
}
