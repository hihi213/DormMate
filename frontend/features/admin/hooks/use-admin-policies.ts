import { useCallback, useEffect, useState } from "react"
import { fetchAdminPolicies, type AdminPoliciesResponse } from "../api"

export function useAdminPolicies() {
  const [data, setData] = useState<AdminPoliciesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchAdminPolicies()
      setData(response)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchAdminPolicies()
        if (cancelled) return
        setData(response)
      } catch (err) {
        if (cancelled) return
        setError(err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const refetch = useCallback(() => load(), [load])

  return { data, loading, error, refetch }
}
