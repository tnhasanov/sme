# Policy Matrix

Every threshold the platform applies, its provenance, and what happens when it is breached.

Nothing here is hard-coded in a UI component. All of it lives in `config/policy.ts`,
`config/rating.ts` and `config/scorecards.ts`, and all of it is visible and editable from
the Configuration page.

**Provenance badges.** Every rule carries a `SourceStatus` which the UI shows next to the
threshold it influenced:

| Status | Meaning |
|---|---|
| `CURRENT` | ATB's rule in force, taken from the approved methodology or the live opinion workbook |
| `PROMETEIA_PROPOSED` | Prometeia's Phase-2 proposal. **Not approved policy.** |
| `BANK_PROPOSED` | An option ATB discussed internally but has not implemented |
| `INFERRED` | Not stated in any source; derived from observed practice |
| `NEEDS_CONFIRMATION` | Sources disagree, or the source document was not supplied |

---

## 1. Rule actions

| Action | Effect |
|---|---|
| `INFO` | Recorded and displayed; no consequence |
| `WARNING` | Surfaced as a finding; the underwriter must address it in the opinion |
| `POLICY_EXCEPTION` | Requires a formal waiver with justification, mitigant and approver |
| `STOP` | Blocks ordinary routing; only the top authority may consider the case |
| `REJECT` | Automatic rejection |
| `ESCALATE` | Forces routing to a higher authority |

A `STOP` action is **not** a low score. It is a condition under which the bank says the file
cannot be objectively assessed on ordinary authority.

---

## 2. Rule resolution order

For any given metric the engine picks exactly one rule:

```
sub-sector rule  →  sector rule  →  product rule  →  segment rule  →  base rule
```

A sector rule **replaces** the base rule rather than firing alongside it, so a file never
gets two contradictory verdicts on the same ratio. A rule listed in
`waivedForSectors` is removed entirely for that sector.

---

## 3. Base rules — `config/policy.ts`, `ATB_POLICY_V1`

### Liquidity

| Rule ID | Metric | Norm | Action | Severity | Status | Source |
|---|---|---|---|---|---|---|
| `RATIO_CURRENT_RATIO` | `currentRatio` | ≥ 1.50 | POLICY_EXCEPTION | HIGH | CURRENT | Əmsallar!D5 |
| `RATIO_QUICK_RATIO` | `quickRatio` | ≥ 1.00 | WARNING | MEDIUM | CURRENT | Əmsallar!D6 |
| `CASH_COVERAGE_OF_OBLIGATIONS` | `cashCoverageOfBankDebt` | ≥ 0.35 | WARNING | MEDIUM | CURRENT | Balans panel |
| `MIN_FORECAST_FREE_CASH` | `minForecastClosingCash` | ≥ 0 | POLICY_EXCEPTION | HIGH | CURRENT | Balans panel — `MIN(Pul axını proqnoz C108:N108)` |

### Leverage and capital

| Rule ID | Metric | Norm | Action | Severity | Status | Source |
|---|---|---|---|---|---|---|
| `DEBT_TO_EQUITY_INCL_NEW` | `debtToEquityInclNew` | ≤ 1.00 | **STOP** | CRITICAL | CURRENT | Metodologiya §6.2; Əmsallar!D11 |
| `LEVERAGE_ASSETS_TO_EQUITY` | `leverage` | ≤ 2.00 | WARNING | MEDIUM | CURRENT | Əmsallar!D12 |
| `GEARING` | `gearing` | ≤ 0.50 | WARNING | MEDIUM | **NEEDS_CONFIRMATION** | Balans panel only; absent from Əmsallar |

`DEBT_TO_EQUITY_INCL_NEW` is **waived for the services sector** (`Xidmət`) per
Metodologiya §6.2, which permits disregarding it based on other factors. The waiver is
recorded as a finding rather than applied silently.

### Debt service

