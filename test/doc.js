const puppeteer = require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','doc'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,980']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:980});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    sessionStorage.setItem('swangz_admin_otp_v1',JSON.stringify({hash:'',email:currentEmail(),exp:Date.now()+36e5,tries:0,verified:true}));
    adminUnlocked=true; switchView('admin'); showAdminContent(); renderAdmin(); });
  await wait(1000);
  for (const [name,pick] of [['report',()=>entries.find(x=>x.tag!=='request'&&x.kind!=='registry')],['request',()=>entries.find(x=>x.tag==='request')]]) {
    await p.evaluate(f=>{ const e=eval('('+f+')')(); DECK.closeAll(true); if(e) DECK.open('submissionDoc', e.id); }, pick.toString());
    await wait(1100);
    await p.screenshot({path:path.join(OUT,name+'.png')}); console.log('📸 '+name);
    const t = await p.evaluate(()=>{const el=document.querySelector('.doc-paper'); return el?el.innerText.replace(/\n{2,}/g,'\n'):'(none)';});
    console.log('--- '+name+' ---\n'+t.slice(0,900)+'\n');
  }
  console.log('logo embedded:', await p.evaluate(()=>{const i=document.querySelector('.doc-paper .dm-mark'); return !!i && i.src.startsWith('data:') && i.naturalWidth>0;}));
  console.log('errors:',errs.slice(0,3)); await b.close(); process.exit(0);
})();
