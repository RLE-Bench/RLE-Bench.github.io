/* Shared result loading and scoring for the homepage and research blog. */
const RLELeaderboard = (() => {
  'use strict';
  const validScore = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

  function merge(bench, data) {
    if (!Array.isArray(data.models) || !data.scores || typeof data.scores !== 'object') {
      throw new Error('Invalid leaderboard data');
    }
    bench.models = data.models;
    bench.scores = data.scores;
    bench.costs = data.costs || {};
    bench.results = data.results || {};
    // The export owns split definitions; task descriptions remain in data.js.
    bench.tasks.forEach(task => {
      const exported = data.tasks?.[task.id];
      if (!exported || !Array.isArray(exported.splits)) return;
      task.splits = exported.splits.map(split => typeof split === 'string' ? split : split.label);
      if (exported.splitLabel) task.splitLabel = exported.splitLabel;
      if (exported.aggregate) task.aggregate = exported.aggregate;
      task.weights = Array.isArray(exported.weights) ? exported.weights : null;
    });
    bench.presentation.snapshotTaskIds = bench.tasks.filter(task => data.scores[task.id]).map(task => task.id);
    if (typeof data.status === 'string') bench.meta.dataStatus = data.status;
    return bench;
  }

  async function load(bench, source) {
    const response = await fetch(source, {cache: 'no-cache'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return merge(bench, await response.json());
  }

  function view(bench) {
    const order = bench.presentation.taskOrder || [];
    const originalOrder = new Map(bench.tasks.map((task, index) => [task.id, index]));
    const position = task => order.includes(task.id) ? order.indexOf(task.id) : order.length + originalOrder.get(task.id);
    const tasks = bench.tasks.map(task => ({...task, num: bench.presentation.taskNumbers?.[task.id] || task.num}))
      .sort((a, b) => position(a) - position(b));
    const snapshotIds = new Set(bench.presentation.snapshotTaskIds);
    const snapshotTasks = tasks.filter(task => snapshotIds.has(task.id));
    const workflows = (bench.presentation.workflows || []).map(workflow => ({
      ...workflow, tasks: workflow.tasks.map(id => tasks.find(task => task.id === id)).filter(Boolean),
    })).filter(workflow => workflow.tasks.length);
    const placed = new Set(workflows.flatMap(workflow => workflow.tasks.map(task => task.id)));
    const rest = tasks.filter(task => !placed.has(task.id));
    if (rest.length) workflows.push({id: 'other', name: 'Other tasks', tasks: rest});
    const models = bench.models.filter(model => !model.baseline);
    const splitValues = (task, model) => bench.scores[task.id]?.[model.id] || [];
    const familyScore = (task, model) => {
      // Verifier rewards preserve scoring gates; split aggregation is a legacy fallback.
      const reported = bench.results[task.id]?.[model.id]?.score;
      if (validScore(reported)) return reported;
      const values = splitValues(task, model);
      if (!values.length || values.length !== task.splits.length || !values.every(validScore)) return null;
      if (task.aggregate === 'min') return Math.min(...values);
      if (task.aggregate === 'weighted' && Array.isArray(task.weights) && task.weights.length === values.length) {
        const total = task.weights.reduce((sum, weight) => sum + weight, 0);
        return total > 0 ? values.reduce((sum, value, index) => sum + value * task.weights[index], 0) / total : null;
      }
      return mean(values);
    };
    const includedTasks = workflow => workflow.tasks.filter(task => snapshotIds.has(task.id));
    const workflowScore = (workflow, model, value = familyScore) => {
      const values = includedTasks(workflow).map(task => value(task, model));
      return values.length && values.every(Number.isFinite) ? mean(values) : null;
    };
    const includedWorkflows = workflows.filter(workflow => includedTasks(workflow).length);
    const hierarchical = (model, value) => {
      const values = includedWorkflows.map(workflow => workflowScore(workflow, model, value));
      return values.length && values.every(Number.isFinite) ? mean(values) : null;
    };
    const indexScore = model => hierarchical(model, familyScore);
    return {tasks, snapshotTasks, snapshotIds, workflows, models, splitValues, familyScore,
      includedTasks, workflowScore, hierarchical, indexScore};
  }

  return {load, merge, view, validScore, mean};
})();

if (typeof module !== 'undefined') module.exports = RLELeaderboard;
