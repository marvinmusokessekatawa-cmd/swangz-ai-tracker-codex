const puppeteer = require('puppeteer-core');
const path=require('path'), fs=require('fs');
const OUT=path.join(__dirname,'..','shots','wiz'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async () => {
  fs.mkdirSync(OUT,{recursive:true});
  const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900']});
  const p = await b.newPage(); await p.setViewport({width:1440,height:900});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); profile.department='Production'; profile.name='Arnold'; profile.role='Lead'; saveProfile&&saveProfile();
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
    if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
  await wait(1100);
  await p.evaluate(()=>{ if(typeof endTour==='function') endTour(); openAddChooser(); }); await wait(600);
  await p.evaluate(()=>chooseAddType('report')); await wait(1100);
  await p.screenshot({path:path.join(OUT,'step1.png')}); console.log('📸 step1');
  console.log('dashes:', await p.evaluate(()=>document.querySelectorAll('#wizProgress .ws').length),
              '| numbers present:', await p.evaluate(()=>/[0-9]/.test(document.getElementById('wizProgress').textContent)),
              '| titles present:', await p.evaluate(()=>document.getElementById('wizProgress').textContent.trim().length>0));
  await p.evaluate(()=>{ const set=(id,v)=>{const e=document.getElementById(id); if(e){e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));}};
    set('f_toolName','Descript'); set('f_category',document.getElementById('f_category').options[1].value); set('f_status',document.getElementById('f_status').options[1].value); });
  await wait(300);
  await p.evaluate(()=>nextStep()); await wait(700);
  await p.screenshot({path:path.join(OUT,'step2.png')}); console.log('📸 step2');
  console.log('current dash index:', await p.evaluate(()=>[...document.querySelectorAll('#wizProgress .ws')].findIndex(x=>x.classList.contains('current'))));
  console.log('done dashes:', await p.evaluate(()=>document.querySelectorAll('#wizProgress .ws.done').length));
  console.log('clickable (visited):', await p.evaluate(()=>[...document.querySelectorAll('#wizProgress .ws')].filter(x=>!x.disabled).length));
  await p.evaluate(()=>gotoStep(1)); await wait(700);
  console.log('back to step 1 by dash:', await p.evaluate(()=>[...document.querySelectorAll('#wizProgress .ws')].findIndex(x=>x.classList.contains('current'))));
  await p.setViewport({width:390,height:844}); await wait(600);
  await p.screenshot({path:path.join(OUT,'mobile.png')}); console.log('📸 mobile');
  console.log('errors:', errs.slice(0,3));
  await b.close(); process.exit(0);
})();
