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
│   ├── submit-order.bru                   # POST /orders — happy path (6 eSIMs, seq 1)
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
2. **02-orders** — three requests run in sequence:
   - `submit-order.bru` *(seq 1)* — happy-path order for 6 eSIMs, stores `iccid1`–`iccid6`; throws on failure to stop the run early
   - `submit-order-invalid-params.bru` *(seq 2)* — sends an invalid `package_id` and `quantity > 50`, asserts 422 and the validation error envelope
   - `submit-order-brand-invalid.bru` *(seq 3)* — sends a valid package but a non-existent `brand_settings_name`, asserts 422 and the specific error field
3. **03-esims** — fetches details for each of the 6 eSIMs using the stored ICCIDs

---

## Coverage strategy

### What is tested and why

Each request validates three layers: **contract** (the shape of the response), **business logic** (the data makes sense), and **chain integrity** (values flow correctly between requests).

#### 01 — Authentication (`POST /token`)

| Test | Layer | Rationale |
|---|---|---|
| Status 200 | Contract | Confirms the credentials are accepted and the endpoint is reachable |
| `meta.message` equals `"success"` | Contract | Every Airalo API response includes `meta.message`; verifying it confirms the request was understood and processed successfully |
| Response has `data` object | Contract | Validates the top-level response envelope matches the documented structure |
| `access_token` is a non-empty string | Contract | A missing or empty token would silently break every downstream request |
| `token_type` equals `Bearer` | Contract | Ensures the token scheme matches what the `Authorization` header expects |
| `expires_in` is a positive number | Contract | Confirms the API communicates token lifetime, required for refresh strategies |
| **Post-response script throws on failure** | Chain integrity | If the token is not obtained, execution stops immediately with a clear message instead of propagating a silent empty-token failure to every subsequent request |

#### 02 — Submit order (`POST /orders`)

The Partner API documents **seven distinct response scenarios** for this endpoint. The table below maps each to its test coverage.

##### Response scenario coverage

| Documented scenario | Status | Covered? | File |
|---|---|---|---|
| Submit Order (200) — standard | 200 | ✅ | `submit-order.bru` |
| Submit Order (422) — invalid package + quantity > 50 | 422 | ✅ | `submit-order-invalid-params.bru` |
| Submit Order (422) — SIM quantity not available | 422 | 🚫 not tested | *(see below)* |
| Submit Order (422) — Brand doesn't exist | 422 | ✅ | `submit-order-brand-invalid.bru` |
| Submit Order (200) — with email share | 200 | 🚫 not tested | *(see below)* |
| Submit Order (200) — Voice & Data package | 200 | 🚫 not tested | *(see below)* |
| (Discount pricing) Submit Order (200) | 200 | 🚫 not tested | *(see below)* |

##### Happy-path test coverage (`submit-order.bru`)

