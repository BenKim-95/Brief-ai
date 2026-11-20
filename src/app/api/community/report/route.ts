import { getDb } from "@/db";
import { parseBody } from "@/lib/api";
import { reportContent } from "@/lib/community/queries";
import { reportSchema } from "@/lib/community/rules";
import { ensureVisitorId } from "@/lib/visitor";

/** 글·댓글 신고. 서로 다른 방문자 3명이 신고하면 자동으로 가려진다. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, reportSchema);
  if ("error" in parsed) return parsed.error;
  const result = await reportContent(getDb(), parsed.data.kind, parsed.data.id, await ensureVisitorId());
  if (result === "missing") return Response.json({ error: "찾을 수 없는 글이에요." }, { status: 404 });
  if (result === "own") return Response.json({ error: "내가 쓴 글은 신고할 수 없어요. 지우기를 이용해 주세요." }, { status: 400 });
  return Response.json({ reported: true });
}
