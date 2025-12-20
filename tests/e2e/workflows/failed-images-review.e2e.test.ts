import { test, expect } from '@playwright/test';

test.describe('Failed Images Review - E2E Workflow', () => {
  test.beforeEach(async ({ page }) => {
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
    const reviewLink = page.locator('button:has-text("Failed Images Review")');
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();

    // Panel header (use heading role to avoid ambiguity with the button)
    await expect(page.getByRole('heading', { name: 'Failed Images Review' })).toBeVisible();

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
        // Modal closes and selection clears
        await expect(page.locator('[data-testid="processing-settings-modal"]')).not.toBeVisible({ timeout: 3000 });
        await expect(page.locator('text=/Select All \\(0\\//')).toBeVisible();
      }
    }
  });

  test('approve and delete single failed image from the review list', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    const reviewLink = page.locator('button:has-text("Failed Images Review")');
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();
    await expect(page.getByRole('heading', { name: 'Failed Images Review' })).toBeVisible();

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
    const reviewLink = page.locator('button:has-text("Failed Images Review")');
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();
    await expect(page.getByRole('heading', { name: 'Failed Images Review' })).toBeVisible();

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


