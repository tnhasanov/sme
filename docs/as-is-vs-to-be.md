# As-Is vs To-Be — ATB SME Underwriting

**Status of this document:** analytical comparison. It describes five distinct process/scoring designs that this platform holds side by side.

> ## The two worlds must never be merged
>
> ATB's live **Yekun Rəy** expert assessment and Prometeia's proposed **Quick-Win notching framework** are two different instruments answering two different questions. The Yekun Rəy produces an *underwriting opinion* (a 0–100 expert score with a risk label); the Quick-Win framework produces a *final internal rating* (a bureau-anchored grade adjusted by notches). Averaging them, feeding one into the other, or letting a page render "the score" without saying which engine produced it destroys the audit trail on both sides.
>
> The platform enforces this structurally: two independent engines (`domain/scoring/legacy-opinion.ts` and `domain/rating/rating-engine.ts`), two independent config families (`LEGACY_SCORECARDS` and `BUSINESS_SCORECARDS` in `config/scorecards.ts`), two independent version fields frozen on every application (`legacyScorecardVersion`, `scorecardVersion`), and a `SourceStatus` badge (`CURRENT` / `PROMETEIA_PROPOSED` / `BANK_PROPOSED` / `INFERRED` / `NEEDS_CONFIRMATION`) attached to every threshold. Nothing that is a proposal is ever rendered as policy.

---

## Source key

Every claim below about ATB or Prometeia is cited with one of these tags.

| Tag | Document |
|---|---|
| `[MET §x]` | *Kiçik və Orta Biznes krediti sifarişlərinə Anderraytinq Mərkəzi tərəfindən rəy verilməsi Metodologiyası*, "Azər-Türk Bank" ASC, internal; appendix opinion form `version 26.04.2024`; approved by İdarə Heyəti |
| `[RƏY <cell>]` | Live underwriting-opinion workbook, sheet `Rəy forması`, form header `Version 01.11.2025-14.07.2026` |
| `[RƏY <sheet>]` | Other sheets of the same workbook (`AKBÇ təhlili`, `Aylıq ödəniş`, `Əmsallar`, …) |
| `[PRO s.N]` | Prometeia, *Risk Diagnostics Project – Phase 2, Deep Dive on SME Scorecard* (ATB ERM Diagnostic Status Meeting), 07.08.2026, slide N |
| `[TƏQ <sheet>!<cell>]` | `Təqdimat 50 000 AZN çox (Əlavə № 2).xlsx` — credit-committee presentation form for loans > 50,000 AZN |

---

## 1. Current ATB process (as-is)

### 1.1 Stages

Per `[PRO s.4]`:

1. **SME loan application** → **initial eligibility assessment by the branch RM**.
   - Negative → *"Application Rejected (Not Processed Further, **No Record Kept**)"* `[PRO s.4]`.
   - Positive → continue.
2. **Credit bureau query, review and group-exposure check** — performed by the RM `[PRO s.4]`.
3. **Routing by group exposure** (table below).
4. On the underwriting side, segmentation: group exposure `< 300K AZN` → Small (Kiçik); `≥ 300K AZN` → Medium (İri) `[PRO s.4]`.
5. Underwriting Center prepares the opinion on top of the RM's presentation workbook; the opinion is countersigned by the head of the SME loan-analysis unit `[MET §3.1; RƏY rows 1–27, footer]`.
6. Rejections by the SME Committee may be escalated to the Management Board `[PRO s.4]`.

The methodology itself recognises only a two-format split rather than AZN buckets: **Geniş forma (Əlavə № 2)** for applications going to the İdarə Heyəti, **Kiçik forma (Əlavə № 1)** for all other authorised bodies — *with identical assessment criteria*, only the narrative is shortened `[MET §3.1]`. The AZN thresholds themselves are not in the methodology PDF; they come from `[PRO s.4]` and from the RM form's `> 50.000 AZN` marker `[TƏQ Sifarişçi… header]`.

### 1.2 Routing table (current)

| Group exposure | Assessment by | Decision by | Volume 01.01.2024–31.03.2026 | Internal bad | External bad |
|---|---|---|---|---|---|
| Below 50,000 AZN | RM (branch) | KOB KM (SME Center) internal committee | 566 (50%) | 1% | 8% |
| 50,000 – 100,000 AZN | Underwriting Team | UW positive → KOB KM; UW negative → rejected **or** escalated to SME Committee | 343 (30%) | 1% | 15% |
| 100,000 – 300,000 AZN | Underwriting Team | SME Committee (Head of Underwriting, Head of Monitoring, CBO) | 183 (16%) | 1% | 26% |
| Above 300,000 AZN | Underwriting Team | Management Board (İdarə Heyəti) | 40 (4%) | 3% | 30% |

