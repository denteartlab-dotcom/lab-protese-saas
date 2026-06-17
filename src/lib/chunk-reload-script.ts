/** Script inline (beforeInteractive) — recupera HTML em cache após deploy. */
export const CHUNK_RELOAD_SCRIPT = `
(function () {
  var HOST_CANONICO = "www.denteartlab.com.br";
  var KEY = "labChunkReloadAt";
  var TENTOS_KEY = "labChunkReloadTentativas";
  var MAX_TENTOS = 8;
  var COOLDOWN_MS = 1500;

  if (window.location.hostname === "denteartlab.com.br") {
    var canonico = new URL(window.location.href);
    canonico.protocol = "https:";
    canonico.hostname = HOST_CANONICO;
    window.location.replace(canonico.toString());
    return;
  }

  function obterTentativas() {
    try {
      return Number(sessionStorage.getItem(TENTOS_KEY) || "0");
    } catch (e) {
      return 0;
    }
  }

  function podeRecarregar(forcar) {
    if (forcar) return obterTentativas() < MAX_TENTOS;
    try {
      var ultima = Number(sessionStorage.getItem(KEY) || "0");
      return Date.now() - ultima > COOLDOWN_MS && obterTentativas() < MAX_TENTOS;
    } catch (e) {
      return true;
    }
  }

  function irParaNovaUrl() {
    var url = new URL(window.location.href);
    url.protocol = "https:";
    // Beta/staging: recarrega na mesma origem. Só produção usa o host canônico www.
    if (url.hostname === "www.denteartlab.com.br" || url.hostname === "denteartlab.com.br") {
      url.hostname = HOST_CANONICO;
    }
    url.searchParams.set("_cb", String(Date.now()));
    window.location.replace(url.toString());
  }

  function recarregarPagina(forcar) {
    if (!podeRecarregar(forcar)) return;
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
      sessionStorage.setItem(TENTOS_KEY, String(obterTentativas() + 1));
    } catch (e) {}

    if (window.caches && window.caches.keys) {
      window.caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              return window.caches.delete(key);
            })
          );
        })
        .finally(irParaNovaUrl);
      return;
    }

    irParaNovaUrl();
  }

  function verificarBuildDesatualizada() {
    var meta = document.querySelector('meta[name="app-build-id"]');
    var buildLocal = meta && meta.getAttribute("content");
    if (!buildLocal) return;

    fetch("/api/version", { cache: "no-store", credentials: "same-origin" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (!data || !data.buildId || data.buildId === buildLocal) return;
        try {
          sessionStorage.removeItem(TENTOS_KEY);
        } catch (e) {}
        recarregarPagina(true);
      })
      .catch(function () {});
  }

  verificarBuildDesatualizada();

  window.addEventListener(
    "error",
    function (event) {
      var alvo = event.target;
      if (!alvo) return;
      var tag = alvo.tagName || "";
      var src = alvo.src || alvo.href || "";
      if (src.indexOf("/_next/static/") === -1) return;
      if (tag !== "SCRIPT" && !(tag === "LINK" && alvo.rel === "preload")) return;
      recarregarPagina(false);
    },
    true
  );

  window.addEventListener("unhandledrejection", function (event) {
    var motivo = event.reason;
    var mensagem =
      (motivo && (motivo.message || (motivo.toString && motivo.toString()))) || "";
    if (
      /loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(
        mensagem
      )
    ) {
      recarregarPagina(false);
    }
  });

  window.addEventListener("load", function () {
    window.setTimeout(function () {
      try {
        sessionStorage.removeItem(TENTOS_KEY);
      } catch (e) {}
    }, 10000);
  });
})();
`.trim();
