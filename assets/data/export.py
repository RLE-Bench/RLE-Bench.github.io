#!/usr/bin/env python3
"""Build assets/data/leaderboard.json from the per-task run dumps in assets/data/.

Each ``taskNN.json`` in this directory is a dump of one benchmark task's runs
(``{"schema_version": 1, "root": "jobs/...", "runs": [...]}``); ``NN`` is the
public task number used on the site (T01 = Agentic Control, ...). This script
groups those runs by model, subtask and split (harness level, difficulty band,
motion clip, scoring stage) and writes one ``leaderboard.json`` that both
``index.html`` (via ``app.js``) and ``blog/index.html`` (via
``blog/harness-chart.js``) read at page load.

Usage::

    python3 assets/data/export.py                  # rebuild leaderboard.json
    python3 assets/data/export.py --check          # exit 1 if leaderboard.json is stale
    python3 assets/data/export.py --compact        # drop per-run raw verifier metrics
    python3 assets/data/export.py --allow-partial  # score model/task pairs missing subtasks
    python3 assets/data/export.py --completed-only # ignore runs whose status is not "completed"

Output layout (all scores are on a 0-1 scale)::

    models[]                         id, name, short, org, open, harness, tasks
    tasks[taskId]                    public number, split catalog, subtask catalog
    scores[taskId][modelId]          per-split scores aligned with tasks[taskId].splits
    costs[taskId][modelId]           cost (USD, sum), hours (median per run), tokens (sums)
    results[taskId][modelId]         task score plus per-split and per-subtask detail

``taskId`` equals the public task number that ``data.js`` and ``app.js`` key on
(``task01`` = T01 Agentic Control, ...); ``tasks[taskId].public`` carries the
same number as ``T01``. Only the tasks listed in ``TASKS`` below are exported; add a
``TaskSpec`` there when a new dump lands.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

HERE = Path(__file__).resolve().parent
DEFAULT_OUTPUT = HERE / "leaderboard.json"
SCHEMA_VERSION = 2

# --------------------------------------------------------------------------
# Model registry: raw model strings in the dumps -> stable ids used on the site.
# Aliases are matched after normalisation (see ``normalise_model``).
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    short: str
    org: str
    open: bool
    aliases: tuple[str, ...]


MODELS: tuple[ModelSpec, ...] = (
    ModelSpec("gpt6astra", "GPT-6 Astra", "Astra", "OpenAI", False, ("gpt-6-astra",)),
    ModelSpec("opus5", "Claude Opus 5", "Opus 5", "Anthropic", False, ("claude-opus-5",)),
    ModelSpec("gpt56sol", "GPT-5.6 Sol", "Sol", "OpenAI", False, ("gpt-5-6-sol",)),
    ModelSpec("gemini37flash", "Gemini 3.7 Flash", "Gemini 3.7", "Google", False, ("gemini-3-7-flash",)),
    ModelSpec("opus48", "Claude Opus 4.8", "Opus 4.8", "Anthropic", False, ("claude-opus-4-8",)),
    ModelSpec("gpt56luna", "GPT-5.6 Luna", "Luna", "OpenAI", False, ("gpt-5-6-luna",)),
    ModelSpec("glm53flash", "GLM-5.3 Flash", "GLM-5.3", "Z.ai", True, ("glm-5-3-flash",)),
    ModelSpec("gpt56terra", "GPT-5.6 Terra", "Terra", "OpenAI", False, ("gpt-5-6-terra",)),
)

# Reasoning-effort suffixes that some dumps append to the model string.
EFFORT_SUFFIXES = ("-xhigh", "-high", "-medium", "-low", "-minimal")

# Harness detection from the ``agent`` field of a run. First match wins.
HARNESSES: tuple[tuple[str, str], ...] = (
    ("codex", "Codex"),
    ("claude-code", "Claude Code"),
    ("claude_code", "Claude Code"),
    ("antigravity", "Antigravity CLI"),
)

# --------------------------------------------------------------------------
# Task catalog: how each dump's runs map to subtasks and splits.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Split:
    """One column of the per-task score array.

    A *subtask-group* split (``subtasks`` set) scores the mean reward of those
    subtask runs. A *component* split (``metric`` set) reads one verifier
    metric from each run and divides it by ``weight`` so the value is 0-1.
    """

    id: str
    label: str
    subtasks: tuple[str, ...] = ()
    metric: str | None = None
    weight: float = 1.0


@dataclass(frozen=True)
class TaskSpec:
    id: str  # task id used by data.js / app.js (equals the public number, e.g. task01 = T01)
    public: str  # public task number shown on the site (T01...)
    name: str
    file: str  # dump in assets/data/
    split_label: str
    aggregate: str  # "mean" | "min" | "weighted" (how split values combine for display)
    splits: tuple[Split, ...]
    subtasks: dict[str, dict]  # id -> {"label": ..., extra catalog fields}
    subtask_of: Callable[[str], str]  # job string -> raw subtask id
    score_note: str = ""


def first_components(n: int) -> Callable[[str], str]:
    return lambda job: "/".join(job.split("/")[:n])


AGENTIC_SUBTASKS = {
    "01-open-fridge": "Open fridge",
    "02-close-cabinet": "Close cabinet",
    "03-turn-on-stove": "Turn on stove",
    "04-pick-place-counter-to-drawer": "Pick and place: counter to drawer",
    "05-pick-place-microwave-to-counter": "Pick and place: microwave to counter",
}
AGENTIC_LEVELS = (
    ("L1", "L1 — action API only"),
    ("L2", "L2 — + harness library"),
    ("L3", "L3 — + privileged state"),
)

# tasks/task02/README.md in RLE-Bench-dev: band, slug, held-out task.
HARNESS_SUBTASKS = (
    ("EASY", "01-washing-dishes", "DumpLeftovers"),
    ("EASY", "02-sauteing-vegetables", "PlaceVegetablesEvenly"),
    ("EASY", "03-baking", "PastryDisplay"),
    ("EASY", "04-reheating-food", "SimmeringSauce"),
    ("EASY", "05-chopping-food", "ClearCuttingBoard"),
    ("MEDIUM", "06-setting-the-table", "AlignSilverware"),
    ("MEDIUM", "07-portioning-meals", "PortionHotDogs"),
    ("MEDIUM", "08-defrosting-food", "DefrostByCategory"),
    ("MEDIUM", "09-arranging-buffet", "PlaceBeveragesTogether"),
    ("MEDIUM", "10-serving-beverages", "MatchCupAndDrink"),
    ("HARD", "11-loading-fridge", "MoveFreezerToFridge"),
    ("HARD", "12-managing-freezer-space", "SeparateFreezerRack"),
    ("HARD", "13-clearing-table", "CandleCleanup"),
    ("HARD", "14-microwaving-food", "PlaceMicrowaveSafeItem"),
    ("HARD", "15-storing-leftovers", "StoreLeftoversInBowl"),
)
HARNESS_BANDS = (("EASY", "EASY (5 groups)"), ("MEDIUM", "MEDIUM (5 groups)"), ("HARD", "HARD (5 groups)"))

TRACKING_SUBTASKS = {
    "01-dance": "Dance",
    "02-fight": "Fight",
    "03-fall-and-get-up": "Fall & Get Up",
    "04-run": "Run",
    "05-sprint": "Sprint",
}

# tasks/task06/README.md in RLE-Bench-dev: stage weights; gates cap the reward at 0.15.
MOBILE_BASE_STAGES = (
    ("validity", "Validity", "stage_validity", 0.15),
    ("design", "Design", "stage_design", 0.35),
    ("static", "Static Stability", "stage_static", 0.15),
    ("dynamic", "Dynamic Stability", "stage_dynamic", 0.20),
    ("integration", "Integration", "stage_integration", 0.15),
)

# tasks/task05/README.md in RLE-Bench-dev: four tracks (two LIBERO-10, two RoboTwin 2.0); reward = hidden-set success rate.
NANOVLA_SUBTASKS = {
    "01-libero-open-design": "LIBERO · open design",
    "02-libero-robustness": "LIBERO · robustness",
    "03-robotwin-open-design": "RoboTwin · open design",
    "04-robotwin-robustness": "RoboTwin · robustness",
}
# Job paths in task05.json still use the pre-rename track slugs.
NANOVLA_ALIASES = {
    "t4-open-init": "01-libero-open-design",
    "t5-robustness": "02-libero-robustness",
    "t6-robotwin-open": "03-robotwin-open-design",
    "t7-robotwin-robust": "04-robotwin-robustness",
}


def nanovla_subtask(job: str) -> str:
    parts = job.split("/")
    raw = parts[1] if len(parts) > 1 else job
    return NANOVLA_ALIASES.get(raw, raw)


# tasks/task09/README.md in RLE-Bench-dev: per-episode score = 0.3 × perfect + 0.35 × clear_curve(clear_frac)
# + 0.2 × min(tp/10, 1) + 0.15 × perfect × min(tp/15, 1) − penalties, mean over eight hidden episodes.
# The dump reports episode-mean components; the two on a 0-1 scale are shown as splits.
BIN_CLEARING_COMPONENTS = (
    ("clearance", "Clearance (fraction of bin cleared)", "clear_frac"),
    ("throughput", "Throughput (speed merit)", "speed_merit"),
)


def slug_label(slug: str) -> str:
    return re.sub(r"^\d+-", "", slug).replace("-", " ").capitalize()


TASKS: tuple[TaskSpec, ...] = (
    TaskSpec(
        id="task01",
        public="T01",
        name="Agentic Control",
        file="task01.json",
        split_label="Harness Level",
        aggregate="mean",
        splits=tuple(
            Split(level, label, subtasks=tuple(f"{level}/{slug}" for slug in AGENTIC_SUBTASKS))
            for level, label in AGENTIC_LEVELS
        ),
        subtasks={
            f"{level}/{slug}": {"label": f"{level} · {name}", "level": level, "kitchen_task": slug}
            for level, _ in AGENTIC_LEVELS
            for slug, name in AGENTIC_SUBTASKS.items()
        },
        subtask_of=first_components(2),
        score_note="reward = 0.80 × success_rate + 0.20 × success_rate × (1 − dev_steps / budget); task score is the mean reward over 15 level × kitchen-task cells.",
    ),
    TaskSpec(
        id="task02",
        public="T02",
        name="Harness Engineering",
        file="task02.json",
        split_label="Difficulty Band",
        aggregate="mean",
        splits=tuple(
            Split(band, label, subtasks=tuple(slug for b, slug, _ in HARNESS_SUBTASKS if b == band))
            for band, label in HARNESS_BANDS
        ),
        subtasks={
            slug: {"label": slug_label(slug), "band": band, "heldout_task": heldout}
            for band, slug, heldout in HARNESS_SUBTASKS
        },
        subtask_of=first_components(1),
        score_note="Stage-credit reward of fresh agents on the held-out member of each activity group; task score is the mean over 15 groups.",
    ),
    TaskSpec(
        id="task04",
        public="T04",
        name="Whole-Body Motion Tracking",
        file="task04.json",
        split_label="Motion (20 s Clip)",
        aggregate="mean",
        splits=tuple(Split(slug, label, subtasks=(slug,)) for slug, label in TRACKING_SUBTASKS.items()),
        subtasks={slug: {"label": label} for slug, label in TRACKING_SUBTASKS.items()},
        subtask_of=first_components(1),
        score_note="episode = 0.7 × tracking_multi + 0.3 × survival, averaged over hidden seeds; task score is the mean over five clips.",
    ),
    TaskSpec(
        id="task05",
        public="T05",
        name="NanoVLA Recipe",
        file="task05.json",
        split_label="Track",
        aggregate="mean",
        splits=tuple(Split(slug, label, subtasks=(slug,)) for slug, label in NANOVLA_SUBTASKS.items()),
        subtasks={slug: {"label": label} for slug, label in NANOVLA_SUBTASKS.items()},
        subtask_of=nanovla_subtask,
        score_note="reward = hidden-set success rate of the trained policy (500 LIBERO-10 or 300 RoboTwin episodes); task score is the mean over four tracks.",
    ),
    TaskSpec(
        id="task06",
        public="T06",
        name="Mobile Base Design",
        file="task06.json",
        split_label="Scoring Stage",
        aggregate="weighted",
        splits=tuple(Split(sid, label, metric=metric, weight=w) for sid, label, metric, w in MOBILE_BASE_STAGES),
        subtasks={"mobile-base": {"label": "Mobile base"}},
        subtask_of=lambda job: "mobile-base",
        score_note="reward = sum of weighted stage checkpoints, each the minimum over the Panda, UR5e and xArm7 arms; a failed gate caps the reward at 0.15. Split values are stage credit divided by stage weight.",
    ),
    TaskSpec(
        id="task09",
        public="T09",
        name="Bin Clearing",
        file="task09.json",
        split_label="Reward Component",
        aggregate="weighted",
        splits=tuple(Split(sid, label, metric=metric) for sid, label, metric in BIN_CLEARING_COMPONENTS),
        subtasks={"bin-clearing": {"label": "Bin clearing"}},
        subtask_of=lambda job: "bin-clearing",
        score_note="episode = 0.3 × perfect + 0.35 × clear_curve(clear_frac) + 0.2 × min(tp/10, 1) + 0.15 × perfect × min(tp/15, 1) − 0.03 × floor_drops − 0.05 × damage − 0.05 × bin_hits, mean over eight hidden episodes; a failed gate caps it at 0.1. Split values are the episode-mean clearance fraction and speed merit.",
    ),
)

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


class Warnings:
    def __init__(self) -> None:
        self.seen: list[str] = []

    def __call__(self, message: str) -> None:
        if message not in self.seen:
            self.seen.append(message)
            print(f"warning: {message}", file=sys.stderr)


warn = Warnings()


def num(value) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)) and value == value and value not in (float("inf"), float("-inf")):
        return float(value)
    return None


def rnd(value: float | None, digits: int = 6) -> float | None:
    return None if value is None else round(value, digits)


def mean(values: Iterable[float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def median(values: Iterable[float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    return statistics.median(vals) if vals else None


def total(values: Iterable[float | None]) -> float | None:
    """Sum that is None when any input is missing, so partial sums never masquerade as totals."""
    vals = list(values)
    if not vals or any(v is None for v in vals):
        return None
    return sum(vals)


def parse_ts(value) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    # Dumps mix naive and zone-aware stamps; treat naive ones as UTC so durations still subtract.
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def normalise_model(raw: str) -> str:
    slug = raw.split("/")[-1].lower().replace(".", "-").replace("_", "-")
    for suffix in EFFORT_SUFFIXES:
        if slug.endswith(suffix):
            slug = slug[: -len(suffix)]
    return slug


def resolve_model(raw: str) -> ModelSpec:
    slug = normalise_model(raw)
    for spec in MODELS:
        if slug in spec.aliases:
            return spec
    warn(f"unknown model string {raw!r}; exporting it as id {slug!r} — add it to MODELS in export.py")
    return ModelSpec(slug, raw.split("/")[-1], raw.split("/")[-1], "Unknown", False, (slug,))


def resolve_harness(agent: str) -> str:
    key = agent.lower()
    for needle, harness in HARNESSES:
        if needle in key:
            return harness
    warn(f"unknown agent string {agent!r}; using it verbatim as the harness name")
    return agent


def resolve_subtask(spec: TaskSpec, raw: str) -> str | None:
    """Map a raw subtask id from a job path onto the task's subtask catalog."""
    if raw in spec.subtasks:
        return raw
    # Match on the numeric prefix (``NN-slug``) so renamed slugs still land on the right group.
    match = re.match(r"^(?P<prefix>(?:[^/]+/)?\d+)-", raw)
    if match:
        prefix = match.group("prefix")
        candidates = [sid for sid in spec.subtasks if sid.startswith(prefix + "-")]
        if len(candidates) == 1:
            warn(f"{spec.file}: job slug {raw!r} mapped to catalog subtask {candidates[0]!r} by number")
            return candidates[0]
    return None


