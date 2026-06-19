# Airalo Partner API Tests

Bruno API test collection for the [Airalo Partner API](https://partners-api.airalo.com/v2).

## Structure

```
api-tests/
├── bruno.json                    # Bruno collection root
├── package.json                  # npm scripts
├── environments/
│   └── production.bru            # Base URL, credentials, shared variables
├── 01-auth/
│   └── get-access-token.bru      # POST /token — OAuth2 client credentials
├── 02-orders/
│   └── submit-order.bru          # POST /orders — place order for 6 eSIMs
└── 03-esims/
    ├── get-esim-1.bru             # GET /sims/{iccid} — eSIM 1 details
    ├── get-esim-2.bru             # GET /sims/{iccid} — eSIM 2 details
    ├── get-esim-3.bru             # GET /sims/{iccid} — eSIM 3 details
    ├── get-esim-4.bru             # GET /sims/{iccid} — eSIM 4 details
    ├── get-esim-5.bru             # GET /sims/{iccid} — eSIM 5 details
    └── get-esim-6.bru             # GET /sims/{iccid} — eSIM 6 details
```

## How it works

The tests run in order using numbered folders:

1. **01-auth** — fetches an OAuth2 Bearer token and stores it in `accessToken`
2. **02-orders** — submits an order for 6 eSIMs (`moshi-moshi-7days-1gb`) and stores each ICCID (`iccid1`–`iccid6`) from the response
3. **03-esims** — fetches details for each of the 6 eSIMs using the stored ICCIDs

---

## Coverage strategy

### What is tested and why

Each request validates three layers: **contract** (the shape of the response), **business logic** (the data makes sense), and **chain integrity** (values flow correctly between requests).

#### 01 — Authentication (`POST /token`)

| Test | Layer | Rationale |
|---|---|---|
| Status 200 | Contract | Confirms the credentials are accepted and the endpoint is reachable |
| Response has `data` object | Contract | Validates the top-level response envelope matches the documented structure |
| `access_token` is a non-empty string | Contract | A missing or empty token would silently break every downstream request |
| `token_type` equals `Bearer` | Contract | Ensures the token scheme matches what the `Authorization` header expects |
| `expires_in` is a positive number | Contract | Confirms the API communicates token lifetime, required for refresh strategies |
| **Post-response script throws on failure** | Chain integrity | If the token is not obtained, execution stops immediately with a clear message instead of propagating a silent empty-token failure to every subsequent request |

#### 02 — Submit order (`POST /orders`)

| Test | Layer | Rationale |
|---|---|---|
| **Pre-request guard: token not empty** | Chain integrity | Fails fast with a descriptive error if auth was skipped or failed, rather than receiving a misleading 401 |
| Status 200 | Contract | Confirms the order was accepted |
| Response has `data` object | Contract | Validates the response envelope |
| `sims` array has exactly 6 items | Business logic | The order was placed for 6 eSIMs — any other count means the API returned an incorrect quantity |
| `package_id` matches `moshi-moshi-7days-1gb` | Business logic | Ensures the correct package was fulfilled and the API did not substitute a different one |
| All 6 ICCIDs are unique | Business logic | Duplicate ICCIDs would indicate the API returned the same eSIM twice, making the order invalid |
| Each ICCID matches `/^\d{18,22}$/` | Contract | ICCIDs are standardised as 18–22 digit numeric strings (ITU-T E.118); any other format signals data corruption |
| Each eSIM has a non-empty `lpa` string | Contract | The LPA address is required for eSIM installation; absent or empty means the eSIM cannot be activated |
| Each eSIM has a non-empty `qrcode` string | Contract | The QR code is the primary delivery mechanism for end users; it must be present |
| **Post-response script throws on failure** | Chain integrity | If the order fails, ICCID env vars are never set; throwing here stops the run before the eSIM requests execute with empty URLs |

#### 03 — Get eSIM details (`GET /sims/{iccid}`)  *(repeated for each of the 6 eSIMs)*

| Test | Layer | Rationale |
|---|---|---|
| **Pre-request guard: token not empty** | Chain integrity | Same as above — fails fast rather than sending an unauthenticated request |
| **Pre-request guard: ICCID not empty** | Chain integrity | An empty ICCID turns the URL into `/sims/` which either 404s or returns unrelated data, making the test results meaningless |
| Status 200 | Contract | Confirms the eSIM exists and is retrievable |
| Response has `data` object | Contract | Validates the response envelope |
| `iccid` in response equals the requested ICCID | Business logic | Confirms the API returned the correct eSIM and not a different one |
| ICCID in response matches `/^\d{18,22}$/` | Contract | Validates the stored ICCID was not corrupted during the order→esim handoff |
| `lpa` is a non-empty string | Contract | Validates the activation code is still present on the individual eSIM lookup |
| `qrcode` is a non-empty string | Contract | Validates the QR code is accessible when fetching a single eSIM |

### What is not tested (and why)

- **Invalid credentials / 401 responses** — the test suite is a happy-path integration suite using real API credentials; negative auth scenarios would require a separate set of intentionally broken credentials
- **Rate limiting / 429 responses** — would require deliberate request flooding, outside the scope of a functional suite
- **Response time / SLA** — not part of the API contract defined in the exercise; can be added with Bruno's `res.responseTime` assertion if needed

## Running in CI

The GitHub Actions workflow (`.github/workflows/api-tests.yml`) triggers automatically on every push or pull request that touches `api-tests/**`, and can also be triggered manually from the Actions tab.

The workflow:
1. Checks out the repository
2. Installs Node.js 20 and `@usebruno/cli`
3. Runs the full collection against the `production` environment
4. Uploads a JUnit XML report as a workflow artifact

The workflow uses GitHub Secrets to pass credentials to Bruno via `--env-var` flags. You **must** create these two secrets before the workflow can run successfully:

1. Go to your repository on GitHub
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret** and add each of the following:

| Secret name | Value |
|---|---|
| `AIRALO_CLIENT_ID` | `92d73dd36ed012dbd5f59220076d845a` |
| `AIRALO_CLIENT_SECRET` | `DDpoEo76i3S0kH7xOYwLiAqZ0yxCs1N6352wLoSD` |

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

This runs `bru run --env production --recursive` from the `api-tests/` directory, executing all requests in folder order (`01-auth` → `02-orders` → `03-esims`).

#### 4. Run with a JUnit report (optional)

```bash
npm run test:ci
```

Outputs a JUnit XML report to `api-tests/results/junit.xml`, useful for local CI debugging.


