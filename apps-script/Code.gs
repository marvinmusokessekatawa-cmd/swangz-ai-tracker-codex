/**
 * Swangz Avenue — AI Adoption Tracker
 * Google Apps Script backend
 *
 * Three sheets are kept in sync inside the bound Spreadsheet:
 *   • entries  — raw JSON payloads (machine-readable; the tracker app reads/writes here)
 *   • Report   — flat human-readable feed for management/exec
 *   • Summary  — KPI roll-up for executive scanning
 *
 * Endpoints:
 *   GET  ?action=list                            → { ok:true, entries:[...] }
 *   GET  ?action=ping                            → { ok:true, pong:true }
 *   POST { action:'replaceAll', entries:[...] }  → wipes & rewrites all three tabs
 *   POST { action:'upsert', entry:{...} }        → writes one row
 *   POST { action:'notify', to, cc, bcc, subject, body,
 *          fromName, attachmentName, attachmentHtml }
 *                                                → sends one email, Bcc stays hidden
 *
 * ⚠️ A POST with no action is REFUSED. It used to default to 'replaceAll',
 * which meant a notification payload (no entries) read as "replace everything
 * with nothing" — pointing the tracker's mail endpoint at this URL would have
 * emptied the spreadsheet.
 *
 * Deploy: Extensions → Apps Script → Deploy → New deployment → Web app,
 * "Execute as: Me", "Who has access: Anyone". Mail is sent from the Google
 * account that owns this script, so that account needs to be one the company
 * is happy to have as the sender. MailApp is capped per day
 * (100 on a consumer account, 1500 on Workspace) — _notify reports what is
 * left on every send so the outbox can show it.
 */

const SHEET_ID      = '1hvxKoDfmHYxHFifwQLsymuA-LUWBTA5vVCxMpdBgKMI';
const SHEET_NAME    = 'entries';
const REPORT_NAME   = 'Report';
const SUMMARY_NAME  = 'Summary';
const SHARED_SECRET = ''; // leave '' unless the client also sends one

const UNIT_HOURS = { sec: 1/3600, min: 1/60, h: 1, d: 24, wk: 168, mo: 720, yr: 8760 };
function _toHours(v, u) { return (Number(v) || 0) * (UNIT_HOURS[u || 'h'] || 1); }
function _summary(e) {
  const freq      = Number(e.frequency) || 0;
  const tradH     = _toHours(e.tradTime, e.tradTimeUnit);
  const aiH       = _toHours(e.aiTime,   e.aiTimeUnit);
  const tradMo    = (Number(e.tradCost) || 0) * freq;
  const aiMo      = (Number(e.toolMonthlyCost) || 0) + (Number(e.extraCredits) || 0);
  return {
    tradH, aiH, freq,
    timeSavedMo: (tradH - aiH) * freq,
    tradMo, aiMo,
    netMo: tradMo - aiMo,
    revenue: Number(e.revenueAmount) || 0,
  };
}

function _ss() { return SpreadsheetApp.openById(SHEET_ID); }

function _sheet() {
  const ss = _ss();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id', 'payload_json', 'updated_at']);
  }
  return sh;
}

function _getOrCreate(name) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function _ok(obj)  { return ContentService.createTextOutput(JSON.stringify(Object.assign({ ok: true  }, obj))).setMimeType(ContentService.MimeType.JSON); }
function _err(msg) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg })).setMimeType(ContentService.MimeType.JSON); }

function _checkSecret(provided) {
  if (!SHARED_SECRET) return true;
  return provided === SHARED_SECRET;
}

