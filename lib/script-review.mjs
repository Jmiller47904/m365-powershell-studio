const mutationPattern = /\b(?:new-mguser|remove-mg\w+|update-mg\w+|set-mg\w+|add-mg\w+)\b/;

export function reviewPowerShellScript(source) {
  // PowerShell command names, keywords and variables are case-insensitive.
  const text = typeof source === "string" ? source.toLowerCase() : "";
  const issues = [];
  const checks = [];
  if (!text.trim()) {
    return { mode: "BLOCKED", issues: ["The script is empty."], checks };
  }

  const mutation = text.search(mutationPattern);
  const connect = text.indexOf("connect-mggraph");
  const disconnect = text.indexOf("disconnect-mggraph");
  if (mutation >= 0) {
    const executeParameter = text.indexOf("[switch] $execute");
    const previewGuard = text.indexOf("if (-not $execute)");
    const shouldProcess = text.indexOf("$pscmdlet.shouldprocess");
    if (executeParameter < 0) issues.push("Tenant-changing Graph commands require an explicit -Execute switch.");
    else checks.push("Explicit -Execute switch found.");
    if (previewGuard < 0 || (connect >= 0 && previewGuard > connect)) {
      issues.push("The local preview guard must appear before Connect-MgGraph.");
    } else checks.push("Preview guard appears before the Graph connection.");
    if (!text.includes("[cmdletbinding(supportsshouldprocess)]") || shouldProcess < 0 || shouldProcess > mutation) {
      issues.push("Tenant-changing commands require SupportsShouldProcess and a preceding ShouldProcess check.");
    } else checks.push("ShouldProcess guards the tenant-changing command.");
  } else {
    checks.push("No supported tenant-changing Graph command was detected.");
  }
  if (connect >= 0 && (disconnect < 0 || disconnect < connect)) {
    issues.push("A Graph connection is opened without a later Disconnect-MgGraph cleanup.");
  } else if (connect >= 0) {
    checks.push("Graph disconnect cleanup appears after the connection.");
  }

  return {
    mode: issues.length ? "BLOCKED" : "READY FOR EXPORT REVIEW",
    issues,
    checks
  };
}
