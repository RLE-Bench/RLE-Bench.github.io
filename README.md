# RLE-Bench website

A static, dependency-free leaderboard site for the RLE-Bench robotics
engineering benchmark (`~/Codes/RLE-Bench-dev`). No build step, no network
calls — open `index.html` or serve the folder.

```bash
python3 scripts/serve.py --port 8000   # then http://127.0.0.1:8000
```

The preview server supports HTTP byte ranges, which browsers need for video
seeking. Plain `python3 -m http.server` may report a zero-length seekable range
even after a clip has downloaded. GitHub Pages already supports range requests.

## Files

| file | what it holds |
|---|---|
| `index.html` | page structure only — every number is rendered by `app.js` |
| `styles.css` | shared base design tokens and styles |
| `homepage.css` | the polished v3 homepage layout, themes, and responsive overrides |
| `app.js` | scoring, the index, the charts, tabs, tooltips |
| `data.js` | current task descriptions and display numbering, plus the retained development result snapshot |
| `blog/` | the research article, served directly at `/blog/` |
| `assets/` | the project icon — favicon, apple-touch icon, header and hero mark |

The homepage preserves the existing visual layout and numerical development
snapshot. Its task descriptions and T01–T09 display numbering follow the
research article. The Blog remains self-contained and unchanged.

The task catalog contains nine tasks; the retained result snapshot contains
eight. nanoVLA recipe engineering has no reported scores or costs. The current
physical-reasoning description covers six problems, while the retained sample
scores cover five scenarios. These coverage differences are stated in the UI.

## Updating results

`data.js` is the single source of truth:

- `presentation` — task order and public T01–T09 numbers, independent of legacy result IDs. `snapshotTaskIds` explicitly lists the eight tasks included in the unchanged snapshot mean.
- `meta` — version string, updated date, header links (`github`, `arxiv`,
  `contact`), and `dataStatus`. An empty `arxiv` renders the nav item greyed
  out rather than pointing nowhere; an empty `contact` or `github` drops that
  item entirely. `contact` accepts a `mailto:` just as happily as a URL.
  `dataStatus` controls the source-status labels in charts and exports. The
  removed top-of-page banner is not restored.
- `models` — one entry per evaluated agent, including the `harness` it was
  driven with (the scaffold, e.g. Claude Code or Codex CLI) — shown under the
  model name everywhere and as its own table column. `baseline: true` keeps a
  reference record out of the homepage rankings and cost comparison.
- `scores[taskId][modelId]` — an array of per-split scores in `[0, 1]`, aligned
  positionally with that task's `splits` array.

**The scores currently in the file are placeholders.** They exist so the page
renders; replace them with real `reward.json` aggregates before this goes
anywhere public.

The retained per-task snapshot scores aggregate their original splits:

- `aggregate: "mean"` — the unweighted mean of the original split values.
- `aggregate: "min"` — the minimum for the mobile-base result record.

The homepage retains the **RLE Index** section title. Its displayed snapshot
metric is the unweighted mean over `presentation.snapshotTaskIds`, reported on
a 0–100 scale. The explanatory text distinguishes this existing eight-task
development metric from the manuscript RLE Index, which averages four
capability families equally. The task catalog is titled **Task breakdown**. Adding an unreported task to the catalog does not add a zero to the
snapshot mean. Existing values, model records, and cost allocations are retained.

Task API cost is `model.cost × task.costShare`. These are fixed allocations of
the older snapshot's API bill, not independently metered task costs. A null
cost share, as for nanoVLA, means unreported rather than free.

## Task metadata

`description`, `development`, `compute`, `evaluation`, and `notes` follow the
visible research article. Legacy numeric reward weights and verifier budgets
are omitted because the article does not establish them as current. The
snapshot's `splits`, `aggregate`, and `costShare` retain their original meaning.

| Public task | Current task | Legacy result ID |
|---|---|---|
| T01 | Agentic control | `task03` |
| T02 | Harness engineering | `task04` |
| T03 | Physical reasoning | `task08` |
| T04 | Whole-body motion tracking | `task09` |
| T05 | nanoVLA recipe engineering | `nanovla` (unreported) |
| T06 | Universal mobile-manipulator base | `task01` |
| T07 | Lead arm gravity compensation design | `task02` |
| T08 | Blind pose estimation | `task05` |
| T09 | Contact-rich bin clearing | `task06` |

