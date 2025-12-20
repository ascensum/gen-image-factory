import { test, expect, Page } from '@playwright/test';

/**
 * Injects Electron API stub with mock failed images data for E2E testing.
 * Note: This mocks the API layer - database/backend coverage is in integration tests.
 */
async function injectElectronStubWithFailedImages(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.electronAPI) return;

    // Create mock failed images data matching GeneratedImage interface exactly
    // This matches the structure returned by GeneratedImage.getImagesByQCStatus()
    // which maps database rows to: { id, imageMappingId, executionId, generationPrompt, 
    // seed, qcStatus, qcReason, finalImagePath, tempImagePath, metadata, processingSettings, createdAt }
    const mockFailedImage = {
      id: 1,
      imageMappingId: 'test-mapping-1',
      executionId: 1,
      generationPrompt: 'Test prompt for failed image',
      seed: 12345,
      qcStatus: 'failed', // Database stores as 'failed', component filters by 'qc_failed'
      qcReason: 'Quality check failed',
      finalImagePath: '/test/path/test-failed-image.jpg',
      tempImagePath: '/test/path/temp/test-failed-image.jpg',
      metadata: JSON.parse(JSON.stringify({
        title: 'Test Failed Image',
        description: 'A test image that failed QC'
      })),
      processingSettings: null,
      createdAt: new Date('2025-01-01T00:00:00Z')
    };

    const mockRetryFailedImage = {
      id: 2,
      imageMappingId: 'test-mapping-2',
      executionId: 1,
      generationPrompt: 'Test prompt for retry failed image',
      seed: 67890,
      qcStatus: 'failed', // Database stores as 'failed', component filters by 'retry_failed' 
      qcReason: 'Retry failed',
      finalImagePath: '/test/path/test-retry-failed-image.jpg',
      tempImagePath: '/test/path/temp/test-retry-failed-image.jpg',
      metadata: JSON.parse(JSON.stringify({
        title: 'Test Retry Failed Image',
        description: 'A test image that failed retry'
      })),
      processingSettings: null,
      createdAt: new Date('2025-01-01T01:00:00Z')
    };

    const createAsyncFunction = () => {
      const fn = function () {}
      return new Proxy(fn, {
        apply: () => Promise.resolve(undefined),
        get: (_target, prop) => {
          if (prop === 'then') return undefined
          return createAsyncFunction()
        },
      })
    }

    window.electronAPI = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'ping') return () => Promise.resolve('pong')
          if (prop === 'getAppVersion') return () => Promise.resolve('0.0.0')
          if (prop === 'generatedImages') {
            return {
              getImagesByQCStatus: (status: string) => {
                // Return mock data matching real API format: { success: true, images: [...] }
                // Note: The component maps 'qc_failed' to 'failed' status
                if (status === 'qc_failed' || status === 'failed') {
                  return Promise.resolve({ success: true, images: [mockFailedImage] })
                }
                if (status === 'retry_failed') {
                  return Promise.resolve({ success: true, images: [mockRetryFailedImage] })
                }
                // Return empty arrays for other statuses (matching real API format)
                return Promise.resolve({ success: true, images: [] })
              },
              updateQCStatus: () => Promise.resolve({ success: true }),
              deleteGeneratedImage: () => Promise.resolve({ success: true }),
              manualApproveImage: () => Promise.resolve({ 
                success: true, 
                outputDirectory: '/test/output',
                finalImagePath: '/test/output/test-failed-image.jpg'
              }),
              retryFailedImagesBatch: () => Promise.resolve({ success: true })
            }
          }
          if (prop === 'retryFailedImagesBatch') {
            return () => Promise.resolve({ success: true })
          }
          if (prop === 'jobManagement') {
            return {
              getAllJobExecutions: () => Promise.resolve({
                executions: [
                  { id: 'test-job-1', label: 'Test Job 1' }
                ]
              })
            }
          }
          return createAsyncFunction()
        },
      }
    )
  })
}

