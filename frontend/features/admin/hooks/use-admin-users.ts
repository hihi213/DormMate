import { useEffect, useState } from "react"
import { fetchAdminUsers, type AdminUsersResponse, type AdminUserStatusFilter } from "../api"

export function useAdminUsers(status: AdminUserStatusFilter = "ACTIVE") {
  const [data, setData] = useState<AdminUsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = async (currentStatus: AdminUserStatusFilter) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchAdminUsers(currentStatus)
      setData(response)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchAdminUsers(status)
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
  }, [status])

  const refetch = () => load(status)

  return { data, loading, error, refetch }
}
