import * as THREE from '../vendor/three.module.js';

const money=(v,c='$')=>`${c}${v.toFixed(2)}`;
const pct=v=>`${(100*v).toFixed(1)}%`;
const slug=document.querySelector('.model-explorer')?.dataset.model;
const root=document.querySelector('.model-explorer');
const choiceLabels={
  rule:['Reference','Count invoices','Module 1 rules','Keep canceled orders','Keep non-products','Keep duplicates'],
  method:['Last click','First click','Linear','Markov','Shapley'],
  channel:['Display','Social','Search','Email','Retargeting'],
  window:['All 156 weeks','Last quarter'],
  horizon:['Week 1','90 days']
};

const scenarios={
  uplift:{
    controls:[['margin','Gross margin',.2,.8,.05,.3],['cost','Cost per email ($)',0,.5,.05,.1]],
    render(s){
      const names=['$0–100','$100–200','$200–350','$350–500','$500–750','$750–1k','$1k+'];
      const n0=[7612,4836,4044,2124,1652,622,416],n1=[7634,4727,4155,2188,1662,593,428];
      const untreated=[.5169,.4229,.9329,1.0103,.5389,.3495,2.1698], treated=[1.1427,.8813,.6097,.9094,1.8245,.9978,4.6766];
      const net=names.map((_,i)=>s.margin*(treated[i]-untreated[i])-s.cost);
      const selected=net.map((v,i)=>v>0?i:-1).filter(i=>i>=0);
      return {x:names,y:['No email','Women’s email'],v:[untreated,treated],unit:'Mean two-week spend ($)',colors:['#80b4d0','#47d7bb'],
        summary:`At ${pct(s.margin)} margin and ${money(s.cost)} send cost, the observed subgroup differences clear the cost in ${selected.length} of 7 prior-spend bands. These raw differences are noisy and are not individual causal effects; confirm any targeting rule on held-out randomized data.`,
        rows:names.map((n,i)=>[n,`${n0[i]} / ${n1[i]}`,money(untreated[i]),money(treated[i]),money(net[i]),net[i]>0?'Test targeting':'Do not target on this estimate'])};
    },headers:['Prior spend','Control / email n','No email','Email','Net margin difference','Illustrative action']
  },
  cleaning:{
    controls:[['rule','Cleaning choice',[0,1,2,3,4,5],null,null,0]],
    render(s){
      const names=['Reference','Count invoices','Module 1 rules','Keep canceled orders','Keep non-products','Keep duplicates'];
      const added=[0,14,48,24,17,10],dropped=[0,139,3,3,3,1];
      const i=Number(s.rule),count=2212+added[i]-dropped[i];
      return{x:names,y:['Added','Dropped'],v:[added,dropped],unit:'Customers who change contact status',colors:['#47d7bb','#f6a66a'],
        summary:`With the module’s fixed £10 contact cost, 30% margin and 10% assumed lift, “${names[i]}” puts ${count.toLocaleString()} customers on the contact list, versus 2,212 after reference cleaning. ${added[i]} enter and ${dropped[i]} leave. These are measured list changes from the module’s Online Retail II run, not refitted live.`,
        rows:names.map((n,j)=>[n,added[j],dropped[j],2212+added[j]-dropped[j]])};
    },headers:['Choice','Added','Dropped','Contact list size']
  },
  survival:{
    controls:[['q','Share persuaded to onboard',0,.8,.05,.35],['cost','Call cost ($)',3,25,1,15],['margin','Monthly margin ($)',8,20,1,12]],
    render(s){
      const months=[2.22,2.67,3.10], vals=months.map(x=>x*s.q*s.margin);
      const br=s.cost/(2.67*s.margin), net=vals[1]-s.cost;
      return{x:['Lower','Estimate','Upper'],y:['Value per call','Call cost'],v:[vals,[s.cost,s.cost,s.cost]],unit:'Dollars per subscriber',colors:['#47d7bb','#f6a66a'],
        summary:`At ${pct(s.q)} onboarding success, expected value is ${money(vals[1])} per call against ${money(s.cost)} cost (${money(net)} net). Break-even success is ${pct(br)}. The 2.22–3.10 months range is the module’s 95% bootstrap interval for a synthetic cohort; it does not include uncertainty in your chosen success rate.`,
        rows:['Lower 95% limit','Point estimate','Upper 95% limit'].map((x,i)=>[x,months[i].toFixed(2),money(vals[i]),money(vals[i]-s.cost)])};
    },headers:['Gain estimate','Extra months','Call value','Net of call cost']
  },
  dml:{
    controls:[['missing','Unmeasured confounding shift ($)',0,8,.1,0],['credit','Install credit ($)',1,5,.25,2.5]],
    render(s){
      const estimates=[65.64,32.11,13.51-s.missing],lower=10.51-s.missing,upper=16.50-s.missing;
      const threshold=s.credit/.3, recommendation=lower>threshold?'Offer the credit':'Run a randomized credit test first';
      return{x:['Naive','Linear controls','DML'],y:['Spend effect','Break-even spend'],v:[estimates,[threshold,threshold,threshold]],unit:'26-week spend effect ($)',colors:['#47d7bb','#f6a66a'],
        summary:`Double machine learning (DML) gives ${money(estimates[2])} extra spend per persuaded install under the assumed ${money(s.missing)} omitted-variable shift. Its shifted 95% interval is ${money(lower)} to ${money(upper)}. At 30% margin a ${money(s.credit)} credit needs ${money(threshold)} extra spend. ${recommendation}. The shift is a sensitivity scenario, not a new fitted estimate.`,
        rows:['Naive difference','Linear controls','DML with shift'].map((x,i)=>[x,money(estimates[i]),money(estimates[i]*.3-s.credit)])};
    },headers:['Estimator','Spend effect','Net margin per persuaded install']
  },
  attribution:{
    controls:[['method','Attribution method',[0,1,2,3,4],null,null,0],['channel','Budget candidate',[0,1,2,3,4],null,null,4]],
    render(s){
      const names=['Display','Social','Search','Email','Retargeting'];
      const methods=['Last click','First click','Linear','Markov','Shapley'];
      const credit=[[450,506,532,418,1114],[1183,804,312,431,290],[797,685,441,369,728],[738,654,472,456,700],[624,654,644,354,744]][Number(s.method)];
      const truth=[358,448,340,114,0],j=Number(s.channel);const sums=credit.reduce((a,b)=>a+b,0),trueSum=truth.reduce((a,b)=>a+b,0);
      return{x:names,y:[methods[Number(s.method)],'True incrementality'],v:[credit,truth],unit:'Credited or incremental conversions',colors:['#80b4d0','#47d7bb'],
        summary:`${methods[Number(s.method)]} gives ${names[j].toLowerCase()} ${credit[j]} conversions (${pct(credit[j]/sums)} of tracked credit); removing that channel in the synthetic counterfactual changes ${truth[j]} conversions (${pct(truth[j]/trueSum)} of summed channel effects). Journey credit alone cannot justify the budget; use an incrementality test.`,
        rows:names.map((n,i)=>[n,credit[i],truth[i],pct(credit[i]/sums),pct(truth[i]/trueSum)])};
    },headers:['Channel','Method credit','True incrementality','Credit share','True share']
  },
  drift:{
    controls:[['window','Decision window',[0,1],null,null,1],['margin','Gross margin',.2,.5,.025,.3]],
    render(s){
      const names=['TV','Search','Social','Display'], all=[1.6,3,4,.6], recent=[1.5932,2.8539,2.108,0.5821];
      const chosen=Number(s.window)===0?all:recent, threshold=1/s.margin;
      return{x:names,y:[Number(s.window)===0?'All weeks':'Last quarter','Break-even'],v:[chosen,chosen.map(()=>threshold)],unit:'Sales return per $1 spend',colors:['#47d7bb','#f6a66a'],
        summary:`At ${pct(s.margin)} margin, break-even return on ad spend is ${threshold.toFixed(2)}. Social’s known return in this seeded simulation is ${chosen[2].toFixed(2)} over ${Number(s.window)===0?'all weeks':'the last quarter'}: ${chosen[2]>=threshold?'keep under this average-return screen':'cut or test before renewing'}. The lab’s fitted model has uncertainty; these bars show generator truth so the effect of the window is visible.`,
        rows:names.map((n,i)=>[n,all[i].toFixed(2),recent[i].toFixed(2),chosen[i]>=threshold?'Above':'Below'])};
    },headers:['Channel','All-period truth','Recent truth','Versus break-even']
  },
  notifications:{
    controls:[['horizon','Outcome window',[0,1],null,null,1],['cadence','Selected sends per week',[0,1,2,3,5,7],null,null,3]],
    render(s){
      const cadence=[0,1,2,3,5,7], week=[1.28,1.51,1.63,1.83,1.95,1.95],quarter=[13.34,17.68,19.88,21.88,20.41,17.93], optout=[0,.007,.019,.054,.258,.458];
      const v=Number(s.horizon)===0?week:quarter,i=cadence.indexOf(Number(s.cadence));
      const optoutScale=Number(s.horizon)===0?4:40;
      const best=v.indexOf(Math.max(...v));
      return{x:cadence.map(x=>String(x)),y:[Number(s.horizon)===0?'Week 1 margin':'90-day margin',`Opt-out share × ${optoutScale}`],v:[v,optout.map(x=>x*optoutScale)],unit:`Margin per user ($); opt-out scaled ×${optoutScale} for visibility`,colors:['#47d7bb','#f6a66a'],
        summary:`${cadence[i]} reminders per week produces ${money(v[i])} per user over ${Number(s.horizon)===0?'week 1':'90 days'} and ${pct(optout[i])} opt-outs by day 90. The best cadence on this ${Number(s.horizon)===0?'short':'long'} horizon is ${cadence[best]} per week${Number(s.horizon)===0?' (tied with 7)':''}. The orange bars multiply opt-out share by ${optoutScale} only to show both measures; use the table for the raw rates.`,
        rows:cadence.map((n,j)=>[n,money(week[j]),money(quarter[j]),pct(optout[j])])};
    },headers:['Sends / week','Week 1 margin','90-day margin','90-day opt-out']
  }
};

