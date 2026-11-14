/**
 * 네이버 API HUB(네이버 클라우드) 접근 정보. 서버 코드에서만 사용한다.
 * https://api.ncloud-docs.com/docs/naver-api-hub-overview
 */
export type NaverCredentials = { id: string; secret: string; baseUrl: string };

export function getNaverCredentials(): NaverCredentials | null {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  const baseUrl = (process.env.NAVER_OPEN_API_URL?.trim() || "https://naverapihub.apigw.ntruss.com").replace(/\/+$/, "");
  return id && secret ? { id, secret, baseUrl } : null;
}
