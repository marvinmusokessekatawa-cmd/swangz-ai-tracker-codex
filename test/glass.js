const puppeteer = require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','glass'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,980']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:980});
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    sessionStorage.setItem('swangz_admin_otp_v1',JSON.stringify({hash:'',email:currentEmail(),exp:Date.now()+36e5,tries:0,verified:true}));
    adminUnlocked=true; switchView('admin'); showAdminContent(); renderAdmin(); showAdminSection('acc_business');
    DECK.closeAll(true); const g=_toolGroups(filteredEntries())[0];
    if(g){ DECK.open('tool',g.key); DECK.openFrom('tool|'+JSON.stringify(g.key),'toolNumbers',g.key); } });
  await wait(1400);
  await p.screenshot({path:path.join(OUT,'tiles.png')}); console.log('📸 tiles');
  console.log('open tiles:', await p.evaluate(()=>document.querySelectorAll('.deck-panel:not(.min)').length));
  console.log('resting blur cheaper:', await p.evaluate(()=>{
    const r=document.querySelector('.deck-panel.resting'); const f=document.querySelector('.deck-panel.focused');
    return r&&f ? {resting:getComputedStyle(r).backdropFilter, focused:getComputedStyle(f).backdropFilter} : 'n/a';}));
  await b.close(); process.exit(0);
})();
