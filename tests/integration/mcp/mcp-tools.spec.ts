import { test, expect } from '@playwright/test';

test.describe('MCP Integration Tests', () => {
  let projectId: string;
  let epicId: string;
  let storyId: string;
  let taskId: string;

  test.beforeAll(async ({ request }) => {
    // Create test project and hierarchy
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E MCP Test Project',
        description: 'Test project for MCP integration testing'
      }
    });
    const project = await projectResponse.json();
    projectId = project.id;

    // Create test hierarchy
    const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'MCP Test Epic',
        code: 'E-MCP',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    });
    const epic = await epicResponse.json();
    epicId = epic.id;

    const storyResponse = await request.post(`/api/epics/${epicId}/stories`, {
      data: {
        title: 'MCP Test Story',
        code: 'S-MCP-01',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    });
    const story = await storyResponse.json();
    storyId = story.id;

    const taskResponse = await request.post(`/api/stories/${storyId}/tasks`, {
      data: {
        title: 'MCP Test Task',
        status: 'doing',
        assignee: 'User',
        task_order: 0
      }
    });
    const task = await taskResponse.json();
    taskId = task.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`);
    }
  });

  test('MCP find_epics tool', async ({ request }) => {
    // Test find_epics with project filter
    const response = await request.post('/api/mcp/tools/find_epics', {
      data: {
        project_id: projectId
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.epics).toBeDefined();
    expect(result.epics.length).toBeGreaterThan(0);
    expect(result.epics[0].title).toBe('MCP Test Epic');
    expect(result.epics[0].code).toBe('E-MCP');
  });

  test('MCP find_epics with query filter', async ({ request }) => {
    // Test search functionality
    const response = await request.post('/api/mcp/tools/find_epics', {
      data: {
        project_id: projectId,
        query: 'MCP Test'
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.epics.length).toBe(1);
    expect(result.epics[0].title).toContain('MCP Test');
  });

  test('MCP find_epics with status filter', async ({ request }) => {
    // Create another epic with different status
    await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Completed Epic',
        code: 'E-DONE',
        status: 'done',
        priority: 'low',
        mvp_flag: false
      }
    });

    // Test status filter
    const response = await request.post('/api/mcp/tools/find_epics', {
      data: {
        project_id: projectId,
        filter_by: 'status',
        filter_value: 'doing'
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.epics.length).toBe(1);
    expect(result.epics[0].status).toBe('doing');
  });

  test('MCP manage_epic create operation', async ({ request }) => {
    const response = await request.post('/api/mcp/tools/manage_epic', {
      data: {
        action: 'create',
        project_id: projectId,
        title: 'MCP Created Epic',
        description: 'Epic created via MCP tools',
        code: 'E-MCPC',
        status: 'todo',
        priority: 'medium',
        mvp_flag: true
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.epic).toBeDefined();
    expect(result.epic.title).toBe('MCP Created Epic');
    expect(result.epic.code).toBe('E-MCPC');
    expect(result.epic.mvp_flag).toBe(true);
  });

  test('MCP manage_epic update operation', async ({ request }) => {
    const response = await request.post('/api/mcp/tools/manage_epic', {
      data: {
        action: 'update',
        epic_id: epicId,
        title: 'Updated MCP Epic',
        status: 'review',
        priority: 'critical'
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.epic.title).toBe('Updated MCP Epic');
    expect(result.epic.status).toBe('review');
    expect(result.epic.priority).toBe('critical');
  });

  test('MCP find_stories tool', async ({ request }) => {
    const response = await request.post('/api/mcp/tools/find_stories', {
      data: {
        epic_id: epicId
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.stories).toBeDefined();
    expect(result.stories.length).toBeGreaterThan(0);
    expect(result.stories[0].title).toBe('MCP Test Story');
    expect(result.stories[0].epic_id).toBe(epicId);
  });

  test('MCP manage_story create operation', async ({ request }) => {
    const response = await request.post('/api/mcp/tools/manage_story', {
      data: {
        action: 'create',
        epic_id: epicId,
        title: 'MCP Created Story',
        description: 'Story created via MCP tools',
        code: 'S-MCP-02',
        status: 'todo',
        priority: 'medium',
        mvp_flag: false
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.story).toBeDefined();
    expect(result.story.title).toBe('MCP Created Story');
    expect(result.story.epic_id).toBe(epicId);
    expect(result.story.mvp_flag).toBe(false);
  });

  test('MCP find_tasks tool', async ({ request }) => {
    const response = await request.post('/api/mcp/tools/find_tasks', {
      data: {
        story_id: storyId
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.tasks).toBeDefined();
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks[0].title).toBe('MCP Test Task');
    expect(result.tasks[0].story_id).toBe(storyId);
  });

  test('MCP manage_task operations', async ({ request }) => {
    // Create task via MCP
    const createResponse = await request.post('/api/mcp/tools/manage_task', {
      data: {
        action: 'create',
        story_id: storyId,
        title: 'MCP Created Task',
        description: 'Task created via MCP tools',
        status: 'todo',
        assignee: 'AI IDE Agent',
        task_order: 1
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createResult = await createResponse.json();
    const newTaskId = createResult.task.id;

    // Update task via MCP
    const updateResponse = await request.post('/api/mcp/tools/manage_task', {
      data: {
        action: 'update',
        task_id: newTaskId,
        status: 'doing',
        assignee: 'Archon'
      }
    });

    expect(updateResponse.ok()).toBeTruthy();
    const updateResult = await updateResponse.json();

    expect(updateResult.success).toBe(true);
    expect(updateResult.task.status).toBe('doing');
    expect(updateResult.task.assignee).toBe('Archon');
  });

  test('MCP find_subtasks tool', async ({ request }) => {
    // First create a subtask
    const subtaskResponse = await request.post(`/api/tasks/${taskId}/subtasks`, {
      data: {
        title: 'MCP Test Subtask',
        description: 'Subtask for MCP testing',
        status: 'todo',
        assignee: 'User',
        task_order: 0
      }
    });
    const subtask = await subtaskResponse.json();

    // Test MCP tool
    const response = await request.post('/api/mcp/tools/find_subtasks', {
      data: {
        parent_task_id: taskId
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.subtasks).toBeDefined();
    expect(result.subtasks.length).toBeGreaterThan(0);
    expect(result.subtasks[0].title).toBe('MCP Test Subtask');
    expect(result.subtasks[0].parent_task_id).toBe(taskId);
  });

  test('MCP get_hierarchy tool', async ({ request }) => {
    const response = await request.post('/api/mcp/tools/get_hierarchy', {
      data: {
        entry_point: 'project',
        entry_id: projectId,
        depth: 3
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.hierarchy).toBeDefined();
    expect(result.hierarchy.type).toBe('project');
    expect(result.hierarchy.id).toBe(projectId);
    expect(result.hierarchy.children).toBeDefined();
    expect(result.hierarchy.children.length).toBeGreaterThan(0);

    // Verify epic is in hierarchy
    const epic = result.hierarchy.children.find((c: any) => c.type === 'epic');
    expect(epic).toBeDefined();
    expect(epic.title).toBe('Updated MCP Epic'); // From previous update test

    // Verify story is under epic
    expect(epic.children).toBeDefined();
    const story = epic.children.find((c: any) => c.type === 'story');
    expect(story).toBeDefined();
    expect(story.title).toBe('MCP Test Story');
  });

  test('MCP get_hierarchy with depth limit', async ({ request }) => {
    const response = await request.post('/api/mcp/tools/get_hierarchy', {
      data: {
        entry_point: 'epic',
        entry_id: epicId,
        depth: 1
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.hierarchy.type).toBe('epic');

    // Should include stories (depth 1) but not tasks (depth 2)
    const stories = result.hierarchy.children.filter((c: any) => c.type === 'story');
    expect(stories.length).toBeGreaterThan(0);

    // Check that tasks are not included (beyond depth 1)
    const tasksInStories = stories.some((s: any) =>
      s.children && s.children.some((c: any) => c.type === 'task')
    );
    expect(tasksInStories).toBe(false);
  });

  test('MCP manage_dependencies tool', async ({ request }) => {
    // Create another task for dependency testing
    const task2Response = await request.post(`/api/stories/${storyId}/tasks`, {
      data: {
        title: 'Dependent Task',
        status: 'todo',
        assignee: 'User',
        task_order: 2
      }
    });
    const task2 = await task2Response.json();

    // Create dependency via MCP
    const createResponse = await request.post('/api/mcp/tools/manage_dependencies', {
      data: {
        action: 'create',
        from_type: 'task',
        from_id: taskId,
        to_type: 'task',
        to_id: task2.id,
        dependency_type: 'blocks'
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createResult = await createResponse.json();

    expect(createResult.success).toBe(true);
    expect(createResult.dependency).toBeDefined();
    expect(createResult.dependency.from_id).toBe(taskId);
    expect(createResult.dependency.to_id).toBe(task2.id);
    expect(createResult.dependency.dependency_type).toBe('blocks');

    // Query dependencies via MCP
    const queryResponse = await request.post('/api/mcp/tools/manage_dependencies', {
      data: {
        action: 'query',
        from_type: 'task',
        from_id: taskId
      }
    });

    expect(queryResponse.ok()).toBeTruthy();
    const queryResult = await queryResponse.json();

    expect(queryResult.success).toBe(true);
    expect(queryResult.dependencies).toBeDefined();
    expect(queryResult.dependencies.length).toBe(1);
    expect(queryResult.dependencies[0].to_id).toBe(task2.id);
  });

  test('MCP dependency cycle detection', async ({ request }) => {
    // Create three tasks for cycle testing
    const tasksData = [
      { title: 'Cycle Task A' },
      { title: 'Cycle Task B' },
      { title: 'Cycle Task C' }
    ];

    const tasks = [];
    for (const taskData of tasksData) {
      const response = await request.post(`/api/stories/${storyId}/tasks`, {
        data: {
          ...taskData,
          status: 'todo',
          assignee: 'User',
          task_order: tasks.length
        }
      });
      tasks.push(await response.json());
    }

    // Create chain: A → B → C
    await request.post('/api/mcp/tools/manage_dependencies', {
      data: {
        action: 'create',
        from_type: 'task',
        from_id: tasks[0].id,
        to_type: 'task',
        to_id: tasks[1].id,
        dependency_type: 'blocks'
      }
    });

    await request.post('/api/mcp/tools/manage_dependencies', {
      data: {
        action: 'create',
        from_type: 'task',
        from_id: tasks[1].id,
        to_type: 'task',
        to_id: tasks[2].id,
        dependency_type: 'blocks'
      }
    });

    // Try to create cycle: C → A (should fail)
    const cycleResponse = await request.post('/api/mcp/tools/manage_dependencies', {
      data: {
        action: 'create',
        from_type: 'task',
        from_id: tasks[2].id,
        to_type: 'task',
        to_id: tasks[0].id,
        dependency_type: 'blocks'
      }
    });

    expect(cycleResponse.ok()).toBeTruthy();
    const cycleResult = await cycleResponse.json();

    expect(cycleResult.success).toBe(false);
    expect(cycleResult.error).toContain('cycle');
  });

  test('MCP tool pagination', async ({ request }) => {
    // Create multiple epics for pagination testing
    for (let i = 1; i <= 15; i++) {
      await request.post(`/api/projects/${projectId}/epics`, {
        data: {
          title: `Pagination Epic ${i}`,
          code: `E-PAG${i.toString().padStart(2, '0')}`,
          status: 'todo',
          priority: 'low',
          mvp_flag: false
        }
      });
    }

    // Test first page
    const page1Response = await request.post('/api/mcp/tools/find_epics', {
      data: {
        project_id: projectId,
        page: 1,
        per_page: 10
      }
    });

    expect(page1Response.ok()).toBeTruthy();
    const page1Result = await page1Response.json();

    expect(page1Result.success).toBe(true);
    expect(page1Result.epics.length).toBe(10);
    expect(page1Result.total_count).toBeGreaterThan(15);
    expect(page1Result.page).toBe(1);

    // Test second page
    const page2Response = await request.post('/api/mcp/tools/find_epics', {
      data: {
        project_id: projectId,
        page: 2,
        per_page: 10
      }
    });

    expect(page2Response.ok()).toBeTruthy();
    const page2Result = await page2Response.json();

    expect(page2Result.success).toBe(true);
    expect(page2Result.epics.length).toBeGreaterThan(0);
    expect(page2Result.page).toBe(2);

    // Verify different items on different pages
    const page1Ids = page1Result.epics.map((e: any) => e.id);
    const page2Ids = page2Result.epics.map((e: any) => e.id);
    const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(intersection.length).toBe(0); // No overlap
  });

  test('MCP error handling', async ({ request }) => {
    // Test with invalid project ID
    const invalidResponse = await request.post('/api/mcp/tools/find_epics', {
      data: {
        project_id: 'invalid-uuid'
      }
    });

    expect(invalidResponse.ok()).toBeTruthy();
    const invalidResult = await invalidResponse.json();

    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBeDefined();

    // Test with missing required parameters
    const missingResponse = await request.post('/api/mcp/tools/manage_epic', {
      data: {
        action: 'create'
        // Missing project_id and title
      }
    });

    expect(missingResponse.status()).toBe(400);

    // Test with invalid action
    const invalidActionResponse = await request.post('/api/mcp/tools/manage_epic', {
      data: {
        action: 'invalid_action',
        epic_id: epicId
      }
    });

    expect(invalidActionResponse.ok()).toBeTruthy();
    const invalidActionResult = await invalidActionResponse.json();

    expect(invalidActionResult.success).toBe(false);
    expect(invalidActionResult.error).toContain('Invalid action');
  });
});