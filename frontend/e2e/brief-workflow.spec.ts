import { test, expect } from '@playwright/test';

test.describe('Brief Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');
    // Wait for the page to load
    await expect(page.getByRole('heading', { name: /Intelligent Creative Cortex/i })).toBeVisible();
  });

  test('should display the main application with Brief tab active', async ({ page }) => {
    // Check that the Brief tab is visible and we're on the Brief view
    await expect(page.getByRole('button', { name: /Brief/i }).first()).toBeVisible();
    
    // Check that the AI chat panel is visible
    await expect(page.getByPlaceholder(/Type your response/i)).toBeVisible();
    
    // Check that the Intelligent Content Brief header is visible
    await expect(page.getByText(/Intelligent Content Brief/i)).toBeVisible();
  });

  test('should toggle demo mode on and off', async ({ page }) => {
    // Find and click the Demo Mode button
    const demoButton = page.getByRole('button', { name: /Demo Mode/i });
    await expect(demoButton).toBeVisible();
    
    // Initially should be off
    await expect(demoButton).toContainText('Off');
    
    // Click to turn on
    await demoButton.click();
    await expect(demoButton).toContainText('On');
    
    // Click to turn off
    await demoButton.click();
    await expect(demoButton).toContainText('Off');
  });

  test('should navigate between workflow stages using tabs', async ({ page }) => {
    // Click on Audiences tab
    await page.getByRole('button', { name: /Audiences/i }).first().click();
    await expect(page.getByText(/Audience Matrix/i)).toBeVisible();
    
    // Click on Concepts tab
    await page.getByRole('button', { name: /Concepts/i }).first().click();
    await expect(page.getByText(/Concept Workspace/i)).toBeVisible();
    
    // Click on Production tab
    await page.getByRole('button', { name: /Production/i }).first().click();
    await expect(page.getByText(/Production Matrix/i)).toBeVisible();
    
    // Click on Feed tab
    await page.getByRole('button', { name: /Feed/i }).first().click();
    await expect(page.getByText(/Content Feed/i)).toBeVisible();
    
    // Click back to Brief
    await page.getByRole('button', { name: /Brief/i }).first().click();
    await expect(page.getByPlaceholder(/Type your response/i)).toBeVisible();
  });

  test('should fill in brief fields manually', async ({ page }) => {
    // Find the Campaign Name input
    const campaignInput = page.getByPlaceholder(/Campaign Name/i);
    await expect(campaignInput).toBeVisible();
    
    // Type a campaign name
    await campaignInput.fill('Summer Glow 2024 E2E Test');
    
    // Verify the input has the value
    await expect(campaignInput).toHaveValue('Summer Glow 2024 E2E Test');
    
    // Find the SMP input
    const smpInput = page.getByPlaceholder(/Single-minded Proposition/i);
    if (await smpInput.isVisible()) {
      await smpInput.fill('Feel the summer energy');
      await expect(smpInput).toHaveValue('Feel the summer energy');
    }
  });

  test('should show keyboard shortcuts help modal', async ({ page }) => {
    // Press ? to open the help modal
    await page.keyboard.press('?');
    
    // Check that the modal is visible
    await expect(page.getByRole('heading', { name: /Keyboard Shortcuts/i })).toBeVisible();
    
    // Check for some shortcuts content
    await expect(page.getByText(/Go to Brief/i)).toBeVisible();
    await expect(page.getByText(/Undo/i)).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /Keyboard Shortcuts/i })).not.toBeVisible();
  });

  test('should navigate using keyboard shortcuts', async ({ page }) => {
    // Press 2 to go to Audiences
    await page.keyboard.press('2');
    await expect(page.getByText(/Audience Matrix/i)).toBeVisible();
    
    // Press 3 to go to Concepts
    await page.keyboard.press('3');
    await expect(page.getByText(/Concept Workspace/i)).toBeVisible();
    
    // Press 1 to go back to Brief
    await page.keyboard.press('1');
    await expect(page.getByPlaceholder(/Type your response/i)).toBeVisible();
  });

  test('should display quality score section', async ({ page }) => {
    // Check for the quality score display
    await expect(page.getByText(/Quality/i)).toBeVisible();
    
    // The score should be visible (even if low initially)
    await expect(page.getByText(/\/10/)).toBeVisible();
  });

  test('should have export buttons visible on brief page', async ({ page }) => {
    // Check for export buttons
    await expect(page.getByRole('button', { name: /Download TXT/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download JSON/i })).toBeVisible();
  });

  test('should show undo/redo buttons', async ({ page }) => {
    // Check for undo button (with title attribute)
    await expect(page.getByTitle(/Undo/i)).toBeVisible();
    
    // Check for redo button (with title attribute)
    await expect(page.getByTitle(/Redo/i)).toBeVisible();
  });

  test('should navigate to Planning Workspace', async ({ page }) => {
    // Find the Planning Workspace link
    const planningLink = page.getByRole('link', { name: /Planning Workspace/i });
    await expect(planningLink).toBeVisible();
    
    // Click to navigate
    await planningLink.click();
    
    // Should be on the planning page
    await expect(page).toHaveURL(/\/planning/);
    
    // Check for ModCon Planner heading
    await expect(page.getByText(/ModCon Planner/i)).toBeVisible();
  });

  test('should navigate back from Planning Workspace', async ({ page }) => {
    // Go to planning page
    await page.goto('/planning');
    await expect(page.getByText(/ModCon Planner/i)).toBeVisible();
    
    // Click back to Brief Builder link
    const backLink = page.getByRole('link', { name: /Back to Brief Builder/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    
    // Should be back on main page
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /Intelligent Creative Cortex/i })).toBeVisible();
  });
});

test.describe('Production Workflow', () => {
  test('should generate production plan in demo mode', async ({ page }) => {
    await page.goto('/');
    
    // Enable demo mode
    const demoButton = page.getByRole('button', { name: /Demo Mode/i });
    await demoButton.click();
    await expect(demoButton).toContainText('On');
    
    // Navigate to Production tab
    await page.getByRole('button', { name: /Production/i }).first().click();
    await expect(page.getByText(/Production Matrix/i)).toBeVisible();
    
    // Click Generate Plan button
    const generateButton = page.getByRole('button', { name: /Generate Plan/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // Wait for generation to complete (button text changes)
      await expect(page.getByRole('button', { name: /Regenerate Plan/i })).toBeVisible({ timeout: 10000 });
      
      // Should see production cards
      await expect(page.getByText(/Night Reset Ritual/i)).toBeVisible();
    }
  });
});

test.describe('State Persistence', () => {
  test('should persist demo mode across navigation', async ({ page }) => {
    await page.goto('/');
    
    // Enable demo mode
    const demoButton = page.getByRole('button', { name: /Demo Mode/i });
    await demoButton.click();
    await expect(demoButton).toContainText('On');
    
    // Navigate to planning page
    await page.goto('/planning');
    
    // Come back
    await page.goto('/');
    
    // Demo mode should still be on
    await expect(page.getByRole('button', { name: /Demo Mode: On/i })).toBeVisible();
  });

  test('should persist brief fields across page reload', async ({ page }) => {
    await page.goto('/');
    
    // Fill in a campaign name
    const campaignInput = page.getByPlaceholder(/Campaign Name/i);
    await campaignInput.fill('Persistence Test Campaign');
    
    // Wait for autosave
    await page.waitForTimeout(1000);
    
    // Reload the page
    await page.reload();
    
    // Campaign name should be preserved
    await expect(page.getByPlaceholder(/Campaign Name/i)).toHaveValue('Persistence Test Campaign');
  });
});