# --------------------------------------------------------------------------
# Run extraction and aggregation
# --------------------------------------------------------------------------


def run_record(run: dict) -> dict:
    extra = run.get("extra") or {}
    progress = extra.get("progress") or {}
    started, finished = parse_ts(extra.get("started_at")), parse_ts(extra.get("finished_at"))
    hours = (finished - started).total_seconds() / 3600 if started and finished else None
    if hours is not None and hours < 0:
        hours = None
    metrics = {k: num(v) for k, v in (run.get("metrics") or {}).items()}
    return {
        "job": run.get("job"),
        "agent": run.get("agent"),
        "model": run.get("model"),
        "status": run.get("status"),
        "reward": num(run.get("reward")),
        "success_rate": num(run.get("success_rate")),
        "cost_usd": num(run.get("cost_usd")),
        "hours": hours,
        "started_at": extra.get("started_at"),
        "finished_at": extra.get("finished_at"),
        "input_tokens": num(progress.get("n_input_tokens")),
        "cached_tokens": num(progress.get("n_cache_tokens")),
        "output_tokens": num(progress.get("n_output_tokens")),
        "metrics": metrics,
    }


def pick_run(spec: TaskSpec, key: tuple[str, str], runs: list[dict], policy: str) -> dict:
    if len(runs) == 1:
        return runs[0]
    if policy == "best":
        chosen = max(runs, key=lambda r: (r["reward"] if r["reward"] is not None else -1))
    elif policy == "first":
        chosen = min(runs, key=lambda r: r["finished_at"] or "")
    else:
        chosen = max(runs, key=lambda r: r["finished_at"] or "")
    warn(f"{spec.file}: {len(runs)} runs for model {key[0]!r} subtask {key[1]!r}; keeping {policy} ({chosen['job']})")
    return chosen


