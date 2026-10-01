import fs from 'node:fs';
import { planUserCreation } from '../lib/csv-preflight.mjs';
try {
  const [file, ...extra] = process.argv.slice(2);
  if (!file || extra.length) throw new Error('Usage: node scripts/csv-preflight.mjs users.csv');
  if (fs.statSync(file).size > 1_000_000) throw new Error('CSV exceeds 1 MB.');
  const plan = planUserCreation(fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(plan, null, 2));
  if (!plan.canProceedToReview) process.exitCode = 2;
} catch (error) {
  console.error(error.code ? 'Unable to read CSV file.' : error.message);
  process.exitCode = 1;
}
