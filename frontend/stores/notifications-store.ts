import { create } from "zustand"
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotificationPreference,
} from "@/features/notifications/api"
import type {
  Notification,
  NotificationActionResult,
  NotificationList,
  NotificationPreference,
  NotificationPreferenceUpdateInput,
  NotificationState,
  NotificationStateFilter,
} from "@/features/notifications/types"
import { subscribeAuth } from "@/lib/auth"

const DEFAULT_PAGE_SIZE = 20

export type NotificationStoreState = {
  items: Notification[]
  page: number
  size: number
  totalElements: number
  unreadCount: number
  filter: NotificationStateFilter
  loading: boolean
  error?: string
  preferences: NotificationPreference[]
  preferencesLoading: boolean
  preferenceError?: string
  lastFetchedAt?: number
  initialized: boolean
  query: {
    state: NotificationStateFilter
    page: number
    size: number
  }
}

export type NotificationStoreActions = {
  load: (params?: Partial<{ state: NotificationStateFilter; page: number; size: number }>) => Promise<NotificationActionResult<NotificationList>>
  ensureLoaded: (params?: Partial<{ state: NotificationStateFilter; page: number; size: number }>) => Promise<NotificationActionResult<NotificationList>>
  refresh: () => Promise<NotificationActionResult<NotificationList>>
  setFilter: (next: NotificationStateFilter) => Promise<NotificationActionResult<NotificationList>>
  markAsRead: (notificationId: string) => Promise<NotificationActionResult<{ notification: Notification | null }>>
  markAllAsRead: () => Promise<NotificationActionResult>
  loadPreferences: () => Promise<NotificationActionResult<NotificationPreference[]>>
  savePreference: (
    kindCode: string,
    payload: NotificationPreferenceUpdateInput,
  ) => Promise<NotificationActionResult<NotificationPreference>>
  resetError: () => void
  resetPreferenceError: () => void
  resetStore: () => void
}

export type NotificationStore = NotificationStoreState & {
  actions: NotificationStoreActions
}

const initialState: NotificationStoreState = {
  items: [],
  page: 0,
  size: DEFAULT_PAGE_SIZE,
  totalElements: 0,
  unreadCount: 0,
  filter: "all",
  loading: false,
  preferences: [],
  preferencesLoading: false,
  initialized: false,
  query: {
    state: "all",
    page: 0,
    size: DEFAULT_PAGE_SIZE,
  },
}

function applyNotificationList(state: NotificationStoreState, list: NotificationList): NotificationStoreState {
  return {
    ...state,
    items: list.items,
    page: list.page,
    size: list.size,
    totalElements: list.totalElements,
    unreadCount: list.unreadCount,
    loading: false,
    error: undefined,
    query: {
      state: state.filter,
      page: list.page,
      size: list.size,
    },
    lastFetchedAt: Date.now(),
  }
}

function decrementUnread(source: NotificationStoreState, amount = 1): number {
  return Math.max(source.unreadCount - amount, 0)
}

