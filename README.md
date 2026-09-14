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
| `app.js` | the homepage index, charts, tabs, and tooltips |
| `leaderboard.js` | shared JSON loading, task scores, workflow means, and RLE Index calculations |
| `blog/results.js` | JSON-backed blog leaderboards, family charts, and inline scores |
| `data.js` | current task descriptions, display numbering, and header metadata |
| `assets/data/leaderboard.json` | generated: evaluated model/harness combinations with per-task, per-split and per-subtask results and costs |
| `assets/data/export.py` | builds `leaderboard.json` from the per-task run dumps `assets/data/taskNN.json` |
| `run/` | README-based benchmark setup and execution guide at `/run/` |
| `contribute/` | task contribution criteria, template download, and preparation guide at `/contribute/` |
| `submission-service/` | separate Cloudflare Worker for GitHub sign-in, private ZIP uploads, and reviewer feedback; see its README for setup and deployment |
| `blog/` | the research article, served directly at `/blog/` |
| `assets/` | the project icon — favicon, apple-touch icon, header and hero mark — plus `data/` for leaderboard results |

The homepage preserves the existing visual layout. Its task descriptions and
Task 01–09 display numbering follow the research article; its numbers come
from the generated leaderboard JSON. The blog leaderboards, family charts,
inline scores, and T01 interface-comparison figure read the same JSON. Both pages share the task catalog and scoring logic;
new model/harness combinations appear automatically on reload. Task-specific
case studies remain descriptions of the manuscript runs.

The task catalog contains nine tasks; the leaderboard JSON reports the ones
whose run dumps are present in `assets/data/` (currently all nine tasks). Tasks
without a dump show as unreported rather than as zero, and the index averages
only reported tasks. These coverage differences are stated in
the UI.

## Updating results

`data.js` holds the task catalog and page metadata; `assets/data/leaderboard.json`
holds the evaluated agents and their results. `leaderboard.js` fetches the JSON on page
load and merges it into `BENCH` before rendering, so both pages must be served
over HTTP (for example `python3 -m http.server 8000`) rather than opened via
`file://`.

In `data.js`:

- `presentation` — task order and public T01–T09 numbers (task IDs equal the public numbers). `snapshotTaskIds` lists the tasks eligible for the index; `app.js` intersects it with the tasks reported in the leaderboard JSON. `workflows` defines the two-level task breakdown: each workflow (interactive control, policy development, perception and estimation, mechanical design) lists the task IDs it groups, in display order; any task left out lands in a trailing "Other tasks" group. The homepage shows the workflows as a first tab row and only the selected workflow's tasks as a second row; deep links such as `?task=task04` select the matching workflow automatically.
- `meta` — version string, updated date, header links (`github`, `arxiv`,
  `contact`), and `dataStatus`. An empty `arxiv` renders the nav item greyed
  out rather than pointing nowhere; an empty `contact` or `github` drops that
  item entirely. `contact` accepts a `mailto:` just as happily as a URL.
  `dataStatus` controls the source-status labels in charts and exports. The
  removed top-of-page banner is not restored.

`assets/data/leaderboard.json` is **generated** — do not edit it by hand. Drop
the per-task run dump for a public task into `assets/data/taskNN.json` (`NN` is
the public number: `task01.json` is T01 Agentic Control, `task02.json` T02
Harness Engineering, `task04.json` T04 Whole-Body Motion Tracking,
`task05.json` T05 NanoVLA Recipe, `task08.json` T08 Mobile Base Design,
`task07.json` T07 Bin Clearing) and rebuild:

```
python3 assets/data/export.py            # rebuild assets/data/leaderboard.json
python3 assets/data/export.py --check    # exit 1 if the JSON is stale (CI)
python3 assets/data/export.py --help     # --compact, --allow-partial, --completed-only, --keep-oracle, --dedupe
```

Each dump is `{"schema_version": 1, "root": ..., "runs": [...]}` with one run
per model × subtask. The T01 and T02 `_part2.json` supplements have already been
concatenated into their respective `taskNN.json` files; do not append them again.
The T05 supplement's 20 new runs have also been appended to `task05.json`, skipping
its 32 existing evaluations with renamed job paths. The exporter recognizes both
the legacy track slugs and the new `task1`–`task4` paths.
`export.py` excludes Grok, Fable, K3 and Gemini 3.8 Flash runs from every task's
public results while preserving them in the source dumps. Oracle runs are also
excluded by default. DeepSeek and the other existing models remain
visible. This policy applies to both the homepage and blog through the generated JSON.
`export.py` maps the raw `model` string onto a stable id
(`MODELS`), the `agent` string onto a harness name, and the `job` path onto the
task's subtask catalog (`TASKS`); it groups subtasks into the splits shown on
the site (harness level, difficulty band, motion clip, scoring stage) and
writes:

- `models` — one entry per evaluated model/harness combination: `id`, `name`,
  `short` (plot label), `org`, `open`, `harness`, and `tasks` (the task ids with
  a reported score). Ordered by mean task score.
