"use client";

import { ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FetchButton as FetchHousingButton } from "@/app/housing/fetch-button";
import { dayLabel, dayLong, deltaText, n } from "@/lib/traffic/format";
import type { TrafficReport } from "@/lib/traffic/store";
import { useAdminApi } from "./admin-api";
import { ADMIN_GROUPS } from "./admin-menu";
import { BarChart } from "./bar-chart";

type ErrorsPayload = {
  summary: { open: number };
  health: { latestArticleAt: string | null; latestNoticeAt: string | null; issues: string[] };
};

function ago(iso: string | null | undefined): string {
  if (!iso) return "기록 없음";
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function Card({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-2xl border border-line bg-surface p-4 active:bg-surface2">
      <p className="flex items-center justify-between text-sm text-sub">
        {label}
        <ChevronRight className="size-4" aria-hidden />
      </p>
      {children}
    </Link>
  );
}

/** 관리자 첫 화면: 오늘 상황 한눈에 + 자주 쓰는 버튼 + 관리 메뉴. (layout 의 AdminGate 가 잠금을 풀어야 보인다.) */
export default function AdminDashboard() {
  const { token, call } = useAdminApi();
  const [traffic, setTraffic] = useState<TrafficReport | null>(null);
  const [trafficError, setTrafficError] = useState("");
  const [errors, setErrors] = useState<ErrorsPayload | null>(null);

  const load = useCallback(async () => {
    // 두 곳 중 하나가 실패해도 다른 쪽은 보여 준다.
    await Promise.all([
      call<TrafficReport>("/api/admin/traffic?days=7").then(
        (r) => {
          setTraffic(r);
          setTrafficError("");
        },
        (e: Error) => setTrafficError(e.message),
      ),
      call<ErrorsPayload>("/api/admin/errors?status=open").then(setErrors, () => setErrors(null)),
    ]);
  }, [call]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const t = traffic?.todayTotals;
  const y = traffic?.yesterdayTotals;
  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul" });

  return (
    <div className="grid gap-6">
      <section aria-labelledby="today-title">
        <h2 id="today-title" className="text-lg font-bold">
          오늘 현황
        </h2>
        <p className="mt-0.5 text-sm text-sub">{today}</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card href="/admin/traffic" label="오늘 방문자">
            <p className="mt-1 text-[28px] font-bold leading-tight">
              <span data-stat="오늘 방문자">{t ? n(t.visitors) : "–"}</span>
              <span className="ml-1 text-base font-medium text-sub">명</span>
            </p>
            <p className="mt-1 text-xs text-sub">{t && y ? deltaText(t.visitors, y.visitors).text : "불러오는 중"}</p>
          </Card>
          <Card href="/admin/traffic" label="오늘 페이지뷰">
            <p className="mt-1 text-[28px] font-bold leading-tight">
              <span data-stat="오늘 페이지뷰">{t ? n(t.pageViews) : "–"}</span>
              <span className="ml-1 text-base font-medium text-sub">회</span>
            </p>
            <p className="mt-1 text-xs text-sub">{t && y ? deltaText(t.pageViews, y.pageViews).text : "불러오는 중"}</p>
          </Card>
          <Card href="/admin/errors" label="처리 전 오류">
            {errors ? (
              errors.summary.open > 0 ? (
                <p className="mt-1 flex items-center gap-1.5 text-[28px] font-bold leading-tight text-urgent">
                  <TriangleAlert className="size-6" aria-hidden />
                  <span>{n(errors.summary.open)}</span>
                  <span className="text-base font-medium">종</span>
                </p>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-[28px] font-bold leading-tight text-ok">
                  <CircleCheck className="size-6" aria-hidden />
                  <span>없음</span>
                </p>
              )
            ) : (
              <p className="mt-1 text-[28px] font-bold leading-tight">–</p>
            )}
            <p className="mt-1 text-xs text-sub">
              {errors && errors.health.issues.length > 0 ? `서버 점검 이슈 ${errors.health.issues.length}건` : "서버 점검 이슈 없음"}
            </p>
          </Card>
          <Card href="/admin/sources" label="마지막 뉴스 수집">
            <p className="mt-1 text-[28px] font-bold leading-tight">{errors ? ago(errors.health.latestArticleAt) : "–"}</p>
            <p className="mt-1 text-xs text-sub">청약 공고 {errors ? ago(errors.health.latestNoticeAt) : "–"}</p>
          </Card>
        </div>

        {trafficError && (
          <p role="alert" className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm text-no">
            ⚠ 방문 통계: {trafficError}
          </p>
        )}
        {traffic && (
          <div className="mt-3">
            <BarChart
              title="최근 7일 방문자"
              tickEvery={1}
              emptyText="아직 방문 기록이 없어요."
              bars={traffic.daily.map((d) => ({
                key: d.day,
                label: dayLabel(d.day),
                value: d.visitors,
                detail: `${dayLong(d.day)} 방문자 ${n(d.visitors)}명`,
              }))}
            />
            <Link href="/admin/traffic" className="mt-2 inline-flex min-h-10 items-center text-sm font-bold text-brand">
              방문자·트래픽 자세히 보기 →
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="quick-title">
        <h2 id="quick-title" className="text-lg font-bold">
          바로 하기
        </h2>
        <p className="mt-0.5 text-sm text-sub">매일 아침 자동으로도 가져와요. 지금 바로 가져오고 싶을 때 쓰세요.</p>
        {/* 뉴스 가져오기·AI 해설 채우기 버튼(FetchNewsButton)은 화면에서 숨겼다. 다시 쓰려면 여기에 <FetchNewsButton /> 을 넣는다. */}
        <div className="mt-3">
          <FetchHousingButton />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/notifications" className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-3 text-sm font-bold">
            알림 설정
          </Link>
          <Link href="/admin/errors" className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-3 text-sm font-bold">
            오류 확인하기
          </Link>
        </div>
      </section>

      <section aria-labelledby="menu-title">
        <h2 id="menu-title" className="text-lg font-bold">
          관리 메뉴
        </h2>
        <div className="mt-3 grid gap-5">
          {ADMIN_GROUPS.map((g) => (
            <div key={g.name}>
              <h3 className="mb-2 text-sm font-bold text-sub">{g.name}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface2">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-weak text-brand">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold">{item.title}</span>
                          <span className="mt-0.5 block text-sm text-sub">{item.desc}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
