import type { EmailConfig } from "./config";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** 받는 사람이 한 번에 수신 해제할 수 있는 주소(List-Unsubscribe 헤더) */
  unsubscribeUrl: string;
};

export type EmailBatchSender = (config: EmailConfig, emails: OutgoingEmail[]) => Promise<void>;

const BATCH_LIMIT = 100;

/**
 * Resend 일괄 발송(POST /emails/batch). 실패하면 던지고, 응답 본문은 에러 메시지에 넣지 않는다
 * (받는 사람 주소 등이 로그에 남지 않게 상태 코드만 알린다).
 */
export const sendBatch: EmailBatchSender = async (config, emails) => {
  for (let i = 0; i < emails.length; i += BATCH_LIMIT) {
    const chunk = emails.slice(i, i + BATCH_LIMIT).map((m) => ({
      from: config.from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: {
        "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Resend 발송 실패 (${res.status})`);
  }
};