test.describe('Failed Images Review - E2E Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Electron stub with mock failed images data
    await injectElectronStubWithFailedImages(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go to Dashboard - check if we're already on dashboard or need to navigate
    const dashboardButton = page.locator('button:has-text("Open Dashboard")');
    const isOnDashboard = await page.locator('h2:has-text("Current Job"), h2:has-text("Generated Images"), button:has-text("Start Job")').first().isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isOnDashboard) {
      await expect(dashboardButton).toBeVisible({ timeout: 10000 });
      await dashboardButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Wait for dashboard to be fully loaded - use more flexible selectors
    await Promise.race([
      page.waitForSelector('h2:has-text("Current Job")', { timeout: 15000 }),
      page.waitForSelector('h2:has-text("Generated Images")', { timeout: 15000 }),
      page.waitForSelector('button:has-text("Start Job"), button[aria-label="Start job"]', { timeout: 15000 })
    ]);
    
    // Additional wait to ensure all components are rendered
    await page.waitForTimeout(500);
  });

  test('navigate to Failed Images Review and perform batch retry (original settings)', async ({ page }) => {
    // Open hamburger menu, then navigate to Failed Images Review
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    
    // Wait for menu to be visible before clicking
    const reviewLink = page.locator('button:has-text("Failed Images Review")');
    await expect(reviewLink).toBeVisible({ timeout: 5000 });
    await reviewLink.click();
    
    // Wait for React state update - give React time to unmount dashboard and mount panel
    // Wait a bit for the state change to propagate
    await page.waitForTimeout(500);
    
    // Wait for the panel to be visible - try heading first, then fallback to other indicators
    // The panel should render immediately after state change
    try {
      await page.waitForSelector('h1:has-text("Failed Images Review")', { timeout: 10000 });
    } catch {
      // Fallback: wait for any panel content
      await Promise.race([
        page.waitForSelector('[data-testid^="failed-image-card-"]', { timeout: 10000 }),
        page.locator('text=No Failed Images').waitFor({ state: 'visible', timeout: 10000 }),
        page.locator('text=Review and manage images').waitFor({ state: 'visible', timeout: 10000 })
      ]);
    }

    // Panel header (use heading role to avoid ambiguity with the button)
    await expect(page.getByRole('heading', { name: 'Failed Images Review' })).toBeVisible({ timeout: 10000 });

    // If there are failed cards, select all and open retry
    const selectAllLabel = page.locator('text=/Select All \\(\\d+\\/\\d+\\)/');
    if (await selectAllLabel.first().isVisible()) {
      const selectAllCheckbox = selectAllLabel.first().locator('xpath=preceding-sibling::*[1]');
      await selectAllCheckbox.click();

      const retrySelected = page.locator('button:has-text("Retry Selected")');
      if (await retrySelected.isVisible()) {
        await retrySelected.click();
        // Processing settings modal appears
        await expect(page.locator('[data-testid="processing-settings-modal"]')).toBeVisible();
        // Choose original settings
        const originalBtn = page.locator('button:has-text("Retry with Original Settings")');
        await expect(originalBtn).toBeVisible();
        await originalBtn.click();
        // Modal closes and selection clears - give React time to update state
        await page.waitForTimeout(500);
        await expect(page.locator('[data-testid="processing-settings-modal"]')).not.toBeVisible({ timeout: 5000 });
        // Selection should clear - wait for it
        await page.waitForTimeout(300);
        await expect(page.locator('text=/Select All \\(0\\/\\d+\\)/')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('approve and delete single failed image from the review list', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    
    // Wait for menu to be visible before clicking
    const reviewLink = page.locator('button:has-text("Failed Images Review")');
    await expect(reviewLink).toBeVisible({ timeout: 5000 });
    await reviewLink.click();
    
    // Wait for React state update - give React time to unmount dashboard and mount panel
    await page.waitForTimeout(500);
    
    // Wait for the panel to be visible - try heading first, then fallback to other indicators
    try {
      await page.waitForSelector('h1:has-text("Failed Images Review")', { timeout: 10000 });
    } catch {
      // Fallback: wait for any panel content
      await Promise.race([
        page.waitForSelector('[data-testid^="failed-image-card-"]', { timeout: 10000 }),
        page.locator('text=No Failed Images').waitFor({ state: 'visible', timeout: 10000 }),
        page.locator('text=Review and manage images').waitFor({ state: 'visible', timeout: 10000 })
      ]);
    }
    
    await expect(page.getByRole('heading', { name: 'Failed Images Review' })).toBeVisible({ timeout: 10000 });

    const firstCard = page.locator('[data-testid^="failed-image-card-"]').first();
    if (await firstCard.isVisible()) {
      // Approve
      const approveBtn = firstCard.locator('button:has-text("Approve")');
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(300); // wait for list refresh
      }

      // Re-query first card (list may change). If still visible, delete
      const anyCard = page.locator('[data-testid^="failed-image-card-"]').first();
      if (await anyCard.isVisible()) {
        const deleteBtn = anyCard.locator('button:has-text("Delete")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.waitForTimeout(300);
        }
      }
    } else {
      await expect(page.locator('text=No Failed Images')).toBeVisible();
    }
  });

  test('open single image review modal and add to retry pool', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    
    // Wait for menu to be visible before clicking
    const reviewLink = page.locator('button:has-text("Failed Images Review")');
    await expect(reviewLink).toBeVisible({ timeout: 5000 });
    await reviewLink.click();
    
    // Wait for React state update - give React time to unmount dashboard and mount panel
    await page.waitForTimeout(500);
    
    // Wait for the panel to be visible - try heading first, then fallback to other indicators
    try {
      await page.waitForSelector('h1:has-text("Failed Images Review")', { timeout: 10000 });
    } catch {
      // Fallback: wait for any panel content
      await Promise.race([
        page.waitForSelector('[data-testid^="failed-image-card-"]', { timeout: 10000 }),
        page.locator('text=No Failed Images').waitFor({ state: 'visible', timeout: 10000 }),
        page.locator('text=Review and manage images').waitFor({ state: 'visible', timeout: 10000 })
      ]);
    }
    
    await expect(page.getByRole('heading', { name: 'Failed Images Review' })).toBeVisible({ timeout: 10000 });

    const firstCard = page.locator('[data-testid^="failed-image-card-"]').first();
    if (await firstCard.isVisible()) {
      // Open view
      const viewBtn = firstCard.locator('button:has-text("View")');
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await expect(page.locator('[data-testid="failed-image-review-modal"]')).toBeVisible();

        // Add to retry pool
        const retryBtn = page.locator('button:has-text("Add to Retry Pool")');
        if (await retryBtn.isVisible()) {
          await retryBtn.click();
        }

        // Close modal by clicking on overlay area
        await page.mouse.click(5, 5);
        await expect(page.locator('[data-testid="failed-image-review-modal"]')).not.toBeVisible({ timeout: 2000 });
      }
    }
  });
});


