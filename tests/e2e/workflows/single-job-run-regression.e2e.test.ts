import { test, expect } from '@playwright/test';

/**
 * E2E Test: Single Job Run Regression Prevention
 * 
 * This test ensures that single job functionality continues to work correctly
 * and prevents regressions when making changes to the job system.
 * 
 * Test Scenarios:
 * 1. Normal job start from dashboard
 * 2. Job start with custom configuration
 * 3. Job start validation (invalid configs)
 * 4. Job progress tracking
 * 5. Job completion and results display
 * 6. Job stop functionality
 * 7. Job force stop functionality
 */

test.describe('Single Job Run Regression Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Dashboard
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-panel"]');
  });

  test('Normal job start from dashboard', async ({ page }) => {
    // Click start job button
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    // Verify job configuration modal opens
    await expect(page.locator('[data-testid="job-configuration-modal"]')).toBeVisible();
    
    // Fill in basic configuration
    await page.fill('[data-testid="prompt-input"]', 'Test image generation');
    await page.selectOption('[data-testid="aspect-ratio-select"]', '16:9');
    await page.fill('[data-testid="image-count-input"]', '2');
    
    // Submit configuration
    await page.click('[data-testid="start-job-submit"]');
    
    // Verify job started
    await expect(page.locator('text=Job started successfully')).toBeVisible();
    
    // Verify job is running
    await expect(page.locator('[data-testid="job-status"]')).toContainText('running');
    
    // Verify progress indicator is visible
    await expect(page.locator('[data-testid="job-progress"]')).toBeVisible();
  });

  test('Job start with custom configuration', async ({ page }) => {
    // Click start job button
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    // Fill in custom configuration
    await page.fill('[data-testid="prompt-input"]', 'Custom test image');
    await page.selectOption('[data-testid="aspect-ratio-select"]', '1:1');
    await page.fill('[data-testid="image-count-input"]', '4');
    
    // Enable quality check
    await page.check('[data-testid="quality-check-toggle"]');
    
    // Enable metadata generation
    await page.check('[data-testid="metadata-generation-toggle"]');
    
    // Submit configuration
    await page.click('[data-testid="start-job-submit"]');
    
    // Verify job started with custom settings
    await expect(page.locator('text=Job started successfully')).toBeVisible();
    
    // Verify custom settings are applied
    await expect(page.locator('[data-testid="job-configuration"]')).toContainText('Custom test image');
    await expect(page.locator('[data-testid="job-configuration"]')).toContainText('1:1');
    await expect(page.locator('[data-testid="job-configuration"]')).toContainText('4 images');
  });

  test('Job start validation - invalid configs', async ({ page }) => {
    // Click start job button
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    // Try to submit without prompt
    await page.click('[data-testid="start-job-submit"]');
    
    // Verify validation error
    await expect(page.locator('text=Prompt is required')).toBeVisible();
    
    // Fill prompt but invalid image count
    await page.fill('[data-testid="prompt-input"]', 'Test prompt');
    await page.fill('[data-testid="image-count-input"]', '0');
    await page.click('[data-testid="start-job-submit"]');
    
    // Verify validation error
    await expect(page.locator('text=Image count must be at least 1')).toBeVisible();
    
    // Fill valid configuration
    await page.fill('[data-testid="image-count-input"]', '2');
    await page.click('[data-testid="start-job-submit"]');
    
    // Verify job starts successfully
    await expect(page.locator('text=Job started successfully')).toBeVisible();
  });

  test('Job progress tracking', async ({ page }) => {
    // Start a job
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    await page.fill('[data-testid="prompt-input"]', 'Progress test');
    await page.click('[data-testid="start-job-submit"]');
    
    // Wait for job to start
    await expect(page.locator('text=Job started successfully')).toBeVisible();
    
    // Verify initial progress
    const progressElement = page.locator('[data-testid="job-progress"]');
    await expect(progressElement).toBeVisible();
    
    // Wait for progress to update
    await page.waitForFunction(() => {
      const progress = document.querySelector('[data-testid="job-progress"]');
      return progress && progress.textContent !== '0%';
    }, { timeout: 15000 });
    
    // Verify progress increased
    const progressText = await progressElement.textContent();
    const progressValue = parseInt(progressText.replace('%', ''));
    expect(progressValue).toBeGreaterThan(0);
    
    // Verify current step is displayed
    await expect(page.locator('[data-testid="current-step"]')).toBeVisible();
  });

  test('Job completion and results display', async ({ page }) => {
    // Start a simple job
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    await page.fill('[data-testid="prompt-input"]', 'Completion test');
    await page.selectOption('[data-testid="aspect-ratio-select"]', '1:1');
    await page.fill('[data-testid="image-count-input"]', '1');
    
    // Disable quality check for faster completion
    await page.uncheck('[data-testid="quality-check-toggle"]');
    
    await page.click('[data-testid="start-job-submit"]');
    
    // Wait for job to complete
    await page.waitForSelector('[data-testid="job-status"]:has-text("completed")', { timeout: 60000 });
    
    // Verify completion message
    await expect(page.locator('text=Job completed successfully')).toBeVisible();
    
    // Verify results are displayed
    await expect(page.locator('[data-testid="generated-images"]')).toBeVisible();
    
    // Verify image count matches configuration
    const images = page.locator('[data-testid="generated-image"]');
    await expect(images).toHaveCount(1);
  });

  test('Job stop functionality', async ({ page }) => {
    // Start a job
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    await page.fill('[data-testid="prompt-input"]', 'Stop test');
    await page.click('[data-testid="start-job-submit"]');
    
    // Wait for job to start
    await expect(page.locator('text=Job started successfully')).toBeVisible();
    
    // Click stop button
    const stopButton = page.locator('[data-testid="stop-job-button"]');
    await stopButton.click();
    
    // Verify stop confirmation
    await expect(page.locator('text=Are you sure you want to stop this job?')).toBeVisible();
    
    // Confirm stop
    await page.click('[data-testid="confirm-stop"]');
    
    // Verify job stopped
    await expect(page.locator('text=Job stopped successfully')).toBeVisible();
    
    // Verify job status is stopped
    await expect(page.locator('[data-testid="job-status"]')).toContainText('stopped');
  });

  test('Job force stop functionality', async ({ page }) => {
    // Start a job
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    await page.fill('[data-testid="prompt-input"]', 'Force stop test');
    await page.click('[data-testid="start-job-submit"]');
    
    // Wait for job to start
    await expect(page.locator('text=Job started successfully')).toBeVisible();
    
    // Click force stop button
    const forceStopButton = page.locator('[data-testid="force-stop-button"]');
    await forceStopButton.click();
    
    // Verify force stop confirmation
    await expect(page.locator('text=Are you sure you want to force stop all jobs?')).toBeVisible();
    
    // Confirm force stop
    await page.click('[data-testid="confirm-force-stop"]');
    
    // Verify all jobs stopped
    await expect(page.locator('text=All jobs force stopped')).toBeVisible();
    
    // Verify no jobs are running
    const runningJobs = page.locator('[data-testid="job-status"]:has-text("running")');
    await expect(runningJobs).toHaveCount(0);
  });

  test('Job start with existing running job - constraint enforcement', async ({ page }) => {
    // Start first job
    const startJobButton = page.locator('[data-testid="start-job-button"]');
    await startJobButton.click();
    
    await page.fill('[data-testid="prompt-input"]', 'First job');
    await page.click('[data-testid="start-job-submit"]');
    
    // Wait for first job to start
    await expect(page.locator('text=Job started successfully')).toBeVisible();
    
    // Try to start second job
    await startJobButton.click();
    
    // Verify constraint message
    await expect(page.locator('text=Another job is currently running')).toBeVisible();
    
    // Verify configuration modal doesn't open
    await expect(page.locator('[data-testid="job-configuration-modal"]')).not.toBeVisible();
    
    // Stop first job
    const stopButton = page.locator('[data-testid="stop-job-button"]');
    await stopButton.click();
    await page.click('[data-testid="confirm-stop"]');
    
    // Wait for job to stop
    await expect(page.locator('text=Job stopped successfully')).toBeVisible();
    
    // Now try to start second job
    await startJobButton.click();
    
    // Verify configuration modal opens
    await expect(page.locator('[data-testid="job-configuration-modal"]')).toBeVisible();
  });
});