export const useNotificationStore = create<NotificationStore>((set, get) => {
  const resetState = () => {
    const { actions } = get()
    set({
      ...initialState,
      actions,
    })
  }

  return {
    ...initialState,
    actions: {
      async load(params) {
      const current = get()
      const merged: { state: NotificationStateFilter; page: number; size: number } = {
        state: params?.state ?? current.query.state ?? current.filter,
        page: typeof params?.page === "number" ? Math.max(params.page, 0) : current.query.page ?? 0,
        size: typeof params?.size === "number" ? Math.max(params.size, 1) : current.query.size ?? current.size ?? DEFAULT_PAGE_SIZE,
      }

      set((state) => ({
        ...state,
        loading: true,
        error: undefined,
        filter: merged.state,
        query: merged,
      }))

      const result = await fetchNotifications(merged)

      if (!result.success || !result.data) {
        set((state) => ({
          ...state,
          loading: false,
          error: result.error ?? "알림 정보를 불러오지 못했습니다.",
        }))
        return result
      }

      const list = result.data

      set((state) => applyNotificationList(state, list))

      set((state) => ({
        ...state,
        initialized: true,
      }))

      return { success: true, data: list }
    },
    async ensureLoaded(params) {
      const state = get()
      const { actions } = get()

      if (!state.initialized) {
        return actions.load(params)
      }

      if (params) {
        const nextState = params.state ?? state.query.state
        const nextPage = typeof params.page === "number" ? Math.max(params.page, 0) : state.query.page
        const nextSize = typeof params.size === "number" ? Math.max(params.size, 1) : state.query.size

        if (nextState !== state.query.state || nextPage !== state.query.page || nextSize !== state.query.size) {
          return actions.load({ state: nextState, page: nextPage, size: nextSize })
        }
      }

      if (state.loading) {
        return { success: true }
      }

      const stale = !state.lastFetchedAt || Date.now() - state.lastFetchedAt > 60_000
      if (stale) {
        return actions.load(state.query)
      }

      return { success: true }
    },
    async refresh() {
      const { query, actions } = get()
      return actions.load({ ...query })
    },
    async setFilter(nextState) {
      const normalized = (nextState ?? "all").toLowerCase() as NotificationStateFilter
      const { query, actions } = get()
      return actions.load({ state: normalized, page: 0, size: query.size })
    },
    async markAsRead(notificationId) {
      const apiResult = await markNotificationAsRead(notificationId)
      if (!apiResult.success) {
        return {
          success: false,
          error: apiResult.error,
          code: apiResult.code,
        }
      }

      set((state) => {
        const nowIso = new Date().toISOString()
        let updated = false
        const items = state.items.map((item) => {
          if (item.id !== notificationId) return item
          updated = true
          return {
            ...item,
            state: "READ" as NotificationState,
            readAt: nowIso,
          }
        })

        return {
          ...state,
          items,
          unreadCount: updated ? decrementUnread(state) : state.unreadCount,
        }
      })

      const updatedItem = get().items.find((item) => item.id === notificationId) ?? null
      return { success: true, data: { notification: updatedItem } }
    },
    async markAllAsRead() {
      const result = await markAllNotificationsAsRead()
      if (!result.success) {
        return result
      }

      const nowIso = new Date().toISOString()
      set((state) => ({
        ...state,
        items: state.items.map((item) => ({
          ...item,
          state: "READ" as NotificationState,
          readAt: item.readAt ?? nowIso,
        })),
        unreadCount: 0,
      }))

      return { success: true }
    },
    async loadPreferences() {
      set((state) => ({
        ...state,
        preferencesLoading: true,
        preferenceError: undefined,
      }))

      const result = await fetchNotificationPreferences()

      if (!result.success || !result.data) {
        set((state) => ({
          ...state,
          preferencesLoading: false,
          preferenceError: result.error ?? "알림 설정을 불러오지 못했습니다.",
        }))
        return result
      }

      const preferences = result.data

      set((state) => ({
        ...state,
        preferencesLoading: false,
        preferenceError: undefined,
        preferences: preferences,
      }))

      return { success: true, data: preferences }
    },
    async savePreference(kindCode, payload) {
      const result = await updateNotificationPreference(kindCode, payload)
      if (!result.success || !result.data) {
        set((state) => ({
          ...state,
          preferenceError: result.error ?? "알림 설정을 변경하지 못했습니다.",
        }))
        return result
      }

      const updatedPreference = result.data

      set((state) => {
        const updatedList = state.preferences.some((item) => item.kindCode === updatedPreference.kindCode)
          ? state.preferences.map((item) => (item.kindCode === updatedPreference.kindCode ? updatedPreference : item))
          : [...state.preferences, updatedPreference]

        return {
          ...state,
          preferences: updatedList,
          preferenceError: undefined,
        }
      })

      return { success: true, data: updatedPreference }
    },
    resetError() {
      set((state) => ({
        ...state,
        error: undefined,
      }))
    },
    resetPreferenceError() {
      set((state) => ({
        ...state,
        preferenceError: undefined,
      }))
    },
    resetStore: resetState,
  },
}
})

if (typeof window !== "undefined") {
  subscribeAuth((user) => {
    if (!user) {
      useNotificationStore.getState().actions.resetStore()
    }
  })
}

export function selectNotificationState<T>(selector: (state: NotificationStore) => T): T {
  return selector(useNotificationStore.getState())
}
