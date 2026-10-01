import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, planUserCreation } from '../lib/csv-preflight.mjs';
const header = 'DisplayName,UserPrincipalName,MailNickname,TemporaryPassword';
test('BOM, CRLF, commas, escaped quotes and multiline fields preserve record lines', () => {
  const rows = parseCsv('\uFEFFa,b\r\n"One, two","said ""hi"""\r\n"Multi\nline",ok\r\n');
  assert.deepEqual(rows.map(r => r.line),[1,2,3]);
  assert.deepEqual(rows[1].values,['One, two','said "hi"']);
  assert.equal(rows[2].values[0],'Multi\nline');
});
test('reports valid local input without password or unknown column disclosure', () => {
  const p = planUserCreation(header+',PrivateNote\nDemo,demo@example.com,demo,SECRET-123,SENSITIVE\n');
  assert.equal(p.canProceedToReview,true);
  assert.deepEqual(p.summary,{total:1, readyForReview:1, blocked:0});
  assert.ok(!JSON.stringify(p).includes('SECRET-123'));
  assert.ok(!JSON.stringify(p).includes('SENSITIVE'));
});
test('blocks both case-insensitive duplicates and does not silently deduplicate', () => {
  const p = planUserCreation(header+'\nA,demo@example.com,a,p\nB,DEMO@example.com,b,p');
  assert.equal(p.summary.blocked,2);
  assert.equal(p.canProceedToReview,false);
  assert.match(p.rows[1].issues.join(),/line 2/);
});
test('missing fields, invalid identifiers and uneven rows produce actionable checks', () => {
  const p = planUserCreation(header+'\n,not-an-upn,bad alias,\nDemo,demo@example.com');
  assert.equal(p.summary.blocked,2);
  assert.match(p.rows[0].issues.join(),/Missing displayname/);
  assert.match(p.rows[1].issues.join(),/Column count/);
});
test('rejects ambiguous CSV and headers, rather than guessing', () => {
  for (const text of ['a\n"unterminated','a\n"value"garbage','a\nab"cd']) assert.throws(() => parseCsv(text));
  assert.throws(() => planUserCreation(header+',DISPLAYNAME\n'));
  assert.throws(() => planUserCreation('DisplayName,UserPrincipalName\n'));
  assert.throws(() => parseCsv('x'.repeat(1_000_001)));
  assert.equal(planUserCreation(header).canProceedToReview,false);
});
test('CLI exit codes distinguish reviewable, blocked and malformed input', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'csv-preflight-'));
  const file = path.join(dir,'users.csv');
  const cli = fileURLToPath(new URL('../scripts/csv-preflight.mjs',import.meta.url));
  try {
    for (const [text, status] of [[header+'\nDemo,demo@example.com,demo,SECRET',0],[header+'\nDemo,invalid,demo,SECRET',2],['a\n"SECRET',1]]) {
      fs.writeFileSync(file,text);
      const result = spawnSync(process.execPath,[cli,file],{encoding:'utf8'});
      assert.equal(result.status,status);
      assert.ok(!(result.stdout+result.stderr).includes('SECRET'));
    }
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