if(root && scenarios[slug]){
  const cfg=scenarios[slug],controls=root.querySelector('.controls'),stage=root.querySelector('.stage');
  const readout=root.querySelector('.readout'),key=root.querySelector('.key'),table=root.querySelector('table');
  const state={};
  for(const [id,label,min,max,step,initial] of cfg.controls){
    state[id]=initial;const wrap=document.createElement('label');wrap.textContent=label;
    const value=document.createElement('span');value.className='value';
    const input=document.createElement(Array.isArray(min)?'select':'input');
    if(Array.isArray(min)){for(const x of min){const o=document.createElement('option');o.value=x;o.textContent=choiceLabels[id]?.[x]??String(x);input.append(o)}input.value=initial}
    else {input.type='range';Object.assign(input,{min,max,step,value:initial})}
    const show=()=>{value.textContent=Array.isArray(min)?'':String(input.value);state[id]=Number(input.value);update()};
    value.textContent=Array.isArray(min)?'':String(initial);
    input.addEventListener('input',show);wrap.append(input,value);controls.append(wrap);
  }
  let renderer,scene,camera,chartGroup;
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.append(renderer.domElement);
    scene=new THREE.Scene();scene.background=new THREE.Color('#132d38');
    camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(9,8,13);camera.lookAt(0,1,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0x234c55,2));
    const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,9,6);scene.add(light);
    chartGroup=new THREE.Group();scene.add(chartGroup);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,8),new THREE.MeshPhongMaterial({color:0x214452,side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;scene.add(floor);
    const size=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)};
    new ResizeObserver(size).observe(stage);
    let drag=false,lastX=0;renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)});
    renderer.domElement.addEventListener('pointerup',()=>drag=false);
    renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;chartGroup.rotation.y+=(e.clientX-lastX)*.008;lastX=e.clientX;renderer.render(scene,camera)});
    size();
  }catch(err){stage.textContent='3D view unavailable on this device; the data table below remains usable.';}
  function update(){
    const d=cfg.render(state);readout.textContent=d.summary;
    key.replaceChildren();d.y.forEach((name,i)=>{const span=document.createElement('span');span.textContent=name;span.style.setProperty('--swatch',d.colors[i]);key.append(span)});
    table.replaceChildren();const head=document.createElement('thead'),hr=document.createElement('tr');
    cfg.headers.forEach(x=>{const th=document.createElement('th');th.textContent=x;hr.append(th)});head.append(hr);table.append(head);
    const body=document.createElement('tbody');d.rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.append(td)});body.append(tr)});table.append(body);
    root.querySelector('.axis').textContent=`3D chart: ${d.unit}. Left to right: ${d.x.join(', ')}. Drag to rotate; use the table for exact values.`;
    if(!chartGroup)return;
    chartGroup.clear();const max=Math.max(...d.v.flat().map(Math.abs),.01),rows=d.y.length,cols=d.x.length;
    camera.position.set(cols>5?9:7,8,cols>5?13:10);camera.lookAt(0,1.3,0);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const val=d.v[j][i],height=Math.max(.05,Math.abs(val)/max*5);
      const box=new THREE.Mesh(new THREE.BoxGeometry(Math.min(.85,9/cols),height,.65),new THREE.MeshPhongMaterial({color:d.colors[j],transparent:true,opacity:.95}));
      box.position.set((i-(cols-1)/2)*(Math.min(1.2,9/cols)),(val<0?-1:1)*height/2,(j-(rows-1)/2)*1.6);
      chartGroup.add(box);
    }
    renderer?.render(scene,camera);
  }
  update();
}
