## Summary

Describe the problem and fix in 2–5 bullets:

- **Problem:** When session history contains assistant tool calls without matching tool results, the repair pipeline inserts synthetic `toolResult` messages marked as errors. During config reloads or auto-compaction, these synthetic error results can be surfaced as real tool failures, confusing users and making it appear as if the session has crashed with “missing tool result in session history” errors.
- **Why it matters:** Editing `~/.openclaw/openclaw.json` or triggering compaction on long-running sessions should not corrupt or terminate the session. Synthetic repair artifacts are implementation details and must not be treated as user-facing tool failures, otherwise configuration changes and history hygiene can unexpectedly break multi-agent workflows.
- **What changed:** Adjusted the session transcript repair logic so that synthetic tool results created to satisfy strict provider pairing requirements are no longer flagged as `isError: true`. These synthetic entries are still inserted to keep `tool_use` / `tool_result` pairing valid, but are now treated as non-fatal for downstream tooling, compaction safeguards, and payload builders.
- **What did NOT change (scope boundary):** Real tool failures (including exec/browser/session tools) are still surfaced with `isError: true` and continue to participate in compaction failure summaries and user-facing warnings; session persistence format and provider routing behavior are otherwise unchanged.

## Change Type (select all)

- [x] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Docs
- [ ] Security hardening
- [ ] Chore/infra

## Scope (select all touched areas)

- [x] Skills / tool execution
- [x] Gateway / orchestration
- [ ] Auth / tokens
- [ ] Memory / storage
- [ ] Integrations
- [ ] API / contracts
- [ ] UI / DX
- [ ] CI/CD / infra

## Linked Issue/PR

- Closes #28520
- Related #

## User-visible / Behavior Changes

List user-visible changes (including defaults/config).  
If none, write `None`.

- Synthetic “missing tool result in session history; inserted synthetic error result for transcript repair.” entries created during transcript repair are no longer treated as fatal tool errors. They still exist in the session history for strict providers, but do not appear as hard errors in chat payloads or compaction summaries.
- Real tool failures (where the underlying tool actually errored) remain unchanged: they still set `isError: true`, are included in compaction safeguard “Tool Failures” sections, and can be surfaced as warnings in chat responses.

## Security Impact (required)

- New permissions/capabilities? **No**
- Secrets/tokens handling changed? **No**
- New/changed network calls? **No**
- Command/tool execution surface changed? **No**
- Data access scope changed? **No**
- If any Yes, explain risk + mitigation:

All No; no security impact expected.

## Repro + Verification

### Environment

- OS: macOS / Linux (any; issue reported on macOS 26.2)
- Runtime/container: local gateway with long-lived sessions
- Model/provider: Anthropic-compatible / OpenAI-compatible models via `pi-embedded-runner`
- Integration/channel (if any): Web UI / chat-based sessions
- Relevant config (redacted): `~/.openclaw/openclaw.json` with default agent/session settings

### Steps

1. Start the OpenClaw gateway and open a chat session that executes at least one tool call.
2. Ensure session history persists (e.g. by letting auto-compaction run or by reusing the same session key).
3. Edit `~/.openclaw/openclaw.json` or otherwise trigger a configuration reload / gateway restart.
4. Resume the same session and send a new message, letting `sanitizeSessionHistory` repair the transcript.

### Expected

- Session history repair silently inserts synthetic tool results where needed to satisfy provider requirements, but these synthetic entries are treated as non-fatal and do not appear as user-facing tool errors or crash messages.

### Actual (before fix)

- Synthetic “missing tool result in session history” entries were marked `isError: true`, causing them to be treated as real tool failures. In some flows this surfaced as confusing error output or apparent session crashes tied to configuration edits or compaction.

## Evidence

Attach at least one:

- [x] Existing test suite (`pnpm check`) passes; change is limited to error-flagging behavior of synthetic repair entries.
- [ ] Failing test/log before + passing after
- [ ] Trace/log snippets
- [ ] Screenshot/recording
- [ ] Perf numbers (if relevant)

## Human Verification (required)

What you personally verified (not just CI), and how:

- Verified scenarios: `pnpm check` (format, type-check, lint, policy checks) on `fix/28520-session-history-repair-upstream`; `timeout 20 pnpm openclaw gateway status --json` against a local config to ensure agent startup is still healthy.
- Edge cases checked: Confirmed that only synthetic repair-generated tool results are downgraded from `isError: true` to `isError: false`; real tool failures still surface as errors.
- What you did **not** verify: Full end-to-end reproduction with live long-running sessions and compaction under all supported providers; those flows remain covered by existing transcript hygiene tests.

## Compatibility / Migration

- Backward compatible? **Yes**
- Config/env changes? **No**
- Migration needed? **No**
- If yes, exact upgrade steps:

N/A

## Failure Recovery (if this breaks)

- How to disable/revert this change quickly: Revert the commit that changes `makeMissingToolResult` in `src/agents/session-transcript-repair.ts` back to marking synthetic results as errors.
- Files/config to restore: `src/agents/session-transcript-repair.ts` (and any accompanying tests/docs for #28520).
- Known bad symptoms reviewers should watch for: If synthetic repair entries are misclassified, transcript hygiene may either over-report or under-report tool failures during history repair and compaction.

## Risks and Mitigations

List only real risks for this PR. Add/remove entries as needed. If none, write `None`.

- Risk: Downgrading synthetic repair entries from `isError: true` to `isError: false` might hide cases where a truly missing tool result should have been surfaced as a visible failure instead of silently repaired.
  - Mitigation: Real tool failures still carry `isError: true` and include concrete output/metadata; synthetic entries use a fixed diagnostic message and are only created when the transcript is already inconsistent. For debugging low-level transcript issues, session logs continue to contain the full repair-related text.

