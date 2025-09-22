/**
 * Test data factory for E2E tests
 */

export interface TestProject {
  id: string;
  title: string;
  description: string;
}

export interface TestEpic {
  id: string;
  project_id: string;
  code: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'waiting' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  mvp_flag: boolean;
}

export interface TestStory {
  id: string;
  epic_id: string;
  code: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'waiting' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  mvp_flag: boolean;
}

export interface TestTask {
  id: string;
  story_id?: string;
  parent_task_id?: string;
  code?: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'waiting' | 'done';
  assignee: 'User' | 'Archon' | 'AI IDE Agent';
  task_order: number;
}

export interface TestDependency {
  from_type: 'epic' | 'story' | 'task';
  from_id: string;
  to_type: 'epic' | 'story' | 'task';
  to_id: string;
  dependency_type: 'blocks' | 'depends_on' | 'related_to' | 'precedes' | 'follows';
}

/**
 * Generate test project
 */
export function generateTestProject(overrides?: Partial<TestProject>): TestProject {
  return {
    id: `test-project-${Date.now()}`,
    title: `Test Project ${Date.now()}`,
    description: 'Test project for E2E testing',
    ...overrides
  };
}

/**
 * Generate test EPIC
 */
export function generateTestEpic(projectId: string, overrides?: Partial<TestEpic>): TestEpic {
  const timestamp = Date.now();
  return {
    id: `test-epic-${timestamp}`,
    project_id: projectId,
    code: `E-${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
    title: `Test Epic ${timestamp}`,
    description: 'Test epic for E2E testing',
    status: 'todo',
    priority: 'medium',
    mvp_flag: false,
    ...overrides
  };
}

/**
 * Generate test STORY
 */
export function generateTestStory(epicId: string, overrides?: Partial<TestStory>): TestStory {
  const timestamp = Date.now();
  const epicCode = overrides?.code?.split('-')[0] || 'E-01';
  return {
    id: `test-story-${timestamp}`,
    epic_id: epicId,
    code: `S-${epicCode.replace('E-', '')}-${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
    title: `Test Story ${timestamp}`,
    description: 'Test story for E2E testing',
    status: 'todo',
    priority: 'medium',
    mvp_flag: false,
    ...overrides
  };
}

/**
 * Generate test TASK
 */
export function generateTestTask(storyId?: string, parentTaskId?: string, overrides?: Partial<TestTask>): TestTask {
  const timestamp = Date.now();
  return {
    id: `test-task-${timestamp}`,
    story_id: storyId,
    parent_task_id: parentTaskId,
    code: storyId ? `T-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}` : undefined,
    title: `Test Task ${timestamp}`,
    description: 'Test task for E2E testing',
    status: 'todo',
    assignee: 'User',
    task_order: Math.floor(Math.random() * 100),
    ...overrides
  };
}

/**
 * Generate test dependency
 */
export function generateTestDependency(overrides?: Partial<TestDependency>): TestDependency {
  return {
    from_type: 'task',
    from_id: `test-task-${Date.now()}`,
    to_type: 'task',
    to_id: `test-task-${Date.now() + 1}`,
    dependency_type: 'blocks',
    ...overrides
  };
}

/**
 * Generate bulk test data
 */
export function generateBulkTestData(counts: {
  epics?: number;
  storiesPerEpic?: number;
  tasksPerStory?: number;
  subtasksPerTask?: number;
}) {
  const {
    epics = 5,
    storiesPerEpic = 3,
    tasksPerStory = 5,
    subtasksPerTask = 2
  } = counts;

  const project = generateTestProject();
  const testEpics: TestEpic[] = [];
  const testStories: TestStory[] = [];
  const testTasks: TestTask[] = [];
  const testSubtasks: TestTask[] = [];

  // Generate EPICs
  for (let e = 0; e < epics; e++) {
    const epic = generateTestEpic(project.id, {
      code: `E-${(e + 1).toString().padStart(2, '0')}`,
      title: `Epic ${e + 1}: ${['Backend', 'Frontend', 'Infrastructure', 'Testing', 'Documentation'][e % 5]}`,
      priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
      mvp_flag: e < 3 // First 3 epics are MVP
    });
    testEpics.push(epic);

    // Generate STORIEs for each EPIC
    for (let s = 0; s < storiesPerEpic; s++) {
      const story = generateTestStory(epic.id, {
        code: `S-${(e + 1).toString().padStart(2, '0')}-${(s + 1).toString().padStart(2, '0')}`,
        title: `Story ${e + 1}.${s + 1}: ${['Feature', 'Bug Fix', 'Enhancement', 'Refactor'][s % 4]}`,
        priority: epic.priority,
        mvp_flag: epic.mvp_flag
      });
      testStories.push(story);

      // Generate TASKs for each STORY
      for (let t = 0; t < tasksPerStory; t++) {
        const task = generateTestTask(story.id, undefined, {
          code: `T-${(e + 1).toString().padStart(2, '0')}-${(s + 1).toString().padStart(2, '0')}-${(t + 1).toString().padStart(2, '0')}`,
          title: `Task ${e + 1}.${s + 1}.${t + 1}: ${['Implement', 'Test', 'Review', 'Document', 'Deploy'][t % 5]}`,
          status: ['todo', 'doing', 'review', 'done'][Math.floor(Math.random() * 4)] as any,
          assignee: ['User', 'Archon', 'AI IDE Agent'][Math.floor(Math.random() * 3)] as any,
          task_order: t
        });
        testTasks.push(task);

        // Generate SUBTASKs for each TASK
        for (let st = 0; st < subtasksPerTask; st++) {
          const subtask = generateTestTask(undefined, task.id, {
            title: `Subtask ${e + 1}.${s + 1}.${t + 1}.${st + 1}`,
            status: task.status,
            assignee: task.assignee,
            task_order: st
          });
          testSubtasks.push(subtask);
        }
      }
    }
  }

  return {
    project,
    epics: testEpics,
    stories: testStories,
    tasks: testTasks,
    subtasks: testSubtasks
  };
}

/**
 * Test data for performance testing
 */
export function generateLargeDataset() {
  return generateBulkTestData({
    epics: 100,
    storiesPerEpic: 5,
    tasksPerStory: 10,
    subtasksPerTask: 5
  });
}

/**
 * Sample hierarchy for testing
 */
export const SAMPLE_HIERARCHY = {
  project: {
    id: 'a37b53ff-e647-44a4-998b-e920582ed376',
    title: 'Archon - TRAXIS',
    description: 'Test project for TRAXIS E2E tests'
  },
  epic: {
    id: 'epic-test-001',
    code: 'E-01',
    title: 'EPIC-1-BDD: Base de Données Hiérarchique',
    status: 'doing' as const,
    priority: 'high' as const,
    mvp_flag: true
  },
  story: {
    id: 'story-test-001',
    code: 'S-01-01',
    title: 'STORY 1.1 - Créer Tables Hiérarchiques',
    status: 'done' as const,
    priority: 'high' as const,
    mvp_flag: true
  },
  task: {
    id: 'task-test-001',
    code: 'T-01-01-01',
    title: 'Create archon_epics table',
    status: 'done' as const,
    assignee: 'AI IDE Agent' as const,
    task_order: 0
  },
  subtask: {
    id: 'subtask-test-001',
    title: 'Define table schema',
    status: 'done' as const,
    assignee: 'AI IDE Agent' as const,
    task_order: 0
  }
};