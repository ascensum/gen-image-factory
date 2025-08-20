import { test, expect } from '@playwright/test';

/**
 * E2E Test: Single Job Rerun Regression Prevention
 * 
 * This test ensures that single job rerun functionality continues to work correctly
 * and prevents regressions when making changes to the rerun system.
 * 
 * Test Scenarios:
 * 1. Individual job rerun from Job Management Panel
 * 2. Individual job rerun from Dashboard
 * 3. Individual job rerun from Single Job View
 * 4. Rerun with configuration changes
 * 5. Rerun validation (no config, running job)
 * 6. Rerun progress tracking
 * 7. Rerun completion and results
 */

test.describe('Single Job Rerun Regression Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Job Management Panel
    await page.goto('/jobs');
    await page.waitForSelector('[data-testid="job-management-panel"]');
  });

  test('Individual job rerun from Job Management Panel', async ({ page }) => {
    // Find a completed job
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    await expect(completedJobRow).toBeVisible();
    
    // Click the rerun button for this specific job
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Verify job is now running
    await expect(completedJobRow).toContainText('running');
    
    // Verify new execution record was created
    await expect(page.locator('text=Rerun Job')).toBeVisible();
  });

  test('Individual job rerun from Dashboard', async ({ page }) => {
    // Navigate to Dashboard
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-panel"]');
    
    // Find a completed job in dashboard history
    const completedJobRow = page.locator('[data-testid="job-history-row"]').filter({ hasText: 'completed' }).first();
    await expect(completedJobRow).toBeVisible();
    
    // Click the rerun button
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Verify job is now running
    await expect(completedJobRow).toContainText('running');
  });

  test('Individual job rerun from Single Job View', async ({ page }) => {
    // Find a completed job and open Single Job View
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    await expect(completedJobRow).toBeVisible();
    
    // Click to open Single Job View
    await completedJobRow.click();
    
    // Wait for Single Job View to open
    await page.waitForSelector('[data-testid="single-job-view"]');
    
    // Click rerun button in Single Job View
    const rerunButton = page.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Verify job status changed to running
    await expect(page.locator('[data-testid="job-status"]')).toContainText('running');
  });

  test('Rerun with configuration changes', async ({ page }) => {
    // Find a completed job
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    await expect(completedJobRow).toBeVisible();
    
    // Open Single Job View to see current configuration
    await completedJobRow.click();
    await page.waitForSelector('[data-testid="single-job-view"]');
    
    // Note the current configuration
    const currentConfig = await page.locator('[data-testid="job-configuration"]').textContent();
    
    // Go back to Job Management Panel
    await page.goto('/jobs');
    await page.waitForSelector('[data-testid="job-management-panel"]');
    
    // Click rerun button
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Open the new running job to verify configuration
    const runningJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'running' }).first();
    await runningJobRow.click();
    await page.waitForSelector('[data-testid="single-job-view"]');
    
    // Verify configuration is preserved (rerun uses original config)
    const newConfig = await page.locator('[data-testid="job-configuration"]').textContent();
    expect(newConfig).toContain('Rerun');
  });

  test('Rerun validation - no configuration', async ({ page }) => {
    // Find a job without configuration (dashboard-created job)
    const dashboardJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    
    // Check if this job has configuration by looking for settings
    const hasSettings = await dashboardJobRow.locator('[data-testid="job-settings"]').isVisible();
    
    if (!hasSettings) {
      // Try to rerun job without configuration
      const rerunButton = dashboardJobRow.locator('[data-testid="rerun-job-button"]');
      await rerunButton.click();
      
      // Verify proper error message
      await expect(page.locator('text=Job has no configuration')).toBeVisible();
      await expect(page.locator('text=Cannot rerun jobs started from Dashboard without saved settings')).toBeVisible();
    } else {
      // Skip this test if all jobs have configuration
      test.skip();
    }
  });

  test('Rerun validation - running job', async ({ page }) => {
    // Start a job first
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-panel"]');
    
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    await page.fill('[data-testid="prompt-input"]', 'Rerun validation test');
    await page.click('[data-testid="start-job-submit"]');
    
    // Wait for job to start
    await expect(page.locator('text=Job started successfully')).toBeVisible();
    
    // Go to Job Management Panel
    await page.goto('/jobs');
    await page.waitForSelector('[data-testid="job-management-panel"]');
    
    // Try to rerun a completed job while another is running
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify proper error message
    await expect(page.locator('text=Another job is currently running')).toBeVisible();
    await expect(page.locator('text=Please wait for it to complete')).toBeVisible();
  });

  test('Rerun progress tracking', async ({ page }) => {
    // Find a completed job
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    await expect(completedJobRow).toBeVisible();
    
    // Click rerun button
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Verify progress tracking is visible
    await expect(page.locator('[data-testid="job-progress"]')).toBeVisible();
    
    // Wait for progress to update
    await page.waitForFunction(() => {
      const progress = document.querySelector('[data-testid="job-progress"]');
      return progress && progress.textContent !== '0%';
    }, { timeout: 15000 });
    
    // Verify progress increased
    const progressElement = page.locator('[data-testid="job-progress"]');
    const progressText = await progressElement.textContent();
    const progressValue = parseInt(progressText.replace('%', ''));
    expect(progressValue).toBeGreaterThan(0);
  });

  test('Rerun completion and results', async ({ page }) => {
    // Find a completed job
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    await expect(completedJobRow).toBeVisible();
    
    // Click rerun button
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Wait for rerun to complete
    await page.waitForSelector('[data-testid="job-row"]:has-text("completed")', { timeout: 60000 });
    
    // Verify completion message
    await expect(page.locator('text=Job completed successfully')).toBeVisible();
    
    // Verify results are displayed
    await expect(page.locator('[data-testid="generated-images"]')).toBeVisible();
    
    // Verify rerun label is present
    await expect(page.locator('text=Rerun Job')).toBeVisible();
  });

  test('Multiple reruns of same job', async ({ page }) => {
    // Find a completed job
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    await expect(completedJobRow).toBeVisible();
    
    // First rerun
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify first rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Wait for first rerun to complete
    await page.waitForSelector('[data-testid="job-row"]:has-text("completed")', { timeout: 60000 });
    
    // Second rerun
    await rerunButton.click();
    
    // Verify second rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Verify multiple rerun records exist
    const rerunJobs = page.locator('[data-testid="job-row"]:has-text("Rerun Job")');
    await expect(rerunJobs).toHaveCount(2);
  });
});
