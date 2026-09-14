import { z } from "zod";

export const createProcessSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  level: z.enum(["L1_MACRO", "L2_SUBPROCESS", "L3_ACTIVITY", "L4_TASK"]),
  parent_id: z.string().nullable().optional(),
  location_id: z.string().nullable().optional(),
  asset_id: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  sort_order: z.number().int().optional(),
});

export const updateProcessSchema = createProcessSchema.partial();
