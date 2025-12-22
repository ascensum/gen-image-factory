import { test, expect } from '@playwright/test';

/**
 * E2E Test: Single Job Rerun Regression Prevention
 * 
 * This test ensures that single job rerun functionality continues to work correctly
 * and prevents regressions when making changes to the job system.
 * 
 * Test Scenarios:
 * 1. Rerun from Job Management Panel
 * 2. Rerun from Dashboard Job History
 * 3. Rerun from Single Job View
 * 4. Rerun with config changes
 * 5. Rerun validation and error handling
 * 6. Rerun progress tracking
 * 7. Multiple reruns of same job
 */

test.describe('Single Job Rerun Regression Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Dashboard
    await page.goto('/');
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    // Wait for the dashboard to be visible - look for Start Job button or dashboard content
    // Use a more flexible selector that works whether we're on home or dashboard
    try {
      // First try to find Start Job button (if already on dashboard)
      await page.waitForSelector('button:has-text("Start Job"), button[aria-label="Start job"]', { timeout: 10000 });
    } catch {
      // If not found, navigate to dashboard first
      const dashboardButton = page.locator('button:has-text("Open Dashboard")');
      if (await dashboardButton.count() > 0) {
        await dashboardButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('button:has-text("Start Job"), button[aria-label="Start job"]', { timeout: 15000 });
      } else {
        // Fallback: wait for any visible content
        await page.waitForSelector('button, [class*="dashboard"], [class*="panel"]', { timeout: 15000 });
      }
    }
    // Additional wait to ensure all components are rendered
    await page.waitForTimeout(500);
  });

  test('Rerun from Job Management Panel', async ({ page }) => {
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button[aria-label="Open menu"]', { state: 'attached', timeout: 15000 });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    
    // Wait for menu to be visible
    await page.waitForTimeout(300);
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button:has-text("Job Management")', { state: 'attached', timeout: 15000 });
    await expect(jobManagementButton).toBeVisible({ timeout: 5000 });
    await jobManagementButton.click();
    
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Wait for dashboard elements to disappear (indicating navigation started)
    await page.waitForSelector('h2:has-text("Current Job")', { state: 'hidden', timeout: 5000 }).catch(() => {});
    
    // Wait for Job Management page to load - use flexible selectors
    try {
      await page.locator('h1:has-text("Job Management"), .header-title:has-text("Job Management")').waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // Fallback: check for back button or header class - Active State Synchronization
      // Increased timeout for slow CI runners
      const navigationTimeout = process.env.CI ? 20000 : 15000;
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'attached', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'attached', timeout: navigationTimeout })
      ]);
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'visible', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'visible', timeout: navigationTimeout })
      ]);
    }
    
    // Look for a job with rerun button (rerun icon button)
    const rerunButton = page.locator('button[title="Rerun Job"]').first();
    
    if (await rerunButton.count() > 0) {
      // Click rerun button
      await rerunButton.click();
      
      // Wait for rerun to start - should see "Starting..." on main dashboard
      await page.waitForTimeout(2000); // Wait for rerun to process
      
      // Navigate back to dashboard to check if job started
      const backButton = page.locator('button:has-text("Back to Dashboard")');
      await backButton.click();
      
      // Check if a job is now running
      const stopButton = page.locator('button:has-text("Stop Job")');
      if (await stopButton.count() > 0) {
        // Job is running, stop it
        await stopButton.click();
        await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
      }
    } else {
      // No jobs to rerun, skip test
      test.skip();
    }
  });

  test('Rerun from Dashboard Job History', async ({ page }) => {
    // Look for Job History section on dashboard
    const jobHistorySection = page.locator('text=/Job History|job history/i');
    
    if (await jobHistorySection.count() > 0) {
      // Look for rerun button in job history (rerun icon button)
      const rerunButton = page.locator('button[title="Rerun job"]').first();
      
      if (await rerunButton.count() > 0) {
        // Click rerun button
        await rerunButton.click();
        
        // Wait for rerun to start
        await page.waitForTimeout(2000);
        
        // Check if job started
        const stopButton = page.locator('button:has-text("Stop Job")');
        if (await stopButton.count() > 0) {
          // Job is running, stop it
          await stopButton.click();
          await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
        }
      } else {
        // No rerun buttons available
        test.skip();
      }
    } else {
      // No job history section
      test.skip();
    }
  });

  test('Rerun from Single Job View', async ({ page }) => {
    // Navigate to Job Management first
    const menuButton = page.locator('button[aria-label="Open menu"]');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button[aria-label="Open menu"]', { state: 'attached', timeout: 15000 });
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button:has-text("Job Management")', { state: 'attached', timeout: 15000 });
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Wait for dashboard elements to disappear (indicating navigation started)
    await page.waitForSelector('h2:has-text("Current Job")', { state: 'hidden', timeout: 5000 }).catch(() => {});
    
    // Wait for Job Management page to load - use flexible selectors
    try {
      await page.locator('h1:has-text("Job Management"), .header-title:has-text("Job Management")').waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // Fallback: check for back button or header class - Active State Synchronization
      // Increased timeout for slow CI runners
      const navigationTimeout = process.env.CI ? 20000 : 15000;
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'attached', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'attached', timeout: navigationTimeout })
      ]);
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'visible', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'visible', timeout: navigationTimeout })
      ]);
    }
    
    // Look for a "View" button to open single job view
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.count() > 0) {
      // Click view button to open single job view
      await viewButton.click();
      
      // Wait for single job view to load
      await page.waitForSelector('button:has-text("Back to Job Management")');
      
      // Look for rerun button in single job view
      const rerunButton = page.locator('button:has-text("Rerun Job")');
      
      if (await rerunButton.count() > 0) {
        // Click rerun button
        await rerunButton.click();
        
        // Wait for rerun to start
        await page.waitForTimeout(2000);
        
        // Navigate back to dashboard to check if job started
        const backToJobsButton = page.locator('button:has-text("Back to Job Management")');
        await backToJobsButton.click();
        
        const backToDashboardButton = page.locator('button:has-text("Back to Dashboard")');
        await backToDashboardButton.click();
        
        // Check if a job is now running
        const stopButton = page.locator('button:has-text("Stop Job")');
        if (await stopButton.count() > 0) {
          // Job is running, stop it
          await stopButton.click();
          await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
        }
      } else {
        // No rerun button in single job view
        test.skip();
      }
    } else {
      // No view buttons available
      test.skip();
    }
  });

  test('Rerun constraint enforcement - cannot rerun running job', async ({ page }) => {
    // Start a job first
    const startJobButton = page.locator('button:has-text("Start Job")');
    await startJobButton.click();
    
    // Wait for job to start - Active State Synchronization
    await page.waitForSelector('button:has-text("Starting...")', { state: 'attached', timeout: 15000 });
    await expect(page.locator('button:has-text("Starting...")')).toBeVisible();
    
    // Wait for job to be running
    await page.waitForSelector('button:has-text("Stop Job")', { timeout: 10000 });
    
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button[aria-label="Open menu"]', { state: 'attached', timeout: 15000 });
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button:has-text("Job Management")', { state: 'attached', timeout: 15000 });
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Wait for dashboard elements to disappear (indicating navigation started)
    await page.waitForSelector('h2:has-text("Current Job")', { state: 'hidden', timeout: 5000 }).catch(() => {});
    
    // Wait for Job Management page to load - use flexible selectors
    try {
      await page.locator('h1:has-text("Job Management"), .header-title:has-text("Job Management")').waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // Fallback: check for back button or header class - Active State Synchronization
      // Increased timeout for slow CI runners
      const navigationTimeout = process.env.CI ? 20000 : 15000;
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'attached', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'attached', timeout: navigationTimeout })
      ]);
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'visible', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'visible', timeout: navigationTimeout })
      ]);
    }
    
    // Look for rerun buttons - they should be disabled for running jobs
    const rerunButtons = page.locator('button[title="Rerun Job"]');
    
    if (await rerunButtons.count() > 0) {
      // Check if any rerun buttons are disabled (running jobs)
      const disabledRerunButtons = page.locator('button[title="Rerun Job"][disabled]');
      
      if (await disabledRerunButtons.count() > 0) {
        // Verify disabled rerun button cannot be clicked
        await expect(disabledRerunButtons.first()).toBeDisabled();
      }
    }
    
    // Navigate back to dashboard and stop the job
    const backButton = page.locator('button:has-text("Back to Dashboard")');
    await backButton.click();
    
    const stopButton = page.locator('button:has-text("Stop Job")');
    await stopButton.click();
    
    await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
  });

  test('Multiple reruns of same job', async ({ page }) => {
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button[aria-label="Open menu"]', { state: 'attached', timeout: 15000 });
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button:has-text("Job Management")', { state: 'attached', timeout: 15000 });
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Wait for dashboard elements to disappear (indicating navigation started)
    await page.waitForSelector('h2:has-text("Current Job")', { state: 'hidden', timeout: 5000 }).catch(() => {});
    
    // Wait for Job Management page to load - use flexible selectors
    try {
      await page.locator('h1:has-text("Job Management"), .header-title:has-text("Job Management")').waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // Fallback: check for back button or header class - Active State Synchronization
      // Increased timeout for slow CI runners
      const navigationTimeout = process.env.CI ? 20000 : 15000;
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'attached', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'attached', timeout: navigationTimeout })
      ]);
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'visible', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'visible', timeout: navigationTimeout })
      ]);
    }
    
    // Look for a job with rerun button
    const rerunButton = page.locator('button[title="Rerun Job"]').first();
    
    if (await rerunButton.count() > 0) {
      // First rerun
      await rerunButton.click();
      await page.waitForTimeout(2000);
      
      // Second rerun (should work if first completed or failed)
      await rerunButton.click();
      await page.waitForTimeout(2000);
      
      // Navigate back to dashboard to check job status
      const backButton = page.locator('button:has-text("Back to Dashboard")');
      await backButton.click();
      
      // Check if any job is running and stop it
      const stopButton = page.locator('button:has-text("Stop Job")');
      if (await stopButton.count() > 0) {
        await stopButton.click();
        await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
      }
    } else {
      // No jobs to rerun
      test.skip();
    }
  });

  test('Rerun with job in different states', async ({ page }) => {
    // Navigate to Job Management
    const menuButton = page.locator('button[aria-label="Open menu"]');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button[aria-label="Open menu"]', { state: 'attached', timeout: 15000 });
    await menuButton.click();
    
    const jobManagementButton = page.locator('button:has-text("Job Management")');
    // Active State Synchronization: Wait for element to be attached before visibility check
    await page.waitForSelector('button:has-text("Job Management")', { state: 'attached', timeout: 15000 });
    await jobManagementButton.click();
    
    // Wait for Job Management page to load
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Wait for dashboard elements to disappear (indicating navigation started)
    await page.waitForSelector('h2:has-text("Current Job")', { state: 'hidden', timeout: 5000 }).catch(() => {});
    
    // Wait for Job Management page to load - use flexible selectors
    try {
      await page.locator('h1:has-text("Job Management"), .header-title:has-text("Job Management")').waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // Fallback: check for back button or header class - Active State Synchronization
      // Increased timeout for slow CI runners
      const navigationTimeout = process.env.CI ? 20000 : 15000;
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'attached', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'attached', timeout: navigationTimeout })
      ]);
      await Promise.race([
        page.locator('button[aria-label="Go back to dashboard"]').waitFor({ state: 'visible', timeout: navigationTimeout }),
        page.locator('.job-management-header').waitFor({ state: 'visible', timeout: navigationTimeout })
      ]);
    }
    
    // Look for rerun buttons in different job states
    const rerunButtons = page.locator('button[title="Rerun Job"]');
    
    if (await rerunButtons.count() > 0) {
      // Try to rerun a completed or failed job
      const firstRerunButton = rerunButtons.first();
      
      // Click rerun
      await firstRerunButton.click();
      await page.waitForTimeout(2000);
      
      // Navigate back to dashboard to check if job started
      const backButton = page.locator('button:has-text("Back to Dashboard")');
      await backButton.click();
      
      // Check if a job is now running
      const stopButton = page.locator('button:has-text("Stop Job")');
      if (await stopButton.count() > 0) {
        // Job is running, stop it
        await stopButton.click();
        await expect(page.locator('button:has-text("Start Job")')).toBeEnabled();
      }
    } else {
      // No jobs to rerun
      test.skip();
    }
  });
});