| Test | Layer | Rationale |
|---|---|---|
| **Pre-request guard: token not empty** | Chain integrity | Fails fast with a descriptive error if auth was skipped or failed, rather than receiving a misleading 401 |
| Status 200 | Contract | Confirms the order was accepted |
| `meta.message` equals `"success"` | Contract | Verifies the API confirmed successful order processing, not just an HTTP 200 |
| Response has `data` object | Contract | Validates the response envelope |
| `data.id` is a positive number | Contract | Every order has a unique numeric identifier; absence means the order was not persisted |
| `data.code` is a non-empty string | Contract | The order code (e.g. `20260620-075524`) is used for order tracking and support |
| `data.type` equals `"sim"` | Business logic | Confirms the API fulfilled the correct order type as requested |
| `data.quantity` equals `6` | Business logic | Confirms the API acknowledged the requested quantity — not just the SIM array length |
| `data.currency` is a non-empty string | Contract | Confirms pricing currency is present for financial reconciliation |
| `data.package_id` matches `moshi-moshi-7days-1gb` | Business logic | Ensures the correct package was fulfilled |
| `data.esim_type` is a non-empty string | Contract | Documented field (e.g. "Prepaid"); absence signals a schema regression |
| `data.validity` is a positive integer | Contract | Number of days the eSIM is valid; required for display and downstream logic |
| `data.package` is a non-empty string | Contract | Human-readable package name; must be present for user-facing interfaces |
| `data.data` is a non-empty string | Contract | Data allowance string (e.g. "1 GB"); required for plan display |
| `data.price` is a positive number | Contract | Numeric price; required for invoicing and reconciliation |
| `data.pricing_model` is a non-empty string | Contract | Documents whether pricing is `net_pricing` or `discount_pricing` |
| `data.manual_installation` is a non-empty string | Contract | Installation instructions HTML; must be present for partner portals |
| `data.qrcode_installation` is a non-empty string | Contract | QR code installation instructions HTML |
| `data.installation_guides` has at least one language key | Contract | The installation guide URL map must not be empty |
| `sims` array has exactly 6 items | Business logic | The order was placed for 6 eSIMs — any other count is incorrect |
| All 6 ICCIDs are unique | Business logic | Duplicate ICCIDs would mean the API returned the same eSIM twice |
| Each ICCID matches `/^\d{18,22}$/` | Contract | ICCIDs are standardised 18–22 digit numeric strings (ITU-T E.118) |
| Each eSIM has a non-empty `lpa` string | Contract | The LPA address is required for eSIM installation |
| Each eSIM has a non-empty `matching_id` string | Contract | Required for QR-code-based installation flows |
| Each eSIM has a non-empty `qrcode` string | Contract | Primary delivery mechanism for end users |
| Each eSIM has a non-empty `qrcode_url` string | Contract | Hosted QR code image URL used in partner portals and emails |
| Each eSIM has a non-empty `direct_apple_installation_url` | Contract | Required for one-tap eSIM installation on iOS devices |
| Each eSIM has an `apn_type` field | Contract | APN type is documented in the response schema |
| Each eSIM has an `is_roaming` boolean | Contract | Roaming flag drives UI warnings and partner billing logic |
| **Post-response script throws on failure** | Chain integrity | If the order fails, ICCID env vars are never set; stops the run before the eSIM requests execute with empty URLs |

##### 422 test coverage (`submit-order-invalid-params.bru`)

| Test | Rationale |
|---|---|
| Status 422 | Confirms the API rejects unprocessable input rather than silently failing |
| `meta.message` equals `"the parameter is invalid"` | Validates the documented error envelope structure |
| `data` is an object with validation error fields | Validates the error shape matches the documented 422 schema |
| `data.package_id` is a non-empty string | Field-level error message is present for the invalid package |
| `data.quantity` is a non-empty string | Field-level error message is present for quantity > 50 |

##### 422 test coverage (`submit-order-brand-invalid.bru`)

| Test | Rationale |
|---|---|
| Status 422 | Confirms the API rejects orders with non-existent brand names |
| `meta.message` equals `"the parameter is invalid"` | Validates the error envelope is consistent across 422 types |
| `data` is an object | Error shape validation |
| `data.brand_settings_name` is a non-empty string | Confirms the API returns a field-specific error for the brand, not a generic one |

#### 03 — Get eSIM details (`GET /sims/{iccid}`)  *(repeated for each of the 6 eSIMs)*

Each request uses the optional `include=order,order.status,order.user,share` query parameter (documented in the Partner API spec) to embed related order data in the response, enabling validation of the `simable` object in the same call.

