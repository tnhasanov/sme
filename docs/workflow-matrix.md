# Workflow Matrix — All Routing Buckets, All Five Seeded Versions

Machine-readable source: `config/workflow.ts` (`WORKFLOW_VERSIONS`). Engine: `domain/workflow/routing-engine.ts` (`routeApplication`).

This document is the flattened, human-readable form of that configuration. It exists so a credit officer can check the seeded rules against the source documents without reading TypeScript, and so any divergence between the two is visible.

**None of the four proposed versions is approved policy.** Only `ATB_CURRENT_V1` carries `status: 'CURRENT'`. Every table below repeats the status for that reason.

Source tags follow `docs/as-is-vs-to-be.md`:

| Tag | Document |
|---|---|
| `[MET §x]` | *Kiçik və Orta Biznes krediti sifarişlərinə Anderraytinq Mərkəzi tərəfindən rəy verilməsi Metodologiyası*, ATB internal |
| `[RƏY <cell>]` | Underwriting-opinion workbook, sheet `Rəy forması`, form `Version 01.11.2025-14.07.2026` |
| `[PRO s.N]` | Prometeia, *Risk Diagnostics Project – Phase 2, Deep Dive on SME Scorecard*, 07.08.2026, slide N |

---

## 1. Version register

| Id | Label | Status | Routing basis | Pre-screen | Stop-factor authority | Operator | Source |
|---|---|---|---|---|---|---|---|
| `ATB_CURRENT_V1` | ATB cari proses | **CURRENT** | Post-transaction group exposure | disabled | Management Board | OR | `[PRO s.4]` |
| `ATB_INTERNAL_PROPOSAL_V1` | ATB daxili təklif — Versiya 1 | BANK_PROPOSED | Post-transaction group exposure | disabled | Management Board | OR | `[PRO s.5]` |
| `ATB_INTERNAL_PROPOSAL_V2` | ATB daxili təklif — Versiya 2 (Kiçik / Böyük Komitə) | BANK_PROPOSED | Post-transaction group exposure | disabled | Management Board | OR | `[PRO s.6]` |
| `PROMETEIA_PROPOSED_V1` | Prometeia təklifi — Versiya 1 | PROMETEIA_PROPOSED | Post-transaction group exposure | **enabled** | Management Board | OR | `[PRO s.18–19]` |
| `PROMETEIA_PROPOSED_V2` | Prometeia təklifi — Versiya 2 (Kiçik / Böyük Komitə) | PROMETEIA_PROPOSED | Post-transaction group exposure | **enabled** | **Big Committee** | OR | `[PRO s.20–21]` |

"Operator" is `collateralRatingOperator` — how the collateral and rating conditions combine in the 100–300K buckets. See §5.

---

## 2. The full bucket matrix

Legend for collateral conditions: **ANY** = no condition; **FULL** = eligible coverage ≥ 100%; **NOT FULL** = coverage < 100% (or not computable); **≥80%** = coverage ≥ 80%.

Legend for escalation conditions:

| Condition | Meaning |
|---|---|
| `NONE` | No escalation branch; the decision authority is fixed |
| `RATING_IS_WORST` | Final internal rating equals the worst grade (Poor / Rating 1) `[PRO s.19]` |
| `UW_ASSESSMENT_NEGATIVE` | Underwriter recommends decline, or the Yekun Rəy global stop is triggered `[PRO s.4]` |
| `NOT_COLLATERALISED_OR_WORST` | The deck's passing condition is "collateralised **OR** rating ≠ worst"; escalation is its negation — under OR, escalate when **not collateralised AND rating is worst** |
| `NOT_COLLATERALISED_AND_WORST` | The diagram's passing condition "collateralised **AND** rating ≠ worst"; escalation when **not collateralised OR rating is worst** |

### 2.1 `ATB_CURRENT_V1` — status **CURRENT** `[PRO s.4]`

| Bucket | Collateral condition | Assessment authority | Decision authority | Escalation authority | Escalation condition | Notching layers |
|---|---|---|---|---|---|---|
| 0 – 50,000 AZN | ANY | RM (branch) | KOB KM internal committee | — | `NONE` | — |
| 50,000 – 100,000 AZN | ANY | Underwriting Center | KOB KM internal committee | SME Committee | `UW_ASSESSMENT_NEGATIVE` | — |
| 100,000 – 300,000 AZN | ANY | Underwriting Center | SME Committee | — | `NONE` | — |
| ≥ 300,000 AZN | ANY | Underwriting Center | Management Board (İH) | — | `NONE` | — |

