import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { trUi, type TradutorUi } from "@/lib/i18n/tr-ui";

const PROPS_TRADUZIVEIS = new Set([
  "title",
  "label",
  "placeholder",
  "aria-label",
  "mensagem",
  "emptyMessage",
  "titulo",
  "alt",
  "emptymessage",
]);

function traduzirProps(
  props: Record<string, unknown>,
  t: TradutorUi
): Record<string, unknown> {
  const next = { ...props };
  for (const chave of PROPS_TRADUZIVEIS) {
    const valor = next[chave];
    if (typeof valor === "string" && valor.trim()) {
      next[chave] = trUi(valor, t);
    }
  }
  return next;
}

/** Traduz recursivamente textos e props comuns em uma árvore React. */
export function trUiArvore(filho: ReactNode, t: TradutorUi): ReactNode {
  if (filho == null || typeof filho === "boolean") return filho;
  if (typeof filho === "string" || typeof filho === "number") {
    return trUi(String(filho), t);
  }
  if (Array.isArray(filho)) {
    return filho.map((item, i) => {
      const traduzido = trUiArvore(item, t);
      if (traduzido === item) return item;
      return isValidElement(traduzido) ? cloneElement(traduzido, { key: i }) : traduzido;
    });
  }
  if (!isValidElement(filho)) return filho;

  const el = filho as ReactElement<{ children?: ReactNode }>;
  const props = traduzirProps(el.props as Record<string, unknown>, t);
  const filhos = props.children;

  if (filhos == null) {
    return cloneElement(el, props);
  }

  const filhosTraduzidos = Children.map(
    filhos as ReactNode,
    (item) => trUiArvore(item, t)
  );
  return cloneElement(el, { ...props, children: filhosTraduzidos });
}
