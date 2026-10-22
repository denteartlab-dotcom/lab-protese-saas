"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  definicaoFonteImpressao,
  fontesDoTema,
  fontesOrdenadas,
  type DefinicaoFonteImpressao,
  type FonteImpressao,
} from "@/lib/fonte-impressao";

function LinhaFonte({
  item,
  selecionada,
  ativa,
  onChoose,
}: {
  item: DefinicaoFonteImpressao;
  selecionada: boolean;
  ativa: boolean;
  onChoose: (fonte: FonteImpressao) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selecionada}
      data-selecionada={selecionada ? "true" : undefined}
      data-ativa={ativa ? "true" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChoose(item.id)}
      className={`block w-full truncate px-3 py-0.5 text-left text-[17px] leading-8 ${
        selecionada || ativa ? "bg-[#c5ddf5]" : "hover:bg-[#e8f3fc]"
      }`}
      style={{ fontFamily: item.css }}
    >
      {item.nome}
    </button>
  );
}

export function CaixaFonteWord({
  fonte,
  onChange,
  className,
}: {
  fonte: FonteImpressao | "";
  onChange: (fonte: FonteImpressao) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const listaId = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const [caixa, setCaixa] = useState({ top: 0, left: 0, width: 260, maxHeight: 360 });
  const atual = fonte ? definicaoFonteImpressao(fonte) : null;
  const tema = useMemo(() => fontesDoTema(), []);
  const todas = useMemo(() => fontesOrdenadas(), []);
  const termo = busca.trim().toLocaleLowerCase("pt");
  const filtradas = useMemo(() => {
    if (!termo) return null;
    return todas.filter((item) => item.nome.toLocaleLowerCase("pt").includes(termo));
  }, [termo, todas]);
  const navegaveis = filtradas ?? todas;

  function medir() {
    const el = botaoRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 260);
    const abaixo = window.innerHeight - r.bottom;
    const abrirParaCima = abaixo < 220 && r.top > abaixo;
    const maxHeight = Math.min(380, Math.max(180, abrirParaCima ? r.top - 12 : abaixo - 12));
    const top = abrirParaCima ? Math.max(8, r.top - maxHeight - 2) : r.bottom + 2;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setCaixa({ top, left, width, maxHeight });
  }

  function abrir() {
    const posicao = todas.findIndex((item) => item.id === fonte);
    setBusca("");
    setIndice(posicao >= 0 ? posicao : 0);
    medir();
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;
    medir();
    const aoFecharFora = (evento: MouseEvent) => {
      const alvo = evento.target as Node | null;
      if (!alvo) return;
      if (botaoRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const aoReposicionar = () => medir();
    document.addEventListener("mousedown", aoFecharFora);
    window.addEventListener("resize", aoReposicionar);
    window.addEventListener("scroll", aoReposicionar, true);
    return () => {
      document.removeEventListener("mousedown", aoFecharFora);
      window.removeEventListener("resize", aoReposicionar);
      window.removeEventListener("scroll", aoReposicionar, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const marcada = menuRef.current?.querySelector("[data-ativa='true']");
    marcada?.scrollIntoView({ block: "nearest" });
  }, [aberto, indice, termo]);

  function escolher(id: FonteImpressao) {
    onChange(id);
    setAberto(false);
  }

  function aoTeclar(evento: React.KeyboardEvent) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      setAberto(false);
      botaoRef.current?.focus();
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndice((atualIndice) => Math.min(navegaveis.length - 1, atualIndice + 1));
      return;
    }
    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndice((atualIndice) => Math.max(0, atualIndice - 1));
      return;
    }
    if (evento.key === "Enter" && navegaveis[indice]) {
      evento.preventDefault();
      escolher(navegaveis[indice].id);
    }
  }

  const menu =
    aberto && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={listaId}
            role="listbox"
            aria-label={t("settings.etiquetaEntrega.tipoFonte")}
            className="fixed z-[80] overflow-hidden rounded border border-[#b4b4b4] bg-white shadow-lg"
            style={{ top: caixa.top, left: caixa.left, width: caixa.width }}
          >
            <input
              autoFocus
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setIndice(0);
              }}
              onKeyDown={aoTeclar}
              placeholder={t("settings.etiquetaEntrega.buscarFonte")}
              aria-label={t("settings.etiquetaEntrega.buscarFonte")}
              className="h-8 w-full border-b border-slate-200 px-3 text-[13px] text-slate-800 outline-none"
            />
            <div className="overflow-y-auto py-1" style={{ maxHeight: caixa.maxHeight }}>
              {filtradas ? (
                filtradas.length ? (
                  filtradas.map((item, posicao) => (
                    <LinhaFonte
                      key={item.id}
                      item={item}
                      selecionada={item.id === fonte}
                      ativa={posicao === indice}
                      onChoose={escolher}
                    />
                  ))
                ) : (
                  <p className="px-3 py-2 text-[12px] text-slate-500">
                    {t("settings.etiquetaEntrega.nenhumaFonte")}
                  </p>
                )
              ) : (
                <>
                  <p className="px-3 pb-1 pt-1.5 text-[11px] text-slate-500">
                    {t("settings.etiquetaEntrega.fontesDoTema")}
                  </p>
                  {tema.map((item) => (
                    <LinhaFonte
                      key={`tema-${item.id}`}
                      item={item}
                      selecionada={item.id === fonte}
                      ativa={false}
                      onChoose={escolher}
                    />
                  ))}
                  <p className="px-3 pb-1 pt-2 text-[11px] text-slate-500">
                    {t("settings.etiquetaEntrega.todasAsFontes")}
                  </p>
                  {todas.map((item, posicao) => (
                    <LinhaFonte
                      key={item.id}
                      item={item}
                      selecionada={item.id === fonte}
                      ativa={posicao === indice}
                      onChoose={escolher}
                    />
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={className}>
      <button
        ref={botaoRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={listaId}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!aberto) abrir();
          }
        }}
        className="flex h-8 w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 text-left text-[15px] text-slate-900 outline-none hover:border-[#4a90d9]"
        style={{ fontFamily: atual?.css }}
      >
        <span className="truncate">
          {atual ? atual.nome : t("settings.etiquetaEntrega.fontesMistas")}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      </button>
      {menu}
    </div>
  );
}

