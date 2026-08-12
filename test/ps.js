const puppeteer = require('puppeteer-core');
const path=require('path'), fs=require('fs'); const OUT=path.join(__dirname,'..','shots','ps');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    sessionStorage.setItem('swangz_admin_otp_v1',JSON.stringify({hash:'',email:currentEmail(),exp:Date.now()+36e5,tries:0,verified:true}));
    adminUnlocked=true; switchView('admin'); showAdminContent(); renderAdmin(); DECK.closeAll(true); DECK.open('profile'); });
  await wait(1000);
  const m=async()=>p.evaluate(()=>{
    const el=document.querySelector('.deck-panel');
    if(!el) return {error:'no panel'};
    const r=el.getBoundingClientRect();
    const sum=document.querySelector('.ps-pane > summary');
    return {h:Math.round(r.height),w:Math.round(r.width),
            open:document.querySelectorAll('.ps-pane[open]').length,
            panes:document.querySelectorAll('.ps-pane').length,
            rowH: sum ? Math.round(sum.getBoundingClientRect().height) : 0};});
  console.log('profile tile:', JSON.stringify(await m()));
  await p.screenshot({path:path.join(OUT,'profile.png')}); console.log('📸 profile');
  // clicking a second pane must fold the first
  await p.evaluate(()=>{const s=[...document.querySelectorAll('.ps-pane > summary')]; s[s.length-1].click();});
  await wait(500);
  console.log('after clicking the last pane:', JSON.stringify(await m()));
  await p.screenshot({path:path.join(OUT,'profile-2.png')}); console.log('📸 profile-2');
  await p.evaluate(()=>{DECK.closeAll(true); DECK.open('settings');}); await wait(900);
  console.log('settings tile:', JSON.stringify(await m()));
  await p.screenshot({path:path.join(OUT,'settings.png')}); console.log('📸 settings');
  console.log('errors:',errs.slice(0,3)); await b.close(); process.exit(0);
})();
