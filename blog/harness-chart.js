/* Data-driven T01 interface comparison. No chart library or build step. */
(() => {
  'use strict';
  const figure = document.getElementById('harness-comparison');
  if (!figure) return;
  const panels = figure.querySelector('.harness-panels');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const levels = ['L1', 'L2', 'L3'];
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgNode = (name, attrs = {}, text) => {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  /* The figure reads assets/data/leaderboard.json (from assets/data/export.py) and picks the task named by
     data-task (default task01 = T01). Its per-level score is the mean verifier reward over the five kitchen
     tasks and its cost the mean API cost per run. A stand-alone {levels, models} file still works unchanged. */
  const adapt = data => {
    if (Array.isArray(data.levels)) return data;
    const taskId = figure.dataset.task || 'task01';
    const task = data.tasks?.[taskId], results = data.results?.[taskId] || {};
    if (!task || !Array.isArray(task.splits) || !Array.isArray(data.models)) throw new Error('Task missing from leaderboard data');
    const pick = (model, key) => Object.fromEntries(task.splits.map(split => {
      const value = results[model.id]?.splits?.[split.id]?.[key];
      return [split.id, Number.isFinite(value) ? value : null];
    }));
    return {
      levels: task.splits.map(split => split.id),
      models: data.models.filter(model => results[model.id]).map(model => ({name: model.name, success_rate: pick(model, 'score'), cost_usd: pick(model, 'cost_usd_mean')})),
    };
  };
  const validate = data => {
    if (JSON.stringify(data.levels) !== JSON.stringify(levels) || !Array.isArray(data.models) || !data.models.length) throw new Error('Invalid chart schema');
    const names = new Set();
    data.models.forEach(model => {
      if (typeof model.name !== 'string' || !model.name.trim() || names.has(model.name)) throw new Error('Invalid model name');
      names.add(model.name);
      ['success_rate', 'cost_usd'].forEach(metric => levels.forEach(level => {
        const value = model[metric]?.[level];
        if (value !== null && (!Number.isFinite(value) || value < 0 || (metric === 'success_rate' && value > 1))) throw new Error('Invalid value');
      }));
    });
  };
  const buildPanel = (data, metric, heading) => {
    const section = document.createElement('section');
    section.className = `harness-panel harness-${metric}`;
    const title = document.createElement('h3');
    title.id = `harness-${metric}-title`;
    title.textContent = heading;
    const scroll = document.createElement('div');
    scroll.className = 'harness-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-labelledby', title.id);
    const width = Math.max(600, data.models.length * 75 + 60);
    const left = 48, right = width - 15, top = 22, bottom = 260;
    const values = data.models.flatMap(model => levels.map(level => model[metric][level])).filter(value => value !== null);
    const largest = Math.max(1, ...values);
    const step = metric === 'success_rate' ? 0.2 : Math.pow(10, Math.floor(Math.log10(largest))) / 2;
    const max = metric === 'success_rate' ? 1 : Math.ceil(largest / (step * 4)) * step * 4;
    const format = value => metric === 'success_rate' ? `${Number((value * 100).toFixed(4))}%` : `$${value.toFixed(2)}`;
    const svg = svgNode('svg', {viewBox: `0 0 ${width} 328`, 'aria-labelledby': title.id, role: 'group'});
    for (let i = 0; i <= 4; i++) {
      const value = max * i / 4, y = bottom - (bottom - top) * i / 4;
      svg.append(svgNode('line', {x1: left, x2: right, y1: y, y2: y, class: 'harness-gridline'}));
      svg.append(svgNode('text', {x: left - 9, y: y + 4, 'text-anchor': 'end', class: 'harness-tick'}, metric === 'success_rate' ? `${Math.round(value * 100)}%` : `$${Number(value.toFixed(2))}`));
    }
    const groupWidth = (right - left) / data.models.length;
    const barWidth = Math.min(18, groupWidth / 4);
    data.models.forEach((model, index) => {
      const center = left + groupWidth * (index + 0.5);
      levels.forEach((level, levelIndex) => {
        const value = model[metric][level];
        const x = center + (levelIndex - 1.5) * (barWidth + 1.5);
        const label = `${model.name}, ${level}: ${value === null ? 'Not reported' : format(value)}`;
        const mark = value === null
          ? svgNode('text', {x: x + barWidth / 2, y: bottom - 6, 'text-anchor': 'middle', class: 'harness-missing'}, '—')
          : svgNode('rect', {x, y: bottom - value / max * (bottom - top), width: barWidth, height: value / max * (bottom - top), rx: 2, class: `harness-bar harness-${level.toLowerCase()}`, style: `--delay:${index * 45 + levelIndex * 35}ms`});
        mark.setAttribute('tabindex', '0');
        mark.setAttribute('aria-label', label);
        mark.append(svgNode('title', {}, label));
        svg.append(mark);
      });
      const label = svgNode('text', {x: center, y: bottom + 22, 'text-anchor': 'middle', class: 'harness-model'});
      const words = model.name.split(' ');
      const split = Math.ceil(words.length / 2);
      [words.slice(0, split).join(' '), words.slice(split).join(' ')].filter(Boolean).forEach((line, lineIndex) => label.append(svgNode('tspan', {x: center, dy: lineIndex ? 15 : 0}, line)));
      svg.append(label);
    });
    scroll.append(svg);
    const legend = document.createElement('div');
    legend.className = 'harness-legend';
    legend.setAttribute('aria-label', 'Interface levels');
    levels.forEach(level => {
      const item = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.className = `harness-${level.toLowerCase()}`;
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = level;
      item.append(swatch, label);
      legend.append(item);
    });
    section.append(title, legend, scroll);
    return section;
  };
  const reveal = () => figure.classList.add('is-revealed');
  fetch(figure.dataset.source, {cache: 'no-store'})
    .then(response => { if (!response.ok) throw new Error('Data unavailable'); return response.json(); })
    .then(raw => {
      const data = adapt(raw);
      validate(data);
      const built = [buildPanel(data, 'success_rate', 'Task success'), buildPanel(data, 'cost_usd', 'Cost (USD)')];
      panels.replaceChildren(...built);
      panels.hidden = false;
      figure.querySelector('.harness-fallback').hidden = true;
      figure.classList.add('is-ready');
      if (reduced.matches || !('IntersectionObserver' in window)) reveal();
      else {
        const observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) { requestAnimationFrame(reveal); observer.disconnect(); }
        }, {threshold: 0.15});
        observer.observe(panels);
      }
    })
    .catch(() => {
      const status = figure.querySelector('.harness-status');
      status.textContent = 'Chart data could not load. Showing the original figure.';
      status.hidden = false;
    });
  reduced.addEventListener('change', () => { if (reduced.matches) reveal(); });
})();
