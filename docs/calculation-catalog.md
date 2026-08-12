# Calculation Catalog

Every formula the platform computes, where it is implemented, and where it came from.

All calculations are **pure functions** in `/domain/calculations`, `/domain/scoring`,
`/domain/rating`, `/domain/rules` and `/domain/workflow`. None of them import React, touch
the network, or read configuration implicitly — configuration is always passed in as an
argument so a historic case can be replayed with the configuration it was decided under.

Unit tests live in `/tests/calculations.test.ts` (35 cases) and `/tests/engines.test.ts`
(47 cases).

Convention notes carried over from the source workbook:

- The year is **360 days** in every turnover-day calculation.
- Part-year periods are **annualised** before return and leverage ratios are computed.
- A divide-by-zero returns **`null`**, never `Infinity` or `NaN` — except where "no
  capacity at all" is a meaningful answer, which is returned as `Infinity` so a `≤`
  policy floor cannot silently pass a negative quotient.

---

## 1. Statement roll-ups — `domain/calculations/statements.ts`

Mirrors the `Balans chart`, `MZH chart` and `Cash chart` sheets of the ATB opinion workbook.

| Output | Formula | Source |
|---|---|---|
| `currentAssets` | Cash + Receivables + Inventory + Other current assets | Balans E4 |
| `totalAssets` | Current assets + Fixed assets + Other non-current | Balans E27 |
| `currentLiabilities` | Short-term bank debt + Payables + Other current | Balans L5 |
| `totalLiabilities` | Current + Non-current liabilities | Balans L4 |
| `totalEquity` | Share capital + Retained earnings + Owner contributions − Owner withdrawals + Other equity | Balans L22 |
| `totalBankDebt` | Short-term bank debt + Long-term bank debt | Balans L6+L7+L14+L15 |
| `netDebt` | Total bank debt − Cash | derived |
| `workingCapital` | Current assets − Current liabilities | Əmsallar C7 |
| `balanceCheck` | Total assets − (Total liabilities + Equity) | integrity check |
| `grossProfit` | Sales − COGS | MZH C44 |
| `ebitda` | Gross profit − Operating expenses | MZH C74 |
| `ebit` | EBITDA − Depreciation | MZH C76 |
| `profitBeforeTax` | EBIT − Interest + Other income − Other expenses | MZH C76−C77..C79 |
| `netProfit` | Profit before tax − Tax | MZH C80 |
| `netOperatingCashFlow` | Receipts − (Supplier + Payroll + Rent + Tax + Other opex) − Interest paid | Pul axını C76 |
| `investingCashFlow` | −CAPEX | Pul axını C84 |
| `financingCashFlow` | Owner injection − Owner withdrawal + New borrowing − Principal repaid | Pul axını C106 |
| `periodDscr` | (Net operating CF + Interest paid) / (Interest paid + Principal repaid) | Pul axını C109 |

Owner withdrawals sit in **financing**, not operating — so repayment capacity must
subtract them separately rather than assume they are already gone.

---

## 2. Financial ratios — `domain/calculations/ratios.ts`

Every ratio returns an `ExplainedMetric` carrying `formula`, `inputs`, `source`, `period`
and `lens`, which is what makes each figure clickable in the UI (§27).

### Profitability

| Key | Formula | Norm | Source |
|---|---|---|---|
| `grossMargin` | Gross profit / Sales | — | MZH |
| `ebitdaMargin` | EBITDA / Sales | — | MZH |
| `netMargin` | Net profit / Sales | — | Əmsallar |
| `roa` | Annualised net profit / Total assets | ≥ 5% | Əmsallar, Balans panel |
| `roe` | Annualised net profit / Equity | ≥ 8% | Əmsallar, Balans panel |

> The source is internally inconsistent here: `Əmsallar` uses **retained profit** as the
> numerator while the `Balans` panel uses **annualised net profit**. The platform uses
> annualised net profit and the discrepancy is logged in
> `docs/underwriting-open-questions.md`.

### Liquidity

