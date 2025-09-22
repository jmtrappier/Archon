import { test, expect } from '@playwright/test';

test.describe('TASK and SUBTASK Hierarchy Tests', () => {
  let projectId: string;
  let epicId: string;
  let storyId: string;

  test.beforeAll(async ({ request }) => {
    // Create test project
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Test Project - TASKs',
        description: 'Test project for TASK/SUBTASK E2E tests'
      }
    });
    const project = await projectResponse.json();
    projectId = project.id;

    // Create test EPIC
    const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Test Epic for Tasks',
        description: 'EPIC containing test stories and tasks',
        code: 'E-TK',
        priority: 'high',
        status: 'doing',
        mvp_flag: true
      }
    });
    const epic = await epicResponse.json();
    epicId = epic.id;

    // Create test STORY
    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Test Story for Tasks',
        description: 'STORY containing test tasks',
        code: 'S-TK-01',
        priority: 'high',
        status: 'doing',
        mvp_flag: true
      }
    });
    const story = await storyResponse.json();
    storyId = story.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`);
    }
  });

  test('Create TASK within STORY', async ({ page }) => {
    // Navigate to STORY
    await page.goto(`/projects/${projectId}/stories/${storyId}`);

    // Click Add Task button
    await page.click('button:has-text("Add Task")');

    // Fill in TASK form
    await page.fill('input[name="title"]', 'Test Task T-TK-01-01');
    await page.fill('textarea[name="description"]', 'This is a test TASK for E2E testing');
    await page.selectOption('select[name="status"]', 'todo');
    await page.selectOption('select[name="assignee"]', 'User');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify TASK appears in the STORY view
    await expect(page.locator('text=Test Task T-TK-01-01')).toBeVisible();

    // Click on the TASK to view details
    await page.click('text=Test Task T-TK-01-01');

    // Verify TASK details
    await expect(page.locator('h3:has-text("Test Task T-TK-01-01")')).toBeVisible();
    await expect(page.locator('text=This is a test TASK for E2E testing')).toBeVisible();
    await expect(page.locator('text=Assigned to: User')).toBeVisible();
  });

  test('Create SUBTASK within TASK', async ({ page, request }) => {
    // First, get the task we created
    const tasksResponse = await request.get(`/api/stories/${storyId}/tasks`);
    const tasks = await tasksResponse.json();
    const parentTask = tasks.find((t: any) => t.title.includes('Test Task T-TK-01-01'));

    // Navigate to TASK
    await page.goto(`/projects/${projectId}/tasks/${parentTask.id}`);

    // Click Add Subtask button
    await page.click('button:has-text("Add Subtask")');

    // Fill in SUBTASK form
    await page.fill('input[name="title"]', 'Test Subtask 1');
    await page.fill('textarea[name="description"]', 'This is a test SUBTASK under TASK');
    await page.selectOption('select[name="status"]', 'todo');
    await page.selectOption('select[name="assignee"]', 'AI IDE Agent');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify SUBTASK appears under the TASK
    await expect(page.locator('text=Test Subtask 1')).toBeVisible();
    await expect(page.locator('text=Assigned to: AI IDE Agent')).toBeVisible();
  });

  test('Update TASK and SUBTASK fields', async ({ page, request }) => {
    // Get the task
    const tasksResponse = await request.get(`/api/stories/${storyId}/tasks`);
    const tasks = await tasksResponse.json();
    const parentTask = tasks.find((t: any) => t.title.includes('Test Task T-TK-01-01'));

    // Navigate to TASK
    await page.goto(`/projects/${projectId}/tasks/${parentTask.id}`);

    // Update TASK
    await page.click('button:has-text("Edit Task")');
    await page.fill('input[name="title"]', 'Updated Task T-TK-01-01');
    await page.selectOption('select[name="status"]', 'doing');
    await page.selectOption('select[name="assignee"]', 'Archon');
    await page.click('button:has-text("Save")');

    // Verify TASK updates
    await expect(page.locator('h3:has-text("Updated Task T-TK-01-01")')).toBeVisible();
    await expect(page.locator('text=Status: doing')).toBeVisible();
    await expect(page.locator('text=Assigned to: Archon')).toBeVisible();

    // Update SUBTASK
    await page.click('text=Test Subtask 1');
    await page.click('button:has-text("Edit Subtask")');
    await page.fill('input[name="title"]', 'Updated Subtask 1');
    await page.selectOption('select[name="status"]', 'doing');
    await page.click('button:has-text("Save")');

    // Verify SUBTASK updates
    await expect(page.locator('text=Updated Subtask 1')).toBeVisible();
    await expect(page.locator('[data-subtask] text=doing')).toBeVisible();
  });

  test('Create multiple levels of SUBTASKs', async ({ page, request }) => {
    // Create a new TASK
    const taskResponse = await request.post(`/api/stories/${storyId}/tasks`, {
      data: {
        title: 'Task with Deep Subtasks',
        description: 'TASK with multiple subtask levels',
        code: 'T-TK-01-02',
        status: 'todo',
        assignee: 'User',
        task_order: 1
      }
    });
    const task = await taskResponse.json();

    // Create first level SUBTASK
    const subtask1Response = await request.post(`/api/tasks/${task.id}/subtasks`, {
      data: {
        title: 'Level 1 Subtask',
        description: 'First level subtask',
        status: 'todo',
        assignee: 'User',
        task_order: 0
      }
    });
    const subtask1 = await subtask1Response.json();

    // Create second level SUBTASK
    const subtask2Response = await request.post(`/api/tasks/${subtask1.id}/subtasks`, {
      data: {
        title: 'Level 2 Subtask',
        description: 'Second level subtask',
        status: 'todo',
        assignee: 'User',
        task_order: 0
      }
    });
    const subtask2 = await subtask2Response.json();

    // Navigate to the main TASK
    await page.goto(`/projects/${projectId}/tasks/${task.id}`);

    // Verify hierarchy is displayed
    await expect(page.locator('text=Level 1 Subtask')).toBeVisible();

    // Expand first level subtask
    await page.click('[data-subtask-id="' + subtask1.id + '"] [data-expand]');

    // Verify second level subtask is visible
    await expect(page.locator('text=Level 2 Subtask')).toBeVisible();

    // Verify indentation indicates hierarchy
    const level1Element = page.locator(`[data-subtask-id="${subtask1.id}"]`);
    const level2Element = page.locator(`[data-subtask-id="${subtask2.id}"]`);

    const level1Indent = await level1Element.evaluate(el =>
      parseInt(window.getComputedStyle(el).paddingLeft));
    const level2Indent = await level2Element.evaluate(el =>
      parseInt(window.getComputedStyle(el).paddingLeft));

    expect(level2Indent).toBeGreaterThan(level1Indent);
  });

  test('TASK status affects parent STORY progress', async ({ page, request }) => {
    // Create a new STORY with multiple TASKs
    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'Story Progress from Tasks',
        description: 'Testing progress calculation',
        code: 'S-TK-02',
        priority: 'medium',
        status: 'doing',
        mvp_flag: false
      }
    });
    const story = await storyResponse.json();

    // Create 4 tasks with different statuses
    const taskStatuses = ['done', 'done', 'doing', 'todo'];
    const taskIds = [];

    for (let i = 0; i < taskStatuses.length; i++) {
      const taskResponse = await request.post(`/api/stories/${story.id}/tasks`, {
        data: {
          title: `Progress Task ${i + 1}`,
          description: `Task with status ${taskStatuses[i]}`,
          status: taskStatuses[i],
          assignee: 'User',
          task_order: i
        }
      });
      const task = await taskResponse.json();
      taskIds.push(task.id);
    }

    // Navigate to STORY
    await page.goto(`/projects/${projectId}/stories/${story.id}`);

    // Verify initial progress (2 done out of 4 = 50%)
    await expect(page.locator('text=50% Complete')).toBeVisible();

    // Change a 'todo' task to 'done'
    await page.click(`text=Progress Task 4`);
    await page.click('button:has-text("Edit")');
    await page.selectOption('select[name="status"]', 'done');
    await page.click('button:has-text("Save")');

    // Navigate back to STORY
    await page.goto(`/projects/${projectId}/stories/${story.id}`);

    // Verify updated progress (3 done out of 4 = 75%)
    await expect(page.locator('text=75% Complete')).toBeVisible();
  });

  test('Delete TASK with cascade to SUBTASKs', async ({ page, request }) => {
    // Create a TASK with SUBTASKs
    const taskResponse = await request.post(`/api/stories/${storyId}/tasks`, {
      data: {
        title: 'Task to Delete',
        description: 'This TASK will be deleted with its SUBTASKs',
        status: 'todo',
        assignee: 'User',
        task_order: 99
      }
    });
    const task = await taskResponse.json();

    // Create SUBTASKs
    const subtaskIds = [];
    for (let i = 1; i <= 3; i++) {
      const subtaskResponse = await request.post(`/api/tasks/${task.id}/subtasks`, {
        data: {
          title: `Subtask to cascade delete ${i}`,
          description: `Subtask ${i} that should be deleted with TASK`,
          status: 'todo',
          assignee: 'User',
          task_order: i - 1
        }
      });
      const subtask = await subtaskResponse.json();
      subtaskIds.push(subtask.id);
    }

    // Navigate to TASK
    await page.goto(`/projects/${projectId}/tasks/${task.id}`);

    // Verify SUBTASKs are visible
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Subtask to cascade delete ${i}`)).toBeVisible();
    }

    // Click Delete button
    await page.click('button:has-text("Delete Task")');

    // Confirm deletion
    await page.click('button:has-text("Confirm Delete")');

    // Verify TASK is gone
    const checkTaskResponse = await request.get(`/api/tasks/${task.id}`);
    expect(checkTaskResponse.status()).toBe(404);

    // Verify SUBTASKs are also gone (CASCADE)
    for (const subtaskId of subtaskIds) {
      const checkSubtaskResponse = await request.get(`/api/tasks/${subtaskId}`);
      expect(checkSubtaskResponse.status()).toBe(404);
    }
  });

  test('TASK drag and drop reordering within STORY', async ({ page, request }) => {
    // Create multiple TASKs
    const tasks = [];
    for (let i = 1; i <= 3; i++) {
      const response = await request.post(`/api/stories/${storyId}/tasks`, {
        data: {
          title: `Draggable Task ${i}`,
          description: `Task ${i} for drag and drop testing`,
          status: 'todo',
          assignee: 'User',
          task_order: i - 1
        }
      });
      tasks.push(await response.json());
    }

    // Navigate to STORY with Kanban view
    await page.goto(`/projects/${projectId}/stories/${storyId}`);
    await page.click('button:has-text("Kanban View")');

    // Locate the TASKs
    const task1 = page.locator(`[data-task-id="${tasks[0].id}"]`);
    const task3 = page.locator(`[data-task-id="${tasks[2].id}"]`);

    // Drag task1 after task3
    await task1.dragTo(task3);

    // Wait for reorder
    await page.waitForTimeout(1000);

    // Verify new order
    const taskCards = page.locator('[data-task-id]');
    const newOrder = [];
    const count = await taskCards.count();

    for (let i = 0; i < count; i++) {
      const id = await taskCards.nth(i).getAttribute('data-task-id');
      if (tasks.some(t => t.id === id)) {
        newOrder.push(id);
      }
    }

    // Verify task3 is now before task1
    const task3Index = newOrder.indexOf(tasks[2].id);
    const task1Index = newOrder.indexOf(tasks[0].id);
    expect(task3Index).toBeLessThan(task1Index);
  });

  test('SUBTASK completion affects parent TASK', async ({ page, request }) => {
    // Create a TASK with multiple SUBTASKs
    const taskResponse = await request.post(`/api/stories/${storyId}/tasks`, {
      data: {
        title: 'Task with Subtask Progress',
        description: 'Testing subtask completion tracking',
        status: 'doing',
        assignee: 'User',
        task_order: 50
      }
    });
    const task = await taskResponse.json();

    // Create 4 subtasks with different statuses
    const subtaskStatuses = ['done', 'done', 'doing', 'todo'];
    for (let i = 0; i < subtaskStatuses.length; i++) {
      await request.post(`/api/tasks/${task.id}/subtasks`, {
        data: {
          title: `Progress Subtask ${i + 1}`,
          description: `Subtask with status ${subtaskStatuses[i]}`,
          status: subtaskStatuses[i],
          assignee: 'User',
          task_order: i
        }
      });
    }

    // Navigate to TASK
    await page.goto(`/projects/${projectId}/tasks/${task.id}`);

    // Verify progress indicator (2 done out of 4 = 50%)
    await expect(page.locator('text=2 of 4 subtasks complete')).toBeVisible();

    // Change a 'todo' subtask to 'done'
    await page.click('text=Progress Subtask 4');
    await page.click('button:has-text("Edit")');
    await page.selectOption('select[name="status"]', 'done');
    await page.click('button:has-text("Save")');

    // Verify updated progress
    await expect(page.locator('text=3 of 4 subtasks complete')).toBeVisible();

    // Complete the last subtask
    await page.click('text=Progress Subtask 3');
    await page.click('button:has-text("Edit")');
    await page.selectOption('select[name="status"]', 'done');
    await page.click('button:has-text("Save")');

    // Verify all complete
    await expect(page.locator('text=All subtasks complete')).toBeVisible();
  });

  test('TASK and SUBTASK assignee filtering', async ({ page }) => {
    // Navigate to project with Tasks view
    await page.goto(`/projects/${projectId}`);
    await page.click('text=Tasks');

    // Test assignee filter for User
    await page.selectOption('select[name="assignee_filter"]', 'User');
    await expect(page.locator('text=Assigned to: User')).toBeVisible();

    // Test assignee filter for Archon
    await page.selectOption('select[name="assignee_filter"]', 'Archon');
    await expect(page.locator('text=Assigned to: Archon')).toBeVisible();

    // Test assignee filter for AI IDE Agent
    await page.selectOption('select[name="assignee_filter"]', 'AI IDE Agent');
    await expect(page.locator('text=Assigned to: AI IDE Agent')).toBeVisible();

    // Clear filter
    await page.selectOption('select[name="assignee_filter"]', '');

    // Verify all tasks are shown
    const taskCount = await page.locator('[data-task-id]').count();
    expect(taskCount).toBeGreaterThan(0);
  });
});