/**
 * Prefix a root-relative path with Next.js `basePath` (e.g. `/dotenv`).
 * `Link` / `redirect` / `router.push` do this automatically; raw `fetch("/api/...")`
 * does not, so API calls must go through this helper.
 */
export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}
