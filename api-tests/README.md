# Airalo Partner API Tests

Bruno API test collection for the [Airalo Partner API](https://partners-api.airalo.com/v2).

## Structure

```
api-tests/
├── bruno.json                             # Bruno collection root
├── package.json                           # npm scripts
├── environments/
│   └── production.bru                     # Base URL, credentials, shared variables
├── 01-auth/
│   └── get-access-token.bru               # POST /token — OAuth2 client credentials
├── 02-orders/
│   ├── submit-order.bru                   # POST /orders — 200 happy path (seq 1)
│   ├── submit-order-invalid-params.bru    # POST /orders — 422 invalid package + qty (seq 2)
│   └── submit-order-brand-invalid.bru     # POST /orders — 422 brand doesn't exist (seq 3)
└── 03-esims/
    ├── get-esim-1.bru                     # GET /sims/{iccid} — eSIM 1 details
    ├── get-esim-2.bru                     # GET /sims/{iccid} — eSIM 2 details
    ├── get-esim-3.bru                     # GET /sims/{iccid} — eSIM 3 details
    ├── get-esim-4.bru                     # GET /sims/{iccid} — eSIM 4 details
    ├── get-esim-5.bru                     # GET /sims/{iccid} — eSIM 5 details
    └── get-esim-6.bru                     # GET /sims/{iccid} — eSIM 6 details
```

## How it works

The tests run in order using numbered folders:

1. **01-auth** — fetches an OAuth2 Bearer token and stores it in `accessToken`
2. **02-orders** — three requests covering the documented status codes for `POST /orders`:
   - `submit-order.bru` *(seq 1)* — 200 happy path; places the real order and stores `iccid1`–`iccid6`
   - `submit-order-invalid-params.bru` *(seq 2)* — 422 with an invalid `package_id` and `quantity > 50`
   - `submit-order-brand-invalid.bru` *(seq 3)* — 422 with a non-existent `brand_settings_name`
3. **03-esims** — fetches details for each of the 6 eSIMs using the stored ICCIDs

---

## Coverage strategy

The coding challenge specifies two endpoints to test: `POST /orders` and `GET /sims/{iccid}`. Each is verified against three criteria:

| Criterion | What is checked |
|---|---|
| **Status code** | Every request asserts the expected HTTP status code |
| **Message** | Every response checks `meta.message` for the appropriate value |
| **Response body** | Each response verifies the correct order details and eSIM properties are present |

The authentication step (`POST /token`) is a prerequisite — it runs first to obtain a Bearer token and stores it for downstream use. It has no test assertions of its own; if it fails, the post-response script throws and stops the entire run.

### What is tested and why

#### 01 — Authentication (`POST /token`)

No test assertions. The post-response script stores the token in `accessToken` and throws on failure, preventing the rest of the suite from running with an empty token.

#### 02 — Submit order (`POST /orders`)

Three requests cover the documented status codes for this endpoint.

##### `submit-order.bru` — Status 200

| Test | Rationale |
|---|---|
| **Pre-request guard: token not empty** | Fails fast if auth was skipped or failed |
| Status 200 | Confirms the order was accepted |
| `meta.message` equals `"success"` | Verifies successful order processing at the application level |
| Response has `data` object | Validates the response envelope |
| `data.id` is a positive number | Order identifier; absence means the order was not persisted |
| `data.code` is a non-empty string | Order code used for tracking and support |
| `data.type` equals `"sim"` | Confirms the correct order type was fulfilled |
| `data.quantity` equals `6` | Confirms the API acknowledged the requested quantity |
| `data.currency` is a non-empty string | Pricing currency is present for financial reconciliation |
| `data.package_id` matches `moshi-moshi-7days-1gb` | Ensures the correct package was fulfilled |
| `data.esim_type` is a non-empty string | Order detail: e.g. "Prepaid" |
| `data.validity` is a positive integer | Order detail: number of days the plan is valid |
| `data.package` is a non-empty string | Order detail: human-readable package name |
| `data.data` is a non-empty string | Order detail: data allowance (e.g. "1 GB") |
| `data.price` is a positive number | Order detail: numeric price for reconciliation |
| `sims` array has exactly 6 items | Confirms the correct number of eSIMs was returned |
| All 6 ICCIDs are unique | Duplicate ICCIDs would mean the API returned the same eSIM twice |
| Each ICCID matches `/^\d{18,22}$/` | Validates the ICCID format per ITU-T E.118 |
| Each eSIM has a non-empty `lpa` string | eSIM property: LPA activation code required for installation |
| Each eSIM has a non-empty `matching_id` string | eSIM property: required for QR-code-based installation |
| Each eSIM has a non-empty `qrcode` string | eSIM property: primary delivery mechanism for end users |
| Each eSIM has a non-empty `qrcode_url` string | eSIM property: hosted QR code image URL |
| Each eSIM has `direct_apple_installation_url` field | eSIM property: iOS one-tap installation link |
| Each eSIM has `apn_type` field | eSIM property: APN configuration type |
| Each eSIM has `is_roaming` boolean | eSIM property: roaming status flag |
| **Post-response script throws on failure** | If the order fails, ICCID env vars are never set; stops the run before eSIM requests execute with empty URLs |

##### `submit-order-invalid-params.bru` — Status 422 (invalid package + quantity > 50)

| Test | Rationale |
|---|---|
| Status 422 | Confirms the API rejects unprocessable input with the correct HTTP status code |
| `meta.message` equals `"the parameter is invalid"` | Verifies the documented error message for 422 responses |
| Response body contains `package_id` and `quantity` error strings | Confirms field-level validation messages are returned for each invalid parameter |

##### `submit-order-brand-invalid.bru` — Status 422 (brand doesn't exist)

| Test | Rationale |
|---|---|
| Status 422 | Confirms the API rejects orders referencing a non-existent brand |
| `meta.message` equals `"the parameter is invalid"` | Verifies the error message is consistent across 422 types |
| Response body contains `brand_settings_name` error string | Confirms the field-specific error is returned for the invalid brand |

#### 03 — Get eSIM details (`GET /sims/{iccid}`)  *(repeated for each of the 6 eSIMs)*

| Test | Rationale |
|---|---|
| **Pre-request guard: token not empty** | Fails fast rather than sending an unauthenticated request |
| **Pre-request guard: ICCID not empty** | An empty ICCID turns the URL into `/sims/` which either 404s or returns unrelated data |
| Status 200 | Confirms the eSIM exists and is retrievable |
| Response has `meta` object with `message` field | Verifies the response envelope includes the API-level status indicator |
| Response has `data` object | Validates the response envelope |
| `iccid` in response equals the requested ICCID | Confirms the API returned the correct eSIM |
| ICCID in response matches `/^\d{18,22}$/` | Validates the ICCID was not corrupted during the order→eSIM handoff |
| `lpa` is a non-empty string | eSIM property: LPA activation code still present on individual lookup |
| `matching_id` is a non-empty string | eSIM property: required for QR-code-based installation |
| `qrcode` is a non-empty string | eSIM property: QR code accessible on individual eSIM lookup |
| `qrcode_url` is a non-empty string | eSIM property: hosted QR code image URL accessible on individual lookup |
| `direct_apple_installation_url` field is present | eSIM property: iOS one-tap installation link |
| `is_roaming` is a boolean | eSIM property: roaming status flag |

### What is not tested (and why)

- **`meta.message` exact value on Get eSIM** — the live API returns `"succes"` (one `s`), a documented typo. The test checks that the field *exists* rather than hard-coding the typo.
- **422 on Get eSIM** — an invalid or unknown ICCID in the URL would trigger a 4xx, but the ICCIDs used in the suite are obtained directly from the preceding order response, so they are guaranteed valid. A dedicated negative test would require fabricating a fake ICCID that is structurally valid but unknown to the API.
- **Invalid credentials / 401 responses** — would require a separate set of intentionally broken credentials.
- **Rate limiting / 429 responses** — would require deliberate request flooding, outside the scope of a functional suite.
- **Response time / SLA** — not part of the API contract defined in the exercise.

---

## Running in CI

The GitHub Actions workflow (`.github/workflows/api-tests.yml`) triggers automatically on every push or pull request that touches `api-tests/**`, and can also be triggered manually from the Actions tab.

The workflow:
1. Checks out the repository
2. Installs Node.js 20 and `@usebruno/cli`
3. Runs the full collection against the `production` environment (credentials are read from `environments/production.bru`)
4. Uploads a JUnit XML report as a workflow artifact


---

## Running locally

There are two ways to run the tests locally: via the **Bruno desktop app** (visual, recommended for exploration) or via the **CLI** (fast, scriptable).

---

### Option A — Bruno desktop app

#### 1. Install Bruno

Download and install the Bruno desktop app for your OS from the official site:  
👉 https://www.usebruno.com/downloads

#### 2. Open the collection

1. Launch Bruno
2. Click **Open Collection** in the home screen (or **File → Open Collection** from the menu)
3. Navigate to and select the `api-tests/` folder — Bruno will detect `bruno.json` and load the collection

#### 3. Select the environment

1. In the top-right corner of the Bruno window, open the **Environment** dropdown
2. Select **production**  
   _(this loads the base URL, credentials, and shared variables from `environments/production.bru`)_

#### 4. Run all requests

- To run the **full suite in order**, right-click the collection root in the left sidebar and choose **Run** → this executes all requests sequentially across all folders
- To run a **single request**, click it in the sidebar and press the **▶ Send** button
- To run a **single folder**, right-click the folder (e.g. `03-esims`) and choose **Run**

#### 5. Inspect results

After each run, Bruno shows the response body, headers, status code, and test results (pass/fail) in the right panel. Variables set by `script:post-response` (e.g. `accessToken`, `iccid1`–`iccid6`) are visible under **Environments → production**.

---

### Option B — CLI

#### 1. Install Node.js

Ensure Node.js ≥ 18 is installed:

```bash
node --version
```

If not, download it from https://nodejs.org or use a version manager like `nvm`.

#### 2. Install dependencies

```bash
cd api-tests
npm install
```

This installs `@usebruno/cli` (the `bru` binary) locally into `node_modules/.bin/`.

#### 3. Run the full suite

```bash
npm test
```

This runs `bru run --env production -r` from the `api-tests/` directory, executing all requests in folder order (`01-auth` → `02-orders` → `03-esims`).

#### 4. Run with a JUnit report (optional)

```bash
npm run test:ci
```

Outputs a JUnit XML report to `api-tests/results/junit.xml`, useful for local CI debugging.
