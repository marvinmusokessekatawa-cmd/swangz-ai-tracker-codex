const puppeteer = require('puppeteer-core'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    sessionStorage.setItem('swangz_admin_otp_v1',JSON.stringify({hash:'',email:currentEmail(),exp:Date.now()+36e5,tries:0,verified:true}));
    adminUnlocked=true; switchView('admin'); showAdminContent(); renderAdmin(); });
  await wait(1200);
  console.log(await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('.rail-group, #adminNav button, .nav-sep ~ *').forEach(el=>{
      const badge = el.querySelector && el.querySelector('.nav-badge, .dot, [class*="badge"], [class*="dot"], [class*="pip"]');
      const st = getComputedStyle(el, '::after');
      if (badge || (st.content && st.content !== 'none' && st.content !== '""'))
        out.push({ cls: el.className, label:(el.textContent||'').trim().slice(0,22),
                   badge: badge ? {cls:badge.className, txt:(badge.textContent||'').trim()} : null,
                   after: st.content, afterBg: st.backgroundColor });
    });
    return JSON.stringify(out, null, 1);
  }));
  await b.close(); process.exit(0);
})();
