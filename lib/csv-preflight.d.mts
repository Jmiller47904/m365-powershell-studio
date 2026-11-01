export interface CsvPreflightRow {
  line: number;
  action: string;
  userPrincipalName: string;
  displayName: string;
  issues: string[];
}

export interface CsvPreflightPlan {
  mode: string;
  summary: { total: number; readyForReview: number; blocked: number };
  canProceedToReview: boolean;
  permissions: {
    apiVersion: string;
    delegated: string[];
    application: string[];
    generatedScriptScope: string;
    source: string;
    verifiedOn: string;
  };
  limitations: string[];
  rows: CsvPreflightRow[];
}

export function planUserCreation(text: string): CsvPreflightPlan;