Bucket notes seeded in config: the `< 50K` bucket records that the branch RM completes a structured assessment form and the SME Center's internal committee decides; the `≥ 300K` bucket records that the extended opinion form (Geniş forma, Əlavə № 2) is prepared `[MET §3.1]`.

Known ambiguities recorded on this version:
- Pre-screen rejections are not retained anywhere in the current process — reject analysis is impossible `[PRO s.4, s.9]`.
- Group exposure is not stored in any structured system; routing effectively runs on financed amount `[PRO s.7 NOTE 2, s.11]`.

### 2.2 `ATB_INTERNAL_PROPOSAL_V1` — status **BANK_PROPOSED** `[PRO s.5]`

| Bucket | Collateral condition | Assessment authority | Decision authority | Escalation authority | Escalation condition | Notching layers |
|---|---|---|---|---|---|---|
| 0 – 50,000 AZN | ANY | RM | KOB KM internal committee | — | `NONE` | — |
| 50,000 – 100,000 AZN | **FULL** | RM | KOB KM internal committee | — | `NONE` | — |
| 50,000 – 100,000 AZN | **NOT FULL** | Underwriting Center | KOB KM internal committee | SME Committee | `UW_ASSESSMENT_NEGATIVE` | — |
| 100,000 – 200,000 AZN | ANY | Underwriting Center | Director of UW Center + Head of KOB Center | SME Committee | `NOT_COLLATERALISED_OR_WORST` | — |
| 200,000 – 300,000 AZN | ANY | Underwriting Center | Director of UW Center + Head of KOB Center | SME Committee | `NOT_COLLATERALISED_OR_WORST` | — |
| 300,000 – 500,000 AZN | ANY | Underwriting Center | SME Committee | — | `NONE` | — |
| ≥ 500,000 AZN | ANY | Underwriting Center | Management Board | — | `NONE` | — |

Bucket notes: 100–200K is decided at director level when **80%** collateralised; 200–300K when **fully** collateralised.

Known ambiguity: "fully collateralised" and "80% collateralised" are never defined numerically in the source.

### 2.3 `ATB_INTERNAL_PROPOSAL_V2` — status **BANK_PROPOSED** `[PRO s.6]`

Identical structure to V1 with the committees renamed and the top split moved.

| Bucket | Collateral condition | Assessment authority | Decision authority | Escalation authority | Escalation condition | Notching layers |
|---|---|---|---|---|---|---|
| 0 – 50,000 AZN | ANY | RM | KOB KM internal committee | — | `NONE` | — |
| 50,000 – 100,000 AZN | **FULL** | RM | KOB KM internal committee | — | `NONE` | — |
| 50,000 – 100,000 AZN | **NOT FULL** | Underwriting Center | KOB KM internal committee | **Small Committee** | `UW_ASSESSMENT_NEGATIVE` | — |
| 100,000 – 200,000 AZN | ANY | Underwriting Center | Director of UW Center + Head of KOB Center | **Small Committee** | `NOT_COLLATERALISED_OR_WORST` | — |
| 200,000 – 300,000 AZN | ANY | Underwriting Center | Director of UW Center + Head of KOB Center | **Small Committee** | `NOT_COLLATERALISED_OR_WORST` | — |
| **300,000 – 700,000 AZN** | ANY | Underwriting Center | **Small Committee** | — | `NONE` | — |
| **≥ 700,000 AZN** | ANY | Underwriting Center | **Big Committee** | — | `NONE` | — |

### 2.4 `PROMETEIA_PROPOSED_V1` — status **PROMETEIA_PROPOSED** `[PRO s.18–19]`

