export type ApiErrorTemplate = {
  code: string
  message: string
}

export type ApiErrorDictionary = {
  DEFAULT: ApiErrorTemplate
  [status: number]: ApiErrorTemplate
}

export type ApiError = {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
  raw?: unknown
}

export const defaultErrorDictionary: ApiErrorDictionary = {
  DEFAULT: {
    code: "UNEXPECTED_ERROR",
    message: "요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  },
  400: {
    code: "BAD_REQUEST",
    message: "입력하신 정보를 다시 확인해 주세요.",
  },
  401: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요하거나 세션이 만료되었습니다.",
  },
  403: {
    code: "FORBIDDEN",
    message: "이 작업을 수행할 권한이 없습니다.",
  },
  404: {
    code: "NOT_FOUND",
    message: "요청하신 리소스를 찾을 수 없습니다.",
  },
  409: {
    code: "CONFLICT",
    message: "이미 처리된 요청이거나 충돌이 발생했습니다.",
  },
  423: {
    code: "COMPARTMENT_SUSPENDED",
    message: "해당 칸이 점검 중이거나 일시적으로 사용 중지되었습니다.",
  },
  422: {
    code: "VALIDATION_FAILED",
    message: "입력값이 유효하지 않습니다. 항목을 다시 확인해 주세요.",
  },
  429: {
    code: "RATE_LIMITED",
    message: "잠시 후 다시 시도해 주세요.",
  },
  500: {
    code: "SERVER_ERROR",
    message: "서버에 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  },
}

export const defaultCodeDictionary: Record<string, ApiErrorTemplate> = {
  CAPACITY_EXCEEDED: {
    code: "CAPACITY_EXCEEDED",
    message: "해당 칸의 허용량을 초과했습니다. 다른 칸을 선택하거나 기존 물품을 정리해 주세요.",
  },
  COMPARTMENT_SUSPENDED: {
    code: "COMPARTMENT_SUSPENDED",
    message: "관리자 점검 중인 칸입니다. 다른 칸을 이용해 주세요.",
  },
  COMPARTMENT_LOCKED: {
    code: "COMPARTMENT_LOCKED",
    message: "현재 검사 중인 칸입니다. 검사가 종료될 때까지 이용할 수 없습니다.",
  },
  COMPARTMENT_UNDER_INSPECTION: {
    code: "COMPARTMENT_UNDER_INSPECTION",
    message: "검사 중인 칸입니다. 검사가 끝난 뒤 다시 시도해 주세요.",
  },
  FORBIDDEN_SLOT: {
    code: "FORBIDDEN_SLOT",
    message: "접근 권한이 없는 냉장고 칸입니다.",
  },
  FLOOR_SCOPE_VIOLATION: {
    code: "FLOOR_SCOPE_VIOLATION",
    message: "담당 층이 아닌 냉장고 칸에 접근할 수 없습니다.",
  },
  INVALID_CREDENTIALS: {
    code: "INVALID_CREDENTIALS",
    message: "아이디 또는 비밀번호가 올바르지 않습니다.",
  },
  USER_INACTIVE: {
    code: "USER_INACTIVE",
    message: "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
  },
  INVALID_ACCESS_TOKEN: {
    code: "INVALID_ACCESS_TOKEN",
    message: "세션 정보가 유효하지 않습니다. 다시 로그인해 주세요.",
  },
  REFRESH_TOKEN_EXPIRED: {
    code: "REFRESH_TOKEN_EXPIRED",
    message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
  },
  REFRESH_TOKEN_DEVICE_MISMATCH: {
    code: "REFRESH_TOKEN_DEVICE_MISMATCH",
    message: "등록되지 않은 기기에서 접속했습니다. 다시 로그인해 주세요.",
  },
  SESSION_NOT_FOUND: {
    code: "SESSION_NOT_FOUND",
    message: "검사 세션 정보를 찾을 수 없습니다.",
  },
  SCHEDULE_NOT_FOUND: {
    code: "SCHEDULE_NOT_FOUND",
    message: "검사 일정을 찾을 수 없습니다.",
  },
  SCHEDULE_ALREADY_LINKED: {
    code: "SCHEDULE_ALREADY_LINKED",
    message: "이미 연결된 검사 일정입니다.",
  },
  SCHEDULE_NOT_ACTIVE: {
    code: "SCHEDULE_NOT_ACTIVE",
    message: "진행 중인 검사 일정만 선택할 수 있습니다.",
  },
  PREFERENCE_NOT_FOUND: {
    code: "PREFERENCE_NOT_FOUND",
    message: "알림 설정 정보를 찾을 수 없습니다.",
  },
  NOTIFICATION_NOT_FOUND: {
    code: "NOTIFICATION_NOT_FOUND",
    message: "알림을 찾을 수 없습니다.",
  },
  NOTIFICATION_EXPIRED: {
    code: "NOTIFICATION_EXPIRED",
    message: "이미 만료된 알림입니다.",
  },
  DEVICE_MISMATCH: {
    code: "DEVICE_MISMATCH",
    message: "등록된 기기 정보와 일치하지 않습니다. 다시 로그인해 주세요.",
  },
}

type ErrorPayload = {
  code?: string
  message?: string
  detail?: string
  details?: Record<string, unknown>
  errors?: Record<string, unknown>
  [key: string]: unknown
}

async function parseErrorBody(response: Response): Promise<ErrorPayload | undefined> {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return undefined
  }
  try {
    return (await response.json()) as ErrorPayload
  } catch {
    return undefined
  }
}

