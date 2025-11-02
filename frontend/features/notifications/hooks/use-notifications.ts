"use client"

import { useCallback } from "react"
import type { NotificationPreferenceUpdateInput, NotificationStateFilter } from "@/features/notifications/types"
import { useNotificationStore } from "@/stores/notifications-store"

export function useNotifications() {
  const items = useNotificationStore((store) => store.items)
  const page = useNotificationStore((store) => store.page)
  const size = useNotificationStore((store) => store.size)
  const totalElements = useNotificationStore((store) => store.totalElements)
  const unreadCount = useNotificationStore((store) => store.unreadCount)
  const loading = useNotificationStore((store) => store.loading)
  const error = useNotificationStore((store) => store.error)
  const filter = useNotificationStore((store) => store.filter)
  const actions = useNotificationStore((store) => store.actions)

  const load = useCallback((params?: Partial<{ state: NotificationStateFilter; page: number; size: number }>) => {
    return actions.load(params)
  }, [actions])

  const ensureLoaded = useCallback((params?: Partial<{ state: NotificationStateFilter; page: number; size: number }>) => {
    return actions.ensureLoaded(params)
  }, [actions])

  const refresh = useCallback(() => {
    return actions.refresh()
  }, [actions])

  const setFilter = useCallback((next: NotificationStateFilter) => {
    return actions.setFilter(next)
  }, [actions])

  const markAsRead = useCallback((id: string) => {
    return actions.markAsRead(id)
  }, [actions])

  const markAllAsRead = useCallback(() => {
    return actions.markAllAsRead()
  }, [actions])

  const resetError = useCallback(() => {
    actions.resetError()
  }, [actions])

  return {
    items,
    page,
    size,
    totalElements,
    unreadCount,
    loading,
    error,
    filter,
    load,
    setFilter,
    ensureLoaded,
    refresh,
    markAsRead,
    markAllAsRead,
    resetError,
  }
}

export function useNotificationPreferences() {
  const preferences = useNotificationStore((store) => store.preferences)
  const loading = useNotificationStore((store) => store.preferencesLoading)
  const error = useNotificationStore((store) => store.preferenceError)
  const actions = useNotificationStore((store) => store.actions)

  const loadPreferences = useCallback(() => {
    return actions.loadPreferences()
  }, [actions])

  const updatePreference = useCallback((kindCode: string, payload: NotificationPreferenceUpdateInput) => {
    return actions.savePreference(kindCode, payload)
  }, [actions])

  const resetPreferenceError = useCallback(() => {
    actions.resetPreferenceError()
  }, [actions])

  return {
    preferences,
    loading,
    error,
    loadPreferences,
    updatePreference,
    resetPreferenceError,
  }
}
