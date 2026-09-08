-- Frete e rastreio no pedido de envio do cliente.
ALTER TABLE "solicitacoes_envio_cliente" ADD COLUMN IF NOT EXISTS "tipoFrete" TEXT NOT NULL DEFAULT '';
ALTER TABLE "solicitacoes_envio_cliente" ADD COLUMN IF NOT EXISTS "numeroRastreio" TEXT NOT NULL DEFAULT '';