def load_task(spec: TaskSpec, args: argparse.Namespace) -> dict:
    path = HERE / spec.file
    dump = json.loads(path.read_text(encoding="utf-8"))
    runs = dump.get("runs") or []
    grouped: dict[tuple[str, str], list[dict]] = {}
    harness_of: dict[str, dict[str, int]] = {}
    models: dict[str, ModelSpec] = {}
    skipped = 0
    for run in runs:
        record = run_record(run)
        if args.completed_only and record["status"] != "completed":
            skipped += 1
            continue
        if record["reward"] is None:
            warn(f"{spec.file}: run {record['job']!r} has no numeric reward; skipped")
            skipped += 1
            continue
        if record["status"] != "completed":
            warn(f"{spec.file}: run {record['job']!r} has status {record['status']!r} but a reward; kept (use --completed-only to drop it)")
        subtask = resolve_subtask(spec, spec.subtask_of(record["job"] or ""))
        if subtask is None:
            warn(f"{spec.file}: job {record['job']!r} does not match any catalog subtask; skipped")
            skipped += 1
            continue
        model = resolve_model(record["model"] or "")
        models[model.id] = model
        harness = resolve_harness(record["agent"] or "")
        harness_of.setdefault(model.id, {})[harness] = harness_of.setdefault(model.id, {}).get(harness, 0) + 1
        record["subtask"] = subtask
        record["harness"] = harness
        grouped.setdefault((model.id, subtask), []).append(record)

    chosen = {key: pick_run(spec, key, group, args.dedupe) for key, group in grouped.items()}
    per_model: dict[str, dict[str, dict]] = {}
    for (model_id, subtask), record in chosen.items():
        per_model.setdefault(model_id, {})[subtask] = record

    results = {}
    for model_id, subtasks in per_model.items():
        results[model_id] = aggregate_model(spec, subtasks, harness_of[model_id], args)
    return {
        "spec": spec,
        "root": dump.get("root"),
        "schema_version": dump.get("schema_version"),
        "n_runs": len(runs),
        "n_skipped": skipped,
        "models": models,
        "results": results,
    }


