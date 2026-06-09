/** Script inline (beforeInteractive) — recupera HTML em cache após deploy. */
export const CHUNK_RELOAD_SCRIPT = `
(function () {
  var KEY = "labChunkReloadAt";
  var COOLDOWN = 30000;

  function podeRecarregar() {
    try {
      var ultima = Number(sessionStorage.getItem(KEY) || "0");
      return Date.now() - ultima > COOLDOWN;
    } catch (e) {
      return true;
    }
  }

  function recarregarPorChunk() {
    if (!podeRecarregar()) return;
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (e) {}
    var url = new URL(window.location.href);
    url.searchParams.set("_cb", String(Date.now()));
    window.location.replace(url.toString());
  }

  window.addEventListener(
    "error",
    function (event) {
      var alvo = event.target;
      if (!alvo || alvo.tagName !== "SCRIPT") return;
      var src = alvo.src || "";
      if (src.indexOf("/_next/static/") === -1) return;
      recarregarPorChunk();
    },
    true
  );

  window.addEventListener("unhandledrejection", function (event) {
    var motivo = event.reason;
    var mensagem =
      (motivo && (motivo.message || motivo.toString && motivo.toString())) || "";
    if (
      /loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(
        mensagem
      )
    ) {
      recarregarPorChunk();
    }
  });
})();
`.trim();
