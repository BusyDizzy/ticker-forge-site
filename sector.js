/* sector.js — TickerForge Sector Allocation (WebApp)
 * GET /api/web/sector-allocation?rid=...
 * Header: X-TG-INIT: tg.initData
 *
 * ✅ Uses unified header/meta style (same as health.js / snapshot.js)
 * ✅ Uses report.css theme via <html data-theme="dark|light">
 * ✅ Improves sector list formatting (readable, aligned, compact)
 */
(() => {
  const tg = window.Telegram?.WebApp || null;

  const API_BASE = "https://api.ticker-forge.com";
  const API_PATH = "/api/web/sector-allocation";
  const DEBUG = false;

  const LOGO_LIGHT = "/logo-white.png"; // used on light backgrounds
  const LOGO_DARK  = "/logo-black.png"; // used on dark backgrounds

  // -----------------------------
  // DOM
  // -----------------------------
  const elExposure = document.getElementById("exposure");
  const elConcentration = document.getElementById("concentration");
  const elSectors = document.getElementById("sectors");

  function getMetaEl() {
    return document.getElementById("meta");
  }

  function logInfo(...a) { if (DEBUG) console.log("[sector]", ...a); }
  function logWarn(...a) { if (DEBUG) console.warn("[sector]", ...a); }

  function qs(name) { return new URLSearchParams(window.location.search).get(name); }

  // -----------------------------
  // THEME (same approach as health.js / snapshot.js)
  // -----------------------------
  function isDark(hex) {
    const h = (hex || "").replace("#", "");
    if (h.length !== 6) return false;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128;
  }

  function currentIsDark() {
    const bg = tg?.themeParams?.bg_color || "";
    if (bg && bg.startsWith("#") && bg.length === 7) return isDark(bg);
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  }

  function logoSrc() {
    return currentIsDark() ? LOGO_DARK : LOGO_LIGHT;
  }

  function applyTheme() {
    const bg = tg?.themeParams?.bg_color || (currentIsDark() ? "#0A1D3B" : "#ffffff");
    const text = tg?.themeParams?.text_color || (currentIsDark() ? "#ffffff" : "#111111");

    document.documentElement.style.setProperty("--tg-bg", bg);
    document.documentElement.style.setProperty("--tg-text", text);

    // Drives report.css gradients & theme rules
    document.documentElement.dataset.theme = isDark(bg) ? "dark" : "light";

    // Basic tokens (compatible with report.css usage)
    if (isDark(bg)) {
      document.documentElement.style.setProperty("--card-bg", "rgba(26,26,26,0.92)");
      document.documentElement.style.setProperty("--card-border", "rgba(255,255,255,0.14)");
      document.documentElement.style.setProperty("--chip-bg", "rgba(255,255,255,0.08)");
      document.documentElement.style.setProperty("--chip-text", "rgba(255,255,255,0.78)");
      document.documentElement.style.setProperty("--muted", "rgba(255,255,255,0.70)");
      document.documentElement.style.setProperty("--shadow", "0 10px 30px rgba(0,0,0,0.25)");
    } else {
      document.documentElement.style.setProperty("--card-bg", "rgba(255,255,255,0.94)");
      document.documentElement.style.setProperty("--card-border", "rgba(17,17,17,0.10)");
      document.documentElement.style.setProperty("--chip-bg", "rgba(17,17,17,0.06)");
      document.documentElement.style.setProperty("--chip-text", "rgba(17,17,17,0.78)");
      document.documentElement.style.setProperty("--muted", "rgba(17,17,17,0.62)");
      document.documentElement.style.setProperty("--shadow", "0 10px 28px rgba(0,0,0,0.08)");
    }

    const img = document.querySelector(".header .logo");
    if (img) img.src = logoSrc();
  }

  if (tg) {
    tg.ready?.();
    tg.expand?.();
    applyTheme();
    tg.onEvent?.("themeChanged", applyTheme);
  } else {
    applyTheme();
  }

  // -----------------------------
  // HELPERS
  // -----------------------------
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function fmtUsdCompact(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(1) + "T";
    if (a >= 1e9)  return (n / 1e9).toFixed(1) + "B";
    if (a >= 1e6)  return (n / 1e6).toFixed(1) + "M";
    if (a >= 1e3)  return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(0);
  }

  function fmtUsd(v) {
    const s = fmtUsdCompact(v);
    return s === "—" ? "—" : `$${s}`;
  }

  function fmtPct(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}%`;
  }

  function section(title, html, footerHtml) {
    return `
      <div class="h3">${esc(title)}</div>
      ${html}
      ${footerHtml || ""}
    `;
  }

  function row(k, v) {
    return `<div class="row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
  }

  function showError(msg, extra) {
    const metaEl = getMetaEl();
    if (metaEl) metaEl.textContent = `${msg}${extra ? " — " + extra : ""}`;

    const err = section("Error", `<div class="small">${esc(extra || msg)}</div>`);
    if (elExposure) elExposure.innerHTML = err;
    if (elConcentration) elConcentration.innerHTML = err;
    if (elSectors) elSectors.innerHTML = err;
  }

  // -----------------------------
  // UNIFIED HEADER (snapshot/health style)
  // -----------------------------
  function formatMetaLine(meta) {
    const label =
      meta?.balanceLabel ??
      meta?.sourceLabel ??
      meta?.portfolioName ??
      meta?.sourceName ??
      "—";

    // date-only
    const ts = meta?.asOfDate ?? meta?.generatedAt ?? meta?.asOf ?? meta?.asOfTs;

    let dateOnly = "—";
    try {
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) {
        const pad = (v) => String(v).padStart(2, "0");
        dateOnly = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      } else if (ts) {
        dateOnly = String(ts).slice(0, 10);
      }
    } catch {
      if (ts) dateOnly = String(ts).slice(0, 10);
    }

    return `Balance: ${label} • As of ${dateOnly}`;
  }

  function renderHeader(title) {
    const headerCard = document.querySelector(".card");
    if (!headerCard) return;

    const wrap = document.createElement("div");
    wrap.className = "header";
    wrap.innerHTML = `
      <img class="logo" src="${logoSrc()}" alt="TickerForge" />
      <div>
        <div class="header-title">${esc(title)}</div>
        <div id="meta" class="header-meta">Loading…</div>
      </div>
    `;
    headerCard.innerHTML = "";
    headerCard.appendChild(wrap);
  }

  function setMeta(meta) {
    const metaEl = getMetaEl();
    if (metaEl) metaEl.textContent = formatMetaLine(meta);
  }

  // -----------------------------
  // SECTOR LIST (FIXED FORMATTING)
  // -----------------------------
  function normalizeSectors(list) {
    // Accept both:
    // - data.sectors: [{ name, weightPct, grossUsd, topTickers }]
    // - data.details/topSectors etc (if backend changes later)
    if (!Array.isArray(list)) return [];
    return list.map(s => ({
      name: s?.name ?? s?.sectorName ?? "—",
      weightPct: s?.weightPct ?? s?.pct ?? s?.weight ?? null,
      grossUsd: s?.grossUsd ?? s?.gross ?? s?.grossExposureUsd ?? null,
      topTickers: Array.isArray(s?.topTickers) ? s.topTickers : (Array.isArray(s?.tickers) ? s.tickers : []),
    }));
  }

  function renderSectorItem(s) {
    const name = String(s?.name || "—");
    const pct = fmtPct(s?.weightPct);
    const gross = fmtUsd(s?.grossUsd);

    const tickersRaw = (Array.isArray(s?.topTickers) ? s.topTickers : [])
      .map(x => String(x || "").trim())
      .filter(Boolean);

    const MAX_TICKERS = 6;
    const tickers = tickersRaw.slice(0, MAX_TICKERS);
    const hasMore = tickersRaw.length > MAX_TICKERS;

    const tickersLine = tickers.length
      ? `Top: ${tickers.join(", ")}${hasMore ? ", …" : ""}`
      : "";

    // Structured, aligned layout without depending on new CSS classes
    return `
      <div style="
        padding: 10px 0;
        border-top: 1px solid var(--card-border);
      ">
        <div class="row" style="padding:0;">
          <div class="k" style="font-weight:650; opacity:1;">${esc(name)}</div>
          <div class="v" style="font-variant-numeric: tabular-nums;">${esc(pct)}</div>
        </div>

        <div class="row" style="padding:2px 0 0;">
          <div class="k muted" style="font-size:12.5px;">Gross</div>
          <div class="v muted" style="font-size:12.5px;">${esc(gross)}</div>
        </div>

        ${tickersLine ? `
          <div class="muted" style="
            margin-top:6px;
            font-size:12.5px;
            line-height:1.25;
            word-break: break-word;
          ">${esc(tickersLine)}</div>
        ` : ""}
      </div>
    `;
  }

  function renderSectorsList(sectors) {
    const list = normalizeSectors(sectors);

    if (!list.length) {
      return `<div class="small muted">No sector data.</div>`;
    }

    // Remove top border for the first item (looks cleaner)
    const items = list.map((s, i) => {
      const html = renderSectorItem(s);
      if (i === 0) {
        return html.replace('border-top: 1px solid var(--card-border);', 'border-top: 0;');
      }
      return html;
    }).join("");

    // Wrap to control spacing
    return `<div style="margin-top:4px;">${items}</div>`;
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  function render(data) {
    const meta = data?.meta || {};
    const summary = data?.summary || {};
    const diag = data?.diagnostics || {};
    const sectors = Array.isArray(data?.sectors) ? data.sectors : [];

    setMeta(meta);

    // Exposure (keep your structure)
    const exposureRows = [
      row("Net Liquidity", fmtUsd(summary?.netLiquidationUsd)),
      row("Cash", `${fmtUsd(summary?.cashUsd)} (${fmtPct(summary?.cashPct)})`),
      row("Gross Exposure", fmtUsd(summary?.grossExposureUsd)),
      row("Net Exposure", fmtUsd(summary?.netExposureUsd)),
      row("Breadth", `${summary?.positions ?? "—"} positions • ${summary?.sectors ?? "—"} sectors`)
    ].join("");
    if (elExposure) elExposure.innerHTML = section("Exposure", exposureRows);

    // Concentration
    const topSectorLine = `${fmtPct(diag?.topSectorPct)} (${diag?.topSectorName || "—"})`;
    const concentrationRows = [
      row("Top Sector", topSectorLine),
      row("Cyclical Tilt", fmtPct(diag?.cyclicalTiltPct)),
      row("Risk Level", String(diag?.riskLevel || "—"))
    ].join("");
    if (elConcentration) elConcentration.innerHTML = section("Concentration", concentrationRows);

    // Sectors (formatted)
    const sectorsHtml = renderSectorsList(sectors);
    const footer = `<div class="small muted" style="margin-top:12px;">Educational simulation; not investment advice.</div>`;
    if (elSectors) elSectors.innerHTML = section("Sectors", sectorsHtml, footer);
  }

  // -----------------------------
  // MAIN
  // -----------------------------
  async function load() {
    renderHeader("📊 Sector Allocation");

    const rid = qs("rid");
    if (!rid) {
      showError("Missing rid.", "URL must include ?rid=...");
      return;
    }

    const initData = tg?.initData || "";
    const url = `${API_BASE}${API_PATH}?rid=${encodeURIComponent(rid)}`;
    logInfo("GET", url);

    let res;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "X-TG-INIT": initData,
          "Accept": "application/json",
        },
        cache: "no-store",
      });
    } catch (e) {
      showError("Network error.", String(e?.message || e));
      return;
    }

    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      logWarn("HTTP error", res.status, raw.slice(0, 500));
      showError(`Error ${res.status}`, raw.slice(0, 200) || "Request failed");
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      showError("Bad response.", "Server did not return JSON.");
      return;
    }

    render(data);
  }

  load();
})();