export function SeletorFonteTexto({
  fonte,
  onChange,
  ajuda,
}: {
  fonte: FonteImpressao | "";
  onChange: (fonte: FonteImpressao) => void;
  ajuda?: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <span className="mb-1 block text-[11px] text-slate-600">{t("settings.etiquetaEntrega.tipoFonte")}</span>
      <CaixaFonteWord fonte={fonte} onChange={onChange} />
      {ajuda ? <p className="mt-1 text-[10px] leading-snug text-slate-500">{ajuda}</p> : null}
    </div>
  );
}

export function BarraFonteFlutuante({
  visivel,
  fonte,
  onChange,
  negrito,
  sublinhado,
  onNegrito,
  onSublinhado,
}: {
  visivel: boolean;
  fonte: FonteImpressao | "";
  onChange: (fonte: FonteImpressao) => void;
  negrito?: boolean;
  sublinhado?: boolean;
  onNegrito?: () => void;
  onSublinhado?: () => void;
}) {
  const { t } = useI18n();
  if (!visivel) return null;
  return (
    <div className="sticky top-2 z-20 mx-auto mb-2 flex w-fit flex-wrap items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 shadow-md">
      <span className="text-[11px] font-semibold text-slate-700">
        {t("settings.etiquetaEntrega.tipoFonte")}
      </span>
      <CaixaFonteWord fonte={fonte} onChange={onChange} className="w-56" />
      {onNegrito ? (
        <button
          type="button"
          aria-pressed={Boolean(negrito)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onNegrito}
          className={`h-8 rounded border px-2 text-[11px] font-bold ${
            negrito ? "border-[#4a90d9] bg-[#4a90d9] text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          {t("settings.etiquetaEntrega.negrito")}
        </button>
      ) : null}
      {onSublinhado ? (
        <button
          type="button"
          aria-pressed={Boolean(sublinhado)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSublinhado}
          className={`h-8 rounded border px-2 text-[11px] underline ${
            sublinhado ? "border-[#4a90d9] bg-[#4a90d9] text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          {t("settings.etiquetaEntrega.sublinhado")}
        </button>
      ) : null}
    </div>
  );
}
