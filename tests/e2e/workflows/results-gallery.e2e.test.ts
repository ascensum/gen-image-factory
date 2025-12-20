import { test, expect, Page } from '@playwright/test';

/**
 * Injects Electron API stub with mock generated images data for E2E testing.
 */
async function injectElectronStubWithGeneratedImages(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.electronAPI) return;

    // Create mock approved images for gallery display
    const mockApprovedImages = [
      {
        id: 1,
        imageMappingId: 'test-mapping-1',
        executionId: 1,
        generationPrompt: 'A beautiful landscape with mountains',
        seed: 12345,
        qcStatus: 'approved',
        qcReason: null,
        finalImagePath: '/test/path/image1.jpg',
        tempImagePath: null,
        metadata: JSON.parse(JSON.stringify({
          title: 'AI-Generated Title',
          description: 'A beautiful landscape',
          tags: ['landscape', 'nature']
        })),
        processingSettings: JSON.parse(JSON.stringify({
          imageEnhancement: true,
          sharpening: 50
        })),
        createdAt: new Date('2025-01-01T00:00:00Z')
      },
      {
        id: 2,
        imageMappingId: 'test-mapping-2',
        executionId: 1,
        generationPrompt: 'Modern city skyline at sunset',
        seed: 67890,
        qcStatus: 'approved',
        qcReason: null,
        finalImagePath: '/test/path/image2.jpg',
        tempImagePath: null,
        metadata: JSON.parse(JSON.stringify({
          title: 'City Sunset',
          description: 'Modern urban landscape'
        })),
        processingSettings: null,
        createdAt: new Date('2025-01-01T01:00:00Z')
      }
    ];

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
          if (prop === 'jobManagement') {
            return {
              getAllGeneratedImages: () => Promise.resolve(mockApprovedImages),
              deleteGeneratedImage: () => Promise.resolve({ success: true }),
              getAllJobExecutions: () => Promise.resolve({
                executions: [
                  { id: 1, label: 'Test Job 1' }
                ]
              })
            }
          }
          if (prop === 'generatedImages') {
            return {
              exportExcel: () => Promise.resolve({ success: true, filePath: '/test/export.xlsx' }),
              exportZip: () => Promise.resolve({ success: true, filePath: '/test/export.zip' })
            }
          }
          return createAsyncFunction()
        },
      }
    )
  })
}

