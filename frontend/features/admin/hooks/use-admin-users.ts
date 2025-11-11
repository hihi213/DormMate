import { useEffect, useState } from "react"
import { fetchAdminUsers, type AdminUsersResponse, type FetchAdminUsersParams } from "../api"

export function useAdminUsers(params: FetchAdminUsersParams = { status: "ACTIVE" }) {
  const [data, setData] = useState<AdminUsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = async (currentParams: FetchAdminUsersParams) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchAdminUsers(currentParams)
      setData(response)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const serializedParams = JSON.stringify(params)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetchAdminUsers(params)
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
  }, [serializedParams])

  const refetch = () => load(params)

  return { data, loading, error, refetch }
}
