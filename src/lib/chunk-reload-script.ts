/** Script inline (beforeInteractive) — recupera HTML em cache após deploy. */
export const CHUNK_RELOAD_SCRIPT = `
(function () {
  var HOST_CANONICO = "www.denteartlab.com.br";
  var KEY = "labChunkReloadAt";
  var TENTOS_KEY = "labChunkReloadTentativas";
  var BUILD_KEY = "labChunkReloadBuild";
  var MAX_TENTOS = 4;
  var COOLDOWN_MS = 2000;

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

  function mostrarAvisoCache(buildRemoto) {
    if (document.getElementById("lab-cache-aviso")) return;
    var box = document.createElement("div");
    box.id = "lab-cache-aviso";
    box.setAttribute("role", "alert");
    box.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px";
    box.innerHTML =
      '<div style="max-width:420px;background:#fff;border-radius:12px;padding:20px 22px;font:14px/1.45 Arial,sans-serif;color:#111;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
      "<strong style=\\"display:block;font-size:16px;margin-bottom:8px\\">Atualização do sistema</strong>" +
      "<p style=\\"margin:0 0 12px\\">O navegador está com uma versão antiga em cache. A aba anônima funciona porque não usa esse cache.</p>" +
      "<p style=\\"margin:0 0 16px;color:#475569;font-size:13px\\">Versão no servidor: <code>" +
      (buildRemoto || "?") +
      "</code></p>" +
      '<button type=\\"button\\" id=\\"lab-cache-aviso-btn\\" style=\\"width:100%;border:0;border-radius:8px;padding:10px 14px;background:#0f766e;color:#fff;font-weight:600;cursor:pointer\\">Recarregar sem cache</button>' +
      "</div>";
    document.documentElement.appendChild(box);
    var btn = document.getElementById("lab-cache-aviso-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        try {
          sessionStorage.removeItem(TENTOS_KEY);
          sessionStorage.removeItem(KEY);
          sessionStorage.removeItem(BUILD_KEY);
        } catch (e) {}
        var url = new URL(window.location.href);
        url.searchParams.set("_build", buildRemoto || String(Date.now()));
        url.searchParams.set("_cb", String(Date.now()));
        window.location.replace(url.toString());
      });
    }
  }

  function irParaNovaUrl(buildRemoto) {
    if (!podeRecarregar(true)) {
      mostrarAvisoCache(buildRemoto);
      return;
    }
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
      sessionStorage.setItem(TENTOS_KEY, String(obterTentativas() + 1));
      if (buildRemoto) sessionStorage.setItem(BUILD_KEY, buildRemoto);
    } catch (e) {}

    var url = new URL(window.location.href);
    url.protocol = "https:";
    if (url.hostname === "www.denteartlab.com.br" || url.hostname === "denteartlab.com.br") {
      url.hostname = HOST_CANONICO;
    }
    if (buildRemoto) url.searchParams.set("_build", buildRemoto);
    url.searchParams.set("_cb", String(Date.now()));
    window.location.replace(url.toString());
  }

  function recarregarPagina(forcar, buildRemoto) {
    if (!podeRecarregar(forcar)) {
      mostrarAvisoCache(buildRemoto);
      return;
    }
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
        .finally(function () {
          irParaNovaUrl(buildRemoto);
        });
      return;
    }

    irParaNovaUrl(buildRemoto);
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
        if (!data || !data.buildId || data.buildId === buildLocal) {
          try {
            var url = new URL(window.location.href);
            if (url.searchParams.has("_build") || url.searchParams.has("_cb")) {
              url.searchParams.delete("_build");
              url.searchParams.delete("_cb");
              window.history.replaceState({}, "", url.toString());
            }
            sessionStorage.removeItem(TENTOS_KEY);
            sessionStorage.removeItem(KEY);
          } catch (e) {}
          return;
        }

        var urlAtual = new URL(window.location.href);
        if (urlAtual.searchParams.get("_build") === data.buildId) {
          mostrarAvisoCache(data.buildId);
          return;
        }

        try {
          sessionStorage.removeItem(TENTOS_KEY);
        } catch (e) {}
        recarregarPagina(true, data.buildId);
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
