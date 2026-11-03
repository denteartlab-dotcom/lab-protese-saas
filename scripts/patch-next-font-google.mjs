/**
 * O Google às vezes responde a fonte com um endereço sem .woff2
 * (fonts.gstatic.com/l/font?kit=...). O Next 15 lê a extensão com
 * uma regex e o build quebra: Cannot read properties of null (reading '1').
 * Quando não há extensão, grava como woff2 — é o formato que esse pedido pede.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FRAGIL = "/\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1]";
const SEGURO =
  '(/\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl) || ["", "woff2"])[1]';

export function corrigirLoaderFonteGoogle(arquivo) {
  if (!fs.existsSync(arquivo)) return "ausente";
  const texto = fs.readFileSync(arquivo, "utf8");
  if (!texto.includes(FRAGIL)) {
    return texto.includes(SEGURO) ? "ja-corrigido" : "sem-alvo";
  }
  fs.writeFileSync(arquivo, texto.replaceAll(FRAGIL, SEGURO));
  return "corrigido";
}

const executadoDireto =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDireto) {
  const alvo =
    process.argv[2] ||
    path.join(
      root,
      "node_modules/next/dist/compiled/@next/font/dist/google/loader.js"
    );
  const resultado = corrigirLoaderFonteGoogle(alvo);
  console.log(`Fonte Google do Next: ${resultado}`);
  if (resultado === "sem-alvo") {
    console.warn(
      "O loader do Next mudou e o ajuste da fonte sem extensão não foi aplicado."
    );
  }
}
