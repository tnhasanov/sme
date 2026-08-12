# ATB SME Underwriting Platform — Implementation Specification

Next.js 14 (App Router) · TypeScript · Tailwind · Vitest. Server components throughout; no client-side data fetching in the analysis path.

Companion documents: `docs/as-is-vs-to-be.md` (what the two worlds are and why they stay apart), `docs/workflow-matrix.md` (every routing bucket in every seeded version).

Source tags used below are the ones defined in `docs/as-is-vs-to-be.md` — `[MET §x]`, `[RƏY <cell>]`, `[PRO s.N]`, `[TƏQ <sheet>!<cell>]`.

---

## 1. Architecture layers

The codebase is a strict one-way stack. Nothing in a lower layer imports from a higher one.

```
app/            Next.js routes — server components, rendering only
    ↑
components/     Presentational primitives + application chrome
    ↑
services/       Orchestration: assessment.ts (one snapshot per case), application-service.ts (per-request memoisation)
    ↑
domain/         Pure functions: calculations, rating, rules, scoring, opinion, workflow
    ↑
config/         Versioned, source-cited parameters — every threshold in the system lives here
    ↑
types/          Shared vocabulary: core primitives, application aggregate, financial statements
```

`repositories/` sits beside `services/`: it defines persistence contracts (`repositories/types.ts`) and the current in-memory implementation (`repositories/in-memory.ts`). `data/seed/` supplies typed synthetic fixtures. `lib/` holds formatting and class-name helpers only.

**Rules that hold everywhere:**

- **No hard-coded thresholds outside `config/`.** A number that a credit officer could argue about is a config entry with a `sourceRef` and a `SourceStatus`. `app/configuration/page.tsx` renders every one of them with its provenance badge.
- **Domain functions are pure.** They take explicit inputs and return explicit results; they never read the repository, the request, or the clock.
- **One snapshot per case.** Pages read `assessment`; they never recompute a ratio locally. This is what keeps the sticky risk panel, the rating waterfall and the credit memo from disagreeing.
- **Every material number carries provenance.** See §5.1 (`TracedValue`).

---

## 2. The four conceptual layers the platform keeps apart

These are not code layers — they are the four questions an underwriting file has to answer separately. Collapsing any two of them is how a credit process loses its audit trail.

| Layer | Question it answers | Where it lives | What it must **not** do |
|---|---|---|---|
| **1. Credit Analysis** | *What is actually true about this borrower?* Spread the statements, reconcile them, test the evidence, model the cash. | `domain/calculations/*` — `statements`, `ratios`, `cross-checks`, `bureau`, `collateral`, `forecast`, `repayment-capacity`, `stress`, `amortisation`, `altman` | Produce a grade or an approve/decline. It produces facts and metrics with lineage. |
| **2. Risk Rating** | *How risky is this obligor, on a scale?* | `domain/rating/rating-engine.ts` (Prometeia waterfall) and `domain/scoring/legacy-opinion.ts` (ATB Yekun Rəy) — **two engines, never merged** | Enforce policy or pick an authority. A rating is an opinion about risk, not a decision. |
| **3. Credit Policy** | *Does this deal comply with the bank's rules?* Ratio norms, stop factors, collateral haircuts, sector carve-outs. | `domain/rules/policy-engine.ts`, `domain/rules/stop-factors.ts`, `domain/rules/data-quality.ts`, driven by `config/policy.ts` and `config/scorecards.ts` | Change the rating. A policy breach is an exception to be approved or a stop factor to be cleared, not a notch. |
| **4. Credit Decision** | *Who is allowed to say yes, and did they?* | `domain/workflow/routing-engine.ts` driven by `config/workflow.ts`; `DecisionRecord` / `RejectionRecord` on the application | Re-derive risk. It consumes exposure, coverage, both ratings, stop-factor and exception counts, and outputs authorities plus the reasons it landed there. |

The separation shows up in the assessment snapshot as four independent result groups — calculation outputs (`ratios`, `repayment`, `forecast`, `collateral`, `crossChecks`, …), `rating` + `legacy`, `policy` + `stopFactors` + `dataQuality`, and `routing` — and in the UI as separate tabs (Financial Ratios / Risk Rating / Policy & Stop Factors / Approval Routing).

---

## 3. End-to-end pipeline (`services/assessment.ts`)

`assessApplication(application, customer, options)` runs every engine in a fixed order and returns one immutable snapshot. Order matters: each block below consumes outputs of the blocks above it.