Source: `[PRO s.4]` for the routing, `[PRO s.7]` for the volumes and bad rates. Slide 4 and slide 7 both print the third bucket as "AZN 100,00 - 300,000" — a typo for 100,000 `[PRO F-note]`.

### 1.3 Who assesses, who decides

| Role (AZ) | Role (EN) | Responsibility | Source |
|---|---|---|---|
| Mütəxəssis / KOB satışı üzrə əməkdaş, Filial | RM / SME sales officer, branch | Builds the `Sifariş` presentation workbook: application data, credit history, balance sheet, MZH, cash flows, collateral, investment plan; assesses cases below 50K | `[RƏY Sifariş]`, `[PRO s.4]` |
| KOB satışı üzrə bir başa rəhbər | Direct SME sales manager | Countersigns the RM workbook | `[TƏQ Sifarişçi… signature block]` |
| Rəy verən əməkdaş, Anderraytinq Mərkəzi | Underwriter, Underwriting Center | Completes the `Rəy forması` on top of the RM workbook; issues the opinion | `[MET §3.1]`, `[RƏY rows 1–27]` |
| KOB kreditləri təhlili şöbə rəisi | Head of SME loan analysis unit | Countersigns the opinion | `[RƏY footer]` |
| RMD (Risk Menecmenti Departamenti) | Risk Management Department | Produces a separate Altman-Z-based "SME scoring"; the opinion is **explicitly independent** of it | `[MET §3.5]` |
| Bankın səlahiyyətli orqanı (KOB KM / KOB Komitəsi / İH) | Authorised approval body | Decides | `[MET §3.1]`, `[PRO s.4]` |

### 1.4 Pre-screen rejections are not retained

This is the single most consequential gap in the current design. `[PRO s.4]` states rejected applications are "Not Processed Further, No Record Kept". Consequences, all documented by Prometeia:

- No reliable accept/reject ratio exists; only ~**6%** observed rejection rate on *formally initiated* applications `[PRO s.9]`.
- Scorecard development could not use rejects at all — "their voting forms are not saved" `[PRO s.9]`.
- The proposed remedy is a 33-field data model retaining **both approved and rejected** applications `[PRO s.24–25]`.

The platform implements the remedy today: `RejectionRecord` (`types/application.ts`) stores stage, reason code, description, ACB score and rating, group exposure, requested amount, RM, branch, timestamp **and the three frozen version ids**; `ApplicationRepository.recordRejection` never deletes the application (`repositories/types.ts`, `repositories/in-memory.ts`).

---

## 2. Current ATB Yekun Rəy scorecard (as-is expert assessment)

### 2.1 The five criteria

| # | Criterion (AZ) | Criterion (EN) | Max points | Aggregation |
|---|---|---|---|---|
| 1 | Kredit tarixçəsinin təhlili | Credit history analysis | **20** | Weighted sum of discrete answers |
| 2 | Biznes fəaliyyətinin təhlili | Business activity analysis | **20** | Arithmetic mean of three 0–100 manual sub-scores |
| 3 | Maliyyə məlumatlarının təhlili | Financial information analysis | **35** | Arithmetic mean of five 0–100 manual sub-scores |
| 4 | Kreditin təyinatının təhlili | Loan purpose analysis | **15** | Weighted sum of discrete answers |
| 5 | Təminatın təhlili | Collateral analysis | **10** | Weighted sum of discrete answers |
| | **Cəm** | **Total** | **100** | |

Source: `[MET §3.6]`; confirmed cell-for-cell in `[RƏY D111:D115]`. Prometeia reproduces the same weights in its annex `[PRO s.27]`.

### 2.2 Stop-factor short-circuit (`Rəy forması` J109)

```
J109 = IF(OR(J32=0, J44=0, J58=0, J86=0), 0, SUM(J32+J44+J58+J86+J93))
I109 = IF(J109>=86,"Aşağı riskli", IF(J109>=71,"Orta aşağı riskli",
        IF(J109>=56,"Orta riskli", IF(J109>=41,"Orta yüksək riskli",
        IF(J109>=0,"Yüksək riskli")))))
```