The original result IDs remain stable for existing deep links. Public numbering
is resolved through `presentation.taskNumbers` everywhere in the interface.

## The index grid

The RLE Index section is one grid: every family score and the average, on the
same row. The segmented control switches the metric:

- **By score** — the average of the eight family scores, 0–100.
- **By task rank** — the model's mean placement across the eight families,
  1 being best. Placements are computed over contenders only, so the Oracle
  reference (a calibration baseline, not a competitor) shows dashes and sorts
  to the bottom in this mode.

Each family column carries its own hue from the categorical palette, in fixed
slot order; the shade within a column encodes the value and the number is
printed in every cell, so colour is never the only channel. Cell ink is chosen
per cell by measured contrast rather than a lightness guess.

Two details make the shading read:

- **A two-segment ramp per hue.** Below a pivot the hue washes toward the chart
  surface; above it, it keeps going the other way — deeper on light, paler on
  dark. Mixing a hue straight into near-black, the naive dark ramp, is what
  makes dark heatmaps look muddy.
- **Shading spans the observed range, not 0–100.** Real scores occupy maybe a
  third of the scale, so the ramp is stretched over the values actually
  present. One transform is used for every column, so cells stay comparable
  across families; the legend prints the range it covers.

## The blog

Both **Blog** in the navigation and **Read the blog** on the homepage link
straight to the complete research article at `/blog/`. There is no post list
or second click. The article is adapted from `RLE-Bench-blog-polished.html`,
with its text, layout, figures, results, and interactive behavior preserved.

| file | what it holds |
|---|---|
| `blog/index.html` | the full article, including its styles, publication metadata, results data, and progressive enhancements |
| `blog/introducing-rle-bench.html` | compatibility redirect to `/blog/`, preserving query strings and section anchors when JavaScript is enabled |
| `assets/blog/` | images, the results CSV, and the original harness-comparison PDF extracted from the supplied HTML |

The article shares the `rlebench-theme` preference with the leaderboard.
Its contents navigation, capability chart, expandable task details, image
zoom dialog, and CSV/PDF downloads work from the direct Blog entrypoint.
The source HTML's embedded assets are stored as ordinary files so images
can be cached and downloads can be linked directly. Canonical and sharing
metadata identify `/blog/`; the sharing image uses the included RoboCasa
figure. The article's links back to the leaderboard are relative so they
also work in a local preview.

To update this page, edit `blog/index.html` and its supporting assets. If you maintain a local `blog/introducing-rle-bench.edit.md`, manually keep its article prose, headings, figure captions, and video descriptions synchronized with the page. This draft and `idea.md` are local editorial notes excluded from Git; preserve any source comments and editorial notes locally. The
homepage's placeholder leaderboard data remains managed in `data.js`;
this article carries the provided manuscript's separate results and
coverage notes.

### Curated task demos

The article embeds four complete, silent simulation recordings and a three-image
GELLO design study from the September 9 demo snapshot:

| Location | Selected media | Source |
|---|---|---|
| Interactive control / T03 | Hidden-center-of-mass interaction, 36.6 s | GPT-5.6 Sol, v0.8.0, evaluation recording |
| Policy learning / T04 | Fall-and-get-up motion, 20 s | GPT-6 Astra, v1.0.0, evaluation recording |
| Embodiment / T07 | Franka, UR5e, and xArm7 GELLO assemblies | GPT-6 Astra, v1.1.2, development artifacts |
| Perception / T08 | Method-agnostic pose estimation, 6 s | Gemini 3.7 Flash High, v1.3.0, evaluation recording |
| Development and evaluation / T09 | Camera views and force feedback, 29.5 s | GPT-6 Astra, v1.0.1, development preview |

