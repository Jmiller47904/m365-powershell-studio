const mutationPattern = /\b(?:New-MgUser|Remove-Mg\w+|Update-Mg\w+|Set-Mg\w+|Add-Mg\w+)\b/;

export function reviewPowerShellScript(source) {
  const text = typeof source === "string" ? source : "";
  const issues = [];
  const checks = [];
  if (!text.trim()) {
    return { mode: "BLOCKED", issues: ["The script is empty."], checks };
  }

  const mutation = text.search(mutationPattern);
  const connect = text.indexOf("Connect-MgGraph");
  const disconnect = text.indexOf("Disconnect-MgGraph");
  if (mutation >= 0) {
    const executeParameter = text.indexOf("[switch] $Execute");
    const previewGuard = text.indexOf("if (-not $Execute)");
    const shouldProcess = text.indexOf("$PSCmdlet.ShouldProcess");
    if (executeParameter < 0) issues.push("Tenant-changing Graph commands require an explicit -Execute switch.");
    else checks.push("Explicit -Execute switch found.");
    if (previewGuard < 0 || (connect >= 0 && previewGuard > connect)) {
      issues.push("The local preview guard must appear before Connect-MgGraph.");
    } else checks.push("Preview guard appears before the Graph connection.");
    if (!text.includes("[CmdletBinding(SupportsShouldProcess)]") || shouldProcess < 0 || shouldProcess > mutation) {
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
