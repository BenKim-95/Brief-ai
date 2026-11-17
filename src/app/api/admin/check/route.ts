import { requireAdmin } from "@/lib/admin-auth";

/** 관리 토큰이 맞는지만 알려 준다(맞으면 200, 아니면 401/503). 화면에서 관리자 전용 버튼을 보여줄지 정할 때 쓴다. */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return Response.json({ admin: true }, { headers: { "Cache-Control": "no-store" } });
}
