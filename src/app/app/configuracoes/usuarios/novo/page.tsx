import { Suspense } from "react";
import { NovoUsuarioConteudo } from "@/components/configuracoes/NovoUsuarioConteudo";

export default function NovoUsuarioPage() {
  return (
    <div className="min-h-full bg-[#e8eaed] pb-8">
      <div className="mx-auto max-w-[1100px] px-4 pt-4 md:px-6 md:pt-5">
        <Suspense fallback={<p className="p-6 text-sm text-slate-500">…</p>}>
          <NovoUsuarioConteudo />
        </Suspense>
      </div>
    </div>
  );
}
