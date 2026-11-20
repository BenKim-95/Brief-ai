/** 뉴스 카드 아래 AI 해설 3줄. 셋 다 없으면(아직 해설을 안 만든 기존 기사) 아무것도 그리지 않는다. */
export function InsightBlock({
  oneLine,
  learned,
  perspective,
}: {
  oneLine: string | null;
  learned: string | null;
  perspective: string | null;
}) {
  const rows = [
    { label: "한 줄 요약", text: oneLine },
    { label: "알게 된 점", text: learned },
    { label: "다른 시각", text: perspective },
  ].filter((r): r is { label: string; text: string } => !!r.text);
  if (rows.length === 0) return null;
  return (
    <section aria-label="AI 해설" className="mt-3 rounded-2xl bg-app p-4">
      <dl className="flex flex-col gap-2.5 text-sm leading-[1.6]">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-bold text-brand">{r.label}</dt>
            <dd className="text-ink">{r.text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-sub">
        Claude AI가 제목과 요약만 보고 정리했어요. 자세한 내용은 원문에서 확인해 주세요.
      </p>
    </section>
  );
}
