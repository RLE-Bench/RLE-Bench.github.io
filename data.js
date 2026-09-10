/* ---------------------------------------------------------------------------
 * RLE-Bench leaderboard data
 *
 * !!! PLACEHOLDER RESULTS !!!
 * Public task descriptions, numbering and evaluation summaries follow blog/.
 * Result arrays retain the older eight-task development snapshot. They are
 * illustrative and must not be presented as the manuscript's measured results.
 * Legacy task IDs remain stable to preserve score associations and deep links.
 * presentation.snapshotTaskIds defines the unchanged mean-task-score coverage.
 * The current nanoVLA task has no result or cost data in this snapshot.
 *
 * Each scores[taskId][modelId] is an array aligned to that task's `splits`.
 * ------------------------------------------------------------------------- */

const BENCH = {
  // Public task numbers follow the research blog; legacy score keys remain unchanged.
  presentation: {
    taskOrder: ["task03", "task04", "task08", "task09", "nanovla", "task01", "task02", "task05", "task06"],
    snapshotTaskIds: ["task01", "task02", "task03", "task04", "task05", "task06", "task08", "task09"],
    taskNumbers: {task03: "01", task04: "02", task08: "03", task09: "04", nanovla: "05", task01: "06", task02: "07", task05: "08", task06: "09"},
  },
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
      name: "Universal mobile-manipulator base",
      short: "Mobile base design",
      costShare: 0.06,
      tagline: "Mechanical design and control across three robot arms",
      description: "Agents design a common mobile base and controller for Panda, UR5e, and xArm7 arms under physical and resource constraints. Evaluation tests shelf access, payload capacity, and static and dynamic stability using trusted arm models.",
      aggregate: "min",
      splitLabel: "Canonical arm",
      splits: ["Panda", "UR5e", "xArm7"],
      notes: "The submission consists of an MJCF mechanical design and controller code. Reach, payload handling, stability, and material use are assessed jointly.",
      development: "2 h",
      compute: "CPU",
      evaluation: "Each evaluation checkpoint is reduced to the lowest score across the three arms, requiring a single design to satisfy the constraints of every embodiment.",
    },
    {
      id: "task02",
      num: "02",
      name: "Lead arm gravity compensation design",
      short: "Lead arm design",
      costShare: 0.09,
      tagline: "Passive compensation and adaptive control for teleoperation",
      description: "Agents co-design gravity-compensation mechanisms and adaptive feedforward control for three GELLO leader arms. Mechanical designs and calibration programs are evaluated together under variation in physical parameters, joint configurations, and payloads.",
      aggregate: "mean",
      splitLabel: "Follower arm",
      splits: ["Franka (7 DoF)", "UR5e (6 DoF)", "xArm7 (7 DoF)"],
      notes: "The design must balance passive mechanical compensation with adaptable control for the Panda, UR5e, and xArm7 embodiments.",
      development: "3 h",
      compute: "CPU",
      evaluation: "Unseen physical instances and operating conditions test position holding, backdrivability, torque headroom, and recovery.",
    },
    {
      id: "task03",
      num: "03",
      name: "Agentic control",
      short: "Agentic control",
      costShare: 0.22,
      tagline: "Agent-in-the-loop control under three robotics interfaces",
      description: "Agents solve ten RoboCasa kitchen tasks through an iterative interaction loop. Three nested interfaces provide low-level observations and actions, reusable robotics tools, or additional privileged scene state. Tasks, evaluation seeds, interaction limits, and scoring remain fixed across interfaces.",
      aggregate: "mean",
      splitLabel: "Harness level",
      splits: ["L1 — action API only", "L2 — + harness library", "L3 — + privileged state"],
      notes: "Agent context and workspace code carry forward from development to evaluation. The agent remains responsible for interpreting observations and selecting actions.",
      development: "8 h",
      compute: "50,000 development steps",
      evaluation: "Task success is evaluated on held-out scenes and seeds. The interface comparison isolates the contribution of reusable robotics software and privileged state.",
    },
    {
      id: "task04",
      num: "04",
      name: "Harness engineering",
      short: "Harness engineering",
      costShare: 0.24,
      tagline: "Reusable perception and control tools for independent agents",
      description: "Agents develop perception functions, controllers, and a usage manual within a RoboCasa activity group. Five independent evaluation agents receive the resulting package and attempt a held-out task without the developer’s conversation or other workspace files.",
      aggregate: "mean",
      splitLabel: "Difficulty band",
      splits: ["EASY (5 groups)", "MEDIUM (5 groups)", "HARD (5 groups)"],
      notes: "Only the documented tool package transfers to evaluation. The held-out task requires evaluation agents to combine familiar primitives in a new configuration.",
      development: "8 h",
      compute: "75,000 development steps",
      evaluation: "Evaluation measures the task success achieved by fresh agents using the submitted harness. Development uses three tasks within each of fifteen activity groups.",
    },
    {
      id: "task05",
      num: "05",
      name: "Blind pose estimation",
      short: "Pose estimation",
      costShare: 0.07,
      tagline: "Planar object pose estimation under motion and occlusion",
      description: "Agents develop an estimator that identifies asymmetric objects and recovers their planar position and orientation. Four variants differ in sensing modalities, method requirements, and development compute. Hidden image frames and push trajectories test robustness to motion and partial occlusion.",
      aggregate: "mean",
      splitLabel: "Subtask",
      splits: ["rgb-only", "rgb-depth", "model-training", "method-agnostic"],
      notes: "The four variants cover RGB-only estimation, RGB-D estimation, required model training, and an unrestricted choice of estimation method.",
      development: "2 h",
      compute: "Variant-specific CPU/GPU",
      evaluation: "Submitted estimators or trained TorchScript models are evaluated on hidden observations. All inference runs on CPU, including models trained with GPU access.",
    },
    {
      id: "task06",
      num: "06",
      name: "Contact-rich bin clearing",
      short: "Bin clearing",
      costShare: 0.11,
      tagline: "Closed-loop manipulation with visual and force feedback",
      description: "Agents develop a standalone policy that transfers steel brackets from a cluttered bin to a conveyor using a magnet-equipped Panda arm. The policy integrates visual observations, robot state, and force feedback to maintain reliable performance as the pile changes.",
      aggregate: "mean",
      splitLabel: "Reward component",
      splits: ["Clearance", "Throughput", "Perfect clear", "Safety"],
      notes: "Evaluation executes the submitted policy under hidden physical conditions and checks its interface compliance and reproducibility.",
      development: "4 h",
      compute: "CPU",
      evaluation: "Eight hidden pile configurations assess clearance and throughput, with penalties for drops, damage, and excessive impacts.",
    },
    {
      id: "task08",
      num: "08",
      name: "Physical reasoning",
      short: "Physical reasoning",
      costShare: 0.12,
      tagline: "Interaction-based reasoning about physical properties",
      description: "Agents use interaction to solve six problems involving balance, overhang, packing, fragility, and hidden centers of mass. Most problems provide the L3 interface; the hidden-center-of-mass problem withholds the physical state that the agent must infer through probing.",
      aggregate: "mean",
      splitLabel: "Scenario",
      splits: ["Tower height", "Cantilever", "Balance coins", "Stability packing", "Fragile grasp"],
      notes: "Physical interaction provides evidence about properties that are not directly available in the observation interface.",
      development: "Task-specific",
      compute: "",
      evaluation: "Task-specific criteria assess the physical outcome or submitted answer. Evaluation distinguishes access to scene geometry from reasoning about unobserved physical properties.",
      resultNote: "The retained development snapshot covers five scenarios. Results for the hidden-center-of-mass problem are not reported.",
    },
    {
      id: "task09",
      num: "09",
      name: "Whole-body motion tracking",
      short: "Motion tracking",
      costShare: 0.09,
      tagline: "Humanoid policy training and deployment across simulators",
      description: "Agents train a Unitree G1 policy to follow reference motions while maintaining stability. Five motion clips share an evaluation contract. The exported ONNX policy is trained in MuJoCo-Warp and evaluated in MuJoCo-C under hidden perturbations.",
      aggregate: "mean",
      splitLabel: "Motion (20 s clip)",
      splits: ["Dance", "Fight", "Fall & get up", "Run", "Sprint"],
      notes: "Motion-specific calibration remains provisional; the development snapshot should not be interpreted as a finalized comparison across motion clips.",
      development: "4 h",
      compute: "1 GPU",
      evaluation: "Tracking accuracy and stability are evaluated across reference motions and deployment conditions. Cross-simulator evaluation tests the policy beyond its training environment.",
    },
    {
      id: "nanovla",
      num: "05",
      name: "nanoVLA recipe engineering",
      short: "nanoVLA recipes",
      tagline: "Executable training and serving recipes for vision-language-action models",
      description: "Agents develop a reproducible training or serving recipe across six tracks covering capability, efficiency, initialization, and robustness. The submitted solution.py is replayed by an independent verifier in a fresh environment before evaluation on private LIBERO episodes.",
      development: "4 h per track",
      compute: "",
      evaluation: "Evaluation measures the resulting model or serving procedure after independent replay of the submitted recipe.",
      notes: "The executable recipe is the evaluation artifact; the verifier reconstructs the resulting training or serving procedure independently.",
      aggregate: "mean",
      costShare: null,
      splits: [],
      splitLabel: "Track",
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
