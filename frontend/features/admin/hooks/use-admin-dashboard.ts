import { useEffect, useState } from "react"
import { fetchAdminDashboard, type AdminDashboardResponse } from "../api"

export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const response = await fetchAdminDashboard()
        if (!active) return
        setData(response)
      } catch (err) {
        if (!active) return
        setError(err)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return { data, loading, error }
}
