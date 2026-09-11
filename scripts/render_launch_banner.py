"""Render the matching 1600 x 900 X post attachment from existing demo frames."""
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw
from render_launch_video import ROOT, OUT, BG, FG, MUTED, COLORS, txt, logo, panel, fit, graph


def main():
    im = Image.new('RGB', (1600, 900), BG)
    d = ImageDraw.Draw(im)
    logo(im, 56, 42, 100)
    txt(im, (183, 40), 'RLE-Bench', 84, bold=True)
    txt(im, (56, 181), 'A Qualifying Exam for Coding Agents', 58, bold=True)
    txt(im, (56, 253), 'as Robot Learning Engineers', 58, bold=True)

    sources = [
        ('assets/social/evaluation_ep0000.mp4', 120, 'crop=512:410:0:45'),
        ('assets/blog/demos/t04-final-sprint.mp4', 4.38, 'crop=360:320:140:35'),
        ('assets/social/task09-1080p50-10x.mp4', 3, 'crop=1320:930:300:150'),
        ('assets/blog/demos/section_3/gello-design-showcase-1080p-4x.mp4', 2.5, 'crop=1040:880:440:110'),
    ]
    labels = [('INTERACTIVE', 'CONTROL'), ('LEARNING', 'RECIPE'), ('PERCEPTION', ''), ('MECHANICAL', 'DESIGN')]
    counts = ['3 workflow / 35 tasks', '2 workflow / 9 tasks', '2 workflow / 5 tasks', '2 workflow / 6 tasks']
    with tempfile.TemporaryDirectory(prefix='rle-banner-') as cache:
        for i, (source, time, crop) in enumerate(sources):
            frame = Path(cache) / f'{i}.png'
            subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(time), '-i', str(ROOT/source), '-vf', crop, '-frames:v', '1', str(frame)], check=True)
            x, y, w = 56+i*378, 365, 354
            panel(im, (x, y, x+w, 748), color='#111922', outline=COLORS[i], width=2)
            for line, label in enumerate(labels[i]):
                txt(im, (x+20, y+17+line*39), label, 32, COLORS[i], bold=True)
            with Image.open(frame) as src:
                if i == 1:
                    im.paste(fit(src, w-4, 223), (x+2, y+109))
                else:
                    im.paste(fit(src, w-4, 223, cover=i==0), (x+2, y+109))
            if i == 1:
                panel(im, (x+12, y+246, x+170, y+324), color=BG)
                graph(im, (x+24, y+257, 131, 35))
                txt(im, (x+24, y+298), 'hillclimb', 17, COLORS[i], mono=True)
            txt(im, (x+20, 706), counts[i], 24, MUTED)
    txt(im, (56, 792), 'rle-bench.github.io', 48, FG, bold=True)
    for i,c in enumerate(COLORS):
        d.rectangle((56+i*378, 864, 410+i*378, 870), fill=c)
    im.save(OUT/'rle-bench-x-banner.png')
    im.save(OUT/'rle-bench-x-banner.jpg', quality=96, subsampling=0)
    print(OUT/'rle-bench-x-banner.png')


if __name__ == '__main__':
    main()