function _writeReport(entries) {
  const sh = _getOrCreate(REPORT_NAME);
  sh.clear();
  const headers = [
    'Department', 'Submitted By', 'Tool', 'Category', 'Status',
    'Why It Matters', 'Impact on Work',
    'Trad Time / Deliverable', 'AI Time / Deliverable',
    'Frequency / Month', 'Monthly Time Saved (hours)',
    'Traditional Cost / Month (USD)', 'AI Cost / Month (USD)',
    'Net Monthly Savings (USD)',
    'Revenue Impact', 'Revenue Amount (USD)',
    'Updated At',
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1f1f2e').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (!entries || !entries.length) return;
  const rows = entries.map(e => {
    const m = _summary(e);
    const tradTimeStr = (e.tradTime != null ? e.tradTime : '') + ' ' + (e.tradTimeUnit || 'h');
    const aiTimeStr   = (e.aiTime != null ? e.aiTime : '')   + ' ' + (e.aiTimeUnit   || 'h');
    return [
      e.department || '',
      e.submittedBy || '',
      e.toolName || '',
      e.category || '',
      e.status || '',
      e.reason || '',
      e.impact || '',
      tradTimeStr,
      aiTimeStr,
      m.freq,
      Math.round(m.timeSavedMo * 100) / 100,
      Math.round(m.tradMo),
      Math.round(m.aiMo),
      Math.round(m.netMo),
      e.revenueDesc || '',
      m.revenue,
      e.updatedAt || e.submittedAt || '',
    ];
  });
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  // Currency formatting on USD columns (12, 13, 14, 16)
  sh.getRange(2, 12, rows.length, 3).setNumberFormat('"$"#,##0');
  sh.getRange(2, 16, rows.length, 1).setNumberFormat('"$"#,##0');
  sh.autoResizeColumns(1, headers.length);
}

function _writeSummary(entries) {
  const sh = _getOrCreate(SUMMARY_NAME);
  sh.clear();
  const list = entries || [];
  let totalTime = 0, totalNet = 0, totalRevenue = 0, totalTrad = 0, totalAi = 0;
  const byDept = {};
  const byCategory = {};
  const byStatus = {};
  list.forEach(e => {
    const m = _summary(e);
    totalTime    += m.timeSavedMo;
    totalNet     += m.netMo;
    totalRevenue += m.revenue;
    totalTrad    += m.tradMo;
    totalAi      += m.aiMo;
    if (e.department) byDept[e.department]   = (byDept[e.department]   || 0) + m.netMo;
    if (e.category)   byCategory[e.category] = (byCategory[e.category] || 0) + m.netMo;
    if (e.status)     byStatus[e.status]     = (byStatus[e.status]     || 0) + 1;
  });
  const tools  = list.length;
  const depts  = Object.keys(byDept).length;
  const roiX   = totalAi > 0 ? totalTrad / totalAi : 0;
  const tsRows = [
    ['Swangz Avenue - AI Adoption Tracker - Executive Summary', ''],
    ['Last refreshed', new Date()],
    ['', ''],
    ['Headline KPIs', ''],
    ['Tools tracked',                  tools],
    ['Departments contributing',       depts],
    ['Monthly time saved (hours)',     Math.round(totalTime * 100) / 100],
    ['Monthly net cost saved (USD)',   Math.round(totalNet)],
    ['Monthly revenue enabled (USD)',  Math.round(totalRevenue)],
    ['Traditional cost / month (USD)', Math.round(totalTrad)],
    ['AI cost / month (USD)',          Math.round(totalAi)],
    ['ROI multiplier (Traditional / AI)', Math.round(roiX * 100) / 100],
    ['', ''],
    ['Net Monthly Savings - By Department', ''],
  ];
  Object.entries(byDept).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => tsRows.push([k, Math.round(v)]));
  tsRows.push(['', '']);
  tsRows.push(['Net Monthly Savings - By Category', '']);
  Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => tsRows.push([k, Math.round(v)]));
  tsRows.push(['', '']);
  tsRows.push(['Adoption Stage Breakdown', '']);
  Object.entries(byStatus).forEach(([k,v]) => tsRows.push([k, v]));

  sh.getRange(1, 1, tsRows.length, 2).setValues(tsRows);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setFontSize(14).setBackground('#1f1f2e').setFontColor('#ffffff');
  sh.getRange(2, 1, 1, 1).setFontStyle('italic').setFontColor('#666666');
  // bold the section headers
  [4, 14, 14 + Object.keys(byDept).length + 2, 14 + Object.keys(byDept).length + 2 + Object.keys(byCategory).length + 2].forEach(rIdx => {
    if (rIdx > 0 && rIdx <= tsRows.length) sh.getRange(rIdx, 1).setFontWeight('bold');
  });
  sh.getRange(5, 2, 8, 1).setNumberFormat('#,##0');
  sh.setColumnWidth(1, 320);
  sh.setColumnWidth(2, 200);
}

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || 'list';
    if (!_checkSecret(e.parameter && e.parameter.secret)) return _err('forbidden');
    if (action === 'list') {
      const sh = _sheet();
      const last = sh.getLastRow();
      if (last < 2) return _ok({ entries: [] });
      const rows = sh.getRange(2, 1, last - 1, 3).getValues();
      const entries = [];
      rows.forEach(r => {
        const json = r[1];
        if (!json) return;
        try { entries.push(JSON.parse(json)); } catch (_) {}
      });
      return _ok({ entries: entries, count: entries.length });
    }
    if (action === 'ping') return _ok({ pong: true });
    return _err('unknown action: ' + action);
  } catch (err) {
    return _err(err.message || String(err));
  }
}

