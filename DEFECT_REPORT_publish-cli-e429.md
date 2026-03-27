# Defect Report: publish-cli workflow blocked by npm E429 rate limits

**Date:** 2026-03-26
**Severity:** High — blocks v1.2.27 release completion
**Component:** `.github/workflows/publish-cli.yml` → "Publish platform packages" step
**Repository:** `dragonsarealive/iris-ai`

---

## Summary

The `publish-cli` workflow cannot publish 3 of 12 platform-specific npm packages (`iris-code-*`) due to persistent **HTTP 429 (Too Many Requests)** responses from the npm registry. The workflow exhausts all 8 retry attempts and fails, leaving the release incomplete.

---

## Current State

### CI health on `dev` (all GREEN)

| Workflow    | Status  |
|-------------|---------|
| test        | success |
| typecheck   | success |
| nix-eval    | success |

### npm packages (9 of 12 published)

| Package                             | Status    |
|-------------------------------------|-----------|
| iris-code-darwin-arm64@1.2.27       | published |
| iris-code-darwin-x64@1.2.27         | published |
| iris-code-darwin-x64-baseline@1.2.27| published |
| iris-code-linux-arm64@1.2.27        | published |
| iris-code-linux-arm64-musl@1.2.27   | published |
| iris-code-linux-x64-baseline@1.2.27 | published |
| iris-code-linux-x64-baseline-musl@1.2.27 | published |
| iris-code-linux-x64-musl@1.2.27     | published |
| iris-code-windows-x64@1.2.27        | published |
| **iris-code-linux-x64@1.2.27**      | **MISSING** |
| **iris-code-windows-arm64@1.2.27**   | **MISSING** |
| **iris-code-windows-x64-baseline@1.2.27** | **MISSING** |

### GitHub Release assets (incomplete)

| Asset                     | Present |
|---------------------------|---------|
| iris-code-windows-x64.zip | yes     |
| All other platform archives | **no** — "Upload release artifacts" step never runs because publish step fails first |

### Wrapper package

`iris-code@1.2.27` is on npm (published manually in earlier session) with all 12 platform optional dependencies declared, but 3 of those resolve to nothing.

---

## Reproduction

### Run 1 — `23610734700` (18:14 UTC)

- **build-cli**: success (1m26s)
- **publish-sdk**: success (23s, version already exists → skipped)
- **publish-plugin**: success (20s, version already exists → skipped)
- **publish-cli**: **failure** (37m26s)
  - 9 packages skipped (already on npm from earlier partial runs)
  - `iris-code-linux-x64`: **E429 on all 8 attempts** (attempts 1–8, delays 90s → 135s → 180s → 225s → 270s → 315s → 360s)
  - Never reached `windows-arm64` or `windows-x64-baseline`
  - "Publish wrapper package" and "Upload release artifacts" never executed

### Run 2 — `23612582452` (18:56 UTC)

- **build-cli**: success (1m29s)
- **publish-sdk**: success (25s, skipped)
- **publish-plugin**: success (30s, skipped)
- **publish-cli**: **in progress** (25+ minutes at time of report, still on "Publish platform packages")
  - Same 9 packages skipped
  - Stuck on `iris-code-linux-x64` again (expected given the large package size and rate-limit state)

---

## Root Cause Analysis

1. **Package size:** Each platform binary is ~47 MB compressed (~141 MB unpacked). npm rate-limits large uploads more aggressively.

2. **Cumulative rate pressure:** The first few successful runs published 9 large packages in quick succession (even with 90s inter-package sleeps), burning through the rate-limit budget for the npm token/account.

3. **No backoff reset between runs:** Re-triggering the workflow does not reset the npm rate-limit window. The skip-if-already-published logic prevents redundant uploads, but the rate limit persists from earlier uploads.

4. **Linear retry in the same step:** The publish script publishes packages sequentially. A failure on package N blocks packages N+1…12 and all subsequent steps (wrapper publish, asset upload).

---

## Impact

- **Linux x64 users** cannot `npm install iris-code` and get a working binary (the most common platform).
- **Windows ARM64 / x64 baseline users** similarly affected.
- **GitHub Release** only has a Windows x64 zip — no Linux/macOS archives for direct download.
- **Homebrew formula** cannot be created without release archives.

---

## Recommended Fixes

### Immediate (unblock v1.2.27)

1. **Wait and re-dispatch.** npm rate limits typically reset within 15–60 minutes. After the current run finishes (success or failure), wait 30 minutes, then:
   ```bash
   gh workflow run publish-cli.yml --repo dragonsarealive/iris-ai --ref dev \
     -f version=1.2.27 -f channel=latest
   ```
   The 9 already-published packages will be skipped. Only the 3 missing packages will attempt publish.

2. **Manual local publish as fallback.** If CI retries keep failing, publish the 3 packages from a local machine:
   ```bash
   # Download the cli-dist artifact from a successful build-cli job
   gh run download <run-id> --repo dragonsarealive/iris-ai -n cli-dist -D dist

   # Publish one at a time with long waits
   cd dist/iris-code-linux-x64 && bun pm pack && npm publish *.tgz --access public --tag latest
   # wait 5 minutes
   cd ../iris-code-windows-arm64 && bun pm pack && npm publish *.tgz --access public --tag latest
   # wait 5 minutes
   cd ../iris-code-windows-x64-baseline && bun pm pack && npm publish *.tgz --access public --tag latest
   ```
   Then re-trigger the workflow so the "Upload release artifacts" step can run (all publishes will be skipped, and it proceeds to archive + upload).

### Workflow improvements (future releases)

3. **Continue on publish failure.** Change the publish loop to track failures but not `exit 1` mid-loop. Publish remaining packages even if one fails, then fail at the end with a summary. This prevents a single rate-limited package from blocking the rest.

4. **Increase initial sleep.** The current 90s inter-package delay is insufficient for 47 MB packages. Consider 120–180s between publishes.

5. **Separate the upload step.** The "Upload release artifacts" step does not depend on npm publish success — it only needs the built binaries (already in the `cli-dist` artifact). Moving it before or parallel to npm publish ensures GitHub Release assets are always uploaded even if npm is rate-limiting.

6. **Split into per-platform jobs.** Instead of one `publish-cli` job publishing 12 packages serially, use a matrix strategy with one job per platform. Each job has its own rate-limit budget and can retry independently.

---

## Verification Checklist (after fix)

- [ ] `npm view iris-code-linux-x64@1.2.27 version` → `1.2.27`
- [ ] `npm view iris-code-windows-arm64@1.2.27 version` → `1.2.27`
- [ ] `npm view iris-code-windows-x64-baseline@1.2.27 version` → `1.2.27`
- [ ] `gh release view v1.2.27 --json assets` shows 12+ archives (zip/tar.gz)
- [ ] `npm install -g iris-code@1.2.27` on Linux x64 → `iris-code --version` → `1.2.27`
- [ ] Homebrew formula updated with real URLs + sha256
