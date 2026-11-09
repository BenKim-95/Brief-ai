import type { ZodType } from "zod";
import { idParamSchema } from "./schemas";

export function badRequest(message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status: 400 });
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { error: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { error: badRequest("JSON 형식이 올바르지 않아요.") };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      error: badRequest("입력값이 올바르지 않아요.", result.error.issues),
    };
  }
  return { data: result.data };
}

export async function parseId(
  params: Promise<{ id: string }>,
): Promise<{ id: number } | { error: Response }> {
  const result = idParamSchema.safeParse((await params).id);
  if (!result.success) return { error: badRequest("id가 올바르지 않아요.") };
  return { id: result.data };
}

/** Postgres unique violation (23505), including when wrapped in a cause. */
export function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 3 && cur; i++) {
    if (typeof cur === "object" && (cur as { code?: string }).code === "23505")
      return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