| Rule ID | Metric | Norm | Action | Severity | Status | Source |
|---|---|---|---|---|---|---|
| `DSCR_CURRENT` | `dscrCurrent` | ≥ 1.50 | POLICY_EXCEPTION | HIGH | CURRENT | Əmsallar!D9 |
| `DSCR_FORECAST` | `dscrPostTransaction` | ≥ 1.50 | POLICY_EXCEPTION | HIGH | CURRENT | Əmsallar!D10; Pul axını N10 |
| `PAYMENT_TO_CAPACITY` | `paymentToCapacity` | ≤ 0.80 | **STOP** | CRITICAL | **NEEDS_CONFIRMATION** | MZH Q10; the 0.8 coefficient cites "KOB kreditlərinin verilməsi Metodologiyası", **which was not supplied** |
| `ALL_PAYMENTS_TO_RETAINED_PROFIT` | `allPaymentsToRetainedProfit` | ≤ 0.80 | POLICY_EXCEPTION | HIGH | **INFERRED** | MZH Q12 — no norm stated; aligned with the 0.8 coefficient |

`PAYMENT_TO_CAPACITY` is **waived for agriculture** (`Kənd təsərrüfatı`) when the forecast
cash flow demonstrates capacity, per Metodologiya §6.3.

DSCR is treated as evaluative rather than a hard gate, consistent with the source: the real
opinion passed with a negative current DSCR that the underwriter explained narratively.

### Profitability and efficiency

| Rule ID | Metric | Norm | Action | Status | Source |
|---|---|---|---|---|---|
| `ROA` | `roa` | ≥ 5% | INFO | CURRENT | Əmsallar / Balans panel |
| `ROE` | `roe` | ≥ 8% | INFO | CURRENT | Əmsallar / Balans panel |
| `ASSET_TURNOVER` | `assetTurnover` | ≥ 1.00 | INFO | CURRENT | Əmsallar!D22 |
| `WORKING_CAPITAL_TURNOVER` | `workingCapitalTurnover` | ≥ 1.50 | INFO | CURRENT | Balans panel |

### Credit behaviour

| Rule ID | Metric | Norm | Action | Severity | Status | Source |
|---|---|---|---|---|---|---|
| `INSTALMENT_REPAYMENT_SHARE` | `instalmentRepaymentShare` | > 50% | WARNING | HIGH | CURRENT | Metodologiya §4.7; AKBÇ təhlili E70 |
| `DEBT_BURDEN_INCREASE` | `debtBurdenIncrease` | ≤ 50% | WARNING | HIGH | CURRENT | Metodologiya §4.8 |
| `MAX_DPD_CURRENT` | `currentMaxDpd` | ≤ 0 days | STOP | CRITICAL | INFERRED | Metodologiya §4.6 |

### Collateral

| Rule ID | Metric | Norm | Action | Severity | Status | Source |
|---|---|---|---|---|---|---|
| `COLLATERAL_COVERAGE` | `eligibleCollateralCoverage` | ≥ 1.00 | POLICY_EXCEPTION | HIGH | **INFERRED** | "AMB-nın təminat kredit nisbəti tələbi" is referenced but the percentage is never stated |

---

## 4. Sector rules — turnover days

`NEEDS_CONFIRMATION`. In the source workbook these are a `VLOOKUP` into an RM-side
`Data Base` sheet that **was not part of the supplied material**. The values below are
plausible indicative norms, seeded so the engine is exercisable, and fully editable.

| Sector | Inventory days | Receivable days | Creditor days |
|---|---|---|---|
| Ticarət | 60 | 45 | 60 |
| Topdan ticarət | 75 | 60 | 75 |
| Pərakəndə ticarət | 45 | 15 | 45 |
| İstehsal | 90 | 60 | 60 |
| Tikinti | 120 | 90 | 90 |
| Xidmət | 30 | 30 | 45 |
| Nəqliyyat | 20 | 45 | 30 |
| Kənd təsərrüfatı | 180 | 60 | 90 |

Creditor-day norms are `INFERRED` — the source shows the ratio but states no norm.

---

## 5. Stop factors — `config/policy.ts`, `STOP_FACTORS_V1`

Evaluated separately from the scorecard, by named evaluators in
`domain/rules/stop-factors.ts`.

