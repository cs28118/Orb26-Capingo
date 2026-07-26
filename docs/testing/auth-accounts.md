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
| Login page renders Capingo branding + Enter Capingo button | Playwright `e2e/login.spec.ts` | Automated (CI) |
| Full email/Google login | Manual / needs real Firebase keys | Documented |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Toggle register ↔ sign-in | Form labels switch | Manual |
| Stay signed in after refresh | Firebase persistence | Manual |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Wrong password | Firebase auth error in UI | Manual |
| Missing Firebase env in CI | Stubbed keys allow page mount; real auth still fails until secrets added | Automated smoke uses stubs |

## Screenshots

- [`evidence/e2e/login-page.png`](./evidence/e2e/login-page.png)

## CI pipeline

Covered by the **E2E** job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

## Code coverage reports

N/A for auth module (no unit surface). Overall frontend coverage focuses on `sm2.ts`.
