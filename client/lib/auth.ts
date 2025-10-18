export type AuthUser = { id: string; name: string; room: string }

type StoredUser = AuthUser & {
  password: string
  email?: string
  phone?: string
  personalNo?: string
  createdAt: number
  normalizedId: string
}

type PersistedUser = Omit<StoredUser, "normalizedId">

const SEED_USERS: PersistedUser[] = [
  { id: "1", password: "1", name: "김승현", room: "301호", createdAt: Date.parse("2024-01-01") },
  { id: "2", password: "2", name: "이번", room: "202호", createdAt: Date.parse("2024-01-02") },
  { id: "3", password: "3", name: "삼번", room: "203호", createdAt: Date.parse("2024-01-03") },
]

const PROFILE_KEY = "user-profile"
const AUTH_USER_KEY = "auth-user"
const CUSTOM_USERS_KEY = "custom-users-v1"

const authListeners = new Set<(user: AuthUser | null) => void>()

const normalizeLoginId = (value: string) => value.trim().toLowerCase()

const toStoredUser = (user: PersistedUser): StoredUser => ({
  ...user,
  normalizedId: normalizeLoginId(user.id),
})

const BASE_USERS = SEED_USERS.map(toStoredUser)

function readCustomUsers(): StoredUser[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_USERS_KEY) || "[]") as PersistedUser[]
    if (!Array.isArray(raw)) return []
    return raw.map(toStoredUser)
  } catch {
    return []
  }
}

function writeCustomUsers(users: StoredUser[]) {
  const persistable: PersistedUser[] = users.map(({ normalizedId: _ignored, ...rest }) => rest)
  localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(persistable))
}

function getAllUsers(): StoredUser[] {
  return [...BASE_USERS, ...readCustomUsers()]
}

function findUserRecord(loginId: string): StoredUser | undefined {
  const normalized = normalizeLoginId(loginId)
  const inCustom = readCustomUsers().find((user) => user.normalizedId === normalized)
  if (inCustom) return inCustom
  return BASE_USERS.find((user) => user.normalizedId === normalized)
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

export const DEMO_ACCOUNTS = SEED_USERS.map(({ id, name, room }) => ({ id, name, room }))

export function subscribeAuth(listener: (user: AuthUser | null) => void) {
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

export function getCurrentUser(): AuthUser | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as AuthUser | null
    if (saved?.id) return saved
    const savedId = localStorage.getItem(AUTH_USER_KEY)
    if (!savedId) return null
    const found = findUserRecord(savedId)
    if (!found) return null
    return { id: found.id, name: found.name, room: found.room }
  } catch {
    return null
  }
}

export function getCurrentUserId(): string | null {
  return getCurrentUser()?.id ?? null
}

export function setCurrentUser(id: string) {
  const record = findUserRecord(id)
  if (!record) {
    throw new Error("Unknown user")
  }
  const profile: AuthUser = { id: record.id, name: record.name, room: record.room }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  localStorage.setItem(AUTH_USER_KEY, record.id)
  notifyAuth(profile)
}

export function logout() {
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  notifyAuth(null)
}

export async function loginWithCredentials({ id, password }: { id: string; password: string }) {
  const record = findUserRecord(id)
  await new Promise((resolve) => setTimeout(resolve, 300))
  if (!record || record.password !== password) {
    throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.")
  }
  setCurrentUser(record.id)
  return { id: record.id, name: record.name, room: record.room }
}

export type RegisterInput = {
  id: string
  password: string
  name: string
  room: string
  email?: string
  phone?: string
  personalNo?: string
}

export async function registerUser(input: RegisterInput) {
  const normalized = normalizeLoginId(input.id)
  const existing = getAllUsers()
  if (existing.some((user) => user.normalizedId === normalized)) {
    throw new Error("이미 사용 중인 아이디입니다.")
  }

  const newUser: StoredUser = {
    id: input.id,
    name: input.name,
    room: input.room,
    password: input.password,
    email: input.email,
    phone: input.phone,
    personalNo: input.personalNo,
    createdAt: Date.now(),
    normalizedId: normalized,
  }

  const customUsers = readCustomUsers()
  customUsers.push(newUser)
  writeCustomUsers(customUsers)
  await new Promise((resolve) => setTimeout(resolve, 300))
  return { id: newUser.id, name: newUser.name, room: newUser.room }
}

export function resetAuthDemo() {
  localStorage.removeItem(CUSTOM_USERS_KEY)
  authListeners.clear()
}
