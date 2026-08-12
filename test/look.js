const puppeteer = require('puppeteer-core');
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots', 'look');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
    args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900'] });
  const p = await b.newPage(); await p.setViewport({width:1440,height:900});
  const shot = async n => { await wait(500); await p.screenshot({path: path.join(OUT, n+'.png')}); console.log('  📸 '+n); };
  await p.goto('http://127.0.0.1:8000/index.html', {waitUntil:'networkidle2'}); await wait(1300);

  // landing / department picker — before a profile exists
  await p.evaluate(() => { localStorage.removeItem('swangz_profile_v1'); });
  await p.reload({waitUntil:'networkidle2'}); await wait(1300);
  await p.evaluate(() => { devBypassSignIn(); });
  await wait(1200);
  await shot('01-department-picker');

  await p.evaluate(() => { profile.department='Production'; profile.name='Arnold Kigozi'; profile.role='Redesign Lead'; saveProfile&&saveProfile(); seedDemoData(true);
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify(['Production']))}catch(e){}
    if(typeof endTour==='function') endTour(); switchView('tools'); });
  await wait(1200);
  await p.evaluate(() => { if(typeof endTour==='function') endTour(); openAddChooser(); });
  await wait(700);
  await p.evaluate(() => { chooseAddType('report'); });
  await wait(1200);
  await shot('02-wizard-step1');
  await p.evaluate(() => { gotoStep(2); });
  await wait(800);
  await shot('03-wizard-step2');
  await p.evaluate(() => { closeWizard(); });

  // admin
  await p.evaluate(() => {
    sessionStorage.setItem('swangz_admin_otp_v1', JSON.stringify({hash:'',email:currentEmail(),exp:Date.now()+36e5,tries:0,verified:true}));
    adminUnlocked = true; switchView('admin'); showAdminContent(); renderAdmin(); });
  await wait(1000);
  await p.evaluate(() => { DECK.closeAll(true); DECK.open('profile'); });
  await wait(900); await shot('04-profile-tile');
  await p.evaluate(() => { DECK.closeAll(true); DECK.open('settings'); });
  await wait(900); await shot('05-settings-tile');
  await p.evaluate(() => { DECK.closeAll(true); showAdminSection('acc_money'); });
  await wait(900); await shot('06-money-section');
  await p.evaluate(() => { const r = toolPricingRows()[0]; DECK.closeAll(true); if(r) DECK.open('toolPricing', r.key); });
  await wait(900); await shot('07-tool-pricing');
  await p.evaluate(() => { const e = entries.find(x=>x.tag!=='request'&&x.kind!=='registry'); DECK.closeAll(true); if(e) DECK.open('submissionDoc', e.id); });
  await wait(1200); await shot('08-submission-doc');
  await p.evaluate(() => { DECK.closeAll(true); const g=_toolGroups(filteredEntries())[0]; if(g){DECK.open('tool',g.key); DECK.open('toolNumbers',g.key);} });
  await wait(900); await shot('09-two-tiles');
  console.log('   panels open after opening two:', await p.evaluate(()=>document.querySelectorAll('.deck-panel:not(.min)').length));
  // settings red dot
  console.log('   settings badge:', await p.evaluate(() => {
    const b2=[...document.querySelectorAll('#adminNav *, .rail-foot *, [data-sec="acc_settings"], .sidebar *')].filter(e=>/dot|badge|pip/i.test(e.className||''));
    return b2.slice(0,4).map(e=>({cls:e.className, txt:(e.textContent||'').trim().slice(0,10), vis:!!(e.offsetWidth||e.offsetHeight)}));
  }));
  await p.setViewport({width:390,height:844});
  await p.evaluate(()=>{ DECK.closeAll(true); togglePreviewAsDept(true); switchView('tools'); });
  await wait(900); await shot('10-mobile-dept');
  await p.evaluate(()=>{ openAddChooser(); }); await wait(600);
  await p.evaluate(()=>{ chooseAddType('report'); }); await wait(1000);
  await shot('11-mobile-wizard');
  await p.evaluate(()=>{ closeWizard(); togglePreviewAsDept(false); switchView('admin'); renderAdmin(); }); await wait(900);
  await shot('12-mobile-admin');
  await p.evaluate(()=>{ DECK.closeAll(true); const g=_toolGroups(filteredEntries())[0]; if(g) DECK.open('tool',g.key); }); await wait(900);
  await shot('13-mobile-tile');
  await b.close(); process.exit(0);
})();
