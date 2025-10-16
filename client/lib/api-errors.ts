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
): Promise<ApiError> {
  const dictionary: ApiErrorDictionary = {
    ...defaultErrorDictionary,
    ...overrides,
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

  return {
    code: payload?.code || template.code,
    message: messageFromPayload || template.message,
    status: response.status,
    details: payload?.details || payload?.errors,
    raw: payload,
  }
}
