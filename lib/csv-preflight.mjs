/** Local-only preflight for the existing New-EntraUsers.ps1 CSV contract. */
export function parseCsv(text) {
  if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('CSV must be text no larger than 1 MB.');
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let values = [], field = '', quoted = false, closed = false, line = 1, startLine = 1;
  const cell = () => { values.push(field); field = ''; closed = false; };
  const row = () => { cell(); if (values.some(v => v.trim())) rows.push({line: startLine, values}); values = []; startLine = line + 1; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else { field += c; if (c === '\n') line++; }
      continue;
    }
    if (c === ',') { cell(); continue; }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row(); line++; continue;
    }
    if (closed) throw new Error(`Unexpected character after quoted field at line ${line}.`);
    if (c === '"') {
      if (field) throw new Error(`Unexpected quote at line ${line}.`);
      quoted = true;
    } else field += c;
  }
  if (quoted) throw new Error('CSV ends inside a quoted field.');
  if (field || values.length || closed) row();
  return rows;
}
const required = ['displayname', 'userprincipalname', 'mailnickname', 'temporarypassword'];
export function planUserCreation(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV is empty.');
  const headers = rows.shift().values.map(h => h.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');
  if (headers.some(h => !h)) throw new Error('CSV contains an empty column name.');
  if (required.some(h => !headers.includes(h))) throw new Error('Required columns: DisplayName, UserPrincipalName, MailNickname, TemporaryPassword.');
  const plans = [];
  const seen = new Map();
  for (const row of rows) {
    const issues = [];
    const get = name => row.values[headers.indexOf(name)] ?? '';
    if (row.values.length !== headers.length) issues.push('Column count differs from header.');
    for (const name of required) if (!get(name).trim()) issues.push(`Missing ${name}.`);
    const upn = get('userprincipalname');
    if (upn.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(upn) || /[\x00-\x1f\x7f]/.test(upn))) issues.push('UPN must have alias@domain form without whitespace.');
    if (/\s|@|[\x00-\x1f\x7f]/.test(get('mailnickname'))) issues.push('MailNickname contains whitespace, a control character or @.');
    const plan = {line: row.line, action: 'Create user', userPrincipalName: upn, displayName: get('displayname'), issues};
    const key = upn.trim().toLowerCase();
    if (key) {
      if (seen.has(key)) {
        const previous = seen.get(key);
        plan.issues.push(`Duplicate UPN; first appears at line ${previous.line}.`);
        if (!previous.issues.includes('Duplicate UPN in this CSV.')) previous.issues.push('Duplicate UPN in this CSV.');
      } else seen.set(key, plan);
    }
    plans.push(plan);
  }
  const blocked = plans.filter(p => p.issues.length).length;
  return {
    mode: 'Local CSV preflight only',
    summary: {total: plans.length, readyForReview: plans.length - blocked, blocked},
    canProceedToReview: plans.length > 0 && blocked === 0,
    permissions: {
      apiVersion: 'v1.0', delegated: ['User.Create'], application: ['User.Create'],
      existingScriptScope: 'User.ReadWrite.All (broader; review before execution)',
      source: 'https://learn.microsoft.com/en-us/graph/api/user-post-users?view=graph-rest-1.0',
      verifiedOn: '2026-10-01'
    },
    limitations: [
      'No tenant connection or user creation. Domain verification, existing accounts, full property rules, password policies and permissions are not checked.',
      'TemporaryPassword values and unrecognized columns are excluded from this report. Treat the source CSV as sensitive.',
      'Review/export the script separately and use -WhatIf before any intentional run. WhatIf is not tenant-side validation.',
      'There is no automatic rollback. Deleting created accounts can have downstream consequences.'
    ],
    rows: plans
  };
}
