const puppeteer = require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','dept'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,980']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:980});
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1200);
  await p.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await p.reload({waitUntil:'networkidle2'}); await wait(1300);
  // sign in as an ordinary department person so the landing shows
  await p.evaluate(()=>{ authUser={id:'u',email:'team@swangzavenue.com',user_metadata:{full_name:'Team Member'}};
    syncProfileFromAuth(authUser); profile.department=''; profile.name=''; switchView('landing'); });
  await wait(1200);
  await p.screenshot({path:path.join(OUT,'landing.png')}); console.log('📸 landing');
  console.log('tiles:', await p.evaluate(()=>document.querySelectorAll('.dept-tile').length));
  console.log('text:', await p.evaluate(()=>{const v=document.getElementById('landingView'); return v?v.innerText.replace(/\s+/g,' ').slice(0,320):'(none)';}));
  await p.setViewport({width:390,height:844}); await wait(700);
  await p.screenshot({path:path.join(OUT,'landing-mobile.png')}); console.log('📸 landing-mobile');
  await b.close(); process.exit(0);
})();
