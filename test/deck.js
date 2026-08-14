const { boot } = require('./boot');
(async () => {
  const { run, doc } = await boot();
  run(`window.__t={open:(k,a)=>{try{DECK.open(k,a)}catch(e){return 'threw '+e.message}return ''},
       n:()=>document.querySelectorAll('.deck-panel').length,
       vis:()=>[...document.querySelectorAll('.deck-panel')].filter(p=>!p.classList.contains('min')).length};
       devBypassSignIn(); adminUnlocked=true; seedDemoData(true); switchView('admin'); renderAdmin();`);
  const gk = run(`_toolGroups(filteredEntries())[0].key`);
  run(`DECK.closeAll(true); DECK.open('tool', ${JSON.stringify(gk)});`);
  console.log('after opening the tool tile      :', run('__t.vis()'), 'visible');
  run(`DECK.openFrom('tool|' + JSON.stringify(${JSON.stringify(gk)}), 'toolNumbers', ${JSON.stringify(gk)});`);
  console.log('after opening its numbers beside :', run('__t.vis()'), 'visible  <- parent must still be here');
  run(`DECK.openFrom('tool|' + JSON.stringify(${JSON.stringify(gk)}), 'toolDepts', ${JSON.stringify(gk)});`);
  console.log('after a third from the same tile :', run('__t.vis()'), 'visible');
  // leaving the section must fold them away
  run(`showAdminSection('acc_money');`);
  await new Promise(r => setTimeout(r, 120));
  console.log('after switching admin section    :', run('__t.vis()'), 'visible  <- should be 0');
  run(`showAdminSection('acc_business');`);
  await new Promise(r => setTimeout(r, 900));
  console.log('after coming back                :', run('__t.vis()'), 'visible  <- restored');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