| Test | Layer | Rationale |
|---|---|---|
| **Pre-request guard: token not empty** | Chain integrity | Same as above — fails fast rather than sending an unauthenticated request |
| **Pre-request guard: ICCID not empty** | Chain integrity | An empty ICCID turns the URL into `/sims/` which either 404s or returns unrelated data, making the test results meaningless |
| Status 200 | Contract | Confirms the eSIM exists and is retrievable |
| Response has `meta` object with `message` field | Contract | Verifies the response envelope includes the API-level status indicator *(the live API returns `"succes"` — a documented typo — so the test checks field presence rather than value)* |
| Response has `data` object | Contract | Validates the top-level response envelope |
| `iccid` in response equals the requested ICCID | Business logic | Confirms the API returned the correct eSIM and not a different one |
| ICCID in response matches `/^\d{18,22}$/` | Contract | Validates the stored ICCID was not corrupted during the order→eSIM handoff |
| `lpa` is a non-empty string | Contract | The LPA activation code is required for eSIM installation; still validated at the individual lookup level |
| `matching_id` is a non-empty string | Contract | Required for QR-code-based installation flows; must be present on every fetchable eSIM |
| `qrcode` is a non-empty string | Contract | Validates the QR code is accessible when fetching a single eSIM |
| `qrcode_url` is a non-empty string | Contract | Validates the hosted QR code image URL is accessible on individual eSIM lookup |
| `direct_apple_installation_url` field is present | Contract | Validates the iOS one-tap installation link field exists (may be null for non-iOS profiles) |
| `apn_type` field is present | Contract | APN type is documented in the response schema; absence indicates a schema regression |
| `is_roaming` is a boolean | Contract | Roaming flag drives UI warnings and partner billing logic; type correctness is critical |
| `confirmation_code` field is present | Contract | Used for order confirmation workflows; validated here to catch silent omissions |
| `recycled` is a boolean | Contract | New field documented in the Partner API spec; indicates whether the eSIM was recycled from a prior activation |
| `simable` object has `package_id`, `package`, `price`, `data`, `validity`, `currency` | Business logic | The embedded order object (populated via `include`) must carry all package details needed for partner reconciliation |
| `simable.status` has `slug` and `name` | Business logic | Order status must be machine-readable (`slug`) and human-readable (`name`); both are required for downstream status workflows |

### What is not tested (and why)

- **`meta.message` exact value on Get eSIM** — the live API returns `"succes"` (one `s`), which is a documented typo in the Partner API spec. Rather than hard-coding the typo, the test validates that the field *exists*; this is re-evaluated if the API corrects the spelling.
- **Nullable fields (`voucher_code`, `airalo_code`, `apn_value`, `recycled_at`, `imsis`)** — these are `null` in the sandbox for freshly issued eSIMs and have no non-null value to assert against in a basic happy-path run. Asserting `null` would add noise without catching real regressions.
- **`order` field on the `data` object** — the docs state this is populated only when `include=order` is passed; the `simable` object already provides the embedded order, so a separate `order` assertion is redundant.
- **Submit Order (422) — SIM quantity not available** — this error only occurs when a package genuinely has insufficient stock. Because real stock levels in the sandbox are not under test control, it is impossible to reliably trigger this scenario. A deterministic test would require a partner-side API or admin tool to set stock, which is outside scope.
- **Submit Order (200) — with email share** — the response body is structurally identical to the standard 200 happy path (same schema, same fields). The only difference is the request carries `to_email`, `sharing_option[]`, and `copy_address[]` params, and the API dispatches an email asynchronously. Since there is no way to assert that an email was actually sent via an API test (the response doesn't change), this scenario adds no contract-level coverage beyond what `submit-order.bru` already provides.
- **Submit Order (200) — Voice & Data package** — this scenario requires an account-accessible package that returns `text`, `voice`, and `msisdn` fields in the SIM objects, plus a per-platform `apn` breakdown. A specific Voice & Data `package_id` would need to be discovered and confirmed as available in the test account's catalogue before this test could be written reliably.
- **(Discount pricing) Submit Order (200)** — the discount fields (`discount_percentage`, `discount_amount`, `unit_paid_price`, `total_amount_paid`) only appear when the account has a negotiated discount agreement with Airalo. This is a commercial configuration, not a standard API behaviour, and cannot be triggered with a standard partner account.
- **Invalid credentials / 401 responses** — the test suite is a happy-path integration suite using real API credentials; negative auth scenarios would require a separate set of intentionally broken credentials.
- **Rate limiting / 429 responses** — would require deliberate request flooding, outside the scope of a functional suite.
- **Response time / SLA** — not part of the API contract defined in the exercise; can be added with Bruno's `res.responseTime` assertion if needed.

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


