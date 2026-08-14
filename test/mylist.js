const puppeteer=require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','mylist'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{
    devBypassSignIn();
    profile.department='Production'; profile.name='Arnold Kigozi'; profile.role='Lead';
    profile.email='arnoldkigozi0@gmail.com'; saveProfile&&saveProfile();
    const mk=(n,tag,status,rs)=>({id:'me-'+n,kind:'tool',tag,requestStatus:rs||'',department:'Production',
      submittedBy:'Arnold Kigozi', submittedByEmail:'arnoldkigozi0@gmail.com', role:'Lead',
      toolName:n, toolNameRaw:n, officialUrl:'', category:'Video Generation', status,
      reason:'r', impact:'i', projects:[], tradTime:4, aiTime:1, tradCost:100, frequency:4,
      currency:'USD', toolMonthlyCost:35, extraCredits:0, revenueAmount:0,
      submittedAt:new Date().toISOString(), updatedAt:new Date().toISOString()});
    entries = [ mk('Runway','report','In Active Use'), mk('ElevenLabs','report','Piloting'),
                mk('HeyGen','request','Requesting (need to invest)','new'),
                mk('Descript','request','Requesting (need to invest)','approved') ];
    saveEntries&&saveEntries();
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
    sessionStorage.setItem('swangz_dept_prompt_v1','1');
    if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); renderToolsList();
  });
  await wait(1300);
  await p.screenshot({path:path.join(OUT,'desktop.png')}); console.log('📸 desktop');
  console.log(await p.evaluate(()=>{
    const t=document.querySelector('#toolsList table');
    const heads=[...document.querySelectorAll('#toolsList thead th')].map(h=>h.textContent.trim()).filter(Boolean);
    const rows=[...document.querySelectorAll('#toolsList tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ').trim());
    const hist=document.getElementById('myHistoryStats');
    return JSON.stringify({ headers:heads, rows, counts: hist?hist.innerText.replace(/\n+/g,' | '):'(hidden)' },null,1);
  }));
  console.log('gap probe:', await p.evaluate(()=>{
    const v=document.getElementById('toolsView');
    return [...v.querySelectorAll(':scope > *')].map(e=>{const r=e.getBoundingClientRect();
      return (e.id||String(e.className).slice(0,22))+' y='+Math.round(r.top)+'..'+Math.round(r.bottom)+(e.offsetParent?'':' HIDDEN');}).join(' | ');}));
  await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}); await wait(800);
  await p.screenshot({path:path.join(OUT,'phone.png')}); console.log('📸 phone');
  console.log('sideways:', await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1));
  console.log('errors:', errs.slice(0,3));
  await b.close(); process.exit(0);
})();