| Key | Formula | Norm |
|---|---|---|
| `currentRatio` | Current assets / Current liabilities | ≥ 1.50 |
| `quickRatio` | (Current assets − Inventory) / Current liabilities | ≥ 1.00 |
| `cashRatio` | Cash / Current liabilities | — |

### Leverage

| Key | Formula | Norm |
|---|---|---|
| `debtToEquityInclNew` | (Total liabilities + New loan − Debt being closed) / Equity | ≤ 1.00 **(stop factor)** |
| `debtToEquity` | Total liabilities / Equity | — |
| `leverage` | Total assets / Equity | ≤ 2.00 |
| `gearing` | Total bank debt / Equity | ≤ 0.50 |
| `liabilitiesToAssets` | Total liabilities / Total assets | — |
| `equityToAssets` | Equity / Total assets | — |
| `debtToEbitda` | Total bank debt / Annualised EBITDA | — |
| `netDebtToEbitda` | Net debt / Annualised EBITDA | — |

### Debt service

| Key | Formula | Norm |
|---|---|---|
| `dscrCurrent` | (Net operating CF + Interest) / (Interest + Principal) | ≥ 1.50 |
| `dscrPostTransaction` | CFADS / Post-transaction debt service | ≥ 1.50 |
| `interestCoverage` | EBIT / Interest | — |
| `ebitdaToInterest` | EBITDA / Interest | — |
| `cashCoverageOfBankDebt` | Annual forecast cash flow / Total bank debt | ≥ 0.35 |
| `minForecastClosingCash` | MIN(monthly forecast closing balances) | ≥ 0 |

### Working capital and efficiency

| Key | Formula | Norm |
|---|---|---|
| `workingCapitalTurnover` | Annual sales / Working capital | ≥ 1.50 |
| `inventoryDays` | 360 × Inventory / Annual **COGS** | sector |
| `receivableDays` | 360 × Receivables / Annual sales | sector |
| `creditorDays` | 360 × Payables / Annual purchases | sector |
| `cashConversionCycle` | Inventory days + Receivable days − Creditor days | — |
| `assetTurnover` | Annual sales / Total assets | ≥ 1.00 |
| `inventoryTurnover` | Annual COGS / Inventory | — |
| `breakevenPoint` | Operating expenses / Gross profit | — |

> Inventory days: the methodology PDF's label says "annual sales" but both source
> implementations divide by **COGS**. The formula won; the label is stale.

---

## 3. Altman Z-score — `domain/calculations/altman.ts`

Common inputs: `X1 = WC/TA`, `X2 = RE/TA`, `X3 = EBIT/TA`, `X4 = Equity/Liabilities`,
`X5 = Sales/TA`.

| Variant | Formula | Low risk | High risk |
|---|---|---|---|
| General | `1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5` | Z > 2.99 | Z < 1.81 |
| **Private (default)** | `0.717·X1 + 0.847·X2 + 3.107·X3 + 0.420·X4 + 0.998·X5` | Z > 2.90 | Z < 1.23 |
| Emerging markets | `3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4` | Z > 2.60 | Z < 1.10 |

All three exist in the ATB workbook (`Əmsallar` rows 29–63) with a selector; Prometeia's
proposal uses the private-firm variant, which is therefore the platform default.

**Boundary handling.** Neither source states which zone an exactly-boundary Z belongs to.
The platform treats an exact boundary as **grey** (the conservative reading) and exposes
the choice as `NOTCHING_PROMETEIA_V1.altman.boundaryInclusive`.

---

## 4. Amortisation and loan sizing — `domain/calculations/amortisation.ts`

| Function | Formula |
|---|---|
| `annuityPayment(P, r, n)` | `P·i / (1 − (1+i)^−n)` where `i = r/100/12` — equals Excel `PMT` |
| `loanFromPayment(A, r, n)` | `A·(1 − (1+i)^−n) / i` — the exact inverse |
| `buildSchedule` | Month-by-month rows; grace months are interest-only for all types |
| `steadyStateMonthlyPayment` | Mean payment over non-grace months |
| `maxSustainableLoan` | `available = CFADS / minDSCR − existing service`, then inverted to a principal |

