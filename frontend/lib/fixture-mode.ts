/** Fixtures are development-only and must be explicitly enabled at startup. */
export function isFixtureMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_FIXTURE === "1"
}
