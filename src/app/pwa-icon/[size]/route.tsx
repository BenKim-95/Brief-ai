import { ICON_SIZES, renderIcon } from "@/lib/pwa-icon";

export function generateStaticParams() {
  return ICON_SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(request: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const n = Number(size);
  if (!(ICON_SIZES as readonly number[]).includes(n)) {
    return new Response("Not found", { status: 404 });
  }
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  return renderIcon(n, maskable);
}
