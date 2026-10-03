# Tent Login Rate-limit Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Distinguish HTTP 429 from genuine login-service unavailability in Tent.

**Architecture:** Preserve the existing login API and authentication behavior. Add a source-level regression test for the 429 mapping, then update only `loginFailureText` in `tent-app.js`.

**Tech Stack:** Browser JavaScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-03-login-rate-limit-message-design.md`

## Global Constraints
- Do not change legacy IMS/BACBC/HD compatibility.
- Do not change leader authentication semantics.
- Do not expose credentials.

## Review Focus
- 401 remains an invalid-credentials message.
- 429 explicitly communicates too many attempts.
- 503 remains service unavailable.

### Task 1: Login error mapping

**Files:**
- Modify: `test/tent-stability.test.js`
- Modify: `tent-app.js`

- [ ] Add a failing source-level test requiring a distinct `rate_limited`/429 message.
- [ ] Update `loginFailureText` minimally.
- [ ] Run Tent stability regression and full tests.