| # | Step | Calls | Notes |
|---|---|---|---|
| 0 | **Resolve frozen configuration** | `LEGACY_SCORECARDS[...]`, `BUSINESS_SCORECARDS[...]`, `POLICY_VERSIONS[...]`, `WORKFLOW_VERSIONS[...]`, `ACB_SCALES.ACB_SCALE_PROMETEIA_V1`, `NOTCHING_CONFIGS.NOTCHING_PROMETEIA_V1` | Resolved from the ids frozen on the application; `options.workflowVersionId` overrides the workflow for what-if only. The ACB scale and notching config are currently pinned to the Prometeia versions rather than derived from the workflow version — a known simplification. |
| 1 | **Periods and statements** | `balanceTotals`, `incomeTotals`, `cashFlowTotals` (`domain/calculations/statements.ts`) | Periods sorted by `endDate`; the *previous* period is the last non-forecast period strictly **before** the primary one — taking simply "the last non-primary period" would pick up a later YTD stub and invert every trend. |
| 2 | **Bureau, group exposure, refinancing, debt burden** | `summariseBureau`, `analyseRefinancing`, `computeGroupExposure`, `debtBurdenIncrease` (`domain/calculations/bureau.ts`); `steadyStateMonthlyPayment` (`amortisation.ts`) | Group exposure = group members' exposure + requested amount − facilities being closed `[PRO s.18]`. Post-transaction monthly debt service = existing service − service being refinanced + proposed payment. |
| 3 | **Collateral** | `computeCollateralCoverage` (`domain/calculations/collateral.ts`) with `COLLATERAL_HAIRCUTS_V1` | Produces eligible (post-haircut) coverage against post-transaction ATB exposure — the number the routing gates read. |
| 4 | **Forecast and repayment capacity** | `buildForecast` (`forecast.ts`), `computeRepaymentCapacity` and `capacityBreakEven` (`repayment-capacity.ts`) | Capacity is charged **maintenance** capex only (`min(actual capex, depreciation)`); charging a one-off expansion year in full would understate sustainable cash. Refinanced facilities are dropped from the forecast to avoid double-counting service alongside the loan replacing them. Mirrors `[RƏY MZH Q6–Q12]`. |
| 5 | **Ratios** | `computeRatios` (`ratios.ts`) for the current period and again for the previous one | Ratio set and norms mirror `[RƏY Əmsallar]` and the `[RƏY Balans]` embedded panel. |
| 6 | **Altman** | `altmanInputsFrom` + `computeAltman(..., 'PRIVATE', ...)` (`altman.ts`) | Z′ private-firm variant, the one Prometeia specifies `[PRO s.14]`; the workbook's general and emerging-market variants are also available in `ALTMAN_VARIANTS`. |
| 7 | **Cross-checks** | `runCrossChecks` (`cross-checks.ts`) | Statement triangulation per `[MET §6.5]` plus bureau-vs-balance-sheet debt reconciliation. The applicant's own bureau report is the anchor; related-party borrowings sit on their own balance sheets. |
| 8 | **Rating** | `computeBureauRating` → `preScreen` → `computeRating` (`domain/rating/rating-engine.ts`) | Bureau grade = worst of micro and individual `[PRO s.18]`; then business notch; then Altman notch (Medium only); then cap. |
| 9 | **Legacy expert assessment** | `evaluateLegacyOpinion` (`domain/scoring/legacy-opinion.ts`) | Independent of step 8. Receives `noCreditHistory` and `sector` so the 12/20 cap `[MET §4.10]` and the sector waivers `[MET §6.2, §6.3]` apply correctly. |
| 10 | **Policy** | `evaluatePolicy` (`domain/rules/policy-engine.ts`) over a flat `metricValues` map | The map merges computed ratios with capacity, coverage, instalment-repayment share, debt-burden increase, current max DPD and minimum forecast cash, so a policy rule can address any of them by `metric` key. |
| 11 | **Stop factors** | `evaluateStopFactors` → `triggeredStopFactors` (`domain/rules/stop-factors.ts`) with `STOP_FACTORS_V1` | Reads the legacy answers where they exist (`AKB_EXTRACTS_OBTAINED`, `UNJUSTIFIED_DPD_30_PLUS`, `BUSINESS_OWNERSHIP_LINK`, `PURPOSE_EFFICIENCY`, `PURPOSE_CONTROL`) and falls back to computed evidence otherwise. |
| 12 | **Data quality** | `computeDataQuality` (`domain/rules/data-quality.ts`) with `DATA_QUALITY_V1` | Scores documents, the evidence status of every `TracedValue` on the current statements, and unresolved cross-check breaks into an A–E grade. |
| 13 | **Structuring** | `maxSustainableLoan` (`amortisation.ts`), `runStressTest` (`stress.ts`) | Maximum loan solved at DSCR 1.5 through the same amortisation engine the proposed structure uses. |
| 14 | **Routing** | `routeApplication` (`domain/workflow/routing-engine.ts`) | Consumes exposure, coverage, both grades, `isWorstRating`, stop-factor count, policy-exception count, segment, pre-screen result and the underwriter's recommendation. |
| 15 | **Findings and commentary** | `generateFindings`, `generateCommentary` (`domain/rules/findings.ts`) | Deterministic prose from computed values plus any manual findings. No language model is involved anywhere in the platform. |
| 16 | **Return snapshot** | — | Includes `versions: { workflow, workflowLabel, workflowStatus, scorecard, legacyScorecard, policy, acbScale, notching, worstRating }`. |

