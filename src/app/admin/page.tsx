import Link from "next/link";
import { FetchButton as FetchHousingButton } from "@/app/housing/fetch-button";

const TOOLS = [
  { href: "/admin/errors", title: "오류 코드·이슈 현황", desc: "배포 후 웹·앱·서버에서 난 오류와 서버 상태를 확인해요." },
  { href: "/admin/sources", title: "뉴스 소스", desc: "RSS 주소를 등록하고 켜고 꺼요." },
  { href: "/admin/categories", title: "뉴스 카테고리", desc: "분류 이름과 순서를 바꿔요." },
  { href: "/admin/housing-feeds", title: "청약 API", desc: "청약홈 API 종류를 관리해요." },
  { href: "/admin/housing-categories", title: "청약 카테고리", desc: "청약 공고 분류와 키워드를 바꿔요." },
  { href: "/admin/community", title: "제보 기사 신고", desc: "신고로 가려진 글·댓글을 되살리거나 지워요." },
  { href: "/notifications", title: "알림 설정", desc: "푸시·이메일 알림을 켜고 시험해요." },
];

/** 관리자 첫 화면. (layout 이 관리자만 볼 수 있게 감싸고 있다.) */
export default function AdminIndex() {
  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">데이터 가져오기</h2>
      <p className="text-sm text-muted-foreground">매일 아침 자동으로도 가져와요. 지금 바로 가져오고 싶을 때 쓰세요.</p>
      {/* 뉴스 가져오기·AI 해설 채우기 버튼(FetchNewsButton)은 화면에서 숨겼다. 다시 쓰려면 여기에 <FetchNewsButton /> 을 넣는다. */}
      <div className="mt-3 mb-8">
        <FetchHousingButton />
      </div>

      <h2 className="mb-3 text-lg font-bold">관리 메뉴</h2>
      <ul className="grid gap-3">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="block rounded-lg border p-4">
              <p className="font-bold">{t.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