def aggregate_model(spec: TaskSpec, subtasks: dict[str, dict], harnesses: dict[str, int], args: argparse.Namespace) -> dict:
    expected = list(spec.subtasks)
    present = [sid for sid in expected if sid in subtasks]
    complete = len(present) == len(expected)
    scoreable = complete or args.allow_partial
    runs = [subtasks[sid] for sid in present]

    splits = {}
    for split in spec.splits:
        if split.metric is not None:
            values = [r["metrics"].get(split.metric) for r in runs]
            values = [v / split.weight for v in values if v is not None]
            score = mean(values)
            score = None if score is None else max(0.0, min(1.0, score))
            splits[split.id] = {
                "score": rnd(score if scoreable else None),
                "metric": split.metric,
                "weight": split.weight,
                "credit": rnd(mean(r["metrics"].get(split.metric) for r in runs)),
                "n_runs": len(values),
                "complete": len(values) == len(present) and complete,
            }
            continue
        group = [subtasks[sid] for sid in split.subtasks if sid in subtasks]
        split_complete = len(group) == len(split.subtasks)
        ok = group and (split_complete or args.allow_partial)
        splits[split.id] = {
            "score": rnd(mean(r["reward"] for r in group)) if ok else None,
            "reward": rnd(mean(r["reward"] for r in group)),
            "success_rate": rnd(mean(r["success_rate"] for r in group)),
            "cost_usd": rnd(total(r["cost_usd"] for r in group)) if ok else None,
            "cost_usd_mean": rnd(mean(r["cost_usd"] for r in group)),
            "hours_median": rnd(median(r["hours"] for r in group), 4),
            "n_runs": len(group),
            "complete": split_complete,
        }

    split_scores = [splits[s.id]["score"] for s in spec.splits]
    if not scoreable:
        score = None
    elif spec.aggregate == "min":
        score = None if any(v is None for v in split_scores) else min(split_scores)
    else:  # "mean" and "weighted": the verifier reward already carries the weights and gates
        score = mean(r["reward"] for r in runs)

    harness = max(harnesses.items(), key=lambda kv: kv[1])[0]
    if len(harnesses) > 1:
        warn(f"{spec.file}: model runs use several harnesses {sorted(harnesses)}; reporting {harness!r}")

    cost = {
        "cost": rnd(total(r["cost_usd"] for r in runs)) if scoreable else None,
        "cost_mean": rnd(mean(r["cost_usd"] for r in runs)),
        "hours": rnd(median(r["hours"] for r in runs), 4),
        "hours_total": rnd(total(r["hours"] for r in runs), 4),
        "input_tokens": total(r["input_tokens"] for r in runs) if scoreable else None,
        "cached_tokens": total(r["cached_tokens"] for r in runs) if scoreable else None,
        "output_tokens": total(r["output_tokens"] for r in runs) if scoreable else None,
        "n_runs": len(runs),
        "n_subtasks": len(expected),
    }
    for key in ("input_tokens", "cached_tokens", "output_tokens"):
        if cost[key] is not None:
            cost[key] = int(round(cost[key]))

    detail = {}
    for sid in present:
        r = subtasks[sid]
        entry = {
            "reward": rnd(r["reward"]),
            "success_rate": rnd(r["success_rate"]),
            "cost_usd": rnd(r["cost_usd"]),
            "hours": rnd(r["hours"], 4),
            "status": r["status"],
            "harness": r["harness"],
            "agent": r["agent"],
            "model": r["model"],
            "job": r["job"],
            "started_at": r["started_at"],
            "finished_at": r["finished_at"],
            "input_tokens": None if r["input_tokens"] is None else int(r["input_tokens"]),
            "cached_tokens": None if r["cached_tokens"] is None else int(r["cached_tokens"]),
            "output_tokens": None if r["output_tokens"] is None else int(r["output_tokens"]),
        }
        if not args.compact:
            entry["metrics"] = {k: rnd(v) for k, v in r["metrics"].items()}
        detail[sid] = entry

    return {
        "score": rnd(score),
        "complete": complete,
        "n_runs": len(runs),
        "n_subtasks": len(expected),
        "missing": [sid for sid in expected if sid not in subtasks],
        "harness": harness,
        "split_scores": split_scores,
        "splits": splits,
        "subtasks": detail,
        "cost": cost,
    }


