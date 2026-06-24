import { CriarContaForm } from "@/components/cadastro/CriarContaForm";
import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import { obterAppBuildIdServidor } from "@/lib/app-build-id-servidor";

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default function CadastroPage() {
  const buildId = obterAppBuildIdServidor();

  return (
    <div className="flex min-h-full flex-col">
      <CriarContaForm />
      <div className="flex justify-center bg-slate-50 px-4 pb-8 pt-2">
        <AsaasSeloInstitucional className="max-w-sm" versaoCache={buildId} />
      </div>
    </div>
  );
}