A zero in **any of criteria 1–4** forces the entire opinion to 0 points → "Yüksək riskli". **Collateral (J93) is deliberately excluded** from the OR-guard — it is never a stop factor `[MET §8.5]`.

The six stop factors, as implemented in `config/policy.ts` (`STOP_FACTORS_V1`) and `config/scorecards.ts` (`LegacyStopRule`):

| # | Stop factor | Effect | Waiver | Source |
|---|---|---|---|---|
| 1 | AKB extracts of business-connected persons not obtained | Criterion 1 = 0 → total 0 | — | `[MET §4.3, §4.10]`, `[RƏY J34]` |
| 2 | Unjustified 30+ day delinquency | Criterion 1 = 0 → total 0 | Documented justification → answer "Xeyr" + comment | `[MET §4.6]`, `[RƏY J37]` |
| 3 | Business ownership not evidenced (sub-block 2.1 score ≤ 40) | Criterion 2 = 0 → total 0 | — | `[MET §5.1.1]`, `[RƏY J44]` |
| 4 | Debt-to-equity including the new facility > 100% | Criterion 3 = 0 → total 0 | **Xidmət** (services) sector | `[MET §6.2]`, `[RƏY J63]` |
| 5 | Retained-profit / monthly-payment norm breached | Criterion 3 = 0 → total 0 | **Kənd təsərrüfatı** (agriculture) if forecast cash flow shows capacity | `[MET §6.3]`, `[RƏY J69]` |
| 6 | Purpose efficiency = 0 **AND** purpose control = 0 (joint) | Criterion 4 = 0 → total 0 | Either alone does not trigger | `[MET §7.5]`, `[RƏY J86]` |

### 2.3 Risk bands

Applied with `>=`, on points at total level and on percentage at criterion level `[MET §3.7]`, `[RƏY I109, F32]`:

| Band (AZ) | Band (EN) | Cut-off |
|---|---|---|
| Aşağı riskli | Low risk | **≥ 86** |
| Orta aşağı riskli | Medium-low risk | **≥ 71** |
| Orta riskli | Medium risk | **≥ 56** |
| Orta yüksək riskli | Medium-high risk | **≥ 41** |
| Yüksək riskli | High risk | 0–40 |

The band is a **risk classification, not an approve/reject rule**: the opinion ends with a narrative recommendation and the decision belongs to the authorised body `[MET §3.7]`.

### 2.4 What Prometeia found when it tested this scorecard

Overall **Small-segment GINI = 0.09** — "indicating lack of discriminatory power" `[PRO s.28]`.

| Section | Weight | GINI (Small) | Economically significant? | Prometeia's verdict |
|---|---|---|---|---|
| 1. Credit history analysis | 20% | **0.308** | TRUE | Retained |
| 2. Business analysis | 20% | **0.163** | TRUE | Retained |
| 3. **Financial analysis** | **35%** | **−0.021** | FALSE | "did not demonstrate the expected risk relationship… weak monotonicity and highly concentrated distributions" |
| 4. **Loan purpose analysis** | **15%** | **0** | FALSE | "reflected transaction-specific characteristics rather than obligor creditworthiness" |
| 5. **Collateral analysis** | **10%** | **−0.137** | FALSE | Same as above |

Source: `[PRO s.28]`. Mirrored verbatim in `config/monitoring.ts` (`CURRENT_SCORECARD_POWER`) so the platform can show the finding next to the live scorecard rather than restating it in prose.

**Read this carefully:** the three sections Prometeia found non-predictive carry **60 of the 100 points** (35 + 15 + 10), and the section carrying the single largest weight has a *negative* GINI. Prometeia's own re-weighting experiment (7 questions, section weights abandoned) raised GINI from 0.09 to **0.37** — "a significant improvement… but still not at good levels" `[PRO s.28]`.

Also worth noting: the score ranking is not monotone in observed bad rate. Small-segment quintiles run 13% / 11% / 13% / 6% / **13%** — the top quintile has the same bad rate as the bottom `[PRO s.27]`.

---

## 3. Prometeia Quick-Win proposal (to-be, option A)

Prometeia is explicit that this is **not** a statistically developed scorecard: 212 final observations, 27 bads, only **3 internal bad hits** `[PRO s.10]`. Its own instruction: *"Do not redevelop or statistically fine-tune the voting algorithm at this stage. Implement a transparent notching framework anchored to bureau score."* `[PRO s.10]`

### 3.1 Layer 0 — Bureau pre-screen

ACB Micro Score 0–1000 `[PRO s.12]`:

