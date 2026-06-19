# Airalo UI Tests

Playwright-based end-to-end test suite for [airalo.com](https://www.airalo.com).

---

## Strategy

Tests are written using the **Page Object Model (POM)** pattern. Two pages were created, one for landing and other for Japan specific logic, and each are represented by a dedicated class in `pages/` that encapsulates locators and interaction logic. Specs are kept clean — they express the user journey in plain method calls, with no selector or browser detail leaking into the test body.

### Consent & overlay handling

The site displays multiple consent and marketing banners depending on the browser and session state:

- A **OneTrust** cookie consent banner (all browsers)
- A **CleverTap** (`#wzrk-cancel`) notification overlay, which appeared consistently during testing in **Firefox** and **WebKit**

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

Open the HTML report after a run:

```bash
npx playwright show-report
```

---

## Known handicaps

### 1. Overlay dismissal relies on a grace window

`clearOverlays()` races between the overlay appearing and the page reaching `networkidle`. This is pragmatic but imperfect: the CleverTap banner is injected via a JavaScript timer, not a network request, so the network can go idle *before* the banner appears. In that race, the banner wins and is correctly handled — but if the timer fires just after `networkidle` and after the race resolves, it would be missed.

**Defence:** In practice this edge case did not occur during testing across all five browser projects. The `networkidle` heuristic is a well-understood Playwright primitive and the correct tool when no application-specific event is available. The alternative — a fixed timeout — is strictly worse because it adds unconditional latency on every run regardless of whether an overlay appears.

---

### 2. Fallback click path has a bounded but opaque timeout

When `click()` does not dismiss an overlay (pointer events intercepted by another element), `dismissVisibleOverlays()` falls back to `dispatchEvent('click')` and waits for `{ state: 'hidden', timeout: OVERLAY_APPEAR_TIMEOUT_MS }`. If the element still does not hide within that window the test fails — which is the correct behaviour. The timeout value (`OVERLAY_APPEAR_TIMEOUT_MS`) doubles as both the grace window and the fallback click timeout, which conflates two distinct concerns.

**Defence:** Both usages represent the same concept — the maximum time we are willing to wait for an overlay to react. Using one named constant for both keeps the codebase DRY and makes the value easy to adjust in one place. If the two concerns diverged in the future, splitting them into two constants would be a trivial refactor.

---

### 3. Locators and assertions are English-only

The most impactful limitation. Locators use English text (`accept`, `allow`, `Japan`, `Select Unlimited - 7 days`) and assertions match English strings (`/airalo/i`, `/japan/i`). If the site detects the browser locale and serves a different language, or if copy is A/B tested, these will fail silently (wrong country selected) or loudly (assertion error).

**Defence:** The spec enforces `locale: 'en-US'` via `playwright.config.ts` so Playwright sets the `Accept-Language` header and browser locale to English on every run, making the language deterministic. The remaining exposure is server-side geo-detection overriding the locale header, which would require explicit cookie or URL parameter forcing — a known limitation documented here. The full solution would be to use `data-testid` attributes exclusively and avoid text-based locators entirely, but that requires cooperation from the application team.

---

### 4. Third-party overlay selectors are fragile

The `#wzrk-cancel` selector and the `accept|allow` text filter target today's CleverTap and OneTrust widget implementations. If either vendor updates their widget structure or renames their IDs, overlay dismissal will silently fail — the test continues without error but the overlay may block subsequent interactions. A more defensive approach would be to assert that no known overlay wrapper (`#wzrk_wrapper`, `#onetrust-banner-sdk`) is visible before proceeding with each interaction.

---

### 5. Single happy-path scenario

The suite covers one end-to-end journey. Edge cases are not covered: no results for a search term, plan sold out, session expiry, network errors, or behaviour when the user is already signed in. These would be the natural next additions to the suite.

