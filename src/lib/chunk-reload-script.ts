/** Script inline (beforeInteractive) — atualiza JS em cache após deploy na aba normal. */
export const CHUNK_RELOAD_SCRIPT = `
(function () {
  var HOST_CANONICO = "www.denteartlab.com.br";
  var KEY = "labChunkReloadAt";
  var TENTOS_KEY = "labChunkReloadTentativas";
  var SYNC_KEY = "labBuildSincronizado";
  var MAX_TENTOS = 2;
  var COOLDOWN_MS = 2000;

  if (window.location.hostname === "denteartlab.com.br") {
    var canonico = new URL(window.location.href);
    canonico.protocol = "https:";
    canonico.hostname = HOST_CANONICO;
    window.location.replace(canonico.toString());
    return;
  }

  function resetarTentativasLoginDireto() {
    if (window.location.pathname !== "/login") return;
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (nav && nav.type === "navigate" && !window.location.search.includes("_build")) {
        sessionStorage.removeItem(TENTOS_KEY);
        sessionStorage.removeItem(KEY);
      }
    } catch (e) {}
  }
  resetarTentativasLoginDireto();

  function buildIdValido(id) {
    return !!(id && id !== "dev" && String(id).length >= 6);
  }

  function obterTentativas() {
    try {
      return Number(sessionStorage.getItem(TENTOS_KEY) || "0");
    } catch (e) {
      return 0;
    }
  }

  function limparCachesNavegador() {
    var passos = [];
    if (window.caches && window.caches.keys) {
      passos.push(
        window.caches.keys().then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              return window.caches.delete(key);
            })
          );
        })
      );
    }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      passos.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(
            regs.map(function (reg) {
              return reg.unregister();
            })
          );
        })
      );
    }
    return Promise.all(passos);
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

  function limparParamsCacheDaUrl() {
    try {
      var url = new URL(window.location.href);
      var mudou = false;
      ["_build", "_cb", "_fresh"].forEach(function (nome) {
        if (url.searchParams.has(nome)) {
          url.searchParams.delete(nome);
          mudou = true;
        }
      });
      if (mudou) {
        window.history.replaceState({}, "", url.toString());
      }
      sessionStorage.removeItem(TENTOS_KEY);
      sessionStorage.removeItem(KEY);
    } catch (e) {}
  }

  function marcarBuildSincronizado(buildId) {
    try {
      sessionStorage.setItem(SYNC_KEY, buildId);
      sessionStorage.removeItem(TENTOS_KEY);
      sessionStorage.removeItem(KEY);
    } catch (e) {}
    limparParamsCacheDaUrl();
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
      "<p style=\\"margin:0 0 16px\\">O navegador ainda está com arquivos antigos. Clique abaixo para carregar a versão atual.</p>" +
      '<button type=\\"button\\" id=\\"lab-cache-aviso-btn\\" style=\\"width:100%;border:0;border-radius:8px;padding:10px 14px;background:#0f766e;color:#fff;font-weight:600;cursor:pointer\\">Atualizar agora</button>' +
      "</div>";
    document.documentElement.appendChild(box);
    var btn = document.getElementById("lab-cache-aviso-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        try {
          sessionStorage.removeItem(TENTOS_KEY);
          sessionStorage.removeItem(KEY);
          sessionStorage.removeItem(SYNC_KEY);
        } catch (e) {}
        limparCachesNavegador().finally(function () {
          var url = new URL(window.location.href);
          ["_build", "_cb", "_fresh"].forEach(function (n) {
            url.searchParams.delete(n);
          });
          if (buildRemoto) url.searchParams.set("_build", buildRemoto);
          url.searchParams.set("_fresh", String(Date.now()));
          window.location.replace(url.toString());
        });
      });
    }
  }

  function irParaNovaUrl(buildRemoto) {
    var url = new URL(window.location.href);
    url.protocol = "https:";
    if (url.hostname === "www.denteartlab.com.br" || url.hostname === "denteartlab.com.br") {
      url.hostname = HOST_CANONICO;
    }
    ["_build", "_cb", "_fresh"].forEach(function (n) {
      url.searchParams.delete(n);
    });
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

    limparCachesNavegador().finally(function () {
      irParaNovaUrl(buildRemoto);
    });
  }

  function verificarBuildDesatualizada() {
    var meta = document.querySelector('meta[name="app-build-id"]');
    var buildLocal = meta && meta.getAttribute("content");
    if (!buildIdValido(buildLocal)) return;

    try {
      if (sessionStorage.getItem(SYNC_KEY) === buildLocal) return;
    } catch (e) {}

    fetch("/api/version", { cache: "no-store", credentials: "same-origin" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (!data || !buildIdValido(data.buildId)) return;

        if (data.buildId === buildLocal) {
          marcarBuildSincronizado(data.buildId);
          return;
        }

        var urlAtual = new URL(window.location.href);
        var jaTentouBuild = urlAtual.searchParams.get("_build") === data.buildId;

        if (jaTentouBuild && obterTentativas() >= MAX_TENTOS) {
          mostrarAvisoCache(data.buildId);
          return;
        }

        if (!jaTentouBuild) {
          try {
            sessionStorage.removeItem(TENTOS_KEY);
            sessionStorage.removeItem(KEY);
          } catch (e) {}
        }

        recarregarPagina(true, data.buildId);
      })
      .catch(function () {});
  }

  verificarBuildDesatualizada();

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      verificarBuildDesatualizada();
    }
  });

  window.addEventListener(
    "error",
    function (event) {
      var alvo = event.target;
      if (!alvo) return;
      var tag = alvo.tagName || "";
      var src = alvo.src || alvo.href || "";
      if (src.indexOf("/_next/static/") === -1) return;
      if (tag !== "SCRIPT" && !(tag === "LINK" && alvo.rel === "preload")) return;
      recarregarPagina(false, null);
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
      recarregarPagina(false, null);
    }
  });
})();
`.trim();