/**
 * Send one notification. The tracker posts these when something is filed and
 * when a decision is made; the person who filed it is on To or Cc, and anyone
 * the admin has chosen to copy quietly is on Bcc and stays there.
 *
 * The submission document travels as an HTML attachment so the message itself
 * stays short enough to read on a phone.
 */
function _notify(body) {
  var to  = _addrs(body.to);
  var cc  = _addrs(body.cc);
  var bcc = _addrs(body.bcc);
  if (!to.length && !cc.length && !bcc.length) return _err('notify needs at least one recipient');

  var opts = {
    name: String(body.fromName || 'Swangz Avenue AI Tracker'),
    htmlBody: _mailHtml(body),
  };
  if (cc.length)  opts.cc  = cc.join(',');
  if (bcc.length) opts.bcc = bcc.join(',');
  if (body.attachmentHtml) {
    opts.attachments = [Utilities.newBlob(String(body.attachmentHtml), 'text/html',
      String(body.attachmentName || 'submission.html'))];
  }
  /* An empty To with only Bcc recipients is legal but looks like spam to most
     filters, so the sender addresses it to themselves in that case. */
  var toLine = to.length ? to.join(',') : Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(toLine, String(body.subject || '(no subject)'), _plain(body), opts);
  return _ok({ sent: 1, to: to.length, cc: cc.length, bcc: bcc.length, quotaLeft: MailApp.getRemainingDailyQuota() });
}

function _addrs(v) {
  var list = Array.isArray(v) ? v : String(v || '').split(',');
  var seen = {}, out = [];
  list.forEach(function (a) {
    var s = String(a || '').trim().toLowerCase();
    if (!s || s.indexOf('@') < 1 || seen[s]) return;
    seen[s] = true; out.push(s);
  });
  return out;
}
function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function _plain(body) {
  return String(body.body || '') + (body.attachmentHtml ? '\n\n(The full document is attached.)' : '');
}
function _mailHtml(body) {
  return '' +
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:15px;line-height:1.55;color:#111;max-width:560px;">' +
      '<p style="margin:0 0 6px;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#8a8a99;">' +
        'Swangz Avenue &middot; AI Tracker</p>' +
      '<p style="margin:0 0 18px;font-size:19px;font-weight:700;">' + _esc(body.subject || '') + '</p>' +
      '<p style="margin:0 0 18px;">' + _esc(body.body || '') + '</p>' +
      (body.attachmentHtml
        ? '<p style="margin:0;color:#555;font-size:13px;">The full submission is attached as a document.</p>'
        : '') +
    '</div>';
}

