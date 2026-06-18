/** Script inline (beforeInteractive) — recupera HTML/JS em cache após deploy. */
export const CHUNK_RELOAD_SCRIPT = `
(function () {
  var HOST_CANONICO = "www.denteartlab.com.br";
  var KEY = "labChunkReloadAt";
  var TENTOS_KEY = "labChunkReloadTentativas";
  var MAX_TENTOS_AUTO = 6;
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

  function limparCaches(cb) {
    var tarefas = [];
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      tarefas.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(
            regs.map(function (r) {
              return r.unregister();
            })
          );
        })
      );
    }
    if (window.caches && window.caches.keys) {
      tarefas.push(
        window.caches.keys().then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              return window.caches.delete(key);
            })
          );
        })
      );
    }
    if (!tarefas.length) {
      cb();
      return;
    }
    Promise.all(tarefas).finally(cb);
  }

  function podeRecarregarAuto() {
    try {
      var ultima = Number(sessionStorage.getItem(KEY) || "0");
      return Date.now() - ultima > COOLDOWN_MS && obterTentativas() < MAX_TENTOS_AUTO;
    } catch (e) {
      return true;
    }
  }

  function registrarTentativa() {
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
      sessionStorage.setItem(TENTOS_KEY, String(obterTentativas() + 1));
    } catch (e) {}
  }

  function limparParametrosCacheDaUrl() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has("_build") && !url.searchParams.has("_cb")) return;
      url.searchParams.delete("_build");
      url.searchParams.delete("_cb");
      window.history.replaceState({}, "", url.toString());
    } catch (e) {}
  }

  function irParaNovaUrl(buildRemoto) {
    var url = new URL(window.location.href);
    url.protocol = "https:";
    if (url.hostname === "www.denteartlab.com.br" || url.hostname === "denteartlab.com.br") {
      url.hostname = HOST_CANONICO;
    }
    if (buildRemoto) url.searchParams.set("_build", buildRemoto);
    url.searchParams.set("_cb", String(Date.now()));
    window.location.replace(url.toString());
  }

  function recarregarForcado(buildRemoto) {
    try {
      sessionStorage.removeItem(TENTOS_KEY);
      sessionStorage.removeItem(KEY);
    } catch (e) {}
    limparCaches(function () {
      irParaNovaUrl(buildRemoto);
    });
  }

  function recarregarAutomatico(buildRemoto) {
    if (!podeRecarregarAuto()) {
      mostrarAvisoCache(buildRemoto);
      return;
    }
    registrarTentativa();
    limparCaches(function () {
      irParaNovaUrl(buildRemoto);
    });
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
      "<strong style=\\"display:block;font-size:16px;margin-bottom:8px\\">Nova versão disponível</strong>" +
      "<p style=\\"margin:0 0 12px\\">O sistema foi atualizado. Clique abaixo para carregar a versão mais recente — não precisa usar aba anônima.</p>" +
      "<p style=\\"margin:0 0 16px;color:#475569;font-size:13px\\">Versão no servidor: <code>" +
      (buildRemoto || "?") +
      "</code></p>" +
      '<button type=\\"button\\" id=\\"lab-cache-aviso-btn\\" style=\\"width:100%;border:0;border-radius:8px;padding:10px 14px;background:#0f766e;color:#fff;font-weight:600;cursor:pointer\\">Atualizar agora</button>' +
      "</div>";
    document.documentElement.appendChild(box);
    var btn = document.getElementById("lab-cache-aviso-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        recarregarForcado(buildRemoto);
      });
    }
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
            sessionStorage.removeItem(TENTOS_KEY);
            sessionStorage.removeItem(KEY);
          } catch (e) {}
          limparParametrosCacheDaUrl();
          return;
        }
        recarregarAutomatico(data.buildId);
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
      recarregarAutomatico();
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
      recarregarAutomatico();
    }
  });

  window.addEventListener("load", function () {
    window.setTimeout(function () {
      try {
        sessionStorage.removeItem(TENTOS_KEY);
        sessionStorage.removeItem(KEY);
      } catch (e) {}
    }, 8000);
  });
})();
`.trim();
