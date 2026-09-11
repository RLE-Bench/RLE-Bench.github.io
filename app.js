/* RLE-Bench homepage. Vanilla JS; all results are read from the original BENCH.
   Data schema and numerical values are not changed by this presentation layer.
   Missing results never become zero, and incomplete agents receive no overall rank. */
(async () => {
  'use strict';
  // Evaluated agents and their results are published separately from the task catalog.
  try {
    const res = await fetch('assets/data/leaderboard.json', {cache: 'no-cache'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.models) && data.scores && typeof data.scores === 'object') {
      BENCH.models = data.models;
      BENCH.scores = data.scores;
      BENCH.costs = data.costs || {};
      BENCH.results = data.results || {};
      // The export (assets/data/export.py) is the authority on how a task is split; the catalog in data.js is the fallback.
      if (data.tasks && typeof data.tasks === 'object') BENCH.tasks.forEach(t => {
        const x = data.tasks[t.id];
        if (!x || !Array.isArray(x.splits)) return;
        t.splits = x.splits.map(s => typeof s === 'string' ? s : s.label);
        if (x.splitLabel) t.splitLabel = x.splitLabel;
        if (x.aggregate) t.aggregate = x.aggregate;
        t.weights = Array.isArray(x.weights) ? x.weights : null;
      });
      // The snapshot mean covers exactly the tasks the export reports.
      if (BENCH.presentation) BENCH.presentation.snapshotTaskIds = BENCH.tasks.filter(t => data.scores[t.id]).map(t => t.id);
      if (typeof data.status === 'string') BENCH.meta.dataStatus = data.status;
    }
  } catch (err) {
    console.error('RLE-Bench: could not load assets/data/leaderboard.json', err);
  }
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const make = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=text; return n; };
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validScore = v => typeof v==='number' && Number.isFinite(v) && v>=0 && v<=1;
  const num = (v,d=1) => Number.isFinite(v) ? v.toFixed(d) : '—';
  const pct = (v,d=1) => Number.isFinite(v) ? (v*100).toFixed(d) : '—';
  const usd = v => Number.isFinite(v) ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:v<10?2:0}) : '—';
  const preciseUSD = v => Number.isFinite(v) ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const tokens = v => Number.isFinite(v) ? (v>=1e9 ? (v/1e9).toFixed(2)+'B' : v>=1e6 ? (v/1e6).toFixed(1)+'M' : v>=1e3 ? (v/1e3).toFixed(0)+'K' : String(Math.round(v))) : '—';
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(typeof BENCH==='undefined' || !Array.isArray(BENCH.tasks) || !Array.isArray(BENCH.models) || !BENCH.scores) {
    $('#indexGrid').textContent='Results are temporarily unavailable. Serve the site over HTTP so assets/data/leaderboard.json can load, then reload the page.';
    return;
  }
  const taskOrder=BENCH.presentation?.taskOrder || ['task01','task02','task05','task04','task03','task06','task08','task09'];
  const originalOrder=new Map(BENCH.tasks.map((t,i)=>[t.id,i]));
  const tasks=BENCH.tasks.map(t=>({...t,num:BENCH.presentation?.taskNumbers?.[t.id] || t.num})).sort((a,b)=>{
    const ia=taskOrder.indexOf(a.id),ib=taskOrder.indexOf(b.id);
    return (ia<0?taskOrder.length+originalOrder.get(a.id):ia)-(ib<0?taskOrder.length+originalOrder.get(b.id):ib);
  });
  const snapshotTasks=tasks.filter(t=>BENCH.presentation.snapshotTaskIds.includes(t.id));
  // Two-level breakdown: workflows own tasks; any task missing from the list falls into a trailing group.
  const workflows=(BENCH.presentation?.workflows||[]).map(w=>({...w,tasks:w.tasks.map(id=>tasks.find(t=>t.id===id)).filter(Boolean)})).filter(w=>w.tasks.length);
  {const placed=new Set(workflows.flatMap(w=>w.tasks.map(t=>t.id)));const rest=tasks.filter(t=>!placed.has(t.id));if(rest.length)workflows.push({id:'other',name:'Other tasks',tasks:rest});}
  const workflowOf=Object.fromEntries(workflows.flatMap(w=>w.tasks.map(t=>[t.id,w])));
  const models=BENCH.models.filter(m=>!m.baseline);
  const byId=Object.fromEntries(tasks.map(t=>[t.id,t]));
  const isSample=BENCH.meta.dataStatus!=='measured';
  const abbreviated = {task01:'Design',task02:'Co-Design',task03:'Control',task04:'Harness',task05:'Pose',task06:'Clearing',task08:'Reasoning',task09:'Tracking',nanovla:'NanoVLA'};
  const splitValues=(t,m)=>(BENCH.scores[t.id]||{})[m.id]||[];
  const familyScore=(t,m)=>{
    // The exported task score (mean verifier reward, gates included) wins; split aggregation is the fallback.
    const reported=BENCH.results?.[t.id]?.[m.id]?.score;
    if(validScore(reported))return reported;
    const v=splitValues(t,m);
    if(!v.length || v.length!==t.splits.length || !v.every(validScore))return null;
    if(t.aggregate==='min')return Math.min(...v);
    if(t.aggregate==='weighted'&&Array.isArray(t.weights)&&t.weights.length===v.length){
      const total=t.weights.reduce((a,b)=>a+b,0);
      return total>0?v.reduce((a,x,i)=>a+x*t.weights[i],0)/total:null;
    }
    return v.reduce((a,b)=>a+b,0)/v.length;
  };
  // RLE Index: tasks are averaged within each workflow, then the workflow means are averaged.
  // Only tasks with reported results enter; a workflow with none is skipped. Any missing task score voids the index.
  const snapshotIds=new Set(snapshotTasks.map(t=>t.id));
  const workflowGroups=workflows.map(w=>w.tasks.filter(t=>snapshotIds.has(t.id))).filter(g=>g.length);
  const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
  const hierarchical=(m,value)=>{
    const per=workflowGroups.map(g=>{const v=g.map(t=>value(t,m));return v.every(Number.isFinite)?mean(v):null;});
    return per.length && per.every(Number.isFinite) ? mean(per) : null;
  };
  const indexScore=m=>hierarchical(m,familyScore);
  const agents=models.filter(m=>!m.baseline);

  const completeAgents=agents.filter(m=>Number.isFinite(indexScore(m)));
  // Competition ranking: exact ties share the lower rank (1, 2, 2, 4). The reference solution never enters the ranking population.
  function ranksOf(list,value){
    const sorted=list.filter(m=>Number.isFinite(value(m))).sort((a,b)=>value(b)-value(a));
    const map={};
    for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length && Math.abs(value(sorted[j])-value(sorted[i]))<1e-10)j++;
      for(let k=i;k<j;k++)map[sorted[k].id]=i+1;i=j;}
    return map;
  }
  const scoreRanks=ranksOf(completeAgents,indexScore);
  const familyRanks=Object.fromEntries(tasks.map(t=>[t.id,ranksOf(agents,m=>familyScore(t,m))]));
  const meanRank=m=>hierarchical(m,(t,x)=>familyRanks[t.id][x.id]);
  const rankFormat=v=>Number.isFinite(v)?(Number.isInteger(v)?String(v):v.toFixed(1)):'—';
  let metric='score';
  let activeTask=tasks[0].id;
  let costView='overall';
  let costSort={key:'cost',direction:'asc'};
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
    const how=t.aggregate==='min'?'Minimum across splits.':t.aggregate==='weighted'?'Stage credit relative to each stage weight; the task score is the verifier reward, gates included.':'Mean across splits.';
    return `<div class="tt-title">${escapeHTML(m.name)} · ${escapeHTML(t.name)}</div>${rows}<div class="tt-sub">${t.splits.length?how:'Result not reported. Excluded from the snapshot mean.'} ${isSample?'Illustrative data; not a measured result.':'Measured results.'}</div>`;
  };

  /* Header, scope counts, and source status. */
  function renderMeta(){
    const stats=[[tasks.length,'Engineering Tasks','Task definitions follow the research overview'],[workflows.length,'Workflows',workflows.map(w=>w.name).join(', ')],[agents.length,'Agents','Model and harness combinations in the development snapshot']];
    const dl=$('#heroStats');dl.replaceChildren();
    stats.forEach(([value,title,note])=>{const row=make('div','stat');const dt=make('dt','stat-key',title);row.title=note;row.append(dt,make('dd','stat-val',value));dl.append(row);});
    const url=safeURL(BENCH.meta.github);if(url)$('#navGithub').href=url;else $('#navGithub').remove();
    $$('[data-data-status]').forEach(n=>n.textContent=isSample?'Illustrative data':'Measured results');
  }

  /* Aggregate matrix: fixed 0–100 scale, numeric labels, semantic HTML table. */
  function renderMatrix(){
    hideTip();
    const host=$('#indexGrid');host.replaceChildren();
    $('#indexBlurb').textContent=metric==='score'
      ?'Task scores are averaged within each workflow, then across workflows, on a 0–100 scale.'
      :'Per-task ranks are averaged within each workflow, then across workflows. Lower is better.';
    const table=make('table','matrix');
    table.append(make('caption','sr-only',`RLE-Bench ${metric==='score'?'scores':'mean ranks'}. ${isSample?'All model results are illustrative placeholders.':''}`));
    const cg=make('colgroup');cg.append(make('col','col-rank'),make('col','col-model'),make('col','col-index'));tasks.forEach(()=>cg.append(make('col','col-family')));table.append(cg);
    const thead=make('thead'),hr=make('tr');
    const th=(text,cls)=>{const x=make('th',cls,text);x.scope='col';return x;};
    hr.append(th('#','rank-th'),th('Model / Harness','model-th'),th(metric==='score'?'Mean Score':'Mean Rank','index-th'));
    tasks.forEach(t=>{const h=th(null,'family-th');const b=make('button','family-col-button');b.type='button';b.style.setProperty('--task-hue',taskHue(t));b.title=t.name;b.setAttribute('aria-label',`View task ${t.num}: ${t.name}`);b.append(make('span',null,t.num),make('span',null,abbreviated[t.id]||t.short));b.addEventListener('click',()=>{setTask(t.id,true);$('#tasks').scrollIntoView({behavior:reducedMotion()?'auto':'smooth'});$(`#tab-${t.id}`).focus({preventScroll:true});});h.append(b);hr.append(h);});
    thead.append(hr);table.append(thead);
    const value=m=>metric==='score'?indexScore(m):meanRank(m);
    const sorted=agents.slice().sort((a,b)=>{const x=value(a),y=value(b);if(x===null)return 1;if(y===null)return -1;return metric==='score'?y-x:x-y;});
    const rankPlace=metric==='score'?scoreRanks:ranksOf(completeAgents,m=>-meanRank(m));
    function addRow(m,parent){
      const tr=make('tr');
      tr.append(make('td','place-cell',rankFormat(rankPlace[m.id])));
      const name=make('th');name.scope='row';name.append(make('div','model-label',m.name),make('span','model-meta',`${m.org} · ${m.harness}`));tr.append(name);
      {const td=make('td','index-td'),wrap=make('div','index-value'),track=make('span','index-track');track.setAttribute('aria-hidden','true');
        const v=value(m),fill=make('i');fill.style.width=(v===null?0:metric==='score'?v*100:(1-(v-1)/Math.max(1,agents.length-1))*100)+'%';track.append(fill);
        wrap.append(make('span','index-number',metric==='score'?pct(v):num(v,2)),track);td.append(wrap);tr.append(td);}
      tasks.forEach(t=>{
        const score=familyScore(t,m),rank=familyRanks[t.id][m.id];
        const td=make('td','score-td');const missing=!Number.isFinite(score);
        const label=metric==='score'?pct(score):rankFormat(rank);
        const button=make('button','heat-cell'+(missing?' missing':''),label);button.type='button';
        button.setAttribute('aria-label',`${m.name}, ${t.name}: ${metric==='score'?'score':'rank'} ${label}. Show split details.`);
        if(!missing){const v=metric==='score'?score:1-(rank-1)/Math.max(1,agents.length-1);const bg=classicHeat(t,v);button.style.background=bg;button.style.color=heatInk(bg);}
        bindTip(button,()=>splitTip(m,t));td.append(button);tr.append(td);
      });
      parent.append(tr);
    }
    const body=make('tbody');sorted.forEach(m=>addRow(m,body));table.append(body);
    host.append(table);
  }
  $$('[data-metric]').forEach(b=>b.addEventListener('click',()=>{metric=b.dataset.metric;$$('[data-metric]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderMatrix();}));

  /* Task panel and roving-focus tabs. */
  /* Two-level tabs: the workflow row is always visible; the task row lists only the selected workflow's tasks. */
  const lastTaskIn={};
  const activeWorkflow=()=>workflowOf[activeTask]||workflows[0];
  const stepKey=(e,list,i)=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return -1;e.preventDefault();if(e.key==='Home')return 0;if(e.key==='End')return list.length-1;return (i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;};
  function renderWorkflowTabs(){
    const host=$('#workflowTabs');host.replaceChildren();
    workflows.forEach((w,wi)=>{
      const b=make('button','wf-tab');b.type='button';b.id=`wf-${w.id}`;b.dataset.workflow=w.id;b.role='tab';b.setAttribute('aria-controls','taskTabs');
      b.append(make('span','wf-kicker',`Workflow ${String(wi+1).padStart(2,'0')}`),make('span','wf-name',w.name),make('span','wf-count',`${w.tasks.length} task${w.tasks.length===1?'':'s'}`));
      b.addEventListener('click',()=>setWorkflow(w.id,true));
      b.addEventListener('keydown',e=>{const i=stepKey(e,workflows,wi);if(i<0)return;setWorkflow(workflows[i].id,true);$(`#wf-${workflows[i].id}`).focus({preventScroll:true});});
      host.append(b);
    });
  }
  function renderTaskTabs(){
    const w=activeWorkflow(),host=$('#taskTabs');host.replaceChildren();host.style.setProperty('--n',w.tasks.length);host.setAttribute('aria-label',`${w.name} tasks`);
    w.tasks.forEach((t,ti)=>{
      const b=make('button','tab');b.type='button';b.id=`tab-${t.id}`;b.dataset.task=t.id;b.role='tab';b.setAttribute('aria-controls','taskView');b.setAttribute('aria-selected',String(t.id===activeTask));b.tabIndex=t.id===activeTask?0:-1;
      b.append(make('span','tab-num','Task '+t.num),make('span','tab-name',t.short));b.addEventListener('click',()=>setTask(t.id,true));
      b.addEventListener('keydown',e=>{const i=stepKey(e,w.tasks,ti);if(i<0)return;setTask(w.tasks[i].id,true);$(`#tab-${w.tasks[i].id}`).focus({preventScroll:true});});
      host.append(b);
    });
  }
  function setWorkflow(id,updateURL=false){
    const w=workflows.find(x=>x.id===id);if(!w)return;
    setTask(lastTaskIn[id]||w.tasks[0].id,updateURL);
  }
  function setTask(id,updateURL=false){
    if(!byId[id])return;activeTask=id;hideTip();
    const w=activeWorkflow();lastTaskIn[w.id]=id;
    $$('#workflowTabs button').forEach(b=>{const active=b.dataset.workflow===w.id;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    if(!$(`#taskTabs [data-task="${id}"]`))renderTaskTabs();
    $$('#taskTabs button').forEach(b=>{const active=b.dataset.task===id;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    $('#taskView').setAttribute('aria-labelledby',`tab-${id}`);renderTask();
    if(updateURL){try{const u=new URL(location.href);u.searchParams.set('task',id);u.hash='tasks';history.replaceState(null,'',u);}catch(_){}}
  }
  function taskFromURL(){try{const u=new URL(location.href);return byId[u.hash.slice(1)]?u.hash.slice(1):u.searchParams.get('task');}catch(_){return null;}}

  function renderTask(){
    const t=byId[activeTask],host=$('#taskView');host.replaceChildren();
    const brief=make('aside','brief');
    const ident=make('div','brief-id');ident.append(make('span',null,'Task '+t.num));if(workflowOf[t.id]){ident.append(make('span','brief-sep','·'),make('span','brief-workflow',workflowOf[t.id].name));}
    brief.append(ident,make('h3',null,t.short),make('p','tagline',t.tagline),make('p','body',t.description));
    const chips=make('div','chips');
    const chip=(label,value,cls='')=>{const n=make('span','chip'+(cls?' '+cls:''));n.append(label,make('b',null,value));return n;};
    chips.append(chip('Development ',t.development));if(t.compute)chips.append(chip('',t.compute));
    brief.append(chips);
    const criteria=make('div','weights');if(t.product)criteria.append(make('div','weights-head','Work Product'),make('p','body',t.product));criteria.append(make('div','weights-head','Evaluation Criteria'),make('p','body',t.evaluation));
    brief.append(criteria);host.append(brief);
    const result=make('section','results');result.setAttribute('aria-label',t.short+' results');
    const head=make('div','results-head');head.append(make('h4',null,'Results'));result.append(head);
    if(!t.splits.length){result.append(make('p','body','Results for this task are not reported yet.'));host.append(result);return;}
    const sorted=agents.slice().sort((a,b)=>(familyScore(t,b)??-1)-(familyScore(t,a)??-1));
    const list=make('div','srow-list');list.role='list';
    sorted.forEach((m,idx)=>{
      const v=familyScore(t,m),p=familyRanks[t.id][m.id],row=make('div','srow');row.role='listitem';row.tabIndex=0;
      row.setAttribute('aria-label',`Rank ${rankFormat(p)}: ${m.name}; task score ${pct(v)} out of 100.`);
      row.append(make('div','rank'+(p<=3?' is-top':''),rankFormat(p)));
      const who=make('div','who');who.append(make('div','who-name',m.name),make('div','who-meta',`${m.org} · ${m.harness}`));row.append(who);
      const track=make('div','track');track.setAttribute('aria-hidden','true');
      if(t.aggregate==='min'){
        const bar=make('div','bar');bar.style.width=(Number.isFinite(v)?v*100:0)+'%';bar.style.animationDelay=idx*35+'ms';track.append(bar);
      }else{
        const stack=make('div','stack');stack.style.width=(Number.isFinite(v)?v*100:0)+'%';
        splitValues(t,m).forEach((value,i)=>{const segment=make('div','seg-mark');segment.style.flex=String(Math.max((value||0)*(t.weights?.[i]??1),.0001));segment.style.background=`var(--cat-${i%5+1})`;segment.style.animationDelay=(idx*35+i*25)+'ms';stack.append(segment);});track.style.background='transparent';track.append(stack);
      }
      row.append(track,make('div','val',pct(v)));bindTip(row,()=>splitTip(m,t));list.append(row);
    });result.append(list);
    if(t.aggregate!=='min'){
      const legend=make('div','split-legend');t.splits.forEach((label,i)=>{const pair=make('span'),swatch=make('i');swatch.style.background=`var(--cat-${i%5+1})`;pair.append(swatch,document.createTextNode(label));legend.append(pair);});result.append(legend);
    }
    host.append(result);
  }
  addEventListener('hashchange',()=>{const id=taskFromURL();if(byId[id]){setTask(id);if(location.hash===`#${id}`)$('#tasks').scrollIntoView();}});
  addEventListener('popstate',()=>{const id=taskFromURL();if(byId[id])setTask(id);});

  /* Cost model: per-task API cost, agent hours and context length come from costs[taskId][modelId];
     the overall view averages each within workflows, then across workflows, exactly like the RLE Index. */
  const taskCostField=(t,m,key)=>{const c=BENCH.costs?.[t.id]?.[m.id];if(!c)return null;
    if(key==='context')return Number.isFinite(c.input_tokens)&&Number.isFinite(c.cached_tokens)?c.input_tokens-c.cached_tokens:null;
    return Number.isFinite(c[key])?c[key]:null;};
  const costMetric=(m,key)=>costView==='overall'?hierarchical(m,(t,x)=>taskCostField(t,x,key)):taskCostField(byId[costView],m,key);
  const costRows=()=>agents.map(m=>({m,score:costView==='overall'?indexScore(m):familyScore(byId[costView],m),cost:costMetric(m,'cost'),hours:costMetric(m,'hours'),context:costMetric(m,'context')}));
  function costContext(){
    const overall=costView==='overall',t=byId[costView];
    return {overall,scoreLabel:overall?'Mean Task Score':'Task Score',costLabel:overall?'Mean API Cost':'API Cost',
      title:overall?'Score vs. Cost':`Task ${t.num} · ${abbreviated[t.id]||t.short}`,
      xLabel:overall?'Mean API cost per task · USD (log)':'API cost · USD (log)'};
  }
  const costModelIds=Object.fromEntries(agents.slice().sort((a,b)=>(indexScore(b)??-1)-(indexScore(a)??-1)).map((m,i)=>[m.id,i+1]));
  // Plot labels: the export supplies `short` per model; the map covers older snapshots without it.
  const shortModelNames={opus5:'Opus 5',sonnet5:'Sonnet 5',gpt52:'GPT-5.2',gemini3:'Gemini 3 Pro',glm52:'GLM-5.2',ds4:'DeepSeek-V4',qwen3max:'Qwen3-Max',kimi25:'Kimi K2.5'};
  function highlightCost(id){
    $('.cost-workbench').classList.toggle('has-highlight',!!id);
    $$('[data-cost-model]').forEach(n=>n.classList.toggle('is-highlighted',n.dataset.costModel===id));
  }
  function costTip(r){
    const meta=costContext();
    return `<div class="tt-title">${escapeHTML(r.m.name)}</div><div class="tt-line"><span>${meta.scoreLabel}</span><b>${pct(r.score)}</b></div><div class="tt-line"><span>${meta.costLabel}</span><b>${preciseUSD(r.cost)}</b></div><div class="tt-line"><span>${meta.overall?'Mean agent time':'Agent time'}</span><b>${num(r.hours)} h</b></div><div class="tt-line"><span>Context length</span><b>${tokens(r.context)}</b></div><div class="tt-sub">${escapeHTML(r.m.org)} · ${escapeHTML(r.m.harness)}${isSample?' · Illustrative data':''}</div>`;
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
    hideTip();highlightCost(null);renderScatter();renderCostTable();
  });
  function logTicks(min,max){
    const out=[];for(let e=Math.floor(Math.log10(min));e<=Math.ceil(Math.log10(max));e++)for(const v of [1,2,5]){const x=v*10**e;if(x>=min&&x<=max)out.push(x);}return out;
  }
  function renderScatter(){
    const host=$('#scatter');if(!host)return;host.replaceChildren();highlightCost(null);
    const meta=costContext();$('#costChartTitle').textContent=meta.title;
    $('#costMetricLabel').textContent=`${isSample?'Illustrative data':'Measured results'} · ${meta.overall?'Overall':'Single task'}`;
    const pts=costRows().filter(r=>Number.isFinite(r.score)&&Number.isFinite(r.cost)&&r.cost>0);
    if(!pts.length){host.append(make('p','empty-plot','Scores and API costs for this task are not reported.'));$('#costChartNote').textContent='API cost uses a logarithmic scale.';return;}
    const W=Math.max(260,Math.round(host.clientWidth)),H=Math.max(282,Math.round(host.clientHeight)),M={l:43,r:18,t:28,b:47};
    const showNames=W>=430;
    const values=pts.map(p=>p.score*100),minScore=Math.min(...values),maxScore=Math.max(...values);
    let yMin=Math.max(0,Math.floor((minScore-2)/10)*10);
    let yMax=Math.min(100,Math.ceil((maxScore+2)/10)*10);
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
        const label=p.m.short||shortModelNames[p.m.id]||p.m.name,w=ctx.measureText(label).width+2,h=15,candidates=[];
        for(const dy of [0,-20,20,-38,38,-56,56,-74,74])for(const side of [1,-1])candidates.push({x:side===1?p.cx+16:p.cx-16-w,y:p.cy-7+dy,w,h,side});
        const inBounds=c=>c.x>M.l+2&&c.x+c.w<W-M.r&&c.y>=M.t-12&&c.y+c.h<H-M.b-2;
        const chosen=candidates.find(c=>inBounds(c)&&!occupied.some(o=>intersects(c,o)));
        // Never overlap labels to force a fit: numbered markers still identify the model.
        if(chosen){occupied.push(chosen);labels.push({p,c:chosen,label});}
      });
    }
    labels.forEach(({p,c})=>{if(Math.abs(c.y+7-p.cy)>2)svg.append(mk('line',{x1:p.cx,y1:p.cy,x2:c.side===1?c.x-4:c.x+c.w+4,y2:c.y+7},'plot-leader'));});
    dots.forEach(p=>{
      const group=mk('g',{tabindex:0,role:'button','aria-label':`${p.m.name}: ${pct(p.score)} points; ${preciseUSD(p.cost)}. Show details.`},'plot-point-group');
      group.append(mk('circle',{cx:p.cx,cy:p.cy,r:8.5},'plot-point'),text(costModelIds[p.m.id],{x:p.cx,y:p.cy+3,'text-anchor':'middle','aria-hidden':true},'plot-point-number'));
      linkCost(group,p);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showTip(group,costTip(p));}});svg.append(group);
    });
    labels.forEach(({p,c,label})=>svg.append(text(label,{x:c.x,y:c.y+11,'data-label-for':p.m.id,'data-cost-model':p.m.id},'plot-label')));
    host.append(svg);
    $('#costChartNote').textContent='API cost uses a logarithmic scale.';
  }
  const sortedCostRows=()=>costRows().sort((a,b)=>{
    const av=a[costSort.key],bv=b[costSort.key];if(!Number.isFinite(av)&&!Number.isFinite(bv))return 0;if(!Number.isFinite(av))return 1;if(!Number.isFinite(bv))return -1;
    return (costSort.direction==='asc'?1:-1)*(av-bv);
  });
  function renderCostTable(){
    const host=$('#costTable');host.replaceChildren();highlightCost(null);const meta=costContext();
    const sortNames={cost:'API Cost',hours:'Agent Time',context:'Context Length'};
    const table=make('table','cost-table');table.append(make('caption','sr-only',`${meta.title}: costs and scores. ${isSample?'Illustrative data.':''} Point IDs remain fixed when sorting.`));
    const colgroup=make('colgroup');['model','cost','hours','context'].forEach(key=>colgroup.append(make('col','cost-col-'+key)));table.append(colgroup);
    const th=make('thead'),hr=make('tr'),mh=make('th',null,'Model / Harness');mh.scope='col';hr.append(mh);
    const cols=[['cost','API Cost'],['hours','Time'],['context','Context Length']];
    cols.forEach(([key,label])=>{
      const h=make('th');h.scope='col';h.setAttribute('aria-sort',key===costSort.key?(costSort.direction==='asc'?'ascending':'descending'):'none');
      const b=make('button',null,label+' ');b.type='button';b.dataset.sort=key;b.title=key==='hours'?'Median agent hours':key==='context'?'Input tokens minus cached tokens':sortNames[key];b.setAttribute('aria-label',`Sort by ${sortNames[key]}`);
      b.append(make('span',null,key===costSort.key?(costSort.direction==='asc'?'↑':'↓'):'↕'));
      b.addEventListener('click',()=>{costSort={key,direction:costSort.key===key?(costSort.direction==='asc'?'desc':'asc'):'asc'};hideTip();renderCostTable();$(`[data-sort="${key}"]`)?.focus({preventScroll:true});});h.append(b);hr.append(h);
    });th.append(hr);table.append(th);const body=make('tbody');
    sortedCostRows().forEach(r=>{
      const tr=make('tr');tr.dataset.model=r.m.id;tr.tabIndex=0;
      tr.setAttribute('aria-label',`${r.m.name}, ${r.m.harness}: ${pct(r.score)} points; API cost ${preciseUSD(r.cost)}; ${num(r.hours)} hours; context ${tokens(r.context)}.`);
      const name=make('th');name.scope='row';const label=make('div','cost-model-name');const badge=make('span','model-id',costModelIds[r.m.id]);badge.setAttribute('aria-hidden','true');
      const who=make('span');who.append(make('span','model-label',r.m.name),make('span','model-meta',r.m.harness));label.append(badge,who);name.append(label);
      tr.append(name,make('td',null,preciseUSD(r.cost)),make('td','cost-hours',Number.isFinite(r.hours)?r.hours.toFixed(1)+' h':'—'),make('td','cost-context',tokens(r.context)));
      linkCost(tr,r);body.append(tr);
    });table.append(body);host.append(table);
  }
  // CSV includes source status and cost basis so sample values cannot lose their qualification.
  $('#downloadCsv').addEventListener('click',()=>{
    const clean=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const headers=['data_status','snapshot_date','scope','model_id','model','harness','score_0_100','api_cost_usd','agent_hours','context_tokens','aggregation'];
    const rows=sortedCostRows().map(r=>[isSample?'illustrative_placeholder':'measured',BENCH.meta.updated,costView,r.m.id,r.m.name,r.m.harness,Number.isFinite(r.score)?(r.score*100).toFixed(6):'',Number.isFinite(r.cost)?r.cost.toFixed(6):'',Number.isFinite(r.hours)?r.hours.toFixed(4):'',Number.isFinite(r.context)?Math.round(r.context):'',costView==='overall'?'workflow_mean_then_overall_mean':'single_task']);
    const csv='\uFEFF'+[headers,...rows].map(r=>r.map(clean).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);const a=make('a');a.href=url;a.download=`rle-bench-${costView}-${isSample?'illustrative':'results'}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  });
  let resizeTimer;addEventListener('resize',()=>{hideTip();clearTimeout(resizeTimer);resizeTimer=setTimeout(renderScatter,120);});
  renderMeta();
  activeTask=byId[taskFromURL()]?taskFromURL():tasks[0].id;
  renderWorkflowTabs();renderTaskTabs();setTask(activeTask);renderCostTable();setTheme(theme());
  if(byId[location.hash.slice(1)])requestAnimationFrame(()=>$('#tasks').scrollIntoView());
})();
