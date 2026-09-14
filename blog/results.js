/* Blog leaderboards share the homepage's result source and scoring rules. */
(async () => {
  'use strict';
  const figures = [...document.querySelectorAll('.capability-figure')];
  const total = document.querySelector('#total-score-figure .capability-chart');
  const controls = [...document.querySelectorAll('.capability-figure [data-metric]')];
  const charts = [...figures.map(figure => figure.querySelector('.capability-chart')), total].filter(Boolean);
  const source = '../assets/data/leaderboard.json';
  const format = value => Number.isFinite(value) ? (value * 100).toFixed(2) : '—';
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  controls.forEach(button => { button.disabled = true; });
  charts.forEach(chart => chart.setAttribute('aria-busy', 'true'));

  try {
    await RLELeaderboard.load(BENCH, source);
    const view = RLELeaderboard.view(BENCH);
    const workflowIds = {perception: 'perception', embodiment: 'design', learning: 'policy', interactive: 'control'};
    const workflows = Object.fromEntries(Object.entries(workflowIds).map(([metric, id]) => [metric, view.workflows.find(workflow => workflow.id === id)]));
    const taskList = tasks => tasks.map(task => `T${task.num}`).join(', ');
    const coverage = workflow => {
      const included = view.includedTasks(workflow);
      const pending = workflow.tasks.filter(task => !view.snapshotIds.has(task.id));
      return `${workflow.name} · ${included.length ? taskList(included) : 'No reported tasks'}${pending.length ? ` · Not yet reported: ${taskList(pending)}` : ''}`;
    };
    const sorted = value => [...view.models].sort((a, b) => {
      const left = value(a), right = value(b);
      if (Number.isFinite(left) !== Number.isFinite(right)) return Number.isFinite(left) ? -1 : 1;
      return (Number.isFinite(left) ? right - left : 0) || a.name.localeCompare(b.name) || a.harness.localeCompare(b.harness);
    });
    const renderChart = (chart, value, title) => {
      const rows = sorted(value).map(model => {
        const score = value(model), reported = Number.isFinite(score);
        const row = make('div', `bar-row${reported ? '' : ' is-missing'}`);
        row.dataset.system = model.id;
        row.setAttribute('aria-label', `${model.name}, ${model.harness}: ${reported ? `${format(score)} out of 100` : 'Not reported; missing required task results'}`);
        const label = make('div', 'bar-label');
        label.append(make('strong', null, model.name), make('span', null, model.harness));
        const track = make('div', 'bar-track');
        track.setAttribute('aria-hidden', 'true');
        const fill = make('span', 'bar-fill');
        fill.style.width = `${reported ? score * 100 : 0}%`;
        track.append(fill);
        row.append(label, track, make('span', 'bar-value', format(score)));
        return row;
      });
      const axis = make('div', 'chart-axis');
      axis.setAttribute('aria-hidden', 'true');
      [0, 25, 50, 75, 100].forEach(tick => axis.append(make('span', null, tick)));
      chart.replaceChildren(...(rows.length ? rows : [make('p', 'results-status', 'No results reported yet.')]), axis);
      chart.setAttribute('aria-label', `${title}, zero to one hundred. A dash means required task results are missing.`);
      chart.setAttribute('aria-busy', 'false');
    };

    figures.forEach(figure => {
      const chart = figure.querySelector('.capability-chart');
      const buttons = [...figure.querySelectorAll('[data-metric]')];
      const setMetric = metric => {
        const workflow = workflows[metric];
        if (!chart || !workflow) return;
        chart.className = `capability-chart family-${metric}`;
        renderChart(chart, model => view.workflowScore(workflow, model), workflow.name);
        figure.querySelector('[data-chart-part="chartContext"]').textContent = coverage(workflow);
        buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === metric)));
        const announcement = figure.querySelector('[data-chart-part="chartAnnouncement"]');
        if (announcement) announcement.textContent = coverage(workflow);
      };
      setMetric(figure.dataset.initialMetric);
      buttons.forEach(button => {
        button.disabled = !workflows[button.dataset.metric] || !view.models.length;
        button.addEventListener('click', () => setMetric(button.dataset.metric));
      });
      figure.querySelector('.metric-tabs')?.addEventListener('keydown', event => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        const enabled = buttons.filter(button => !button.disabled);
        const index = enabled.indexOf(document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 :
          (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
        enabled[next].focus();
        enabled[next].click();
      });
    });
    if (total) renderChart(total, view.indexScore, 'RLE Index');
    document.querySelectorAll('[data-result]').forEach(node => {
      const [id, metric] = node.dataset.result.split('.');
      const model = view.models.find(record => record.id === id);
      const workflow = workflows[metric];
      node.textContent = format(model && workflow ? view.workflowScore(workflow, model) : null);
    });
    document.querySelectorAll('[data-workflow-coverage]').forEach(node => {
      const workflow = workflows[node.dataset.workflowCoverage];
      if (workflow) node.textContent = `${coverage(workflow)}.`;
    });
    const note = document.getElementById('coverage-note');
    if (note) {
      const pending = view.tasks.filter(task => !view.snapshotIds.has(task.id));
      note.textContent = `RLE Index · 0–100 · ${view.snapshotTasks.length} reported tasks. Tasks are averaged within each workflow, then across workflows. — = missing required task results; no overall score.${pending.length ? ` Not yet reported: ${taskList(pending)}.` : ''} `;
      const download = make('a', null, 'Data JSON');
      download.href = source;
      download.setAttribute('download', '');
      note.append(download);
    }
  } catch (error) {
    console.error('RLE-Bench: could not load blog leaderboard results', error);
    charts.forEach(chart => {
      const message = make('p', 'results-status', 'Results are temporarily unavailable. Reload the page to try again.');
      message.setAttribute('role', 'status');
      chart.replaceChildren(message);
      chart.setAttribute('aria-busy', 'false');
    });
    document.querySelectorAll('[data-chart-part="chartContext"]').forEach(node => { node.textContent = 'Current results unavailable.'; });
    const note = document.getElementById('coverage-note');
    if (note) note.textContent = 'Current results could not be loaded.';
    controls.forEach(button => { button.disabled = true; });
  }
})();
