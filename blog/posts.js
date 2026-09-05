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
    slug: "announcing-rle-bench",
    file: "announcing-rle-bench.html",
    title: "Announcing RLE-Bench",
    kicker: "Release · v1.0-dev",
    date: "2026-09-05",
    readingTime: "8 min",
    tags: ["release", "eight families", "rle index", "roadmap"],
    summary:
      "A qualifying exam for coding agents working as robot learning engineers: eight families of real engineering work, sixty-four tasks, each graded by a verifier the agent never sees. What ships today, how it is scored, what is deliberately still missing, and what comes next.",
  },
  {
    slug: "notes-from-construction",
    file: "notes-from-construction.html",
    title: "Notes from construction",
    kicker: "Findings",
    date: "2026-09-02",
    readingTime: "11 min",
    tags: ["harness levels", "calibration", "task07", "difficulty floor"],
    summary:
      "What eight months of building the suite actually taught us: that the harness is the more interesting variable, that a benchmark needs a floor nobody has cleared, that retiring a task is cheaper than renumbering one, and that honest calibration means shipping a flag that says the thresholds are not calibrated yet.",
  },
  {
    slug: "the-verifier-is-the-benchmark",
    file: "the-verifier-is-the-benchmark.html",
    title: "The verifier is the benchmark",
    kicker: "Design",
    date: "2026-08-25",
    readingTime: "9 min",
    tags: ["verifiers", "adversarial input", "aggregation", "reward design"],
    summary:
      "Every family is graded by a program the agent never sees, holding data the agent cannot reach. Why the submission is treated as untrusted input, why task01 reduces by minimum instead of mean, and why an unsealed interaction ledger scores exactly zero.",
  },
  {
    slug: "qualifying-exam-not-puzzle-set",
    file: "qualifying-exam-not-puzzle-set.html",
    title: "A qualifying exam, not a puzzle set",
    kicker: "Design",
    date: "2026-08-14",
    readingTime: "10 min",
    tags: ["scope", "task selection", "the index", "eight families"],
    summary:
      "The brief we wrote for ourselves: eight families of work a robot learning engineer actually does, each a deliverable rather than a riddle. What made a candidate task survive the cut, and why the index is an unweighted mean of eight independent leaderboards.",
  },
];

if (typeof module !== "undefined") module.exports = POSTS;
