import { test, expect } from '@playwright/test';
import { generateTestEpic, generateTestProject } from '../../fixtures/test-data';

test.describe('EPIC Hierarchy Tests', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test project
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Test Project - EPICs',
        description: 'Test project for EPIC E2E tests'
      }
    });
    expect(projectResponse.ok()).toBeTruthy();
    const project = await projectResponse.json();
    projectId = project.id;
  });

  test.afterAll(async ({ request }) => {
    // Clean up - delete the test project
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`);
    }
  });

  test('Create EPIC with all required fields', async ({ page }) => {
    // Navigate to project
    await page.goto(`/projects/${projectId}`);

    // Click on EPICs tab
    await page.click('text=EPICs');

    // Click Add Epic button
    await page.click('button:has-text("Add Epic")');

    // Fill in EPIC form
    await page.fill('input[name="title"]', 'Test Epic E-01');
    await page.fill('textarea[name="description"]', 'This is a test EPIC for E2E testing of hierarchy');
    await page.selectOption('select[name="priority"]', 'high');
    await page.selectOption('select[name="status"]', 'todo');
    await page.check('input[name="mvp_flag"]');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify EPIC appears in the list
    await expect(page.locator('text=Test Epic E-01')).toBeVisible();

    // Verify EPIC details
    await page.click('text=Test Epic E-01');
    await expect(page.locator('h1:has-text("Test Epic E-01")')).toBeVisible();
    await expect(page.locator('text=This is a test EPIC for E2E testing')).toBeVisible();
    await expect(page.locator('text=High Priority')).toBeVisible();
    await expect(page.locator('text=MVP')).toBeVisible();
  });

  test('Update EPIC fields', async ({ page }) => {
    // Navigate to project EPICs
    await page.goto(`/projects/${projectId}`);
    await page.click('text=EPICs');

    // Click on the first EPIC
    await page.click('text=Test Epic E-01');

    // Click Edit button
    await page.click('button:has-text("Edit")');

    // Update fields
    await page.fill('input[name="title"]', 'Updated Epic E-01');
    await page.fill('textarea[name="description"]', 'Updated description for E2E testing');
    await page.selectOption('select[name="priority"]', 'critical');
    await page.selectOption('select[name="status"]', 'doing');

    // Save changes
    await page.click('button:has-text("Save")');

    // Verify updates
    await expect(page.locator('h1:has-text("Updated Epic E-01")')).toBeVisible();
    await expect(page.locator('text=Updated description for E2E testing')).toBeVisible();
    await expect(page.locator('text=Critical Priority')).toBeVisible();
    await expect(page.locator('text=Doing')).toBeVisible();
  });

  test('Delete EPIC with cascade', async ({ page, request }) => {
    // Create a test EPIC via API
    const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Epic to Delete',
        description: 'This EPIC will be deleted',
        code: 'E-99',
        priority: 'low',
        status: 'todo',
        mvp_flag: false
      }
    });
    expect(epicResponse.ok()).toBeTruthy();
    const epic = await epicResponse.json();

    // Navigate to EPICs
    await page.goto(`/projects/${projectId}`);
    await page.click('text=EPICs');

    // Find and click the EPIC
    await page.click('text=Epic to Delete');

    // Click Delete button
    await page.click('button:has-text("Delete")');

    // Confirm deletion
    await page.click('button:has-text("Confirm Delete")');

    // Verify EPIC is gone
    await expect(page.locator('text=Epic to Delete')).not.toBeVisible();

    // Verify via API that EPIC is deleted
    const checkResponse = await request.get(`/api/epics/${epic.id}`);
    expect(checkResponse.status()).toBe(404);
  });

  test('EPIC status transitions', async ({ page }) => {
    // Navigate to EPICs
    await page.goto(`/projects/${projectId}`);
    await page.click('text=EPICs');

    // Click on an EPIC
    await page.click('text=Updated Epic E-01');

    // Test status transitions
    const statusTransitions = [
      { from: 'doing', to: 'review' },
      { from: 'review', to: 'waiting' },
      { from: 'waiting', to: 'done' },
      { from: 'done', to: 'todo' } // Reset cycle
    ];

    for (const transition of statusTransitions) {
      // Click Edit
      await page.click('button:has-text("Edit")');

      // Change status
      await page.selectOption('select[name="status"]', transition.to);

      // Save
      await page.click('button:has-text("Save")');

      // Verify status change
      await expect(page.locator(`text=${transition.to}`)).toBeVisible();
    }
  });

  test('EPIC with multiple STORIEs', async ({ page, request }) => {
    // Create an EPIC via API
    const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Epic with Stories',
        description: 'EPIC containing multiple stories',
        code: 'E-02',
        priority: 'high',
        status: 'todo',
        mvp_flag: true
      }
    });
    const epic = await epicResponse.json();

    // Create multiple STORIEs under this EPIC
    for (let i = 1; i <= 3; i++) {
      await request.post(`/api/epics/${epic.id}/stories`, {
        data: {
          title: `Story S-02-0${i}`,
          description: `Story ${i} under EPIC E-02`,
          code: `S-02-0${i}`,
          priority: 'medium',
          status: 'todo',
          mvp_flag: true
        }
      });
    }

    // Navigate to the EPIC
    await page.goto(`/projects/${projectId}`);
    await page.click('text=EPICs');
    await page.click('text=Epic with Stories');

    // Verify all STORIEs are visible
    await expect(page.locator('text=Story S-02-01')).toBeVisible();
    await expect(page.locator('text=Story S-02-02')).toBeVisible();
    await expect(page.locator('text=Story S-02-03')).toBeVisible();

    // Verify story count
    await expect(page.locator('text=3 Stories')).toBeVisible();
  });

  test('EPIC progress calculation', async ({ page, request }) => {
    // Create EPIC with stories in different states
    const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Epic Progress Test',
        description: 'Testing automatic progress calculation',
        code: 'E-03',
        priority: 'medium',
        status: 'doing',
        mvp_flag: false
      }
    });
    const epic = await epicResponse.json();

    // Create stories with different statuses
    const statuses = ['done', 'done', 'doing', 'todo'];
    for (let i = 0; i < statuses.length; i++) {
      await request.post(`/api/epics/${epic.id}/stories`, {
        data: {
          title: `Story S-03-0${i + 1}`,
          description: `Story with status ${statuses[i]}`,
          code: `S-03-0${i + 1}`,
          priority: 'medium',
          status: statuses[i],
          mvp_flag: false
        }
      });
    }

    // Navigate to EPIC
    await page.goto(`/projects/${projectId}/epics/${epic.id}`);

    // Verify progress calculation (2 done out of 4 = 50%)
    await expect(page.locator('text=50% Complete')).toBeVisible();

    // Verify progress bar
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  test('EPIC filtering and search', async ({ page, request }) => {
    // Create multiple EPICs with different attributes
    const epicsData = [
      { title: 'Backend Development', priority: 'high', status: 'doing', mvp_flag: true },
      { title: 'Frontend Features', priority: 'medium', status: 'todo', mvp_flag: true },
      { title: 'Infrastructure Setup', priority: 'critical', status: 'done', mvp_flag: false },
      { title: 'Testing Framework', priority: 'low', status: 'review', mvp_flag: false }
    ];

    for (const [index, epicData] of epicsData.entries()) {
      await request.post(`/api/projects/${projectId}/epics`, {
        data: {
          ...epicData,
          code: `E-1${index}`,
          description: `Description for ${epicData.title}`
        }
      });
    }

    // Navigate to EPICs
    await page.goto(`/projects/${projectId}`);
    await page.click('text=EPICs');

    // Test search
    await page.fill('input[placeholder="Search epics..."]', 'Backend');
    await expect(page.locator('text=Backend Development')).toBeVisible();
    await expect(page.locator('text=Frontend Features')).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder="Search epics..."]', '');

    // Test priority filter
    await page.selectOption('select[name="priority_filter"]', 'high');
    await expect(page.locator('text=Backend Development')).toBeVisible();
    await expect(page.locator('text=Testing Framework')).not.toBeVisible();

    // Test status filter
    await page.selectOption('select[name="status_filter"]', 'done');
    await expect(page.locator('text=Infrastructure Setup')).toBeVisible();
    await expect(page.locator('text=Backend Development')).not.toBeVisible();

    // Test MVP filter
    await page.check('input[name="mvp_only"]');
    await expect(page.locator('text=Backend Development')).toBeVisible();
    await expect(page.locator('text=Infrastructure Setup')).not.toBeVisible();
  });

  test('EPIC drag and drop reordering', async ({ page, request }) => {
    // Create multiple EPICs
    const epics = [];
    for (let i = 1; i <= 3; i++) {
      const response = await request.post(`/api/projects/${projectId}/epics`, {
        data: {
          title: `Draggable Epic ${i}`,
          description: `Epic ${i} for drag and drop testing`,
          code: `E-D${i}`,
          priority: 'medium',
          status: 'todo',
          mvp_flag: false
        }
      });
      epics.push(await response.json());
    }

    // Navigate to EPICs in Kanban view
    await page.goto(`/projects/${projectId}`);
    await page.click('text=EPICs');
    await page.click('button:has-text("Kanban View")');

    // Locate the EPICs
    const epic1 = page.locator(`[data-epic-id="${epics[0].id}"]`);
    const epic3 = page.locator(`[data-epic-id="${epics[2].id}"]`);

    // Drag epic1 after epic3
    await epic1.dragTo(epic3);

    // Verify new order
    const epicCards = page.locator('[data-epic-id]');
    const count = await epicCards.count();

    // Get the order after drag
    const newOrder = [];
    for (let i = 0; i < count; i++) {
      const id = await epicCards.nth(i).getAttribute('data-epic-id');
      newOrder.push(id);
    }

    // Verify epic3 is now before epic1
    const epic3Index = newOrder.indexOf(epics[2].id);
    const epic1Index = newOrder.indexOf(epics[0].id);
    expect(epic3Index).toBeLessThan(epic1Index);
  });
});