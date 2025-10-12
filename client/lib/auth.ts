export type AuthUser = { id: string; name: string; room: string }

export const USERS: Record<string, AuthUser & { password: string }> = {
  "1": { id: "1", password: "1", name: "김승현", room: "301호" },
  "2": { id: "2", password: "2", name: "이번", room: "202호" },
  "3": { id: "3", password: "3", name: "삼번", room: "203호" },
}

const PROFILE_KEY = "user-profile"
const AUTH_USER_KEY = "auth-user"

export function getCurrentUser(): AuthUser | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as AuthUser | null
    if (saved?.id) return saved
    const uid = localStorage.getItem(AUTH_USER_KEY)
    if (uid && USERS[uid]) {
      const { id, name, room } = USERS[uid]
      return { id, name, room }
    }
  } catch {}
  return null
}

export function getCurrentUserId(): string | null {
  const u = getCurrentUser()
  return u?.id ?? null
}

export function setCurrentUser(id: string) {
  const u = USERS[id]
  if (!u) return
  const profile: AuthUser = { id: u.id, name: u.name, room: u.room }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  localStorage.setItem(AUTH_USER_KEY, u.id)
}

export function logout() {
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}