| Bucket | Collateral condition | Assessment authority | Decision authority | Escalation authority | Escalation condition | Notching layers |
|---|---|---|---|---|---|---|
| 0 – 50,000 AZN | ANY | KOB KM — financial analysis team | KOB KM internal committee | SME Committee | `RATING_IS_WORST` | **Business** |
| 50,000 – 100,000 AZN | **FULL** | KOB KM — financial analysis team | KOB KM internal committee | SME Committee | `RATING_IS_WORST` | **Business** |
| 50,000 – 100,000 AZN | **NOT FULL** | Underwriting Center | KOB KM internal committee | SME Committee | `RATING_IS_WORST` | **Business** |
| 100,000 – 200,000 AZN | **≥80%** | Underwriting Center | Director of UW Center + Head of KOB Center | SME Committee | `NOT_COLLATERALISED_OR_WORST` | **Business** |
| 200,000 – 300,000 AZN | **FULL** | Underwriting Center | Director of UW Center + Head of KOB Center | SME Committee | `NOT_COLLATERALISED_OR_WORST` | **Business** |
| 300,000 – 500,000 AZN | ANY | Underwriting Center | SME Committee | — | `NONE` | **Business + Financial** |
| ≥ 500,000 AZN | ANY | Underwriting Center | Management Board | — | `NONE` | **Business + Financial** |
| *Pre-screen rejections* | — | Underwriting Center | Routed by group exposure to KOB KM / SME Committee / Management Board | — | — | Depends on exposure |

Bucket note on 100–200K, seeded verbatim in config: *"80% təminat VƏ/VƏ YA yekun reytinq ən zəif qiymət deyilsə — direktor səviyyəsi. Operator mübahisəlidir."* (The operator is disputed — see §5.)

### 2.5 `PROMETEIA_PROPOSED_V2` — status **PROMETEIA_PROPOSED** `[PRO s.20–21]`

| Bucket | Collateral condition | Assessment authority | Decision authority | Escalation authority | Escalation condition | Notching layers |
|---|---|---|---|---|---|---|
| 0 – 50,000 AZN | ANY | KOB KM — financial analysis team | KOB KM internal committee | **SME Committee** *(as printed — see note)* | `RATING_IS_WORST` | **Business** |
| 50,000 – 100,000 AZN | **FULL** | KOB KM — financial analysis team | KOB KM internal committee | **SME Committee** *(as printed)* | `RATING_IS_WORST` | **Business** |
| 50,000 – 100,000 AZN | **NOT FULL** | Underwriting Center | KOB KM internal committee | **Small Committee** | `RATING_IS_WORST` | **Business** |
| 100,000 – 200,000 AZN | **≥80%** | Underwriting Center | Director of UW Center + Head of KOB Center | **Small Committee** | `NOT_COLLATERALISED_OR_WORST` | **Business** |
| 200,000 – 300,000 AZN | **FULL** | Underwriting Center | Director of UW Center + Head of KOB Center | **Small Committee** | `NOT_COLLATERALISED_OR_WORST` | **Business** |
| **300,000 – 700,000 AZN** | ANY | Underwriting Center | **Small Committee** | — | `NONE` | **Business + Financial** |
| **≥ 700,000 AZN** | ANY | Underwriting Center | **Big Committee** | — | `NONE` | **Business + Financial** |
| *Pre-screen rejections* | — | Underwriting Center | Routed by group exposure to KOB KM / Small Committee / Big Committee | — | — | Depends on exposure |

**Note on the first two rows:** Prometeia's V2 notching table `[PRO s.21]` still names the "SME Committee" in the `< 50K` and `50–100K fully collateralized` rows, although V2 renamed the bodies to Small / Big Committee everywhere else. This is almost certainly copy-paste residue. The platform seeds it **exactly as printed** and records the discrepancy in `knownAmbiguities` rather than silently correcting it, because silently correcting a source document is how a specification stops being a specification.

### 2.6 Notching layers at a glance

| Version | Business layer | Financial (Altman Z′) layer |
|---|---|---|
| `ATB_CURRENT_V1` | none — the Yekun Rəy runs instead | none |
| `ATB_INTERNAL_PROPOSAL_V1` / `V2` | none | none |
| `PROMETEIA_PROPOSED_V1` | every bucket | ≥ 300,000 AZN only |
| `PROMETEIA_PROPOSED_V2` | every bucket | ≥ 300,000 AZN only |

The financial layer's applicability is enforced twice: by the bucket's `notchingLayers` and, independently, by `NOTCHING_PROMETEIA_V1.altman.appliesToSegments = ['MEDIUM']` — where MEDIUM means post-transaction group exposure ≥ 300,000 AZN `[PRO s.14, s.16]`.

---