| Score | Rating | Share of ACB sample |
|---|---|---|
| 0–149 | Poor | 10.8% |
| 150–399 | Satisfactory | 26.4% |
| 400–699 | Medium | 50.6% |
| 700–859 | Good | 6.1% |
| 860–1000 | Excellent | 6.2% |

Recommendation, verbatim: *"we recommend to use the score threshold as **399** (eqv to max bound of Satisfactory rating) for the rejection criteria to be used in the prescreening process"* `[PRO s.12]`. The flow-diagram branch is labelled "Bureau Rating ≠ Poor OR Satisfactory" — sloppy notation for `NOT(Poor OR Satisfactory)`, i.e. score ≥ 400 `[PRO s.18, s.20]`.

Bureau rating input = **the worst rating observed across both Micro and Individual bureau ratings** `[PRO s.18, s.20]`. Related-party bureau checks extend "beyond the applicant to key shareholders / parent company where relevant" `[PRO s.10]`.

Rejected pre-screen cases are **retained** per the proposed data model, and are routed to the relevant decision authority by group exposure `[PRO s.19]`.

Implemented as `ACB_SCALE_PROMETEIA_V1` in `config/rating.ts` (`preScreenRejectBelow: 400`, i.e. score ≤ 399 fails) and `preScreen()` in `domain/rating/rating-engine.ts`. The as-is variant `ACB_SCALE_ATB_CURRENT_V1` sets `preScreenRejectBelow: null` — ATB has no automated gate today; the bureau extract is read manually.

### 3.2 Segmentation

**Small (Kiçik)** = group exposure below **300,000 AZN**; **Medium (İri)** = at or above `[PRO s.15, s.16]`. The trigger is *total group exposure including the applied amount* `[PRO s.18]`. Implemented as `SEGMENTATION_PROMETEIA_V1` (`mediumThresholdAzn: 300_000`, basis `POST_TRANSACTION_GROUP_EXPOSURE`).

### 3.3 Layer 1 — Business-analysis notch (both segments)

Three assessment areas, each scored **1 (High Risk) / 2 (Medium Risk) / 3 (Low Risk)** `[PRO s.13]`:

| Area | Dimension(s) | Aggregation |
|---|---|---|
| 1. Business relationship to the applicant and other considerations | Ownership verification (VÖEN, registration, property/lease, invoices, bank transactions, POS receipts, contracts) | Direct |
| 2. Business structure and management expertise | Two dimensions scored separately: (a) business track record / management-sector experience; (b) business structure | **Average of the two** |
| 3. Documentation and reporting | Quality of business documentation and reporting | Direct |

Section total = **sum of the three area scores**, range 3–9 `[PRO s.13]`.

| Total score | Final risk category | Notch |
|---|---|---|
| **9** | Low Risk | 0 |
| **7.0 – 8.99** | Low-Medium Risk | 0 |
| **6.0 – 6.99** | Moderate Risk | 0 |
| **4.0 – 5.99** | Medium-High Risk | **−1** |
| **3.0 – 3.99** | High Risk | **−2** |

Bands from `[PRO s.13]`; notches from `[PRO s.15]` (Small) and `[PRO s.16]` (Medium). Implemented as `NOTCHING_PROMETEIA_V1.businessBands` in `config/rating.ts` and `BUSINESS_SCORECARD_PROMETEIA_V1` in `config/scorecards.ts`.

"The same Business Analysis questions are answered for both Small and Medium segment applications. **The team responsible for answering these questions varies** depending on the group exposure amount and collateralization criteria." `[PRO s.13]`

### 3.4 Layer 2 — Altman Z′ financial notch (**Medium segment only**)

*"The Financial Analysis Layer is applied only for Medium segment applications and is calculated by the Underwriting (UW) Team."* `[PRO s.14]`

```
Z' = 0.717·X1 + 0.847·X2 + 3.107·X3 + 0.420·X4 + 0.998·X5
X1 = Working Capital / Total Assets      X4 = Equity / Total Liabilities
X2 = Retained Earnings / Total Assets    X5 = Sales / Total Assets
X3 = EBIT / Total Assets
```

| Zone | Threshold | Notch |
|---|---|---|
| Low Risk | Z > **2.90** | **+1**, but only if the initial rating is **not Poor (Rating 1)** |
| Medium / grey | **1.23** < Z < **2.90** | 0 |
| High Risk | Z < **1.23** | **−2** |

