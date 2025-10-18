import { ApiError, ApiErrorDictionary, resolveApiError } from "./api-errors"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type ParseMode = "json" | "text" | "none"

export type ApiRequestOptions = Omit<RequestInit, "body" | "method" | "headers"> & {
  method?: HttpMethod
  body?: unknown
  headers?: HeadersInit
  parseResponseAs?: ParseMode
  errorMessages?: Partial<ApiErrorDictionary>
  baseUrl?: string
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

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? ""

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
    baseUrl = DEFAULT_BASE_URL,
    ...rest
  } = options

  const headers = new Headers(headersInit)
  const requestUrl = `${baseUrl}${path}`

  const response = await fetch(requestUrl, {
    ...rest,
    method,
    headers,
    body: buildBody(body, headers),
  })

  if (!response.ok) {
    const error = await resolveApiError(response, errorMessages)
    return { ok: false, error, response }
  }

  const data = await parseResponse<T>(response, parseResponseAs)
  return { ok: true, data, response }
}

export async function safeApiCall<T>(
  path: string,
  options?: ApiRequestOptions,
): Promise<{ data?: T; error?: ApiError }> {
  const result = await apiClient<T>(path, options)
  if (result.ok) {
    return { data: result.data }
  }
  return { error: result.error }
}
