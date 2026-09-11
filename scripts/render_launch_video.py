"""Render the 11.5 s launch montage. Requires Pillow and ffmpeg on PATH.

Run: python3 scripts/render_launch_video.py
Source clips remain unchanged; typography and layout are composited at 1080p.
"""
from pathlib import Path
import json
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/social'
OUT.mkdir(exist_ok=True)
FPS, W, H = 30, 1080, 1080
BG, FG, MUTED = '#101817', '#f4f4e9', '#a8b7ae'
# Homepage palette: red, yellow, blue, green in montage order.
COLORS = ['#e34948', '#eda100', '#3987e5', '#1baf7a']
LABELS = ['INTERACTIVE CONTROL', 'LEARNING RECIPE', 'PERCEPTION', 'MECHANICAL DESIGN']
FONTDIR = Path('/System/Library/Fonts')
def font(size, bold=False, mono=False):
    filename = 'Menlo.ttc' if mono else 'Avenir Next.ttc'
    index = (1 if bold else 0) if mono else (2 if bold else 7)
    return ImageFont.truetype(str(FONTDIR / filename), size, index=index)

def txt(im, pos, text, size=30, color=FG, bold=False, mono=False):
    ImageDraw.Draw(im).text(pos, text, font=font(size,bold,mono), fill=color, stroke_width=0)

def panel(im, box, color='#1b2723', outline='#35443b', width=1):
    ImageDraw.Draw(im).rounded_rectangle(box, radius=18, fill=color, outline=outline, width=width)

def logo(im, x, y, size):
    with Image.open(ROOT/'assets/icon.png') as source:
        mark=source.convert('RGB').resize((size,size),Image.Resampling.LANCZOS)
    mask=Image.new('L',(size,size),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,size-1,size-1),radius=round(size*.18),fill=255)
    im.paste(mark,(x,y),mask)

