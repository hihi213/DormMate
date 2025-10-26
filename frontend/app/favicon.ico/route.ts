export async function GET(request: Request) {
  // Serve our PNG icon for /favicon.ico to avoid 404.
  const origin = new URL(request.url).origin
  const pngUrl = `${origin}/icons/icon-192.png`
  const res = await fetch(pngUrl)
  const buf = await res.arrayBuffer()
  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
