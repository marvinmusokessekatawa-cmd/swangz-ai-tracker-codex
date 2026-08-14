/* Drives a fixed script of actions and records what the app rendered, so the
   same run before and after a refactor can be compared byte for byte.
   Run:  node snapshot.js before.json   then   node snapshot.js after.json */
const { boot } = require('./boot');
const fs = require('fs');

/* Anything that legitimately differs between two runs is neutralised, so a
   diff means a real behavioural change and nothing else. */
function normalise(html) {
  return String(html || '')
    .replace(/\d{1,2}\/\d{1,2}\/\d{4}(,\s*\d{1,2}:\d{2}:\d{2}\s*[AP]M)?/g, '<DATE>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<ISO>')
    .replace(/\b\d{1,2}:\d{2}:\d{2}\s*[AP]M\b/g, '<TIME>')
    .replace(/demo-\d+-[a-z0-9]+/g, '<DEMOID>')
    .replace(/\bp_[a-z0-9]{5,}/g, '<PID>')
    .replace(/\b(id|for)="[^"]*_(\d|[a-z0-9]{6,})[^"]*"/g, '$1="<GENID>"')
    .replace(/raised \d+ days? ago/g, 'raised <N> days ago')
    .replace(/\s+/g, ' ')
    .trim();
}

const REGIONS = ['quickStats', 'myHistoryCard', 'deptOverview', 'deptExtra', 'deptInsight',
  'toolsList', 'toolsTableBody', 'requestsInbox', 'registryManagerList', 'aiFindings',
  'adminNav', 'statusChart', 'execLaunchNote', 'detailView', 'wizardProgress', 'projectsList'];

(async () => {
  const out = {};
  const { run, doc, errors } = await boot();

  const grab = (label) => {
    const snap = {};
    REGIONS.forEach(id => {
      const el = doc.getElementById(id);
      snap[id] = el ? normalise(el.innerHTML) : '(absent)';
    });
    snap['__toolsView'] = normalise((doc.getElementById('toolsView') || {}).innerHTML);
    out[label] = snap;
  };

  /* 1 — department experience */
  run('devBypassSignIn(); seedDemoData(true);');
  run('try { localStorage.setItem("swangz_tour_done_v1", JSON.stringify(["Production"])); } catch(e){}');
  run('sessionStorage.setItem("swangz_preview_as_dept","1"); switchView("tools");');
  run('renderQuickStats && renderQuickStats(); renderMyHistoryCard && renderMyHistoryCard(); renderDeptOverview && renderDeptOverview(); renderDeptExtra && renderDeptExtra(); renderToolsList && renderToolsList();');
  grab('department');

  /* 2 — the wizard, stepped through and back */
  run('openWizard && openWizard("report");');
  run('typeof renderWizardProgress === "function" && renderWizardProgress();');
  grab('wizard-step1');
  run('typeof gotoStep === "function" && gotoStep(2); typeof updateWizardFooter === "function" && updateWizardFooter();');
  grab('wizard-step2');
  run('typeof addProject === "function" && addProject(); typeof renderProjects === "function" && renderProjects();');
  grab('wizard-projects');
  run('if (typeof projectsInForm !== "undefined" && projectsInForm.length && typeof removeProject === "function") removeProject(projectsInForm[0].id);');
  grab('wizard-projects-removed');
  run('typeof prevStep === "function" && prevStep(); typeof closeWizard === "function" && closeWizard();');

  /* 3 — admin, every section rendered */
  run('sessionStorage.setItem("swangz_preview_as_dept","0"); adminUnlocked = true; switchView("admin"); renderAdmin();');
  run('typeof renderRequestsInbox === "function" && renderRequestsInbox(); typeof renderManageSubmissions === "function" && renderManageSubmissions(); typeof renderRegistryManager === "function" && renderRegistryManager(); typeof renderAiFindings === "function" && renderAiFindings();');
  grab('admin');

  /* 4 — every deck tile, as content rather than as a pass/fail */
  const KINDS = run(`(function(){ return null })()`); // placeholder, tiles covered by suite.js
  out.__errors = errors.slice(0, 10);
  out.__docBody = normalise(run('setExecPeriod("all"); execDocBody()'));
  out.__docBodyMonth = normalise(run('setExecPeriod("this-month"); execDocBody()'));
  out.__workbook = normalise(run('JSON.stringify(execWorkbookModel())'));
  out.__routeAfterSignIn = String(run('typeof routeAfterSignIn'));

  fs.writeFileSync(process.argv[2] || 'snap.json', JSON.stringify(out, null, 1));
  console.log('wrote', process.argv[2], '—', Object.keys(out).length, 'sections, errors:', errors.length);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
