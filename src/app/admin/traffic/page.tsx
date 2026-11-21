"use client";

import { ArrowDownRight, ArrowUpRight, Globe, Minus, RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAdminApi } from "../admin-api";
import { BarChart } from "../bar-chart";
import { dayLabel, dayLong, deltaText, n, pathLabel, percent } from "@/lib/traffic/format";
import type { TrafficRange, TrafficReport } from "@/lib/traffic/store";

const RANGES: TrafficRange[] = [7, 14, 30];

function Delta({ now, before }: { now: number; before: number }) {
  const d = deltaText(now, before);
  const Icon = d.dir === "up" ? ArrowUpRight : d.dir === "down" ? ArrowDownRight : Minus;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-sub">
      <Icon className="size-3.5" aria-hidden />
      {d.text}
    </p>
  );
}

function Stat({ label, value, unit, children }: { label: string; value: number; unit: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-sub">{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-tight">
        <span data-stat={label}>{n(value)}</span>
        <span className="ml-1 text-base font-medium text-sub">{unit}</span>
      </p>
      {children}
    </div>
  );
}

/** 하루 방문자수와 하루 방문 트래픽(페이지뷰·시간대·인기 화면)을 본다. */
export default function AdminTrafficPage() {
  const { token, call } = useAdminApi();
  const [range, setRange] = useState<TrafficRange>(14);
  const [data, setData] = useState<TrafficReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await call<TrafficReport>(`/api/admin/traffic?days=${range}`, { busyLabel: "방문 기록을 불러오는 중이에요…" }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 토큰이 있고 기간이 바뀔 때마다 불러온다
    if (token) void load();
  }, [token, load]);

  const t = data?.todayTotals;
  const y = data?.yesterdayTotals;
  const webApp = data ? data.sources.web + data.sources.app : 0;
  const topMax = Math.max(1, ...(data?.topPaths.map((p) => p.pageViews) ?? [0]));
  const tick = range <= 7 ? 1 : range <= 14 ? 3 : 5;

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-lg font-bold">방문자·트래픽</h2>
        <p className="mt-0.5 text-sm text-sub">한국 시간 기준이에요. 관리자 화면·봇·관리자 본인의 방문은 세지 않아요.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-line bg-surface p-3 text-sm text-no">
          ⚠ {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="기간" className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`min-h-10 rounded-full px-4 text-sm font-bold ${range === r ? "bg-brand text-primary-foreground" : "border border-line bg-surface"}`}
            >
              최근 {r}일
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-bold"
        >
          <RefreshCw className="size-4" aria-hidden />
          새로고침
        </button>
      </div>

      {data && t && y && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="오늘 방문자" value={t.visitors} unit="명">
              <Delta now={t.visitors} before={y.visitors} />
            </Stat>
            <Stat label="오늘 페이지뷰" value={t.pageViews} unit="회">
              <Delta now={t.pageViews} before={y.pageViews} />
            </Stat>
            <Stat label={`최근 ${data.range}일 방문자`} value={data.rangeTotals.visitors} unit="명">
              <p className="mt-1 text-xs text-sub">같은 사람은 한 번만 세요.</p>
            </Stat>
            <Stat label={`최근 ${data.range}일 페이지뷰`} value={data.rangeTotals.pageViews} unit="회">
              <p className="mt-1 text-xs text-sub">하루 평균 {n(Math.round(data.rangeTotals.pageViews / data.range))}회</p>
            </Stat>
          </div>
          <p className="-mt-1 text-sm text-sub">
            오늘 온 {n(t.visitors)}명 중 처음 온 사람 <b className="text-ink">{n(t.newVisitors)}명</b> · 다시 온 사람{" "}
            <b className="text-ink">{n(t.returningVisitors)}명</b>
          </p>

          <BarChart
            title={`일별 방문자 (최근 ${data.range}일)`}
            tickEvery={tick}
            emptyText="아직 방문 기록이 없어요."
            bars={data.daily.map((d) => ({
              key: d.day,
              label: dayLabel(d.day),
              value: d.visitors,
              detail: `${dayLong(d.day)} 방문자 ${n(d.visitors)}명`,
            }))}
          />
          <BarChart
            title={`일별 방문 트래픽 · 페이지뷰 (최근 ${data.range}일)`}
            tickEvery={tick}
            emptyText="아직 방문 기록이 없어요."
            bars={data.daily.map((d) => ({
              key: d.day,
              label: dayLabel(d.day),
              value: d.pageViews,
              detail: `${dayLong(d.day)} 페이지뷰 ${n(d.pageViews)}회 (방문자 ${n(d.visitors)}명)`,
            }))}
          />
          <BarChart
            title="오늘 시간대별 트래픽 · 페이지뷰"
            tickEvery={6}
            tickFrom="start"
            initial={(new Date().getUTCHours() + 9) % 24}
            emptyText="오늘은 아직 방문 기록이 없어요."
            bars={data.hourlyToday.map((h) => ({
              key: String(h.hour),
              label: `${h.hour}시`,
              value: h.pageViews,
              detail: `${h.hour}시대 페이지뷰 ${n(h.pageViews)}회 (방문자 ${n(h.visitors)}명)`,
            }))}
          />

          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-sm font-bold">많이 본 화면 (최근 {data.range}일)</h3>
            {data.topPaths.length === 0 ? (
              <p className="py-6 text-center text-sm text-sub">아직 방문 기록이 없어요.</p>
            ) : (
              <ol className="mt-3 grid gap-3">
                {data.topPaths.map((p, i) => (
                  <li key={p.path} data-top-path={p.path}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="mr-2 text-sub">{i + 1}</span>
                        <b>{pathLabel(p.path)}</b>
                        {pathLabel(p.path) !== p.path && <span className="ml-1.5 text-xs text-sub">{p.path}</span>}
                      </span>
                      <span className="shrink-0 text-sub">
                        {n(p.pageViews)}회 · {n(p.visitors)}명
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-app">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(3, Math.round((p.pageViews / topMax) * 100))}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-sm font-bold">웹과 앱 (최근 {data.range}일 페이지뷰)</h3>
            {webApp === 0 ? (
              <p className="py-6 text-center text-sm text-sub">아직 방문 기록이 없어요.</p>
            ) : (
              <ul className="mt-3 grid gap-3 text-sm">
                {(
                  [
                    ["웹 브라우저", data.sources.web, Globe],
                    ["앱", data.sources.app, Smartphone],
                  ] as const
                ).map(([name, v, Icon]) => (
                  <li key={name}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Icon className="size-4 text-sub" aria-hidden />
                        {name}
                      </span>
                      <span className="text-sub">
                        {n(v)}회 · {percent(v, webApp)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-app">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${percent(v, webApp)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <summary className="cursor-pointer font-bold">표로 보기 (일별)</summary>
            <table className="mt-3 w-full text-left">
              <thead className="text-xs text-sub">
                <tr>
                  <th className="py-1 font-medium">날짜</th>
                  <th className="py-1 text-right font-medium">방문자</th>
                  <th className="py-1 text-right font-medium">페이지뷰</th>
                </tr>
              </thead>
              <tbody>
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.day} className="border-t border-line">
                    <td className="py-1.5">{dayLong(d.day)}</td>
                    <td className="py-1.5 text-right">{n(d.visitors)}명</td>
                    <td className="py-1.5 text-right">{n(d.pageViews)}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <details className="text-sm text-sub">
            <summary className="cursor-pointer font-bold text-ink">숫자를 읽는 법</summary>
            <ul className="mt-2 list-disc pl-5">
              <li>방문자는 이 브라우저(앱)에 심은 익명 번호 기준이에요. 쿠키를 지우거나 다른 기기에서 열면 새 방문자로 세요.</li>
              <li>페이지뷰는 화면을 연 횟수예요. 같은 화면을 새로 열 때마다 1회, 앱 안에서 화면을 옮겨도 1회씩 세요.</li>
              <li>IP와 주소의 검색어(? 뒤)는 저장하지 않고, 기록은 90일 뒤에 정리돼요.</li>
              <li>데이터 전송량(GB) 같은 서버 트래픽은 Vercel 프로젝트의 Usage 화면에서 확인해요.</li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