# --------------------------------------------------------------------------
# Output assembly
# --------------------------------------------------------------------------


def build(args: argparse.Namespace) -> dict:
    loaded = []
    for spec in TASKS:
        if not (HERE / spec.file).exists():
            warn(f"{spec.file} not found; task {spec.id} ({spec.public}) left out")
            continue
        loaded.append(load_task(spec, args))

    registry: dict[str, ModelSpec] = {}
    harness_votes: dict[str, dict[str, int]] = {}
    for task in loaded:
        for model_id, spec in task["models"].items():
            registry[model_id] = spec
        for model_id, result in task["results"].items():
            votes = harness_votes.setdefault(model_id, {})
            votes[result["harness"]] = votes.get(result["harness"], 0) + 1

    tasks_out, scores, costs, results = {}, {}, {}, {}
    for task in loaded:
        spec: TaskSpec = task["spec"]
        splits_out = []
        for split in spec.splits:
            entry = {"id": split.id, "label": split.label}
            if split.metric is not None:
                entry.update({"metric": split.metric, "weight": split.weight})
            else:
                entry["subtasks"] = list(split.subtasks)
            splits_out.append(entry)
        tasks_out[spec.id] = {
            "id": spec.id,
            "public": spec.public,
            "number": spec.public.lstrip("T"),
            "name": spec.name,
            "file": spec.file,
            "root": task["root"],
            "score_metric": "reward",
            "score_note": spec.score_note,
            "aggregate": spec.aggregate,
            "splitLabel": spec.split_label,
            "splits": splits_out,
            "weights": [s.weight for s in spec.splits] if spec.aggregate == "weighted" else None,
            "subtasks": [{"id": sid, **meta} for sid, meta in spec.subtasks.items()],
            "n_runs": task["n_runs"],
            "n_runs_skipped": task["n_skipped"],
            "models": sorted(task["results"]),
        }
        scores[spec.id] = {m: r["split_scores"] for m, r in task["results"].items()}
        costs[spec.id] = {m: r["cost"] for m, r in task["results"].items()}
        results[spec.id] = {
            m: {k: v for k, v in r.items() if k not in ("split_scores", "cost")} for m, r in task["results"].items()
        }

    def mean_score(model_id: str) -> float:
        vals = [results[t][model_id]["score"] for t in results if model_id in results[t] and results[t][model_id]["score"] is not None]
        return sum(vals) / len(vals) if vals else -1.0

    models_out = []
    for model_id in sorted(registry, key=lambda m: (-mean_score(m), registry[m].name)):
        spec = registry[model_id]
        harness = max(harness_votes[model_id].items(), key=lambda kv: kv[1])[0]
        if len(harness_votes[model_id]) > 1:
            warn(f"model {model_id!r} was driven by several harnesses {sorted(harness_votes[model_id])}; listing {harness!r}")
        models_out.append(
            {
                "id": spec.id,
                "name": spec.name,
                "short": spec.short,
                "org": spec.org,
                "open": spec.open,
                "harness": harness,
                "tasks": [t for t in results if model_id in results[t] and results[t][model_id]["score"] is not None],
            }
        )

    return {
        "schema_version": SCHEMA_VERSION,
        "status": "measured",
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "generator": "assets/data/export.py",
        "source": {
            "note": (
                "Aggregated from the per-task run dumps in assets/data/ (one taskNN.json per public task). "
                "scores[taskId][modelId] holds per-split scores aligned with tasks[taskId].splits; "
                "results[taskId][modelId].score is the task score (mean verifier reward over the task's subtasks). "
                "costs[taskId][modelId]: cost = API cost in USD summed over the task's subtask runs, hours = median "
                "agent wall-clock hours per run, input/cached/output tokens = sums over runs; Context Length on the "
                "homepage is input_tokens minus cached_tokens. Missing API cost or token counts stay null. "
                "Task ids equal the public task numbers used by data.js; tasks[taskId].public repeats it as T01 etc."
            ),
            "options": {
                "allow_partial": args.allow_partial,
                "completed_only": args.completed_only,
                "dedupe": args.dedupe,
                "compact": args.compact,
            },
            "files": {
                task["spec"].id: {
                    "file": task["spec"].file,
                    "root": task["root"],
                    "schema_version": task["schema_version"],
                    "runs": task["n_runs"],
                    "runs_skipped": task["n_skipped"],
                }
                for task in loaded
            },
        },
        "models": models_out,
        "tasks": tasks_out,
        "scores": scores,
        "costs": costs,
        "results": results,
    }