Sources: `[PRO s.14]` for the formula and zones; `[PRO s.16]` for the notches and the Poor-grade exclusion. Implemented as `NOTCHING_PROMETEIA_V1.altman` (`appliesToSegments: ['MEDIUM']`, `boundaryInclusive: 'GREY'`).

### 3.5 Layer 3 — Final internal rating

**Maximum cumulative downgrade: 2 notches** `[PRO s.10]` — `maxTotalDowngrade: -2`, `maxTotalUpgrade: 1` in `NOTCHING_PROMETEIA_V1`.

The resulting **Final Internal Rating** then drives routing: `Final Rating = Worst` (Poor / Rating 1) vs `≠ Worst` decides whether a case is finalised at the lower authority or escalated `[PRO s.19, s.21]`.

Prometeia frames the whole thing as interim: *"treat the framework as an expert-based enhancement until meaningful internal bad history is accumulated"*, with monitoring of "approvals, overrides, delinquency migration and realized default outcomes for future recalibration" `[PRO s.10]`.

---

## 4. The bank's own internally discussed alternatives (to-be, option B)

Both are ATB's own ideas, presented by Prometeia with the caveat: *"This is one of the internally discussed versions and has not yet been implemented."* `[PRO s.5, s.6]`

Both add a **collateralisation dimension** to the 50–100K bucket and split the top of the ladder. Neither introduces a bureau pre-screen, a bureau anchor, or notching layers.

### Version 1 `[PRO s.5]`

| Bucket | Assessment | Decision |
|---|---|---|
| < 50K | RM | KOB KM |
| 50–100K, fully collateralised | RM | KOB KM |
| 50–100K, not fully collateralised | UW Team | KOB KM; negative → reject or escalate to SME Committee |
| 100–200K | UW Team | Director of UW Center + Head of KOB Center if 80% collateralised, else SME Committee |
| 200–300K | UW Team | Director of UW Center + Head of KOB Center if fully collateralised, else SME Committee |
| **300–500K** | UW Team | **SME Committee** |
| **> 500K** | UW Team | **Management Board** |

### Version 2 `[PRO s.6]`

Identical, except the committees are renamed **Small Committee** / **Big Committee** and the top buckets shift:

| Bucket | Decision |
|---|---|
| **300–700K** | **Small Committee** |
| **> 700K** | **Big Committee** |

Escalation principle for both: *"In general, rejected applications can be escalated to the next higher approval authority, with the Management Board being the only exception (as the top-level authority, no further escalation is possible beyond this point)."* `[PRO s.5, s.6]`

Prometeia's summary of the effect: *"The alternative versions mainly decreasing the number of cases to be decided in MB by transferring it to SME committee."* `[PRO s.7]` — quantified as 40 Management Board cases (of 1,132) falling to **7** under V1 and **1** under V2 `[PRO s.7]`.

---

## 5. Proposed routing tables (Prometeia)

### 5.1 Prometeia Version 1 `[PRO s.19]` — "Notching Framework Application Logic"

| Group exposure | Assessment authority | Decision authority | Notching layers |
|---|---|---|---|
| Rejected in pre-screening | UW Team | Routed to KOB KM / SME Committee / Management Board by group exposure | Depends on group exposure |
| < 50K | KOB KM – financial analysis team | Not Worst → KOB KM Internal Committee; Worst → **SME Committee** | Business |
| 50–100K, fully collateralised | KOB KM – financial analysis team | Not Worst → KOB KM Internal Committee; Worst → **SME Committee** | Business |
| 50–100K, not fully collateralised | UW Team | Not Worst → KOB KM; Worst → **SME Committee** | Business |
| 100–200K | UW Team | 80% collateralised **OR** Final Rating ≠ Worst → Director of UW Center + Head of KOB Center; else **SME Committee** | Business |
| 200–300K | UW Team | Fully collateralised **OR** Final Rating ≠ Worst → Director of UW Center + Head of KOB Center; else **SME Committee** | Business |
| **300–500K** | UW Team | **SME Committee** | Business + **Financial** |
| **> 500K** | UW Team | **Management Board** | Business + **Financial** |

Quantified impact: *"approximately **16% of applications would be transferred from KOB KM to the UW Team**… approximately **12% of applications would be escalated from KOB KM to the SME Committee**"* `[PRO s.19]`.

SME Committee composition throughout the deck: **Head of Underwriting, Head of Monitoring and CBO** `[PRO s.4, s.19]`.

Stop factors: *"Any application that triggers a Stop Factor is automatically rejected, and **no escalation route is available except to the Management Board (MB)**"* `[PRO s.18]`.

