import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseBody } from "@/lib/api";
import { addSubscriber, listSubscribers, MAX_EMAIL_SUBSCRIBERS, removeSubscriberById } from "@/lib/email/subscribers";

const addSchema = z.object({ email: z.email().max(254) });

/** 받는 주소 목록. 수신 해제 토큰은 내려주지 않는다. */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = await listSubscribers(getDb());
  return Response.json({
    max: MAX_EMAIL_SUBSCRIBERS,
    items: rows.map((r) => ({ id: r.id, email: r.email, createdAt: r.createdAt })),
  });
}

/** 받는 주소를 추가한다(같은 주소는 한 번만). */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, addSchema);
  if ("error" in parsed) return parsed.error;
  const result = await addSubscriber(getDb(), parsed.data.email);
  if (result === "limit") {
    return Response.json({ error: `받는 주소는 ${MAX_EMAIL_SUBSCRIBERS}개까지 둘 수 있어요.` }, { status: 409 });
  }
  return Response.json({ added: result === "added" }, { status: result === "added" ? 201 : 200 });
}

const deleteSchema = z.object({ id: z.number().int().positive() });

/** 받는 주소를 지운다(없어도 성공). */
export async function DELETE(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const parsed = await parseBody(request, deleteSchema);
  if ("error" in parsed) return parsed.error;
  await removeSubscriberById(getDb(), parsed.data.id);
  return Response.json({ removed: true });
}
