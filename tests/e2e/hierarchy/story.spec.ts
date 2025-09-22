import { test, expect } from '@playwright/test';

test.describe('STORY Hierarchy Tests', () => {
  let projectId: string;
  let epicId: string;

  test.beforeAll(async ({ request }) => {
    // Create test project
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Test Project - STORIEs',
        description: 'Test project for STORY E2E tests'
      }
    });
    const project = await projectResponse.json();
    projectId = project.id;

    // Create test EPIC
    const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Test Epic for Stories',
        description: 'EPIC containing test stories',
        code: 'E-ST',
        priority: 'high',
        status: 'doing',
        mvp_flag: true
      }
    });
    const epic = await epicResponse.json();
    epicId = epic.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`);
    }
  });

  test('Create STORY within EPIC', async ({ page }) => {
    // Navigate to EPIC
    await page.goto(`/projects/${projectId}/epics/${epicId}`);

    // Click Add Story button
    await page.click('button:has-text("Add Story")');

    // Fill in STORY form
    await page.fill('input[name="title"]', 'Test Story S-ST-01');
    await page.fill('textarea[name="description"]', 'This is a test STORY for E2E testing');
    await page.selectOption('select[name="priority"]', 'high');
    await page.selectOption('select[name="status"]', 'todo');
    await page.check('input[name="mvp_flag"]');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify STORY appears in the EPIC view
    await expect(page.locator('text=Test Story S-ST-01')).toBeVisible();

    // Click on the STORY to view details
    await page.click('text=Test Story S-ST-01');

    // Verify STORY details
    await expect(page.locator('h2:has-text("Test Story S-ST-01")')).toBeVisible();
    await expect(page.locator('text=This is a test STORY for E2E testing')).toBeVisible();
    await expect(page.locator('text=High Priority')).toBeVisible();
    await expect(page.locator('text=MVP')).toBeVisible();
  });

  test('Update STORY fields', async ({ page }) => {
    // Navigate to EPIC
    await page.goto(`/projects/${projectId}/epics/${epicId}`);

    // Click on the STORY
    await page.click('text=Test Story S-ST-01');

    // Click Edit button
    await page.click('button:has-text("Edit")');

    // Update fields
    await page.fill('input[name="title"]', 'Updated Story S-ST-01');
    await page.fill('textarea[name="description"]', 'Updated description for STORY');
    await page.selectOption('select[name="priority"]', 'critical');
    await page.selectOption('select[name="status"]', 'doing');

    // Save changes
    await page.click('button:has-text("Save")');

    // Verify updates
    await expect(page.locator('h2:has-text("Updated Story S-ST-01")')).toBeVisible();
    await expect(page.locator('text=Updated description for STORY')).toBeVisible();
    await expect(page.locator('text=Critical Priority')).toBeVisible();
    await expect(page.locator('text=Doing')).toBeVisible();
  });

  test('Create multiple STORIEs with order', async ({ page, request }) => {
    // Create multiple STORIEs via API
    for (let i = 2; i <= 5; i++) {
      await request.post(`/api/epics/${epicId}/stories`, {
        data: {
          title: `Story S-ST-0${i}`,
          description: `Story ${i} in sequence`,
          code: `S-ST-0${i}`,
          priority: 'medium',
          status: 'todo',
          mvp_flag: true,
          story_order: i - 1
        }
      });
    }

    // Navigate to EPIC
    await page.goto(`/projects/${projectId}/epics/${epicId}`);

    // Verify all STORIEs appear in order
    const storyCards = page.locator('[data-story-id]');
    const count = await storyCards.count();
    expect(count).toBeGreaterThanOrEqual(5);

    // Verify order
    for (let i = 0; i < 4; i++) {
      const title = await storyCards.nth(i + 1).locator('h3').textContent();
      expect(title).toContain(`S-ST-0${i + 2}`);
    }
  });

  test('STORY with TASKs', async ({ page, request }) => {
    // Create a STORY
    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Story with Tasks',
        description: 'STORY containing multiple tasks',
        code: 'S-ST-06',
        priority: 'high',
        status: 'doing',
        mvp_flag: true
      }
    });
    const story = await storyResponse.json();

    // Create multiple TASKs under this STORY
    for (let i = 1; i <= 3; i++) {
      await request.post(`/api/stories/${story.id}/tasks`, {
        data: {
          title: `Task T-ST-06-0${i}`,
          description: `Task ${i} under STORY S-ST-06`,
          code: `T-ST-06-0${i}`,
          status: 'todo',
          assignee: 'User',
          task_order: i - 1
        }
      });
    }

    // Navigate to the STORY
    await page.goto(`/projects/${projectId}/stories/${story.id}`);

    // Verify all TASKs are visible
    await expect(page.locator('text=Task T-ST-06-01')).toBeVisible();
    await expect(page.locator('text=Task T-ST-06-02')).toBeVisible();
    await expect(page.locator('text=Task T-ST-06-03')).toBeVisible();

    // Verify task count
    await expect(page.locator('text=3 Tasks')).toBeVisible();
  });

  test('STORY status transitions with validation', async ({ page, request }) => {
    // Create a STORY
    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Story Status Test',
        description: 'Testing status transitions',
        code: 'S-ST-07',
        priority: 'medium',
        status: 'todo',
        mvp_flag: false
      }
    });
    const story = await storyResponse.json();

    // Navigate to STORY
    await page.goto(`/projects/${projectId}/stories/${story.id}`);

    // Test valid transitions
    const transitions = [
      { from: 'todo', to: 'doing', valid: true },
      { from: 'doing', to: 'review', valid: true },
      { from: 'review', to: 'waiting', valid: true },
      { from: 'waiting', to: 'done', valid: true }
    ];

    for (const transition of transitions) {
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

  test('Delete STORY with cascade to TASKs', async ({ page, request }) => {
    // Create a STORY with TASKs
    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Story to Delete',
        description: 'This STORY will be deleted with its TASKs',
        code: 'S-ST-99',
        priority: 'low',
        status: 'todo',
        mvp_flag: false
      }
    });
    const story = await storyResponse.json();

    // Create TASKs under the STORY
    const taskIds = [];
    for (let i = 1; i <= 2; i++) {
      const taskResponse = await request.post(`/api/stories/${story.id}/tasks`, {
        data: {
          title: `Task to cascade delete ${i}`,
          description: `Task ${i} that should be deleted with STORY`,
          status: 'todo',
          assignee: 'User',
          task_order: i - 1
        }
      });
      const task = await taskResponse.json();
      taskIds.push(task.id);
    }

    // Navigate to STORY
    await page.goto(`/projects/${projectId}/stories/${story.id}`);

    // Click Delete button
    await page.click('button:has-text("Delete")');

    // Confirm deletion
    await page.click('button:has-text("Confirm Delete")');

    // Verify STORY is gone
    const checkStoryResponse = await request.get(`/api/stories/${story.id}`);
    expect(checkStoryResponse.status()).toBe(404);

    // Verify TASKs are also gone (CASCADE)
    for (const taskId of taskIds) {
      const checkTaskResponse = await request.get(`/api/tasks/${taskId}`);
      expect(checkTaskResponse.status()).toBe(404);
    }
  });

  test('STORY progress calculation based on TASKs', async ({ page, request }) => {
    // Create STORY
    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Story Progress Test',
        description: 'Testing automatic progress calculation',
        code: 'S-ST-08',
        priority: 'medium',
        status: 'doing',
        mvp_flag: false
      }
    });
    const story = await storyResponse.json();

    // Create tasks with different statuses
    const taskStatuses = ['done', 'done', 'doing', 'todo'];
    for (let i = 0; i < taskStatuses.length; i++) {
      await request.post(`/api/stories/${story.id}/tasks`, {
        data: {
          title: `Task ${i + 1}`,
          description: `Task with status ${taskStatuses[i]}`,
          status: taskStatuses[i],
          assignee: 'User',
          task_order: i
        }
      });
    }

    // Navigate to STORY
    await page.goto(`/projects/${projectId}/stories/${story.id}`);

    // Verify progress calculation (2 done out of 4 = 50%)
    await expect(page.locator('text=50% Complete')).toBeVisible();

    // Verify progress bar
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  test('STORY filtering and search', async ({ page }) => {
    // Navigate to project with Stories view
    await page.goto(`/projects/${projectId}`);
    await page.click('text=Stories');

    // Test search functionality
    await page.fill('input[placeholder="Search stories..."]', 'Progress');
    await expect(page.locator('text=Story Progress Test')).toBeVisible();
    await expect(page.locator('text=Story Status Test')).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder="Search stories..."]', '');

    // Test priority filter
    await page.selectOption('select[name="priority_filter"]', 'high');
    await expect(page.locator('text=Story with Tasks')).toBeVisible();
    await expect(page.locator('text=Story Progress Test')).not.toBeVisible();

    // Test status filter
    await page.selectOption('select[name="status_filter"]', 'doing');
    await expect(page.locator('text=Story with Tasks')).toBeVisible();
    await expect(page.locator('text=Story Status Test')).not.toBeVisible();

    // Test MVP filter
    await page.check('input[name="mvp_only"]');
    await expect(page.locator('text=Story with Tasks')).toBeVisible();
    await expect(page.locator('text=Story Progress Test')).not.toBeVisible();
  });

  test('STORY drag and drop between EPICs', async ({ page, request }) => {
    // Create a second EPIC
    const epic2Response = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Second Epic for Drag Test',
        description: 'Target EPIC for drag and drop',
        code: 'E-ST2',
        priority: 'medium',
        status: 'todo',
        mvp_flag: false
      }
    });
    const epic2 = await epic2Response.json();

    // Create a STORY in the first EPIC
    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Draggable Story',
        description: 'Story to be moved between EPICs',
        code: 'S-DRG',
        priority: 'medium',
        status: 'todo',
        mvp_flag: false
      }
    });
    const story = await storyResponse.json();

    // Navigate to project view showing both EPICs
    await page.goto(`/projects/${projectId}`);
    await page.click('text=Tree View');

    // Locate the STORY and target EPIC
    const storyElement = page.locator(`[data-story-id="${story.id}"]`);
    const targetEpic = page.locator(`[data-epic-id="${epic2.id}"]`);

    // Drag STORY to the second EPIC
    await storyElement.dragTo(targetEpic);

    // Wait for update
    await page.waitForTimeout(1000);

    // Verify STORY is now under the second EPIC
    await page.goto(`/projects/${projectId}/epics/${epic2.id}`);
    await expect(page.locator('text=Draggable Story')).toBeVisible();

    // Verify STORY is no longer in the first EPIC
    await page.goto(`/projects/${projectId}/epics/${epicId}`);
    await expect(page.locator('text=Draggable Story')).not.toBeVisible();
  });
});