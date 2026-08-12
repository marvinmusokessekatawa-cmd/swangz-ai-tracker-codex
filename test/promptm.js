const puppeteer=require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','prompt'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',
    args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1400);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    profile.department='Production'; profile.name='Arnold Kigozi'; profile.role='Redesign Lead'; saveProfile&&saveProfile();
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
    if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
  await wait(1500);
  await p.evaluate(()=>{ if(typeof endTour==='function') endTour(); });
  await wait(500);
  await p.screenshot({path:path.join(OUT,'04-phone.png')}); console.log('📸 04-phone');
  console.log(await p.evaluate(()=>{ const el=document.getElementById('deptPrompt');
    const c=el&&el.querySelector('.dp-card'); const r=c&&c.getBoundingClientRect();
    return JSON.stringify({ shown: el&&!el.hidden, cardW: r?Math.round(r.width):0, cardH: r?Math.round(r.height):0,
      fitsWidth: r? r.left>=0 && r.right<=innerWidth+1 : null,
      fitsHeight: r? r.top>=0 && r.bottom<=innerHeight+1 : null,
      sideways: document.documentElement.scrollWidth>document.documentElement.clientWidth+1 }); }));
  console.log('errors:', errs.slice(0,3));
  await b.close(); process.exit(0);
})();
