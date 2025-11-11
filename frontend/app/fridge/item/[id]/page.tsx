import { redirect } from "next/navigation"

type ItemDetailRedirectPageProps = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function ItemDetailRedirectPage({ params, searchParams }: ItemDetailRedirectPageProps) {
  const query = new URLSearchParams()
  query.set("item", params.id)
  const editParam = Array.isArray(searchParams.edit) ? searchParams.edit[0] : searchParams.edit
  if (editParam === "1") {
    query.set("itemEdit", "1")
  }
  const target = query.toString() ? `/fridge?${query.toString()}` : "/fridge"
  redirect(target)
}
