import type { Instrumentation } from "next";

/**
 * 서버에서 난 오류(화면을 만들다, API를 처리하다)를 관리자 오류 화면(/admin/errors)에 기록한다.
 * 기록 실패는 삼켜서 오류 기록이 또 다른 오류를 만들지 않게 한다.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getDb, hasDatabaseUrl } = await import("@/db");
    if (!hasDatabaseUrl()) return;
    const { recordError } = await import("@/lib/errors/store");
    const e = err as { message?: unknown; stack?: unknown } | null;
    await recordError(getDb(), {
      source: "server",
      message: typeof e?.message === "string" && e.message ? e.message : String(err),
      stack: typeof e?.stack === "string" ? e.stack : null,
      // 실제 주소(/articles/7)가 아니라 라우트 모양(/articles/[id])을 쓴다.
      path: context.routePath || request.path,
    });
  } catch {
    // 무시
  }
};
