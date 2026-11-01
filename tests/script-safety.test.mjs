import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

test('generated create-user script is local-preview-first', () => {
  const guard = source.indexOf('if (-not $Execute)');
  const connect = source.indexOf('Connect-MgGraph -Scopes "User.Create"');
  assert.ok(source.includes('[switch] $Execute'));
  assert.ok(guard >= 0);
  assert.ok(connect > guard, 'Graph connection must occur after the explicit execution guard');
  assert.match(source, /No Graph connection was opened and no tenant changes were made/);
});

test('generated create-user script retains ShouldProcess and guarded cleanup', () => {
  assert.ok(source.includes('[CmdletBinding(SupportsShouldProcess)]'));
  assert.ok(source.includes('$PSCmdlet.ShouldProcess'));
  assert.ok(source.includes('$connected = $false'));
  assert.ok(source.includes('if ($connected)'));
});

test('builder presents the immutable execution guard and least privilege scope', () => {
  assert.match(source, /Require explicit -Execute/);
  assert.match(source, /checked readOnly/);
  assert.ok(!source.includes('Connect-MgGraph -Scopes "User.ReadWrite.All"'));
});

test('unfinished quick templates cannot generate the create-user script', () => {
  assert.match(source, /disabled={!s\.available}/);
  assert.match(source, /Planned — no script is generated/);
  assert.match(source, /◉ Local only/);
});

test('builder choices and local CSV preflight preserve runtime file selection', () => {
  assert.match(source, /buildCreateUserScript\(usageLocation, forcePasswordChange\)/);
  assert.match(source, /new Set\(\["US", "CA", "GB"\]\)/);
  assert.ok(source.includes('`[string] $UsageLocation = "${safeUsageLocation}"`'));
  assert.ok(source.includes('`ForceChangePasswordNextSignIn = $${forcePasswordChange ? "true" : "false"}`'));
  assert.match(source, /value=\{usageLocation\} onChange=/);
  assert.match(source, /checked=\{forcePasswordChange\} onChange=/);
  assert.match(source, /type="file" accept="\.csv,text\/csv"/);
  assert.match(source, /planUserCreation\(await file\.text\(\)\)/);
  assert.match(source, /temporary passwords are never uploaded or embedded/);
  assert.match(source, /does not check the tenant, domains, existing accounts/);
  assert.match(source, /Showing the first 100 rows/);
  assert.ok(!source.includes('C:\\Users\\Jake\\users.csv'));
  assert.ok(!source.includes('fetch('));
  assert.match(source, /value="Stop and report errors" disabled/);
  assert.ok(!source.includes('Continue and log errors'));
});
