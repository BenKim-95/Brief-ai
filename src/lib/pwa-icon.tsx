import { ImageResponse } from "next/og";

export const ICON_SIZES = [180, 192, 512] as const;

// 글꼴 파일 없이 그릴 수 있게 영문 "B"만 쓴다. maskable은 안전 영역(가운데 80%)에 맞춰 글자를 줄인다.
export function renderIcon(size: number, maskable = false) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const fontSize = Math.round(size * (maskable ? 0.46 : 0.58));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d4ed8",
          color: "#ffffff",
          fontSize,
          fontWeight: 700,
          borderRadius: radius,
        }}
      >
        B
      </div>
    ),
    { width: size, height: size },
  );
}
