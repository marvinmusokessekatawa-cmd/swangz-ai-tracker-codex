const puppeteer=require('puppeteer-core'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    profile.department='Production'; profile.name='Arnold Kigozi'; profile.role='Lead'; saveProfile&&saveProfile();
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
    sessionStorage.setItem('swangz_dept_prompt_v1','1');
    if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
  await wait(1400);
  console.log(await p.evaluate(()=>{
    const v=document.getElementById('toolsView');
    const vis = [...v.querySelectorAll(':scope > *')]
      .map(e=>({id:e.id||String(e.className).slice(0,24), shown:e.offsetParent!==null, h:Math.round(e.getBoundingClientRect().height)}));
    return JSON.stringify({ blocks: vis, listRows: document.querySelectorAll('#toolsList .tool-item, #toolsList tr, .tools-table tbody tr').length }, null, 1);
  }));
  await b.close(); process.exit(0);
})();
