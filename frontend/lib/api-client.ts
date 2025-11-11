import { ensureValidAccessToken, forceRefreshAccessToken, redirectToLogin } from "@/lib/auth"
import {
  ApiError,
  ApiErrorDictionary,
  ApiErrorTemplate,
  resolveApiError,
  getDefaultErrorMessage,
} from "./api-errors"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type ParseMode = "json" | "text" | "none"

export type ApiRequestOptions = Omit<RequestInit, "body" | "method" | "headers"> & {
  method?: HttpMethod
  body?: unknown
  headers?: HeadersInit
  parseResponseAs?: ParseMode
  errorMessages?: Partial<ApiErrorDictionary>
  errorCodeMessages?: Record<string, ApiErrorTemplate>
  baseUrl?: string
  skipAuth?: boolean
}

export type ApiSuccess<T> = {
  ok: true
  data: T
  response: Response
}

export type ApiFailure = {
  ok: false
  error: ApiError
  response: Response
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ??
  process.env.API_BASE?.replace(/\/$/, "") ??
  "http://localhost:8080"

function buildBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined
  }
  if (body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) {
    return body
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }
  return JSON.stringify(body)
}

async function parseResponse<T>(response: Response, mode: ParseMode): Promise<T> {
  if (mode === "none" || response.status === 204) {
    return undefined as T
  }

  if (mode === "text") {
    return (await response.text()) as unknown as T
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiClient<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const {
    method = "GET",
    body,
    headers: headersInit,
    parseResponseAs = "json",
    errorMessages,
    errorCodeMessages,
    baseUrl = DEFAULT_BASE_URL,
    skipAuth = false,
    ...rest
  } = options

  const headers = new Headers(headersInit)
  const requestUrl = `${baseUrl}${path}`
  let requestBody = buildBody(body, headers)
  ensureRequestId(headers)

  if (!skipAuth) {
    const accessToken = await ensureValidAccessToken()
    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`)
    }
  }

  let response = await fetch(requestUrl, {
    ...rest,
    method,
    headers,
    body: requestBody,
  })

  if (response.status === 401 && !skipAuth) {
    const refreshed = await forceRefreshAccessToken()
    if (refreshed) {
      headers.set("authorization", `Bearer ${refreshed}`)
      response = await fetch(requestUrl, {
        ...rest,
        method,
        headers,
        body: requestBody,
      })
    }
  }

  if (!response.ok) {
    const error = await resolveApiError(response, errorMessages, errorCodeMessages)
    if (response.status === 401 && !skipAuth) {
      redirectToLogin({ reason: "sessionExpired", navigate: true })
    }
    return { ok: false, error, response }
  }

  const data = await parseResponse<T>(response, parseResponseAs)
  return { ok: true, data, response }
}

function ensureRequestId(headers: Headers) {
  if (headers.has("x-request-id")) {
    return
  }
  headers.set("x-request-id", generateRequestId())
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const random = Math.random().toString(36).slice(2, 10)
  return `req-${Date.now().toString(36)}-${random}`
}

export async function safeApiCall<T>(
  path: string,
  options?: ApiRequestOptions,
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const result = await apiClient<T>(path, options)
    if (result.ok) {
      return { data: result.data }
    }
    return { error: result.error }
  } catch (err) {
    const fallbackMessage =
      options?.errorMessages?.DEFAULT?.message ??
      getDefaultErrorMessage("NETWORK_ERROR") ??
      "서버와 통신하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
    const networkError: ApiError = {
      code: "NETWORK_ERROR",
      message: fallbackMessage,
      status: 0,
      raw: err,
    }
    return { error: networkError }
  }
}
