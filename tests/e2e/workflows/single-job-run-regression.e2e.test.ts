import { test, expect } from '@playwright/test';

/**
 * E2E Test: Single Job Run Regression Prevention
 * 
 * NOTE: These tests require actual Electron backend for job execution.
 * Job execution functionality is fully covered by integration tests:
 * - tests/unit/services/JobRunner.executeJob.*.test.js
 * - tests/integration/backend/NewJobExecutionIsolation.integration.test.ts
 * 
 * This file is kept for reference but all tests are skipped as they cannot
 * work in browser-based E2E environment without Electron backend.
 * 
 * Test Scenarios (covered by integration tests):
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
    await page.waitForLoadState('networkidle');
    
    // Check if we're on home screen or already on dashboard
    const dashboardButton = page.locator('button:has-text("Open Dashboard")');
    const isOnDashboard = await page.locator('button:has-text("Start Job"), h2:has-text("Current Job")').first().isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isOnDashboard) {
      // Active State Synchronization: Wait for element to be attached before visibility check
      await page.waitForSelector('button:has-text("Open Dashboard")', { state: 'attached', timeout: 15000 });
      await expect(dashboardButton).toBeVisible({ timeout: 10000 });
      await dashboardButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Wait for dashboard to be ready - use flexible selectors
    await Promise.race([
      page.locator('button:has-text("Start Job")').waitFor({ state: 'visible', timeout: 15000 }),
      page.locator('h2:has-text("Current Job")').waitFor({ state: 'visible', timeout: 15000 }),
      page.locator('h2:has-text("Generated Images")').waitFor({ state: 'visible', timeout: 15000 })
    ]);
  });

  test.skip('Normal job start from dashboard', async ({ page }) => {
    // Click start job button using real text content
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start - look for "Starting..." text - Active State Synchronization
    await page.waitForSelector('button:has-text("Starting...")', { state: 'attached', timeout: 15000 });
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Verify job is in starting state
    await expect(startJobButton).toBeDisabled();
    
    // Wait for job to transition to running state
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Verify stop button is now visible (job is running)
    await expect(page.locator('button:has-text("Stop Job")')).toBeVisible();
  });

  test.skip('Job start and stop functionality', async ({ page }) => {
    // Click start job button
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Click stop button
    const stopJobButton = page.locator('button:has-text("Stop Job")');
    await stopJobButton.click();
    
    // Verify job stopped - Start Job button should be enabled again
    await expect(startJobButton).toBeEnabled();
    await expect(stopJobButton).not.toBeVisible();
  });

  test.skip('Job start with existing running job - constraint enforcement', async ({ page }) => {
    // Start first job
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for first job to start
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Try to start second job - button should be disabled
    await expect(startJobButton).toBeDisabled();
    
    // Stop first job
    const stopJobButton = page.locator('button:has-text("Stop Job")');
    await stopJobButton.click();
    
    // Wait for job to stop
    await expect(startJobButton).toBeEnabled();
    
    // Now try to start second job
    await startJobButton.click();
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
  });

  test.skip('Job progress tracking', async ({ page }) => {
    // Start a job
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Look for progress indicator - it might be in a different component
    // Check if there's any progress-related text or elements
    const progressElements = page.locator('text=/progress|Progress|%|step|Step/i');
    
    // If progress elements exist, verify they're visible - Active State Synchronization
    if (await progressElements.count() > 0) {
      await page.waitForSelector('text=/progress|Progress|%|step|Step/i', { state: 'attached', timeout: 15000 });
      await expect(progressElements.first()).toBeVisible();
    }
    
    // Stop the job
    const stopJobButton = page.locator('button:has-text("Stop Job")');
    await stopJobButton.click();
    
    // Verify job stopped
    await expect(startJobButton).toBeEnabled();
  });

  test.skip('Job completion workflow', async ({ page }) => {
    // Start a job
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // For this test, we'll just verify the job can be stopped
    // In a real scenario, we'd wait for completion, but that could take a long time
    const stopJobButton = page.locator('button:has-text("Stop Job")');
    await stopJobButton.click();
    
    // Verify job stopped
    await expect(startJobButton).toBeEnabled();
    await expect(stopJobButton).not.toBeVisible();
  });

  test.skip('Force stop functionality', async ({ page }) => {
    // Start a job
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Look for force stop button (might be in header menu or separate component)
    const forceStopButton = page.locator('button:has-text("Force Stop"), button:has-text("Stop All")');
    
    if (await forceStopButton.count() > 0) {
      await forceStopButton.click();
      // Verify all jobs stopped
      await expect(startJobButton).toBeEnabled();
    } else {
      // If no force stop button, just use regular stop
      const stopJobButton = page.locator('button:has-text("Stop Job")');
      await stopJobButton.click();
      await expect(startJobButton).toBeEnabled();
    }
  });
});
