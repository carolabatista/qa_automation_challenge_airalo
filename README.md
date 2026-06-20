# Airalo QA Coding Exercise

End-to-end quality assurance suite for the [Airalo Partner API](https://partners-api.airalo.com/v2) and the [Airalo website](https://www.airalo.com), written as part of the requested QA Coding Exercise.

---

## Repository structure

```
Airalo/
├── .github/
│   └── workflows/
│       ├── api-tests.yml      # CI for Bruno API tests
│       └── playwright.yml     # CI for Playwright UI tests
├── api-tests/                 # Bruno API test collection
│   ├── bruno.json
│   ├── package.json
│   ├── environments/
│   │   └── production.bru     # Base URL + credentials
│   ├── 01-auth/
│   │   └── get-access-token.bru
│   ├── 02-orders/
│   │   ├── submit-order.bru                # Happy path — 6 eSIMs (seq 1)
│   │   ├── submit-order-invalid-params.bru # 422 — invalid package + qty > 50 (seq 2)
│   │   └── submit-order-brand-invalid.bru  # 422 — brand doesn't exist (seq 3)
│   └── 03-esims/
│       ├── get-esim-1.bru … get-esim-6.bru
└── ui-tests/                  # Playwright E2E test suite
    ├── playwright.config.ts
    ├── merge.config.ts
    ├── package.json
    ├── pages/
    │   ├── landingPage.ts
    │   └── japanOptionsPage.ts
    └── tests/
        └── japan-test-case.spec.ts
```

---

## UI tests (`ui-tests/`)

### What is tested

A Playwright spec verifies the specific test case described in the coding challenge on Airalo's website:

> **`japan-test-case.spec.ts`** — searches for Japan, selects it, switches to the *Unlimited* tab, picks the 7-day plan, and asserts that the price shown on the plan card matches the total displayed in the cart.

### Strategy

Tests follow the **Page Object Model** pattern. Locators and interaction logic live in `pages/`; the spec reads like a plain user journey. Cross-browser consent banners (OneTrust, CleverTap) are handled transparently via `page.addLocatorHandler()`.

### Browser matrix

| Project | Device |
|---------|--------|
| `chromium` | Desktop Chrome |
| `firefox` | Desktop Firefox |
| `webkit` | Desktop Safari |
| `mobile chrome` | Pixel 5 (393 × 851) |
| `mobile safari` | iPhone 14 (390 × 844) |

### Running locally

```bash
cd ui-tests
npm install
npx playwright install      # first time only

npm test                    # all browsers in parallel
npx playwright test --project=chromium   # single browser
npx playwright show-report  # open HTML report
```

> See [`ui-tests/README.md`](ui-tests/README.md) for detailed instructions, known limitations, and overlay-handling notes.

---

## API tests (`api-tests/`)

### What is tested

The Bruno collection verifies the full eSIM purchase flow against the Partner API:

| Step | Folder | Endpoint | What it does |
|------|--------|----------|--------------|
| 1 | `01-auth` | `POST /token` | Obtains an OAuth2 Bearer token and stores it in `accessToken` |
| 2 | `02-orders` | `POST /orders` | Places an order for 6 × `moshi-moshi-7days-1gb` eSIMs and stores each ICCID (`iccid1`–`iccid6`) |
| 3 | `03-esims` | `GET /sims/{iccid}?include=order,order.status,order.user,share` | Fetches full details (including embedded order data) for each of the 6 eSIMs in turn |

Each request validates three layers: **contract** (response shape), **business logic** (data correctness), and **chain integrity** (pre/post-request guards that stop the run early rather than letting a silent failure propagate). The Get eSIM requests use the optional `include` query parameter (per the Partner API spec) to embed the related order object (`simable`) in a single call, enabling validation of package details, pricing, and order status without a separate request.

> See [`api-tests/README.md`](api-tests/README.md) for the full coverage matrix and rationale.

### Running locally

```bash
cd api-tests
npm install

# Run the full suite (console output)
npm test

# Run with a JUnit XML report → api-tests/results/junit.xml
npm run test:ci
```

Or open the `api-tests/` folder in the [Bruno desktop app](https://www.usebruno.com/downloads), select the **production** environment, and click **Run**.

---

## CI / GitHub Actions workflows

### `playwright.yml` — Playwright Tests

| Property | Value |
|----------|-------|
| Trigger | Push to `main`, or manual dispatch |
| Runner | `ubuntu-latest` |
| Node | LTS |

**Jobs:**

| Job | What it does |
|-----|--------------|
| `test` (×5 in parallel) | Runs the spec against one browser project per matrix entry; uploads a blob report |
| `merge-reports` | Downloads all five blob reports, merges them into one HTML report, writes a summary, uploads the final report as an artifact, and fails the workflow if any test failed |

**Reading the results:**

- The **Summary** tab of the `merge-reports` job shows a table with passed / failed / flaky / skipped counts, pass rate, and a list of any failing tests.
- To view the full interactive HTML report (screenshots, videos, traces): scroll to **Artifacts** → download **`playwright-report-<run-number>.zip`** → extract → open `index.html` in your browser (no server required).
- To re-run failures locally after inspecting the report:
  ```bash
  npx playwright test --last-failed
  ```

---

### `api-tests.yml` — Airalo API Tests

| Property | Value |
|----------|-------|
| Trigger | Push to `main` touching `api-tests/**`, or manual dispatch |
| Runner | `ubuntu-latest` |
| Node | 20 |

**Steps:**

1. Checkout → install Node.js 20 → `npm install`
2. Run the full Bruno collection against the `production` environment (credentials injected from GitHub Secrets: `AIRALO_CLIENT_ID`, `AIRALO_CLIENT_SECRET`)
3. Upload `api-tests/results/junit.xml` as the **`api-test-results`** artifact
4. Write a job summary (visible on the run's **Summary** tab) with pass/fail counts, duration, a list of any failed tests, and instructions for downloading the artifact

**Reading the results:**

- Open the **Actions** tab → select the run → click the **Summary** tab for the inline report.
- To get the raw JUnit XML: scroll to **Artifacts** → download **`api-test-results`** → extract the ZIP → open `junit.xml` in any browser, IDE, or JUnit-compatible reporting tool (Allure, ReportPortal, etc.).

---

## Secrets required

| Secret | Used by |
|--------|---------|
| `AIRALO_CLIENT_ID` | `api-tests.yml` |
| `AIRALO_CLIENT_SECRET` | `api-tests.yml` |

Secrets were created in this Github repository, please refer to the original pdf description of the challenge for their values.
