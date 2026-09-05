/* ===========================================================================
   RLE-Bench leaderboard — rendering
   Vanilla ES2020, no dependencies, no network. Everything reads from BENCH.
   =========================================================================== */

(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const fmt  = (v, d = 1) => (v * 100).toFixed(d);
  const usd  = v => "$" + (v >= 10 ? Math.round(v) : v.toFixed(1));

  /* ── scoring ------------------------------------------------------------
     A family's score aggregates its splits the way the verifier does: `mean`
     for most families, `min` for task01 (checkpoints reduce by minimum across
     the three canonical arms). The index is the unweighted mean of the eight
     family scores.                                                          */

  const taskById = Object.fromEntries(BENCH.tasks.map(t => [t.id, t]));

  const splitsFor = (taskId, modelId) => (BENCH.scores[taskId] || {})[modelId] || [];

  function taskScore(taskId, modelId) {
    const vals = splitsFor(taskId, modelId);
    if (!vals.length) return null;
    return taskById[taskId].aggregate === "min"
      ? Math.min(...vals)
      : vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function indexScore(modelId) {
    const vals = BENCH.tasks.map(t => taskScore(t.id, modelId)).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  /* Per-family spend: each family carries a fixed share of the suite bill. */
  const taskCost = (taskId, model) => model.cost * taskById[taskId].costShare;

  const RANKED     = BENCH.models.map(m => ({ ...m, index: indexScore(m.id) }))
                                 .sort((a, b) => b.index - a.index);
  const CONTENDERS = RANKED.filter(m => !m.baseline);
  const place      = id => CONTENDERS.findIndex(c => c.id === id) + 1;

  /* ── theme ------------------------------------------------------------- */

  /* Every family column gets its OWN hue, so identity reads across the grid
     and magnitude reads down it: each cell is that hue mixed into the chart
     surface, faint at zero and full-strength at 100. Hues are the validated
     categorical slots, taken in fixed order — never cycled. */
  const HUES = {
    light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
    dark:  ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  };
  const SURFACE = { light: "#fcfcfb", dark: "#1a1a19" };

  const theme = () => document.documentElement.getAttribute("data-theme") || "dark";

  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgb2hex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => rgb2hex(hex2rgb(a).map((v, i) => v * t + hex2rgb(b)[i] * (1 - t)));

  const relLum = h => {
    const [r, g, b] = hex2rgb(h).map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  /* pick whichever ink actually reads on the cell, rather than guessing */
  const inkFor = bg => contrast(bg, "#ffffff") >= contrast(bg, "#0b0b0b") ? "#ffffff" : "#0b0b0b";

  /* Two-segment ramp per hue, so each column uses its whole range instead of
     fading into the surface. Below the pivot the hue washes toward the chart
     surface; above it, it keeps going the other way — deeper on light, paler
     on dark. Mixing a hue straight into near-black (the naive dark ramp) is
     what makes dark heatmaps look muddy. */
  const PIVOT = 0.62;
  const RAMP = {
    light: { floor: 0.10, far: "#0b0b0b", reach: 0.26 },
    dark:  { floor: 0.24, far: "#ffffff", reach: 0.55 },
  };

  function cellColor(taskIndex, v) {
    const mode = theme();
    const hue = HUES[mode][taskIndex % HUES[mode].length];
    const cfg = RAMP[mode];
    const t = Math.max(0, Math.min(1, v));
    const bg = t <= PIVOT
      ? mix(hue, SURFACE[mode], cfg.floor + (1 - cfg.floor) * (t / PIVOT))
      : mix(cfg.far, hue, cfg.reach * ((t - PIVOT) / (1 - PIVOT)));
    return { bg, ink: inkFor(bg) };
  }

  const taskHue = i => HUES[theme()][i % HUES[theme()].length];

  function applyTheme(next) {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("rlebench-theme", next); } catch (_) {}
    renderIndexGrid();
    renderScatter();
  }

  try {
    const saved = localStorage.getItem("rlebench-theme");
    if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
  } catch (_) {}

  $("#themeToggle").addEventListener("click", () => applyTheme(theme() === "dark" ? "light" : "dark"));

  /* ── tooltip ----------------------------------------------------------- */

  const tip = $("#tooltip");

  const showTip = (evt, html) => { tip.innerHTML = html; tip.hidden = false; moveTip(evt); };
  function moveTip(evt) {
    const pad = 14, r = tip.getBoundingClientRect();
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + r.width  > window.innerWidth  - 8) x = evt.clientX - r.width  - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top  = Math.max(8, y) + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  function bindTip(node, htmlFn) {
    node.addEventListener("mouseenter", e => showTip(e, htmlFn()));
    node.addEventListener("mousemove", moveTip);
    node.addEventListener("mouseleave", hideTip);
  }

  const whoLine = m => `${m.org} · ${m.harness}`;

  function splitTipHtml(model, task) {
    const vals = splitsFor(task.id, model.id);
    const lines = task.splits.map((s, i) =>
      `<div class="tt-line"><span>${s}</span><b>${fmt(vals[i])}</b></div>`).join("");
    const agg = task.aggregate === "min" ? "minimum across splits" : "mean of splits";
    return `<div class="tt-title">${model.name} · ${task.name}</div>${lines}
            <div class="tt-line" style="margin-top:7px"><span>Family score</span><b>${fmt(taskScore(task.id, model.id))}</b></div>
            <div class="tt-sub">${task.splitLabel} — ${agg}<br>${whoLine(model)}</div>`;
  }

  /* ── hero -------------------------------------------------------------- */

  function renderHero() {
    const variants = BENCH.tasks.reduce((a, t) => a + t.variants, 0);
    const stats = [
      [BENCH.tasks.length, "Task families"],
      [variants, "Harbor tasks"],
      [CONTENDERS.length, "Agents ranked"],
    ];
    const host = $("#heroStats");
    for (const [v, key] of stats) {
      const s = el("div", "stat");
      s.append(el("div", "stat-val", String(v)), el("div", "stat-key", key));
      host.append(s);
    }
    const gh = $("#navGithub"), ax = $("#navArxiv");
    if (BENCH.meta.github) gh.href = BENCH.meta.github;
    else gh.remove();
    if (BENCH.meta.arxiv) {
      ax.href = BENCH.meta.arxiv;
    } else {
      ax.removeAttribute("href");
      ax.classList.add("is-pending");
      ax.title = "Paper not posted yet — set meta.arxiv in data.js";
    }
    const ct = $("#navContact");
    if (BENCH.meta.contact) ct.href = BENCH.meta.contact;
    else ct.remove();

    $("#versionPill").textContent   = BENCH.meta.version;
    $("#footerVersion").textContent = BENCH.meta.version;
    $("#footerUpdated").textContent = "Updated " + BENCH.meta.updated;
    if (BENCH.meta.dataStatus !== "placeholder") $("#dataBanner").remove();
  }

  /* ── the index grid ----------------------------------------------------
     One row per model showing, at once, its score on every family and the
     average across them. Two metrics: `score` averages the eight family
     scores; `rank` averages the model's placement on each family, which is
     insensitive to how far apart the scores happen to sit.                 */

  let metric = "score";

  /* placement on one family, 1 = best, computed over contenders only —
     the Oracle reference is a calibration baseline, not a competitor. */
  const rankIn = {};
  BENCH.tasks.forEach(t => {
    const order = CONTENDERS.slice().sort((a, b) => taskScore(t.id, b.id) - taskScore(t.id, a.id));
    rankIn[t.id] = Object.fromEntries(order.map((m, i) => [m.id, i + 1]));
  });
  const meanRank = id =>
    BENCH.tasks.reduce((a, t) => a + rankIn[t.id][id], 0) / BENCH.tasks.length;

  const BLURB = {
    score: "The headline number: the mean of a model's eight family scores, on a 0–100 scale. " +
           "Every family is weighted equally — a model cannot buy the index with one strong dimension.",
    rank:  "The same eight families, scored by placement instead of magnitude: a model's mean rank " +
           "across them, 1 being best. It asks how often a model wins rather than by how much.",
  };

  function renderIndexGrid() {
    const host = $("#indexGrid");
    if (!host) return;
    host.textContent = "";
    $("#indexBlurb").textContent = BLURB[metric];

    const cols = `38px 230px repeat(${BENCH.tasks.length}, minmax(0, 1fr)) 168px`;
    const byScore = metric === "score";

    /* Scores occupy maybe a third of 0–100, so shading them against the full
       scale wastes most of the ramp. Stretch it over the observed range —
       one transform for every column, so cells stay comparable across them. */
    const seen = [];
    BENCH.tasks.forEach(t => RANKED.forEach(m => seen.push(taskScore(t.id, m.id))));
    const vLo = Math.min(...seen), vHi = Math.max(...seen);
    const norm = v => (vHi > vLo ? (v - vLo) / (vHi - vLo) : 0.5);

    /* the Oracle has no placement, so it sinks to the bottom in rank mode */
    const rows = RANKED.slice().sort((a, b) => {
      if (a.baseline !== b.baseline) return byScore ? b.index - a.index : (a.baseline ? 1 : -1);
      return byScore ? b.index - a.index : meanRank(a.id) - meanRank(b.id);
    });

    const head = el("div", "ig-row is-head");
    head.style.gridTemplateColumns = cols;
    head.append(el("div", "ig-head"), el("div", "ig-head l", "Model / harness"));
    BENCH.tasks.forEach((t, i) => {
      const h = el("div", "ig-head");
      const key = el("span", "task-key", t.num);
      /* the hue tags the column through the rule, not the label — a hue that
         reads as a swatch can be too light to read as text */
      key.style.borderBottomColor = taskHue(i);
      h.append(key);
      h.title = t.name;
      head.append(h);
    });
    head.append(el("div", "ig-head l", byScore ? "RLE Index" : "Mean rank"));
    host.append(head);

    const worstRank = CONTENDERS.length;

    rows.forEach(m => {
      const p = m.baseline ? null : CONTENDERS.findIndex(c => c.id === m.id) + 1;
      const row = el("div", "ig-row is-body" + (byScore && p && p <= 3 ? ` top${p}` : ""));
      row.style.gridTemplateColumns = cols;
      row.style.opacity = m.baseline ? ".72" : "1";

      const shown = m.baseline ? null
        : (byScore ? p : rows.filter(r => !r.baseline).findIndex(r => r.id === m.id) + 1);
      row.append(el("div", "rank" + (shown && shown <= 3 ? " is-top" : ""),
                    shown ? String(shown) : "—"));

      const nm = el("div", "ig-name");
      nm.append(m.name, Object.assign(el("span", "sub"), { textContent: whoLine(m) }));
      row.append(nm);

      BENCH.tasks.forEach((t, i) => {
        const v = taskScore(t.id, m.id);
        const r = m.baseline ? null : rankIn[t.id][m.id];
        /* colour always encodes what the cell prints */
        const shade = byScore ? norm(v)
                              : (worstRank - r) / Math.max(1, worstRank - 1);
        const cell = el("div", "ig-cell");
        if (!byScore && m.baseline) {
          cell.classList.add("is-void");
          cell.textContent = "—";
        } else {
          const { bg, ink } = cellColor(i, shade);
          cell.style.background = bg;
          cell.style.color = ink;
          cell.textContent = byScore ? fmt(v, 0) : "#" + r;
        }
        cell.setAttribute("role", "img");
        cell.setAttribute("aria-label",
          `${m.name}, ${t.name}: ${fmt(v)}${r ? `, rank ${r}` : ""}`);
        bindTip(cell, () => splitTipHtml(m, t));
        row.append(cell);
      });

      const agg = el("div", "ig-agg");
      const track = el("div", "ig-track");
      const fill = el("i", "ig-fill" + (m.baseline ? " is-baseline" : ""));
      const mr = m.baseline ? null : meanRank(m.id);
      fill.style.width = (byScore
        ? m.index / Math.max(...RANKED.map(x => x.index)) * 100
        : (m.baseline ? 0 : (worstRank - mr + 1) / worstRank * 100)).toFixed(2) + "%";
      track.append(fill);
      agg.append(track, el("div", "ig-val",
        byScore ? fmt(m.index) : (mr ? mr.toFixed(2) : "—")));
      row.append(agg);

      bindTip(row, () => {
        const lines = BENCH.tasks.map(t =>
          `<div class="tt-line"><span>${t.num} ${t.short}</span><b>${fmt(taskScore(t.id, m.id))}${
            m.baseline ? "" : `<span style="opacity:.55"> · #${rankIn[t.id][m.id]}</span>`}</b></div>`).join("");
        return `<div class="tt-title">${m.name}</div>${lines}
                <div class="tt-line" style="margin-top:7px"><span>RLE Index</span><b>${fmt(m.index)}</b></div>
                ${mr ? `<div class="tt-line"><span>Mean rank</span><b>${mr.toFixed(2)}</b></div>` : ""}
                <div class="tt-sub">${m.baseline ? "Reference solution — not ranked" : whoLine(m) + " · " + usd(m.cost) + " per suite run"}</div>`;
      });

      host.append(row);
    });

    const legend = el("div", "ig-legend");
    legend.append(el("span", null, byScore ? "Low" : "Last"));
    const ramp = el("div", "ramp");
    for (let k = 0; k <= 5; k++) {
      const i = el("i");
      i.style.background = cellColor(0, k / 5).bg;
      ramp.append(i);
    }
    legend.append(ramp, el("span", null, byScore ? "High" : "First"));
    legend.append(el("span", null, byScore
      ? `· each family column carries its own hue; shading spans the observed range, ${fmt(vLo, 0)}–${fmt(vHi, 0)}, and every cell prints its value`
      : "· each family column carries its own hue; shading runs from last place to first, and every cell prints its placement"));
    host.append(legend);
  }

  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("is-on", b === btn));
      metric = btn.dataset.metric;
      renderIndexGrid();
    });
  });

  /* ── task tabs & view -------------------------------------------------- */

  const fromUrl = () => {
    const h = location.hash.replace("#", "");
    const q = new URLSearchParams(location.search).get("task");
    return taskById[h] ? h : taskById[q] ? q : null;
  };
  let activeTask = fromUrl() || BENCH.tasks[0].id;

  function renderTabs() {
    const host = $("#taskTabs");
    host.textContent = "";
    BENCH.tasks.forEach(t => {
      const b = el("button", "tab" + (t.id === activeTask ? " is-on" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(t.id === activeTask));
      b.title = t.name;
      b.append(el("span", "tab-num", "TASK " + t.num), el("span", "tab-name", t.short));
      b.addEventListener("click", () => selectTask(t.id));
      host.append(b);
    });
  }

  function selectTask(id, push = true) {
    if (!taskById[id] || id === activeTask) return;
    activeTask = id;
    if (push) history.replaceState(null, "", "#" + id);
    renderTabs();
    renderTaskView();
  }

  window.addEventListener("hashchange", () => {
    const id = fromUrl();
    if (id) selectTask(id, false);
  });

  function renderTaskView() {
    const t = taskById[activeTask];
    const host = $("#taskView");
    host.textContent = "";

    /* -- the brief -- */
    const brief = el("aside", "brief");
    brief.append(el("div", "brief-id", "TASK " + t.num),
                 el("h3", null, t.name),
                 el("p", "tagline", t.tagline),
                 el("p", "body", t.description));

    const chips = el("div", "chips");
    const chip = (html, cls) => {
      const c = el("span", "chip" + (cls ? " " + cls : ""));
      c.innerHTML = html;
      return c;
    };
    chips.append(
      chip(`<b>${t.variants}</b> ${t.variants === 1 ? "variant" : "variants"}`),
      chip(`agent <b>${t.agentLimit}</b>`),
      chip(`verifier <b>${t.verifierLimit}</b>`),
      chip(t.gpu ? `GPU <b>${t.gpu === true ? "required" : t.gpu}</b>` : "CPU only", t.gpu ? "gpu" : ""),
    );
    brief.append(chips);

    const w = el("div", "weights");
    w.append(el("div", "weights-head", "Reward composition"));
    t.scoring.forEach(s => {
      const r = el("div", "weight-row");
      r.append(el("span", "wl", s.label), el("span", "wv", s.weight.toFixed(2)));
      const bar = el("div", "weight-bar");
      const fill = el("i");
      fill.style.width = (s.weight * 100) + "%";
      bar.append(fill);
      r.append(bar);
      w.append(r);
    });
    brief.append(w, el("div", "brief-note", t.notes));
    host.append(brief);

    /* -- the ranking -- */
    const results = el("section", "results");

    const ranked = BENCH.models.map(m => ({ ...m, s: taskScore(t.id, m.id) }))
                               .sort((a, b) => b.s - a.s);
    const contenders = ranked.filter(m => !m.baseline);

    const head = el("div", "results-head");
    head.append(el("h4", null, `Ranking — ${t.name}`));
    head.append(el("span", "agg", t.aggregate === "min"
      ? `score = min over ${t.splits.length} ${t.splitLabel.toLowerCase()}s`
      : `score = mean over ${t.splits.length} splits`));
    results.append(head);

    const list = el("div", "srow-list");
    const max = Math.max(...ranked.map(m => m.s));

    ranked.forEach((m, idx) => {
      const p = m.baseline ? null : contenders.findIndex(c => c.id === m.id) + 1;
      const row = el("div", "srow");
      row.style.opacity = m.baseline ? ".72" : "1";
      row.append(el("div", "rank" + (p && p <= 3 ? " is-top" : ""), p ? String(p) : "—"));

      const who = el("div", "who");
      who.append(el("div", "who-name", m.name), el("div", "who-meta", whoLine(m)));
      row.append(who);

      const track = el("div", "track");
      const vals = splitsFor(t.id, m.id);

      if (t.aggregate === "min") {
        /* the score IS one split, so a stack would lie — plain bar, and the
           limiting split is named in the tooltip. */
        const bar = el("div", "bar");
        bar.style.width = (m.s / max * 100).toFixed(2) + "%";
        bar.style.animationDelay = (idx * 40) + "ms";
        track.append(bar);
      } else {
        /* each segment is that split's contribution to the mean, so the
           segments sum to exactly the family score. */
        const stack = el("div", "stack");
        stack.style.width = (m.s / max * 100).toFixed(2) + "%";
        vals.forEach((v, i) => {
          const seg = el("div", "seg-mark");
          seg.style.flex = String(Math.max(v, 0.0001));
          seg.style.background = `var(--cat-${(i % 5) + 1})`;
          seg.style.animationDelay = (idx * 40 + i * 30) + "ms";
          stack.append(seg);
        });
        track.style.background = "transparent";
        track.append(stack);
      }
      row.append(track, el("div", "val", fmt(m.s)));

      bindTip(row, () => {
        const lines = t.splits.map((s, i) =>
          `<div class="tt-line"><span>${s}</span><b>${fmt(vals[i])}</b></div>`).join("");
        const limiting = t.aggregate === "min" ? t.splits[vals.indexOf(Math.min(...vals))] : null;
        return `<div class="tt-title">${m.name} · ${t.name}</div>${lines}
                <div class="tt-line" style="margin-top:7px"><span>Family score</span><b>${fmt(m.s)}</b></div>
                <div class="tt-sub">${limiting ? "Limiting " + t.splitLabel.toLowerCase() + ": " + limiting : t.splitLabel}<br>${whoLine(m)}</div>`;
      });

      list.append(row);
    });
    results.append(list);

    if (t.aggregate !== "min") {
      const legend = el("div", "split-legend");
      t.splits.forEach((s, i) => {
        const span = el("span");
        const sw = el("i");
        sw.style.background = `var(--cat-${(i % 5) + 1})`;
        span.append(sw, document.createTextNode(s));
        legend.append(span);
      });
      legend.append(Object.assign(el("span", "muted"),
        { textContent: "· segment width = that split's contribution to the mean" }));
      results.append(legend);
    }

    /* -- always-available table view of the splits -- */
    const details = el("details", "splits");
    const sum = el("summary", null, `Full split table — ${t.splitLabel.toLowerCase()}`);
    details.append(sum);

    const tw = el("div", "table-wrap");
    tw.style.marginTop = "12px";
    const table = el("table");
    const htr = el("tr");
    htr.append(el("th", "l", "Model"), el("th", "l", "Harness"));
    t.splits.forEach(s => htr.append(el("th", null, s)));
    htr.append(el("th", null, "Score"));
    const thead = el("thead"); thead.append(htr); table.append(thead);

    const tbody = el("tbody");
    ranked.forEach(m => {
      const tr = el("tr", m.baseline ? "is-baseline" : "");
      tr.append(el("td", "l", m.name), el("td", "l", m.harness));
      splitsFor(t.id, m.id).forEach(v => tr.append(el("td", "num", fmt(v))));
      tr.append(el("td", "num lead", fmt(m.s)));
      tbody.append(tr);
    });
    table.append(tbody);
    tw.append(table);
    details.append(tw);
    results.append(details);

    host.append(results);
  }

  /* ── cost: one figure per view, switched by tabs ------------------------
     "overall" plots the RLE Index against the suite bill; a task view plots
     that family's score against that family's share of the bill.           */

  let costView = "overall";

  const costRows = view => {
    const rows = CONTENDERS.map(m => {
      const score = view === "overall" ? m.index : taskScore(view, m.id);
      const cost  = view === "overall" ? m.cost  : taskCost(view, m);
      return { m, score, cost, perPoint: score > 0 ? cost / (score * 100) : Infinity };
    });
    return rows;
  };

  const costMeta = view => view === "overall"
    ? {
        title: "Overall — RLE Index vs. suite cost",
        note: "8 families · every variant",
        sub: "Suite cost is API spend for one complete pass over every family and variant.",
        y: "RLE INDEX", x: "SUITE COST (USD, LOG)", scoreCol: "Index", costCol: "Suite cost",
      }
    : (t => ({
        title: `Task ${t.num} — ${t.name}`,
        note: `${(t.costShare * 100).toFixed(0)}% of suite spend · ${t.variants} ${t.variants === 1 ? "variant" : "variants"}`,
        sub: t.tagline + ".",
        y: "FAMILY SCORE", x: "FAMILY COST (USD, LOG)", scoreCol: "Score", costCol: "Family cost",
      }))(taskById[view]);

  function renderCostTabs() {
    const host = $("#costTabs");
    host.textContent = "";
    const mk = (id, num, name) => {
      const b = el("button", "tab" + (id === costView ? " is-on" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === costView));
      b.append(el("span", "tab-num", num), el("span", "tab-name", name));
      b.addEventListener("click", () => {
        if (costView === id) return;
        costView = id;
        renderCostTabs();
        renderScatter();
        renderCostTable();
      });
      host.append(b);
    };
    mk("overall", "ALL", "RLE Index");
    BENCH.tasks.forEach(t => mk(t.id, "TASK " + t.num, t.short));
  }

  /* nice 1-2-5 decade ticks inside a log domain */
  function logTicks(min, max) {
    const out = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++)
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** e;
        if (v >= min && v <= max) out.push(v);
      }
    return out;
  }

  function renderScatter() {
    const host = $("#scatter");
    if (!host) return;
    host.textContent = "";

    const meta = costMeta(costView);
    const cap = $("#costCaption");
    cap.textContent = "";
    cap.append(el("h4", null, meta.title), el("span", "fig-note", meta.note),
               el("p", "fig-sub", meta.sub));

    const pts = costRows(costView);
    const W = 900, H = 430;
    const M = { t: 30, r: 30, b: 56, l: 58 };

    const costs = pts.map(p => p.cost);
    const xMin = Math.min(...costs) * 0.62;
    const xMax = Math.max(...costs) * 1.62;
    const yMax = Math.max(10, Math.ceil((Math.max(...pts.map(p => p.score * 100)) + 4) / 10) * 10);

    const lx = Math.log10;
    const X = v => M.l + (lx(v) - lx(xMin)) / (lx(xMax) - lx(xMin)) * (W - M.l - M.r);
    const Y = v => H - M.b - v / yMax * (H - M.t - M.b);

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${meta.title}: score against cost, one point per model`);

    const mk = (tag, attrs, cls) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      if (cls) n.setAttribute("class", cls);
      return n;
    };
    const text = (s, attrs, cls) => {
      const n = mk("text", attrs, cls);
      n.textContent = s;
      return n;
    };

    const yStep = yMax <= 20 ? 5 : 10;
    for (let v = 0; v <= yMax; v += yStep) {
      svg.append(mk("line", { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v) }, "sc-grid"));
      svg.append(text(v, { x: M.l - 10, y: Y(v) + 4, "text-anchor": "end" }, "sc-tick"));
    }
    logTicks(xMin, xMax).forEach(v => {
      svg.append(mk("line", { x1: X(v), x2: X(v), y1: M.t, y2: H - M.b }, "sc-grid"));
      svg.append(text(usd(v), { x: X(v), y: H - M.b + 20, "text-anchor": "middle" }, "sc-tick"));
    });

    svg.append(mk("line", { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b }, "sc-axis"));
    svg.append(mk("line", { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b }, "sc-axis"));
    svg.append(text(meta.y, { x: M.l - 44, y: M.t - 10 }, "sc-title"));
    svg.append(text(meta.x, { x: W - M.r, y: H - 12, "text-anchor": "end" }, "sc-title"));

    /* Direct labels on every point; placement is greedy — prefer the right of
       the dot, fall back to the left, then nudge vertically until clear. Every
       dot is an obstacle too, so a label never lands on another mark. */
    const LH = 16, charW = 7.1;
    const at = p => ({ cx: X(p.cost), cy: Y(p.score * 100) });
    const placed = pts.map(p => {
      const { cx, cy } = at(p);
      return { x0: cx - 10, x1: cx + 10, y: cy };
    });

    pts.forEach(p => {
      const { cx, cy } = at(p);
      const dot = mk("circle", { cx, cy, r: 7 }, "sc-dot");
      bindTip(dot, () =>
        `<div class="tt-title">${p.m.name}</div>
         <div class="tt-line"><span>${meta.scoreCol}</span><b>${fmt(p.score)}</b></div>
         <div class="tt-line"><span>${meta.costCol}</span><b>${usd(p.cost)}</b></div>
         <div class="tt-line"><span>Cost per point</span><b>$${p.perPoint.toFixed(2)}</b></div>
         <div class="tt-sub">${whoLine(p.m)}${p.m.open ? " · open weights" : ""}</div>`);
      svg.append(dot);

      const w = p.m.name.length * charW;
      const candidates = [];
      for (let dy = 0; dy <= 3; dy++)
        for (const sign of dy === 0 ? [0] : [-1, 1])
          for (const side of [1, -1]) {
            const x0 = side === 1 ? cx + 12 : cx - 12 - w;
            candidates.push({ side, x0, y: cy + sign * dy * LH, x1: x0 + w });
          }
      const fits = c =>
        c.x0 > M.l + 2 && c.x1 < W - M.r - 2 && c.y > M.t + 8 && c.y < H - M.b - 4 &&
        !placed.some(q => c.x0 < q.x1 + 6 && c.x1 + 6 > q.x0 && Math.abs(c.y - q.y) < LH - 2);
      const spot = candidates.find(fits) || candidates[0];
      placed.push(spot);

      if (spot.y !== cy) {
        const leader = mk("line", {
          x1: cx, y1: cy,
          x2: spot.side === 1 ? spot.x0 - 4 : spot.x1 + 4,
          y2: spot.y - 3,
        }, "sc-grid");
        leader.setAttribute("stroke", "var(--axis)");
        svg.append(leader);
      }
      svg.append(text(p.m.name, {
        x: spot.side === 1 ? spot.x0 : spot.x1,
        y: spot.y + 4,
        "text-anchor": spot.side === 1 ? "start" : "end",
      }, "sc-label"));
    });

    host.append(svg);
  }

  function renderCostTable() {
    const host = $("#costTable");
    host.textContent = "";

    const meta = costMeta(costView);
    const rows = costRows(costView).sort((a, b) => a.perPoint - b.perPoint);
    const bestScore = Math.max(...rows.map(r => r.score));

    const table = el("table");
    const htr = el("tr");
    htr.append(el("th", "l", "Model"), el("th", "l", "Harness"));
    [meta.scoreCol, meta.costCol, "$ / point"].forEach(h => htr.append(el("th", null, h)));
    if (costView === "overall") htr.append(el("th", null, "Median agent time"));
    const thead = el("thead"); thead.append(htr); table.append(thead);

    const tbody = el("tbody");
    rows.forEach(({ m, score, cost, perPoint }, i) => {
      const tr = el("tr");
      const nameTd = el("td", "l");
      nameTd.append(m.name, Object.assign(el("span", "sub"),
        { textContent: m.org + (m.open ? " · open weights" : "") }));
      tr.append(nameTd, el("td", "l", m.harness),
                el("td", "num" + (score === bestScore ? " lead" : ""), fmt(score)),
                el("td", "num", usd(cost)),
                el("td", "num" + (i === 0 ? " lead" : ""),
                   Number.isFinite(perPoint) ? "$" + perPoint.toFixed(2) : "—"));
      if (costView === "overall") tr.append(el("td", "num", m.hours.toFixed(1) + " h"));
      if (costView !== "overall") bindTip(tr, () => splitTipHtml(m, taskById[costView]));
      tbody.append(tr);
    });
    table.append(tbody);
    host.append(table);
    host.append(Object.assign(el("p", "table-note"), {
      textContent: costView === "overall"
        ? "Sorted by cost per index point — lower is better value. The Oracle reference is excluded: it consumes no API spend."
        : `Sorted by cost per point of ${taskById[costView].short} score. Family cost is that model's suite spend × this family's ${(taskById[costView].costShare * 100).toFixed(0)}% share.`,
    }));
  }

  /* ── boot -------------------------------------------------------------- */

  renderHero();
  renderIndexGrid();
  renderTabs();
  renderTaskView();
  renderCostTabs();
  renderScatter();
  renderCostTable();

  window.addEventListener("resize", hideTip);
})();
