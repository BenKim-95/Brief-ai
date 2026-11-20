import { getDb, hasDatabaseUrl } from "@/db";
import { clientReportSchema } from "@/lib/errors/code";
import { recordError } from "@/lib/errors/store";

/**
 * 웹·앱 화면에서 난 오류를 받는다(로그인·토큰 없이). 오류 코드를 돌려준다.
 * 남이 마구 보내도 같은 원인은 한 줄로 합쳐지고, 서로 다른 코드는 개수 상한이 있다.
 * 다른 사이트에서 보낸 요청은 받지 않는다(Origin이 있는데 이 사이트가 아닐 때).
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === new URL(request.url).host;
    } catch {}
    if (!ok) return Response.json({ error: "허용되지 않는 요청이에요." }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "JSON 형식이 올바르지 않아요." }, { status: 400 });
  }
  const parsed = clientReportSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "보고 내용이 올바르지 않아요." }, { status: 400 });
  if (!hasDatabaseUrl()) return Response.json({ error: "저장할 수 없어요." }, { status: 503 });
  const code = await recordError(getDb(), parsed.data);
  return Response.json({ code }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