function doPost(e) {
  try {
    let body = {};
    try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (_) { body = {}; }
    if (!_checkSecret(body.secret)) return _err('forbidden');
    /* No default. This used to fall back to 'replaceAll', so a POST that named
       no action — a mail notification, say, whose payload carries no entries —
       was read as "replace everything with nothing" and cleared the sheet.
       Pointing the tracker's mail endpoint at this URL would have wiped it. */
    const action = body.action || body.kind || '';
    if (!action) return _err('no action given — refusing to guess');
    if (action === 'notify') return _notify(body);
    if (action === 'replaceAll') {
      const incoming = Array.isArray(body.entries) ? body.entries : [];
      const sh = _sheet();
      const last = sh.getLastRow();
      if (last >= 2) sh.getRange(2, 1, last - 1, 3).clearContent();
      if (incoming.length) {
        const now = new Date().toISOString();
        const values = incoming.map(en => [
          String(en.id || ''),
          JSON.stringify(en),
          String(en.updatedAt || en.submittedAt || now),
        ]);
        sh.getRange(2, 1, values.length, 3).setValues(values);
      }
      // Also rebuild the human-readable tabs
      try { _writeReport(incoming); }  catch (er) { /* never block raw write */ }
      try { _writeSummary(incoming); } catch (er) { /* never block raw write */ }
      return _ok({ written: incoming.length });
    }
    if (action === 'upsert') {
      const en = body.entry || null;
      if (!en || !en.id) return _err('upsert requires entry.id');
      const sh = _sheet();
      const last = sh.getLastRow();
      if (last >= 2) {
        const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => r[0]);
        const idx = ids.indexOf(en.id);
        if (idx >= 0) {
          sh.getRange(idx + 2, 2, 1, 2).setValues([[ JSON.stringify(en), String(en.updatedAt || new Date().toISOString()) ]]);
          return _ok({ updated: en.id });
        }
      }
      sh.appendRow([ String(en.id), JSON.stringify(en), String(en.updatedAt || new Date().toISOString()) ]);
      return _ok({ inserted: en.id });
    }
    return _err('unknown action: ' + action);
  } catch (err) {
    return _err(err.message || String(err));
  }
}

/* Optional: run this once from the editor to backfill the Report and Summary
   tabs without going through a client push. Useful right after first install. */
function rebuildReports() {
  const sh = _sheet();
  const last = sh.getLastRow();
  const entries = [];
  if (last >= 2) {
    const rows = sh.getRange(2, 1, last - 1, 3).getValues();
    rows.forEach(r => { try { if (r[1]) entries.push(JSON.parse(r[1])); } catch (_) {} });
  }
  _writeReport(entries);
  _writeSummary(entries);
  return entries.length;
}

/**
 * RUN THIS ONCE, FROM THE EDITOR, BEFORE THE TRACKER CAN SEND ANYTHING.
 *
 * Apps Script works out which permissions a project needs from the code, and
 * asks for them the first time a human runs something. Deploying does not ask.
 * So a project deployed before MailApp appeared in it is live, answers
 * correctly, and still cannot send — the web app returns
 *
 *     "You do not have permission to call MailApp.sendEmail"
 *
 * Pick this function in the toolbar dropdown, press Run, and grant the
 * permission Google asks for. It then sends you a message from this account,
 * which is the same account every tracker notification will come from — so a
 * message arriving is proof of the whole path, not just of the permission.
 *
 * Safe to run again at any time. It touches nothing but your own inbox.
 */
function authoriseAndTest() {
  var me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(me, '[Swangz AI Tracker] Permission granted', 
    'This account can now send mail for the tracker.\n\n' +
    'Every notification staff receive will come from this address.\n' +
    'Messages left in today\'s quota: ' + MailApp.getRemainingDailyQuota(),
    { name: 'Swangz Avenue AI Tracker' });
  Logger.log('Sent to ' + me + '. Quota left: ' + MailApp.getRemainingDailyQuota());
  return me;
}
