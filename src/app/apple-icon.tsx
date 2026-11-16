import { renderIcon } from "@/lib/pwa-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// 아이폰 홈 화면 아이콘
export default function AppleIcon() {
  return renderIcon(180, true);
}
