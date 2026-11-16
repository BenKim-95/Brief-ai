import type { Metadata } from "next";

export const metadata: Metadata = { title: "오프라인 - 브리프" };

// 서비스 워커가 인터넷이 끊겼을 때 대신 보여주는 화면
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-xl font-bold">인터넷에 연결되어 있지 않아요</h1>
      <p className="text-sm text-muted-foreground">
        연결이 돌아오면 최신 뉴스와 청약 소식을 보여드릴게요. 잠시 후 다시 열어 주세요.
      </p>
    </main>
  );
}
