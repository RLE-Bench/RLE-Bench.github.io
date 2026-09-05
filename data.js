/* ---------------------------------------------------------------------------
 * RLE-Bench leaderboard data
 *
 * !!! PLACEHOLDER RESULTS !!!
 * The task metadata below (names, budgets, splits, scoring weights) is read
 * from the RLE-Bench-dev repository and is real. The per-model SCORES are
 * illustrative sample data so the page has something to render -- no runs have
 * been scored into this file yet. Replace `scores`, `models` and
 * `meta.dataStatus` with real `reward.json` aggregates before publishing.
 *
 * Each scores[taskId][modelId] is an array aligned to that task's `splits`.
 * ------------------------------------------------------------------------- */

const BENCH = {
  meta: {
    name: "RLE-Bench",
    subtitle: "A full-stack robotics engineering benchmark for coding agents",
    version: "v1.0-dev",
    updated: "2026-09-02",
    dataStatus: "placeholder", // set to "measured" once real runs land
    // Header links. Fill `arxiv` in when the paper is up — until then the
    // nav shows the link greyed out rather than pointing nowhere.
    github: "https://github.com/RLE-Bench/RLE-Bench-dev",
    arxiv: "",
    // Where to reach the maintainers. A mailto: also works — e.g.
    // "mailto:you@example.com" — swap it for whichever you want public.
    contact: "https://github.com/RLE-Bench/RLE-Bench-dev/issues",
  },

  /* --- agents under evaluation -------------------------------------------
   * harness = the agent scaffold the model was driven with
   * cost    = USD per full suite run (all families, all variants)
   * hours   = median agent wall-clock hours per task
   */
  models: [
    { id: "opus5",    name: "Claude Opus 5",   org: "Anthropic", cost: 412, hours: 3.9, open: false , harness: "Claude Code" },
    { id: "sonnet5",  name: "Claude Sonnet 5", org: "Anthropic", cost: 138, hours: 3.6, open: false , harness: "Claude Code" },
    { id: "gpt52",    name: "GPT-5.2",         org: "OpenAI",    cost: 356, hours: 4.1, open: false , harness: "Codex CLI" },
    { id: "gemini3",  name: "Gemini 3 Pro",    org: "Google",    cost: 291, hours: 3.8, open: false , harness: "Gemini CLI" },
    { id: "glm52",    name: "GLM-5.2",         org: "Z.ai",      cost:  74, hours: 4.4, open: true  , harness: "Claude Code" },
    { id: "ds4",      name: "DeepSeek-V4",     org: "DeepSeek",  cost:  61, hours: 4.3, open: true  , harness: "Claude Code" },
    { id: "qwen3max", name: "Qwen3-Max",       org: "Alibaba",   cost:  88, hours: 4.2, open: true  , harness: "Qwen Code" },
    { id: "kimi25",   name: "Kimi K2.5",       org: "Moonshot",  cost:  52, hours: 4.5, open: true  , harness: "Claude Code" },
    { id: "oracle",   name: "Oracle reference", org: "RLE-Bench", cost: 0,  hours: 0.4, open: true, baseline: true , harness: "Reference solution" },
  ],

  /* --- the task families -------------------------------------------------- */
  tasks: [
    {
      id: "task01",
      num: "01",
      name: "Mobile Manipulator Design",
      short: "Manipulator Design",
      costShare: 0.06,
      tagline: "Design and prove a stable mobile base from an aluminum-profile library",
      description:
        "The agent designs a mobile-manipulator chassis from a stock aluminum-profile library and must prove it stable. One submitted base is verified against three canonical arms — Panda, UR5e, xArm7 — attached through a universal adapter, and checkpoints reduce by minimum: the weakest arm is the score.",
      aggregate: "min",
      gpu: false,
      agentLimit: "2 h",
      verifierLimit: "1.5 h",
      variants: 1,
      splitLabel: "Canonical arm",
      splits: ["Panda", "UR5e", "xArm7"],
      scoring: [
        { label: "Validity & stability gates", weight: 0.30 },
        { label: "Reach preservation (12 targets)", weight: 0.28 },
        { label: "Design efficiency", weight: 0.22 },
        { label: "Load & settling", weight: 0.18 },
      ],
      notes: "Soft targets: 0.56 m footprint, 60 kg assembled mass, 12 m of profile. Reference chassis measures 33.5 kg submitted base.",
    },
    {
      id: "task02",
      num: "02",
      name: "GELLO Lead-Arm Co-Design",
      short: "GELLO Co-Design",
      costShare: 0.09,
      tagline: "Hardware/software co-design of teleop lead arms for three followers",
      description:
        "One three-hour session, three co-design problems: GELLO-style lead arms for Franka, UR5e and xArm7 followers, printable linkage plus a gravity-trim program, under one half-scale servo and mass budget. The verifier treats the submission as untrusted input and recomputes every physical quantity itself.",
      aggregate: "mean",
      gpu: false,
      agentLimit: "3 h",
      verifierLimit: "1 h",
      variants: 3,
      splitLabel: "Follower arm",
      splits: ["Franka (7 DoF)", "UR5e (6 DoF)", "xArm7 (7 DoF)"],
      scoring: [
        { label: "Co-design (hold, backdrive, headroom, recovery)", weight: 0.35 },
        { label: "Hardware (passive residual, hold, backdrive)", weight: 0.25 },
        { label: "Validity gates", weight: 0.20 },
        { label: "Software (nominal & adapted trim)", weight: 0.20 },
      ],
      notes: "Transfer test: shared checkpoint weights and reward curves, with absolute bars calibrated per follower.",
    },
    {
      id: "task03",
      num: "03",
      name: "RoboCasa Speed-Run",
      short: "RoboCasa Speed-Run",
      costShare: 0.22,
      tagline: "Learn a kitchen subtask through a metered socket — capability first, sample efficiency second",
      description:
        "Three harness levels × ten RoboCasa kitchen subtasks, reached only through a metered socket — every simulator step is charged to an interaction budget. The task, the seeds and the weights are identical at every level, so the gap between an L1 and an L3 score is exactly what the harness bought.",
      aggregate: "mean",
      gpu: true,
      agentLimit: "8 h + 1 h",
      verifierLimit: "per step",
      variants: 30,
      splitLabel: "Harness level",
      splits: ["L1 — action API only", "L2 — + harness library", "L3 — + privileged state"],
      scoring: [
        { label: "Success rate on held seeds", weight: 0.80 },
        { label: "Sample efficiency × success", weight: 0.20 },
      ],
      notes: "reward = 0.80 × success_rate + 0.20 × success_rate × (1 − dev_steps / budget). No participation credit: an unsealed ledger scores zero.",
    },
    {
      id: "task04",
      num: "04",
      name: "Harness Engineering",
      short: "Harness Engineering",
      costShare: 0.24,
      tagline: "Build a harness a different agent, with no shared context, can apply to a task neither has seen",
      description:
        "Agent A practises on an activity group and writes a harness — perception primitives, controllers, a manual. Independent agents then start with fresh context, read that manual, and get one shot each at a held-out task neither has seen; the reward is their mean.",
      aggregate: "mean",
      gpu: true,
      agentLimit: "8 h + 5×1 h",
      verifierLimit: "per step",
      variants: 15,
      splitLabel: "Difficulty band",
      splits: ["EASY (5 groups)", "MEDIUM (5 groups)", "HARD (5 groups)"],
      scoring: [
        { label: "Held-out stage score (mean over trials)", weight: 1.00 },
      ],
      notes: "The HARD band is doors and enclosed cavities — kept in the suite because a benchmark needs a floor that is known to be uncleared.",
    },
    {
      id: "task05",
      num: "05",
      name: "Blind Pose Estimation",
      short: "Pose Estimation",
      costShare: 0.07,
      tagline: "Multi-shape 6-DoF pose under adversarial sensing",
      description:
        "Four subtasks share one blind three-shape renderer the agent never sees, varying only the exposed modalities, the required method and the hardware — from RGB-only on CPU, through a mandatory trained TorchScript model, to an unrestricted method on GPU.",
      aggregate: "mean",
      gpu: "2 of 4",
      agentLimit: "2 h",
      verifierLimit: "0.5 h",
      variants: 4,
      splitLabel: "Subtask",
      splits: ["rgb-only", "rgb-depth", "model-training", "method-agnostic"],
      scoring: [
        { label: "Translation accuracy", weight: 0.40 },
        { label: "Rotation accuracy", weight: 0.35 },
        { label: "Shape identification", weight: 0.15 },
        { label: "Contract & determinism gates", weight: 0.10 },
      ],
      notes: "Meshes and canonical assets live in robobench/; the agent's build context is generated, never committed.",
    },
    {
      id: "task06",
      num: "06",
      name: "Bin Clearing",
      short: "Bin Clearing",
      costShare: 0.11,
      tagline: "Ship a closed-loop policy scored on hidden pile seeds",
      description:
        "A magnet-tipped Panda must singulate stamped brackets from a bin into a conveyor nest, from RGB-D, robot state, force-torque and magnet observations. The verifier reruns the submitted policy in sandboxed subprocesses on eight hidden piles, behind smoke episodes that gate loading, contract compliance and determinism.",
      aggregate: "mean",
      gpu: false,
      agentLimit: "4 h",
      verifierLimit: "2 h",
      variants: 1,
      splitLabel: "Reward component",
      splits: ["Clearance", "Throughput", "Perfect clear", "Safety"],
      scoring: [
        { label: "Clearance (weighted to the last parts)", weight: 0.45 },
        { label: "Throughput (parts / min)", weight: 0.25 },
        { label: "Perfect clear bonus", weight: 0.15 },
        { label: "Safety penalties avoided", weight: 0.15 },
      ],
      notes: "The policy's RNG seed is derived with a verifier-only key, so an evaluation pile cannot be reconstructed.",
    },
    {
      id: "task08",
      num: "08",
      name: "Tabletop Reasoning",
      short: "Tabletop Reasoning",
      costShare: 0.12,
      tagline: "Five physical-reasoning problems with perception removed from the equation",
      description:
        "Only the full L3 harness ships here — skill library, privileged poses, perception service — so perception is out of the problem and the reasoning is not. Five tabletop problems, from building the tallest stable tower to packing six items so they survive a shake.",
      aggregate: "mean",
      gpu: true,
      agentLimit: "8 h + 1 h",
      verifierLimit: "per step",
      variants: 5,
      splitLabel: "Scenario",
      splits: ["Tower height", "Cantilever", "Balance coins", "Stability packing", "Fragile grasp"],
      scoring: [
        { label: "Continuous scenario score (mean over trials)", weight: 1.00 },
      ],
      notes: "Scores are continuous, not pass/fail — settled tower height, overhang past the edge, weighings used, items surviving the shake.",
    },
    {
      id: "task09",
      num: "09",
      name: "Humanoid Motion Tracking",
      short: "Motion Tracking",
      costShare: 0.09,
      tagline: "Write a whole-body tracking training pipeline, scored sim-to-sim",
      description:
        "Five independent tasks, one per retargeted LAFAN1 clip, sharing one evaluation contract. The agent writes a training pipeline for a Unitree G1 whole-body tracking controller; the image ships a deliberately ordinary one-hour PPO recipe it may use, modify or ignore.",
      aggregate: "mean",
      gpu: true,
      agentLimit: "4 h",
      verifierLimit: "1 h",
      variants: 5,
      splitLabel: "Motion (20 s clip)",
      splits: ["Dance", "Fight", "Fall & get up", "Run", "Sprint"],
      scoring: [
        { label: "Multi-scale tracking error", weight: 0.70 },
        { label: "Survival & gate compliance", weight: 0.30 },
      ],
      notes: "Only the dance thresholds are calibrated today; the other four motions currently copy them with calibrated=false.",
    },
  ],

  /* --- PLACEHOLDER scores, per split, 0.00–1.00 --------------------------- */
  scores: {
    task01: {
      opus5:   [0.78, 0.61, 0.74], sonnet5: [0.71, 0.54, 0.68],
      gpt52:   [0.75, 0.58, 0.71], gemini3: [0.72, 0.56, 0.70],
      glm52:   [0.58, 0.41, 0.55], ds4:     [0.55, 0.38, 0.52],
      qwen3max:[0.60, 0.44, 0.57], kimi25:  [0.49, 0.33, 0.47],
      oracle:  [0.83, 0.58, 0.81],
    },
    task02: {
      opus5:   [0.69, 0.64, 0.66], sonnet5: [0.58, 0.53, 0.55],
      gpt52:   [0.72, 0.66, 0.68], gemini3: [0.63, 0.59, 0.60],
      glm52:   [0.44, 0.40, 0.42], ds4:     [0.47, 0.42, 0.44],
      qwen3max:[0.41, 0.37, 0.39], kimi25:  [0.36, 0.31, 0.34],
      oracle:  [0.79, 0.74, 0.76],
    },
    task03: {
      opus5:   [0.31, 0.52, 0.68], sonnet5: [0.22, 0.41, 0.57],
      gpt52:   [0.28, 0.49, 0.64], gemini3: [0.26, 0.47, 0.63],
      glm52:   [0.12, 0.27, 0.41], ds4:     [0.15, 0.31, 0.44],
      qwen3max:[0.11, 0.25, 0.38], kimi25:  [0.08, 0.20, 0.33],
      oracle:  [0.40, 0.63, 0.79],
    },
    task04: {
      opus5:   [0.54, 0.33, 0.06], sonnet5: [0.42, 0.24, 0.03],
      gpt52:   [0.51, 0.30, 0.05], gemini3: [0.48, 0.29, 0.04],
      glm52:   [0.26, 0.13, 0.01], ds4:     [0.29, 0.15, 0.02],
      qwen3max:[0.24, 0.12, 0.01], kimi25:  [0.19, 0.09, 0.00],
      oracle:  [0.66, 0.44, 0.11],
    },
    task05: {
      opus5:   [0.57, 0.74, 0.66, 0.79], sonnet5: [0.48, 0.65, 0.55, 0.69],
      gpt52:   [0.61, 0.77, 0.71, 0.82], gemini3: [0.59, 0.75, 0.68, 0.80],
      glm52:   [0.34, 0.49, 0.41, 0.53], ds4:     [0.38, 0.53, 0.46, 0.58],
      qwen3max:[0.36, 0.51, 0.43, 0.55], kimi25:  [0.28, 0.42, 0.34, 0.46],
      oracle:  [0.68, 0.85, 0.80, 0.88],
    },
    task06: {
      opus5:   [0.66, 0.51, 0.34, 0.88], sonnet5: [0.55, 0.42, 0.22, 0.83],
      gpt52:   [0.62, 0.48, 0.29, 0.85], gemini3: [0.59, 0.45, 0.27, 0.86],
      glm52:   [0.37, 0.26, 0.09, 0.72], ds4:     [0.40, 0.29, 0.12, 0.74],
      qwen3max:[0.35, 0.24, 0.08, 0.70], kimi25:  [0.29, 0.19, 0.05, 0.66],
      oracle:  [0.78, 0.63, 0.46, 0.92],
    },
    task08: {
      opus5:   [0.62, 0.48, 0.71, 0.55, 0.44], sonnet5: [0.51, 0.38, 0.62, 0.45, 0.35],
      gpt52:   [0.58, 0.51, 0.74, 0.52, 0.40], gemini3: [0.60, 0.46, 0.69, 0.53, 0.42],
      glm52:   [0.33, 0.24, 0.45, 0.29, 0.21], ds4:     [0.36, 0.27, 0.49, 0.32, 0.24],
      qwen3max:[0.31, 0.22, 0.43, 0.28, 0.20], kimi25:  [0.25, 0.17, 0.36, 0.22, 0.15],
      oracle:  [0.74, 0.61, 0.84, 0.68, 0.57],
    },
    task09: {
      opus5:   [0.58, 0.21, 0.29, 0.47, 0.38], sonnet5: [0.47, 0.14, 0.21, 0.38, 0.29],
      gpt52:   [0.54, 0.19, 0.26, 0.44, 0.35], gemini3: [0.56, 0.20, 0.27, 0.45, 0.36],
      glm52:   [0.31, 0.07, 0.11, 0.24, 0.17], ds4:     [0.34, 0.09, 0.13, 0.27, 0.19],
      qwen3max:[0.29, 0.06, 0.10, 0.23, 0.16], kimi25:  [0.23, 0.04, 0.07, 0.18, 0.12],
      oracle:  [0.64, 0.18, 0.24, 0.52, 0.41],
    },
  },
};

if (typeof module !== "undefined") module.exports = BENCH;