`blog/demos.css` extends the article's family colors, type, and figure styling.
`blog/demos.js` progressively enhances the videos with a compact translucent play
strip in the corner of the poster and a theme-aware control bar below the image: play/pause, a thin seek
slider, elapsed/total time, fullscreen, and an icon-only download link. The
controls support keyboard seeking, replay, loading/error states, and seeking
before metadata arrives. Pointer dragging pauses playback and previews the
chosen time without the playhead moving the thumb; releasing commits the seek
and resumes only if the clip was already playing. Only one demo plays at a time, and switching tabs
pauses playback. The original native controls remain the no-JavaScript fallback.
Videos retain inline mobile playback, explicit poster dimensions, and
`preload="none"`; they never autoplay. Posters are frames from the actual
recordings and are also used for printing. Short captions separate the visual
description from secondary notes about evaluation scope.

The videos retain the source resolution, frame rate, complete timeline, and
encoded video packets, with MP4 metadata moved to the front for streaming.
GELLO images use lossless WebP. The selected media total approximately 5.24 MB;
the original 3.3 GB archive, logs, and unselected material are not published.
`assets/blog/demos/sources.json` records source archive paths, task versions,
models, hashes, and poster timestamps. These individual examples do not update
or stand in for the manuscript's aggregate results; development material is
labeled separately from evaluation recordings.

## Design notes

- Data colours come from a validated categorical palette and a single-hue blue
  sequential ramp; both were checked for CVD separation and surface contrast in
  light and dark mode.
- Prose is set in a serif; every number, axis tick and micro-label stays in a
  monospace so columns line up.
- Stacked bars on a task ranking show each split's *contribution to the mean*,
  so the segments sum to exactly the family score. Task01 uses a plain bar
  instead, because a minimum cannot honestly be stacked.
- `#task03` (or `?task=task03`) deep-links straight to a family's ranking.
- Scatter labels are placed greedily around every point and avoid both other
  labels and other dots, with a leader line when a label has to move.
- The theme toggle persists in `localStorage`; the page defaults to dark.
- The icon in `assets/` is generated from `icon.jpg` with `sips`: a 512px
  `icon.png` (header, hero, large favicon), a 180px `apple-touch-icon.png` and
  a 64px `favicon-64.png`. It sits on a white tile so its own white background
  reads as deliberate in dark mode. Replace all three to change the mark.


## Updating the T01 interface chart

Edit `assets/blog/harness-comparison.json` to update the native success/cost chart.
Each entry in `models` has a `name`, `success_rate`, and `cost_usd`; both metrics
contain `L1`, `L2`, and `L3` values. Success rates use **0–1**, costs use **USD**,
and **null means not reported**, not zero. Models appear in JSON order; adding
or removing a model adjusts the chart automatically. Keep names unique.

Success rates and costs are transcribed from the supplied T01 table screenshots
(rows L1, L2, L3, with matching model columns). Kimi K3 and DeepSeek are excluded.
Gemini's blank costs remain null. Update the JSON `source` note when replacing data.

`blog/harness-chart.js` fetches the JSON on page load without a build step. Refresh
an HTTP preview after editing (for example, `python3 -m http.server 8000` then
`http://localhost:8000/blog/`). Opening the HTML with `file://` may block JSON
loading; the chart then falls back to the original image. Publish the JSON with
the page for online updates. Its two SVG panels animate once as they enter view,
respect reduced-motion settings, and show exact values on hover or keyboard focus.
Update matching narrative claims in both HTML and Markdown if the results change.


## T04 development timeline

`blog/hillclimb.js` and `blog/hillclimb.css` render the native SVG timeline from
`assets/blog/t04-hillclimb.json`. The view separates evaluation cohorts, shows
the complete four-hour run, and lets readers select chart markers to view
source timestamps and excerpts. Curves have distinct colors and shading to the
visible axis baseline. Scores are displayed out of 100. A marked axis break separates the 60–95 main
range from a compressed 0–60 region containing the early scores. Unscored failures are shown in a separate event
strip. The no-JavaScript fallback preserves the summary. Hovering over a marker
updates its explanation. The Final policy link opens a video dialog showing
the original sprint recording from 00:07 to 00:20 (13 seconds).

Regenerate the curated data with `python3 scripts/extract_t04_timeline.py /path/to/harbor/trial`. This exports selected status reports from
`agent/trajectory.json`; it is not an exhaustive checkpoint parser. Scores are
rounded as reported, and timestamps indicate when the report was logged. The
final metric is cross-checked against `artifacts/logs/artifacts/selection.json`.
The downloaded Harbor trial remains local and is excluded from Git.