| ID | Condition | Auto-reject | Escalation | Sector waiver | Status | Source |
|---|---|---|---|---|---|---|
| `SF_AKB_EXTRACTS_MISSING` | Bureau extracts not obtained for every connected person | No | Yes | — | CURRENT | §4.3, §4.10 |
| `SF_UNJUSTIFIED_DPD_30_PLUS` | Unjustified 30+ day delinquency | No | Yes | — | CURRENT | §4.6 |
| `SF_OWNERSHIP_NOT_CONFIRMED` | Business-ownership evidence score ≤ 40 | No | Yes | — | CURRENT | §5.1.1 |
| `SF_DEBT_TO_EQUITY_OVER_100` | Debt-to-equity incl. new facility > 100% | No | Yes | **Xidmət** | CURRENT | §6.2 |
| `SF_REPAYMENT_CAPACITY_NORM` | Payment / forecast capacity > 0.8 | No | Yes | **Kənd təsərrüfatı** (when the forecast shows capacity) | NEEDS_CONFIRMATION | §6.3 |
| `SF_PURPOSE_NOT_ASSESSABLE` | Purpose efficiency = 0 **AND** control = 0 | No | Yes | — | CURRENT | §7.5 |
| `SF_PRESCREEN_BUREAU_SCORE` | ACB score < 400 | **Yes** | Yes | — | PROMETEIA_PROPOSED | ERM Diagnostic |

`SF_PRESCREEN_BUREAU_SCORE` ships **disabled**. It is Prometeia's proposal, not ATB policy,
and enabling it is an administrator decision.

Collateral is deliberately absent: Metodologiya §8.5 states explicitly that collateral is
never a stop factor, and Excel `J109` excludes `J93` from its OR-guard.

### Effect on routing

When any stop factor fires, `routeApplication` abandons ordinary bucket routing and sends
the case to `stopFactorEscalationAuthority` — the Management Board under V1 naming, the Big
Committee under V2 — with an explicit reason. Prometeia's wording: *"Any application that
triggers a Stop Factor is automatically rejected, and no escalation route is available
except to the Management Board."*

---

## 6. Legacy Yekun Rəy weights — `config/scorecards.ts`

| Criterion | Weight | Global stop | Aggregation |
|---|---|---|---|
| Kredit tarixçəsinin təhlili | 20 | Yes | Weighted sum |
| Biznes fəaliyyətinin təhlili | 20 | Yes | Mean of manual 0–100 scores |
| Maliyyə məlumatlarının təhlili | 35 | Yes | Mean of manual 0–100 scores |
| Kreditin təyinatının təhlili | 15 | Yes (joint condition) | Weighted sum |
| Təminatın təhlili | 10 | **No** | Weighted sum |

### Sub-component weights

**Credit history (20 points):** AKB extracts 35% · unjustified recent inquiries 5% ·
unjustified 0–30 DPD 10% · unjustified 30+ DPD 20% · repaid by instalments 15% ·
debt-burden increase 15%.

**Business (20 points, averaged):** ownership link · structure and management ·
documentation and reporting — 33.34 / 33.33 / 33.33.

**Financial (35 points, averaged):** balance sheet · income statement · cash flows ·
statement comparison · ratios — 20% each.

**Purpose (15 points):** supporting documents 25% · efficiency 50% · control 25%.

**Collateral (10 points):** owner relationship 50% · risk grade 20% · guarantor
suitability 30%.

### Risk bands (applied with `>=`)

| Band | Score |
|---|---|
| Aşağı riskli (Low) | 86–100 |
| Orta aşağı riskli (Medium-low) | 71–85 |
| Orta riskli (Medium) | 56–70 |
| Orta yüksək riskli (Medium-high) | 41–55 |
| Yüksək riskli (High) | 0–40 |

A triggered stop factor short-circuits the total to **0**, regardless of the other
criteria. The pre-stop score is retained as `rawTotal`.

---

## 7. Rating configuration — `config/rating.ts`

### ACB score bands (`PROMETEIA_PROPOSED`)

| Score | Grade |
|---|---|
| 0–149 | Poor / Zəif |
| 150–399 | Satisfactory / Qənaətbəxş |
| 400–699 | Medium / Orta |
| 700–859 | Good / Yaxşı |
| 860–1000 | Excellent / Əla |