def fit(src, w, h, cover=False):
    ratio = max(w/src.width,h/src.height) if cover else min(w/src.width,h/src.height)
    resized=src.resize((round(src.width*ratio),round(src.height*ratio)),Image.Resampling.LANCZOS)
    result=Image.new('RGB',(w,h),'#111922')
    result.paste(resized,((w-resized.width)//2,(h-resized.height)//2))
    return result

def base(t):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    d.line((48,104,1032,104),fill='#34423a',width=1)
    logo(im,48,24,64)
    txt(im,(130,35),'RLE-Bench',32,bold=True)
    for i,c in enumerate(COLORS):
        d.rectangle((48+i*250,1040,282+i*250,1044),fill=c if t>=2+i*1.5 else '#35443b')
    return im

def graph(im,box,progress=1):
    x,y,w,h=box;d=ImageDraw.Draw(im)
    events=json.loads((ROOT/'assets/blog/t04-hillclimb.json').read_text())['events']
    # One evaluation cohort only; rounded development reports, not benchmark aggregates.
    es=[e for e in events if e['seeds']==3 and e['score'] is not None]
    pts=[(x+e['minutes']/125*w,y+h-e['score']*h) for e in es]
    for k in range(4):
        yy=y+k*h/3;d.line((x,yy,x+w,yy),fill='#34443e',width=1)
    n=max(2,round(len(pts)*progress));d.line(pts[:n],fill=COLORS[1],width=5)
    for px,py in pts[:n]: d.ellipse((px-4,py-4,px+4,py+4),fill=COLORS[1])

def main():
    clips=[
      ('assets/social/evaluation_ep0000.mp4',120,'setpts=(PTS-STARTPTS)/6,scale=720:720'),
      ('assets/blog/demos/t04-final-sprint.mp4',3.4,'setpts=(PTS-STARTPTS)/1.4,crop=360:320:140:35,scale=720:640'),
      ('assets/social/task09-1080p50-10x.mp4',2,'scale=960:540'),
      ('assets/blog/demos/section_3/gello-design-showcase-1080p-4x.mp4',1.5,'crop=1440:880:240:110,scale=960:586'),
    ]
    with tempfile.TemporaryDirectory(prefix='rle-launch-') as cache:
        cache=Path(cache)
        for i,(name,start,vf) in enumerate(clips):
            p=cache/str(i);p.mkdir()
            subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-stream_loop','-1','-i',str(ROOT/name),'-t','11.5','-vf',vf+',fps=30','-q:v','2',str(p/'%04d.jpg')],check=True)
        # Show the complete cube recording in 1.7 s, then hold its actual final frame.
        intro=cache/'intro';intro.mkdir()
        cube=ROOT/'assets/social/evaluation_ep0000.mp4'
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(cube)]))
        subprocess.run(['ffmpeg','-v','error','-i',str(cube),'-vf',f'setpts=(PTS-STARTPTS)/{duration/1.7},fps=30','-frames:v','51','-q:v','2',str(intro/'%04d.jpg')],check=True)
        subprocess.run(['ffmpeg','-v','error','-sseof','-0.1','-i',str(cube),'-frames:v','1','-q:v','2',str(intro/'final.jpg')],check=True)
        def clip(i,t,w,h,cover=False):
            frame=max(1,min(345,int(t*FPS)%345+1))
            with Image.open(cache/str(i)/f'{frame:04d}.jpg') as src:return fit(src,w,h,cover)
        encoder=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1080','-r','30','-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'rle-bench-x-launch.mp4')],stdin=subprocess.PIPE)
        snapshots=[]
        for frame in range(345):
            t=frame/FPS;im=base(t);d=ImageDraw.Draw(im)
            if t<2:
                txt(im,(48,140),'A Qualifying Exam',62,bold=True)
                txt(im,(48,218),'for Coding Agents',62,bold=True)
                txt(im,(48,296),'as Robot Learning Engineers',62,COLORS[0],True)
                source=intro/(f'{frame+1:04d}.jpg' if frame<51 else 'final.jpg')
                with Image.open(source) as cube_frame:
                    im.paste(fit(cube_frame,984,600,True),(48,418))
                d.rectangle((0,1035,W,H),fill=BG)
            elif t<8.5:
                i=0 if t<3.5 else 1 if t<5 else 2 if t<6.5 else 3
                local=t-[2,3.5,5,6.5][i]
                txt(im,(48,196),LABELS[i],66 if i<3 else 65,COLORS[i],True)
                desc=['3 workflow / 35 tasks','2 workflow / 9 tasks','2 workflow / 5 tasks','2 workflow / 6 tasks'][i]
                txt(im,(48,281),desc,32)
                panel(im,(48,359,1032,912),color='#111922',outline=COLORS[i],width=2)
                if i==0:
                    im.paste(clip(0,local,550,550),(265,361))
                elif i==1:
                    im.paste(clip(1,local,620,550,True),(410,361))
                    txt(im,(70,397),'PPO TRAINING',25,COLORS[1],True)
                    txt(im,(70,445),'6,144 parallel worlds',23,FG)
                    graph(im,(74,525,305,215),min(1,.25+local/.9))
                    txt(im,(74,760),'0                 125 min',18,MUTED,mono=True)
                    txt(im,(74,810),'Development tracking',21,MUTED)
                    txt(im,(74,842),'3-seed reports',21,MUTED)
                elif i==2:
                    im.paste(clip(2,local,980,550),(50,361))
                else:
                    im.paste(clip(3,local,980,550),(50,361))
                    txt(im,(73,382),'GELLO / GRAVITY-COMPENSATED LEADER ARM',22,COLORS[3],True)
                notes=['INTERACTIVE CONTROL  /  CUBE MANIPULATION  /  6x PLAYBACK','T04  /  PPO TRAINING + SPRINT ROLLOUT  /  1.4x PLAYBACK','T09  /  CONTACT-RICH BIN CLEARING  /  10x PLAYBACK','T07  /  CAD DESIGN  /  GUIDED VISUALIZATION'][i]
                txt(im,(48,938),notes,23,MUTED,mono=True)
                for j,c in enumerate(COLORS):
                    txt(im,(48+j*250,989),['Interactive control','Learning recipe','Perception','Mech. design'][j],24,c if i==j else MUTED,bold=i==j)
            else:
                d.rectangle((0,0,W,340),fill=BG)
                logo(im,48,36,144)
                txt(im,(220,40),'RLE-Bench',124,bold=True)
                txt(im,(48,200),'Systematically evaluating coding agents',44)
                txt(im,(48,254),'across robotics engineering tasks',44)
                for i in range(4):
                    x=48+(i%2)*504;y=345+(i//2)*267
                    panel(im,(x,y,x+480,y+248),color='#111922',outline=COLORS[i],width=2)
                    txt(im,(x+16,y+10),LABELS[i],32,COLORS[i],True)
                    if i==1:
                        im.paste(clip(i,t-8.5,264,191),(x+214,y+55))
                    else:
                        im.paste(clip(i,t-8.5,476,191,i==0),(x+2,y+55))
                    if i==1:
                        panel(im,(x+14,y+139,x+213,y+232),color=BG)
                        graph(im,(x+25,y+150,176,48))
                        txt(im,(x+25,y+203),'hillclimb',23,COLORS[1],mono=True)
                txt(im,(48,902),'Explore the benchmark',34,MUTED)
                txt(im,(48,953),'rle-bench.github.io',58,COLORS[0],True)
            encoder.stdin.write(im.tobytes())
            if frame in [30,82,127,172,225,315]:
                snapshots.append(im.resize((360,360)))
            if frame==315:im.save(OUT/'rle-bench-x-cover.jpg',quality=95)
        encoder.stdin.close()
        if encoder.wait():raise RuntimeError('ffmpeg encode failed')
        sheet=Image.new('RGB',(1080,720),BG)
        for n,im in enumerate(snapshots):sheet.paste(im,(n%3*360,n//3*360))
        sheet.save(OUT/'rle-bench-x-storyboard.jpg',quality=95)
    print(OUT/'rle-bench-x-launch.mp4')

if __name__=='__main__':main()