def dumps(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def strip_volatile(payload: dict) -> dict:
    return {k: v for k, v in payload.items() if k != "generated_at"}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUTPUT, help=f"output path (default: {DEFAULT_OUTPUT})")
    parser.add_argument("--check", action="store_true", help="do not write; exit 1 if the output file is missing or stale")
    parser.add_argument("--compact", action="store_true", help="omit per-run raw verifier metrics from results[...].subtasks")
    parser.add_argument("--allow-partial", action="store_true", help="score a model/task pair even when some subtask runs are missing")
    parser.add_argument("--completed-only", action="store_true", help="drop runs whose status is not 'completed'")
    parser.add_argument("--dedupe", choices=("latest", "best", "first"), default="latest", help="which run to keep when a model has several for one subtask (default: latest finished_at)")
    parser.add_argument("--stdout", action="store_true", help="print the JSON instead of writing the output file")
    args = parser.parse_args(argv)

    payload = build(args)
    text = dumps(payload)

    if args.stdout:
        sys.stdout.write(text)
        return 0
    if args.check:
        if not args.output.exists():
            print(f"{args.output}: missing; run export.py", file=sys.stderr)
            return 1
        current = json.loads(args.output.read_text(encoding="utf-8"))
        if strip_volatile(current) != strip_volatile(payload):
            print(f"{args.output}: stale; run export.py", file=sys.stderr)
            return 1
        print(f"{args.output}: up to date")
        return 0

    args.output.write_text(text, encoding="utf-8")
    summary = ", ".join(f"{t['public']} {t['id']}: {len(t['models'])} models" for t in payload["tasks"].values())
    print(f"wrote {args.output} ({len(text.encode('utf-8')) / 1024:.0f} KB): {len(payload['models'])} models; {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
