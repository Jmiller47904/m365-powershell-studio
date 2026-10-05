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
