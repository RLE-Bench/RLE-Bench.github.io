# RLE-Bench website

A static, dependency-free leaderboard site for the RLE-Bench robotics
engineering benchmark (`~/Codes/RLE-Bench-dev`). No build step, no network
calls — open `index.html` or serve the folder.

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

## Files

| file | what it holds |
|---|---|
| `index.html` | page structure only — every number is rendered by `app.js` |
| `styles.css` | design tokens, light + dark themes, all layout |
| `app.js` | scoring, the index, the charts, tabs, tooltips |
| `data.js` | **the only file you edit to publish new results** |
| `assets/` | the project icon — favicon, apple-touch icon, header and hero mark |

## Updating results

`data.js` is the single source of truth. It has three parts:

- `meta` — version string, updated date, header links (`github`, `arxiv`,
  `contact`), and `dataStatus`. An empty `arxiv` renders the nav item greyed
  out rather than pointing nowhere; an empty `contact` or `github` drops that
  item entirely. `contact` accepts a `mailto:` just as happily as a URL.
  Setting
  `dataStatus` to anything other than `"placeholder"` removes the orange
  sample-data banner at the top of the page.
- `models` — one entry per evaluated agent, including the `harness` it was
  driven with (the scaffold, e.g. Claude Code or Codex CLI) — shown under the
  model name everywhere and as its own table column. `baseline: true` keeps a
  row out of the ranking (that is how the Oracle reference is shown without
  competing).
- `scores[taskId][modelId]` — an array of per-split scores in `[0, 1]`, aligned
  positionally with that task's `splits` array.

**The scores currently in the file are placeholders.** They exist so the page
renders; replace them with real `reward.json` aggregates before this goes
anywhere public.

A family's score aggregates its splits the way its verifier does:

- `aggregate: "mean"` — the mean of the splits (every family but task01).
- `aggregate: "min"` — the minimum (task01, whose checkpoints reduce by
  minimum across the three canonical arms).

The **RLE Index** is the unweighted mean of the eight family scores, ×100.

Per-family spend is `model.cost × task.costShare` — each family carries a fixed
share of the suite bill, so the cost view needs only one number per model. The
cost section is tabbed the same way the rankings are: **ALL** plots the RLE
Index against the suite bill, and each family tab plots that family's score
against its share of the bill, with a matching table underneath.

## Task metadata

The `tasks` array mirrors the benchmark repo: budgets, variant counts, GPU
requirements, split names and reward weights are read from the task READMEs,
`manifest.toml` files and build scripts. If a task's timeouts or weights change
upstream, update the matching entry here.

Note the suite ships **eight** families — `task01`–`task06`, `task08` and
`task09`. There is no `task07`.

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