### 5.2 Prometeia Version 2 `[PRO s.21]`

| Group exposure | Assessment authority | Decision authority | Notching layers |
|---|---|---|---|
| Rejected in pre-screening | UW Team | Routed to KOB KM / Small Committee / Big Committee by group exposure | Depends on group exposure |
| < 50K | KOB KM – financial analysis team | Not Worst → KOB KM Internal Committee; Worst → **SME Committee** *(sic — see §6)* | Business |
| 50–100K, fully collateralised | KOB KM – financial analysis team | Not Worst → KOB KM Internal Committee; Worst → **SME Committee** *(sic)* | Business |
| 50–100K, not fully collateralised | UW Team | Not Worst → KOB KM; Worst → **Small Committee** | Business |
| 100–200K | UW Team | 80% collateralised **OR** Final Rating ≠ Worst → Director of UW Center + Head of KOB Center; else **Small Committee** | Business |
| 200–300K | UW Team | Fully collateralised **OR** Final Rating ≠ Worst → Director of UW Center + Head of KOB Center; else **Small Committee** | Business |
| **300–700K** | UW Team | **Small Committee** | Business + **Financial** |
| **> 700K** | UW Team | **Big Committee** | Business + **Financial** |

Stop-factor note in V2: *"no escalation route is available except to the **Big Committee**"* `[PRO s.20]`.

### 5.3 Side-by-side ladder

| Bucket | ATB current | ATB internal V1 | ATB internal V2 | Prometeia V1 | Prometeia V2 |
|---|---|---|---|---|---|
| < 50K | RM → KOB KM | RM → KOB KM | RM → KOB KM | KOB KM FA → KOB KM (Worst → SME Cttee) | KOB KM FA → KOB KM (Worst → SME Cttee *sic*) |
| 50–100K full coll. | *(no split)* | RM → KOB KM | RM → KOB KM | KOB KM FA → KOB KM (Worst → SME Cttee) | KOB KM FA → KOB KM (Worst → SME Cttee *sic*) |
| 50–100K part. coll. | UW → KOB KM / SME Cttee | UW → KOB KM / SME Cttee | UW → KOB KM / Small Cttee | UW → KOB KM (Worst → SME Cttee) | UW → KOB KM (Worst → Small Cttee) |
| 100–200K | UW → SME Cttee | UW → Dir.UW+KOB / SME Cttee | UW → Dir.UW+KOB / Small Cttee | UW → Dir.UW+KOB / SME Cttee | UW → Dir.UW+KOB / Small Cttee |
| 200–300K | UW → SME Cttee | UW → Dir.UW+KOB / SME Cttee | UW → Dir.UW+KOB / Small Cttee | UW → Dir.UW+KOB / SME Cttee | UW → Dir.UW+KOB / Small Cttee |
| 300–500K | UW → **Mgmt Board** | UW → SME Cttee | UW → Small Cttee (to 700K) | UW → SME Cttee | UW → Small Cttee (to 700K) |
| 500–700K | UW → **Mgmt Board** | UW → **Mgmt Board** | UW → Small Cttee | UW → **Mgmt Board** | UW → Small Cttee |
| > 700K | UW → **Mgmt Board** | UW → **Mgmt Board** | UW → **Big Cttee** | UW → **Mgmt Board** | UW → **Big Cttee** |
| Bureau pre-screen | No | No | No | **Yes (≤ 399)** | **Yes (≤ 399)** |
| Notching layers | None | None | None | Business (+ Financial ≥ 300K) | Business (+ Financial ≥ 300K) |

The full machine-readable version of this matrix, including collateral conditions and escalation conditions, is in `docs/workflow-matrix.md`.

---

## 6. Unresolved differences

Nothing in this table may be silently resolved in code. Each is either seeded with an explicit, flagged choice or surfaced as a `knownAmbiguities` entry on the workflow version.

