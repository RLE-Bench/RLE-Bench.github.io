/* Curated, traceable Harbor reports. Unscored failures never acquire a y value. */
(() => {
  'use strict';
  const root = document.getElementById('t04-hillclimb');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const videoDialog = document.getElementById('hc-video-dialog');
  const video = videoDialog?.querySelector('video');
  videoDialog?.addEventListener('close', () => video.pause());
  videoDialog?.addEventListener('click', event => {
    if (event.target !== videoDialog) return;
    const rect = videoDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) videoDialog.close();
  });
  const showVideo = () => {
    if (!videoDialog || !video) return;
    if (!videoDialog.open) videoDialog.showModal();
    video.play().catch(() => {});
  };
  root.querySelector('.hc-final-link')?.addEventListener('click', event => {
    if (!videoDialog || !video) return;
    event.preventDefault();
    showVideo();
  });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, text) => {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,v));
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const clock = m => `${Math.floor(m/60)}h ${String(Math.floor(m%60)).padStart(2,'0')}m`;
  const colors = n => `var(--hc-${[3,15,45,145].includes(n) ? n : n===545 ? 15 : 'audit'})`;
  fetch(root.dataset.source).then(r => { if(!r.ok)throw Error(r.status); return r.json(); }).then(data => {
    const events = data.events;
    if(!Array.isArray(events) || events.some(e=>!Number.isFinite(e.minutes)||(e.score!==null && (!Number.isFinite(e.score)||e.score<0||e.score>1))))throw Error('Invalid timeline');
    let selected=events.at(-1);
    const plot=$('.hc-plot');
    const description = {
      110:'Scaling to 8,192 parallel worlds ran out of GPU memory during setup. The next run reduced this to 6,144 worlds and trained successfully.',
      167:'Noisy torso-height observations motivated eight frames of history and a noise-free training critic. The first trained candidate later completed all 15 comparison episodes.',
      443:'The smoothed policy had passed 345 episodes, but two late falls appeared in a fresh 200-seed audit. This reopened final checkpoint selection.',
      458:'Astra selected a model that completed all 545 development test runs without falling. Each run lasted 20 seconds and used a different random seed. Its average tracking score was 91.24 out of 100. Some earlier candidates scored slightly higher, but fell in additional tests, so Astra chose this model for its more consistent completion.'
    };
    function select(event) {
      selected=event;
      $('.hc-selection h4').textContent=event.label;
      $('.hc-selection > p').textContent=description[event.step]||event.evidence;
      $('.hc-selection blockquote').textContent=event.evidence;
      $('.hc-evidence-source').textContent=`Harbor trajectory · step ${event.step} · ${event.timestamp}`;
      plot.querySelectorAll('[data-id]').forEach(n=>{n.classList.toggle('hc-selected',n.dataset.id===event.id);n.setAttribute('aria-pressed',String(n.dataset.id===event.id));});
    }
    function point(event,x,y,kind='score') {
      const milestone = kind==='score' && [119,180,240,458].includes(event.step);
      const color = kind==='event'?'var(--hc-fail)':colors(event.seeds);
      const g=svg('g', {class:'hc-point','data-id':event.id,tabindex:0,role:'button','aria-label':`${clock(event.minutes)}. ${event.label}. ${event.score===null?'No reported score':(event.score*100).toFixed(2)+' out of 100, '+event.seeds+' evaluation seeds'}`});
      g.append(svg('circle',{cx:x,cy:y,r:milestone?19:13,fill:color,class:'hc-halo'}));
      g.append(svg('circle',{cx:x,cy:y,r:12,fill:'transparent'}));
      if(milestone)g.append(svg('circle',{cx:x,cy:y,r:13,fill:'var(--surface-1)',stroke:color,'stroke-width':2.5}));
      if(event.outcome==='rejected'||kind==='event')g.append(svg('path',{d:`M${x-4},${y-4}l8,8m0,-8l-8,8`,stroke:color,'stroke-width':2,fill:'none'}));
      else if(event.outcome==='selected')g.append(svg('path',{d:`M${x},${y-8}l8,8l-8,8l-8,-8Z`,fill:color,stroke:'var(--surface-1)','stroke-width':1.5}));
      else g.append(svg('circle',{cx:x,cy:y,r:milestone?8:4.5,fill:color,stroke:'var(--surface-1)','stroke-width':1.5}));
      if(event.step===458) {
        g.setAttribute('aria-haspopup','dialog');
        g.setAttribute('aria-controls','hc-video-dialog');
        g.setAttribute('aria-label',g.getAttribute('aria-label')+'. Play final policy video');
      }
      const activate=()=>{select(event);if(event.step===458)showVideo();};
      g.addEventListener('pointerenter',()=>select(event));
      g.addEventListener('click',activate);g.addEventListener('focus',()=>select(event));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
      plot.append(g);
    }
    function draw() {
      plot.replaceChildren(svg('title',{},'T04 development: tracking score over elapsed wall time'),svg('desc',{},'Separate colors and lines for evaluation seed counts. The upper y-axis shows 60–95 and a compressed lower region shows 0–60, separated by a marked axis break. Shading extends to zero. Crosses below the plot mark failed or revisited attempts in time. Select a point to read its log evidence.'));
      const lo=0, hi=240, ymin=.60, ymax=.95;
      const L=66,R=960,T=132,B=408, lowerTop=430, zeroY=518;
      const x=m=>L+(m-lo)/(hi-lo)*(R-L),y=s=>s<ymin ? zeroY-s/ymin*(zeroY-lowerTop) : B-(s-ymin)/(ymax-ymin)*(B-T);
      const ticks=[0,.60,.70,.80,.90,.95];
      ticks.forEach(t=>{plot.append(svg('line',{x1:L,x2:R,y1:y(t),y2:y(t),class:'hc-grid'}),svg('text',{x:L-12,y:y(t)+4,'text-anchor':'end'},(t*100).toFixed(0)));});
      for(let t=lo;t<=hi;t+=30) plot.append(svg('text',{x:x(t),y:zeroY+24,'text-anchor':'middle',class:'hc-axis'},clock(t)));
      plot.append(svg('text',{x:L,y:110,class:'hc-axis'},'TRACKING_MULTI × 100 · HIGHER IS BETTER'),svg('text',{x:R,y:zeroY+48,'text-anchor':'end',class:'hc-axis'},'ELAPSED WALL TIME / REPORT TIMESTAMP'));
      const shown=events.filter(e=>e.score!==null&&e.minutes>=lo&&e.score>=0&&e.score<=ymax);
      const defs=svg('defs'), clip=svg('clipPath',{id:'hc-score-regions'});
      clip.append(svg('rect',{x:L,y:T,width:R-L,height:B-T}),svg('rect',{x:L,y:lowerTop,width:R-L,height:zeroY-lowerTop}));
      defs.append(clip);plot.append(defs);
      plot.append(svg('path',{d:`M${L-7},${B+8}l14,6m-14,0l14,6`,stroke:'var(--text-muted)','stroke-width':1.5,fill:'none'}),svg('text',{x:270,y:477,class:'hc-axis'},'AXIS BREAK · 0–60 COMPRESSED'));
      const seriesByCohort=[3,15,45,145].map(n=>({n,series:shown.filter(e=>e.seeds===n&&['improved','audit'].includes(e.outcome))}));
      const curve=series=>series.map((e,i)=>`${i?'L':'M'}${x(e.minutes)},${y(e.score)}`).join(' ');
      // A split axis retains early scores; clip the discontinuity in both lines and fills.
      seriesByCohort.forEach(({n,series})=>{
        if(series.length>1)plot.append(svg('path',{class:'hc-area','clip-path':'url(#hc-score-regions)',d:`${curve(series)} L${x(series.at(-1).minutes)},${zeroY} L${x(series[0].minutes)},${zeroY} Z`,fill:colors(n),'fill-opacity':.13,stroke:'none','pointer-events':'none'}));
      });
      seriesByCohort.forEach(({n,series})=>{
        if(series.length>1)plot.append(svg('path',{'clip-path':'url(#hc-score-regions)',d:curve(series),fill:'none',stroke:colors(n),'stroke-width':2.5,opacity:.95}));
      });
      const callouts=[
        [119,66,['Match floor friction','Start 25% of episodes','at the clip beginning']],
        [180,300,['Increase history: 3 → 8','Give the training critic','noise-free observations']],
        [240,550,['Add reference-motion','velocity, tilt and height','as policy inputs']],
        [458,785,['Average 3 checkpoints','545 seeds × 20 s each','All runs finish; no falls']]
      ];
      callouts.forEach(([step,tx,lines])=>{
        const e=shown.find(e=>e.step===step);if(!e)return;
        const label=svg('text',{x:tx,y:26,class:'hc-callout'});
        lines.forEach((line,i)=>label.append(svg('tspan',{x:tx,dy:i?23:0},line)));
        plot.append(svg('path',{d:`M${tx},${26+(lines.length-1)*23+12}L${x(e.minutes)},${y(e.score)-15}`,fill:'none',class:'hc-callout-guide',stroke:colors(e.seeds)}),label);
      });
      shown.forEach(e=>{
        point(e,x(e.minutes),y(e.score));
        if(e.score<ymin)plot.append(svg('text',{x:x(e.minutes)+13,y:y(e.score)+4,class:'hc-early-score'},(e.score*100).toFixed(1)));
      });
      plot.append(svg('line',{x1:L,x2:R,y1:586,y2:586,class:'hc-grid'}),svg('text',{x:L,y:575,class:'hc-axis'},'FAILED / REVISITED ATTEMPTS · TIME ONLY'));
      const failures=[[53,'Survival regresses'],[110,'GPU out of memory'],[198,'Feed-forward falls'],[375,'Smoothing tradeoff'],[443,'2 fresh-seed falls']];
      failures.forEach(([step,label],i)=>{
        const e=events.find(e=>e.step===step), px=x(e.minutes),py=603+(i%2)*25;
        if(e.minutes<lo)return;
        plot.append(svg('line',{x1:px,x2:px,y1:586,y2:py-7,class:'hc-guide'}));point(e,px,py,'event');
        plot.append(svg('text',{x:px+(px>840?-10:10),y:py+3,'text-anchor':px>840?'end':'start',class:'hc-event-label'},label));
      });
      select(selected);
    }
    $('.hc-status').hidden=true; $('.hc-interactive').hidden=false;
    draw();
  }).catch(()=>{$('.hc-status').textContent='The interactive timeline could not load. The development summary remains available in the article.';});
})();