- `tasks[taskId]` — the public number, split catalog (`splits[].id/label`, and
  the `subtasks` each split averages, or the verifier `metric` and `weight` it
  reads), the subtask catalog, `aggregate`, `splitLabel`, and `weights` for
  weighted tasks. `app.js` overrides the `data.js` catalog with this.
- `scores[taskId][modelId]` — per-split scores in `[0, 1]`, aligned with
  `tasks[taskId].splits`. `null` where a split has no complete result.
- `results[taskId][modelId]` — `score` (the task score: mean verifier reward
  over the task's subtasks), `complete`, `missing`, per-split detail (`score`,
  `reward`, `success_rate`, `cost_usd`, `cost_usd_mean`, `hours_median`), and
  per-subtask detail (`reward`, `success_rate`, `cost_usd`, `cost_source`,
  `hours`, `status`, tokens, `job`, and the raw verifier `metrics` unless
  `--compact`).
- `costs[taskId][modelId]` — per-subtask means over the task's runs: `cost`
  (mean API cost in USD), `hours` (mean agent wall-clock hours) and
  `context_tokens` (mean of `input_tokens - cached_tokens` per run, the cost
  table's Context Length column). The totals sit alongside them as `cost_total`,
  `hours_total`, `hours_median` and `input_tokens` / `cached_tokens` /
  `output_tokens`; `cost_sources` says where the cost came from. Missing cost or
  token counts stay `null` rather than becoming zero. The homepage's overall
  figures average these per-task means within each workflow, then across
  workflows.
- `status` — `"measured"`; `app.js` copies it into `meta.dataStatus`, which
  drives the illustrative/measured labels.

### API cost and `assets/data/price/`

A run's `cost_usd` in the dump is whatever its harness billed, and a harness
that cannot identify the model bills it against the wrong price sheet — Claude
Code does this with `glm-5.3-flash`, charging Anthropic rates and overstating
the cost by more than 10x. So for every model priced in `assets/data/price/`,
`export.py` ignores the dump's `cost_usd` and recomputes the cost from the run's
token counts:

```
cost = ((n_input_tokens - n_cache_tokens) * input
        + n_cache_tokens * cached_input
        + n_output_tokens * output) / 1e6
```

Models with no file there keep the cost from their dump. `cost_source` on each
run (and `cost_sources` on each `costs` entry) says which applies: `"harness"`,
`"price/<file>:<rate>"`, or `"unpriced"` when a priced model's dump has no token
counts and the cost had to be dropped. `source.prices` in `leaderboard.json`
records the rates that were applied. See `assets/data/price/README.md` for the
file format and how to switch the rate in force.

Task ids equal the public task numbers in the table below (`task01` = T01);
`tasks[taskId].public` carries the public number. A model/task pair with a
missing subtask run gets no score unless `--allow-partial` is passed; a run
whose `status` is not `completed` is kept if it reports a reward (the export
warns) unless `--completed-only` is passed; when a model has several runs for
one subtask the latest `finished_at` wins (`--dedupe best|first` to change).
Oracle runs (an `agent`, `model` or `job` string containing `oracle`) are
reference solutions, not submissions, and are dropped unless `--keep-oracle`
is passed; the export reports how many it dropped.

The blog's T01 interface-comparison figure reads the same file
(`blog/harness-chart.js`, `data-task="task01"`): per-level score is the mean
reward over the five kitchen tasks and per-level cost the mean API cost per
run. `assets/blog/harness-comparison.json` is the earlier transcription of the
manuscript figure and is no longer referenced.

How per-task split values combine on the homepage:

- `aggregate: "mean"` — the unweighted mean of the split values.
- `aggregate: "min"` — the minimum across splits.
- `aggregate: "weighted"` — split values are stage credit divided by the stage
  weight; the reported task score is the verifier reward itself, so a failed
  gate (which caps the mobile-base reward at 0.15) is respected.

Whenever the export reports a task score, the homepage uses it directly and
only falls back to aggregating splits for files that lack `results`.

The homepage retains the **RLE Index** section title. Its displayed metric
averages task scores within each workflow and then across workflows, over the
tasks in `presentation.snapshotTaskIds`, on a 0–100 scale. `leaderboard.js` narrows
that list at load time to the tasks the export actually reports, so a task
without a dump is neither a zero nor a column of numbers; a model that lacks a
score for any reported task receives no overall index or rank. The research
overview uses the same current workflow means and RLE Index.
Incomplete model/workflow combinations show a dash, and a model missing any
reported task has no overall index. Load failures show an unavailable message
instead of older manuscript numbers. The task catalog is titled **Task breakdown**.

Per-task API cost, agent hours, and prompt tokens live in
`costs[taskId][modelId]` in the leaderboard JSON. The Performance and Cost
section averages each of them within a workflow and then across workflows, the
same aggregation the RLE Index uses; a task with no cost record is unreported
rather than free.

Run `node --test scripts/test-leaderboard.cjs` to check the shared scoring,
task coverage, new models, and JSON loading behavior.

## Task metadata

`tagline`, `description`, `development`, `compute`, and `evaluation` follow the
visible research article. Legacy numeric reward weights and verifier budgets
are omitted because the article does not establish them as current. Each
task's `splits` and `aggregate` in `data.js` are fallbacks; the exported
`tasks[taskId]` catalog in the leaderboard JSON overrides them at load time.

| Public task | Current task | Task ID |
|---|---|---|
| T01 | Agentic Control | `task01` |
| T02 | Harness Engineering | `task02` |
| T03 | Embodied Reasoning | `task03` |
| T04 | Whole-Body Motion Tracking | `task04` |
| T05 | NanoVLA Recipe | `task05` |
| T06 | Pose Estimation | `task06` |
| T07 | Bin Clearing | `task07` |
| T08 | Mobile Base Design | `task08` |
| T09 | Gravity Compensation for Gello | `task09` |

Task IDs match the public numbers, so deep links such as `?task=task08` name
the public task directly. `presentation.taskNumbers` is now an identity map.

Task numbering is T06 Pose Estimation, T07 Bin Clearing, T08 Mobile Base Design,
and T09 Gravity Compensation for Gello. Dump filenames and their `root` fields
use these public IDs; job names inside the dumps, blog source paths, and
existing media filenames (for example `task09-1080p50-10x.mp4`, the T07 clip)
retain their historical IDs for provenance.

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
homepage's leaderboard data is generated into `assets/data/leaderboard.json` by
`assets/data/export.py`; apart from the T01 interface-comparison figure, which
reads that file, this article carries the provided manuscript's separate
results and coverage notes.

### Curated task demos

The article embeds four complete, silent simulation recordings and a three-image
GELLO design study from the September 9 demo snapshot:

| Location | Selected media | Source |
|---|---|---|
| Interactive control / T03 | Hidden-center-of-mass interaction, 36.6 s | GPT-5.6 Sol, v0.8.0, evaluation recording |
| Policy learning / T04 | Fall-and-get-up motion, 20 s | GPT-6 Astra, v1.0.0, evaluation recording |
| Embodiment / T09 | Franka, UR5e, and xArm7 GELLO assemblies | GPT-6 Astra, v1.1.2, development artifacts |
| Perception / T06 | Method-agnostic pose estimation, 6 s | Gemini 3.7 Flash High, v1.3.0, evaluation recording |
| Development and evaluation / T07 | Camera views and force feedback, 29.5 s | GPT-6 Astra, v1.0.1, development preview |

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
  so the segments sum to exactly the family score. Task06 uses a plain bar
  instead, because a minimum cannot honestly be stacked.
- `#task01` (or `?task=task01`) deep-links straight to a family's ranking.
- Scatter labels are placed greedily around every point and avoid both other
  labels and other dots, with a leader line when a label has to move.
- The theme toggle persists in `localStorage`; the page defaults to dark.
- The icon in `assets/` is generated from `icon.jpg` with `sips`: a 512px
  `icon.png` (header, hero, large favicon), a 180px `apple-touch-icon.png` and
  a 64px `favicon-64.png`. It sits on a white tile so its own white background
  reads as deliberate in dark mode. Replace all three to change the mark.


## Updating the T01 interface chart

The blog's native T01 success/cost chart (`blog/harness-chart.js`) reads
`assets/data/leaderboard.json`, the same export the leaderboards use, so
regenerating that file with `assets/data/export.py` updates the chart as well.
The figure's `data-task` attribute names the task (`task01`); each level's
success value is the split score (mean verifier reward over the five kitchen
tasks) and each level's cost is the split's mean API cost per run. A model
appears once it has T01 results; a split with no cost record shows
"Not reported" rather than zero. `assets/blog/harness-comparison.json` is the
earlier transcription of the manuscript figure and is no longer read by the page.

The chart fetches the JSON on page load without a build step. Refresh an HTTP
preview after regenerating (for example, `python3 -m http.server 8000` then
`http://localhost:8000/blog/`). Opening the HTML with `file://` may block JSON
loading; the chart then falls back to the original image. Its two SVG panels
animate once as they enter view, respect reduced-motion settings, and show
exact values on hover or keyboard focus. Update matching narrative claims in
both HTML and Markdown if the results change.


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

## Run documentation

`run/index.html` is the benchmark execution guide at `/run/`, linked from the homepage and blog. Its commands follow the benchmark repository’s [master README](https://github.com/RLE-Bench/RLE-Bench-dev/blob/master/README.md), using the `rlebench` CLI for setup checks, task preparation, evaluation, and result inspection. Keep it synchronized when benchmark setup changes. `run/run.css` extends the existing serif/monospace theme; `run/run.js` handles command copying and the shared theme preference. No build step is required.

The Run page’s provider examples use `-e` for endpoints and `--device` for device selection, checked against `rlebench/cli.py`, `rlebench/providers.py`, and `rlebench/runner.py` on the benchmark’s master branch. The Gemini example uses `.venv/bin/rlebench run task09 -a agy -e gemini/api -m gemini-3.7-flash`. The “Bring your own agent” section covers Harbor-supported agents and models, with additional Harbor configuration passed after `--`. Codex subscription setup links to the official credential-storage documentation. These are command examples, not executed evaluations.