`services/application-service.ts` wraps the repository and memoises per request with React `cache`, so a page and its sticky panel share one computation. `getCase(id, lens)` is the single entry point every route uses.

---

## 4. Module map

### `types/`

| File | Responsibility |
|---|---|
| `types/core.ts` | Primitives shared by everything: `TracedValue` + `valueOf`/`tv`, `FinancialLens`, `EvidenceStatus`, `SourceType`, `Severity`, `RuleOutcome`, `ComparisonOperator`/`compare`, `RuleAction`, `SourceStatus`, `VersionedArtifact`, `ExplainedMetric`, `safeDiv` |
| `types/application.ts` | The application aggregate: `Customer`, `LoanStructure`, `PurposeLine`, `GroupMember`, `CreditFacility`, `CreditBureauReport`, `Collateral`, `CreditDocument`, `BusinessAssessment`, `LegacyAssessment`, `Finding`, `Covenant`, `CreditCondition`, `ApplicationStage`, `DecisionRecord`, `RejectionRecord`, `AuditEntry`, `SectorData`, `CreditApplication` |
| `types/financials.ts` | `FinancialPeriod`, `BalanceSheet`, `IncomeStatement`, `CashFlowStatement` (all `TracedValue`-typed) and their `*Totals` derived shapes; `ForecastMonth`/`ForecastSummary`; `FinancialAdjustment`; `MonthlyTurnover` |

### `config/` — the parameter surface

