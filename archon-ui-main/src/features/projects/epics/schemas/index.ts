import { z } from "zod";

// Base validation schemas
export const HierarchyStatusSchema = z.enum(["todo", "doing", "review", "waiting", "done"]);
export const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);

// Epic schemas
export const CreateEpicSchema = z.object({
  project_id: z.string().uuid("Project ID must be a valid UUID"),
  title: z.string().min(1, "Epic title is required").max(255, "Epic title must be less than 255 characters"),
  description: z.string().max(10000, "Epic description must be less than 10000 characters").default(""),
  priority: PrioritySchema.default("medium"),
  mvp_flag: z.boolean().default(false),
});

export const UpdateEpicSchema = CreateEpicSchema.partial().omit({
  project_id: true,
}).extend({
  status: HierarchyStatusSchema.optional(),
});

export const EpicSchema = z.object({
  id: z.string().uuid("Epic ID must be a valid UUID"),
  project_id: z.string().uuid("Project ID must be a valid UUID"),
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

// Query schemas
export const EpicQuerySchema = z.object({
  search: z.string().optional(),
  status: HierarchyStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  mvp_only: z.boolean().optional(),
  include_archived: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export const EpicFiltersSchema = z.object({
  status: z.array(HierarchyStatusSchema).optional(),
  priority: z.array(PrioritySchema).optional(),
  mvp_only: z.boolean().optional(),
  has_stories: z.boolean().optional(),
  completion_rate_min: z.number().min(0).max(100).optional(),
  completion_rate_max: z.number().min(0).max(100).optional(),
});

export const EpicSortSchema = z.object({
  field: z.enum(["title", "created_at", "updated_at", "priority", "progress", "status"]),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

// Validation helper functions
export function validateEpic(data: unknown) {
  return EpicSchema.safeParse(data);
}

export function validateCreateEpic(data: unknown) {
  return CreateEpicSchema.safeParse(data);
}

export function validateUpdateEpic(data: unknown) {
  return UpdateEpicSchema.safeParse(data);
}

export function validateEpicQuery(data: unknown) {
  return EpicQuerySchema.safeParse(data);
}

export function validateEpicFilters(data: unknown) {
  return EpicFiltersSchema.safeParse(data);
}

export function validateEpicSort(data: unknown) {
  return EpicSortSchema.safeParse(data);
}

// Export type inference helpers
export type CreateEpicInput = z.infer<typeof CreateEpicSchema>;
export type UpdateEpicInput = z.infer<typeof UpdateEpicSchema>;
export type EpicInput = z.infer<typeof EpicSchema>;
export type EpicQueryInput = z.infer<typeof EpicQuerySchema>;
export type EpicFiltersInput = z.infer<typeof EpicFiltersSchema>;
export type EpicSortInput = z.infer<typeof EpicSortSchema>;