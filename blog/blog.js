/* ===========================================================================
   RLE-Bench blog — shared behaviour
   Same rules as app.js: vanilla ES2020, no dependencies, no network. Reads
   BENCH.meta (data.js) for the header links and POSTS (posts.js) for the index
   and the prev/next rail. Every post page renders fine with this file removed —
   only the theme toggle, the contents rail and the footer meta need it.
   =========================================================================== */

(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  /* ── theme: the same key the leaderboard writes, so a reader who picked
        light on the front page stays in light here ------------------------- */

  const theme = () => document.documentElement.getAttribute("data-theme") || "dark";

  try {
    const saved = localStorage.getItem("rlebench-theme");
    if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
  } catch (_) {}

  const toggle = $("#themeToggle");
  if (toggle) toggle.addEventListener("click", () => {
    const next = theme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("rlebench-theme", next); } catch (_) {}
  });

  /* ── header & footer meta, from data.js ------------------------------- */

  if (typeof BENCH !== "undefined") {
    const gh = $("#navGithub"), ax = $("#navArxiv"), ct = $("#navContact");
    if (gh) { if (BENCH.meta.github) gh.href = BENCH.meta.github; else gh.remove(); }
    if (ax) {
      if (BENCH.meta.arxiv) {
        ax.href = BENCH.meta.arxiv;
      } else {
        ax.removeAttribute("href");
        ax.classList.add("is-pending");
        ax.title = "Paper not posted yet — set meta.arxiv in data.js";
      }
    }
    if (ct) { if (BENCH.meta.contact) ct.href = BENCH.meta.contact; else ct.remove(); }

    const v = $("#versionPill"), fv = $("#footerVersion"), fu = $("#footerUpdated");
    if (v)  v.textContent  = BENCH.meta.version;
    if (fv) fv.textContent = BENCH.meta.version;
    if (fu) fu.textContent = "Updated " + BENCH.meta.updated;
  }

  /* ── dates: written once, formatted everywhere ------------------------- */

  const longDate = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  };

  /* ── the index ---------------------------------------------------------- */

  const list = $("#postList");
  if (list && typeof POSTS !== "undefined") {
    list.textContent = "";
    POSTS.forEach((p, i) => {
      const card = el("a", "postcard");
      card.href = p.file;

      const rail = el("div", "postcard-rail");
      /* newest post carries the highest number, so the count reads as a series */
      rail.append(el("div", "postcard-num", String(POSTS.length - i).padStart(2, "0")),
                  el("div", "postcard-date", longDate(p.date)),
                  el("div", "postcard-date", p.readingTime));

      const body = el("div", "postcard-main");
      body.append(el("div", "postcard-kicker", p.kicker),
                  el("h2", "postcard-title", p.title),
                  el("p", "postcard-sum", p.summary));
      const tags = el("div", "tagrow");
      p.tags.forEach(t => tags.append(el("span", "tag", t)));
      body.append(tags);

      card.append(rail, body);
      list.append(card);
    });
  }

  /* ── post pages --------------------------------------------------------- */

  const slug = document.body.dataset.slug;
  if (!slug) return;

  /* byline: one source of truth for the date and the reading time */
  const post = typeof POSTS !== "undefined" ? POSTS.find(p => p.slug === slug) : null;
  const byline = $("#postByline");
  if (post && byline) {
    byline.textContent = "";
    [longDate(post.date), post.readingTime + " read", "RLE-Bench team"]
      .forEach(s => byline.append(el("span", null, s)));
  }

  /* contents: numbered from the h2s already in the article, so the rail can
     never drift from the headings it points at */
  const body = $(".post-body");
  const toc  = $("#toc");
  const heads = body ? $$("h2", body) : [];

  if (toc && heads.length) {
    const ol = el("ol");
    heads.forEach((h, i) => {
      const n = String(i + 1).padStart(2, "0");
      if (!h.id) h.id = "s" + n;
      h.prepend(el("span", "h-num", "§ " + n));

      const li = el("li");
      const a = el("a", null, h.textContent.replace(/^§\s*\d+\s*/, ""));
      a.href = "#" + h.id;
      li.append(a);
      ol.append(li);
    });
    toc.append(ol);

    /* highlight the heading the reader is actually in — progressive, since the
       rail is perfectly usable without it */
    if ("IntersectionObserver" in window) {
      const links = $$("a", ol);
      const spy = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          const i = heads.indexOf(e.target);
          links.forEach((a, k) => a.classList.toggle("is-here", k === i));
        });
      }, { rootMargin: "-90px 0px -70% 0px" });
      heads.forEach(h => spy.observe(h));
    }
  }

  /* prev / next, taken from the same order the index uses */
  const nav = $("#postNav");
  if (nav && post && typeof POSTS !== "undefined") {
    const i = POSTS.indexOf(post);
    const mk = (p, key, cls) => {
      const a = el("a", "pn " + cls + (p ? "" : " is-empty"));
      a.href = p ? p.file : "#";
      if (!p) a.setAttribute("aria-hidden", "true");
      a.append(el("span", "pn-key", key),
               el("span", "pn-title", p ? p.title : "—"));
      return a;
    };
    nav.append(mk(POSTS[i + 1], "Older", "is-prev"),
               mk(POSTS[i - 1], "Newer", "is-next"));
  }

  /* reading progress across the article only, not the whole document */
  const bar = $("#progress");
  if (bar && body) {
    const tick = () => {
      const r = body.getBoundingClientRect();
      const run = r.height - window.innerHeight + 160;
      const done = run > 0 ? Math.min(1, Math.max(0, (160 - r.top) / run)) : 0;
      bar.style.width = (done * 100).toFixed(2) + "%";
    };
    tick();
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", tick);
  }
})();
