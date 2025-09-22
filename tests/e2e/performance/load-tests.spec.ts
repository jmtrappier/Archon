import { test, expect } from '@playwright/test';
import { generateBulkTestData, generateLargeDataset } from '../../fixtures/test-data';

test.describe('Performance and Load Tests', () => {
  let projectId: string;
  let startTime: number;
  let createdEpics: any[] = [];
  let createdStories: any[] = [];
  let createdTasks: any[] = [];

  test.beforeAll(async ({ request }) => {
    // Create test project for performance testing
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Performance Test Project',
        description: 'Large-scale performance testing'
      }
    });
    const project = await projectResponse.json();
    projectId = project.id;
  });

  test.afterAll(async ({ request }) => {
    console.log('🧹 Cleaning up performance test data...');

    // Clean up individual items first (in reverse order)
    // 1. Delete all TASKs
    for (const task of createdTasks) {
      try {
        await request.delete(`/api/tasks/${task.id}`);
      } catch (error) {
        console.warn(`Failed to delete task ${task.id}:`, error);
      }
    }

    // 2. Delete all STORIEs
    for (const story of createdStories) {
      try {
        await request.delete(`/api/stories/${story.id}`);
      } catch (error) {
        console.warn(`Failed to delete story ${story.id}:`, error);
      }
    }

    // 3. Delete all EPICs
    for (const epic of createdEpics) {
      try {
        await request.delete(`/api/epics/${epic.id}`);
      } catch (error) {
        console.warn(`Failed to delete epic ${epic.id}:`, error);
      }
    }

    // 4. Finally delete the project
    if (projectId) {
      try {
        await request.delete(`/api/projects/${projectId}`, {
          timeout: 60000 // 1 minute timeout for cleanup
        });
        console.log('✅ Performance test cleanup completed');
      } catch (error) {
        console.error('❌ Failed to delete test project:', error);
      }
    }
  });

  test('Load test with 100 EPICs', async ({ request }) => {
    const epics = [];
    startTime = Date.now();

    // Create 100 EPICs
    for (let i = 1; i <= 100; i++) {
      const response = await request.post(`/api/projects/${projectId}/epics`, {
        data: {
          title: `Performance Test Epic ${i}`,
          code: `E-P${i.toString().padStart(3, '0')}`,
          description: `Epic ${i} for performance testing`,
          status: ['todo', 'doing', 'review', 'done'][i % 4],
          priority: ['low', 'medium', 'high', 'critical'][i % 4],
          mvp_flag: i <= 50 // First 50 are MVP
        }
      });

      if (!response.ok()) {
        console.error(`Failed to create EPIC ${i}`);
      } else {
        const epic = await response.json();
        epics.push(epic);
        createdEpics.push(epic); // Store for cleanup
      }
    }

    const creationTime = Date.now() - startTime;
    console.log(`Created 100 EPICs in ${creationTime}ms`);
    expect(creationTime).toBeLessThan(30000); // Should complete within 30 seconds

    // Test loading all EPICs
    startTime = Date.now();
    const listResponse = await request.get(`/api/projects/${projectId}/epics`);
    const loadTime = Date.now() - startTime;

    expect(listResponse.ok()).toBeTruthy();
    const epicList = await listResponse.json();
    expect(epicList.length).toBeGreaterThanOrEqual(100);
    expect(loadTime).toBeLessThan(2000); // List should load within 2 seconds
  });

  test('Load test with 500 STORIEs', async ({ request }) => {
    // First create 10 EPICs to distribute stories
    const epics = [];
    for (let i = 1; i <= 10; i++) {
      const response = await request.post(`/api/projects/${projectId}/epics`, {
        data: {
          title: `Story Container Epic ${i}`,
          code: `E-SC${i}`,
          status: 'doing',
          priority: 'high',
          mvp_flag: true
        }
      });
      const epic = await response.json();
      epics.push(epic);
      createdEpics.push(epic); // Store for cleanup
    }

    // Create 500 STORIEs (50 per EPIC)
    startTime = Date.now();
    const stories = [];

    for (const epic of epics) {
      for (let s = 1; s <= 50; s++) {
        const response = await request.post(`/api/epics/${epic.id}/stories`, {
          data: {
            title: `Performance Story ${s}`,
            code: `S-${epic.code.replace('E-', '')}-${s.toString().padStart(2, '0')}`,
            description: `Story ${s} under ${epic.title}`,
            status: ['todo', 'doing', 'review', 'done'][s % 4],
            priority: ['low', 'medium', 'high', 'critical'][s % 4],
            mvp_flag: s <= 25
          }
        });

        if (response.ok()) {
          const story = await response.json();
          stories.push(story);
          createdStories.push(story); // Store for cleanup
        }
      }
    }

    const creationTime = Date.now() - startTime;
    console.log(`Created 500 STORIEs in ${creationTime}ms`);
    expect(creationTime).toBeLessThan(60000); // Should complete within 1 minute

    // Test loading stories with pagination
    startTime = Date.now();
    const listResponse = await request.get(`/api/projects/${projectId}/stories?page=1&per_page=50`);
    const loadTime = Date.now() - startTime;

    expect(listResponse.ok()).toBeTruthy();
    expect(loadTime).toBeLessThan(1000); // Paginated load should be < 1 second
  });

  test('Load test with 1000 TASKs', async ({ request }) => {
    // Create a few stories to hold tasks
    const stories = [];
    for (let i = 1; i <= 20; i++) {
      const epicResponse = await request.post(`/api/projects/${projectId}/epics`, {
        data: {
          title: `Task Container Epic ${i}`,
          code: `E-TC${i}`,
          status: 'doing',
          priority: 'high',
          mvp_flag: true
        }
      });
      const epic = await epicResponse.json();
      createdEpics.push(epic); // Store for cleanup

      const storyResponse = await request.post(`/api/epics/${epic.id}/stories`, {
        data: {
          title: `Task Container Story ${i}`,
          code: `S-TC-${i}`,
          status: 'doing',
          priority: 'high',
          mvp_flag: true
        }
      });
      const story = await storyResponse.json();
      stories.push(story);
      createdStories.push(story); // Store for cleanup
    }

    // Create 1000 TASKs (50 per story)
    startTime = Date.now();
    const tasks = [];

    for (const story of stories) {
      const taskPromises = [];
      for (let t = 1; t <= 50; t++) {
        taskPromises.push(
          request.post(`/api/stories/${story.id}/tasks`, {
            data: {
              title: `Performance Task ${t}`,
              description: `Task ${t} for load testing`,
              status: ['todo', 'doing', 'review', 'done'][t % 4],
              assignee: ['User', 'Archon', 'AI IDE Agent'][t % 3],
              task_order: t - 1
            }
          })
        );
      }

      // Batch create for better performance
      const responses = await Promise.all(taskPromises);
      for (const response of responses) {
        if (response.ok()) {
          const task = await response.json();
          tasks.push(task);
          createdTasks.push(task); // Store for cleanup
        }
      }
    }

    const creationTime = Date.now() - startTime;
    console.log(`Created 1000 TASKs in ${creationTime}ms`);
    expect(creationTime).toBeLessThan(90000); // Should complete within 1.5 minutes
  });

  test('UI performance with large dataset', async ({ page }) => {
    // Navigate to project with all the data
    startTime = Date.now();
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');

    const pageLoadTime = Date.now() - startTime;
    console.log(`Page load time with large dataset: ${pageLoadTime}ms`);
    expect(pageLoadTime).toBeLessThan(5000); // Page should load within 5 seconds

    // Test switching between views
    startTime = Date.now();
    await page.click('text=EPICs');
    await page.waitForLoadState('networkidle');

    const epicViewLoadTime = Date.now() - startTime;
    expect(epicViewLoadTime).toBeLessThan(2000); // View switch < 2 seconds

    // Test filtering performance
    startTime = Date.now();
    await page.fill('input[placeholder="Search epics..."]', 'Performance Test');
    await page.waitForTimeout(500); // Wait for debounce

    const filterTime = Date.now() - startTime;
    expect(filterTime).toBeLessThan(1000); // Filter should be responsive

    // Verify filtered results appear
    await expect(page.locator('[data-epic-id]')).toBeVisible();
  });

  test('Pagination performance', async ({ page }) => {
    // Navigate to tasks view with pagination
    await page.goto(`/projects/${projectId}/tasks?page=1&per_page=20`);

    // Measure time to load first page
    startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const firstPageTime = Date.now() - startTime;

    expect(firstPageTime).toBeLessThan(2000); // First page < 2 seconds

    // Navigate to next page
    startTime = Date.now();
    await page.click('button[aria-label="Next page"]');
    await page.waitForLoadState('networkidle');
    const nextPageTime = Date.now() - startTime;

    expect(nextPageTime).toBeLessThan(1000); // Pagination < 1 second

    // Jump to last page
    startTime = Date.now();
    await page.click('button[aria-label="Last page"]');
    await page.waitForLoadState('networkidle');
    const lastPageTime = Date.now() - startTime;

    expect(lastPageTime).toBeLessThan(1000); // Jump to last < 1 second
  });

  test('ETag caching performance', async ({ page, request }) => {
    // First request - no cache
    const response1 = await request.get(`/api/projects/${projectId}/epics`);
    const etag = response1.headers()['etag'];
    expect(etag).toBeDefined();

    // Second request with If-None-Match
    const response2 = await request.get(`/api/projects/${projectId}/epics`, {
      headers: {
        'If-None-Match': etag
      }
    });

    // Should return 304 Not Modified
    expect(response2.status()).toBe(304);

    // Test UI caching
    await page.goto(`/projects/${projectId}/epics`);

    // Get network requests
    const requests: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        requests.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Navigate away and back
    await page.click('text=Stories');
    await page.click('text=EPICs');

    // Check for 304 responses
    const cachedRequests = requests.filter(r => r.status === 304);
    expect(cachedRequests.length).toBeGreaterThan(0); // Should have cached responses
  });

  test('Search performance with large dataset', async ({ page }) => {
    // Navigate to project
    await page.goto(`/projects/${projectId}`);

    // Test search across all levels
    startTime = Date.now();
    await page.fill('input[placeholder="Search all..."]', 'Performance');
    await page.waitForTimeout(300); // Debounce

    const searchTime = Date.now() - startTime;
    expect(searchTime).toBeLessThan(1000); // Search should be < 1 second

    // Verify results appear
    await expect(page.locator('[data-search-result]').first()).toBeVisible();

    // Test search with complex query
    startTime = Date.now();
    await page.fill('input[placeholder="Search all..."]', 'Performance Test Epic 5*');
    await page.waitForTimeout(300); // Debounce

    const complexSearchTime = Date.now() - startTime;
    expect(complexSearchTime).toBeLessThan(1500); // Complex search < 1.5 seconds
  });

  test('Drag and drop performance', async ({ page }) => {
    // Navigate to Kanban view
    await page.goto(`/projects/${projectId}`);
    await page.click('text=Tasks');
    await page.click('button:has-text("Kanban View")');

    // Wait for all items to load
    await page.waitForLoadState('networkidle');

    // Measure drag and drop operation
    const sourceTask = page.locator('[data-task-id]').first();
    const targetColumn = page.locator('[data-column="doing"]');

    startTime = Date.now();
    await sourceTask.dragTo(targetColumn);
    const dragDropTime = Date.now() - startTime;

    expect(dragDropTime).toBeLessThan(500); // Drag & drop should be smooth < 500ms

    // Verify the move was successful
    await expect(targetColumn.locator('[data-task-id]')).toBeVisible();
  });

  test('Tree view performance with deep hierarchy', async ({ page, request }) => {
    // Create deep hierarchy for testing
    const epic = await request.post(`/api/projects/${projectId}/epics`, {
      data: {
        title: 'Deep Hierarchy Epic',
        code: 'E-DEEP',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    }).then(r => r.json());

    const story = await request.post(`/api/epics/${epic.id}/stories`, {
      data: {
        title: 'Deep Hierarchy Story',
        code: 'S-DEEP-01',
        status: 'doing',
        priority: 'high',
        mvp_flag: true
      }
    }).then(r => r.json());

    const task = await request.post(`/api/stories/${story.id}/tasks`, {
      data: {
        title: 'Deep Hierarchy Task',
        status: 'doing',
        assignee: 'User',
        task_order: 0
      }
    }).then(r => r.json());

    // Create 10 levels of subtasks
    let parentId = task.id;
    for (let i = 1; i <= 10; i++) {
      const subtask = await request.post(`/api/tasks/${parentId}/subtasks`, {
        data: {
          title: `Level ${i} Subtask`,
          status: 'todo',
          assignee: 'User',
          task_order: 0
        }
      }).then(r => r.json());
      parentId = subtask.id;
    }

    // Navigate to tree view
    startTime = Date.now();
    await page.goto(`/projects/${projectId}/tree`);
    await page.waitForLoadState('networkidle');

    const treeLoadTime = Date.now() - startTime;
    expect(treeLoadTime).toBeLessThan(3000); // Tree view should load < 3 seconds

    // Expand all nodes
    startTime = Date.now();
    await page.click('button:has-text("Expand All")');
    await page.waitForTimeout(500); // Wait for animation

    const expandTime = Date.now() - startTime;
    expect(expandTime).toBeLessThan(1000); // Expand all < 1 second

    // Verify deep hierarchy is visible
    await expect(page.locator('text=Level 10 Subtask')).toBeVisible();
  });

  test('Memory usage monitoring', async ({ page }) => {
    // Navigate to project
    await page.goto(`/projects/${projectId}`);

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Navigate through different views
    await page.click('text=EPICs');
    await page.waitForLoadState('networkidle');
    await page.click('text=Stories');
    await page.waitForLoadState('networkidle');
    await page.click('text=Tasks');
    await page.waitForLoadState('networkidle');

    // Scroll through large list
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000);

    // Get memory after navigation
    const afterNavigationMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory increase should be reasonable (less than 50MB)
    const memoryIncrease = afterNavigationMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB

    // Force garbage collection if available
    await page.evaluate(() => {
      if ('gc' in window) {
        (window as any).gc();
      }
    });

    // Check for memory leaks after GC
    const afterGCMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory should decrease after GC
    expect(afterGCMemory).toBeLessThan(afterNavigationMemory);
  });

  test('API response time percentiles', async ({ request }) => {
    const responseTimes: number[] = [];

    // Make 100 requests to measure response times
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await request.get(`/api/projects/${projectId}/tasks?page=${(i % 10) + 1}&per_page=20`);
      responseTimes.push(Date.now() - start);
    }

    // Sort response times
    responseTimes.sort((a, b) => a - b);

    // Calculate percentiles
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];

    console.log(`Response time percentiles: P50=${p50}ms, P95=${p95}ms, P99=${p99}ms`);

    // Assert on percentiles
    expect(p50).toBeLessThan(100); // Median < 100ms
    expect(p95).toBeLessThan(200); // 95th percentile < 200ms
    expect(p99).toBeLessThan(500); // 99th percentile < 500ms
  });
});