| # | Question | Position A | Position B | Platform treatment |
|---|---|---|---|---|
| 1 | **AND vs OR** in the 100–200K and 200–300K collateral/rating condition | Flow diagrams: "80% collateralized **AND** Final Rating ≠ Worst" `[PRO s.18, s.20]` | Notching tables: "**OR**" `[PRO s.19, s.21]` | `WorkflowVersion.collateralRatingOperator`, seeded `'OR'` with `operatorNote` recording that the diagram says AND; switchable in config. Escalation is computed as the negation of the chosen form in `routing-engine.ts` |
| 2 | Is the pre-screen a **reject** or an **escalation**? | "Application Rejected" `[PRO s.18]` | "OR Escalated to UW team for further assessment" — no selection rule given `[PRO s.18]` | `AcbRatingScale.preScreenAction` (`REJECT` seeded) and `noScoreAction` (`ESCALATE_TO_UW`) |
| 3 | Definition of **"fully collateralized" / "80% collateralized"** | Never defined in the deck | Template offers `Kredit qalığı / Sonuncu Likvid Qiymət` and post-deal `L44` on **liquid** value `[TƏQ Sifarişçi…!L41, L44]` | `routing-engine.ts` uses eligible (post-haircut) coverage with `FULL_COLLATERAL_THRESHOLD = 1.0`, `PARTIAL_COLLATERAL_THRESHOLD = 0.8`; haircuts in `COLLATERAL_HAIRCUTS_V1`; flagged in `knownAmbiguities` |
| 4 | Is the **Yekun Rəy voting algorithm retired** or run in parallel? | "Do not redevelop or statistically fine-tune the voting algorithm at this stage" `[PRO s.10]` — not the same as "stop using it" | Slide 28 delivers an optimised 7-question re-weighting (GINI 0.37) referenced nowhere in the proposed process | Both engines run; neither feeds the other. `legacy` and `rating` are separate keys on the assessment snapshot |
| 5 | Definition of **"worst rating"** | Bureau side: worst across Micro and Individual `[PRO s.18]` | Routing side: final internal rating = Poor / Rating 1 `[PRO s.16]`; current-state guideline also uses it as an Area-1 **knock-out** `[PRO s.29]` | `WORST_RATING_V1` seeded `NEEDS_CONFIRMATION` with an explicit `include` list and `escalateAtOrBelow` |
| 6 | V2 escalation target in the `< 50K` and `50–100K fully collateralized` rows | Table says "SME Committee" `[PRO s.21]` | Every other V2 row says "Small Committee" | Seeded as printed (`SME_COMMITTEE`) and listed in `knownAmbiguities` as copy-paste residue |
| 7 | **Cap interaction**: business −2 plus Altman −2 = −4 | Slide 10: "Maximum cumulative downgrade: 2 notches" | Slide 16 states both rules without mentioning the cap | Cap applied after combining layers (`maxTotalDowngrade: -2`) |
| 8 | Can a **Poor** rating be notched further down? | Small-segment simulation shows Poor growing 14 → 19 `[PRO s.15]` | No floor rule stated | Engine floors at the weakest grade in `GRADE_ORDER`; surfaced in the waterfall |
| 9 | **ACB band shares** underpinning the 399 cut-off | Table: Poor 10.8% + Satisfactory 26.4% = **37.2%** of applicants `[PRO s.12]` | Narrative: "6%" and "6.1%" — apparently the Good/Excellent figures `[PRO s.12]` | Bands seeded from the table; the discrepancy is recorded in the analysis, and the gate is configurable |
| 10 | **Group exposure is not captured anywhere today** | Routing keys on post-transaction group exposure `[PRO s.19]` | `[PRO s.7 NOTE 2, s.11]`: dataset has no group exposure, financed amount substituted; `[TƏQ]` has no group-exposure field | `WorkflowVersion.routingBasis` supports both; `computeGroupExposure` builds it from `groupMembers` + requested amount − closures |
| 11 | Numeric value of the **repayment-capacity norm** behind stop factor #5 | `[MET §6.3]` names the ratio but states no number | The live opinion cites a **0.8** coefficient from the separate *KOB kreditlərinin verilməsi Metodologiyası*; `[TƏQ]` norm is **0.7** | `PAYMENT_TO_CAPACITY` rule in `POLICY_ATB_CURRENT_V1`, editable, source noted |
| 12 | **Bad definition circularity** | GINI 74.8 / AUC 87.7 / KS 60.23 for ACB rating `[PRO s.12]` | 157 of 172 bads are external = "ACB rating Poor" — the model is validated largely against its own anchor `[PRO s.10]` | `BAD_DEFINITIONS` in `config/monitoring.ts` are versioned so a result is never read apart from the definition that produced it |
| 13 | **Business-analysis band 9 is a point, not an interval** | Bands: 9 / 7.0–8.99 / 6.0–6.99 / 4.0–5.99 / 3.0–3.99 `[PRO s.13]` | Area 2 is an average, so totals land on halves — rounding convention changes outcomes | Bands seeded literally with `min`/`max`; no rounding applied |
| 14 | **Business-analysis wording differs between current and proposed** | Current guideline: official vs unofficial activity years, three ownership archetypes, Area-1 High Risk = knock-out `[PRO s.29]` | Proposal: "3y official OR >5y sector experience", one generic structure row, no knock-out `[PRO s.13]` | Two separate scorecard artefacts; the Yekun Rəy keeps the current anchors, `PROMETEIA_QUICK_WIN_V1` the proposed ones |
| 15 | **No SLA exists in any source** | `[MET]` and the workbooks contain stage dates only | Prometeia never quantifies turnaround | `SLA_V1` seeded with `status: 'INFERRED'` and an explicit `sourceRef` saying so |
| 16 | Are **Small/Big Committee** (V2) the same bodies renamed, or new governance? | Never stated; Big Committee composition never given `[PRO s.6, s.21]` | — | Separate `Authority` values with separate ranks (6 and 7) |

