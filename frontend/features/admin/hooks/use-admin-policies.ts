import { useEffect, useState } from "react"
import { fetchAdminPolicies, type AdminPoliciesResponse } from "../api"

export function useAdminPolicies() {
  const [data, setData] = useState<AdminPoliciesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const response = await fetchAdminPolicies()
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
