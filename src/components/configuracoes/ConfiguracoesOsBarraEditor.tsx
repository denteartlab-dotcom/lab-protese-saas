"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import {
  MODELOS_OS,
  ROTAS_MODELO_OS,
  type ModeloOsId,
} from "@/lib/configuracoes-os";

type Props = {
  modeloAtivo: ModeloOsId;
};

export function ConfiguracoesOsBarraEditor({ modeloAtivo }: Props) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[#3d4248] bg-[#4a4f56] px-4 py-2.5">
      <select
        value={modeloAtivo}
        onChange={(e) => {
          const id = e.target.value as ModeloOsId;
          if (id !== modeloAtivo) {
            router.push(ROTAS_MODELO_OS[id]);
          }
        }}
        className="max-w-[min(100%,28rem)] rounded border border-[#5a6068] bg-white px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9]"
        aria-label={t("settings.selecionarModeloOs")}
      >
        {MODELOS_OS.map((modelo) => (
          <option key={modelo.id} value={modelo.id}>
            {modelo.nome}
          </option>
        ))}
      </select>
      <Link
        href="/app/configuracoes?aba=os"
        className="shrink-0 rounded bg-[#5a6068] px-5 py-2 text-[12px] text-white hover:bg-[#6a7078]"
      >
        {t("settings.voltar")}
      </Link>
    </div>
  );
}
