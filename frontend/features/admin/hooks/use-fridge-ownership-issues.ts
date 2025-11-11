import { useCallback, useEffect, useState } from "react"

import {
  fetchFridgeOwnershipIssues,
  type FridgeOwnershipIssueResponse,
} from "@/features/admin/api/fridge"

type HookState = {
  data: FridgeOwnershipIssueResponse | null
  loading: boolean
  error: Error | null
}

type UseFridgeOwnershipIssuesOptions = {
  size?: number
  ownerId?: string | null
}

export function useFridgeOwnershipIssues(options: UseFridgeOwnershipIssuesOptions = {}) {
  const { size = 20, ownerId } = options
  const normalizedOwnerId = ownerId?.trim() || undefined

  const [state, setState] = useState<HookState>({
    data: null,
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const response = await fetchFridgeOwnershipIssues({
        page: 0,
        size,
        ownerId: normalizedOwnerId,
      })
      setState({ data: response, loading: false, error: null })
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error("권한 불일치 정보를 불러오지 못했습니다.")
      setState({ data: null, loading: false, error: normalizedError })
    }
  }, [size, normalizedOwnerId])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refresh,
  }
}
