"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminApi } from "../admin-api";
import {
  ERROR_SOURCES,
  SOURCE_LABEL,
  STATUSES,
  STATUS_LABEL,
  type ErrorSource,
  type ErrorStatus,
} from "@/lib/errors/code";

type Item = {
  id: number;
  code: string;
  source: ErrorSource;
  message: string;
  stack: string | null;
  path: string | null;
  userAgent: string | null;
  count: number;
  status: ErrorStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};
type Payload = {
  items: Item[];
  summary: { open: number; last24h: Record<ErrorSource, number> };
  health: {
    db: { ok: boolean; error?: string };
    env: { name: string; label: string; needed: string; set: boolean }[];
    latestArticleAt: string | null;
    latestNoticeAt: string | null;
    issues: string[];
  };
};

function ago(iso: string | null): string {
  if (!iso) return "없음";
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const chip = (on: boolean) =>
  `inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${on ? "border-foreground bg-foreground text-background" : ""}`;

/** 배포한 뒤 웹·앱·서버에서 난 오류 코드와 서버 상태를 한곳에서 본다. */
export default function AdminErrorsPage() {
  const { token, call } = useAdminApi();
  const [status, setStatus] = useState<ErrorStatus | "">("open");
  const [source, setSource] = useState<ErrorSource | "">("");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (source) q.set("source", source);
    try {
      setData(await call<Payload>(`/api/admin/errors?${q}`, { busyLabel: "불러오는 중이에요…" }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, status, source]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 토큰이 있고 필터가 바뀔 때마다 불러온다
    if (token) void load();
  }, [token, load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = data?.summary;
  const h = data?.health;
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">오류 코드·이슈 현황</h2>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          ⚠ {error}
        </p>
      )}

      {s && h && (
        <div className="mb-6 grid gap-3">
          <div className="rounded-lg border p-3" aria-label="요약">
            <p className="text-sm">
              처리 전 오류 <b data-open-count>{s.open}</b>종 · 최근 24시간에 난 오류 종류: 웹 <b>{s.last24h.web}</b> · 앱{" "}
              <b>{s.last24h.app}</b> · 서버 <b>{s.last24h.server}</b>
            </p>
          </div>
          <div className="rounded-lg border p-3" aria-label="서버 점검">
            <p className="mb-1 text-sm font-bold">서버 점검</p>
            <ul className="text-sm">
              <li>데이터베이스: {h.db.ok ? "정상" : `연결 실패 (${h.db.error ?? ""})`}</li>
              <li>마지막으로 들어온 뉴스: {ago(h.latestArticleAt)}</li>
              <li>마지막으로 들어온 청약 공고: {ago(h.latestNoticeAt)}</li>
            </ul>
            {h.issues.length > 0 ? (
              <ul className="mt-2 text-sm text-red-600">
                {h.issues.map((i) => (
                  <li key={i}>⚠ {i}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm">확인이 필요한 이슈가 없어요.</p>
            )}
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer">설정 점검 (값은 보여 주지 않고, 들어 있는지만 알려 줘요)</summary>
              <ul className="mt-1">
                {h.env.map((e) => (
                  <li key={e.name}>
                    {e.set ? "✓" : "✗"} {e.label} <span className="text-muted-foreground">({e.name}) · {e.needed}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="상태">
        <button type="button" className={chip(status === "")} onClick={() => setStatus("")}>
          전체
        </button>
        {STATUSES.map((st) => (
          <button key={st} type="button" className={chip(status === st)} onClick={() => setStatus(st)}>
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="출처">
        <button type="button" className={chip(source === "")} onClick={() => setSource("")}>
          모든 출처
        </button>
        {ERROR_SOURCES.map((src) => (
          <button key={src} type="button" className={chip(source === src)} onClick={() => setSource(src)}>
            {SOURCE_LABEL[src]}
          </button>
        ))}
      </div>

      {data && data.items.length === 0 && <p className="text-sm">조건에 맞는 오류가 없어요. 🎉</p>}
      <ul className="grid gap-3">
        {data?.items.map((it) => (
          <li key={it.id} className="rounded-lg border p-3" data-error-row={it.code}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <b className="font-mono">{it.code}</b>
              <span className="rounded-full border px-2 py-0.5 text-xs">{SOURCE_LABEL[it.source]}</span>
              <span className="rounded-full border px-2 py-0.5 text-xs">{STATUS_LABEL[it.status]}</span>
              <span className="text-muted-foreground">{it.count}회</span>
            </div>
            <p className="mt-1 break-words text-sm">{it.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {it.path ? `${it.path} · ` : ""}처음 {ago(it.firstSeenAt)} · 마지막 {ago(it.lastSeenAt)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUSES.filter((st) => st !== it.status).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={busy}
                  className="min-h-9 rounded-md border px-3 text-sm disabled:opacity-50"
                  onClick={() => void act(() => call(`/api/admin/errors/${it.id}`, { method: "PATCH", body: { status: st } }))}
                >
                  {st === "open" ? "다시 열기" : st === "resolved" ? "해결됨으로" : "무시"}
                </button>
              ))}
              <button
                type="button"
                className="min-h-9 rounded-md border px-3 text-sm"
                onClick={() => setOpenId(openId === it.id ? null : it.id)}
              >
                {openId === it.id ? "자세히 닫기" : "자세히"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="min-h-9 rounded-md border px-3 text-sm text-red-600 disabled:opacity-50"
                onClick={() => {
                  if (window.confirm(`${it.code} 기록을 지울까요?`))
                    void act(() => call(`/api/admin/errors/${it.id}`, { method: "DELETE" }));
                }}
              >
                지우기
              </button>
            </div>
            {openId === it.id && (
              <div className="mt-2 rounded bg-muted p-2 text-xs">
                {it.userAgent && <p className="break-words">기기: {it.userAgent}</p>}
                {it.stack ? (
                  <pre className="mt-1 whitespace-pre-wrap break-words">{it.stack}</pre>
                ) : (
                  <p className="mt-1">스택 정보가 없어요.</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer font-bold">오류 코드 읽는 법</summary>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <b>E-WEB-xxxxx</b> 웹 브라우저에서 난 오류, <b>E-APP-xxxxx</b> 앱(안드로이드·iOS)에서 난 오류,{" "}
            <b>E-SRV-xxxxx</b> 서버에서 난 오류예요.
          </li>
          <li>같은 원인의 오류는 늘 같은 코드가 돼요. 숫자나 글 번호만 다른 경우도 한 코드로 합쳐서 횟수를 세요.</li>
          <li>사용자 화면에 보이는 &quot;오류 코드&quot;를 알려 주면 여기서 같은 코드를 찾을 수 있어요.</li>
          <li>해결됨으로 바꾼 오류가 다시 나면 자동으로 &quot;처리 전&quot;으로 돌아와요. 무시한 오류는 그대로 둬요.</li>
          <li>주소의 물음표 뒤(검색어 등)와 IP·쿠키는 저장하지 않아요. 해결·무시한 기록은 90일 뒤에 정리돼요.</li>
        </ul>
      </details>
    </section>
  );
}
