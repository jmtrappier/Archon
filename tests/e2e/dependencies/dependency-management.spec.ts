import { test, expect } from '@playwright/test';

test.describe('Dependency Management Tests', () => {
  let projectId: string;
  let epic1Id: string;
  let epic2Id: string;
  let story1Id: string;
  let story2Id: string;
  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  test.beforeAll(async ({ request }) => {
    // Create test project
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Dependency Test Project',
        description: 'Test project for dependency management'
      }
    });
    const project = await projectResponse.json();
    projectId = project.id;

    // Create EPICs
    const epic1Response = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Backend Development',
        code: 'E-DEP-01',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    });
    epic1Id = (await epic1Response.json()).id;

    const epic2Response = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Frontend Development',
        code: 'E-DEP-02',
        status: 'todo',
        priority: 'high',
        mvp_flag: true
      }
    });
    epic2Id = (await epic2Response.json()).id;

    // Create STORIEs
    const story1Response = await request.post(`/api/epics/${epic1Id}/stories`, {
      data: {
        title: 'API Implementation',
        code: 'S-DEP-01-01',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    });
    story1Id = (await story1Response.json()).id;

    const story2Response = await request.post(`/api/epics/${epic2Id}/stories`, {
      data: {
        title: 'UI Components',
        code: 'S-DEP-02-01',
        status: 'todo',
        priority: 'high',
        mvp_flag: true
      }
    });
    story2Id = (await story2Response.json()).id;

    // Create TASKs
    const task1Response = await request.post(`/api/stories/${story1Id}/tasks`, {
      data: {
        title: 'Database Schema',
        code: 'T-DEP-01',
        status: 'done',
        assignee: 'User',
        task_order: 0
      }
    });
    task1Id = (await task1Response.json()).id;

    const task2Response = await request.post(`/api/stories/${story1Id}/tasks`, {
      data: {
        title: 'API Endpoints',
        code: 'T-DEP-02',
        status: 'doing',
        assignee: 'User',
        task_order: 1
      }
    });
    task2Id = (await task2Response.json()).id;

    const task3Response = await request.post(`/api/stories/${story2Id}/tasks`, {
      data: {
        title: 'UI Integration',
        code: 'T-DEP-03',
        status: 'todo',
        assignee: 'User',
        task_order: 0
      }
    });
    task3Id = (await task3Response.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`);
    }
  });

  test('Create dependency between EPICs', async ({ page }) => {
    // Navigate to first EPIC
    await page.goto(`/projects/${projectId}/epics/${epic1Id}`);

    // Open dependency management
    await page.click('button:has-text("Manage Dependencies")');

    // Add dependency
    await page.click('button:has-text("Add Dependency")');

    // Select dependency type
    await page.selectOption('select[name="dependency_type"]', 'blocks');

    // Select target EPIC
    await page.selectOption('select[name="target_epic"]', epic2Id);

    // Save dependency
    await page.click('button:has-text("Create Dependency")');

    // Verify dependency is created
    await expect(page.locator('text=This epic blocks: Frontend Development')).toBeVisible();

    // Navigate to second EPIC
    await page.goto(`/projects/${projectId}/epics/${epic2Id}`);

    // Verify reverse dependency is shown
    await expect(page.locator('text=This epic is blocked by: Backend Development')).toBeVisible();
  });

  test('Create dependency between STORIEs', async ({ page }) => {
    // Navigate to first STORY
    await page.goto(`/projects/${projectId}/stories/${story1Id}`);

    // Open dependency management
    await page.click('button:has-text("Manage Dependencies")');

    // Add dependency
    await page.click('button:has-text("Add Dependency")');

    // Select dependency type
    await page.selectOption('select[name="dependency_type"]', 'precedes');

    // Select target STORY
    await page.selectOption('select[name="target_story"]', story2Id);

    // Save dependency
    await page.click('button:has-text("Create Dependency")');

    // Verify dependency is created
    await expect(page.locator('text=This story precedes: UI Components')).toBeVisible();

    // Navigate to second STORY
    await page.goto(`/projects/${projectId}/stories/${story2Id}`);

    // Verify reverse dependency is shown
    await expect(page.locator('text=This story follows: API Implementation')).toBeVisible();
  });

  test('Create dependency between TASKs', async ({ page }) => {
    // Navigate to first TASK
    await page.goto(`/projects/${projectId}/tasks/${task1Id}`);

    // Open dependency management
    await page.click('button:has-text("Manage Dependencies")');

    // Add dependency to second task
    await page.click('button:has-text("Add Dependency")');
    await page.selectOption('select[name="dependency_type"]', 'blocks');
    await page.selectOption('select[name="target_task"]', task2Id);
    await page.click('button:has-text("Create Dependency")');

    // Verify dependency is created
    await expect(page.locator('text=This task blocks: API Endpoints')).toBeVisible();

    // Add dependency from second to third task
    await page.goto(`/projects/${projectId}/tasks/${task2Id}`);
    await page.click('button:has-text("Manage Dependencies")');
    await page.click('button:has-text("Add Dependency")');
    await page.selectOption('select[name="dependency_type"]', 'blocks');
    await page.selectOption('select[name="target_task"]', task3Id);
    await page.click('button:has-text("Create Dependency")');

    // Verify chain is created
    await expect(page.locator('text=This task blocks: UI Integration')).toBeVisible();
  });

  test('Detect and prevent dependency cycles', async ({ page, request }) => {
    // Try to create a cycle: task3 → task1 (when task1 → task2 → task3 exists)
    const response = await request.post('/api/dependencies', {
      data: {
        from_type: 'task',
        from_id: task3Id,
        to_type: 'task',
        to_id: task1Id,
        dependency_type: 'blocks'
      }
    });

    // Should fail with cycle detection error
    expect(response.ok()).toBeFalsy();
    const error = await response.json();
    expect(error.message).toContain('cycle');

    // Navigate to task3
    await page.goto(`/projects/${projectId}/tasks/${task3Id}`);

    // Try via UI
    await page.click('button:has-text("Manage Dependencies")');
    await page.click('button:has-text("Add Dependency")');
    await page.selectOption('select[name="dependency_type"]', 'blocks');
    await page.selectOption('select[name="target_task"]', task1Id);
    await page.click('button:has-text("Create Dependency")');

    // Should show error message
    await expect(page.locator('text=/cycle detected|circular dependency/i')).toBeVisible();
  });

  test('Dependency status affects dependent items', async ({ page, request }) => {
    // Create new tasks for status testing
    const blockingTaskResponse = await request.post(`/api/stories/${story1Id}/tasks`, {
      data: {
        title: 'Blocking Task',
        status: 'doing',
        assignee: 'User',
        task_order: 10
      }
    });
    const blockingTask = await blockingTaskResponse.json();

    const blockedTaskResponse = await request.post(`/api/stories/${story1Id}/tasks`, {
      data: {
        title: 'Blocked Task',
        status: 'todo',
        assignee: 'User',
        task_order: 11
      }
    });
    const blockedTask = await blockedTaskResponse.json();

    // Create dependency
    await request.post('/api/dependencies', {
      data: {
        from_type: 'task',
        from_id: blockingTask.id,
        to_type: 'task',
        to_id: blockedTask.id,
        dependency_type: 'blocks'
      }
    });

    // Navigate to blocked task
    await page.goto(`/projects/${projectId}/tasks/${blockedTask.id}`);

    // Should show waiting status or blocked indicator
    await expect(page.locator('text=/waiting|blocked/i')).toBeVisible();

    // Complete blocking task
    await request.patch(`/api/tasks/${blockingTask.id}`, {
      data: { status: 'done' }
    });

    // Refresh page
    await page.reload();

    // Blocked task should now be unblocked
    await expect(page.locator('text=/waiting|blocked/i')).not.toBeVisible();
    await expect(page.locator('text=Dependencies resolved')).toBeVisible();
  });

  test('Delete dependency', async ({ page, request }) => {
    // Create a dependency to delete
    const depResponse = await request.post('/api/dependencies', {
      data: {
        from_type: 'epic',
        from_id: epic1Id,
        to_type: 'epic',
        to_id: epic2Id,
        dependency_type: 'related_to'
      }
    });
    const dependency = await depResponse.json();

    // Navigate to EPIC
    await page.goto(`/projects/${projectId}/epics/${epic1Id}`);

    // Open dependency management
    await page.click('button:has-text("Manage Dependencies")');

    // Find and delete the dependency
    const depItem = page.locator(`[data-dependency-id="${dependency.id}"]`);
    await depItem.locator('button:has-text("Remove")').click();

    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    // Verify dependency is removed
    await expect(page.locator('text=This epic is related to: Frontend Development')).not.toBeVisible();
  });

  test('Dependency visualization graph', async ({ page }) => {
    // Navigate to project dependency view
    await page.goto(`/projects/${projectId}/dependencies`);

    // Verify graph is displayed
    await expect(page.locator('[data-testid="dependency-graph"]')).toBeVisible();

    // Verify nodes are displayed
    await expect(page.locator('[data-node-type="epic"]')).toHaveCount(2);
    await expect(page.locator('[data-node-type="story"]')).toHaveCount(2);
    await expect(page.locator('[data-node-type="task"]')).toBeVisible();

    // Verify edges (dependency lines) are displayed
    await expect(page.locator('[data-edge-type="blocks"]')).toBeVisible();

    // Click on a node to view details
    await page.locator(`[data-node-id="${epic1Id}"]`).click();

    // Verify node details panel appears
    await expect(page.locator('[data-testid="node-details"]')).toBeVisible();
    await expect(page.locator('text=Backend Development')).toBeVisible();
    await expect(page.locator('text=Dependencies: 1')).toBeVisible();
  });

  test('Cross-level dependencies', async ({ page, request }) => {
    // Create cross-level dependency (EPIC depends on TASK)
    const response = await request.post('/api/dependencies', {
      data: {
        from_type: 'task',
        from_id: task1Id,
        to_type: 'epic',
        to_id: epic2Id,
        dependency_type: 'blocks'
      }
    });

    expect(response.ok()).toBeTruthy();

    // Navigate to EPIC
    await page.goto(`/projects/${projectId}/epics/${epic2Id}`);

    // Verify cross-level dependency is shown
    await expect(page.locator('text=This epic is blocked by: Database Schema (Task)')).toBeVisible();

    // Navigate to TASK
    await page.goto(`/projects/${projectId}/tasks/${task1Id}`);

    // Verify reverse dependency
    await expect(page.locator('text=This task blocks: Frontend Development (Epic)')).toBeVisible();
  });

  test('Dependency chain visualization', async ({ page }) => {
    // Navigate to dependency chain view
    await page.goto(`/projects/${projectId}/dependencies?view=chain`);

    // Select starting point
    await page.selectOption('select[name="chain_start"]', task1Id);

    // Verify chain is displayed
    await expect(page.locator('[data-testid="dependency-chain"]')).toBeVisible();

    // Verify chain shows: task1 → task2 → task3
    const chainItems = page.locator('[data-chain-item]');
    await expect(chainItems).toHaveCount(3);

    await expect(chainItems.nth(0)).toContainText('Database Schema');
    await expect(chainItems.nth(1)).toContainText('API Endpoints');
    await expect(chainItems.nth(2)).toContainText('UI Integration');

    // Verify chain shows blocking relationships
    await expect(page.locator('[data-chain-arrow="blocks"]')).toHaveCount(2);
  });

  test('Bulk dependency operations', async ({ page }) => {
    // Navigate to project dependencies
    await page.goto(`/projects/${projectId}/dependencies`);

    // Enter bulk edit mode
    await page.click('button:has-text("Bulk Edit")');

    // Select multiple dependencies
    await page.check('[data-dependency-checkbox]', { force: true });

    // Verify bulk actions appear
    await expect(page.locator('button:has-text("Delete Selected")')).toBeVisible();
    await expect(page.locator('button:has-text("Change Type")')).toBeVisible();

    // Change type of selected dependencies
    await page.click('button:has-text("Change Type")');
    await page.selectOption('select[name="new_type"]', 'related_to');
    await page.click('button:has-text("Apply")');

    // Verify changes applied
    await expect(page.locator('text=Dependencies updated successfully')).toBeVisible();
  });

  test('Dependency impact analysis', async ({ page }) => {
    // Navigate to a task with dependencies
    await page.goto(`/projects/${projectId}/tasks/${task2Id}`);

    // Click impact analysis
    await page.click('button:has-text("Impact Analysis")');

    // Verify impact report is shown
    await expect(page.locator('[data-testid="impact-report"]')).toBeVisible();

    // Verify downstream impacts
    await expect(page.locator('text=Downstream Impact:')).toBeVisible();
    await expect(page.locator('text=UI Integration - will be blocked')).toBeVisible();

    // Verify upstream dependencies
    await expect(page.locator('text=Upstream Dependencies:')).toBeVisible();
    await expect(page.locator('text=Database Schema - must be completed')).toBeVisible();

    // Verify estimated delay calculation
    await expect(page.locator('text=/Estimated delay|Impact on timeline/i')).toBeVisible();
  });
});