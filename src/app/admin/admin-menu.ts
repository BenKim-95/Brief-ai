import {
  Bell,
  Building2,
  ChartColumn,
  LayoutDashboard,
  MessageSquareWarning,
  Rss,
  Tags,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export type AdminMenuItem = {
  href: string;
  /** 위쪽 탭에 쓰는 짧은 이름 */
  label: string;
  /** 관리 메뉴 카드의 제목 */
  title: string;
  desc: string;
  icon: LucideIcon;
};

export const DASHBOARD_ITEM: AdminMenuItem = {
  href: "/admin",
  label: "대시보드",
  title: "대시보드",
  desc: "오늘 상황을 한눈에 봐요.",
  icon: LayoutDashboard,
};

/** 관리 메뉴를 묶음별로. 새 관리 화면이 생기면 여기에만 더하면 탭과 메뉴 카드에 함께 나온다. */
export const ADMIN_GROUPS: { name: string; items: AdminMenuItem[] }[] = [
  {
    name: "지켜보기",
    items: [
      { href: "/admin/traffic", label: "방문·트래픽", title: "방문자·트래픽", desc: "하루 방문자수와 화면별 방문, 시간대별 트래픽을 봐요.", icon: ChartColumn },
      { href: "/admin/errors", label: "오류·이슈", title: "오류 코드·이슈 현황", desc: "배포 후 웹·앱·서버에서 난 오류와 서버 상태를 확인해요.", icon: TriangleAlert },
    ],
  },
  {
    name: "뉴스",
    items: [
      { href: "/admin/sources", label: "소스", title: "뉴스 소스", desc: "RSS 주소를 등록하고 켜고 꺼요.", icon: Rss },
      { href: "/admin/categories", label: "카테고리", title: "뉴스 카테고리", desc: "분류 이름과 순서를 바꿔요.", icon: Tags },
    ],
  },
  {
    name: "청약",
    items: [
      { href: "/admin/housing-feeds", label: "청약 API", title: "청약 API", desc: "청약홈 API 종류를 관리해요.", icon: Building2 },
      { href: "/admin/housing-categories", label: "청약 분류", title: "청약 카테고리", desc: "청약 공고 분류와 키워드를 바꿔요.", icon: Tags },
    ],
  },
  {
    name: "소통·알림",
    items: [
      { href: "/admin/community", label: "신고", title: "제보 기사 신고", desc: "신고로 가려진 글·댓글을 되살리거나 지워요.", icon: MessageSquareWarning },
      { href: "/notifications", label: "알림", title: "알림 설정", desc: "푸시·이메일 알림을 켜고 시험해요.", icon: Bell },
    ],
  },
];

/** 위쪽 탭 순서. */
export const ADMIN_TABS: AdminMenuItem[] = [DASHBOARD_ITEM, ...ADMIN_GROUPS.flatMap((g) => g.items)];

// 뉴스 가져오기 · AI 해설 채우기는 화면에서 숨겼다(2026-11-21). 다시 쓰려면 대시보드(page.tsx)에 <FetchNewsButton /> 을 넣는다.