Pre-screen threshold **400** (i.e. score ≤ 399 fails), action `REJECT`, no-score action
`ESCALATE_TO_UW`. A second scale, `ACB_SCALE_ATB_CURRENT_V1`, reproduces the current state
where the bureau report is read manually and no automated gate exists.

### Segmentation (`PROMETEIA_PROPOSED`)

Post-transaction group exposure **≥ 300,000 AZN → Medium (İri)**, below → Small (Kiçik).

### Business-analysis bands and notches (`PROMETEIA_PROPOSED`)

| Total score (3–9) | Band | Notch |
|---|---|---|
| 9 | Low | 0 |
| 7.00–8.99 | Low-Medium | 0 |
| 6.00–6.99 | Moderate | 0 |
| 4.00–5.99 | Medium-High | **−1** |
| 3.00–3.99 | High | **−2** |

### Altman notches (`PROMETEIA_PROPOSED`)

High risk **−2** · Grey **0** · Low risk **+1**, blocked when the initial rating is Poor.
Applies to the **Medium segment only**. Cumulative movement capped at **−2 … +1**.

### Collateral haircuts (`INFERRED`)

| Type | Haircut | Counts toward eligible coverage |
|---|---|---|
| Residential real estate | 0% | Yes |
| Commercial real estate | 10% | Yes |
| Land | 25% | Yes |
| Equipment | 30% | Yes |
| Vehicle | 25% | Yes |
| Cash / deposit | 0% | Yes |
| Receivables | 50% | Yes |
| Inventory | 50% | Yes |
| Personal guarantee | 100% | **No** |
| Corporate guarantee | 100% | **No** |

The sources use liquidation value directly and contain no haircut table. These are
indicative and fully editable. Unregistered collateral is excluded regardless of type,
with registration surfaced as a condition precedent.

---

## 8. Data-quality factors — `config/scorecards.ts`, `DATA_QUALITY_V1`

| Factor | Weight |
|---|---|
| Tax information | 15 |
| Bank statements | 15 |
| Inventory evidence | 12 |
| Financial reporting | 12 |
| Receivable evidence | 10 |
| Supplier / creditor evidence | 10 |
| Collateral documents | 8 |
| Purpose documents | 8 |
| Reconciliation breaks | 6 |
| Verbal-data dependency | 4 |

Evidence weights: Verified 1.00 · Partially verified 0.65 · Analyst estimate 0.35 ·
Verbal 0.25 · Missing 0 · Contradictory 0.

Grades: **A** ≥ 90 · **B** ≥ 75 · **C** ≥ 60 · **D** ≥ 40 · **E** < 40.

Derived from the evidence hierarchies in Metodologiya §6.2–§6.4, which rank tax
declaration > bank / cash-register / barcode / computer records > written records > verbal.

---

## 9. Covenant templates — `config/policy.ts`

| Template | Metric | Default | Frequency |
|---|---|---|---|
| Debt / EBITDA | `debtToEbitda` | ≤ 3.50 | Quarterly |
| DSCR | `dscrCurrent` | ≥ 1.25 | Quarterly |
| Equity / Assets | `equityToAssets` | ≥ 0.30 | Semi-annual |
| Current ratio | `currentRatio` | ≥ 1.20 | Quarterly |
| Minimum bank turnover | `annualBankTurnover` | case-specific | Quarterly |
| Dividend restriction | `ownerWithdrawals` | case-specific | Annual |
| Additional debt restriction | `totalBankDebt` | case-specific | Quarterly |
| Collateral coverage | `eligibleCollateralCoverage` | ≥ 1.00 | Annual |

---

## 10. Where a threshold cannot be trusted yet

Anything marked `NEEDS_CONFIRMATION` or `INFERRED` above is reproduced with its reasoning
in `docs/underwriting-open-questions.md`. The short list of the material ones:

1. The **0.8 payment-to-capacity coefficient** — a stop factor whose source document was
   never supplied.
2. **Sector turnover-day norms** — the `Data Base` sheet is missing.
3. **Collateral coverage percentage** — the CBA requirement is cited but never quantified.
4. **Gearing 0.5** — present in one source panel and absent from the other.
5. **"Fully collateralized" and "80% collateralized"** — used in routing but never defined
   against market or eligible value.
