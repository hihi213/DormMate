export async function GET(_: Request, { params }: { params: { bundleId: string } }) {
  return Response.json(
    {
      message: `Fixture bundle ${params.bundleId} is not available.`,
      code: "FIXTURE_BUNDLE_NOT_FOUND",
    },
    { status: 404 },
  )
}
