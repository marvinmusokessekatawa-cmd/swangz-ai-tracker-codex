const puppeteer = require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','money'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    sessionStorage.setItem('swangz_admin_otp_v1',JSON.stringify({hash:'',email:currentEmail(),exp:Date.now()+36e5,tries:0,verified:true}));
    adminUnlocked=true; switchView('admin'); showAdminContent(); renderAdmin(); });
  await wait(1000);
  for (const sec of ['acc_finance','acc_calc']) {
    await p.evaluate(s=>{DECK.closeAll(true); showAdminSection(s);}, sec); await wait(800);
    await p.screenshot({path:path.join(OUT,sec+'.png')}); console.log('📸 '+sec);
    console.log('   text:', (await p.evaluate(()=>document.getElementById('adminContent').innerText.replace(/\s+/g,' ').slice(0,300))));
  }
  await b.close(); process.exit(0);
})();
