/* RLE-Bench homepage. Vanilla JS; all results are read from the original BENCH.
   Data schema and numerical values are not changed by this presentation layer.
   Missing results never become zero, and incomplete agents receive no overall rank. */
(() => {
  'use strict';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const make = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=text; return n; };
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validScore = v => typeof v==='number' && Number.isFinite(v) && v>=0 && v<=1;
  const num = (v,d=1) => Number.isFinite(v) ? v.toFixed(d) : '—';
  const pct = (v,d=1) => Number.isFinite(v) ? (v*100).toFixed(d) : '—';
  const usd = v => Number.isFinite(v) ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:v<10?2:0}) : '—';
  const preciseUSD = v => Number.isFinite(v) ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(typeof BENCH==='undefined' || !Array.isArray(BENCH.tasks) || !Array.isArray(BENCH.models)) {
    $('#indexGrid').textContent='Leaderboard data could not be loaded. Please check the local data.js file.';
    return;
  }
  const taskOrder=BENCH.presentation?.taskOrder || ['task01','task02','task05','task04','task03','task06','task08','task09'];
  const originalOrder=new Map(BENCH.tasks.map((t,i)=>[t.id,i]));
  const tasks=BENCH.tasks.map(t=>({...t,num:BENCH.presentation?.taskNumbers?.[t.id] || t.num})).sort((a,b)=>{
    const ia=taskOrder.indexOf(a.id),ib=taskOrder.indexOf(b.id);
    return (ia<0?taskOrder.length+originalOrder.get(a.id):ia)-(ib<0?taskOrder.length+originalOrder.get(b.id):ib);
  });
  const models=BENCH.models.filter(m=>!m.baseline);
  const byId=Object.fromEntries(tasks.map(t=>[t.id,t]));
  const isSample=BENCH.meta.dataStatus!=='measured';
  const abbreviated = {task01:'Design',task02:'Co-design',task03:'Learning',task04:'Harness',task05:'Pose',task06:'Clearing',task08:'Reasoning',task09:'Tracking'};
  const briefText = {
    task01:'Design a stable mobile-manipulator chassis from standard aluminum profiles. The same base is evaluated with Panda, UR5e, and xArm7 arms; the minimum score across the three arms determines the family score.',
    task02:'Co-design printable GELLO-style lead arms and gravity-compensation software for three follower robots. Submitted designs are independently evaluated against hardware, mass, and servo constraints.',
    task03:'Learn RoboCasa kitchen tasks through a metered simulator interface. Three harness levels share the same tasks, seeds, and scoring weights to evaluate the effect of available infrastructure.',
    task04:'Develop a reusable harness of perception tools, controllers, and documentation. Independent agents use it with fresh context on held-out tasks; their average performance determines the score.',
    task05:'Estimate object position, orientation, and shape under restricted sensing. Four subtasks vary the observation modalities, method requirements, and available compute.',
    task06:'Develop a closed-loop policy for a magnet-equipped Panda arm to clear stamped brackets from a bin. Evaluation uses hidden pile configurations and checks policy validity, determinism, and safety.',
    task08:'Solve five physical-reasoning tasks using a supplied skill library and privileged observations. Continuous scores evaluate tower height, cantilever construction, balance, stable packing, and fragile grasping.',
    task09:'Develop a training pipeline for Unitree G1 whole-body motion tracking. Five independent motion clips share an evaluation contract, with tracking performance assessed across simulators.'
  };
  const splitValues=(t,m)=>(BENCH.scores[t.id]||{})[m.id]||[];
  const familyScore=(t,m)=>{
    const v=splitValues(t,m);
    if(!v.length || v.length!==t.splits.length || !v.every(validScore))return null;
    return t.aggregate==='min' ? Math.min(...v) : v.reduce((a,b)=>a+b,0)/v.length;
  };
  const indexScore=m=>{
    const v=tasks.map(t=>familyScore(t,m));
    return v.every(Number.isFinite) ? v.reduce((a,b)=>a+b,0)/v.length : null;
  };
  const agents=models.filter(m=>!m.baseline);

  const completeAgents=agents.filter(m=>Number.isFinite(indexScore(m)));
  // Average ranks for exact ties. The reference solution never enters the ranking population.
  function ranksOf(list,value){
    const sorted=list.filter(m=>Number.isFinite(value(m))).sort((a,b)=>value(b)-value(a));
    const map={};
    for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length && Math.abs(value(sorted[j])-value(sorted[i]))<1e-10)j++;
      for(let k=i;k<j;k++)map[sorted[k].id]=(i+1+j)/2;i=j;}
    return map;
  }
  const scoreRanks=ranksOf(completeAgents,indexScore);
  const familyRanks=Object.fromEntries(tasks.map(t=>[t.id,ranksOf(agents,m=>familyScore(t,m))]));
  const meanRank=m=>{const r=tasks.map(t=>familyRanks[t.id][m.id]);return r.every(Number.isFinite) ? r.reduce((a,b)=>a+b,0)/r.length:null;};
  const rankFormat=v=>Number.isFinite(v)?(Number.isInteger(v)?String(v):v.toFixed(1)):'—';
  let metric='score';
  let activeTask=tasks[0].id;
  let costView='overall';
  let costSort={key:'perPoint',direction:'asc'};
  let axisMode='focused';
  let tipTarget=null;
  const theme=()=>document.documentElement.dataset.theme==='light'?'light':'dark';
  const css=key=>getComputedStyle($('#cost')).getPropertyValue(key).trim();
  const blend=(a,b,t)=>{
    const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
    return '#'+rgb(a).map((n,i)=>Math.round(n*(1-t)+rgb(b)[i]*t).toString(16).padStart(2,'0')).join('');
  };
  const heat=v=>blend(css('--heat-low'),css('--heat-high'),Math.max(0,Math.min(1,v)));
  const luminance=hex=>{const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const heatInk=bg=>contrast(bg,'#ffffff')>=contrast(bg,'#000000')?'#ffffff':'#000000';

  // Original task-color identities, keyed by task ID instead of display position.
  const taskHues={
    light:{task01:'#2a78d6',task02:'#eb6834',task03:'#1baf7a',task04:'#eda100',task05:'#e87ba4',task06:'#008300',task08:'#4a3aa7',task09:'#e34948'},
    dark:{task01:'#3987e5',task02:'#d95926',task03:'#199e70',task04:'#c98500',task05:'#d55181',task06:'#008300',task08:'#9085e9',task09:'#e66767'}
  };
  const taskHue=t=>taskHues[theme()][t.id]||taskHues[theme()].task01;
  function classicHeat(t,v){
    const value=Math.max(0,Math.min(1,v)),hue=taskHue(t),dark=theme()==='dark',pivot=.62;
    return value<=pivot?blend(dark?'#1a1a19':'#fcfcfb',hue,(dark?.24:.10)+(dark?.76:.90)*(value/pivot))
      :blend(hue,dark?'#ffffff':'#0b0b0b',(dark?.55:.26)*((value-pivot)/(1-pivot)));
  }

  const safeURL=value=>{try{const u=new URL(value,location.href);return ['https:','http:','mailto:'].includes(u.protocol)?value:null;}catch(_){return null;}};
  function setTheme(value,persist=false){
    document.documentElement.dataset.theme=value;
    if(persist){try{localStorage.setItem('rlebench-theme',value);}catch(_){}}
    const label=`Switch to ${value==='dark'?'light':'dark'} theme`;
    $('#themeToggle').setAttribute('aria-label',label);$('#themeToggle').title=label;
    $('meta[name="theme-color"]').content=value==='dark'?'#0d0d0d':'#f9f9f7';
    renderMatrix();renderScatter();
  }
  $('#themeToggle').addEventListener('click',()=>setTheme(theme()==='dark'?'light':'dark',true));
  addEventListener('storage',e=>{if(e.key==='rlebench-theme'&&['light','dark'].includes(e.newValue))setTheme(e.newValue);});

  /* Shared tooltip: hover, keyboard focus, touch, and Escape. */
  const tip=$('#tooltip');
  function hideTip(){tip.hidden=true;tipTarget=null;}
  function showTip(target,html,event){
    tipTarget=target;tip.innerHTML=html;tip.hidden=false;
    const box=target.getBoundingClientRect(), tr=tip.getBoundingClientRect();
    let x=event?.clientX??box.right, y=event?.clientY??box.top;
    x+=12;y+=12;
    if(x+tr.width>innerWidth-12)x=innerWidth-tr.width-12;
    if(y+tr.height>innerHeight-12)y=Math.max(12,box.top-tr.height-12);
    tip.style.left=Math.max(12,x)+'px';tip.style.top=Math.max(12,y)+'px';
  }
  function bindTip(node,html){
    node.setAttribute('aria-describedby','tooltip');
    node.addEventListener('mouseenter',e=>showTip(node,html(),e));
    node.addEventListener('mouseleave',hideTip);
    node.addEventListener('focus',()=>showTip(node,html()));
    node.addEventListener('blur',hideTip);
    node.addEventListener('click',e=>{e.stopPropagation();showTip(node,html(),e);});
  }
  document.addEventListener('click',hideTip);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideTip();}});
  document.addEventListener('scroll',()=>{
    if(tipTarget && document.activeElement===tipTarget){
      const r=tipTarget.getBoundingClientRect();
      if(r.bottom>0 && r.top<innerHeight)showTip(tipTarget,tip.innerHTML);else hideTip();
    }else hideTip();
  },true);
  const splitTip=(m,t)=>{
    const values=splitValues(t,m);
    const rows=t.splits.map((name,i)=>`<div class="tt-line"><span>${escapeHTML(name)}</span><b>${validScore(values[i])?pct(values[i]):'—'}</b></div>`).join('');
    return `<div class="tt-title">${escapeHTML(m.name)} · ${escapeHTML(t.name)}</div>${rows}<div class="tt-sub">${t.aggregate==='min'?'Minimum':'Mean'} across splits. ${isSample?'Illustrative data; not a measured result.':'Measured results.'}</div>`;
  };

  /* Header, scope counts, and source status. */
  function renderMeta(){
    const stats=[[tasks.length,'Task families','Distinct engineering evaluations'],[tasks.reduce((sum,t)=>sum+t.variants,0),'Harbor tasks','Containerized task instances'],[completeAgents.length,'Agents ranked','Model–harness configurations']];
    const dl=$('#heroStats');dl.replaceChildren();
    stats.forEach(([value,title,note])=>{const row=make('div','stat');const dt=make('dt','stat-key',title);row.title=note;row.append(dt,make('dd','stat-val',value));dl.append(row);});
    const url=safeURL(BENCH.meta.github);if(url)$('#navGithub').href=url;else $('#navGithub').remove();
    if(!isSample){$('#dataBanner').hidden=true;}
    $$('[data-data-status]').forEach(n=>n.textContent=isSample?'Illustrative data':'Measured results');
  }

  /* Aggregate matrix: fixed 0–100 scale, numeric labels, semantic HTML table. */
  function renderMatrix(){
    hideTip();
    const host=$('#indexGrid');host.replaceChildren();
    $('#indexBlurb').textContent=metric==='score'
      ?`Mean score across ${tasks.length} task families, with equal weight per family. Scores range from 0 to 100.`
      :'Average rank across task families. Lower values indicate stronger relative performance; tied scores receive average ranks.';
    const table=make('table','matrix');
    table.append(make('caption','sr-only',`RLE-Bench ${metric==='score'?'scores':'mean ranks'}. ${isSample?'All model results are illustrative placeholders.':''}`));
    const cg=make('colgroup');cg.append(make('col','col-rank'),make('col','col-model'));tasks.forEach(()=>cg.append(make('col','col-family')));cg.append(make('col','col-index'));table.append(cg);
    const thead=make('thead'),hr=make('tr');
    const th=(text,cls)=>{const x=make('th',cls,text);x.scope='col';return x;};
    hr.append(th('#','rank-th'),th('Model / harness','model-th'));
    tasks.forEach(t=>{const h=th(null,'family-th');const b=make('button','family-col-button');b.type='button';b.style.setProperty('--task-hue',taskHue(t));b.title=t.name;b.setAttribute('aria-label',`View task ${t.num}: ${t.name}`);b.append(make('span',null,t.num),make('span',null,abbreviated[t.id]||t.short));b.addEventListener('click',()=>{setTask(t.id,true);$('#tasks').scrollIntoView({behavior:reducedMotion()?'auto':'smooth'});$(`#tab-${t.id}`).focus({preventScroll:true});});h.append(b);hr.append(h);});
    hr.append(th(metric==='score'?'RLE Index':'Mean rank','index-th'));thead.append(hr);table.append(thead);
    const value=m=>metric==='score'?indexScore(m):meanRank(m);
    const sorted=agents.slice().sort((a,b)=>{const x=value(a),y=value(b);if(x===null)return 1;if(y===null)return -1;return metric==='score'?y-x:x-y;});
    const rankPlace=metric==='score'?scoreRanks:ranksOf(completeAgents,m=>-meanRank(m));
    function addRow(m,parent){
      const tr=make('tr');
      tr.append(make('td','place-cell',rankFormat(rankPlace[m.id])));
      const name=make('th');name.scope='row';name.append(make('div','model-label',m.name),make('span','model-meta',`${m.org} · ${m.harness}`));tr.append(name);
      tasks.forEach(t=>{
        const score=familyScore(t,m),rank=familyRanks[t.id][m.id];
        const td=make('td','score-td');const missing=!Number.isFinite(score);
        const label=metric==='score'?pct(score):rankFormat(rank);
        const button=make('button','heat-cell'+(missing?' missing':''),label);button.type='button';
        button.setAttribute('aria-label',`${m.name}, ${t.name}: ${metric==='score'?'score':'rank'} ${label}. Show split details.`);
        if(!missing){const v=metric==='score'?score:1-(rank-1)/Math.max(1,agents.length-1);const bg=classicHeat(t,v);button.style.background=bg;button.style.color=heatInk(bg);}
        bindTip(button,()=>splitTip(m,t));td.append(button);tr.append(td);
      });
      const td=make('td','index-td'),wrap=make('div','index-value'),track=make('span','index-track');track.setAttribute('aria-hidden','true');
      const v=value(m),fill=make('i');fill.style.width=(v===null?0:metric==='score'?v*100:(1-(v-1)/Math.max(1,agents.length-1))*100)+'%';track.append(fill);
      wrap.append(track,make('span','index-number',metric==='score'?pct(v):num(v,2)));td.append(wrap);tr.append(td);parent.append(tr);
    }
    const body=make('tbody');sorted.forEach(m=>addRow(m,body));table.append(body);
    host.append(table);
    const legend=$('#indexLegend');legend.replaceChildren();const ramp=make('span','heat-legend');ramp.append(make('span',null,metric==='score'?'Score':'Rank'),make('span',null,metric==='score'?'0':String(agents.length)),make('span','legend-ramp'),make('span',null,metric==='score'?'100':'1'));
    legend.append(ramp,make('span',null,metric==='score'?'Each task keeps its own hue; intensity follows the same 0–100 scale.':'Color intensity indicates relative placement within each task family.'));
  }
  $$('[data-metric]').forEach(b=>b.addEventListener('click',()=>{metric=b.dataset.metric;$$('[data-metric]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderMatrix();}));

  /* Task panel and roving-focus tabs. */
  function renderTaskTabs(){
    const host=$('#taskTabs');host.replaceChildren();
    tasks.forEach(t=>{
      const b=make('button','tab');b.type='button';b.id=`tab-${t.id}`;b.dataset.task=t.id;b.role='tab';b.setAttribute('aria-controls','taskView');b.setAttribute('aria-selected',String(t.id===activeTask));b.tabIndex=t.id===activeTask?0:-1;
      b.append(make('span','tab-num','TASK '+t.num),make('span','tab-name',t.short));b.addEventListener('click',()=>setTask(t.id,true));
      b.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();let i=tasks.findIndex(x=>x.id===t.id);if(e.key==='Home')i=0;else if(e.key==='End')i=tasks.length-1;else i=(i+(e.key==='ArrowRight'?1:-1)+tasks.length)%tasks.length;setTask(tasks[i].id,true);$(`#tab-${tasks[i].id}`).focus({preventScroll:true});});host.append(b);
    });
  }
  function setTask(id,updateURL=false){
    if(!byId[id])return;activeTask=id;hideTip();
    $$('#taskTabs button').forEach(b=>{const active=b.dataset.task===id;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    $('#taskView').setAttribute('aria-labelledby',`tab-${id}`);renderTask();
    if(updateURL){try{const u=new URL(location.href);u.searchParams.set('task',id);u.hash='tasks';history.replaceState(null,'',u);}catch(_){}}
  }
  function taskFromURL(){try{const u=new URL(location.href);return byId[u.hash.slice(1)]?u.hash.slice(1):u.searchParams.get('task');}catch(_){return null;}}

  function renderTask(){
    const t=byId[activeTask],host=$('#taskView');host.replaceChildren();
    const brief=make('aside','brief');
    brief.append(make('div','brief-id','TASK '+t.num),make('h3',null,t.name),make('p','tagline',t.tagline),make('p','body',t.description));
    const chips=make('div','chips');
    const chip=(label,value,cls='')=>{const n=make('span','chip'+(cls?' '+cls:''));n.append(label,make('b',null,value));return n;};
    chips.append(chip('',t.variants+' '+(t.variants===1?'variant':'variants')),chip('agent ',t.agentLimit),chip('verifier ',t.verifierLimit),chip(t.gpu?'GPU ':'',t.gpu?(t.gpu===true?'required':t.gpu):'CPU only',t.gpu?'gpu':''));
    brief.append(chips);
    const weights=make('div','weights');weights.append(make('div','weights-head','Reward composition'));
    t.scoring.forEach(r=>{const row=make('div','weight-row');row.append(make('span','wl',r.label),make('span','wv',num(r.weight,2)));const track=make('div','weight-bar'),fill=make('i');track.setAttribute('aria-hidden','true');fill.style.width=r.weight*100+'%';track.append(fill);row.append(track);weights.append(row);});
    brief.append(weights,make('p','brief-note',t.notes));host.append(brief);
    const result=make('section','results');result.setAttribute('aria-label',t.name+' rankings');
    const head=make('div','results-head');head.append(make('h4',null,'Ranking — '+t.name),make('span','agg',t.aggregate==='min'?`score = min over ${t.splits.length} ${t.splitLabel.toLowerCase()}s`:`score = mean over ${t.splits.length} splits`));result.append(head);
    const sorted=agents.slice().sort((a,b)=>(familyScore(t,b)??-1)-(familyScore(t,a)??-1));
    const list=make('div','srow-list');list.role='list';
    sorted.forEach((m,idx)=>{
      const v=familyScore(t,m),p=familyRanks[t.id][m.id],row=make('div','srow');row.role='listitem';row.tabIndex=0;
      row.setAttribute('aria-label',`Rank ${rankFormat(p)}: ${m.name}; family score ${pct(v)} out of 100.`);
      row.append(make('div','rank'+(p<=3?' is-top':''),rankFormat(p)));
      const who=make('div','who');who.append(make('div','who-name',m.name),make('div','who-meta',`${m.org} · ${m.harness}`));row.append(who);
      const track=make('div','track');track.setAttribute('aria-hidden','true');
      if(t.aggregate==='min'){
        const bar=make('div','bar');bar.style.width=(Number.isFinite(v)?v*100:0)+'%';bar.style.animationDelay=idx*35+'ms';track.append(bar);
      }else{
        const stack=make('div','stack');stack.style.width=(Number.isFinite(v)?v*100:0)+'%';
        splitValues(t,m).forEach((value,i)=>{const segment=make('div','seg-mark');segment.style.flex=String(Math.max(value||0,.0001));segment.style.background=`var(--cat-${i%5+1})`;segment.style.animationDelay=(idx*35+i*25)+'ms';stack.append(segment);});track.style.background='transparent';track.append(stack);
      }
      row.append(track,make('div','val',pct(v)));bindTip(row,()=>splitTip(m,t));list.append(row);
    });result.append(list);
    if(t.aggregate!=='min'){
      const legend=make('div','split-legend');t.splits.forEach((label,i)=>{const pair=make('span'),swatch=make('i');swatch.style.background=`var(--cat-${i%5+1})`;pair.append(swatch,document.createTextNode(label));legend.append(pair);});legend.append(make('span','muted','· segments show contributions to the mean; total width uses 0–100.'));result.append(legend);
    }
    const details=make('details','splits');details.append(make('summary',null,`Full split table — ${t.splitLabel.toLowerCase()}`));
    const scroll=make('div','table-wrap');scroll.tabIndex=0;scroll.role='region';scroll.setAttribute('aria-label','Split result table');
    const table=make('table');table.append(make('caption','sr-only',t.name+' split scores. '+(isSample?'Illustrative data.':'')));
    const thead=make('thead'),htr=make('tr');['Model','Harness',...t.splits,'Score'].forEach((label,i)=>{const h=make('th',i<2?'l':null,label);h.scope='col';htr.append(h);});thead.append(htr);table.append(thead);
    const body=make('tbody');sorted.forEach(m=>{const tr=make('tr'),label=make('th','l',m.name);label.scope='row';tr.append(label,make('td','l',m.harness));t.splits.forEach((_,i)=>tr.append(make('td','num',validScore(splitValues(t,m)[i])?pct(splitValues(t,m)[i]):'—')));tr.append(make('td','num lead',pct(familyScore(t,m))));body.append(tr);});table.append(body);scroll.append(table);details.append(scroll);result.append(details);host.append(result);
  }
  addEventListener('hashchange',()=>{const id=taskFromURL();if(byId[id]){setTask(id);if(location.hash===`#${id}`)$('#tasks').scrollIntoView();}});
  addEventListener('popstate',()=>{const id=taskFromURL();if(byId[id])setTask(id);});

  /* Cost model: preserves the supplied suite costs and explicitly labels family estimates. */
  const costRows=()=>agents.map(m=>{
    const score=costView==='overall'?indexScore(m):familyScore(byId[costView],m);
    const cost=Number.isFinite(m.cost)?(costView==='overall'?m.cost:m.cost*byId[costView].costShare):null;
    return {m,score,cost,perPoint:Number.isFinite(score)&&score>0&&Number.isFinite(cost)?cost/(score*100):null,hours:m.hours};
  });
  function costContext(){
    const overall=costView==='overall',t=byId[costView];
    return {overall,scoreLabel:overall?'RLE Index':'Family score',costLabel:overall?'Suite API cost':'Estimated API cost',
      title:overall?'Index vs. cost':`Task ${t.num} · ${abbreviated[t.id]||t.short}`,
      xLabel:overall?'Suite API cost · USD (log)':'Estimated API cost · USD (log)'};
  }
  const costModelIds=Object.fromEntries(agents.slice().sort((a,b)=>(indexScore(b)??-1)-(indexScore(a)??-1)).map((m,i)=>[m.id,i+1]));
  const shortModelNames={opus5:'Opus 5',sonnet5:'Sonnet 5',gpt52:'GPT-5.2',gemini3:'Gemini 3 Pro',glm52:'GLM-5.2',ds4:'DeepSeek-V4',qwen3max:'Qwen3-Max',kimi25:'Kimi K2.5'};
  function highlightCost(id){
    $('.cost-workbench').classList.toggle('has-highlight',!!id);
    $$('[data-cost-model]').forEach(n=>n.classList.toggle('is-highlighted',n.dataset.costModel===id));
  }
  function costTip(r){
    const meta=costContext();
    return `<div class="tt-title">${escapeHTML(r.m.name)}</div><div class="tt-line"><span>${meta.scoreLabel}</span><b>${pct(r.score)}</b></div><div class="tt-line"><span>${meta.costLabel}</span><b>${preciseUSD(r.cost)}</b></div><div class="tt-line"><span>USD / point</span><b>${preciseUSD(r.perPoint)}</b></div>${meta.overall?`<div class="tt-line"><span>Median agent time</span><b>${num(r.hours)} h</b></div>`:''}<div class="tt-sub">${escapeHTML(r.m.org)} · ${escapeHTML(r.m.harness)}${isSample?' · Illustrative data':''}</div>`;
  }
  function linkCost(node,row){
    node.dataset.costModel=row.m.id;bindTip(node,()=>costTip(row));
    node.addEventListener('mouseenter',()=>highlightCost(row.m.id));
    node.addEventListener('mouseleave',()=>highlightCost(null));
    node.addEventListener('focus',()=>highlightCost(row.m.id));
    node.addEventListener('blur',()=>highlightCost(null));
  }
  const costSelect=$('#costScope');
  tasks.forEach(t=>{const o=make('option',null,`${t.num} · ${t.short}`);o.value=t.id;costSelect.append(o);});
  costSelect.addEventListener('change',()=>{
    costView=costSelect.value;
    if(costView!=='overall'&&costSort.key==='hours')costSort={key:'perPoint',direction:'asc'};
    hideTip();highlightCost(null);renderScatter();renderCostTable();
  });
  $$('[data-axis]').forEach(b=>b.addEventListener('click',()=>{
    axisMode=b.dataset.axis;$$('[data-axis]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));
    hideTip();renderScatter();
  }));
  function logTicks(min,max){
    const out=[];for(let e=Math.floor(Math.log10(min));e<=Math.ceil(Math.log10(max));e++)for(const v of [1,2,5]){const x=v*10**e;if(x>=min&&x<=max)out.push(x);}return out;
  }
  function renderScatter(){
    const host=$('#scatter');if(!host)return;host.replaceChildren();highlightCost(null);
    const meta=costContext();$('#costChartTitle').textContent=meta.title;
    $('#costMetricLabel').textContent=`${isSample?'Illustrative data':'Measured results'} · ${meta.overall?'Full benchmark':'Family estimate'}`;
    const pts=costRows().filter(r=>Number.isFinite(r.score)&&Number.isFinite(r.cost)&&r.cost>0);
    const insight=$('#costInsights');insight.replaceChildren();
    if(!pts.length){host.append(make('p','empty-plot','No complete score–cost pairs are available.'));$('#costChartNote').textContent='A positive API cost and a complete score are required to plot an agent.';return;}
    const W=Math.max(260,Math.round(host.clientWidth)),H=282,M={l:43,r:18,t:28,b:47};
    const showNames=W>=430;
    const values=pts.map(p=>p.score*100),minScore=Math.min(...values),maxScore=Math.max(...values);
    let yMin=axisMode==='full'?0:Math.max(0,Math.floor((minScore-2)/10)*10);
    let yMax=axisMode==='full'?100:Math.min(100,Math.ceil((maxScore+2)/10)*10);
    if(yMax-yMin<10){yMin=Math.max(0,yMin-5);yMax=Math.min(100,yMin+10);}
    const minCost=Math.min(...pts.map(p=>p.cost)),maxCost=Math.max(...pts.map(p=>p.cost));
    const xMin=minCost*.78,xMax=Math.max(maxCost*1.26,minCost*2);
    const X=v=>M.l+(Math.log10(v)-Math.log10(xMin))/(Math.log10(xMax)-Math.log10(xMin))*(W-M.l-M.r);
    const Y=v=>H-M.b-(v-yMin)/(yMax-yMin)*(H-M.t-M.b);
    const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('aria-labelledby','scatterSvgTitle scatterSvgDesc');svg.setAttribute('role','group');
    const mk=(tag,attrs={},cls)=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(cls)n.setAttribute('class',cls);return n;};
    const text=(value,attrs,cls)=>{const n=mk('text',attrs,cls);n.textContent=value;return n;};
    const title=mk('title',{id:'scatterSvgTitle'});title.textContent=meta.title;
    const desc=mk('desc',{id:'scatterSvgDesc'});desc.textContent=`${isSample?'Illustrative placeholders. ':''}Score axis ${yMin} to ${yMax}; logarithmic API cost axis. Numbered points correspond to the model IDs in the table. ${pts.map(p=>`${p.m.name}: ${pct(p.score)} points, ${preciseUSD(p.cost)}`).join('; ')}.`;
    svg.append(title,desc);
    const step=(yMax-yMin)>70?25:(yMax-yMin)>40?20:(yMax-yMin)>20?10:5;
    const yTicks=[yMin];for(let v=Math.ceil(yMin/step)*step;v<yMax;v+=step)if(v>yMin)yTicks.push(v);yTicks.push(yMax);
    yTicks.forEach(v=>svg.append(mk('line',{x1:M.l,x2:W-M.r,y1:Y(v),y2:Y(v)},'plot-grid'),text(v,{x:M.l-12,y:Y(v)+3.5,'text-anchor':'end'},'plot-tick')));
    logTicks(xMin,xMax).forEach(v=>svg.append(mk('line',{x1:X(v),x2:X(v),y1:M.t,y2:H-M.b},'plot-grid'),text(usd(v),{x:X(v),y:H-M.b+19,'text-anchor':'middle'},'plot-tick')));
    svg.append(mk('line',{x1:M.l,x2:W-M.r,y1:H-M.b,y2:H-M.b},'plot-axis'));
    svg.append(text(`${meta.scoreLabel} · ${yMin}–${yMax}`,{x:M.l,y:12},'plot-axis-title'),text(meta.xLabel,{x:W-M.r,y:H-5,'text-anchor':'end'},'plot-axis-title'));
    const dots=pts.map(p=>({...p,cx:X(p.cost),cy:Y(p.score*100)}));
    const labels=[];
    if(showNames){
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='12px '+css('--serif');
      const occupied=dots.map(p=>({x:p.cx-12,y:p.cy-12,w:24,h:24}));
      const intersects=(a,b)=>a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
      dots.slice().sort((a,b)=>a.cy-b.cy).forEach(p=>{
        const label=shortModelNames[p.m.id]||p.m.name,w=ctx.measureText(label).width+2,h=15,candidates=[];
        for(const dy of [0,-20,20,-38,38,-56,56,-74,74])for(const side of [1,-1])candidates.push({x:side===1?p.cx+16:p.cx-16-w,y:p.cy-7+dy,w,h,side});
        const inBounds=c=>c.x>M.l+2&&c.x+c.w<W-M.r&&c.y>=M.t-12&&c.y+c.h<H-M.b-2;
        const chosen=candidates.find(c=>inBounds(c)&&!occupied.some(o=>intersects(c,o)));
        // Never overlap labels to force a fit: numbered markers still identify the model.
        if(chosen){occupied.push(chosen);labels.push({p,c:chosen,label});}
      });
    }
    labels.forEach(({p,c})=>{if(Math.abs(c.y+7-p.cy)>2)svg.append(mk('line',{x1:p.cx,y1:p.cy,x2:c.side===1?c.x-4:c.x+c.w+4,y2:c.y+7},'plot-leader'));});
    dots.forEach(p=>{
      const group=mk('g',{tabindex:0,role:'button','aria-label':`${p.m.name}: ${pct(p.score)} points; ${preciseUSD(p.cost)}${meta.overall?'':' estimated'}. Show details.`},'plot-point-group');
      group.append(mk('circle',{cx:p.cx,cy:p.cy,r:8.5},'plot-point'),text(costModelIds[p.m.id],{x:p.cx,y:p.cy+3,'text-anchor':'middle','aria-hidden':true},'plot-point-number'));
      linkCost(group,p);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showTip(group,costTip(p));}});svg.append(group);
    });
    labels.forEach(({p,c,label})=>svg.append(text(label,{x:c.x,y:c.y+11,'data-label-for':p.m.id,'data-cost-model':p.m.id},'plot-label')));
    host.append(svg);
    const highest=pts.reduce((a,b)=>a.score>=b.score?a:b),cheapest=pts.reduce((a,b)=>a.cost<=b.cost?a:b);
    [[meta.overall?'Highest index':'Highest score',pct(highest.score),highest.m.name],['Lowest API cost',usd(cheapest.cost),cheapest.m.name]].forEach(([label,value,name])=>{
      const box=make('div','cost-insight');box.append(make('span','insight-label',label),make('strong','insight-value',value),make('span','insight-model',name));insight.append(box);
    });
    $('#costChartNote').textContent=meta.overall
      ?`Score axis: ${yMin}–${yMax}. Cost uses a log scale. Point numbers match the table; focus or hover for details.`
      :`Score axis: ${yMin}–${yMax}. Log cost axis. Family spend is allocated at ${(byId[costView].costShare*100).toFixed(0)}% of suite cost, not separately metered.`;
  }
  const sortedCostRows=()=>costRows().sort((a,b)=>{
    const av=a[costSort.key],bv=b[costSort.key];if(!Number.isFinite(av)&&!Number.isFinite(bv))return 0;if(!Number.isFinite(av))return 1;if(!Number.isFinite(bv))return -1;
    return (costSort.direction==='asc'?1:-1)*(av-bv);
  });
  function renderCostTable(){
    const host=$('#costTable');host.replaceChildren();highlightCost(null);const meta=costContext();
    const sortNames={score:meta.scoreLabel,cost:'API cost',perPoint:'Cost per point',hours:'Median agent time'};
    $('#costTableContext').textContent=`${sortNames[costSort.key]}, ${costSort.direction==='asc'?'low → high':'high → low'}`;
    $('#costAccountingNote').textContent=meta.overall
      ?'Time = median agent hours per task. API cost excludes simulator, GPU, and other infrastructure expenses.'
      :`Family API cost = ${(byId[costView].costShare*100).toFixed(0)}% of suite spend. These are allocated estimates, not independently measured costs.`;
    const table=make('table','cost-table');table.append(make('caption','sr-only',`${meta.title}: costs and scores. ${isSample?'Illustrative data.':''} Point IDs remain fixed when sorting.`));
    const colgroup=make('colgroup');['model','score','cost','perPoint',...(meta.overall?['hours']:[])].forEach(key=>colgroup.append(make('col','cost-col-'+key)));table.append(colgroup);
    const th=make('thead'),hr=make('tr'),mh=make('th',null,'Model / harness');mh.scope='col';hr.append(mh);
    const cols=[['score',meta.overall?'Index':'Score'],['cost','API cost'],['perPoint','$/point']];if(meta.overall)cols.push(['hours','Time']);
    cols.forEach(([key,label])=>{
      const h=make('th',key==='perPoint'?'metric-focus':'');h.scope='col';h.setAttribute('aria-sort',key===costSort.key?(costSort.direction==='asc'?'ascending':'descending'):'none');
      const b=make('button',null,label+' ');b.type='button';b.dataset.sort=key;b.title=key==='hours'?'Median agent hours per task':sortNames[key];b.setAttribute('aria-label',`Sort by ${sortNames[key]}`);
      b.append(make('span',null,key===costSort.key?(costSort.direction==='asc'?'↑':'↓'):'↕'));
      b.addEventListener('click',()=>{costSort={key,direction:costSort.key===key?(costSort.direction==='asc'?'desc':'asc'):(key==='score'?'desc':'asc')};hideTip();renderCostTable();$(`[data-sort="${key}"]`)?.focus({preventScroll:true});});h.append(b);hr.append(h);
    });th.append(hr);table.append(th);const body=make('tbody');
    sortedCostRows().forEach(r=>{
      const tr=make('tr');tr.dataset.model=r.m.id;tr.tabIndex=0;
      tr.setAttribute('aria-label',`${r.m.name}, ${r.m.harness}: ${pct(r.score)} points; API cost ${preciseUSD(r.cost)}; ${preciseUSD(r.perPoint)} per point.`);
      const name=make('th');name.scope='row';const label=make('div','cost-model-name');const badge=make('span','model-id',costModelIds[r.m.id]);badge.setAttribute('aria-hidden','true');
      const who=make('span');who.append(make('span','model-label',r.m.name),make('span','model-meta',r.m.harness));label.append(badge,who);name.append(label);
      tr.append(name,make('td',null,pct(r.score)),make('td',null,preciseUSD(r.cost)),make('td','metric-focus',preciseUSD(r.perPoint)));
      if(meta.overall)tr.append(make('td','cost-hours',Number.isFinite(r.hours)?r.hours.toFixed(1)+' h':'—'));
      linkCost(tr,r);body.append(tr);
    });table.append(body);host.append(table);
  }
  // CSV includes source status and cost basis so sample values cannot lose their qualification.
  $('#downloadCsv').addEventListener('click',()=>{
    const clean=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const headers=['data_status','snapshot_date','scope','model_id','model','harness','score_0_100','api_cost_usd','usd_per_point','median_agent_hours','cost_basis'];
    const rows=sortedCostRows().map(r=>[isSample?'illustrative_placeholder':'measured',BENCH.meta.updated,costView,r.m.id,r.m.name,r.m.harness,Number.isFinite(r.score)?(r.score*100).toFixed(6):'',Number.isFinite(r.cost)?r.cost.toFixed(6):'',Number.isFinite(r.perPoint)?r.perPoint.toFixed(6):'',costView==='overall'?r.hours:'',costView==='overall'?'suite_api_spend':'estimated_fixed_share_of_suite']);
    const csv='\uFEFF'+[headers,...rows].map(r=>r.map(clean).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);const a=make('a');a.href=url;a.download=`rle-bench-${costView}-${isSample?'illustrative':'results'}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  });
  let resizeTimer;addEventListener('resize',()=>{hideTip();clearTimeout(resizeTimer);resizeTimer=setTimeout(renderScatter,120);});
  renderMeta();
  activeTask=byId[taskFromURL()]?taskFromURL():tasks[0].id;
  renderTaskTabs();setTask(activeTask);renderCostTable();setTheme(theme());
  if(byId[location.hash.slice(1)])requestAnimationFrame(()=>$('#tasks').scrollIntoView());
})();
