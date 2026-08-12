const puppeteer=require('puppeteer-core'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1200);
  console.log(await p.evaluate(()=>JSON.stringify({
    coarse: matchMedia('(pointer: coarse)').matches,
    anyCoarse: matchMedia('(any-pointer: coarse)').matches,
    hover: matchMedia('(hover: hover)').matches,
    touchPoints: navigator.maxTouchPoints,
    width919: matchMedia('(max-width: 919px)').matches,
  },null,1)));
  // does the ws hit area actually work? tap 10px above the bar's centre
  await p.evaluate(()=>{ devBypassSignIn(); profile.department='Production'; profile.name='A'; profile.role='r'; saveProfile&&saveProfile();
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
    if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
  await wait(900);
  await p.evaluate(()=>{ if(typeof endTour==='function') endTour(); openAddChooser(); }); await wait(500);
  await p.evaluate(()=>chooseAddType('report')); await wait(900);
  console.log('hit area at 10px above the dash resolves to:', await p.evaluate(()=>{
    const w=document.querySelector('#wizProgress .ws'); const r=w.getBoundingClientRect();
    const el=document.elementFromPoint(r.left+r.width/2, r.top-10);
    return el ? el.tagName+'.'+(el.className||'') : 'nothing';
  }));
  await b.close(); process.exit(0);
})();
