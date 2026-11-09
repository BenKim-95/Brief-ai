import { z } from "zod";

const httpUrl = z
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "http(s) 주소만 쓸 수 있어요.");

export const sourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: httpUrl,
  language: z.string().trim().min(2).max(10).default("en"),
  active: z.boolean().default(true),
});

// Partial of a schema with defaults would re-apply defaults, so build the
// update schema from optional fields explicitly.
export const sourceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  url: httpUrl.optional(),
  language: z.string().trim().min(2).max(10).optional(),
  active: z.boolean().optional(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).default(""),
});

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(500).optional(),
});

export const categoryReorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export const idParamSchema = z.coerce.number().int().positive();