`maxSustainableLoan` deliberately measures DSCR against **total** debt service rather than
incremental, because that is how the ratio is defined. A borrower whose existing
amortisation already consumes the DSCR headroom therefore has zero new capacity, and the
engine says so (`bindingConstraint: 'NO_CAPACITY'`) instead of returning a negative number.

Amortisation types: `ANNUITY`, `EQUAL_PRINCIPAL`, `BULLET`, `SEASONAL` (principal falls due
at each quarter-end, for agricultural cash-flow shapes).

---

## 5. Repayment capacity — `domain/calculations/repayment-capacity.ts`

Two conventions coexist in the ATB material and both are produced, because the stop factor
is defined on one and DSCR structuring needs the other.

**ATB convention** (reproduces `MZH!Q6`, the denominator of the 0.8 coefficient):

```
capacityAtb = retained profit/month
            + interest charged in costs
            + principal charged in costs
            − payments remaining at other banks after the deal
```

**Cash convention** (drives DSCR and the max-loan solver):

```
CFADS = operating cash/month + interest added back
      − maintenance capex
      − working-capital absorption   ← only when no cash-flow statement exists
      − owner withdrawals
      − recurring obligations
```

Two decisions worth stating explicitly, both of which were bugs before they were fixed:

1. **Working capital is not double-counted.** A direct-method cash-flow statement already
   embeds the working-capital movement; subtracting the balance-sheet delta again would
   charge the same drag twice.
2. **Maintenance capex, not total capex.** Charging a one-off expansion year in full
   understates sustainable cash. The proxy is `min(actual capex, depreciation)`.

Derived: `paymentToCapacity` (the 0.8 test), `allPaymentsToRetainedProfit`, `dscrBefore`,
`dscrAfter`, `headroomMonthly`.

`capacityBreakEven` reproduces the workbook's sensitivity block: by how much can sales,
margin, costs or debt service move before capacity falls below the payment.

---

## 6. Forecast and stress — `forecast.ts`, `stress.ts`

`buildForecast` produces a monthly cash flow over the loan tenor, applying the customer's
12-month seasonality index, the existing debt service **net of anything being refinanced**,
and the proposed facility's own amortisation schedule. Outputs: minimum cash and the month
it occurs, count of negative months, liquidity gap, worst and average monthly DSCR.

`runStressTest` re-runs the same forecast engine under three scenarios (Base / Downside /
Severe) shifting revenue, gross margin, receivable and inventory days, FX, interest rate
and capex, and reports EBITDA, CFADS, DSCR, Debt/EBITDA, minimum cash and the specific
covenant or policy breaches each scenario would cause.

---

## 7. Cross-checks — `domain/calculations/cross-checks.ts`

Eight reconciliations, each with a configurable materiality tolerance:

| Check | Identity | Tolerance |
|---|---|---|
| Balance integrity | Assets = Liabilities + Equity | 0.1% |
| Equity reconciliation | Opening equity + Profit + Injection − Withdrawal = Closing equity | 5% |
| Sales → cash | Sales − ΔReceivables ≈ Collections | 10% |
| COGS → purchases | COGS + ΔInventory − ΔPayables ≈ Supplier payments | 10% |
| Inventory roll-forward | Opening + Purchases − COGS = Closing | 10% |
| Debt reconciliation | Bureau debt = Balance-sheet bank debt | 2% |
| Bank turnover | Bank credits + POS + Cash ≈ Declared sales | 15% |
| Indirect cash flow | Opening cash + Profit + Depreciation − ΔWC − CAPEX + ΔDebt + Injection − Withdrawal = Closing cash | 10% |

Debt reconciliation compares against the **applicant's own** bureau report only —
related-party borrowings sit on their own balance sheets and would produce a false gap.

Each result reports expected, actual, difference, difference as a share of a meaningful
scale, and a plain-language interpretation of what the gap means for the credit.

---

## 8. Bureau analytics and refinancing — `domain/calculations/bureau.ts`

