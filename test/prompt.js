const puppeteer=require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','prompt'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',
    args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    profile.department='Production'; profile.name='Arnold Kigozi'; profile.role='Redesign Lead'; saveProfile&&saveProfile();
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
    if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
  await wait(1400);
  await p.evaluate(()=>{ if(typeof endTour==='function') endTour(); });
  await wait(400);
  await p.screenshot({path:path.join(OUT,'01-prompt.png')}); console.log('📸 01-prompt');

  const st = await p.evaluate(()=>{
    const el=document.getElementById('deptPrompt');
    const card=el&&el.querySelector('.dp-card');
    const cs=el?getComputedStyle(el):null;
    const stat=document.getElementById('quickStats');
    return { shown: el && !el.hidden,
             wrapperPointer: cs?cs.pointerEvents:null,
             cardPointer: card?getComputedStyle(card).pointerEvents:null,
             statsSoftened: stat ? (getComputedStyle(stat).filter||'none') + ' / opacity ' + getComputedStyle(stat).opacity : 'no #quickStats',
             bodyClass: document.body.className.includes('dept-asking') };
  });
  console.log('state:', JSON.stringify(st));

  // Can the page BEHIND still be interacted with? click through where the wrapper covers.
  const behind = await p.evaluate(()=>{
    const el = document.elementFromPoint(200, 780);   // sidebar area, under the wrapper
    return el ? el.tagName+'.'+(typeof el.className==='string'?el.className:'') : 'nothing';
  });
  console.log('element under the wrapper at (200,780):', behind, '  <- must NOT be .dept-prompt');

  const scrolled = await p.evaluate(()=>{ const m=document.querySelector('main')||document.scrollingElement;
    const before=m.scrollTop; m.scrollTop=120; const after=m.scrollTop; m.scrollTop=before; return after; });
  console.log('page behind still scrolls:', scrolled > 0 || 'page too short to scroll');

  // choosing report opens the wizard
  await p.evaluate(()=>document.querySelector('.dpz-choice').click());
  await wait(1200);
  console.log('after choosing Report -> wizard open:', await p.evaluate(()=>{
    const d=document.getElementById('detailView'); return !!d && d.classList.contains('open'); }));
  console.log('prompt gone:', await p.evaluate(()=>document.getElementById('deptPrompt').hidden));
  console.log('stats visible again:', await p.evaluate(()=>!document.body.className.includes('dept-asking')));
  await p.screenshot({path:path.join(OUT,'02-after-choice.png')}); console.log('📸 02-after-choice');

  // not asked twice in the same session
  await p.evaluate(()=>{ closeWizard(); switchView('admin'); }); await wait(500);
  await p.evaluate(()=>switchView('tools')); await wait(900);
  console.log('asked again in the same session:', await p.evaluate(()=>!document.getElementById('deptPrompt').hidden), '<- must be false');
  await p.screenshot({path:path.join(OUT,'03-dashboard.png')}); console.log('📸 03-dashboard');

  // phone
  await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await p.evaluate(()=>{ sessionStorage.removeItem('swangz_dept_prompt_v1'); switchView('admin'); });
  await wait(400);
  await p.evaluate(()=>switchView('tools')); await wait(1100);
  await p.screenshot({path:path.join(OUT,'04-phone.png')}); console.log('📸 04-phone');
  console.log('phone sideways scroll:', await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1));
  console.log('errors:', errs.slice(0,3));
  await b.close(); process.exit(0);
})();