## 3. Authority ladder

`AUTHORITY_RANK` in `config/workflow.ts`. A higher number is a higher authority; escalation must always move up the ladder.

| Rank | Authority (code) | Label (AZ) | Label (EN) |
|---|---|---|---|
| 1 | `RM` | Filial / Müştəri meneceri | Branch relationship manager |
| 2 | `KOB_KM_FINANCIAL_ANALYSIS` | KOB KM — Maliyyə təhlili qrupu | SME Center — financial analysis team |
| 3 | `KOB_KM_INTERNAL_COMMITTEE` | KOB KM daxili komitəsi | SME Center internal committee |
| 4 | `UNDERWRITING_TEAM` | Anderraytinq Mərkəzi | Underwriting Center |
| 5 | `DIRECTOR_UW_AND_HEAD_KOB` | Anderraytinq Mərkəzinin direktoru və KOB Mərkəzinin rəhbəri | Director of the Underwriting Center + Head of the SME Center |
| 6 | `SME_COMMITTEE` | KOB Komitəsi (Anderraytinq rəhbəri, Monitorinq rəhbəri, CBO) | SME Committee (Head of Underwriting, Head of Monitoring, CBO) |
| 6 | `SMALL_COMMITTEE` | Kiçik Kredit Komitəsi | Small Credit Committee |
| 7 | `BIG_COMMITTEE` | Böyük Kredit Komitəsi | Big Credit Committee |
| 8 | `MANAGEMENT_BOARD` | İdarə Heyəti | Management Board |

**SME Committee and Small Committee share rank 6 deliberately.** V2 renames the body rather than inserting a new level `[PRO s.6, s.20–21]`; whether they are in fact the same body renamed is an open question the deck never answers, and the Big Committee's composition is never given. The SME Committee's composition — Head of Underwriting, Head of Monitoring, CBO — is stated `[PRO s.4, s.19]`.

Escalation-of-rejections principle, applied by every seeded version (`escalationOfRejectionsAllowed: true`): *"In general, rejected applications can be escalated to the next higher approval authority, with the Management Board being the only exception (as the top-level authority, no further escalation is possible beyond this point)."* `[PRO s.5, s.6]`

The routing engine prints the rank alongside the resolved authority in its reason list (`Qərar səlahiyyəti: … (səviyyə N)`), so an escalation that would move sideways or downwards is visible immediately.

---

## 4. Stop-factor routing override

Stop factors do not adjust the routing — they **replace** it.

In `routeApplication`, before any bucket is selected:

```
if (stopFactorCount > 0 && workflow.stopFactorEscalationAuthority !== 'NONE') {
    bucket             = null            ("Stop faktor marşrutu")
    assessmentAuthority = UNDERWRITING_TEAM
    decisionAuthority   = workflow.stopFactorEscalationAuthority
    escalationAuthority = null
    escalated           = true
    notchingLayers      = []
    → return
}
```

Behaviour:

| Aspect | Behaviour | Source |
|---|---|---|
| Bucket | Not evaluated at all; the decision is labelled "Stop faktor marşrutu" | `routing-engine.ts` |
| Assessment authority | Always the Underwriting Center, regardless of exposure | `[PRO s.18]` |
| Decision authority | `stopFactorEscalationAuthority` — Management Board in four versions, **Big Committee** in `PROMETEIA_PROPOSED_V2` | `[PRO s.18]` V1: *"no escalation route is available except to the Management Board (MB)"*; `[PRO s.20]` V2: *"…except to the Big Committee"* |
| Escalation branch | None — this **is** the terminal route | `[PRO s.18, s.20]` |
| Notching layers | None applied; the case does not get a notched rating on this path | `routing-engine.ts` |
| Reason recorded | `"N stop faktor aşkarlanıb — adi səlahiyyət marşrutu tətbiq edilmir, yalnız <authority> baxa bilər."` | — |

Which stop factors can trigger this is `config/policy.ts` → `STOP_FACTORS_V1`, evaluated by `domain/rules/stop-factors.ts`:

