#!/usr/bin/env python3
"""Recreate the T01 chart from the original PDF's vector bars.

Requires matplotlib and pdfplumber. The PDF is the source of the plotted
values, not a record of the underlying trials. Missing bars stay missing.
"""
from pathlib import Path
import csv
import json
import hashlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/blog'
SOURCE = OUT / 'harness-comparison.pdf'
MODELS = ['GPT-6 Astra', 'GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna',
          'Claude Opus 5', 'Claude Opus 4.8', 'Gemini 3.7 Flash', 'GLM 5.3 Flash']
LABELS = ['GPT-6\nAstra', 'GPT-5.6\nSol', 'GPT-5.6\nTerra', 'GPT-5.6\nLuna',
          'Claude\nOpus 5', 'Claude\nOpus 4.8', 'Gemini 3.7\nFlash', 'GLM 5.3\nFlash']
THEMES = {
    'light': dict(bg='#fcfcfb', ink='#292c30', muted='#737878', grid='#e5e8e7',
                  colors=['#477cc4', '#288d85', '#bc812b']),
    'dark': dict(bg='#1a1a19', ink='#e5e5df', muted='#a1a8a8', grid='#333837',
                 colors=['#79a5e5', '#68bab0', '#dfb16a']),
}


def extract_values():
    with pdfplumber.open(SOURCE) as pdf:
        page = pdf.pages[0]
        frames = sorted([r for r in page.rects if abs(r['width'] - 215.21) < .001], key=lambda r: r['x0'])
        assert len(frames) == 2
        panels = []
        for metric, frame in zip(['success', 'cost'], frames):
            bars = [r for r in page.rects if abs(r['y0'] - frame['y0']) < .00001
                    and frame['x0'] < r['x0'] < frame['x1'] and r['width'] < 10]
            # In the PDF each series is drawn left to right; geometric x
            # positions identify model slots even when all three bars are absent.
            series = sorted({tuple(r['non_stroking_color']) for r in bars},
                            key=lambda color: min(r['x0'] for r in bars if tuple(r['non_stroking_color']) == color))
            assert len(series) == 3
            first = min(r['x0'] for r in bars)
            stride = 26.5980325
            bar_width = bars[0]['width']
            if metric == 'success':
                scale = frame['height']  # plotted axis is 0 to 1
            else:
                grid = sorted({line['y0'] for line in page.lines
                               if abs(line['x0'] - frame['x0']) < .00001
                               and abs(line['x1'] - frame['x1']) < .00001
                               and line['y0'] == line['y1']})
                assert len(grid) == 9  # labelled $0, $10, ... $80
                scale = (grid[-1] - grid[0]) / 80
            values = [[None] * 3 for _ in MODELS]
            for r in bars:
                level = series.index(tuple(r['non_stroking_color']))
                slot = round((r['x0'] - first - level * bar_width) / stride)
                value = (r['y1'] - r['y0']) / scale
                rounded = round(value, 2)
                assert abs(value - rounded) < .000001
                assert 0 <= slot < len(MODELS) and values[slot][level] is None
                values[slot][level] = rounded
            panels.append(values)
        assert sum(v is not None for row in panels[0] for v in row) == 24
        assert sum(v is not None for row in panels[1] for v in row) == 21
        assert panels[1][6] == [None, None, None]
        return panels


def render(metric, rows, theme):
    style = THEMES[theme]
    fig = plt.figure(figsize=(540 / 72, 670 / 72), facecolor=style['bg'])
    ax = fig.add_axes([.27, .065, .66, .86], facecolor=style['bg'])
    ax.set_xlim(0, 115 if metric == 'success' else 99)
    ax.set_ylim(7.6, -.7)
    ticks = [0, 25, 50, 75, 100] if metric == 'success' else [0, 20, 40, 60, 80]
    ax.set_xticks(ticks)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda x, _: f'{x:.0f}%' if metric == 'success' else f'${x:.0f}'))
    ax.tick_params(axis='x', length=0, pad=13, labelsize=14, colors=style['muted'])
    ax.set_yticks(range(8), LABELS)
    ax.tick_params(axis='y', length=0, pad=16, labelsize=17, colors=style['ink'])
    for label in ax.get_yticklabels():
        label.set_ha('right')
        label.set_linespacing(1.3)
    ax.grid(axis='x', color=style['grid'], linewidth=.7, zorder=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    for i, row in enumerate(rows):
        if all(v is None for v in row):
            ax.text(3, i, 'Not reported', ha='left', va='center', fontsize=14,
                    color=style['muted'], fontstyle='italic')
            continue
        for level, value in enumerate(row):
            if value is None:
                continue
            value = value * 100 if metric == 'success' else value
            y = i + (level - 1) * .23
            bar = ax.barh(y, value, height=.145, color=style['colors'][level], zorder=3)[0]
            bar.set_gid(f'{metric}-model-{i}-L{level + 1}')
            label = f'{value:.0f}%' if metric == 'success' else f'{value:.2f}'
            ax.text(value + 1.8, y, label, va='center', fontsize=15,
                    color=style['ink'], fontfamily='DejaVu Sans Mono')
    fig.text(.035, .97, 'Task success' if metric == 'success' else 'Cost',
             fontsize=23, color=style['ink'], va='top')
    fig.text(.93, .965, 'Higher is better' if metric == 'success' else 'USD · Lower is better',
             fontsize=13, color=style['muted'], ha='right', va='top')
    desc = 'T01 interface comparison. Bars run top to bottom: L1 low-level interface, L2 reusable tools, L3 privileged scene state. ' + ('Success on a fixed 0–100% scale.' if metric == 'success' else 'Cost in USD on a linear scale. Gemini 3.7 Flash cost is not reported.')
    fig.savefig(OUT / f'harness-{metric}-{theme}.svg', metadata={'Date': None, 'Description': desc})
    plt.close(fig)


if __name__ == '__main__':
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'svg.fonttype': 'path', 'svg.hashsalt': 'rle-t01-interface'})
    success, cost = extract_values()
    with (OUT / 'harness-comparison-values.csv').open('w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['system', 'interface_level', 'success_rate', 'cost_usd'])
        for i, model in enumerate(MODELS):
            for level in range(3):
                writer.writerow([model, f'L{level + 1}', f'{success[i][level]:.2f}',
                                 '' if cost[i][level] is None else f'{cost[i][level]:.2f}'])
    provenance = {'source': 'harness-comparison.pdf', 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                  'method': 'Recover vector bar heights relative to labelled linear axes; round to two decimals. These are plotted values, not underlying trial data.',
                  'missing': 'The source contains no cost bars for Gemini 3.7 Flash; CSV cells remain empty.',
                  'series_order': ['L1', 'L2', 'L3'], 'source_model_order_preserved': True,
                  'generator': 'scripts/render_harness_chart.py'}
    (OUT / 'harness-comparison-values.json').write_text(json.dumps(provenance, indent=2) + '\n')
    for theme in THEMES:
        render('success', success, theme)
        render('cost', cost, theme)
    print(json.dumps({'success': success, 'cost': cost}, indent=2))
