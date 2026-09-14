const {test} = require('node:test');
const assert = require('node:assert/strict');
const leaderboard = require('../leaderboard.js');
const catalog = require('../data.js');
const results = require('../assets/data/leaderboard.json');
const build = data => leaderboard.view(leaderboard.merge(structuredClone(catalog), data));
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;

test('current results use equal workflow weights and include every exported task and model', () => {
  const view = build(results);
  assert.equal(view.models.length, results.models.filter(model => !model.baseline).length);
  assert.deepEqual([...view.snapshotIds].sort(), Object.keys(results.scores).sort());
  const groups = [['task01', 'task02', 'task03'], ['task04', 'task05'], ['task06', 'task07'], ['task08', 'task09']];
  for (const model of view.models) {
    const values = groups.map(group => group.filter(id => results.scores[id]).map(id => results.results[id]?.[model.id]?.score)).filter(group => group.length);
    const expected = values.length && values.flat().every(Number.isFinite) ? average(values.map(average)) : null;
    assert.equal(view.indexScore(model), expected, model.id);
  }
});

test('missing model results withhold its workflow and overall score without becoming zero', () => {
  const data = structuredClone(results);
  const model = data.models[0];
  delete data.results.task01[model.id];
  delete data.scores.task01[model.id];
  const view = build(data);
  assert.equal(view.familyScore(view.tasks.find(task => task.id === 'task01'), model), null);
  assert.equal(view.workflowScore(view.workflows.find(workflow => workflow.id === 'control'), model), null);
  assert.equal(view.indexScore(model), null);
  assert.ok(Number.isFinite(view.workflowScore(view.workflows.find(workflow => workflow.id === 'policy'), model)));
});

test('a newly reported task enters the index, while an unreported task is excluded', () => {
  const data = structuredClone(results);
  delete data.scores.task05;
  delete data.results.task05;
  const before = build(data), after = build(results), model = results.models[0];
  assert.equal(before.snapshotIds.has('task05'), false);
  assert.equal(after.snapshotIds.has('task05'), true);
  assert.equal(before.workflowScore(before.workflows.find(workflow => workflow.id === 'policy'), model), data.results.task04[model.id].score);
  assert.notEqual(before.indexScore(model), after.indexScore(model));
});

test('verifier rewards, including zero and gated rewards, override split aggregation', () => {
  const data = structuredClone(results), model = data.models[0];
  data.scores.task08[model.id] = data.tasks.task08.splits.map(() => 1);
  data.results.task08[model.id].score = 0.15;
  let view = build(data);
  assert.equal(view.familyScore(view.tasks.find(task => task.id === 'task08'), model), 0.15);
  data.results.task08[model.id].score = 0;
  view = build(data);
  assert.equal(view.familyScore(view.tasks.find(task => task.id === 'task08'), model), 0);
});

test('legacy split fallback handles minimum, weighted scores, and missing splits', () => {
  const data = structuredClone(results), model = data.models[0];
  delete data.results;
  data.tasks.task08 = {splits: ['a', 'b'], aggregate: 'weighted', weights: [1, 3]};
  data.scores.task08[model.id] = [0.2, 0.6];
  let view = build(data);
  assert.ok(Math.abs(view.familyScore(view.tasks.find(task => task.id === 'task08'), model) - 0.5) < 1e-12);
  data.tasks.task08.aggregate = 'min';
  view = build(data);
  assert.equal(view.familyScore(view.tasks.find(task => task.id === 'task08'), model), 0.2);
  data.scores.task08[model.id][0] = null;
  view = build(data);
  assert.equal(view.familyScore(view.tasks.find(task => task.id === 'task08'), model), null);
});

test('new model/harness combinations appear automatically and reference baselines stay excluded', () => {
  const data = structuredClone(results);
  data.models.push({...data.models[0], id: 'new-harness', harness: 'New harness'});
  data.models.push({...data.models[0], id: 'reference', baseline: true});
  const view = build(data);
  const added = view.models.find(model => model.id === 'new-harness');
  assert.ok(added);
  assert.equal(view.indexScore(added), null);
  assert.equal(view.models.some(model => model.baseline), false);
});

test('loading revalidates the JSON and rejects HTTP errors or malformed data', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => ({ok: true, json: async () => results}));
  const bench = structuredClone(catalog);
  await leaderboard.load(bench, '../assets/data/leaderboard.json');
  assert.deepEqual(fetch.mock.calls[0].arguments, ['../assets/data/leaderboard.json', {cache: 'no-cache'}]);
  assert.equal(bench.meta.dataStatus, results.status);
  fetch.mock.mockImplementation(async () => ({ok: false, status: 503}));
  await assert.rejects(leaderboard.load(bench, 'results.json'), /HTTP 503/);
  fetch.mock.mockImplementation(async () => ({ok: true, json: async () => ({})}));
  await assert.rejects(leaderboard.load(bench, 'results.json'), /Invalid leaderboard data/);
});