---

## 7. How the platform keeps them apart

### 7.1 Workflow versions — `config/workflow.ts`

Five presets are seeded, each an independent `WorkflowVersion` carrying its own `status`, `sourceRef` and `knownAmbiguities`:

| Id | Label | `status` | `sourceRef` | Pre-screen |
|---|---|---|---|---|
| `ATB_CURRENT_V1` | ATB cari proses | `CURRENT` | `[PRO s.4]` (as-is flow) | disabled |
| `ATB_INTERNAL_PROPOSAL_V1` | ATB daxili təklif — Versiya 1 | `BANK_PROPOSED` | `[PRO s.5]` "internally discussed version, not yet implemented" | disabled |
| `ATB_INTERNAL_PROPOSAL_V2` | ATB daxili təklif — Versiya 2 (Kiçik / Böyük Komitə) | `BANK_PROPOSED` | `[PRO s.6]` | disabled |
| `PROMETEIA_PROPOSED_V1` | Prometeia təklifi — Versiya 1 | `PROMETEIA_PROPOSED` | `[PRO s.18–19]` | enabled |
| `PROMETEIA_PROPOSED_V2` | Prometeia təklifi — Versiya 2 (Kiçik / Böyük Komitə) | `PROMETEIA_PROPOSED` | `[PRO s.20–21]` | enabled |

The file's own header comment states the rule: *"None of the proposals is production policy. `status` records which is which and the UI always shows it next to the routing decision."*

### 7.2 Scorecard versions — `config/scorecards.ts`

| Id | Engine | `status` | Represents |
|---|---|---|---|
| `ATB_YEKUN_REY_V1` | `evaluateLegacyOpinion` (`domain/scoring/legacy-opinion.ts`) | `CURRENT` | ATB's live 5-criterion expert assessment, form `01.11.2025–14.07.2026` |
| `PROMETEIA_QUICK_WIN_V1` | `computeRating` (`domain/rating/rating-engine.ts`) | `PROMETEIA_PROPOSED` | The 3-area / 1–3 business-analysis layer feeding the notching waterfall |

They have different type shapes (`LegacyScorecard` vs `BusinessScorecard`), different answer types on the application (`LegacyAssessment` vs `BusinessAssessment`), and different result objects on the assessment snapshot (`legacy` vs `rating`). There is no code path that adds a Yekun Rəy point to a notch.

### 7.3 Every application freezes its versions

`CreditApplication` (`types/application.ts`) carries four version fields, set at submission and never rewritten:

```ts
workflowVersion: string;        // e.g. 'PROMETEIA_PROPOSED_V2'
scorecardVersion: string;       // e.g. 'PROMETEIA_QUICK_WIN_V1'
legacyScorecardVersion: string; // e.g. 'ATB_YEKUN_REY_V1'
policyVersion: string;          // e.g. 'ATB_POLICY_V1'
```

`assessApplication` (`services/assessment.ts`) resolves configuration **only** from those frozen ids, so re-opening a 2024 case in 2027 reproduces the 2024 answer. The returned snapshot echoes them back under `versions` (`workflow`, `workflowLabel`, `workflowStatus`, `scorecard`, `legacyScorecard`, `policy`, `acbScale`, `notching`, `worstRating`) and the UI prints the status badge next to every derived number. `RejectionRecord` stores the same three ids so a rejected application remains reproducible too.

What-if analysis is explicitly opt-in and non-destructive: `AssessOptions.workflowVersionId` overrides the frozen workflow **for that call only**, which is how the routing tab can re-run one case through all five versions without any of them being presented as the approved one.
