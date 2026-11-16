import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getEmailConfig } from "@/lib/email/config";
import { sendBatch } from "@/lib/email/resend";
import { listSubscribers, unsubscribeLink } from "@/lib/email/subscribers";
import { buildDigestEmail } from "@/lib/email/template";

/** 받는 모든 주소로 시험 메일을 보낸다. 메일이 제대로 오는지 확인하는 용도예요. */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const c = getEmailConfig();
  if ("error" in c) return c.error;
  const subs = await listSubscribers(getDb());
  if (subs.length === 0) return Response.json({ sent: 0, failed: 0 });
  const emails = subs.map((s) => {
    const unsubscribeUrl = unsubscribeLink(c.config.siteUrl, s.unsubscribeToken);
    const mail = buildDigestEmail(
      { news: 1, housing: 0, topTitle: "시험 메일이에요", headlines: [{ title: "시험 메일이에요", url: c.config.siteUrl }] },
      c.config.siteUrl,
      unsubscribeUrl,
    );
    return { to: s.email, unsubscribeUrl, ...mail, subject: "[브리프] 시험 메일" };
  });
  try {
    await sendBatch(c.config, emails);
    return Response.json({ sent: emails.length, failed: 0 });
  } catch {
    return Response.json({ sent: 0, failed: emails.length }, { status: 502 });
  }
}
