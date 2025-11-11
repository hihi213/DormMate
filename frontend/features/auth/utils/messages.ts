export function getAuthReasonMessage(reason: string | null): string {
  switch (reason) {
    case "sessionExpired":
      return "세션이 만료되었습니다. 다시 로그인해 주세요."
    case "logout":
      return "정상적으로 로그아웃되었습니다. 다시 로그인해 주세요."
    case "forbidden":
      return "접근 권한이 없어 로그인 화면으로 이동했습니다."
    default:
      return ""
  }
}