| Stop factor | Waiver | Source |
|---|---|---|
| Bureau extracts of connected persons not obtained | — | `[MET §4.3, §4.10]`, `[RƏY J34]` |
| Unjustified 30+ days past due | Documented justification | `[MET §4.6]`, `[RƏY J37]` |
| Business ownership not evidenced (score ≤ 40) | — | `[MET §5.1.1]`, `[RƏY J44]` |
| Debt-to-equity including the new facility > 100% | **Xidmət** (services) sector | `[MET §6.2]`, `[RƏY J63]` |
| Repayment-capacity norm breached | **Kənd təsərrüfatı** (agriculture), if forecast cash flow shows capacity | `[MET §6.3]`, `[RƏY J69]` |
| Purpose efficiency **and** purpose control both unassessable | Joint condition only | `[MET §7.5]`, `[RƏY J86]` |
| Bureau score below the pre-screening threshold | Only when the gate is enabled | `[PRO s.12]` |

Note the asymmetry between the two frameworks: in the Yekun Rəy a stop factor zeroes the *score* (`[RƏY J109]` OR-guard → 0 points → "Yüksək riskli"), while in the Prometeia routing a stop factor removes the *authority ladder*. The platform applies both, independently — a case can be scored 0 by the legacy engine and simultaneously routed to the Management Board by the workflow engine, which is exactly what the two source documents describe.

---

## 5. Bucket selection and escalation logic

### 5.1 Bucket selection (`pickBucket`)

1. Compute the routing basis: post-transaction group exposure, or financed amount if the version's `routingBasis` says so.
2. Take every bucket where `min ≤ basis < max`.
3. Among those, keep the ones whose collateral condition the case actually satisfies (`eligibleCollateralCoverage` vs `FULL_COLLATERAL_THRESHOLD = 1.0` / `PARTIAL_COLLATERAL_THRESHOLD = 0.8`).
4. **The most specific collateral condition wins** — a matching non-`ANY` bucket beats an `ANY` bucket.
5. If nothing matches on collateral, fall back to the `ANY` bucket in range, so routing is always defined.
6. If no bucket is in range, return an undefined routing with the reason "Uyğun marşrut intervalı tapılmadı — konfiqurasiya yoxlanılmalıdır."

Coverage is **eligible** (post-haircut) coverage from `computeCollateralCoverage` against post-transaction ATB exposure, not raw market value. The source documents never define the basis — `[TƏQ Sifarişçi…!L41, L44]` computes coverage on *liquid* value — so the platform's choice is explicit, configurable through `COLLATERAL_HAIRCUTS_V1`, and flagged in `knownAmbiguities`.

### 5.2 The AND / OR conflict

For the 100–200K and 200–300K buckets the deck states the *passing* condition two different ways:

| Bucket | Flow diagram `[PRO s.18, s.20]` | Notching table `[PRO s.19, s.21]` |
|---|---|---|
| 100–200K | 80% collateralised **AND** final rating ≠ worst | 80% collateralised **OR** final rating ≠ worst |
| 200–300K | Fully collateralised **AND** final rating ≠ worst (V1 diagram) / **OR** (V2 diagram) | Fully collateralised **OR** final rating ≠ worst |

This is material: under **OR**, an uncollateralised deal with a non-worst rating still avoids the committee; under **AND**, it does not. The engine derives escalation as the negation of whichever form is configured:

```
OR-form  pass: collateralOk OR  notWorst   ⇒ escalate when !collateralOk AND worst
AND-form pass: collateralOk AND notWorst   ⇒ escalate when !collateralOk OR  worst
```

