import { test, expect } from '@playwright/test';

/**
 * E2E Test: Bulk Rerun Regression Prevention
 * 
 * This test ensures that bulk rerun functionality continues to work correctly
 * and prevents regressions when making changes to the rerun system.
 * 
 * Test Scenarios:
 * 1. Bulk rerun with 2 jobs - first starts, second queues
 * 2. Bulk rerun with 3 jobs - proper sequential execution
 * 3. Bulk rerun with running job - proper error handling
 * 4. Individual rerun still works (regression prevention)
 * 5. Bulk rerun progress tracking works correctly
 */

test.describe('Bulk Rerun Regression Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Job Management Panel
    await page.goto('/jobs');
    await page.waitForSelector('[data-testid="job-management-panel"]');
  });

  test('Bulk rerun with 2 jobs - first starts, second queues', async ({ page }) => {
    // Select 2 completed jobs
    const jobRows = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' });
    await expect(jobRows).toHaveCount(2);
    
    // Select both jobs
    await jobRows.nth(0).click();
    await jobRows.nth(1).click();
    
    // Verify selection
    const selectedCount = page.locator('[data-testid="selected-jobs-count"]');
    await expect(selectedCount).toContainText('2');
    
    // Click bulk rerun
    const bulkRerunButton = page.locator('[data-testid="bulk-rerun-button"]');
    await bulkRerunButton.click();
    
    // Verify first job started
    await expect(page.locator('text=Started rerun of')).toBeVisible();
    
    // Verify second job queued
    await expect(page.locator('text=1 jobs queued for sequential execution')).toBeVisible();
    
    // Verify only one job is running
    const runningJobs = page.locator('[data-testid="job-row"]').filter({ hasText: 'running' });
    await expect(runningJobs).toHaveCount(1);
  });

  test('Bulk rerun with 3 jobs - proper sequential execution', async ({ page }) => {
    // Select 3 completed jobs
    const jobRows = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' });
    await expect(jobRows).toHaveCount(3);
    
    // Select all three jobs
    await jobRows.nth(0).click();
    await jobRows.nth(1).click();
    await jobRows.nth(2).click();
    
    // Click bulk rerun
    const bulkRerunButton = page.locator('[data-testid="bulk-rerun-button"]');
    await bulkRerunButton.click();
    
    // Verify first job started
    await expect(page.locator('text=Started rerun of')).toBeVisible();
    
    // Verify 2 jobs queued
    await expect(page.locator('text=2 jobs queued for sequential execution')).toBeVisible();
    
    // Wait for first job to complete
    await page.waitForSelector('[data-testid="job-row"]:has-text("completed")', { timeout: 30000 });
    
    // Verify second job started automatically
    await expect(page.locator('[data-testid="job-row"]:has-text("running")')).toBeVisible();
    
    // Verify 1 job still queued
    await expect(page.locator('text=1 job queued for sequential execution')).toBeVisible();
  });

  test('Bulk rerun with running job - proper error handling', async ({ page }) => {
    // Start a job first
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    // Wait for job to be running
    await page.waitForSelector('[data-testid="job-row"]:has-text("running")');
    
    // Try to bulk rerun completed jobs
    const completedJobRows = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' });
    await completedJobRows.nth(0).click();
    await completedJobRows.nth(1).click();
    
    // Click bulk rerun
    const bulkRerunButton = page.locator('[data-testid="bulk-rerun-button"]');
    await bulkRerunButton.click();
    
    // Verify proper error message
    await expect(page.locator('text=Another job is currently running')).toBeVisible();
    
    // Verify no new jobs were started
    const runningJobs = page.locator('[data-testid="job-row"]:has-text("running")');
    await expect(runningJobs).toHaveCount(1);
  });

  test('Individual rerun still works - regression prevention', async ({ page }) => {
    // Find a completed job
    const completedJobRow = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' }).first();
    
    // Click the rerun button for this specific job
    const rerunButton = completedJobRow.locator('[data-testid="rerun-job-button"]');
    await rerunButton.click();
    
    // Verify individual rerun started
    await expect(page.locator('text=Job rerun started successfully')).toBeVisible();
    
    // Verify job is now running
    await expect(completedJobRow).toContainText('running');
  });

  test('Bulk rerun progress tracking works correctly', async ({ page }) => {
    // Select 2 completed jobs
    const jobRows = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' });
    await expect(jobRows).toHaveCount(2);
    
    // Select both jobs
    await jobRows.nth(0).click();
    await jobRows.nth(1).click();
    
    // Click bulk rerun
    const bulkRerunButton = page.locator('[data-testid="bulk-rerun-button"]');
    await bulkRerunButton.click();
    
    // Verify progress tracking is visible
    await expect(page.locator('[data-testid="job-progress"]')).toBeVisible();
    
    // Verify progress updates
    await page.waitForFunction(() => {
      const progress = document.querySelector('[data-testid="job-progress"]');
      return progress && progress.textContent !== '0%';
    }, { timeout: 10000 });
    
    // Verify progress is greater than 0%
    const progressElement = page.locator('[data-testid="job-progress"]');
    const progressText = await progressElement.textContent();
    const progressValue = parseInt(progressText.replace('%', ''));
    expect(progressValue).toBeGreaterThan(0);
  });

  test('Bulk rerun respects job constraints', async ({ page }) => {
    // Select 2 completed jobs
    const jobRows = page.locator('[data-testid="job-row"]').filter({ hasText: 'completed' });
    await expect(jobRows).toHaveCount(2);
    
    // Select both jobs
    await jobRows.nth(0).click();
    await jobRows.nth(1).click();
    
    // Click bulk rerun
    const bulkRerunButton = page.locator('[data-testid="bulk-rerun-button"]');
    await bulkRerunButton.click();
    
    // Verify first job started
    await expect(page.locator('text=Started rerun of')).toBeVisible();
    
    // Try to start another job manually
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    // Verify manual job start is blocked
    await expect(page.locator('text=Another job is currently running')).toBeVisible();
    
    // Verify only one job is running
    const runningJobs = page.locator('[data-testid="job-row"]:has-text("running")');
    await expect(runningJobs).toHaveCount(1);
  });
});
