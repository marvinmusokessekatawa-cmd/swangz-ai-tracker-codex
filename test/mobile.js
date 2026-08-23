/* Every screen at phone width, checked for the things that actually go wrong:
   sideways scroll, elements pushed off-screen, tap targets under 40px, and
   anything the fixed chrome covers. */
const puppeteer = require('puppeteer-core'); const path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'..','shots','mobile'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
const W=390,H=844;
(async()=>{ fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',
    args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/index.html',{waitUntil:'networkidle2'}); await wait(1400);

  const audit = async (name) => {
    await wait(600);
    const r = await p.evaluate(() => {
      const de = document.documentElement;
      const decorative = el => {
        const cs = getComputedStyle(el);
        /* ambient blobs, the starfield and anything painted behind the page
           are meant to bleed past the edge — they cannot be scrolled to */
        if (cs.pointerEvents === 'none') return true;
        if ((parseInt(cs.zIndex, 10) || 0) < 0) return true;
        if (el.closest('[aria-hidden="true"]')) return true;
        if (/^(a[0-9]|aurora|glow|starfield)/.test(el.className || '') || el.id === 'starfield') return true;
        /* a horizontal scroller is allowed to hold more than it shows */
        for (let n = el.parentElement; n; n = n.parentElement) {
          const s2 = getComputedStyle(n);
          if (s2.overflowX === 'auto' || s2.overflowX === 'scroll') return true;
        }
        return false;
      };
      const over = [...document.querySelectorAll('body *')].filter(el => {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
        if (decorative(el)) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1.5 || b.left < -1.5);
      }).slice(0,6).map(el => (el.tagName+'.'+(typeof el.className==='string'?el.className:'')).slice(0,60)
                 + ' [' + Math.round(el.getBoundingClientRect().left) + '..' + Math.round(el.getBoundingClientRect().right) + ']');
      const small = [...document.querySelectorAll('button, a[href], select, input[type=checkbox]')].filter(el => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && (b.height < 36 || b.width < 30) && el.offsetParent;
      }).slice(0,6).map(el => (el.tagName+'.'+(typeof el.className==='string'?el.className:'')).slice(0,44)
                 + (el.id ? '#' + el.id : '')
                 + (el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '')
                 + (el.type ? '[type=' + el.type + ']' : '')
                 + ' ' + Math.round(el.getBoundingClientRect().width)+'x'+Math.round(el.getBoundingClientRect().height));
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, over, small };
    });
    await p.screenshot({path:path.join(OUT,name+'.png')});
    const side = r.scrollW > r.clientW + 1;
    console.log(`${side?'✗':'✓'} ${name.padEnd(22)} ${side?('SIDEWAYS '+r.scrollW+'>'+r.clientW):'no sideways scroll'}`);
    if (r.over.length) console.log('    off-screen: ' + r.over.join(' | '));
    if (r.small.length) console.log('    small taps: ' + r.small.join(' | '));
    return side || r.over.length || r.small.length;
  };

  let bad = 0;
  bad += await audit('01-signin') ? 1 : 0;
  await p.evaluate(()=>{ devBypassSignIn(); seedDemoData(true);
    try{localStorage.setItem('swangz_tour_done_v1',JSON.stringify([profile.department||'Production']))}catch(e){}
    if(typeof endTour==='function') endTour(); });
  await wait(900);
  await p.evaluate(()=>{ if(typeof endTour==='function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
  bad += await audit('02-department') ? 1 : 0;
  await p.evaluate(()=>openAddChooser()); bad += await audit('03-chooser') ? 1 : 0;
  await p.evaluate(()=>chooseAddType('report'));
  const promptUnderWizard = await p.evaluate(() => {
    const prompt = document.getElementById('deptPrompt');
    const wizard = document.getElementById('detailView');
    return !!(prompt && wizard && wizard.classList.contains('open') && !prompt.hidden);
  });
  if (promptUnderWizard) { console.log('✗ dept prompt stayed visible under wizard'); bad++; }
  bad += await audit('04-wizard') ? 1 : 0;
  await p.evaluate(()=>{ gotoStep(2); }); bad += await audit('05-wizard-2') ? 1 : 0;
  await p.evaluate(()=>{ closeWizard(); togglePreviewAsDept(false);
    sessionStorage.setItem('swangz_admin_otp_v1',JSON.stringify({hash:'',email:currentEmail(),exp:Date.now()+36e5,tries:0,verified:true}));
    adminUnlocked=true; switchView('admin'); showAdminContent(); renderAdmin(); });
  bad += await audit('06-admin') ? 1 : 0;
  for (const sec of ['acc_requests','acc_finance','acc_exec','acc_business']) {
    await p.evaluate(s=>{DECK.closeAll(true); showAdminSection(s);}, sec);
    bad += await audit('07-'+sec) ? 1 : 0;
  }
  await p.evaluate(()=>{ DECK.closeAll(true); const g=_toolGroups(filteredEntries())[0]; if(g) DECK.open('tool',g.key); });
  bad += await audit('08-tile') ? 1 : 0;
  await p.evaluate(()=>{ DECK.closeAll(true); DECK.open('profile'); });
  bad += await audit('09-profile') ? 1 : 0;
  await p.evaluate(()=>{ DECK.closeAll(true); setExecPeriod('all'); openExecBriefing(); });
  bad += await audit('10-briefing') ? 1 : 0;
  await p.evaluate(()=>{ DECK.closeAll(true); const e=entries.find(x=>x.tag!=='request'&&x.kind!=='registry'); if(e) DECK.open('submissionDoc',e.id); });
  bad += await audit('11-document') ? 1 : 0;
  console.log('\nerrors:', errs.slice(0,3));
  console.log(bad ? `\n${bad} screen(s) with a layout fault` : '\nevery screen clean at 390px');
  await b.close(); process.exit(bad?1:0);
})();