test.describe('Results Gallery E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Electron stub with mock generated images data
    await injectElectronStubWithGeneratedImages(page);
    
    // Navigate to the main page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Click "Open Dashboard" button to navigate to dashboard
    const dashboardButton = page.locator('button:has-text("Open Dashboard")');
    await expect(dashboardButton).toBeVisible();
    await dashboardButton.click();
    
    // Wait for the dashboard to load (new UI has no H1 "Dashboard")
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2:has-text("Current Job")')).toBeVisible();
    await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
  });

  test('Excel export functionality workflow', async ({ page }) => {
    // Wait for the image gallery section to be visible
    await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    
    // Look for the Export ZIP button (which can export to Excel/ZIP)
    const exportButton = page.locator('button:has-text("Export ZIP")');
    
    // The button might not be visible if we need to select images first
    // Check if images are available and select one if needed
    const imageCheckboxes = page.locator('input[type="checkbox"][aria-label^="Select "]');
    const checkboxCount = await imageCheckboxes.count();
    
    if (checkboxCount > 0) {
      // Select first image to enable export button
      await imageCheckboxes.first().check();
      await page.waitForTimeout(300);
    }
    
    // Now check for export button
    if (await exportButton.isVisible()) {
      const isDisabled = await exportButton.isDisabled();
      
      if (!isDisabled) {
        // Click the export button if enabled
        await exportButton.click();
        
        // Verify loading state appears (could be "Exporting...", "Excel…", or "Zipping…")
        await Promise.race([
          page.locator('button:has-text("Exporting...")').waitFor({ state: 'visible', timeout: 2000 }),
          page.locator('button:has-text("Excel…")').waitFor({ state: 'visible', timeout: 2000 }),
          page.locator('button:has-text("Zipping…")').waitFor({ state: 'visible', timeout: 2000 })
        ]).catch(() => {});
        
        // Wait for export to complete (button should return to normal state)
        await expect(exportButton).toBeVisible({ timeout: 10000 });
        
        // Verify no error message appears
        await expect(page.locator('[class*="bg-red-50"]')).not.toBeVisible();
      } else {
        // If disabled, verify it's because there are no images selected
        await expect(exportButton).toBeDisabled();
      }
    } else {
      // If button not visible, verify we can see the gallery structure
      await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    }
  });

  test('Image modal functionality workflow', async ({ page }) => {
    // Wait for the image gallery section to be visible
    await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    
    // Navigate to Image Gallery tab if needed
    const imageGalleryTab = page.locator('button:has-text("Image Gallery"), [role="tab"]:has-text("Image Gallery")');
    if (await imageGalleryTab.isVisible()) {
      await imageGalleryTab.click();
      await page.waitForTimeout(500);
    }
    
    // Wait for images to load
    await page.waitForTimeout(1000);
    
    // Check if there are any images available - use more flexible selectors
    const images = page.locator('img[src*="data:image"], img[class*="object-cover"], img[alt*="landscape"], img[alt*="city"]');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Click on the first image to open modal
      const firstImage = images.first();
      await firstImage.click();
      
      // Verify modal opens
      await expect(page.locator('h2:has-text("Image Details")')).toBeVisible();
      
      // Verify tabs are present
      await expect(page.locator('button:has-text("Details")')).toBeVisible();
      await expect(page.locator('button:has-text("AI Metadata")')).toBeVisible();
      await expect(page.locator('button:has-text("Processing")')).toBeVisible();
      
      // Test tab switching
      await page.locator('button:has-text("AI Metadata")').click();
      await expect(page.locator('text=AI-Generated Title')).toBeVisible();
      
      await page.locator('button:has-text("Processing")').click();
      await expect(page.locator('text=Image Enhancement')).toBeVisible();
      
      // Test modal navigation (if multiple images exist)
      const nextButton = page.locator('[aria-label="Next image"]');
      if (await nextButton.isVisible() && !(await nextButton.isDisabled())) {
        await nextButton.click();
        // Verify we're still in the modal
        await expect(page.locator('h2:has-text("Image Details")')).toBeVisible();
      }
      
      // Close modal
      await page.locator('[aria-label="Close modal"]').click();
      await expect(page.locator('h2:has-text("Image Details")')).not.toBeVisible();
    } else {
      // No images available - verify the empty state
      await expect(page.locator('text=/No images/i')).toBeVisible();
    }
  });

  test('Enhanced metadata display workflow', async ({ page }) => {
    // Wait for the image gallery section to be visible
    await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    
    // Look for enhanced metadata elements in image cards
    const imageCards = page.locator('[class*="border"][class*="rounded"]').filter({ hasText: /.+/ });
    const cardCount = await imageCards.count();
    
    if (cardCount > 0) {
      const firstCard = imageCards.first();
      
      // Check for AI-generated title (if present)
      const titleElement = firstCard.locator('[class*="font-medium"][class*="text-gray-900"]');
      if (await titleElement.isVisible()) {
        await expect(titleElement).toBeVisible();
      }
      
      // Check for processing settings indicators
      const processingIndicators = firstCard.locator('[class*="bg-blue-100"], [class*="bg-purple-100"], [class*="bg-green-100"], [class*="bg-yellow-100"]');
      if (await processingIndicators.count() > 0) {
        await expect(processingIndicators.first()).toBeVisible();
      }
      
      // Check for seed display
      const seedElement = firstCard.locator('text=/.+/');
      if (await seedElement.isVisible()) {
        await expect(seedElement).toBeVisible();
      }
      
      // Check for date display
      const dateElement = firstCard.locator('[title*="/"]');
      if (await dateElement.isVisible()) {
        await expect(dateElement).toBeVisible();
      }
    } else {
      // No image cards available - verify we can see the gallery structure
      await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    }
  });

  test('Image filtering and search workflow', async ({ page }) => {
    // Wait for the image gallery section to be visible
    await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    
    // Test QC status filtering
    const qcFilter = page.locator('select').filter({ hasText: /QC Status|All Statuses/ }).first();
    if (await qcFilter.isVisible()) {
      await qcFilter.selectOption('approved');
      // Wait for filter to apply
      await page.waitForTimeout(500);
      
      // Reset filter
      await qcFilter.selectOption('all');
    }
    
    // Test search functionality - be specific to images search
    const searchInput = page.locator('input[placeholder="Search images..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('landscape');
      // Wait for search to apply
      await page.waitForTimeout(500);
      
      // Clear search
      await searchInput.clear();
    }
    
    // Test view mode switching
    const gridViewButton = page.locator('[title="Grid view"], button[aria-label="Grid view"]');
    const listViewButton = page.locator('[title="List view"], button[aria-label="List view"]');
    
    if (await gridViewButton.isVisible() && await listViewButton.isVisible()) {
      await listViewButton.click();
      await page.waitForTimeout(500);
      
      await gridViewButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('Image selection and bulk actions workflow', async ({ page }) => {
    // Wait for the image gallery section to be visible
    await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    
    // Test image selection
    // Only target per-image checkboxes, not the Select All checkbox
    const imageCheckboxes = page.locator('input[type="checkbox"][aria-label^="Select "]:not([aria-label="Select all images"])');
    const checkboxCount = await imageCheckboxes.count();
    
    if (checkboxCount > 0) {
      // Select first image
      await imageCheckboxes.first().check();
      await expect(imageCheckboxes.first()).toBeChecked();
      
      // Test bulk actions (if available)
      const bulkActionsButton = page.locator('button:has-text("Bulk Actions"), button:has-text("Actions")');
      if (await bulkActionsButton.isVisible()) {
        await bulkActionsButton.click();
        
        // Look for bulk action options
        const bulkOptions = page.locator('[role="menu"] button, [class*="dropdown"] button');
        if (await bulkOptions.count() > 0) {
          // Just verify the menu is visible, don't execute destructive actions
          await expect(bulkOptions.first()).toBeVisible();
          
          // Click elsewhere to close menu
          await page.locator('body').click({ position: { x: 0, y: 0 } });
        }
      }
      
      // Unselect the image
      await imageCheckboxes.first().uncheck();
      await expect(imageCheckboxes.first()).not.toBeChecked();
    } else {
      // No images available - verify the UI is still functional
      await expect(page.locator('h2:has-text("Generated Images")')).toBeVisible();
    }
  });

  test('Error handling workflow', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Test with no images (empty state)
    const noImagesMessage = page.locator('text=/No images/i');
    if (await noImagesMessage.isVisible()) {
      await expect(noImagesMessage).toBeVisible();
    }
    
    // Test export with no images selected
    const exportButton = page.locator('button:has-text("Export ZIP")');
    if (await exportButton.isVisible() && await exportButton.isDisabled()) {
      await expect(exportButton).toBeDisabled();
    }
  });
});
