/**
 * 공공데이터포털(data.go.kr) 서비스 키 접근. 서버 코드에서만 사용한다.
 * 키는 "Decoding" 값을 그대로 두고, 요청 시 URLSearchParams가 인코딩하게 한다.
 */
export function getDataGoKrServiceKey():
  | { key: string }
  | { error: Response } {
  const key = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!key) {
    return {
      error: Response.json(
        { error: "서버에 DATA_GO_KR_SERVICE_KEY가 설정되지 않았어요." },
        { status: 503 },
      ),
    };
  }
  return { key };
}
