# Tent Login Rate-limit Message Design

## Goal
Make Tent distinguish too-many-login-attempts (HTTP 429) from genuine authentication-service unavailability while preserving all existing authentication and compatibility behavior.

## Scope
- Do not alter IMS/BACBC/HD legacy login compatibility.
- Do not alter leader-account authentication rules.
- Change only the client-facing message mapping for 429.
- Keep 401 as invalid credentials and 503 as service/configuration unavailable.

## Expected behavior
- 401: show invalid username/password guidance.
- 429: show a clear message that there were too many attempts and to try again after the login cooldown.
- 503/other service failure: retain the temporary-unavailable message.
