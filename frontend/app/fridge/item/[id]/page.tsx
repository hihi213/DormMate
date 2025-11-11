"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

type ItemDetailRedirectPageProps = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function ItemDetailRedirectPage({ params, searchParams }: ItemDetailRedirectPageProps) {
  const router = useRouter()

  const target = useMemo(() => {
    const query = new URLSearchParams()
    query.set("item", params.id)
    const editParam = Array.isArray(searchParams.edit) ? searchParams.edit[0] : searchParams.edit
    if (editParam === "1") {
      query.set("itemEdit", "1")
    }
    const qs = query.toString()
    return qs ? `/fridge?${qs}` : "/fridge"
  }, [params.id, searchParams])

  useEffect(() => {
    router.replace(target)
  }, [router, target])

  return null
}
