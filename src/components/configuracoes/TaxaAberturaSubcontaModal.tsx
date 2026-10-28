"use client";

import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { PixQrCodeVisual } from "@/components/assinatura/PixQrCodeVisual";
import { Button, Modal } from "@/components/ui";
import { VALOR_TAXA_ABERTURA_SUBCONTA_FORMATADO } from "@/lib/taxa-abertura-subconta-const";

type Etapa = "aviso" | "pix" | "confirmado";

type Props = {
  open: boolean;
  etapa: Etapa;
  pixPayload: string | null;
  pixEncodedImage: string | null;
  erro: string;
  gerando: boolean;
  abrindoCadastro: boolean;
  onClose: () => void;
  onAceitar: () => void;
  onAbrirCadastro: () => void;
};

export function TaxaAberturaSubcontaModal({
  open,
  etapa,
  pixPayload,
  pixEncodedImage,
  erro,
  gerando,
  abrindoCadastro,
  onClose,
  onAceitar,
  onAbrirCadastro,
}: Props) {
  const [copiado, setCopiado] = useState(false);
  const valor = VALOR_TAXA_ABERTURA_SUBCONTA_FORMATADO;

  async function copiar() {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        etapa === "aviso"
          ? "Taxa para abrir a conta digital"
          : etapa === "pix"
            ? "Pagar taxa de abertura"
            : "Pagamento confirmado"
      }
      size="md"
    >
      <div className="space-y-4 text-sm text-slate-700">
        {etapa === "aviso" ? (
          <>
            <p>
              Para abrir a subconta Asaas é cobrada uma taxa única de{" "}
              <strong>{valor}</strong>. Esse valor não entra na mensalidade do sistema.
            </p>
            <p>
              Se você aceitar, o pagamento sai no PIX do Mercado Pago, o mesmo webhook já
              cadastrado para a assinatura. Depois da confirmação, abre a página de cadastro da
              subconta.
            </p>
            <p>
              Se você sair e voltar depois, essa etapa não se repete: a tela abre direto no envio
              de documentos. O Asaas cobra de novo cada vez que a página de cadastro é acessada.
            </p>
          </>
        ) : null}

        {etapa === "pix" ? (
          <>
            <p>
              Escaneie o QR Code ou copie o código. O PIX é de <strong>{valor}</strong>, taxa
              única, no Mercado Pago da assinatura. Quando o pagamento for confirmado, a página de
              cadastro da subconta abre.
            </p>
            <div className="flex justify-center">
              <PixQrCodeVisual pixEncodedImage={pixEncodedImage} pixPayload={pixPayload} />
            </div>
            {pixPayload ? (
              <div className="space-y-2">
                <textarea
                  readOnly
                  value={pixPayload}
                  className="h-20 w-full resize-none rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600"
                />
                <Button type="button" variant="secondary" onClick={() => void copiar()}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copiado ? "Código copiado" : "Copiar código PIX"}
                </Button>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">Gerando o QR Code…</p>
            )}
            <p className="flex items-center gap-2 text-[12px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Aguardando a confirmação do pagamento.
            </p>
          </>
        ) : null}

        {etapa === "confirmado" ? (
          <p>
            O PIX de <strong>{valor}</strong> foi confirmado. Abra o cadastro da subconta para
            enviar os documentos. Se você sair dessa página, na próxima vez o sistema abre direto
            o envio de documentos.
          </p>
        ) : null}

        {erro ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            {erro}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {etapa === "aviso" ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose} disabled={gerando}>
                Agora não
              </Button>
              <Button type="button" onClick={onAceitar} disabled={gerando}>
                {gerando ? "Gerando PIX…" : `Aceitar e pagar ${valor}`}
              </Button>
            </>
          ) : null}
          {etapa === "pix" ? (
            <Button type="button" variant="secondary" onClick={onClose} disabled={gerando}>
              Fechar
            </Button>
          ) : null}
          {etapa === "confirmado" ? (
            <Button type="button" onClick={onAbrirCadastro} disabled={abrindoCadastro}>
              {abrindoCadastro ? "Abrindo cadastro…" : "Abrir cadastro da subconta"}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
