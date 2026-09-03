/* health.js — TickerForge Portfolio Health (WebApp)
 * - Data is delivered by backend: GET /api/web/health?rid=...
 * - Supports Telegram WebApp initData validation via X-TG-INIT header
 * - Uses unified header/meta style (same as snapshot.js)
 * - Uses report.css theme via <html data-theme="dark|light">
 * - Renders full DiagnosticsSummary (topRiskFactorCode/title/desc/advice + flagsUi + PDF note)
 */
(() => {
    const tg = window.Telegram?.WebApp || null;

    const API_BASE = "https://api.ticker-forge.com";
    const API_PATH = "/api/web/health";
    const DEBUG = true;

    // Keep consistent with snapshot.js
    const LOGO_LIGHT = "/logo-white.png"; // used on light backgrounds
    const LOGO_DARK  = "/logo-black.png"; // used on dark backgrounds

    // -----------------------------
    // DOM
    // -----------------------------
    const elScores = document.getElementById("scores");
    const elExposure = document.getElementById("exposure");
    const elConcentration = document.getElementById("concentration");
    const elDiagnostics = document.getElementById("diagnostics");

    function logInfo(...a) { if (DEBUG) console.log(...a); }
    function logWarn(...a) { if (DEBUG) console.warn(...a); }
    function logErr(...a) { console.error(...a); }

    // -----------------------------
    // THEME (same approach as snapshot.js)
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

        // IMPORTANT: drives report.css gradients & theme rules
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

        // Update logo if header exists
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
    // HELPERS
    // -----------------------------
    function esc(s) {
        return String(s ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[c]));
    }

    function fmtUsd(x) {
        const n = Number(x);
        if (!Number.isFinite(n)) return "—";
        return "$" + n.toFixed(2);
    }

    function fmtPct(x) {
        const n = Number(x);
        if (!Number.isFinite(n)) return "—";
        return n.toFixed(1) + "%";
    }

    function getMetaEl() {
        return document.getElementById("meta");
    }

    function showError(msg, extra) {
        const metaEl = getMetaEl();
        if (metaEl) metaEl.innerHTML = `<span class="bad">❌ ${esc(msg)}</span>`;
        if (extra && metaEl) metaEl.innerHTML += `<div class="muted">${esc(extra)}</div>`;
        [elScores, elExposure, elConcentration, elDiagnostics].forEach(x => { if (x) x.innerHTML = ""; });
    }

    function toText(v) {
        if (v == null) return "—";
        if (typeof v === "string") return v;
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "true" : "false";
        try { return JSON.stringify(v); } catch { return String(v); }
    }

    // --- ФОРМАТИРОВАНИЕ CAPS И UNDERSCORE ---
    function formatFlagTitle(title) {
        if (!title) return "";
        if (title === "ALTMAN_DISTRESS_DETECTED") return "Altman Distress Detected";

        // Превращаем любой НЕКРАСИВЫЙ_ФЛАГ в "Некрасивый Флаг"
        if (/^[A-Z_]+$/.test(title)) {
            return title.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
        }
        return title;
    }

    // -----------------------------
    // UNIFIED HEADER (snapshot style)
    // -----------------------------
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
    // RENDERERS
    // -----------------------------

    // --- ИЗМЕНЕНИЕ 1: Добавлены новые поля из details ---
    function renderScores(s, details) {
        const beta = details?.weightedBeta !== undefined ? Number(details.weightedBeta).toFixed(2) : "1.00";
        const riskScore = details?.weightedRiskScore !== undefined ? Number(details.weightedRiskScore).toFixed(1) : "50.0";
        const style = details?.portfolioArchetype || "BALANCED";

        return `
      <div class="h3">SCORES</div>
      <div class="row"><div class="k">Overall</div><div class="v">${esc(toText(s?.overall?.score))} (${esc(toText(s?.overall?.label))})</div></div>
      <div class="row"><div class="k">TickerForge</div><div class="v">${esc(toText(s?.tickerForge?.score))} (${esc(toText(s?.tickerForge?.label))})</div></div>
      <div class="row"><div class="k">Piotroski</div><div class="v">${esc(toText(s?.piotroski?.score))} (${esc(toText(s?.piotroski?.label))})</div></div>
      <div class="row"><div class="k">Risk Level</div><div class="v">${esc(toText(s?.riskLevel))}</div></div>
      <div class="row"><div class="k">Market Risk (Beta)</div><div class="v">${esc(beta)}</div></div>
      <div class="row"><div class="k">Fundamental RiskScore</div><div class="v">${esc(riskScore)} / 100</div></div>
      <div class="row"><div class="k">Portfolio Style</div><div class="v">${esc(style)}</div></div>
    `;
    }

    function renderExposure(ex) {
        return `
      <div class="h3">EXPOSURE</div>
      <div class="row"><div class="k">Net Liquidation</div><div class="v">${fmtUsd(ex?.netLiquidationUsd)}</div></div>
      <div class="row"><div class="k">Cash</div><div class="v">${fmtUsd(ex?.cashUsd)} (${fmtPct(ex?.cashPctOfNetLiq)})</div></div>
      <div class="row"><div class="k">Net Exposure</div><div class="v">${fmtUsd(ex?.netExposureUsd)}</div></div>
      <div class="row"><div class="k">Gross Exposure</div><div class="v">${fmtUsd(ex?.grossExposureUsd)}</div></div>
    `;
    }

    function renderConcentration(c) {
        return `
      <div class="h3">CONCENTRATION</div>
      <div class="row"><div class="k">Max Position</div><div class="v">${fmtPct(c?.maxPositionWeightPct)}</div></div>
      <div class="row"><div class="k">Max Sector</div><div class="v">${fmtPct(c?.maxSectorWeightPct)}</div></div>
      <div class="row"><div class="k">Top Ticker</div><div class="v">${esc(toText(c?.topTicker || "—"))}</div></div>
      <div class="row"><div class="k">Top Sector</div><div class="v">${esc(toText(c?.topSector || "—"))}</div></div>
    `;
    }

    // ---- FULL DIAGNOSTICS (from OLD, adapted to report.css structure) ----
    function sevChipClass(sev) {
        const s = String(sev || "").toLowerCase();
        if (s === "high") return "sev-high";
        if (s === "med" || s === "medium") return "sev-med";
        return "sev-low";
    }

    function normalizeDiagnostics(d) {
        let diag = d;
        if (typeof diag === "string") {
            try { diag = JSON.parse(diag); }
            catch { return { __badString: true, raw: diag }; }
        }
        if (!diag || typeof diag !== "object") return null;
        return diag;
    }

    function safeStr(v) {
        if (v === null || v === undefined) return "";
        return String(v).trim();
    }

    function renderDiagnostics(d) {
        const diag = normalizeDiagnostics(d);

        if (diag && diag.__badString) {
            const msg = diag.raw.length > 220 ? diag.raw.slice(0, 220) + "…" : diag.raw;
            return `
        <div class="h3">DIAGNOSTICS</div>
        <div class="muted small">
          Diagnostics payload was a string but could not be parsed.
          <div style="margin-top:6px; word-break:break-word;">${esc(msg)}</div>
        </div>
      `;
        }

        if (!diag) {
            return `
        <div class="h3">DIAGNOSTICS</div>
        <div class="muted small">Diagnostics unavailable.</div>
      `;
        }

        const code = safeStr(diag.topRiskFactorCode);

        // --- ИЗМЕНЕНИЕ 2: Форматируем Top Title ---
        const title = formatFlagTitle(safeStr(diag.topRiskFactorTitle));
        const desc = safeStr(diag.topRiskFactorDesc);
        const advice = safeStr(diag.topRiskFactorAdvice);

        const topValue = title || formatFlagTitle(code) || "—";
        const flags = Array.isArray(diag.flagsUi) ? diag.flagsUi : [];

        const flagsHtml = flags.length === 0
            ? `<li class="muted">—</li>`
            : flags.map(renderFlagItem).join("");

        return `
      <div class="h3">DIAGNOSTICS</div>

      <div class="row">
        <div class="k">Top risk factor</div>
        <div class="v"><b>${esc(topValue)}</b></div>
      </div>

      ${desc ? `<div class="muted small" style="margin-top:6px;">${esc(desc)}</div>` : ""}
      ${advice ? `<div class="small" style="margin-top:6px;"><b>Action:</b> ${esc(advice)}</div>` : ""}

      <div class="divider"></div>

      <div class="muted" style="margin-bottom:6px;">Flags</div>
      <ul class="list">${flagsHtml}</ul>

      ${renderPdfNote()}
    `;

        function renderFlagItem(f) {
            if (f && typeof f === "object" && !Array.isArray(f)) {

                // --- ИЗМЕНЕНИЕ 3: Форматируем флаги в списке ---
                const t = formatFlagTitle(safeStr(f.title) || safeStr(f.code)) || "—";
                const dsc = safeStr(f.desc);
                const adv = safeStr(f.advice);
                const sev = safeStr(f.sev || f.severity);

                return `
          <li>
            <div style="display:flex; gap:8px; align-items:center; justify-content:space-between;">
              <div><b>${esc(t)}</b></div>
              ${sev ? `<span class="chip ${sevChipClass(sev)}">${esc(sev)}</span>` : ""}
            </div>
            ${dsc ? `<div class="muted small" style="margin-top:4px;">${esc(dsc)}</div>` : ""}
            ${adv ? `<div class="small" style="margin-top:4px;"><b>Action:</b> ${esc(adv)}</div>` : ""}
          </li>
        `;
            }

            // string fallback
            const txt = formatFlagTitle(String(f ?? ""));
            return `<li>${esc(txt)}</li>`;
        }

        function renderPdfNote() {
            return `
        <div class="divider"></div>
        <div class="muted small" style="margin-top:10px;">
          This is the short Telegram Web version. Full diagnostics will be available in the PDF report.
        </div>
        <div style="margin-top:10px;">
          <button class="chip" disabled style="opacity:0.6; cursor:not-allowed;">📄 PDF report (coming soon)</button>
        </div>
      `;
        }
    }

    // -----------------------------
    // MAIN
    // -----------------------------
    async function load() {
        renderHeader("🧠 Portfolio Health");

        const params = new URLSearchParams(window.location.search);
        const rid = params.get("rid");

        if (!rid) {
            showError("Missing rid", "Open via Telegram WebApp.");
            return;
        }

        const initData = tg?.initData || "";
        const url = `${API_BASE}${API_PATH}?rid=${encodeURIComponent(rid)}`;
        logInfo("[HEALTH] loading", { rid, url, hasInitData: !!initData });

        let res;
        try {
            res = await fetch(url, { method: "GET", headers: { "X-TG-INIT": initData } });
        } catch (e) {
            showError("Network error", e?.message || "");
            return;
        }

        const raw = await res.text();
        if (!res.ok) {
            showError(`API error (${res.status})`, raw.slice(0, 200));
            logWarn("[HEALTH] api error", { rid, status: res.status, raw: raw.slice(0, 500) });
            return;
        }

        let r;
        try { r = JSON.parse(raw); }
        catch {
            showError("Invalid JSON", raw.slice(0, 200));
            return;
        }

        setMeta(r?.meta);

        // --- ИЗМЕНЕНИЕ 4: Передаем shortDetails в renderScores ---
        if (elScores) elScores.innerHTML = renderScores(r?.scores, r?.diagnostics?.details);
        if (elExposure) elExposure.innerHTML = renderExposure(r?.exposure);
        if (elConcentration) elConcentration.innerHTML = renderConcentration(r?.concentration);
        if (elDiagnostics) elDiagnostics.innerHTML = renderDiagnostics(r?.diagnostics);

        // sanity logs
        if (!r?.diagnostics) {
            logWarn("[HEALTH][SANITY] Missing diagnostics in payload", { rid, r });
        } else {
            const diagType = (typeof r.diagnostics === "string") ? "STRING" : (typeof r.diagnostics);
            logInfo("[HEALTH][SANITY] diagnosticsType=", diagType);
        }
    }

    load();
})();