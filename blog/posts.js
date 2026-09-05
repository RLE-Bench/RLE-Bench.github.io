/* ---------------------------------------------------------------------------
 * RLE-Bench blog — the post index
 *
 * One entry per file in blog/. Newest first; `blog.js` renders the index from
 * this array and derives prev/next links on each post page from the same order,
 * so adding a post means writing one HTML file and adding one entry here.
 *
 * `slug` must match the post file's `data-slug` attribute on <body>.
 * ------------------------------------------------------------------------- */

const POSTS = [
  {
    slug: "introducing-rle-bench",
    file: "introducing-rle-bench.html",
    title: "Introducing RLE-Bench",
    kicker: "Release · v1.0-dev",
    date: "2026-09-05",
    readingTime: "8 min",
    tags: ["release", "eight families", "rle index", "roadmap"],
    summary:
      "A qualifying exam for coding agents working as robot learning engineers: eight families of real engineering work, sixty-four tasks, each graded by a verifier the agent never sees. What ships today, how it is scored, what is deliberately still missing, and what comes next.",
  },
];

if (typeof module !== "undefined") module.exports = POSTS;
