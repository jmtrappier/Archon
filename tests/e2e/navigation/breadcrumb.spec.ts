import { test, expect } from '@playwright/test';

test.describe('Hierarchy Breadcrumb Navigation Tests', () => {
  let projectId: string;
  let epicId: string;
  let storyId: string;
  let taskId: string;
  let subtaskId: string;

  test.beforeAll(async ({ request }) => {
    // Create complete hierarchy for testing
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Navigation Test Project',
        description: 'Test project for breadcrumb navigation'
      }
    });
    const project = await projectResponse.json();
    projectId = project.id;

    const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Navigation Test Epic',
        code: 'E-NAV',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    });
    const epic = await epicResponse.json();
    epicId = epic.id;

    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Navigation Test Story',
        code: 'S-NAV-01',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    });
    const story = await storyResponse.json();
    storyId = story.id;

    const taskResponse = await request.post(`/api/stories/${storyId}/tasks`, {
      data: {
        title: 'Navigation Test Task',
        code: 'T-NAV-01-01',
        status: 'doing',
        assignee: 'User',
        task_order: 0
      }
    });
    const task = await taskResponse.json();
    taskId = task.id;

    const subtaskResponse = await request.post(`/api/tasks/${taskId}/subtasks`, {
      data: {
        title: 'Navigation Test Subtask',
        status: 'doing',
        assignee: 'User',
        task_order: 0
      }
    });
    const subtask = await subtaskResponse.json();
    subtaskId = subtask.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`);
    }
  });

  test('Breadcrumb shows complete hierarchy path', async ({ page }) => {
    // Navigate to SUBTASK
    await page.goto(`/projects/${projectId}/tasks/${subtaskId}`);

    // Verify complete breadcrumb path
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    await expect(breadcrumb.locator('text=E2E Navigation Test Project')).toBeVisible();
    await expect(breadcrumb.locator('text=Navigation Test Epic')).toBeVisible();
    await expect(breadcrumb.locator('text=Navigation Test Story')).toBeVisible();
    await expect(breadcrumb.locator('text=Navigation Test Task')).toBeVisible();
    await expect(breadcrumb.locator('text=Navigation Test Subtask')).toBeVisible();

    // Verify separators
    const separators = breadcrumb.locator('[aria-hidden="true"]');
    await expect(separators).toHaveCount(4); // 4 separators for 5 items
  });

  test('Navigate to parent levels via breadcrumb', async ({ page }) => {
    // Start from SUBTASK
    await page.goto(`/projects/${projectId}/tasks/${subtaskId}`);

    // Click on TASK in breadcrumb
    await page.click('nav[aria-label="Breadcrumb"] >> text=Navigation Test Task');
    await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}`));
    await expect(page.locator('h3:has-text("Navigation Test Task")')).toBeVisible();

    // Click on STORY in breadcrumb
    await page.click('nav[aria-label="Breadcrumb"] >> text=Navigation Test Story');
    await expect(page).toHaveURL(new RegExp(`/stories/${storyId}`));
    await expect(page.locator('h2:has-text("Navigation Test Story")')).toBeVisible();

    // Click on EPIC in breadcrumb
    await page.click('nav[aria-label="Breadcrumb"] >> text=Navigation Test Epic');
    await expect(page).toHaveURL(new RegExp(`/epics/${epicId}`));
    await expect(page.locator('h1:has-text("Navigation Test Epic")')).toBeVisible();

    // Click on PROJECT in breadcrumb
    await page.click('nav[aria-label="Breadcrumb"] >> text=E2E Navigation Test Project');
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
    await expect(page.locator('h1:has-text("E2E Navigation Test Project")')).toBeVisible();
  });

  test('Breadcrumb updates when navigating between items', async ({ page }) => {
    // Navigate to first STORY
    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Verify initial breadcrumb
    await expect(page.locator('nav[aria-label="Breadcrumb"] >> text=Navigation Test Story')).toBeVisible();

    // Create and navigate to another STORY
    const response = await fetch(`${process.env.BASE_URL || 'http://localhost:8181'}/api/epics/${epicId}/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Second Navigation Story',
        code: 'S-NAV-02',
        status: 'todo',
        priority: 'medium',
        mvp_flag: false
      })
    });
    const newStory = await response.json();

    // Navigate to new STORY
    await page.goto(`/projects/${projectId}/stories/${newStory.id}`);

    // Verify breadcrumb updated
    await expect(page.locator('nav[aria-label="Breadcrumb"] >> text=Second Navigation Story')).toBeVisible();
    await expect(page.locator('nav[aria-label="Breadcrumb"] >> text=Navigation Test Story')).not.toBeVisible();
  });

  test('Breadcrumb shows correct icons for each level', async ({ page }) => {
    // Navigate to a deep level
    await page.goto(`/projects/${projectId}/tasks/${subtaskId}`);

    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    // Check for level-specific icons
    await expect(breadcrumb.locator('[data-icon="project"]')).toBeVisible();
    await expect(breadcrumb.locator('[data-icon="epic"]')).toBeVisible();
    await expect(breadcrumb.locator('[data-icon="story"]')).toBeVisible();
    await expect(breadcrumb.locator('[data-icon="task"]')).toBeVisible();
    await expect(breadcrumb.locator('[data-icon="subtask"]')).toBeVisible();
  });

  test('Breadcrumb handles long titles with truncation', async ({ page, request }) => {
    // Create items with very long titles
    const longEpicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'This is an extremely long EPIC title that should be truncated in the breadcrumb navigation to prevent layout issues',
        code: 'E-LONG',
        status: 'todo',
        priority: 'low',
        mvp_flag: false
      }
    });
    const longEpic = await longEpicResponse.json();

    // Navigate to the EPIC
    await page.goto(`/projects/${projectId}/epics/${longEpic.id}`);

    // Check that breadcrumb item has truncation
    const breadcrumbItem = page.locator('nav[aria-label="Breadcrumb"] >> text=/This is an extremely long/');

    // Verify truncation CSS is applied
    await expect(breadcrumbItem).toHaveCSS('text-overflow', 'ellipsis');
    await expect(breadcrumbItem).toHaveCSS('overflow', 'hidden');

    // Verify tooltip shows full title on hover
    await breadcrumbItem.hover();
    await expect(page.locator('[role="tooltip"]')).toContainText('This is an extremely long EPIC title');
  });

  test('Breadcrumb preserves query parameters during navigation', async ({ page }) => {
    // Navigate with query parameters
    await page.goto(`/projects/${projectId}/epics/${epicId}?view=kanban&filter=mvp`);

    // Click on PROJECT in breadcrumb
    await page.click('nav[aria-label="Breadcrumb"] >> text=E2E Navigation Test Project');

    // Verify query parameters are preserved
    await expect(page).toHaveURL(new RegExp(`view=kanban`));
    await expect(page).toHaveURL(new RegExp(`filter=mvp`));
  });

  test('Breadcrumb shows "Home" link when at project level', async ({ page }) => {
    // Navigate to project level
    await page.goto(`/projects/${projectId}`);

    // Verify "Home" or "Projects" link is visible
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb.locator('text=/Projects|Home/')).toBeVisible();

    // Click to navigate to projects list
    await breadcrumb.locator('text=/Projects|Home/').click();
    await expect(page).toHaveURL('/projects');
  });

  test('Breadcrumb handles missing intermediate levels', async ({ page, request }) => {
    // Create a TASK directly under project (orphaned task)
    const orphanTaskResponse = await request.post(`/api/projects/${projectId}/tasks`, {
      data: {
        title: 'Orphan Task',
        description: 'Task without story',
        status: 'todo',
        assignee: 'User',
        task_order: 999
      }
    });
    const orphanTask = await orphanTaskResponse.json();

    // Navigate to orphan task
    await page.goto(`/projects/${projectId}/tasks/${orphanTask.id}`);

    // Verify breadcrumb shows project → task directly
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb.locator('text=E2E Navigation Test Project')).toBeVisible();
    await expect(breadcrumb.locator('text=Orphan Task')).toBeVisible();

    // Verify no story or epic in breadcrumb
    await expect(breadcrumb.locator('text=Navigation Test Epic')).not.toBeVisible();
    await expect(breadcrumb.locator('text=Navigation Test Story')).not.toBeVisible();
  });

  test('Breadcrumb responsive behavior on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to deep level
    await page.goto(`/projects/${projectId}/tasks/${subtaskId}`);

    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    // On mobile, should show collapsed breadcrumb
    await expect(breadcrumb.locator('[aria-label="Show more breadcrumb items"]')).toBeVisible();

    // Click to expand
    await breadcrumb.locator('[aria-label="Show more breadcrumb items"]').click();

    // Verify dropdown menu appears with all items
    await expect(page.locator('[role="menu"]')).toBeVisible();
    await expect(page.locator('[role="menu"] >> text=E2E Navigation Test Project')).toBeVisible();
    await expect(page.locator('[role="menu"] >> text=Navigation Test Epic')).toBeVisible();
    await expect(page.locator('[role="menu"] >> text=Navigation Test Story')).toBeVisible();
  });

  test('Breadcrumb keyboard navigation', async ({ page }) => {
    // Navigate to a deep level
    await page.goto(`/projects/${projectId}/tasks/${subtaskId}`);

    // Focus on breadcrumb
    await page.keyboard.press('Tab');

    // Navigate through breadcrumb items with arrow keys
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');

    // First link should be focused
    await expect(breadcrumb.locator('a').first()).toBeFocused();

    // Press right arrow to move to next item
    await page.keyboard.press('ArrowRight');
    await expect(breadcrumb.locator('a').nth(1)).toBeFocused();

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Should navigate to the focused breadcrumb item
    await expect(page).toHaveURL(new RegExp(`/epics/${epicId}`));
  });
});