| File | Responsibility |
|---|---|
| `config/workflow.ts` | `AUTHORITIES`, `AUTHORITY_LABEL_AZ`, `AUTHORITY_RANK`, `RoutingBucket`, `WorkflowVersion`, the five seeded versions, `WORKFLOW_VERSIONS`, and `SLA_V1` |
| `config/rating.ts` | `RATING_GRADES`/`GRADE_ORDER`, `AcbRatingScale` (`ACB_SCALE_PROMETEIA_V1`, `ACB_SCALE_ATB_CURRENT_V1`), `SegmentationConfig`, `NotchingConfig` (`NOTCHING_PROMETEIA_V1`), `WorstRatingConfig`, `statusBadge` |
| `config/scorecards.ts` | `LegacyScorecard` + `ATB_YEKUN_REY_V1` (5 criteria, stop rules, bands); `BusinessScorecard` + `PROMETEIA_QUICK_WIN_V1` (3 areas, 1–3 anchors); `DATA_QUALITY_V1` |
| `config/policy.ts` | `PolicyRule`/`PolicyVersion` + `ATB_POLICY_V1` (ratio norms with sector overrides), `STOP_FACTORS_V1`, `COLLATERAL_HAIRCUTS_V1`, `COVENANT_TEMPLATES` |
| `config/monitoring.ts` | `BAD_DEFINITIONS` (versioned), `CURRENT_STATE_PERFORMANCE` (Prometeia's backtest, retained verbatim as the benchmark any internal model must beat), `CURRENT_SCORECARD_POWER` (section GINIs) |

### `domain/`

| File | Responsibility |
|---|---|
| `calculations/statements.ts` | `balanceTotals`, `incomeTotals`, `cashFlowTotals` — resolve `TracedValue`s under the lens and derive subtotals |
| `calculations/ratios.ts` | `computeRatios(RatioContext)` → `ExplainedMetric` per ratio, each carrying its formula and inputs for the explainability panel |
| `calculations/bureau.ts` | `summariseBureau`, `analyseRefinancing` (instalment-repayment share, `[MET §4.7]`), `debtBurdenIncrease` (`[MET §4.8]`), `computeGroupExposure` |
| `calculations/collateral.ts` | `computeCollateralCoverage` — market/liquid values, haircuts, eligible coverage |
| `calculations/repayment-capacity.ts` | `computeRepaymentCapacity`, `capacityBreakEven` — CFADS, DSCR before/after, payment-to-capacity, all-payments-to-retained-profit, sensitivity break-evens |
| `calculations/amortisation.ts` | Payment schedules for annuity / equal-principal / bullet / seasonal; `steadyStateMonthlyPayment`, `maxSustainableLoan` |
| `calculations/forecast.ts` | `buildForecast` — monthly cash projection with seasonality, growth, existing and new debt service |
| `calculations/cross-checks.ts` | `runCrossChecks` — statement triangulation and debt reconciliation |
| `calculations/altman.ts` | `ALTMAN_VARIANTS`, `altmanInputsFrom`, `computeAltman` |
| `calculations/stress.ts` | `runStressTest` — sales, margin, cost and rate shocks against DSCR and minimum cash |
| `rating/rating-engine.ts` | `computeBureauRating`, `preScreen`, `computeRating` — the Prometeia waterfall with a per-step "why it moved" record |
| `scoring/legacy-opinion.ts` | `evaluateLegacyOpinion` — the Yekun Rəy engine, including the J109 OR-guard, the mean-of-manual-scores criteria, and the no-history cap |
| `rules/policy-engine.ts` | `evaluatePolicy`, `formatValue`, `operatorSymbol` — sector-aware rule resolution producing `RuleOutcome`s and policy exceptions |
| `rules/stop-factors.ts` | `evaluateStopFactors`, `triggeredStopFactors` — including sector waivers |
| `rules/data-quality.ts` | `computeDataQuality` — weighted evidence scoring to an A–E grade |
| `rules/findings.ts` | `generateFindings`, `generateCommentary` — deterministic narrative |
| `workflow/routing-engine.ts` | `routeApplication` — bucket selection, collateral matching, escalation logic, stop-factor override, reason list |
| `opinion/opinion-builder.ts` | `buildOpinionDraft` → `OpinionDraft { sections, positives, negatives, recommendation }`. Twelve sections (executive summary, borrower and ownership, business, loan request, credit history, group exposure, financial analysis, cash flow and repayment capacity, loan purpose, collateral, risk rating, policy compliance) plus the `Müsbət / Mənfi tərəflər` lists and a decision recommendation — built only from computed data |

### `services/`, `repositories/`, `data/`, `components/`, `app/`

| Path | Responsibility |
|---|---|
| `services/assessment.ts` | The orchestrator described in §3 |
| `services/application-service.ts` | `listApplications`, `listCustomers`, `getCustomer`, `getApplication`, `getCase`, `listCases`, `listAssessedCases` — all `cache`-memoised |
| `repositories/types.ts` | `CustomerRepository`, `ApplicationRepository`, `ApplicationFilter`, `UnitOfWork` |
| `repositories/in-memory.ts` | Module-level `Map` store, `hydrate()`, `unitOfWork` |
| `data/seed/*` | Synthetic fixtures: `builders.ts` (constructors), `case-caspian-food.ts` (full-depth reference case), `other-cases.ts` (refinancing, strong borrower, construction, agriculture), `rejected-cases.ts` (retained rejections), `index.ts` (`seedData`, `ensureSeeded`) |
| `components/layout/*` | `app-shell.tsx` (global chrome), `application-tabs.tsx` (`APPLICATION_TABS`, the canonical tab list) |
| `components/application/*` | `sticky-risk-panel.tsx` (always-visible rating / capacity / stop-factor summary), `shared.tsx` (grade chips and shared bits) |
| `components/ui/primitives.tsx` | `Panel`, `DataTable`, `Th`/`Td`, `Stat`, `Badge`, `StatusBadge`, `SeverityBadge`, `ProgressBar`, `KeyValue`, `EmptyState`, `SectionTitle` |
| `app/*` | Routes — see §6 |
| `lib/format.ts`, `lib/utils.ts` | AZN/percent/date formatting, AZ label maps, `cn` |
| `tests/calculations.test.ts`, `scripts/smoke.ts` | Vitest unit coverage of the calculation engines; a smoke script that asserts every seeded case assesses end to end |

---

## 5. Data model summary

### 5.1 `TracedValue` — provenance on every material number

```ts
interface TracedValue {
  raw: number;            // what was reported/collected — never overwritten
  adjusted?: number;      // what the underwriter decided to use
  sourceType: SourceType; // TAX_AUTHORITY | BANK_STATEMENT | POS | CREDIT_BUREAU | ...
  evidence: EvidenceStatus; // VERIFIED | PARTIALLY_VERIFIED | VERBAL | ANALYST_ESTIMATE | MISSING | CONTRADICTORY
  documentRef?: string; enteredBy?: string; modifiedBy?: string;
  modificationReason?: string; modifiedAt?: ISODateTime; note?: string;
}
```

Every balance-sheet, P&L and cash-flow line is a `TracedValue`. `valueOf(v, lens)` resolves it under the selected `FinancialLens` (`REPORTED` shows `raw`, `ADJUSTED` shows `adjusted ?? raw`), so the whole model can be re-run on reported figures with a single switch. This is the machine-readable form of the methodology's evidence hierarchy — tax declaration > bank/cash/POS/computer records > written records > verbal `[MET §6.2–§6.4]` — and it is what `computeDataQuality` scores.

### 5.2 Aggregate shape

`CreditApplication` is the aggregate root:

- **Identity and routing context** — `reference`, `customerId`, `applicationDate`, `branch`, `rm`, `underwriter`, `channel`, `stage`
- **The ask** — `requestedStructure`, optional `proposedStructure` (`LoanStructure`: product, amount, currency, rate, tenor, grace, amortisation, frequency), `purposeSummary`, `purposeLines`, repayment sources
- **Counterparty graph** — `groupMembers` (`GroupMember` with `relationshipType`, `includeInGroup`, exposure), `bureauReports` (`CreditBureauReport` → `facilities`, `guarantees`, `inquiries`, `acbMicroScore`, `individualBureauRating`)
- **Security and evidence** — `collateral`, `documents`
- **Financials** — `periods`, `balanceSheets`, `incomeStatements`, `cashFlows`, `adjustments`, `turnover`, all keyed by `periodId`
- **Assessments** — `businessAssessment` (Prometeia 1–3 answers), `legacyAssessment` (Yekun Rəy answers)
- **Sector plugin payload** — `sectorData` (`AgricultureData`, `TransportVehicle[]`, `InstallmentSalesData`, `BarterData`)
- **Frozen versions** — `workflowVersion`, `scorecardVersion`, `legacyScorecardVersion`, `policyVersion`
- **Credit decisions and overlays** — `ratingOverride`, `policyExceptions`, `manualFindings`, `riskMitigants`, `covenants`, `conditions`, `underwriterRecommendation`, `committeeDecision`, `rejection`
- **Process** — `pipeline` (stage timestamps), `auditTrail`, `previousApplicationId` (comparison anchor)

`Customer` holds the durable obligor record: legal identity, sector/sub-sector, activity years (official and unofficial — the Yekun Rəy anchors distinguish them `[MET §5.1.2]`), locations, employees, key customers/suppliers with concentration shares, `seasonalityIndex` (12 monthly weights), shareholders, management.

Stages: `DRAFT`, `PRE_SCREENING`, `RM_SUBMITTED`, `SME_CENTER_ANALYSIS`, `UNDERWRITING`, `RISK_REVIEW`, `COMMITTEE`, `DECIDED`, `REJECTED_PRESCREEN`, `RETURNED`, `CANCELLED`. Decisions: `APPROVE`, `APPROVE_WITH_CONDITIONS`, `DECLINE`, `RETURN_FOR_INFORMATION`, `ESCALATE`.

### 5.3 Rejections are first-class records

`RejectionRecord` stores `stage`, `reasonCode`, `description`, `acbScore`, `acbRating`, `groupExposure`, `requestedAmount`, `rm`, `branch`, `rejectedAt` **and** `policyVersion`, `scorecardVersion`, `workflowVersion`. `ApplicationRepository.recordRejection` mutates only `stage` and `rejection` — the full application is retained. This directly closes the gap Prometeia identified: today "rejected SME loan applications are not retained in the system" `[PRO s.4, s.24]`, which is why reject inference, approval-rate reporting and future calibration are impossible.

---

## 6. Application tabs — the 16 questions

`components/layout/application-tabs.tsx` (`APPLICATION_TABS`) is the canonical list; each entry maps to a route under `app/applications/[id]/`.

| # | Tab (AZ) | Route | Question it answers |
|---|---|---|---|
| 1 | İcmal | `/` | What is this deal, where does it stand, and what would stop it? The one-screen summary: request, exposure, rating, capacity, stop factors, top findings, routing outcome. |
| 2 | Müştəri və biznes | `/profil` | Who is the borrower, what do they actually do, and who owns and runs it? Legal identity, activity history, shareholders, management, customer/supplier concentration, seasonality, requested vs proposed structure. |
| 3 | Sənədlər | `/senedler` | What evidence do we hold, and how good is it? Document register, evidence status per data point, and the A–E data-quality grade with the factors that drove it. |
| 4 | AKB və ekspozisiya | `/akb` | What does the credit bureau say, what is the group really exposed to, and is this borrower refinancing their way forward? Facilities, delinquency history, instalment-repayment share `[MET §4.7]`, debt-burden increase `[MET §4.8]`, post-transaction group exposure. |
| 5 | Balans / MZH | `/balans-mzh` | What do the balance sheet and P&L look like across every spread period, reported and adjusted? |
| 6 | Pul axını | `/pul-axini` | Where does the cash actually come from and go, and what does the forecast show under the new structure? Historical and forecast statements, monthly closing cash, DSCR. |
| 7 | Maliyyə əmsalları | `/emsallar` | How does the borrower score against the bank's norms — profitability, liquidity, leverage, turnover — and how did each ratio get its value? Every metric explains its own formula and inputs. |
| 8 | Müqayisəli təhlil | `/muqayise` | What changed since the previous period, and is any change material (>15%)? |
| 9 | Cross-check | `/cross-checks` | Do the statements agree with each other and with the bureau? Sales vs receivables vs receipts, COGS vs supplier payments vs inventory, retained profit vs capital growth `[MET §6.5]`, and declared vs bureau debt. |
| 10 | Məqsəd və girov | `/meqsed-girov` | What is the money for, can its use be controlled, and what secures it? Purpose lines, effectiveness, collateral register, market/liquid values, haircuts, eligible coverage. |
| 11 | Risk reytinqi | `/reytinq` | What is the risk grade — under **both** engines, side by side and never merged? Bureau anchor → business notch → Altman notch → final internal rating, next to the Yekun Rəy's five criteria and its risk band. |
| 12 | Siyasət | `/siyaset` | Does the deal comply, and what has to be waived if not? Policy rule outcomes, exceptions, stop factors including sector waivers `[MET §6.2, §6.3]`. |
| 13 | Strukturlaşdırma | `/strukturlasdirma` | Can the borrower afford this, and if not, what structure would work? Repayment capacity, break-evens, alternative amounts/tenors solved through the same amortisation engine, stress tests. |
| 14 | Anderraytinq rəyi | `/rey` | What does the credit memo say? A structured draft built only from computed values, plus risks and mitigants, covenants and conditions precedent. |
| 15 | Qərar marşrutu | `/qerar` | Who decides, why them, and what would change under each of the five workflow versions? The routing engine is re-run under every seeded version for comparison — with each version's status badge attached. |
| 16 | Audit izi | `/audit` | Who changed what, when, and why? The immutable entry log plus the frozen version set for this case. |

Outside the case file: `/` (portfolio dashboard with SLA and stop-factor counts), `/applications` (queue including retained rejections), `/customers`, `/portfolio` (sector/branch/pipeline analytics), `/model-monitoring` (rating migration, override tracking, pre-screen rejection volumes against Prometeia's backtest benchmarks), `/configuration` (every threshold with its source and status).

---

## 7. Versioning and audit

### 7.1 Versioned artefacts

Every configuration object extends `VersionedArtifact`:

```ts
interface VersionedArtifact {
  version: string; label: string;
  status: SourceStatus;      // CURRENT | PROMETEIA_PROPOSED | BANK_PROPOSED | HISTORICAL | INFERRED | NEEDS_CONFIRMATION
  effectiveFrom: ISODate; effectiveTo?: ISODate;
  sourceRef: string;         // the document and slide/sheet/cell it came from
}
```

`sourceRef` is not decoration. It is how a reviewer confirms that, say, the current-ratio norm of 1.50 comes from `[RƏY Əmsallar!D5]` and not from someone's memory, and how `SLA_V1` is honestly marked `INFERRED` because no SLA appears in any source document.

### 7.2 Freezing

The four version ids on `CreditApplication` are set at submission and never rewritten. `assessApplication` resolves configuration only from them, so any case can be replayed exactly as it was decided. `RejectionRecord` carries the same ids. The snapshot echoes the full resolved set under `versions`, and the UI renders each with its `statusBadge`.

### 7.3 Audit trail

`AuditEntry` records `entity`, `field`, `oldValue`, `newValue`, `user`, `role`, `reason`, `timestamp` and a `category` (`FINANCIAL_ADJUSTMENT`, `BUREAU_UPDATE`, `RATING`, `NOTCHING`, `OVERRIDE`, `POLICY_EXCEPTION`, `STRUCTURE`, `DECISION`, `WORKFLOW`, `DATA_ENTRY`). Entries are append-only.

Three things are additionally self-documenting rather than relying on the log:

- **`TracedValue` adjustments** keep `raw` alongside `adjusted`, with `modifiedBy`, `modificationReason`, `modifiedAt`.
- **`RatingOverride`** stores the override grade, reason and approver, and the rating waterfall shows the override as a distinct step.
- **`RoutingDecision.reasons`** is generated per case — routing basis and value, segment, bucket, coverage, final grade, escalation trigger, policy-exception count, resulting authority and its rank — so "why did this go to this committee?" is answered by data, not by reading the config.

---

## 8. Anonymisation rule

**No real personal or customer data enters this repository — not in fixtures, not in tests, not in documentation, not in comments.**

The reference material (the live opinion workbook, the RM presentation workbook, the AKB extracts and the tax declarations) contains real applicant names, family members, guarantors, bank staff names, a personal phone number, residential and business addresses, collateral addresses, the valuation firm, and a full loan register with amounts and dates. All of it is customer-identifying and none of it is reproduced here.

Concretely:

1. **Fixtures are synthetic.** `data/seed/index.ts` states it: *"Every figure here is synthetic. No real customer name, tax number, phone number, address, account number or bureau record from the reference material is reproduced — only the risk patterns are carried across."* The same note appears in `builders.ts`, `case-caspian-food.ts` and `other-cases.ts`.
2. **Risk patterns, not records.** What is carried across from the real case is structure — a refinancing-heavy credit history, a plug-derived equity line, a purpose split between working capital and a fixed-asset purchase, a payment-to-capacity ratio near the norm. The numbers themselves are invented.
3. **Identifiers are masked by construction.** `Customer.taxId` is documented in the type as *"anonymised VÖEN in demo data"*, and the profile tab renders it as "VÖEN (anonimləşdirilmiş)". Customer-facing pages carry the same statement.
4. **Bank staff appear as roles, never names.** `Authority` values and `AUTHORITY_LABEL_AZ` describe positions ("Anderraytinq Mərkəzi", "KOB KM daxili komitəsi"); `DecisionRecord.decidedBy` and `AuditEntry.user` hold synthetic identifiers in seed data.
5. **Case financials from the real opinion are analysis-only.** The worked examples in the extraction notes exist to prove the scoring mechanics; they are not reused as fixtures.

When real data is eventually loaded into a deployment, the same rule applies in reverse: production data never travels back into the repository, into fixtures, or into screenshots used for documentation.

---

## 9. PostgreSQL / Prisma migration path

The persistence boundary already exists. `repositories/types.ts` defines `CustomerRepository`, `ApplicationRepository` (with `ApplicationFilter`) and the `UnitOfWork` that bundles them; `repositories/in-memory.ts` is the only implementation today, backed by two module-level `Map`s seeded once via `hydrate()`. Services and pages depend on the **interfaces**, never on the implementation — `services/application-service.ts` is the sole importer of `unitOfWork`.

`prisma` and `@prisma/client` are already dependencies; the `prisma/` directory is empty and `schema.prisma` has not been authored yet.

### Step 1 — Schema

Model the aggregate as relational tables, one per collection currently inlined on `CreditApplication`:

| Table | Source type | Notes |
|---|---|---|
| `Customer` | `Customer` | Shareholders and management as child tables; `seasonalityIndex` as `Float[]` or a child table |
| `CreditApplication` | `CreditApplication` | Scalars, the four frozen version ids, `pipeline` timestamps; `requestedStructure`/`proposedStructure` as embedded columns or a `LoanStructure` table |
| `PurposeLine`, `GroupMember`, `Collateral`, `CreditDocument` | same | FK to application |
| `CreditBureauReport` → `CreditFacility`, `BureauGuarantee`, `BureauInquiryRecord` | same | Two-level nesting |
| `FinancialPeriod` → `BalanceSheet`, `IncomeStatement`, `CashFlowStatement` | same | See Step 2 on `TracedValue` |
| `FinancialAdjustment`, `MonthlyTurnover` | same | |
| `BusinessAssessment` → `BusinessAssessmentAnswer`; `LegacyAssessment` → `LegacyScoreAnswer` | same | Keep the two assessments in separate tables — they must not share a row |
| `RiskMitigant`, `Covenant`, `CreditCondition`, `PolicyExceptionRecord`, `Finding` | same | |
| `RatingOverride`, `DecisionRecord`, `RejectionRecord` | same | One-to-one with application |
| `AuditEntry` | same | Append-only; index on `(applicationId, timestamp)` |

Configuration stays in TypeScript. Thresholds are code-reviewed, versioned artefacts with source citations — putting them in the database would lose the review trail and the type safety. If an administrator UI later needs to write them, add a `ConfigOverride` table that is resolved *on top of* the seeded defaults, never in place of them.

### Step 2 — Persist `TracedValue`

Each statement line is a value object, not a scalar. Two workable shapes:

- **Columns per field** (`cash_raw`, `cash_adjusted`, `cash_source_type`, `cash_evidence`, `cash_document_ref`, …) — verbose but fully queryable and indexable; preferred where reporting needs to filter on evidence quality.
- **A single `TracedValueEntry` table** keyed by `(statementId, statementKind, fieldKey)` — narrow schema, easy to extend, one join to reconstitute a statement.

Either way the mapper must preserve `raw` untouched and keep `modifiedBy`/`modificationReason`/`modifiedAt`, because `FinancialLens` and the data-quality grade both depend on them.

### Step 3 — Implement the repositories

Add `repositories/prisma.ts` exporting a `UnitOfWork` with the same two repositories. Translate `ApplicationFilter` (`stage`, `branch`, `rm`, `underwriter`, `customerId`, `search`) into a `where` clause; `search` currently matches `reference` case-insensitively with `az` collation — use `mode: 'insensitive'` plus an appropriate Postgres collation. `recordRejection` becomes an update of `stage` plus an upsert of the rejection row inside a transaction; it still must never delete.

Reads should use nested `include` to hydrate the full aggregate in one round trip, since `assessApplication` needs all of it.

### Step 4 — Swap the binding

`services/application-service.ts` imports `unitOfWork` from `repositories/in-memory` and calls `ensureSeeded()`. Replace both with a factory:

```ts
// repositories/index.ts
export const unitOfWork: UnitOfWork =
  process.env.DATABASE_URL ? prismaUnitOfWork : inMemoryUnitOfWork;
```

Nothing in `domain/`, `config/`, `components/` or `app/` changes. `ensureSeeded()` becomes a no-op (or a dev-only seeder) when a database is configured.

### Step 5 — Migration, seeding, tests

Author `prisma/schema.prisma`, run `prisma migrate dev` for the initial migration, and port `data/seed/*` into a `prisma/seed.ts` that writes the same synthetic cases through the Prisma unit of work — keeping the demo reproducible and keeping the anonymisation rule intact. Run `tests/calculations.test.ts` (unaffected, since domain functions are pure) plus a new repository-contract test executed against **both** implementations, so the in-memory version stays a valid stand-in for local development and CI.

### Step 6 — Production concerns to add at the same time

- **Concurrency** — the current `save()` is last-write-wins. Add a `version` column with optimistic locking before multiple underwriters can edit one case.
- **Immutability** — enforce append-only on `AuditEntry` and no-delete on applications at the database level (revoked `DELETE` grant or a trigger), not only in application code.
- **Attachments** — `CreditDocument` currently holds metadata; production needs object storage plus a checksum column.
- **Access control** — role-based filtering (branch RM sees their branch; committee members see cases routed to them) belongs in the repository layer, so every read path inherits it.