export async function resolveApiError(
  response: Response,
  overrides?: Partial<ApiErrorDictionary>,
  codeOverrides?: Record<string, ApiErrorTemplate>,
): Promise<ApiError> {
  const dictionary: ApiErrorDictionary = {
    ...defaultErrorDictionary,
    ...overrides,
  }

  const mergedCodeDictionary: Record<string, ApiErrorTemplate> = {
    ...defaultCodeDictionary,
    ...(codeOverrides
      ? Object.fromEntries(
          Object.entries(codeOverrides).map(([key, value]) => [key.toUpperCase(), value]),
        )
      : {}),
  }

  const payload = await parseErrorBody(response)
  const template = dictionary[response.status] ?? dictionary.DEFAULT

  let messageFromPayload: string | undefined
  if (payload) {
    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      messageFromPayload = payload.message
    } else if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
      messageFromPayload = payload.detail
    } else if (Array.isArray(payload.errors)) {
      messageFromPayload = payload.errors.filter((item): item is string => typeof item === "string").join(" ")
    } else if (payload.errors && typeof payload.errors === "object") {
      messageFromPayload = Object.values(payload.errors)
        .flatMap((entry) => {
          if (typeof entry === "string") return [entry]
          if (Array.isArray(entry)) {
            return entry.filter((item): item is string => typeof item === "string")
          }
          return []
        })
        .join(" ")
    }
  }

  const payloadCode = typeof payload?.code === "string" ? payload.code.trim() : undefined
  const normalizedPayloadCode = payloadCode?.toUpperCase()
  const codeTemplate =
    (normalizedPayloadCode && mergedCodeDictionary[normalizedPayloadCode]) || undefined

  let finalCode = payloadCode || template.code
  let finalMessage = messageFromPayload || template.message

  if (!messageFromPayload) {
    if (codeTemplate) {
      finalMessage = codeTemplate.message
      finalCode = codeTemplate.code
    } else {
      const normalizedTemplateCode = template.code?.toUpperCase()
      const templateCodeEntry =
        normalizedTemplateCode && mergedCodeDictionary[normalizedTemplateCode]
      if (templateCodeEntry) {
        finalMessage = templateCodeEntry.message
        finalCode = templateCodeEntry.code
      }
    }
  }

  return {
    code: finalCode,
    message: finalMessage,
    status: response.status,
    details: payload?.details || payload?.errors,
    raw: payload,
  }
}
