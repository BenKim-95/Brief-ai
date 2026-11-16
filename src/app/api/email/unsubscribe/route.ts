import { z } from "zod";
import { getDb } from "@/db";
import { parseBody } from "@/lib/api";
import { removeSubscriberByToken } from "@/lib/email/subscribers";

const schema = z.object({ token: z.string().min(10).max(100) });

/**
 * 메일 속 수신 해제 링크에서 부르는 공개 API(로그인이 없는 사람도 쓸 수 있어야 한다).
 * 토큰을 아는 사람만 자기 주소를 지울 수 있다. 토큰이 틀려도 같은 응답을 줘서 추측을 돕지 않는다.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;
  await removeSubscriberByToken(getDb(), parsed.data.token);
  return Response.json({ unsubscribed: true });
}
