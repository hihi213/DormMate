import { safeApiCall } from "@/lib/api-client"
import { getDeviceId } from "@/lib/device-id"

export type UserRole = "RESIDENT" | "FLOOR_MANAGER" | "ADMIN"

export type RoomDetails = {
  roomId?: string
  floor?: number
  roomNumber?: string
  personalNo?: number
  floorCode?: string
}

export type AuthUser = {
  userId: string
  loginId: string
  name: string
  room?: string
  roomDetails?: RoomDetails | null
  roles: UserRole[]
  isFloorManager: boolean
  isAdmin: boolean
}

type TokenStorage = {
  accessToken: string
  tokenType: string
  accessExpiresAt: number
  refreshToken: string
  refreshExpiresAt: number
}

type TokenPair = {
  accessToken: string
  tokenType: "Bearer"
  expiresIn: number
  refreshToken: string
  refreshExpiresIn: number
  issuedAt: string
}

type RoomAssignment = {
  roomId: string
  floor: number
  roomNumber: string
  personalNo: number
  assignedAt: string
  floorCode?: string
}

type UserProfile = {
  userId: string
  loginId: string
  displayName: string
  email?: string | null
  roles: UserRole[]
  primaryRoom?: RoomAssignment | null
  isFloorManager: boolean
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

type LoginResponse = {
  tokens: TokenPair
  user: UserProfile
}

const TOKENS_KEY = "dm.auth.tokens"
const PROFILE_KEY = "dm.auth.profile"
const ADMIN_FLAG_COOKIE = "dm.admin"

const ACCESS_TOKEN_SKEW_MS = 5_000

const authListeners = new Set<(user: AuthUser | null) => void>()

let refreshPromise: Promise<boolean> | null = null

function mapUserProfile(profile: UserProfile): AuthUser {
  const roomDetails = profile.primaryRoom
    ? {
        roomId: profile.primaryRoom.roomId,
        floor: profile.primaryRoom.floor,
        roomNumber: profile.primaryRoom.roomNumber,
        personalNo: profile.primaryRoom.personalNo,
        floorCode: profile.primaryRoom.floorCode,
      }
    : null
  return {
    userId: profile.userId,
    loginId: profile.loginId,
    name: profile.displayName,
    room: formatRoom(profile.primaryRoom ?? undefined),
    roomDetails,
    roles: profile.roles ?? [],
    isFloorManager: profile.isFloorManager,
    isAdmin: profile.isAdmin,
  }
}

function formatRoom(room?: RoomAssignment | null): string | undefined {
  if (!room) return undefined
  const base = room.roomNumber ? `${room.roomNumber}호` : ""
  const personal = room.personalNo ? ` ${room.personalNo}번` : ""
  return `${room.floor}층 ${base}${personal}`.trim()
}

function toTokenStorage(pair: TokenPair): TokenStorage {
  const issuedAt = Date.parse(pair.issuedAt)
  return {
    accessToken: pair.accessToken,
    tokenType: pair.tokenType,
    accessExpiresAt: issuedAt + pair.expiresIn * 1000,
    refreshToken: pair.refreshToken,
    refreshExpiresAt: issuedAt + pair.refreshExpiresIn * 1000,
  }
}

function readTokens(): TokenStorage | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(TOKENS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TokenStorage
  } catch {
    return null
  }
}