All five versions are seeded `collateralRatingOperator: 'OR'` (the tables' reading), and the Prometeia versions carry `operatorNote`: *"Notching cədvəlindəki 'VƏ YA' seçilib. Axın diaqramı 'VƏ' göstərir — konfiqurasiya ilə dəyişdirilə bilər."* The risk-consistent reading is **AND**; this needs an explicit bank decision before implementation.

The escalation reason string names exactly which half failed, e.g. *"Şərt ödənilmir (VƏ YA məntiqi): uyğun girov örtüyü 62% (tələb 80%), yekun reytinq ən zəif qiymətdədir."*

### 5.3 Known ambiguities carried on the Prometeia versions

Seeded in `PROMETEIA_AMBIGUITIES` and surfaced on every routing decision:

1. Diagrams say AND, tables say OR — materially different outcomes, confirmation required.
2. The V2 diagram contradicts the V1 diagram on the 200–300K bucket (AND vs OR).
3. "Fully collateralised" and "80% collateralised" are not defined numerically — eligible value, market value, or liquid value?
4. The pre-screen branch label "Bureau Rating ≠ Poor OR Satisfactory" is logically malformed; it must mean `NOT(Poor OR Satisfactory)`, i.e. score ≥ 400.
5. In V2 the `< 50K` and `50–100K fully collateralised` rows still escalate to "SME Committee" while every other row says "Small Committee".

---

## 6. Pre-screen handling

### 6.1 Configuration

Two places control it:

| Setting | Where | Value |
|---|---|---|
| `preScreenEnabled` | `WorkflowVersion` | `false` for the three ATB versions; `true` for both Prometeia versions |
| `preScreenRejectedAuthority` | `WorkflowVersion` | `'BY_EXPOSURE'` in all five — rejected cases are still routed by exposure, matching `[PRO s.19, s.21]` |
| `preScreenRejectBelow` | `AcbRatingScale` | `400` in `ACB_SCALE_PROMETEIA_V1` (i.e. score ≤ **399** fails) `[PRO s.12]`; `null` in `ACB_SCALE_ATB_CURRENT_V1` — ATB has no automated gate today |
| `preScreenAction` | `AcbRatingScale` | `'REJECT'` (Prometeia) / `'ESCALATE_TO_UW'` (ATB current) |
| `noScoreAction` | `AcbRatingScale` | `'ESCALATE_TO_UW'` — an application with no bureau score is never auto-rejected |

The ACB bands behind the threshold `[PRO s.12]`: Poor 0–149, Satisfactory 150–399, Medium 400–699, Good 700–859, Excellent 860–1000. The bureau grade fed to the gate is the **worst across micro and individual bureau ratings** `[PRO s.18]`.

### 6.2 Behaviour

`preScreen()` in `domain/rating/rating-engine.ts` produces `PASS` / `REJECT` / `ESCALATE_TO_UW` with a reason, the score, the grade, the threshold applied, the scale id and whether the gate was enabled at all.

`routeApplication` then treats a pre-screen rejection as **a record to be routed, never a case to be dropped**: when `preScreenRejected && workflow.preScreenEnabled`, it adds the reason *"Müraciət ilkin bürо süzgəcindən keçməyib — qeyd saxlanılır və ekspozisiyaya görə marşrutlanır."* and continues into normal bucket selection. The application is retained with `stage: 'REJECTED_PRESCREEN'` and a full `RejectionRecord` including the frozen version ids.

That is the direct implementation of Prometeia's requirement — *"data should be retained based on the proposed data model"* `[PRO s.18]` — against the current state where a negative RM screen means *"Application Rejected (Not Processed Further, No Record Kept)"* `[PRO s.4]`.

**Open question, unresolved in the source:** the pre-screen box reads "Application Rejected **OR** Escalated to UW team for further assessment" `[PRO s.18]` with no rule for choosing between the two. The platform exposes the choice as `preScreenAction` rather than inventing a rule.

---

## 7. SLA targets

> **No SLA appears in any source document.** Neither the methodology PDF nor the opinion workbook nor the Prometeia deck states a turnaround target, a stage deadline, or an ageing rule. The workbooks contain stage *dates* only (application received date, opinion date), and Prometeia never quantifies turnaround anywhere in its 29 slides.

`SLA_V1` in `config/workflow.ts` is therefore seeded with `status: 'INFERRED'` and a `sourceRef` that says so in plain language: *"Mənbə sənədlərdə SLA göstərilməyib; sifariş trekerində yalnız mərhələ tarixləri var — indikativ hədəflər."*

| Target | Days | Meaning |
|---|---|---|
| `daysToUnderwriting` | 2 | From application receipt to the file reaching the Underwriting Center |
| `daysInUnderwriting` | 5 | Time in underwriting until the opinion is issued |
| `daysToCommittee` | 3 | From opinion to committee decision |
| `totalTat` | **12** | End-to-end turnaround target |

These values are used by the dashboard (`app/page.tsx`), the application queue (`app/applications/page.tsx`) and the portfolio view (`app/portfolio/page.tsx`) to flag ageing cases, and they render with the amber `INFERRED` badge everywhere they appear. They must be replaced with the bank's own service standards before the platform is used to manage real turnaround, and no operational or performance conclusion should be drawn from them in the meantime.
