/* stress.js — TickerForge Stress Test (WebApp)
 * - Data: GET /api/web/stress?rid=...
 * - Telegram initData via X-TG-INIT
 * - Uses report.css theme via <html data-theme="dark|light">
 * - Uses unified header/meta style (same as health.js / snapshot.js)
 *
 * FIXES:
 * 1) 🩸 Bleeding / 🛡️ Hedge / 📉 Net Impact block
 * 2) Disclaimer at bottom
 * 3) K/M/B/T formatting
 * 4) NEW: Named Stress Scenario line:
 *    "Stress Scenario: {NAME} (S&P 500 +/-XX%)" shown above Status
 */

(() => {
    const tg = window.Telegram?.WebApp || null;

    // CONFIG
    const API_BASE = "https://api.ticker-forge.com";
    const API_PATH = "/api/web/stress";
    const DEBUG = true;

    // Keep consistent with other reports
    const LOGO_LIGHT = "/logo-white.png"; // used on light backgrounds
    const LOGO_DARK = "/logo-black.png";  // used on dark backgrounds

    // DOM
    const elScenario = document.getElementById("scenario");
    const elImpacts = document.getElementById("impacts");

    function logInfo(...a) { if (DEBUG) console.log(...a); }
    function logWarn(...a) { if (DEBUG) console.warn(...a); }
    function logErr(...a) { console.error(...a); }

    // -----------------------------
    // THEME (same approach as health.js)
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

    function qs(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function getMetaEl() {
        return document.getElementById("meta");
    }

    function showError(msg, extra) {
        const metaEl = getMetaEl();
        if (metaEl) metaEl.innerHTML = `<span class="bad">❌ ${esc(msg)}</span>`;
        if (extra && metaEl) metaEl.innerHTML += `<div class="muted">${esc(extra)}</div>`;
        if (elScenario) elScenario.innerHTML = "";
        if (elImpacts) elImpacts.innerHTML = "";
    }

    // --- number formatting (K/M/B/T) ---
    function fmtCompact(n, decimals = 2) {
        const x = Number(n);
        if (!Number.isFinite(x)) return "—";

        const abs = Math.abs(x);
        const sign = x < 0 ? "-" : "";

        const units = [
            { v: 1e12, s: "T" },
            { v: 1e9,  s: "B" },
            { v: 1e6,  s: "M" },
            { v: 1e3,  s: "K" }
        ];

        for (const u of units) {
            if (abs >= u.v) {
                const val = abs / u.v;
                const str = val.toFixed(decimals).replace(/\.?0+$/, "");
                return `${sign}${str}${u.s}`;
            }
        }

        const str = abs.toFixed(2).replace(/\.?0+$/, "");
        return `${sign}${str}`;
    }

    function fmtUsdSmart(x) {
        const n = Number(x);
        if (!Number.isFinite(n)) return "—";
        return `$${fmtCompact(n, 2)}`;
    }

    function fmtUsdSignedSmart(x) {
        const n = Number(x);
        if (!Number.isFinite(n)) return "—";
        const sign = n > 0 ? "+" : "";
        return `${sign}$${fmtCompact(n, 2)}`;
    }

    function fmtPct(x) {
        const n = Number(x);
        if (!Number.isFinite(n)) return "—";
        return n.toFixed(2) + "%";
    }

    // -----------------------------
    // UNIFIED HEADER (health.js style)
    // -----------------------------
    function formatMetaLine(meta) {
        const label =
            meta?.balanceLabel ??
            meta?.sourceLabel ??
            meta?.sourceName ??
            meta?.portfolioName ??
            "—";

        const ts = meta?.generatedAt ?? meta?.asOf ?? meta?.asOfTs ?? meta?.asOfDate;
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

        const sp = (meta?.spShockPct ?? meta?.spShock ?? null);
        const spPart = (sp === null || sp === undefined) ? "" : ` • S&amp;P500 shock ${esc(String(sp))}%`;

        return `Portfolio: ${esc(label)} • As of ${esc(dateOnly)}`;
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
        <div id="meta" class="header-meta muted">Loading…</div>
      </div>
    `;
        headerCard.innerHTML = "";
        headerCard.appendChild(wrap);
    }

    function setMeta(meta) {
        const metaEl = getMetaEl();
        if (metaEl) metaEl.innerHTML = formatMetaLine(meta);
    }

    // -----------------------------
    // STATUS BADGE
    // -----------------------------
    function statusBadge(status) {
        if (status === "MARGIN_CALL") return `<span class="badge bad">MARGIN CALL</span>`;
        if (status === "MARGIN_BUFFER_THIN") return `<span class="badge warn">THIN BUFFER</span>`;
        return `<span class="badge accent">OK</span>`;
    }

    // -----------------------------
    // STRESS SCENARIO NAMING (NEW)
    // -----------------------------
    function shockPct(meta) {
        const sp = meta?.spShockPct ?? meta?.spShock;
        const n = Number(sp);
        return Number.isFinite(n) ? n : null;
    }

    function scenarioNameFromShock(sp) {
        // Your exact mapping
        if (sp === -10) return "Flash Correction";
        if (sp === -20) return "Liquidity Shock";
        if (sp === 10) return "Relief Rally";
        if (sp === 20) return "Short Squeeze";
        return "Custom";
    }

    function formatShock(sp) {
        if (!Number.isFinite(sp)) return "";
        const sign = sp > 0 ? "+" : "";
        return `${sign}${sp}%`;
    }

    function stressScenarioLine(meta) {
        const sp = shockPct(meta);
        const name = scenarioNameFromShock(sp);
        const shock = Number.isFinite(sp) ? ` (S&P 500 ${formatShock(sp)})` : "";
        return { name, line: `Stress Scenario: ${name}${shock}` };
    }

    // -----------------------------
    // RENDERERS
    // -----------------------------
    function viewTitle(meta) {
        // Keep your existing view split
        const sp = shockPct(meta);
        if (Number.isFinite(sp) && sp >= 0) return "Short Risk / Margin";
        return "Stress (Downside)";
    }

    function ruleLine(meta) {
        return meta?.rule ? String(meta.rule) : "position shock = β × S&P shock";
    }

    function renderBenchmark(sc) {
        const t = sc?.benchmarkVolatilityText;
        if (!t) return "";
        return `
      <div class="divider"></div>
      <div class="row">
        <div class="k"><b>Benchmark</b></div>
        <div class="v"><b>${esc(t)}</b></div>
      </div>
    `;
    }

    function renderMarginCallAlert(sc) {
        if (sc?.status !== "MARGIN_CALL") return "";
        return `
      <div class="divider"></div>
      <div class="row">
        <div class="k bad"><b>Alert</b></div>
        <div class="v bad">⚠️ Leverage is high. Consider reducing gross exposure.</div>
      </div>
    `;
    }

    function renderScenario(meta, sc) {
        const { name: scenarioName, line: scenarioLine } = stressScenarioLine(meta);

        const netBias = sc?.netBiasEffect ? String(sc.netBiasEffect) : null;
        const leverage = Number(sc?.leverageRatio);
        const deficit = Number(sc?.marginDeficitUsd);
        const util = Number(sc?.marginUtilizationPct);

        const showDeficit = Number.isFinite(deficit) && deficit > 0;

        // Optional: also include {NAME} in the header line (keeps it compact & aligned)
        const hTitle = viewTitle(meta);

        return `
      <div class="h3">SCENARIO</div>
      <h2 style="margin-top:0;">🧨 ${esc(hTitle)}</h2>
      <div class="muted small">Rule: ${esc(ruleLine(meta))}</div>

      <!-- NEW: Telegram-style line above Status -->
      <div class="divider"></div>
      <div class="row">
        <div class="k"><b>Stress Scenario</b></div>
        <div class="v"><b>${esc(scenarioName)}</b> <span class="muted small">${esc(scenarioLine.replace(`Stress Scenario: ${scenarioName}`, ""))}</span></div>
      </div>

      <div class="divider"></div>

      <div class="row">
        <div class="k">Status</div>
        <div class="v">${statusBadge(sc?.status)}</div>
      </div>

      ${netBias ? `
        <div class="row">
          <div class="k">Net Bias Effect</div>
          <div class="v">${esc(netBias)}</div>
        </div>
      ` : ""}

      ${renderBenchmark(sc)}

      <div class="divider"></div>

      <div class="row">
        <div class="k">Cash</div>
        <div class="v">${fmtUsdSmart(sc?.cashUsd)}</div>
      </div>

      <div class="row">
        <div class="k">Equity now</div>
        <div class="v">${fmtUsdSmart(sc?.equityNowUsd)}</div>
      </div>

      <div class="row">
        <div class="k">Equity stressed</div>
        <div class="v">${fmtUsdSmart(sc?.equityStressedUsd)}</div>
      </div>

      <div class="row">
        <div class="k">Drawdown</div>
        <div class="v">${fmtPct(sc?.drawdownPct)}</div>
      </div>

      <div class="divider"></div>

      <div class="row">
        <div class="k">Gross now</div>
        <div class="v">${fmtUsdSmart(sc?.grossNowUsd)}</div>
      </div>

      <div class="row">
        <div class="k">Gross stressed</div>
        <div class="v">${fmtUsdSmart(sc?.grossStressedUsd)}</div>
      </div>

      <div class="row">
        <div class="k">Required equity (maint)</div>
        <div class="v">${fmtUsdSmart(sc?.requiredEquityUsd)}</div>
      </div>

      ${Number.isFinite(util) ? `
        <div class="row">
          <div class="k">Margin utilization</div>
          <div class="v">${fmtPct(util)}</div>
        </div>
      ` : ""}

      ${showDeficit ? `
        <div class="row">
          <div class="k bad"><b>Deficit</b></div>
          <div class="v bad"><b>${fmtUsdSignedSmart(-deficit)}</b></div>
        </div>
      ` : ""}

      ${Number.isFinite(leverage) ? `
        <div class="divider"></div>
        <div class="row">
          <div class="k">Leverage ratio (gross / equity stressed)</div>
          <div class="v">${leverage.toFixed(2)}</div>
        </div>
      ` : ""}

      ${renderMarginCallAlert(sc)}
    `;
    }

    function renderImpacts(impacts) {
        const rows = (impacts || []).map(r => `
      <tr>
        <td><b>${esc(r?.ticker || "")}</b></td>
        <td>${esc(r?.side || "")}</td>
        <td style="text-align:right; font-variant-numeric: tabular-nums;">
          ${fmtUsdSignedSmart(r?.impactUsd)}
        </td>
      </tr>
    `).join("");

        return `
      <div class="h3">TOP IMPACTS</div>
      <h2 style="margin-top:0;">📉 Top position impacts</h2>
      ${(impacts && impacts.length) ? `
        <table class="table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Side</th>
              <th style="text-align:right;">Impact</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      ` : `<div class="muted small">No impacts to show.</div>`}
    `;
    }

    function renderImpactSummary(sc) {
        const longImpact = sc?.longImpactUsd ?? sc?.bleedingLongUsd;
        const shortImpact = sc?.shortImpactUsd ?? sc?.hedgeShortUsd;
        const net = sc?.netImpactUsd;

        const hasAny =
            Number.isFinite(Number(longImpact)) ||
            Number.isFinite(Number(shortImpact)) ||
            Number.isFinite(Number(net));

        if (!hasAny) return "";

        return `
      <div class="divider"></div>

      <div class="row">
        <div class="k">🩸 Bleeding (Longs)</div>
        <div class="v">${fmtUsdSignedSmart(longImpact)}</div>
      </div>

      <div class="row">
        <div class="k">🛡️ Hedge Protection (Shorts)</div>
        <div class="v">${fmtUsdSignedSmart(shortImpact)}</div>
      </div>

      <div class="row">
        <div class="k">📉 Net Impact</div>
        <div class="v">${fmtUsdSignedSmart(net)}</div>
      </div>
    `;
    }

    function renderDisclaimer(sc) {
        const d = sc?.disclaimer;
        if (!d) return "";
        return `
      <div class="divider"></div>
      <div class="muted small">${esc(d)}</div>
    `;
    }

    function render(data) {
        const meta = data?.meta || {};
        const sc = data?.scenario || {};
        const impacts = data?.topImpacts || [];

        setMeta(meta);

        if (elScenario) elScenario.innerHTML = renderScenario(meta, sc);

        if (elImpacts) {
            elImpacts.innerHTML =
                renderImpacts(impacts) +
                renderImpactSummary(sc) +
                renderDisclaimer(sc);
        }

        // Optional: also reflect scenario name in header title
        // (keeps UX nice when user opens multiple reports)
        // const sp = shockPct(meta);
        // const nm = scenarioNameFromShock(sp);
        // const shock = Number.isFinite(sp) ? ` (S&P 500 ${formatShock(sp)})` : "";
        // const view = viewTitle(meta);
        // const headerTitle = `🧨 ${view} — ${nm}${shock}`;
        // const titleEl = document.querySelector(".header-title");
        // if (titleEl) titleEl.textContent = headerTitle;
    }

    // -----------------------------
    // MAIN
    // -----------------------------
    async function load() {
        renderHeader("🧨 Stress Test");

        const rid = qs("rid");
        if (!rid) {
            showError("Missing rid", "Open via Telegram WebApp.");
            return;
        }

        const initData = tg?.initData || "";
        const url = `${API_BASE}${API_PATH}?rid=${encodeURIComponent(rid)}`;

        logInfo("[STRESS] loading", { rid, url, hasInitData: !!initData });

        let res;
        try {
            res = await fetch(url, {
                method: "GET",
                headers: { "X-TG-INIT": initData },
                cache: "no-store",
            });
        } catch (e) {
            showError("Network error", e?.message || "");
            return;
        }

        const raw = await res.text();
        if (!res.ok) {
            showError(`API error (${res.status})`, raw.slice(0, 220));
            logWarn("[STRESS] api error", { rid, status: res.status, raw: raw.slice(0, 500) });
            return;
        }

        let r;
        try {
            r = JSON.parse(raw);
        } catch {
            showError("Invalid JSON", raw.slice(0, 220));
            return;
        }

        render(r);
    }

    load();
})();