function writeTokens(tokens: TokenStorage | null) {
  if (typeof window === "undefined") return
  if (!tokens) {
    localStorage.removeItem(TOKENS_KEY)
    return
  }
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

function readUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function writeUser(user: AuthUser | null) {
  if (typeof window === "undefined") return
  if (!user) {
    localStorage.removeItem(PROFILE_KEY)
    clearAdminCookie()
    return
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(user))
  syncAdminCookie(user)
}

function clearAdminCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${ADMIN_FLAG_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

function syncAdminCookie(user: AuthUser | null) {
  if (typeof document === "undefined") return
  if (user?.isAdmin) {
    document.cookie = `${ADMIN_FLAG_COOKIE}=1; Max-Age=604800; Path=/; SameSite=Lax`
  } else {
    clearAdminCookie()
  }
}

function notifyAuth(user: AuthUser | null) {
  authListeners.forEach((listener) => {
    try {
      listener(user)
    } catch (error) {
      console.error("auth listener error", error)
    }
  })
}

function applySession(response: LoginResponse) {
  const tokenStorage = toTokenStorage(response.tokens)
  const user = mapUserProfile(response.user)
  writeTokens(tokenStorage)
  writeUser(user)
  notifyAuth(user)
}

function clearSession() {
  writeTokens(null)
  writeUser(null)
  notifyAuth(null)
}

function isAccessTokenExpired(tokens: TokenStorage): boolean {
  return Date.now() + ACCESS_TOKEN_SKEW_MS >= tokens.accessExpiresAt
}

function isRefreshTokenExpired(tokens: TokenStorage): boolean {
  return Date.now() >= tokens.refreshExpiresAt
}

async function ensureTokens(forceRefresh: boolean): Promise<boolean> {
  const tokens = readTokens()
  if (!tokens) return false

  if (isRefreshTokenExpired(tokens)) {
    clearSession()
    return false
  }

  if (!forceRefresh && !isAccessTokenExpired(tokens)) {
    return true
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const current = readTokens()
    if (!current) return false
    if (isRefreshTokenExpired(current)) {
      clearSession()
      return false
    }

    const { data, error } = await safeApiCall<LoginResponse>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: current.refreshToken, deviceId: getDeviceId() },
      skipAuth: true,
    })

    if (error || !data) {
      clearSession()
      return false
    }

    applySession(data)
    return true
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export function subscribeAuth(listener: (user: AuthUser | null) => void) {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

export function getCurrentUser(): AuthUser | null {
  return readUser()
}

export function getCurrentUserId(): string | null {
  return readUser()?.userId ?? null
}

export function getCurrentUserLoginId(): string | null {
  return readUser()?.loginId ?? null
}

export async function ensureValidAccessToken(): Promise<string | null> {
  const tokens = readTokens()
  if (!tokens) return null
  const success = await ensureTokens(false)
  if (!success) return null
  return readTokens()?.accessToken ?? null
}

export async function forceRefreshAccessToken(): Promise<string | null> {
  const success = await ensureTokens(true)
  if (!success) return null
  return readTokens()?.accessToken ?? null
}

export async function loginWithCredentials({ id, password }: { id: string; password: string }) {
  const { data, error } = await safeApiCall<LoginResponse>("/auth/login", {
    method: "POST",
    body: { loginId: id, password, deviceId: getDeviceId() },
    skipAuth: true,
  })

  if (error || !data) {
    throw new Error(error?.message ?? "로그인에 실패했습니다. 다시 시도해 주세요.")
  }

  applySession(data)
  return getCurrentUser()
}

export async function logout() {
  const tokens = readTokens()
  if (tokens) {
    await safeApiCall("/auth/logout", {
      method: "POST",
      body: { refreshToken: tokens.refreshToken },
      skipAuth: true,
      parseResponseAs: "none",
    })
  }
  clearSession()
}

export async function fetchProfile(): Promise<AuthUser | null> {
  const { data, error } = await safeApiCall<UserProfile>("/profile/me", {
    method: "GET",
  })

  if (error || !data) {
    if (error?.status === 401) {
      clearSession()
    }
    return null
  }

  const user = mapUserProfile(data)
  writeUser(user)
  notifyAuth(user)
  return user
}

export function getAuthorizationHeader(): string | null {
  const tokens = readTokens()
  if (!tokens) return null
  return `${tokens.tokenType} ${tokens.accessToken}`
}

type RedirectToLoginOptions = {
  redirect?: string
  reason?: string
  navigate?: boolean
  preserveSession?: boolean
}

export function redirectToLogin(reason?: string): string
export function redirectToLogin(options?: RedirectToLoginOptions): string
export function redirectToLogin(
  arg0?: string | RedirectToLoginOptions,
  maybeOptions?: RedirectToLoginOptions,
): string {
  const options = typeof arg0 === "string" ? { ...(maybeOptions ?? {}), reason: arg0 } : arg0 ?? {}
  const { redirect, reason, navigate = false, preserveSession = false } = options
  if (
    process.env.NEXT_PUBLIC_FIXTURE === "1" ||
    (typeof window !== "undefined" && window.localStorage.getItem("dm.fixture") === "1")
  ) {
    return "/"
  }
  if (!preserveSession) {
    clearSession()
  }
  const params = new URLSearchParams()
  params.set("mode", "login")
  if (redirect) {
    params.set("redirect", redirect)
  }
  if (reason) {
    params.set("reason", reason)
  }
  const loginUrl = `/auth?${params.toString()}`
  if (navigate && typeof window !== "undefined") {
    window.location.href = loginUrl
  }
  return loginUrl
}

export async function registerUser(): Promise<AuthUser> {
  throw new Error("회원가입은 현재 관리자 승인 절차를 통해서만 가능합니다.")
}