`summariseBureau` aggregates debt, service, facility counts, DPD, guarantees and inquiries.

`analyseRefinancing` reproduces the `AKBÇ təhlili` sheet. For each facility it splits the
original principal into the part genuinely amortised by instalments and the part
extinguished early, then looks for a facility issued within **45 days** of the closure
whose size covers at least **60%** of the early repayment — that facility is treated as the
refinancer, and the excess is recorded as cash-out.

`instalmentRepaymentShare` is the benchmark: total repaid by instalments / total original
principal, against the methodology's **>50%** test.

Flags: low ordinary amortisation, repeated refinancing, high refinancing share, short gap
between closure and new loan, and debt evergreening — the last of which only fires when
growth is **not** accompanied by genuine amortisation, so an expanding borrower who repays
on schedule is not mislabelled.

`debtBurdenIncrease` compares the post-transaction monthly payment with the highest monthly
payment ever serviced in parallel over a 12-month lookback (the `Aylıq ödəniş` matrix),
against the methodology's **50%** guidance.

`computeGroupExposure` produces existing, requested, debt-being-refinanced and
post-transaction exposure — the last of which is what approval routing uses.

---

## 9. Collateral — `domain/calculations/collateral.ts`

```
eligible value = max(forced-sale value × (1 − haircut) − prior lien, 0)
```

Guarantees and unregistered collateral are excluded from eligible coverage but remain
visible with a stated reason, so the reader can see what was discounted and why.

Outputs: market/forced-sale/eligible totals, `coverage`, `eligibleCoverage` (the policy
metric), LTV per item, secured and unsecured exposure.

---

## 10. Scoring and rating engines

| Engine | File | What it computes |
|---|---|---|
| Legacy Yekun Rəy | `domain/scoring/legacy-opinion.ts` | ATB's 5-criterion expert assessment, including the stop-factor short-circuit |
| Bureau rating | `domain/rating/rating-engine.ts` | Score → band, worse of micro and individual |
| Pre-screening | same | PASS / REJECT / ESCALATE_TO_UW |
| Business analysis | same | 3 areas × 1–3, area 2 averaged, total 3–9 → risk band → notch |
| Financial layer | same | Altman zone → notch, Medium segment only |
| Rating waterfall | same | Initial → business → financial → cap → override → final |
| Data quality | `domain/rules/data-quality.ts` | Weighted evidence score → grade A–E |
| Policy | `domain/rules/policy-engine.ts` | Sub-sector > sector > base rule resolution |
| Stop factors | `domain/rules/stop-factors.ts` | Seven evaluators with sector waivers |
| Routing | `domain/workflow/routing-engine.ts` | Bucket → authorities, with reasons |
| Findings | `domain/rules/findings.ts` | Deterministic findings and commentary |
| Opinion | `domain/opinion/opinion-builder.ts` | 15-section structured first draft |

### Legacy Yekun Rəy mechanics

Reproduced exactly from `Rəy forması`:

- Criteria 1, 4 and 5 are **weighted sums** of discrete answers.
- Criteria 2 and 3 are the **arithmetic mean** of manually-scored 0–100 sub-blocks, scaled
  to the criterion's points. (Worked example from the source: 60/56/50/50/56 → mean 54.4%
  × 35 = 19.04 points, which the test suite asserts.)
- A stop factor zeroes its criterion; a zeroed criterion 1–4 zeroes the whole opinion
  (Excel `J109`'s OR-guard). **Collateral is excluded** from that guard.
- With no credit history, only the first sub-item is assessed and the criterion is capped
  at 60% of 20 = 12 points.
- The pre-stop total is retained as `rawTotal` so the reader can see what the file would
  have scored.

### Rating waterfall

```
ACB score → band → initial grade
          → business-analysis notch  (0 / −1 / −2)
          → Altman notch             (+1 / 0 / −2, Medium segment only)
          → cumulative cap           (−2 … +1)
          → override                 (calculated grade retained)
          → final internal rating
```

The Altman upgrade is blocked when the initial rating is Poor. Every step records the
grade before, the grade after, the notch and a written reason.
