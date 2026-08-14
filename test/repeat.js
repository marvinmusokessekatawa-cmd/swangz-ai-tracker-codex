const puppeteer=require('puppeteer-core'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1300);
  const shown = () => p.evaluate(()=>{const e=document.getElementById('deptPrompt'); return !!e && !e.hidden;});
  const signIn = async () => { await p.evaluate(()=>{
      devBypassSignIn();
      profile.department='Production'; profile.name='Arnold'; profile.role='Lead'; saveProfile&&saveProfile();
      try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
      if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
    await wait(1000); await p.evaluate(()=>{ if(typeof endTour==='function') endTour(); }); await wait(300); };

  await signIn();
  console.log('sign-in #1 -> prompt shown:', await shown());
  await p.evaluate(()=>dismissDeptPrompt()); await wait(500);
  console.log('  dismissed ->', await shown());

  // navigating around must NOT re-ask within the same sign-in
  await p.evaluate(()=>{ switchView('admin'); }); await wait(400);
  await p.evaluate(()=>{ switchView('tools'); }); await wait(900);
  console.log('after navigating away and back -> shown:', await shown(), '(should be false)');

  // signing out and back in MUST ask again
  await p.evaluate(()=>{ if(typeof resetDeptPrompt==='function') resetDeptPrompt(); authUser=null; switchView('auth'); });
  await wait(500);
  await signIn();
  console.log('sign-in #2 -> prompt shown:', await shown(), '(should be true)');
  await p.evaluate(()=>dismissDeptPrompt()); await wait(400);

  // a third time, through the bypass button itself
  await p.evaluate(()=>{ authUser=null; switchView('auth'); }); await wait(400);
  await signIn();
  console.log('sign-in #3 -> prompt shown:', await shown(), '(should be true)');

  // a different account is asked on its own terms
  await p.evaluate(()=>{ authUser={id:'x',email:'someone@swangzavenue.com',user_metadata:{full_name:'Someone'}};
    syncProfileFromAuth(authUser); profile.department='Content'; profile.name='Someone'; saveProfile&&saveProfile();
    switchView('admin'); });
  await wait(300);
  await p.evaluate(()=>switchView('tools')); await wait(900);
  console.log('different account -> shown:', await shown(), '(should be true)');
  console.log('errors:', errs.slice(0,3));
  await b.close(); process.exit(0);
})();
