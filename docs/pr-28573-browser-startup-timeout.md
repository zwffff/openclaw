# PR Template: Browser startup timeout race condition (#28573)

## Summary

Describe the problem and fix in 2–5 bullets:

- **Problem:** In some Docker + Chromium environments, D-Bus initialization and SingletonLock handling can stall Chromium startup long enough that the browser control service fails to bind its CDP port (default 18800) within the hardcoded 15s timeout. Browser control HTTP calls then report "Can't reach the OpenClaw browser control service (timed out after …ms)" even though the browser is still starting.
- **Why it matters:** Agents relying on browser automation inside containers see flaky timeouts and CDP errors: sometimes the browser eventually becomes ready, but the agent has already given up at 15s, breaking long-running scraping or navigation tasks.
- **What changed:** Introduced `DEFAULT_BROWSER_CONTROL_REQUEST_TIMEOUT_MS = 45_000` and used it as the default for browser control HTTP requests, including browser start/stop, profile management, open-tab and snapshot calls, as well as the internal `fetchBrowserJson`/`fetchHttpJson` timeout when no explicit `timeoutMs` is provided. CLI browser management commands (`openclaw browser start/stop/open`) were also aligned with the 45s default.
- **What did NOT change (scope boundary):** No new configuration surface was added; CDP/remote browser–specific timeouts (`remoteCdpTimeoutMs`, node proxy timeouts, etc.) are unchanged; gateway server behavior and authentication remain the same.

## Change Type (select all)

- [x] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Docs
- [ ] Security hardening
- [ ] Chore/infra

## Scope (select all touched areas)

- [x] Skills / tool execution
- [ ] Gateway / orchestration
- [ ] Auth / tokens
- [ ] Memory / storage
- [ ] Integrations
- [ ] API / contracts
- [ ] UI / DX
- [ ] CI/CD / infra

## Linked Issue/PR

- Closes #28573
- Related #

## User-visible / Behavior Changes

- Browser control HTTP requests involved in starting/stopping the browser, managing profiles, opening tabs, and taking snapshots now use a **45s** default timeout instead of 15s/20s when the caller does not override `timeoutMs`. This reduces spurious "Can't reach the OpenClaw browser control service (timed out after …ms)" and CDP start failures on slower or more contended Docker hosts. No new config flags were introduced; callers that explicitly pass `timeoutMs` are unchanged.

## Security Impact (required)

- New permissions/capabilities? **No**
- Secrets/tokens handling changed? **No**
- New/changed network calls? **No** (same endpoints, longer wait only)
- Command/tool execution surface changed? **No**
- Data access scope changed? **No**
- If any Yes, explain risk + mitigation: N/A

## Repro + Verification

### Environment

- OS: Linux (issue reported on RHEL 9.6 inside Docker), but applicable to other containerized environments.
- Runtime/container: Docker with Chromium installed and configured for browser control.
- Model/provider: Any (symptoms are about browser startup, not the model).
- Integration/channel (if any): Agent using browser tools to navigate/scrape pages.
- Relevant config (redacted): `browser.enabled: true` (default) and a profile pointing to CDP port 18800.

### Steps

1. Run the OpenClaw gateway inside a Docker container with Chromium installed and configured for CDP on port 18800, persisting its user-data-dir on a volume.
2. Use an agent that performs browser actions (navigate/snapshot/scrape) so that it needs to start or reuse the `openclaw` browser profile.
3. Under some runs (especially after image updates or on cold start), observe that Chromium D-Bus / SingletonLock handling delays CDP startup beyond 15s.
4. Before this fix, the agent/browser tools would often fail with a timeout or CDP error around the 15s mark; after this fix, the same flows can succeed up to 45s.

### Expected

- Browser control requests tolerate slower Chromium startup inside Docker: if the browser eventually binds CDP port 18800 within ~45s, the agent completes its task instead of failing early at 15s.

### Actual (before fix)

- Intermittent "Can't reach the OpenClaw browser control service (timed out after 15000ms)." or downstream CDP connection errors, even when the browser eventually becomes ready.

## Evidence

Attach at least one:

- [x] Existing test suite (`pnpm check`) passes; fix is a change to timeout defaults and call sites only.
- [ ] Trace/log snippets showing delayed Chromium startup and post-fix successful runs.
- [ ] Screenshot/recording
- [ ] Perf numbers (if relevant)

## Human Verification (required)

- **Verified scenarios:** `pnpm check` (format, type-check, lint, policy checks) on the new branch; `pnpm openclaw gateway status --json` completes successfully; inspected all browser control client and CLI call sites to ensure they use the new default timeout where appropriate.
- **Edge cases checked:** Callers that pass an explicit `timeoutMs` remain unchanged; node-hosted browser proxy timeouts still use their own safeguards; non-browser HTTP flows are not affected.
- **What you did not verify:** Full end-to-end browser automation in all container environments and OS distributions; environments with heavily customized Chromium flags or non-default CDP ports.

## Compatibility / Migration

- Backward compatible? **Yes**
- Config/env changes? **No**
- Migration needed? **No**
- If yes, exact upgrade steps: N/A

## Failure Recovery (if this breaks)

- **How to disable/revert:** Revert this PR's commit; or locally lower `DEFAULT_BROWSER_CONTROL_REQUEST_TIMEOUT_MS` in `src/browser/constants.ts` back to 20_000 or 15_000 if a shorter timeout is required for specific automation.
- **Files/config to restore:** `src/browser/constants.ts`, `src/browser/client-fetch.ts`, `src/browser/client.ts`, `src/cli/browser-cli-manage.ts`.
- **Known bad symptoms:** If 45s is still too short for some environments, very slow or stuck Chromium processes will still surface as timeouts; in that case, host-level browser/DBus diagnosis is required, as it is out of scope for this change.

## Risks and Mitigations

- **Risk:** Longer default timeouts mean that genuine failures where the browser control service is unreachable will be detected up to 45s later, which may slow down failure handling in some cases.
  - **Mitigation:** 45s is still a bounded timeout and aligns with realistic browser cold-start behavior under load; explicit `timeoutMs` overrides remain available for callers that need stricter SLAs. Abort signals and higher-level agent timeouts are unchanged.

