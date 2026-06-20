# Airalo UI Tests

Playwright-based end-to-end test suite for [airalo.com](https://www.airalo.com).

---

## Strategy

Tests are written using the **Page Object Model (POM)** pattern. All page classes extend an abstract `BasePage` which enforces a `verifyOnPage()` contract, ensuring every page can assert it is the correct destination. Two concrete pages were created — one for the landing page and one for Japan-specific logic — and each is represented by a dedicated class in `pages/` that encapsulates locators and interaction logic. Specs are kept clean — they express the user journey in plain method calls, with no selector or browser detail leaking into the test body.

### Consent & overlay handling

The site displays multiple consent and marketing banners depending on the browser and session state:

- A **OneTrust** cookie consent banner (all browsers)
- A **CleverTap** (`#wzrk-cancel`) notification overlay, which appeared consistently during testing in **Firefox** and **WebKit**

`LandingPage.goto()` registers a [`page.addLocatorHandler()`](https://playwright.dev/docs/api/class-page#page-add-locator-handler) for the overlay dismiss button before navigating. Playwright automatically invokes the handler before every web-first action (click, fill, assertion, etc.) whenever the locator is visible — regardless of when the overlay appears. 

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

### Via GitHub Actions (manual dispatch)

The CI workflow can be triggered on demand without a code push directly from the GitHub UI.

1. **Open the repository** on GitHub and click the **Actions** tab in the top navigation bar.

2. **Select the workflow** — in the left sidebar, click **Playwright Tests**.

3. **Trigger a run** — click the **Run workflow** button on the right-hand side of the page.  
   A small dropdown will appear; leave the branch set to `main` and click the green **Run workflow** button to confirm.

4. **Watch the run** — the new run will appear at the top of the list within a few seconds. Click on it to open the run detail page. You will see five parallel jobs (one per browser) running simultaneously under the `test` stage, followed by a `merge-reports` job.

5. **Read the summary** — once the `merge-reports` job finishes, click on it and scroll to the **Summary** tab on the left. A table showing passed, failed, flaky, skipped, total tests and pass rate is generated automatically.

6. **Download the full HTML report** — if you want to inspect screenshots, videos or traces for any test:
   1. Scroll to the bottom of the run page and open the **Artifacts** section.
   2. Download the file named **`playwright-report-<run-number>.zip`**.
   3. Extract the ZIP.
   4. Open `index.html` in your browser — no server required.

> **Tip:** If any tests failed, the summary will also list each failing test by name, project and file, along with a command to re-run only the failures locally:
> ```bash
> npx playwright test --last-failed
> ```

---

### Locally

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

### 1. Overlay handler fires before actions, not during arbitrary waits

`page.addLocatorHandler()` is invoked by Playwright before every web-first action (click, fill, `expect`, etc.). If an overlay appears *during* a long `waitFor` call — for example near the end of a 5-second suggestion-visibility wait — the handler will not fire until the next action is attempted. In practice this is very unlikely because overlays appear early in the page lifecycle, but it is a theoretical gap.

**Defence:** The handler covers every interaction step in the test flow. The only window where an unhandled overlay could slip through is between the end of one action and the start of the next, which is effectively zero in synchronous test code.

---

### 2. Locators and assertions are English-only

The most impactful limitation. Locators use English text (`accept`, `allow`, `Japan`, `Select Unlimited - 7 days`) and assertions match English strings (`/japan/i`). If the site detects the browser locale and serves a different language, or if copy is A/B tested, these will fail silently (wrong country selected) or loudly (assertion error). Landing page detection uses the `data-testid="base-carousel_slide-container"` attribute and is therefore locale-independent.

**Defence:** The spec enforces `locale: 'en-US'` via `playwright.config.ts` so Playwright sets the `Accept-Language` header and browser locale to English on every run, making the language deterministic. The remaining exposure is server-side geo-detection overriding the locale header, which would require explicit cookie or URL parameter forcing — a known limitation documented here. The full solution would be to use `data-testid` attributes exclusively and avoid text-based locators entirely, but that requires cooperation from the application team.

---

### 3. Third-party overlay selectors are fragile

The `#wzrk-cancel` selector and the `accept|allow` text filter target today's CleverTap and OneTrust widget implementations. If either vendor updates their widget structure or renames their IDs, the `addLocatorHandler` locator will silently stop matching — no handler fires, and the overlay blocks subsequent interactions. A more defensive approach would be to assert that no known overlay wrapper (`#wzrk_wrapper`, `#onetrust-banner-sdk`) is visible before proceeding with each interaction.

---

### 4. Single happy-path scenario

The suite covers one end-to-end journey. Edge cases are not covered: no results for a search term, plan sold out, session expiry, network errors, or behaviour when the user is already signed in. These would be the natural next additions to the suite.

