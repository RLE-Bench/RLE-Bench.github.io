# `assets/data/price/`

Per-model token prices used by `export.py` to **recompute** a run's API cost from
its token counts, instead of trusting the `cost_usd` field in the `taskNN.json`
dumps.

This exists because a harness can bill a model it does not recognise against the
wrong price sheet — Claude Code does this with `glm-5.3-flash`, charging Anthropic
rates and overstating the cost by more than 10x. A model only gets recomputed if
a file here prices it; every other model keeps the `cost_usd` from its dump.

## File format

One JSON file per model (the filename is cosmetic; `aliases` does the matching):

| field | meaning |
| --- | --- |
| `model` | canonical model string, used in warnings |
| `aliases` | raw model strings to match; compared after `normalise_model` (lowercased, `.`/`_` → `-`, provider prefix and reasoning-effort suffix stripped) |
| `currency` | must be `USD` |
| `unit` | must be `per_1m_tokens` |
| `rate` | which entry of `rates` is in force |
| `rates.<name>.input` | USD per 1M **uncached** input tokens (`n_input_tokens - n_cache_tokens`) |
| `rates.<name>.cached_input` | USD per 1M cached input tokens (`n_cache_tokens`); defaults to `input` when absent |
| `rates.<name>.output` | USD per 1M output tokens (`n_output_tokens`) |
| `sources`, `note`, `updated` | provenance; not read by the exporter |

A file whose `rate` is missing from `rates`, or whose `unit`/`currency` is not the
expected one, is skipped with a warning and the dump's own cost is kept.

## Changing the rate in force

`rates` is a table so a model can carry more than one published rate; `rate`
names the one the exporter applies. Edit it and re-run
`python3 assets/data/export.py`. Report list prices only — promotional or
discounted rates do not belong here, even for runs that were billed at one.

## Adding a model

Drop in a new file and re-run the exporter. Runs whose dump has no token counts
cannot be recomputed: the exporter warns and leaves that run's cost `null` rather
than reporting a number it knows is wrong.
