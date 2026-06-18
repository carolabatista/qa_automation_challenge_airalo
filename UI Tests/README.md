# Airalo UI Tests

Playwright-based end-to-end test suite for [airalo.com](https://www.airalo.com).

---

## Strategy

Tests are written using the **Page Object Model (POM)** pattern. Each page of the application is represented by a dedicated class in `pages/` that encapsulates locators and interaction logic. Specs are kept clean — they express the user journey in plain method calls, with no selector or browser detail leaking into the test body.

### Consent & overlay handling

The site displays multiple consent and marketing banners depending on the browser and session state:

- A **OneTrust** cookie consent banner (all browsers)
- A **CleverTap** (`#wzrk-cancel`) notification overlay, which appeared consistently during testing in **Firefox** and **WebKit**, and intermittently in Chromium

To prevent these overlays from blocking interactions, `LandingPage.goto()` performs two dismissal passes before returning:
1. An **immediate pass** — dismisses any banners already visible on page load
2. A **grace-window pass** — waits up to `OVERLAY_APPEAR_TIMEOUT_MS` (1500ms) for delayed overlays (such as the CleverTap widget, which is injected asynchronously) and dismisses them if they appear

This ensures the page is overlay-free before any search interaction begins, making the test deterministic across browsers.

---

## Test coverage

| File | Description |
|---|---|
| `tests/japan-test-case.spec.ts` | Searches for Japan, selects it, switches to the Unlimited tab, selects the 7-day plan, and verifies the button price matches the cart total |

---

## Browser matrix

Tests run across five projects:

| Project | Device | Why |
|---|---|---|
| `chromium` | Desktop Chrome | Baseline desktop browser |
| `firefox` | Desktop Firefox | Consent overlays behave differently here; confirmed CleverTap banner requires explicit dismissal |
| `webkit` | Desktop Safari | Same as Firefox — additional overlay behaviour observed; important to validate on macOS Safari engine |
| `mobile chrome` | Pixel 5 (393×851) | Mobile viewports are not specified in the brief but represent a significant share of eSIM buyers; layout and tap targets differ meaningfully from desktop |
| `mobile safari` | iPhone 14 (390×844) | iOS Safari is the dominant mobile browser globally; scroll and interaction behaviour differs from desktop WebKit |

---

## How to run

Install dependencies and Playwright browsers (first time only):

```bash
cd "UI Tests"
npm install
npx playwright install
```

Run all tests across all browsers:

```bash
npm test
```

Run against a specific browser only:

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project="mobile safari"
```

Run with a different base URL (e.g. staging):

```bash
BASE_URL=https://staging.airalo.com npm test
```

Open the HTML report after a run:

```bash
npx playwright show-report
```

Tune the overlay grace window (milliseconds) without changing code:

```bash
OVERLAY_APPEAR_TIMEOUT_MS=3000 npm test
```

---

## Known handicaps

### 1. Language — English only
The most significant limitation. Tests assert against **English string literals** (`/airalo/i`, `Select Unlimited - 7 days`, `Japan`, `aria-selected`). If the site detects the browser locale and serves a different language — or if the copy is A/B tested — these assertions and locators will fail. A robust solution would either:
- Force a locale via `playwright.config.ts` (`locale: 'en-US'`) and assert against translated strings per locale, or
- Use data-testid attributes exclusively and avoid text-based locators where possible

### 2. Dynamic pricing
`verifyButtonPriceMatchesCart()` reads the plan price at runtime and compares it to the cart. This is correct behaviour for a dynamic site, but if pricing changes between the button render and the cart render (e.g. a flash sale activating mid-test), the assertion could produce a false negative.

### 3. Third-party overlay selectors
The `#wzrk-cancel` selector and the `accept|allow` text filter target today's CleverTap and OneTrust implementations. If either vendor updates their widget structure, the overlay dismissal will silently fail (the test continues without error, but the overlay may block subsequent interactions). A more defensive approach would be to assert that no known overlay wrapper is visible before proceeding.

### 4. Single test scenario
The suite covers one happy-path journey. Edge cases (no results for a search term, plan sold out, network errors, sign-in required) are not covered.

