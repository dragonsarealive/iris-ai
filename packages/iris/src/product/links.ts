/** User-facing URLs; override with IRIS_DOCS_URL / IRIS_ISSUES_URL when the fork has its own site. */
export function docsUrl() {
  return process.env["IRIS_DOCS_URL"] ?? "https://opencode.ai/docs"
}

export function issueNewUrl() {
  const raw = process.env["IRIS_ISSUES_URL"]
  if (raw) return raw.includes("?") ? raw : `${raw}?template=bug-report.yml`
  return "https://github.com/dragonsarealive/iris-ai/issues/new?template=bug-report.yml"
}
