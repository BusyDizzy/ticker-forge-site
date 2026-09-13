/* snapshot.js — TickerForge Balance Snapshot (WebApp)
 * - GET /api/web/balance-snapshot?rid=...
 * - Theme-aware (Telegram themeParams + themeChanged)
 * - Unified header: SOURCEKIND • SourceName • As of TS • CUR • SHORTS
 */
(() => {
  const tg = window.Telegram?.WebApp || null;

  const API_BASE = "https://api.ticker-forge.com";
  const API_PATH = "/api/web/balance-snapshot";
  const DEBUG = true;

  const LOGO_LIGHT = "/logo-black.png";
  const LOGO_DARK  = "/logo-white.png";

  const elScores = document.getElementById("scores");
  const elExposure = document.getElementById("exposure");
  const elConcentration = document.getElementById("concentration");
  const elStress = document.getElementById("stress");
  const elDiagnostics = document.getElementById("diagnostics");

  function logInfo(...a) { if (DEBUG) console.log(...a); }
  function logWarn(...a) { if (DEBUG) console.warn(...a); }

  // -----------------------------
  // THEME
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

    // Drives report.css backgrounds (navy in dark)
    document.documentElement.dataset.theme = isDark(bg) ? "dark" : "light";

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

    // Update logo if already rendered
    const img = document.querySelector(".header .logo");
    if (img) img.src = logoSrc();
  }

  if (tg) {
    tg.ready();
    tg.expand();
    applyTheme();
    tg.onEvent?.("themeChanged", applyTheme);
  } else {
    applyTheme();
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "\"":"&quot;",
      "'":"&#39;",
    }[c]));
  }

  function pad2(v){ return String(v).padStart(2,"0"); }

  function fmtTs(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return String(ts);
      return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    } catch {
      return String(ts);
    }
  }

  function fmtUsd(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n/1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  function fmtPct(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(1)}%`;
  }

  function getMetaEl(){ return document.getElementById("meta"); }

  function showError(msg, extra) {
    const metaEl = getMetaEl();
    if (metaEl) metaEl.innerHTML = `<span class="bad">❌ ${esc(msg)}</span>`;
    if (extra && metaEl) metaEl.innerHTML += `<div class="muted" style="margin-top:6px;">${esc(extra)}</div>`;
    [elScores, elExposure, elConcentration, elStress, elDiagnostics].forEach(x => { if (x) x.innerHTML = ""; });
  }

  // -----------------------------
  // Unified header/meta line
  // -----------------------------
  function upperToken(s){
    const t = String(s || "").trim();
    return t ? t.toUpperCase() : "";
  }

  function formatMetaLine(meta) {
	  const label =
		meta?.balanceLabel ??
		meta?.sourceLabel ??
		meta?.sourceName ??
		"—";

	  const ts = meta?.generatedAt ?? meta?.asOf ?? meta?.asOfTs;

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

  function renderHeader(titleEmojiText) {
    const headerCard = document.querySelector(".card");
    if (!headerCard) return;

    const wrap = document.createElement("div");
    wrap.className = "header";
    wrap.innerHTML = `
      <img class="logo" src="${logoSrc()}" alt="TickerForge" />
      <div>
        <div class="header-title">${esc(titleEmojiText)}</div>
        <div id="meta" class="header-meta">Loading…</div>
      </div>
    `;
    headerCard.innerHTML = "";
    headerCard.appendChild(wrap);
  }

  // -----------------------------
  // Renderers
  // -----------------------------
  function row(k, v, badgeText) {
    const badge = badgeText ? ` <span class="badge accent">${esc(badgeText)}</span>` : "";
    return `<div class="row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}${badge}</div></div>`;
  }

  function renderScores(scores) {
    if (!scores) return `<div class="small muted">Scores unavailable.</div>`;
    return `
      <div class="h3">SCORES</div>
      ${row("Overall", `${scores.overallScore}/100`, scores.overallLabel)}
      ${row("TickerForge", `${scores.tickerForgeScore}/100`, scores.tickerForgeLabel)}
      ${row("Piotroski", `${scores.piotroskiScore}/100`, scores.piotroskiLabel)}
      ${row("Risk Level", scores.riskLevel || "—")}
    `;
  }

  function renderExposure(ex) {
    if (!ex) return `<div class="small muted">Exposure unavailable.</div>`;
    return `
      <div class="h3">EXPOSURE</div>
      ${row("Net Liquidity", fmtUsd(ex.netLiqUsd))}
      ${row("Cash", `${fmtPct(ex.cashPct)} (${fmtUsd(ex.cashUsd)})`)}
      ${row("Net Exposure", fmtUsd(ex.netExposureUsd))}
      ${row("Gross Exposure", fmtUsd(ex.grossExposureUsd))}
      ${row("Breadth", `${ex.positionsCount} positions • ${ex.sectorsCount} sectors`)}
    `;
  }

  function renderConcentration(c) {
    if (!c) return `<div class="small muted">Concentration unavailable.</div>`;
    return `
      <div class="h3">CONCENTRATION</div>
      ${row("Top Position", fmtPct(c.topPositionPct))}
      ${row("Top Sector", `${fmtPct(c.topSectorPct)} (${c.topSectorName || "—"})`)}
      ${row("Cyclical Tilt", fmtPct(c.cyclicalTiltPct))}
    `;
  }

  function renderStress(s) {
    if (!s) return `<div class="small muted">Stress scenario unavailable.</div>`;
    return `
      <div class="h3">STRESS SCENARIO</div>
      ${row("S&P 500 Shock", `${s.shockPct}%`)}
      ${row("Expected Drawdown", fmtPct(s.expectedDrawdownPct))}
      ${row("Primary Driver", s.primaryDriver || "—")}
      <div class="small muted" style="margin-top:8px;">Educational simulation; not investment advice.</div>
    `;
  }

  function renderDiagnostics(d) {
    if (!d) return `<div class="small muted">Diagnostics unavailable.</div>`;
    return `
      <div class="h3">DIAGNOSTICS</div>
      ${row("Risk Profile", d.riskProfileLine || "—")}
      ${row("Top Risk Factor", d.topRiskFactor || "—")}
    `;
  }

  function setMeta(meta) {
    const metaEl = getMetaEl();
    if (metaEl) metaEl.textContent = formatMetaLine(meta);
  }

  // -----------------------------
  // MAIN
  // -----------------------------
  async function load() {
    renderHeader("📍 Portfolio Snapshot");

    const params = new URLSearchParams(window.location.search);
    const rid = params.get("rid");
    if (!rid) {
      showError("Missing rid", "Open this page using a Telegram WebApp button.");
      return;
    }

    const initData = tg?.initData || "";
    const url = `${API_BASE}${API_PATH}?rid=${encodeURIComponent(rid)}`;

    logInfo("[SNAPSHOT] loading", { rid, url, hasInitData: !!initData });

    let res;
    try {
      res = await fetch(url, { method:"GET", headers: { "X-TG-INIT": initData } });
    } catch (e) {
      showError("Network error while loading report", e?.message || "");
      return;
    }

    const raw = await res.text();
    if (!res.ok) {
      showError(`Failed to load report (${res.status})`, raw.slice(0, 300));
      logWarn("[SNAPSHOT] api error", { rid, status: res.status, raw: raw.slice(0, 500) });
      return;
    }

    let r;
    try { r = JSON.parse(raw); }
    catch { showError("Invalid JSON returned by API", raw.slice(0, 200)); return; }

    setMeta(r?.meta);

    if (elScores) elScores.innerHTML = renderScores(r?.scores);
    if (elExposure) elExposure.innerHTML = renderExposure(r?.exposure);
    if (elConcentration) elConcentration.innerHTML = renderConcentration(r?.concentration);
    if (elStress) elStress.innerHTML = renderStress(r?.stress);
    if (elDiagnostics) elDiagnostics.innerHTML = renderDiagnostics(r?.diagnostics);
  }

  load();
})();