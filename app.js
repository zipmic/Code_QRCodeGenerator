(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────
  var MAX_INPUT_LENGTH = 2000;
  var COOLDOWN_MS      = 1500;   // min ms between generations
  var BURST_LIMIT      = 8;      // max generations per window
  var BURST_WINDOW_MS  = 60_000; // 1-minute sliding window

  // ── State ─────────────────────────────────────────────────
  var lastGeneratedAt  = 0;
  var burstTimestamps  = [];     // ring of recent generation times

  // ── DOM refs ──────────────────────────────────────────────
  var input       = document.getElementById("qr-input");
  var btn         = document.getElementById("generate-btn");
  var canvas      = document.getElementById("qr-canvas");
  var result      = document.getElementById("result");
  var downloadBtn = document.getElementById("download-btn");
  var statusEl    = document.getElementById("status");
  var charCount   = document.getElementById("char-count");

  // ── Char counter ──────────────────────────────────────────
  input.addEventListener("input", function () {
    charCount.textContent = input.value.length;
  });

  // ── Allow Enter in textarea to submit (Ctrl/Cmd+Enter) ────
  input.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      btn.click();
    }
  });

  // ── Rate-limit helpers ────────────────────────────────────
  function isRateLimited() {
    var now = Date.now();

    // Cooldown between individual presses
    if (now - lastGeneratedAt < COOLDOWN_MS) {
      return "Please wait a moment before generating again.";
    }

    // Burst / sliding-window check
    burstTimestamps = burstTimestamps.filter(function (t) {
      return now - t < BURST_WINDOW_MS;
    });
    if (burstTimestamps.length >= BURST_LIMIT) {
      return "Too many requests. Please wait a minute before trying again.";
    }

    return null;
  }

  function recordGeneration() {
    lastGeneratedAt = Date.now();
    burstTimestamps.push(lastGeneratedAt);
  }

  // ── Status helpers ─────────────────────────────────────────
  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className   = "status" + (isError ? " error" : "");
  }

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.className   = "status";
  }

  // ── Generate ──────────────────────────────────────────────
  btn.addEventListener("click", function () {
    var raw  = input.value;
    var text = raw.trim();

    // Input validation
    if (!text) {
      setStatus("Please enter some text or a URL first.", true);
      return;
    }
    if (text.length > MAX_INPUT_LENGTH) {
      setStatus("Input exceeds " + MAX_INPUT_LENGTH + " characters.", true);
      return;
    }

    // Rate limiting
    var rateLimitMsg = isRateLimited();
    if (rateLimitMsg) {
      setStatus(rateLimitMsg, true);
      return;
    }

    clearStatus();
    btn.disabled     = true;
    result.className = "result hidden";

    // Use the text value only — never inserted as HTML
    QRCode.toCanvas(canvas, text, {
      width:            400,
      margin:           2,
      color: {
        dark:  "#000000",
        light: "#ffffff"
      },
      errorCorrectionLevel: "M"
    }, function (err) {
      btn.disabled = false;

      if (err) {
        setStatus("Could not generate QR code: " + err.message, true);
        return;
      }

      recordGeneration();

      // Composite onto a white-background canvas so JPEG has no black bleed
      // (QRCode.toCanvas already uses a white background, but we make it explicit)
      var jpegCanvas  = document.createElement("canvas");
      jpegCanvas.width  = canvas.width;
      jpegCanvas.height = canvas.height;
      var ctx = jpegCanvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
      ctx.drawImage(canvas, 0, 0);

      var dataUrl = jpegCanvas.toDataURL("image/jpeg", 1.0);
      downloadBtn.href = dataUrl;

      result.className = "result";
      setStatus("QR code ready. Ctrl+Enter to regenerate.");
    });
  });

})();
