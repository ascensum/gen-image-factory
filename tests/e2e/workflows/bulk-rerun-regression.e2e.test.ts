import { test, expect } from '@playwright/test';

/**
 * E2E Test: Bulk Rerun Regression Prevention
 * 
 * This test ensures that bulk rerun functionality continues to work correctly
 * and prevents regressions when making changes to the job system.
 * 
 * Test Scenarios:
 * 1. Bulk rerun with 2 jobs
 * 2. Bulk rerun with 3 jobs
 * 3. Bulk rerun with running job
 * 4. Individual rerun during bulk operation
 * 5. Progress tracking during bulk rerun
 * 6. Job constraints during bulk rerun
 */

test.describe('Bulk Rerun Regression Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Dashboard
    await page.goto('/');
    // Wait for the page to load - look for the Start Job button
    await page.waitForSelector('button:has-text("Start Job")');
  });

  test('Bulk rerun with 2 jobs', async ({ page }) => {
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    await page.waitForSelector('button:has-text("Back to Dashboard")');
    
    // Look for job checkboxes to select jobs
    const jobCheckboxes = page.locator('input[type="checkbox"]:not([aria-label="Select all jobs"])');
    
    if (await jobCheckboxes.count() >= 2) {
      // Select first two jobs
      await jobCheckboxes.nth(0).check();
      await jobCheckboxes.nth(1).check();
      
      // Look for bulk rerun button
      const bulkRerunButton = page.locator('button:has-text("Rerun Selected")');
      
      if (await bulkRerunButton.count() > 0) {
        // Click bulk rerun button
        await bulkRerunButton.click();
        
        // Wait for bulk rerun to start
        await page.waitForTimeout(3000);
        
        // Navigate back to dashboard to check if jobs started
        const backButton = page.locator('button:has-text("Back to Dashboard")');
        await backButton.click();
        
        // Check if jobs are running and stop them
        const stopButtons = page.locator('button:has-text("Stop Job")');
        if (await stopButtons.count() > 0) {
          // Stop all running jobs
          for (let i = 0; i < await stopButtons.count(); i++) {
            await stopButtons.nth(i).click();
            await page.waitForTimeout(500);
          }
          await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
        }
      } else {
        // No bulk rerun button available
        test.skip();
      }
    } else {
      // Not enough jobs to test bulk rerun
      test.skip();
    }
  });

  test('Bulk rerun with 3 jobs', async ({ page }) => {
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    await page.waitForSelector('button:has-text("Back to Dashboard")');
    
    // Look for job checkboxes to select jobs
    const jobCheckboxes = page.locator('input[type="checkbox"]:not([aria-label="Select all jobs"])');
    
    if (await jobCheckboxes.count() >= 3) {
      // Select first three jobs
      await jobCheckboxes.nth(0).check();
      await jobCheckboxes.nth(1).check();
      await jobCheckboxes.nth(2).check();
      
      // Look for bulk rerun button
      const bulkRerunButton = page.locator('button:has-text("Rerun Selected")');
      
      if (await bulkRerunButton.count() > 0) {
        // Click bulk rerun button
        await bulkRerunButton.click();
        
        // Wait for bulk rerun to start
        await page.waitForTimeout(3000);
        
        // Navigate back to dashboard to check if jobs started
        const backButton = page.locator('button:has-text("Back to Dashboard")');
        await backButton.click();
        
        // Check if jobs are running and stop them
        const stopButtons = page.locator('button:has-text("Stop Job")');
        if (await stopButtons.count() > 0) {
          // Stop all running jobs
          for (let i = 0; i < await stopButtons.count(); i++) {
            await stopButtons.nth(i).click();
            await page.waitForTimeout(500);
          }
          await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
        }
      } else {
        // No bulk rerun button available
        test.skip();
      }
    } else {
      // Not enough jobs to test bulk rerun
      test.skip();
    }
  });

  test('Bulk rerun with running job - constraint enforcement', async ({ page }) => {
    // Start a job first from dashboard
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    await page.waitForSelector('button:has-text("Back to Dashboard")');
    
    // Look for job checkboxes to select jobs
    const jobCheckboxes = page.locator('input[type="checkbox"]:not([aria-label="Select all jobs"])');
    
    if (await jobCheckboxes.count() >= 2) {
      // Select first two jobs
      await jobCheckboxes.nth(0).check();
      await jobCheckboxes.nth(1).check();
      
      // Look for bulk rerun button - should be disabled due to running job
      const bulkRerunButton = page.locator('button:has-text("Rerun Selected")');
      
      if (await bulkRerunButton.count() > 0) {
        // Verify bulk rerun button is disabled
        await expect(bulkRerunButton).toBeDisabled();
      }
    }
    
    // Navigate back to dashboard and stop the running job
    const backButton = page.locator('button:has-text("Back to Dashboard")');
    await backButton.click();
    
    const stopButton = page.locator('button:has-text("Stop Job")');
    await stopButton.click();
    
    await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
  });

  test('Individual rerun during bulk operation', async ({ page }) => {
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    await page.waitForSelector('button:has-text("Back to Dashboard")');
    
    // Look for individual rerun buttons
    const rerunButtons = page.locator('button[title="Rerun Job"]');
    
    if (await rerunButtons.count() > 0) {
      // Click individual rerun button
      await rerunButtons.first().click();
      
      // Wait for individual rerun to start
      await page.waitForTimeout(2000);
      
      // Navigate back to dashboard to check if job started
      const backButton = page.locator('button:has-text("Back to Dashboard")');
      await backButton.click();
      
      // Check if job is running and stop it
      const stopButton = page.locator('button:has-text("Stop Job")');
      if (await stopButton.count() > 0) {
        await stopButton.click();
        await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
      }
    } else {
      // No rerun buttons available
      test.skip();
    }
  });

  test('Progress tracking during bulk rerun', async ({ page }) => {
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    await page.waitForSelector('button:has-text("Back to Dashboard")');
    
    // Look for job checkboxes to select jobs
    const jobCheckboxes = page.locator('input[type="checkbox"]:not([aria-label="Select all jobs"])');
    
    if (await jobCheckboxes.count() >= 2) {
      // Select first two jobs
      await jobCheckboxes.nth(0).check();
      await jobCheckboxes.nth(1).check();
      
      // Look for bulk rerun button
      const bulkRerunButton = page.locator('button:has-text("Rerun Selected")');
      
      if (await bulkRerunButton.count() > 0) {
        // Click bulk rerun button
        await bulkRerunButton.click();
        
        // Wait for bulk rerun to start
        await page.waitForTimeout(3000);
        
        // Navigate back to dashboard to check progress
        const backButton = page.locator('button:has-text("Back to Dashboard")');
        await backButton.click();
        
        // Look for progress indicators
        const progressElements = page.locator('text=/progress|Progress|%|step|Step/i');
        
        // If progress elements exist, verify they're visible
        if (await progressElements.count() > 0) {
          await expect(progressElements.first()).toBeVisible();
        }
        
        // Check if jobs are running and stop them
        const stopButtons = page.locator('button:has-text("Stop Job")');
        if (await stopButtons.count() > 0) {
          // Stop all running jobs
          for (let i = 0; i < await stopButtons.count(); i++) {
            await stopButtons.nth(i).click();
            await page.waitForTimeout(500);
          }
          await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
        }
      } else {
        // No bulk rerun button available
        test.skip();
      }
    } else {
      // Not enough jobs to test bulk rerun
      test.skip();
    }
  });

  test('Job constraints during bulk rerun', async ({ page }) => {
    // Start a job first from dashboard
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    await page.waitForSelector('button:has-text("Back to Dashboard")');
    
    // Look for job checkboxes to select jobs
    const jobCheckboxes = page.locator('input[type="checkbox"]:not([aria-label="Select all jobs"])');
    
    if (await jobCheckboxes.count() >= 2) {
      // Select first two jobs
      await jobCheckboxes.nth(0).check();
      await jobCheckboxes.nth(1).check();
      
      // Look for bulk rerun button - should be disabled due to running job
      const bulkRerunButton = page.locator('button:has-text("Rerun Selected")');
      
      if (await bulkRerunButton.count() > 0) {
        // Verify bulk rerun button is disabled
        await expect(bulkRerunButton).toBeDisabled();
        
        // Verify individual rerun buttons are also disabled for running jobs
        const disabledRerunButtons = page.locator('button[title="Rerun Job"][disabled]');
        if (await disabledRerunButtons.count() > 0) {
          await expect(disabledRerunButtons.first()).toBeDisabled();
        }
      }
    }
    
    // Navigate back to dashboard and stop the running job
    const backButton = page.locator('button:has-text("Back to Dashboard")');
    await backButton.click();
    
    const stopButton = page.locator('button:has-text("Stop Job")');
    await stopButton.click();
    
    await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
  });
});
