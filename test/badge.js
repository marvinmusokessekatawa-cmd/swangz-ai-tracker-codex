const { boot } = require('./boot');
(async () => {
  const { run } = await boot();
  run(`devBypassSignIn(); adminUnlocked=true; seedDemoData(true); switchView('admin'); renderAdmin();`);
  const badges = () => JSON.parse(run(`JSON.stringify([...document.querySelectorAll('.rail-group')].map(b=>({g:b.dataset.group,badge:(b.querySelector('.nav-badge')||{}).textContent||''})))`));
  console.log('start                       :', JSON.stringify(badges()));

  // decide the open request — the Requests badge must clear
  const rid = run(`(entries.find(e=>e.tag==='request')||{}).id`);
  run(`setRequestStatus(${JSON.stringify(rid)},'approved'); renderAdmin();`);
  console.log('after deciding the request  :', JSON.stringify(badges()));

  // queue mail with no endpoint — Settings must light up, then clear when sent
  console.log('settingsPending (no endpoint):', run('settingsPending()'));
  run(`localStorage.setItem('swangz_outbox_v1', JSON.stringify([{status:'queued'},{status:'queued'}])); renderAdmin();`);
  console.log('with 2 queued messages      :', JSON.stringify(badges()), '| pending =', run('settingsPending()'));
  run(`localStorage.setItem('swangz_outbox_v1', JSON.stringify([{status:'sent'},{status:'sent'}]));
       const ns = notifySettings(); ns.endpoint='https://script.google.com/x'; saveNotifySettings(ns); renderAdmin();`);
  console.log('after sending + endpoint set:', JSON.stringify(badges()), '| pending =', run('settingsPending()'));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
