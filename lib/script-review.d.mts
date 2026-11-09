export interface ScriptReviewResult {
  mode: "BLOCKED" | "READY FOR EXPORT REVIEW";
  issues: string[];
  checks: string[];
}

export function reviewPowerShellScript(source: string): ScriptReviewResult;
