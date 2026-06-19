import { defineConfig } from '@playwright/test';

/**
 * Used exclusively by `npx playwright merge-reports` in CI.
 * Generates the merged HTML report and a results.json used for the
 * GitHub Actions step summary.
 */
export default defineConfig({
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
});

