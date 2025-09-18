import { z } from "zod";

// Base validation schemas
export const HierarchyStatusSchema = z.enum(["todo", "doing", "review", "waiting", "done"]);
export const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const AssigneeSchema = z.enum(["User", "Archon", "AI IDE Agent"]);

// Story schemas
export const CreateStorySchema = z.object({
  epic_id: z.string().uuid("Epic ID must be a valid UUID"),
  title: z.string().min(1, "Story title is required").max(255, "Story title must be less than 255 characters"),
  description: z.string().max(10000, "Story description must be less than 10000 characters").default(""),
  priority: PrioritySchema.default("medium"),
  mvp_flag: z.boolean().default(false),
  assignee: AssigneeSchema.optional(),
});

export const UpdateStorySchema = CreateStorySchema.partial().extend({
  status: HierarchyStatusSchema.optional(),
});

export const StorySchema = z.object({
  id: z.string().uuid("Story ID must be a valid UUID"),
  epic_id: z.string().uuid("Epic ID must be a valid UUID"),
  title: z.string().min(1),
  description: z.string(),
  status: HierarchyStatusSchema,
  priority: PrioritySchema,
  mvp_flag: z.boolean(),
  progress: z.number().min(0).max(100).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),

  // Soft delete fields
  archived: z.boolean().optional(),
  archived_at: z.string().datetime().optional(),
  archived_by: z.string().optional(),
});

// Story with Epic context schema
export const StoryWithEpicSchema = StorySchema.extend({
  epic: z.object({
    id: z.string().uuid(),
    title: z.string(),
    project_id: z.string().uuid(),
  }),
});

// Query schemas
export const StoryQuerySchema = z.object({
  search: z.string().optional(),
  status: HierarchyStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  mvp_only: z.boolean().optional(),
  epic_id: z.string().uuid().optional(),
  include_archived: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export const StoryFiltersSchema = z.object({
  status: z.array(HierarchyStatusSchema).optional(),
  priority: z.array(PrioritySchema).optional(),
  mvp_only: z.boolean().optional(),
  has_tasks: z.boolean().optional(),
  completion_rate_min: z.number().min(0).max(100).optional(),
  completion_rate_max: z.number().min(0).max(100).optional(),
  epic_id: z.string().uuid().optional(),
});

export const StorySortSchema = z.object({
  field: z.enum(["title", "created_at", "updated_at", "priority", "progress", "status"]),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const MoveStorySchema = z.object({
  story_id: z.string().uuid("Story ID must be a valid UUID"),
  from_epic_id: z.string().uuid("From Epic ID must be a valid UUID"),
  to_epic_id: z.string().uuid("To Epic ID must be a valid UUID"),
});

// Validation helper functions
export function validateStory(data: unknown) {
  return StorySchema.safeParse(data);
}

export function validateCreateStory(data: unknown) {
  return CreateStorySchema.safeParse(data);
}

export function validateUpdateStory(data: unknown) {
  return UpdateStorySchema.safeParse(data);
}

export function validateStoryWithEpic(data: unknown) {
  return StoryWithEpicSchema.safeParse(data);
}

export function validateStoryQuery(data: unknown) {
  return StoryQuerySchema.safeParse(data);
}

export function validateStoryFilters(data: unknown) {
  return StoryFiltersSchema.safeParse(data);
}

export function validateStorySort(data: unknown) {
  return StorySortSchema.safeParse(data);
}

export function validateMoveStory(data: unknown) {
  return MoveStorySchema.safeParse(data);
}

// Export type inference helpers
export type CreateStoryInput = z.infer<typeof CreateStorySchema>;
export type UpdateStoryInput = z.infer<typeof UpdateStorySchema>;
export type StoryInput = z.infer<typeof StorySchema>;
export type StoryWithEpicInput = z.infer<typeof StoryWithEpicSchema>;
export type StoryQueryInput = z.infer<typeof StoryQuerySchema>;
export type StoryFiltersInput = z.infer<typeof StoryFiltersSchema>;
export type StorySortInput = z.infer<typeof StorySortSchema>;
export type MoveStoryInput = z.infer<typeof MoveStorySchema>;
