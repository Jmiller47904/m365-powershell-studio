import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { reviewPowerShellScript } from "../lib/script-review.mjs";

const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const initialScript = source.match(/const initialScript = `([\s\S]*?)`;/)?.[1] ?? "";

test("review accepts the generated WhatIf-first create-user script", () => {
  const result = reviewPowerShellScript(initialScript);
  assert.equal(result.mode, "READY FOR EXPORT REVIEW");
  assert.deepEqual(result.issues, []);
  assert.match(result.checks.join(" "), /Execute switch/);
  assert.match(result.checks.join(" "), /ShouldProcess/);
});

test("review blocks mutations that bypass execution and ShouldProcess guards", () => {
  const result = reviewPowerShellScript([
    "Connect-MgGraph -Scopes \"User.Create\"",
    "New-MgUser -DisplayName \"Unsafe\"",
    "Disconnect-MgGraph"
  ].join("\n"));
  assert.equal(result.mode, "BLOCKED");
  assert.match(result.issues.join(" "), /explicit -Execute/);
  assert.match(result.issues.join(" "), /preview guard/);
  assert.match(result.issues.join(" "), /ShouldProcess/);
});

test("review blocks missing Graph disconnect cleanup", () => {
  const result = reviewPowerShellScript("Connect-MgGraph -Scopes \"User.Read\"\nGet-MgUser");
  assert.equal(result.mode, "BLOCKED");
  assert.match(result.issues.join(" "), /Disconnect-MgGraph/);
});

for (const transform of [s => s.toLowerCase(), s => s.toUpperCase()]) {
  test(`review respects PowerShell casing: ${transform("mixed")}`, () => {
    assert.equal(reviewPowerShellScript(transform(initialScript)).mode, "READY FOR EXPORT REVIEW");
    const unsafe = reviewPowerShellScript(transform('Connect-MgGraph\nNew-MgUser -DisplayName "Unsafe"'));
    assert.equal(unsafe.mode, "BLOCKED");
    assert.match(unsafe.issues.join(" "), /explicit -Execute/);
    assert.match(unsafe.issues.join(" "), /Disconnect-MgGraph/);
  });
}
