# Testing: Sign in & accounts

**Scope:** Firebase email/password + Google login (`react/app/loginAuth/login.tsx`)  
**Last updated:** 2026-07-26  
**CI:** shared pipeline — see [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| — | 0 | Auth is Firebase SDK; little pure logic to unit-test |

## Integration tests

| Case | Status |
|------|--------|
| Server-side Firebase token verification | Not implemented (listed under What’s next) |

## End-to-end testing

| Journey | Tool | Status |
|---------|------|--------|
| With `VITE_E2E_BYPASS_AUTH`, `/` enters signed-in shell | Playwright | Automated (CI) |
| `/home` loads under bypass (no Application Error) | Playwright | Automated (CI) |
| Login branding + Enter Capingo | Playwright (`login-form` project) | Automated (CI) |
| Full email/Google login with real keys | Manual | Documented |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Toggle register ↔ sign-in | Form labels switch to Join Capingo / Create Account | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Wrong password / bad credentials | `.error-message` shown | Automated (stub Firebase keys) |
| Missing Firebase env in CI | Stubbed keys allow page mount | Automated smoke |

## Screenshots

- [`evidence/features/auth-accounts/`](./evidence/features/auth-accounts/) — `e2e-login-form`, `edge-register-toggle`, `failure-bad-credentials`, `e2e-bypass-home`
- Results: [`evidence/features/auth-accounts/results.txt`](./evidence/features/auth-accounts/results.txt)

## CI pipeline

Covered by the **E2E** job (`signed-in` + `login-form` projects).

## Code coverage reports

N/A for auth module (no unit surface).
