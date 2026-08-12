# Underwriting — Open Questions

Every unresolved question raised by the supplied material, with the source evidence, the configurable default the platform seeded so it stays runnable, and what is needed to close the question.

**How to use this document.** Nothing here blocks the platform from running: each item has a default that is *data*, not code, and every default carries a status (`CURRENT`, `PROMETEIA_PROPOSED`, `BANK_PROPOSED`, `HISTORICAL`, `INFERRED`, `NEEDS_CONFIRMATION`) that the UI displays next to the result. Closing a question means changing a configuration value and promoting its status — never editing an engine.

**Anonymisation rule (enforced).** No real personal name, tax identification number (VÖEN/FİN), phone number, address or account number appears below. The applicant of the worked example is **[BORROWER]**. Case amounts are retained only where they are the evidence for the question.

**Priority key.** P1 = blocks implementation of a decision rule · P2 = changes computed outcomes · P3 = documentation, data-capture or governance gap.

| # | Question | Priority | Status of the current default |
|---|---|---|---|
| 1 | Routing conditions: AND or OR? | P1 | `OR` seeded, flagged |
| 2 | V1 vs V2 diagram inconsistency on 200–300K | P1 | inherits Q1 |
| 3 | "Fully collateralized" / "80 % collateralized" undefined | P1 | eligible-value coverage ≥ 1.0 / ≥ 0.8 |
| 4 | The 0.8 payment-capacity coefficient (source not supplied) | P1 | 0.8, `NEEDS_CONFIRMATION` |
| 5 | Altman zone boundary handling | P2 | exact boundary = GREY |
| 6 | "Worst rating" definition | P1 | worst across 4 subject types; escalate at ≤ Satisfactory |
| 7 | ROA / ROE numerator inconsistency | P2 | retained profit |
| 8 | Inventory-days denominator | P2 | COGS |
| 9 | Quick-ratio definition drift | P2 | all inventory classes excluded |
| 10 | Gearing norm present in one source only | P2 | 0.5, `NEEDS_CONFIRMATION` |
| 11 | The missing `Data Base` sheet with sector turnover norms | P2 | coarse sector defaults, `NEEDS_CONFIRMATION` |
| 12 | 22 vs 23 financial ratios | P3 | all rows implemented |
| 13 | `Səmərəsi ölçülməyib` scoring as zero | P2 | scores 0, marked adverse |
| 14 | Collateral blank-vs-`yoxdur` formula quirk | P2 | source quirk not reproduced |
| 15 | Business-criterion stop covers only sub-block 2.1 | P2 | only 2.1, as in the source |
| 16 | The Area-1 knock-out dropped in the proposal | P2 | retained as a separate config |
| 17 | Business-analysis band arithmetic and who scores it | P2 | bands as printed |
| 18 | SLA targets absent from all sources | P3 | indicative targets, `INFERRED` |
| 19 | Approval-authority thresholds absent from the methodology | P1 | Prometeia thresholds, labelled |
| 20 | 11 formula defects in the committee presentation template | P2 | corrected in the platform |
| 21 | Ledger sales vs declared revenue discrepancy | P1 | flagged as a cross-check breach |
| 22 | Two competing internal scoring artefacts | P1 | kept strictly separate |
| 23 | Bad-definition circularity | P2 | three versioned definitions |
| 24 | ACB band divergence between the bureau legend and the proposal | P2 | Prometeia bands |
| 25 | Group exposure is not captured anywhere | P1 | computed, flagged when incomplete |
| 26 | Pre-screen: reject or escalate? | P1 | REJECT with escalation allowed |
| 27 | Sector methodology material not usable | P3 | not implemented |

---

## 1. Prometeia routing conditions — AND or OR?

**The question.** For the 100–200K and 200–300K buckets, is the decision retained at Director level when the case is collateralized **AND** the final rating is not the worst grade, or when it is collateralized **OR** the rating is not the worst grade?

**Why it matters.** With **OR**, an entirely uncollateralized deal with a merely non-worst rating stays out of committee. With **AND**, it goes to committee. On the deck's own numbers the 100–300K band is 183 of 1,132 approvals (16 %) with a 26 % external bad rate — the largest concentration of risk below Board level. This single operator decides where those cases are approved.

**What the sources say.** The Prometeia deck states the same condition twice, with different operators:

| Bucket | Flow diagram (slides 18 & 20) | Notching table (slides 19 & 21) |
|---|---|---|
| 100–200K | "**%80 Collateralized AND Final Rating ≠ Worst**" | "If **80% Collateralized OR Final Rating ≠ Worst**" |
| 200–300K | "Fully Collateralized **AND** Final Rating ≠ Worst" (V1 diagram) | "If **Fully Collateralized OR Final Rating ≠ Worst**" |

The deck's own rationale favours the stricter reading: slide 23 sells the design as "risk-sensitive approval routing … Bureau Rating and Final Internal Rating are used as the primary risk-based screening and escalation criteria."

**How the platform behaves.** `config/workflow.ts → WORKFLOW_PROMETEIA_PROPOSED_V1.collateralRatingOperator = 'OR'` (the notching-table reading), with `operatorNote` recording that the flow diagram says AND, and the conflict listed verbatim in `PROMETEIA_AMBIGUITIES`. The buckets use `escalationCondition: 'NOT_COLLATERALISED_OR_WORST'`; the alternative `'NOT_COLLATERALISED_AND_WORST'` is already part of the `RoutingBucket` type, so switching is a data change. `domain/workflow/routing-engine.ts → routeApplication` reads the operator at evaluation time.

**To resolve.** An explicit written decision from the bank (Underwriting Centre + KOB Centre + Risk Management), ideally supported by a re-run of the slide-7 volume analysis under both operators so the committee workload implication is visible before the choice is made.

---

## 2. Version 1 vs Version 2 diagram inconsistency

**The question.** The two proposed-process versions state the 200–300K condition differently *between themselves*, independently of the AND/OR conflict in Q1. Which one is the intended Version 2 behaviour?

**Why it matters.** The bank is being asked to choose between V1 and V2 (committee naming and top-bucket split). If the two versions also differ silently in a routing condition, the choice is not the one being presented.

**What the sources say.** The V1 flow diagram (slide 18) reads "Fully Collateralized **AND** Final Rating ≠ Worst" for 200–300K; the V2 flow diagram (slide 20) reads "Fully Collateralized **OR** Final Rating ≠ Worst" for the same bucket. Both notching tables (slides 19 and 21) say OR. Separately, the V2 notching table still routes the `<50K` and `50–100K fully collateralized` rows to the "**SME Committee**", although V2 renamed the bodies to Small / Big Committee — copy-paste residue.

**How the platform behaves.** `WORKFLOW_PROMETEIA_PROPOSED_V2` is defined as a spread of V1 with only the committee names, the 700,000 upper split and `stopFactorEscalationAuthority: 'BIG_COMMITTEE'` changed — i.e. the platform deliberately does **not** reproduce the diagram divergence. Both issues are recorded in `PROMETEIA_AMBIGUITIES` in `config/workflow.ts`.

**To resolve.** Prometeia to reissue slides 20–21 internally consistent, and the bank to confirm whether Small/Big Committee is the SME Committee renamed or a new governance structure (the Big Committee's composition is never given; the SME Committee is stated throughout as "Head of Underwriting, Head of Monitoring and CBO").

---

## 3. "Fully collateralized" and "80 % collateralized" are undefined

**The question.** Coverage of what, over what, at which valuation basis? Loan amount or post-transaction group exposure? Market value, liquidation ("likvid") value, or eligible value after haircuts?

**Why it matters.** These terms are routing gates in three buckets across four workflow presets. The difference between market and liquid value in the worked case is roughly a factor of two, and the difference between "this deal" and "post-transaction exposure" is another.

**What the sources say.** The deck uses the terms without definition. The presentation template offers two candidate metrics, both on **liquid** value:

- `Sifarişçi & Təminat & Təyinat!L41 = IFERROR(E41/H41,"")` — existing loans / last liquid value;
- `L44 = IFERROR(H44/H41,"")` where `H44 = D44 − E44 + F44` — total resulting debt / last liquid value. In the worked case `L44 = 5.5`, i.e. about 18 % coverage.

The collateral narrative in the opinion cites "AMB-nın təminat kredit nisbəti tələbi" (the Central Bank's collateral/loan ratio requirement) but never states the percentage. No haircut schedule exists in any supplied document.

**How the platform behaves.** `domain/calculations/collateral.ts → valueCollateral, computeCollateralCoverage` compute coverage as **eligible value / post-transaction ATB exposure**, where eligible value applies `config/policy.ts → COLLATERAL_HAIRCUTS_V1` (status `INFERRED`: residential RE 0 %, commercial 10 %, land 25 %, equipment 30 %, vehicle 25 %, receivables/inventory 50 %; personal and corporate guarantees are `ineligibleTypes`). `config/policy.ts → COLLATERAL_COVERAGE` seeds "fully collateralized" as coverage ≥ 1.0 (`INFERRED`), and `config/workflow.ts → CollateralCondition` carries `MIN_80_PCT` for the 80 % gate. `WORKFLOW_ATB_INTERNAL_PROPOSAL_V1.knownAmbiguities` states the gap in Azerbaijani.

**To resolve.** Three decisions from Risk Management: (a) numerator basis — eligible after haircuts, liquid, or market; (b) denominator — this facility or post-transaction group exposure; (c) the haircut table itself, or a written instruction that `Likvid dəyər` is already the haircut. The Central Bank requirement referenced in the opinion narrative should be attached as the authority.

---

## 4. The 0.8 payment-capacity coefficient — its source document was never supplied

**The question.** What exactly is the norm for `Aylıq ödəniş / Proqnoz ödəmə qabiliyyəti`, and does it differ by loan purpose?

**Why it matters.** This ratio is stop factor #5 — the single most consequential quantitative gate in the methodology, because breaching it zeroes the financial criterion and therefore the whole opinion. The methodology PDF names the rule but never states its number, and the two documents that do state a number disagree.

**What the sources say.**

- Metodologiya §6.3 names the stop factor as a breach of "`Bölüşdürülməmiş mənfəətin aylıq ödənişə nisbəti`" (retained profit to monthly payment) — with **no numeric norm**.
- The opinion narrative for the worked case states that a ratio of 94 % "violates the **0.8 coefficient** requirement" of the ***KOB kreditlərinin verilməsi Metodologiyası*** (SME Lending Methodology) for the fixed-asset / home-purchase portion, while the working-capital portion was acceptable. **That document is not in the supplied set.**
- The Təqdimat `Əmsallar` sector table prints the same metric — "`Ödəmə qabiliyyəti əmsalı` = Təklif edilən kreditin aylıq ödənişi / Bölüşdürülməmiş mənfəət + bağlanacaq kreditin orta aylıq ödənişi" — with norm **0.7** on every sector row.
- The worked case computes `MZH!Q10 = 0.9415` and **nothing in the workbook flags it**; there is no automated pass/fail aggregation anywhere in the template.

So there are three candidate readings: 0.8 (opinion narrative, purpose-dependent), 0.7 (sector benchmark table), and "unstated" (the methodology itself).

**How the platform behaves.** `config/policy.ts → PAYMENT_TO_CAPACITY` is seeded `operator: 'LTE', threshold: 0.8, action: 'STOP', status: 'NEEDS_CONFIRMATION'`, with `sourceRef` recording that the source document was not supplied, and `waivedForSectors: ['Kənd təsərrüfatı']` per §6.3. The matching stop factor is `STOP_FACTORS_V1 → SF_REPAYMENT_CAPACITY_NORM` (`evaluator: 'repaymentCapacityNorm'`), which `domain/rules/stop-factors.ts` evaluates as `paymentToCapacity > 0.8`. The related `ALL_PAYMENTS_TO_RETAINED_PROFIT` rule is seeded at 0.8 with status `INFERRED` because no norm exists for it at all. The metric itself is produced by `domain/calculations/repayment-capacity.ts → computeRepaymentCapacity`.

**To resolve.** Obtain `KOB kreditlərinin verilməsi Metodologiyası` and extract: the coefficient, whether it is purpose-dependent (working capital vs fixed asset / personal purchase appear to be tested differently), and which denominator definition it uses. Then reconcile with the 0.7 in the sector table — one of the two is stale.

---

## 5. Altman zone boundary handling

**The question.** If Z lands exactly on a zone boundary (2.90 / 1.23 for the private variant, 2.99 / 1.81 general, 2.60 / 1.1 emerging), which zone applies?

**Why it matters.** Under the proposal the Altman zone is worth up to **−2 notches** (High Risk) or **+1 notch** (Low Risk) for Medium-segment cases. A boundary case therefore moves the final internal rating and, through it, the approval authority.

**What the sources say.** Both sources define the zones with strict inequalities on the outside and open intervals in the middle: the workbook prints "Sağlam Z > 2.60 / Təhlükəli 1.1 < Z < 2.60 / Müflis Z < 1.1", and slide 14 prints "Low Risk Z > 2.90 / Medium Risk 1.23 < Z < 2.90 / High Risk Z < 1.23". Neither states which side owns the endpoint; taken literally, an exact boundary value belongs to no zone.

**How the platform behaves.** `domain/calculations/altman.ts → altmanZone(z, cfg, boundary)` treats an exact boundary as **GREY** (the conservative reading: no upgrade, no downgrade), and accepts `'LOW_SIDE' | 'HIGH_SIDE' | 'GREY'`. The choice is exposed as `config/rating.ts → NOTCHING_PROMETEIA_V1.altman.boundaryInclusive = 'GREY'`.

**To resolve.** A one-line convention from Risk Management. Recommended: `Z ≥ lowRiskAbove` = Low Risk, `Z ≤ highRiskBelow` = High Risk, which removes the undefined points and matches standard Altman practice.

---

## 6. What exactly is the "worst rating"?

**The question.** "Worst rating" is used in three different senses in the same deck. Which one drives escalation, and across which subjects is it computed?

**Why it matters.** "Final Rating = Worst" is the escalation trigger in every proposed bucket. If it means only the bottom grade (Poor), escalation is rare; if it means the bottom two, the committee load changes materially. And if the bureau input is the worst rating across related parties, group data that the bank does not currently capture becomes mandatory.

**What the sources say.** Three distinct uses:

1. **Bureau input:** "Bureau rating is defined as **the worst rating observed across both Micro and Individual bureau ratings**" (notes on slides 18 and 20), and related-party checks should "extend bureau assessment beyond the applicant to key shareholders / parent company where relevant" (slide 10).
2. **Routing trigger:** "Final Rating **is not Worst** → finalized by KOB KM Internal Committee; if Final Rating **is Worst** → escalated" (slides 19/21). Slide 16 equates the worst grade with "**the Poor rating grade (Rating 1)**".
3. **Knock-out:** in the current-state business-analysis guideline (slide 29), Area 1 High Risk is marked "**(KNOCK OUT CRITERIA – WORST RATING)**" — here "worst rating" is an *outcome forced onto the case*, not an observed input.

No mapping from an Individual bureau score to the five rating bands is given anywhere. The Small-segment simulation also shows migration *into* Poor (14 → 19 observations) without stating whether Poor can be downgraded further, or what "2 notches below Poor" would mean.

**How the platform behaves.** `config/rating.ts → WORST_RATING_V1` (status `NEEDS_CONFIRMATION`) sets `include: ['APPLICANT','SHAREHOLDERS','GROUP_BORROWERS','GUARANTORS']` and `escalateAtOrBelow: 'SATISFACTORY'` — deliberately more conservative than the slide-16 reading, so that cases are escalated rather than silently retained while the definition is open. `domain/rating/rating-engine.ts → weakerGrade` and `computeBureauRating` implement the worst-of computation; `GRADE_ORDER` in `config/rating.ts` fixes the ordinal scale with POOR at position 0, and the notching engine floors at POOR.

**To resolve.** Confirm (a) the escalation grade (Poor only, or Poor + Satisfactory); (b) the subject set for the bureau worst-of; (c) the Individual-score → band mapping; (d) whether the Poor grade is a floor for downgrades.

---

## 7. ROA / ROE numerator: retained profit or annualised net profit?

**The question.** The same two norms (5 % and 8 %) are computed from two different numerators in two source workbooks. Which is the bank's definition?

**Why it matters.** Retained profit is net profit *after* owner drawings plus additional income; in the worked case the two differ substantially. Two analysts using the two workbooks would report different ROA for the same borrower against the same norm.

**What the sources say.**

- Opinion workbook `Əmsallar`: ROA `= 'MZH chart'!C15 / 'Balans chart'!C5`, ROE `= 'MZH chart'!C15 / 'Balans chart'!C45` — where `MZH chart!C15` is **`Bölüşdürülməmiş mənfəət`** (retained profit, itself `= C12 − C13 + C14`, i.e. net profit − distributed profit + additional income).
- Təqdimat `Balans` panel: `T35 = MZH!Q6*12 / Balans!E27`, `T36 = MZH!Q6*12 / L22` — i.e. **monthly net profit annualised ×12**.
- Norms are identical in both: 0.05 and 0.08.

**How the platform behaves.** `config/policy.ts → ROA` and `ROE` are seeded at 0.05 / 0.08 with `explanation: 'Bölüşdürülməmiş mənfəət / …'` — i.e. the **opinion-level (retained-profit) definition**, because the opinion sheet is the authoritative scoring artefact. Both are `action: 'INFO'`, so the choice does not gate anything today. `domain/calculations/ratios.ts → computeRatios` publishes `roa` and `roe` with their component breakdown so the numerator is visible in the UI.

**To resolve.** One decision from the Underwriting Centre. If the annualised-net-profit definition wins, the norms should be re-derived — a 5 % norm calibrated on retained profit is not the same hurdle when applied to net profit.

---

## 8. Inventory days: the label says sales, the formula uses COGS

**The question.** Is `Ehtiyatların dövretmə müddəti` computed on annual **sales** or on annual **cost of goods sold**?

**Why it matters.** At a 30 % mark-up the two differ by about 30 % — enough to move a trading borrower across a 180-day sector norm.

**What the sources say.** The printed definition and both implementations disagree:

- Metodologiya §6.6 ratio table prints "360 × Ehtiyyatlar / **İllik satış**" (annual sales).
- Opinion workbook `Əmsallar`: `= (360*('Balans chart'!C10+C11+C12+C13)) / 'MZH chart'!C3` — `C3` is **`Satışın maya dəyəri`** (COGS). Its own definition text reads "360 × Ehtiyatlar / **İllik satışın maya dəyəri**".
- Təqdimat `Balans`: `T33 = 360*E15 / MZH!Q30` — `Q30` is again **COGS**, while the row label above it still says "İllik satış".

So both implementations use COGS and only the labels say sales.

**How the platform behaves.** `domain/calculations/ratios.ts → computeRatios` computes `inventoryDays` on **COGS**, matching both implementations, and states the denominator in the metric's component breakdown. `config/policy.ts → SECTOR_INVENTORY_DAYS_*` carries the explanation "360 × ehtiyatlar / illik satışın maya dəyəri".

**To resolve.** Correct the label in the methodology and in the template (a documentation fix, not a computation change) — or, if sales is genuinely intended, re-derive every sector norm, because the current norms were observed against a COGS denominator.

---

## 9. Quick-ratio definition drift

**The question.** Does the quick ratio exclude only goods held for sale (`mal qalığı`), or all inventory classes?

**Why it matters.** For a producer with raw materials and work-in-progress the two differ materially; for a pure trader they nearly coincide. The norm (1.0) was presumably calibrated on one of them.

**What the sources say.** The `Əmsallar` definition text reads "(Cari aktivlər − **mal qalığı**) / cari öhdəliklər", but the formula subtracts four balance lines: `= ('Balans chart'!C6 − C10 − C11 − C12 − C13) / 'Balans chart'!C43` — goods for sale **plus** `Yarımfabrikat` (work in progress), `Xammal` (raw materials) and `Digər ehtiyatlar`. Same intent, broader subtraction.

**How the platform behaves.** `domain/calculations/ratios.ts` computes `quickRatio` excluding **all** inventory classes (the formula, not the label). `config/policy.ts → RATIO_QUICK_RATIO` is seeded GTE 1.0 with `severity: 'MEDIUM', action: 'WARNING'` and the explanation "(Cari aktivlər − ehtiyatlar) / Qısa müddətli öhdəliklər" — the wording deliberately matches the implementation rather than the source label.

**To resolve.** Confirm the intended definition and correct whichever of the two is wrong. Low risk either way, since the rule is a warning, not a gate.

---

## 10. The gearing norm appears in only one source

**The question.** Is the gearing norm 0.5, "max 30 %", or is there no norm?

**Why it matters.** Gearing (bank debt / equity) is the cleanest measure of bank-specific leverage and a natural covenant candidate; three different answers exist across two workbooks.

**What the sources say.**

- Opinion workbook `Əmsallar`: Gearing is listed as "bank öhdəliklərinin kapitalda payı" with **an empty Norma cell**.
- Təqdimat `Balans` second panel: `AA32 = (L6+L7)/L22` against norm **0.5**.
- Təqdimat `Əmsallar` sector table, column L: "**max 30%**" on every sector row.

Nothing explains the relationship between 0.5 and 30 %.

**How the platform behaves.** `config/policy.ts → GEARING` is seeded `LTE 0.5, severity: 'MEDIUM', action: 'WARNING', status: 'NEEDS_CONFIRMATION'`, with `sourceRef` recording that the `Əmsallar` sheet shows the ratio with no norm and the explanation noting "Norma mənbələr arasında fərqlidir — təsdiq tələb edir".

**To resolve.** One value from Risk Management, plus a decision whether gearing should be a warning or a policy exception. The 30 % figure may be a different metric (bank debt / total liabilities or / assets) mislabelled — worth checking before adopting either.

---

## 11. The `Data Base` sheet with the sector turnover norms

**The question.** Are the sector inventory-day and receivable-day norms used by the Underwriting Centre identical to the table in the RM presentation template, and at what granularity should the platform hold them?

**Why it matters.** These are the only sector-specific quantitative norms in the whole methodology. They gate two policy rules per sector and feed the ratio commentary in every opinion.

**What the sources say.** The opinion workbook reaches the norms through an **external reference to another workbook** (`[1] Data Base`), which was not supplied: `U33 = VLOOKUP('Data Base'!$V$21, 'Data Base'!$V$22:$Y$68, 4, 0)` and the receivable-day equivalent at column 5. The Təqdimat workbook *does* contain a `Data Base` sheet with the same lookup key construction (`V21 = sector & sub-sector`, matched against `V22:V68`) and an `Əmsallar` sheet holding a 47-row **sub-sector** table (Ticarət/Ərzaq 60 days, Ticarət/Məişət avadanlıqları 180, İstehsal/Çörək və un məmulatları 7, Kənd təsərrüfatı/Süd satışı 10, Xidmət `Tələb yoxdur`, and so on — reproduced in full in `docs/source-traceability-matrix.md` §9). What cannot be verified is whether the Underwriting Centre's external workbook holds the *same* table or a different revision, and the `Əmsallar` sheet also distinguishes a 5,000–50,000 AZN tier from a >50,000 AZN tier whose 5,000–50,000 values were not dumped.

**How the platform behaves.** `config/policy.ts → sectorTurnoverRules()` seeds a **coarser, sector-level** table (Ticarət 60/45/60, Topdan ticarət 75/60/75, Pərakəndə ticarət 45/15/45, İstehsal 90/60/60, Tikinti 120/90/90, Xidmət 30/30/45, Nəqliyyat 20/45/30, Kənd təsərrüfatı 180/60/90) generating `SECTOR_INVENTORY_DAYS_*`, `SECTOR_RECEIVABLE_DAYS_*` and `SECTOR_CREDITOR_DAYS_*`, all with `scope: 'SECTOR'` and `status: 'NEEDS_CONFIRMATION'` / `'INFERRED'` and the sourceRef "RM iş kitabı 'Data Base' sektor normaları — mənbə fayl təqdim edilməyib". The `PolicyRule` type already supports `subSector`, so promoting the table to the source's granularity is a data migration, not a code change.

**To resolve.** Obtain the Underwriting Centre's `Data Base` workbook, confirm it matches the Təqdimat table, then load the full sub-sector table (both amount tiers) and promote the rules to `CURRENT`.

---

## 12. "22 financial ratios" — the sheet has 23 rows

**The question.** Which of the listed rows is not counted as a ratio, and is the methodology's count authoritative?

**Why it matters.** Minor, but the count appears in an approved methodology and will be quoted in audit. It also hints that one row (probably the absolute `Working Capital` value, which is a currency amount rather than a ratio) was added after the text was written.

**What the sources say.** Metodologiya §6.6 states "**22 fərqli maliyyə əmsalı**". The `Əmsallar` sheet lists 23 labelled rows, including `Working Capital / İşlək kapital = 'Balans chart'!C6 − 'Balans chart'!C27` — an absolute amount, not a ratio.

**How the platform behaves.** `domain/calculations/ratios.ts → computeRatios` implements the full set (and additional derived metrics such as `debtToEbitda`, `netDebtToEbitda`, `interestCoverage`, `cashRatio`), each with `unit` set, so currency-valued metrics are visibly distinct from ratios. No count is asserted anywhere in the platform.

**To resolve.** Correct the methodology text at its next revision, or confirm which row is excluded from the count.

---

## 13. `Səmərəsi ölçülməyib` ("efficiency not measured") scores zero

**The question.** Should "efficiency could not be measured" score the same as "the purpose is inefficient" — and thereby arm half of the joint stop factor?

**Why it matters.** It conflates an *information* gap with an adverse *finding*. Combined with a zero on purpose control, it zeroes the purpose criterion and therefore the entire opinion. In the worked case the option was selected and scored 0; the joint stop was avoided only because control possibility was positive.

**What the sources say.** The dropdown in `Data validations` offers `Səmərəlidir` / `Qismən səmərəlidir` / `Səmərəsizdir` / `Səmərəsi ölçülməyib`, but the formula names only three of them: `J88 = IF(F88="Səmərəlidir", J85*50%, IF(F88="Qismən səmərəlidir", J85*25%, IF(F88="Səmərəsizdir", J85*0, IF(F88="",0,0))))`. `Səmərəsi ölçülməyib` therefore scores 0 through the fall-through branch — by omission, not by design. Metodologiya §7.5 does not mention the option.

**How the platform behaves.** `config/scorecards.ts → LEGACY_SCORECARD_V1 → PURPOSE_EFFICIENCY` reproduces the source exactly: option `NOT_MEASURED` with `achievement: 0` and `adverse: true`, so it scores zero but is visibly distinguished from `INEFFICIENT` in the UI and in the opinion narrative. The joint stop is configured through `jointStopComponents: ['PURPOSE_EFFICIENCY','PURPOSE_CONTROL']` and evaluated in `domain/scoring/legacy-opinion.ts`.

**To resolve.** A policy decision: either (a) confirm "not measured" = 0 (status quo), (b) give it a partial achievement, or (c) exclude it from the joint stop so an information gap cannot zero an opinion on its own. Option (c) is the most defensible and is a one-line configuration change.

---

## 14. The collateral formula treats a blank answer better than an explicit "no"

**The question.** Is it intended that leaving the real-estate question blank can earn up to 10 points, while answering `yoxdur` ("none") caps the criterion at 5?

**Why it matters.** It rewards not answering. Collateral is 10 % of the opinion, so the effect on the total is up to 5 points — enough to change the risk band.

**What the sources say.** `J93 = IF(F94="", (J92*J96)*0.33333, IF(F94="var", SUM(J94:J96), IF(F94="qismən var", SUM(J94:J96), IF(F94="yoxdur", SUM(J94:J96)))))`. When `F94` is **blank**, the guarantor sub-score (max 3) is rescaled ×10/3 to the full 10-point scale — the "no real estate, score on guarantors only" mode of Metodologiya §8.5. When `F94 = "yoxdur"` (an explicit "no real estate"), the formula instead sums `J94:J96`, whose maximum is 0 + 2 + 3 = **5**. The methodology describes only two modes and does not distinguish blank from "yoxdur"; the divergence looks unintended.

**How the platform behaves.** `config/scorecards.ts → LEGACY_SCORECARD_V1.categories.COLLATERAL` models the three components with their documented weights (50/20/30) and `domain/scoring/legacy-opinion.ts` scores unanswered components as unanswered rather than reproducing the rescaling quirk. The platform therefore does **not** replicate the blank-vs-`yoxdur` asymmetry; the guarantor-only mode is a deliberate configuration, not an accident of a blank cell.

**To resolve.** Confirm that the guarantor-only mode (0 % = 0, 50 % = 5, 100 % = 10, per §8.5) is triggered by an explicit "no real-estate collateral" answer, and fix the workbook formula. Until confirmed, historical opinions scored under the quirk are not exactly reproducible — relevant if past cases are re-scored for backtesting.

---

## 15. The business criterion's stop factor covers only sub-block 2.1

**The question.** Was the stop condition meant to cover the other business sub-blocks, and is 41 really a passing score for ownership verification?

**Why it matters.** A case can score 41 on "is this actually the applicant's business?" — the criterion the methodology treats as fundamental — and still pass, while a case at 40 is rejected outright. Sub-blocks 2.2 (structure and management) and 2.3 (documentation) can score 0 with no consequence beyond the average.

**What the sources say.** `J44 = IF(OR(J47<=40), 0, SUM((J47+J51+J55)/3) * 20/100)`. The `OR(...)` wrapper with a **single argument** strongly suggests further conditions were planned and never added. Metodologiya §5.1.1 describes the stop qualitatively ("if ownership is not confirmed by documents, evidence or facts, or period income does not match the applicant's social standing") without naming the 40 threshold; the 40 appears only in the formula.

**How the platform behaves.** `config/scorecards.ts → BUSINESS_OWNERSHIP_LINK.stopRule = { when: 'LTE', value: 40 }` reproduces the source exactly — only sub-block 2.1 can zero the criterion. The `LegacyStopRule` type supports a `stopRule` on any component, so extending the guard to 2.2 / 2.3 is a data change in `LEGACY_SCORECARD_V1`.

**To resolve.** Confirm whether the guard should extend to the other sub-blocks and whether 40 is the intended threshold (the risk-band ladder would put the boundary at 41 = "Orta yüksək riskli", which is consistent, so the value is probably deliberate even if the single-argument `OR` is not).

---

## 16. The Area-1 knock-out is dropped in the Prometeia proposal

**The question.** Does unverifiable business ownership remain a knock-out under the new framework, or does it only cost points?

**Why it matters.** Under the current guideline, unverifiable ownership forces the worst rating. Under the proposed matrix it is worth 1 point of 9, which at worst contributes to a −2 notch. That is a large weakening of the bank's strongest anti-fraud control — and it is not presented as a change anywhere in the deck.

**What the sources say.** Slide 29 (current-state guideline) marks Area 1 High Risk "**(KNOCK OUT CRITERIA – WORST RATING)**". Slide 13 (proposed matrix) uses near-identical wording for the same box — "Business ownership cannot be sufficiently verified through documentary evidence, or the declared income is inconsistent with the applicant's profile, preventing reliable ownership verification" — but **omits the knock-out clause**. The methodology's own stop factor #3 (§5.1.1) is the same control on the as-is side and is not mentioned in the deck at all.

**How the platform behaves.** The two frameworks are kept apart. The as-is knock-out lives on as `config/policy.ts → STOP_FACTORS_V1 → SF_OWNERSHIP_NOT_CONFIRMED` (status `CURRENT`) and as the `LTE 40` stop on `BUSINESS_OWNERSHIP_LINK`; the proposed layer in `config/scorecards.ts → BUSINESS_SCORECARD_PROMETEIA_V1` carries no knock-out, exactly as printed. `config/rating.ts → WORST_RATING_V1` exists so a forced-worst outcome can be wired in once the bank decides.

**To resolve.** Explicit confirmation: retain the knock-out (recommended, since the methodology's stop factor #3 is approved policy and the deck never proposes repealing it), or repeal it in writing. If retained, note that it duplicates the "Final Rating = Worst" escalation route and the interaction should be specified.

---

## 17. Business-analysis band arithmetic, and who applies it

**The question.** Two sub-questions: (a) is a total of exactly 9 really the only "Low Risk" outcome; (b) how are three different teams calibrated against the same 1–3 scale?

**Why it matters.** (a) Area 2 is the mean of two dimensions, so totals fall on halves: 3, 3.5, … 9. "Low Risk" is defined as the single point 9, so a case scoring 8.5 lands in Low-Medium. Any rounding convention introduced later changes outcomes. (b) The same questions are answered by RMs, the KOB KM financial analysis team or the UW Team depending on exposure and collateral — three populations, one subjective scale, no calibration mechanism.

**What the sources say.** Slide 13: "The final score for Area 2 is calculated as the average of the two dimensions scores"; "The final Section 2 score is calculated by summing the scores of the three assessment areas"; bands "9 → Low Risk · 7.0–8.99 → Low-Medium · 6.0–6.99 → Moderate · 4.0–5.99 → Medium-High · 3.0–3.99 → High". And: "The same Business Analysis questions are answered for both Small and Medium segment applications. The team responsible for answering these questions varies depending on the group exposure amount and collateralization criteria." The only monitoring commitment is generic: "track approvals, overrides, delinquency migration and realized default outcomes for future recalibration."

**How the platform behaves.** `config/rating.ts → NOTCHING_PROMETEIA_V1.businessBands` encodes the bands exactly as printed (`LOW: min 9, max 9`), and `domain/rating/rating-engine.ts → evaluateBusinessAnalysis` computes Area 2 as an unrounded mean, so the platform never silently rounds. The assessing team per bucket is explicit in `config/workflow.ts → RoutingBucket.assessmentAuthority`.

**To resolve.** Confirm the band edges (or restate Low Risk as ≥ 8.5), and add a calibration/override-review process — e.g. periodic dual scoring of a sample across the three teams, recorded through the monitoring module.

---

## 18. SLA targets do not exist in any source

**The question.** What are the bank's turnaround targets for intake → analysis, analysis → committee and committee → decision?

**Why it matters.** The tracker records the stage dates that would measure SLA, and the methodology explicitly cites speed as the reason for having two opinion formats — but no target is written down, so nothing can be reported against.

**What the sources say.** The tracker carries `Daxil olma` → `Təhlil tarixi` → `Komitə tarixi` → `Qərar tarixi` (sheet 1) and `Sifarişin daxil olma tarixi` → `Rəyin verilmə tarixi` (sheet 2). **No TAT formula exists anywhere in the workbook** — elapsed time is only obtainable by differencing dates by hand; observed intake→opinion gaps in the sample run from 0 to about 9 days. Sheet 1 also has a dedicated column `Rəy, komitə və qərar mərhələsində qalma səbəbi` ("reason for dwell at the opinion/committee/decision stage") which is almost never filled. Metodologiya §3.1 justifies the short opinion form by "operativliyi qorumaq" (preserving speed) but sets no time limit.

**How the platform behaves.** `config/workflow.ts → SLA_V1` (status `INFERRED`) seeds indicative targets: `daysToUnderwriting: 2`, `daysInUnderwriting: 5`, `daysToCommittee: 3`, `totalTat: 12`, with `sourceRef` stating that the sources contain no SLA and only stage dates exist. The stage model itself is taken from the tracker.

**To resolve.** Agree targets with the Underwriting Centre and the KOB Centre, ideally calibrated on the tracker's own historical distribution rather than set arbitrarily, and decide whether dwell reasons become a mandatory field.

---

## 19. Approval-authority thresholds are absent from the methodology

**The question.** What are the bank's approved AZN authority limits, and does the routing in the platform match them?

**Why it matters.** Every routing preset in the platform is built from a consultant's description of the bank's process, not from the bank's own authority document. If the real limits differ, the platform routes cases to the wrong body.

**What the sources say.** Metodologiya §3.1 distinguishes only two opinion formats by authority — `Geniş forma` (Əlavə № 2) for submissions to the İdarə Heyəti "per approved authority limits", `Kiçik forma` (Əlavə № 1) for other bodies — and **does not state the limits**. The referenced "Təsdiq edilmiş səlahiyyət limitləri" document was not supplied. The only quantitative markers in the bank's own artefacts are the presentation template's `> 50.000 AZN` stamp and its `Əmsallar` sheet distinguishing a 5,000–50,000 tier from a >50,000 tier. All numeric buckets (50K / 100K / 200K / 300K / 500K / 700K) come from the Prometeia deck. The tracker's own committee codes (`DKK`, `KKK`, `BKK`, `İH`) are never expanded anywhere and cannot be mapped to those buckets.

**How the platform behaves.** Five presets are seeded and kept strictly apart in `config/workflow.ts`: `WORKFLOW_ATB_CURRENT_V1` (`CURRENT`, from slide 4), `WORKFLOW_ATB_INTERNAL_PROPOSAL_V1/V2` (`BANK_PROPOSED`, slides 5–6), `WORKFLOW_PROMETEIA_PROPOSED_V1/V2` (`PROMETEIA_PROPOSED`, slides 18–21). Each bucket carries its authority, escalation condition and notching layers as data; `AUTHORITY_RANK` drives escalation. The UI shows the preset's status next to every routing decision.

**To resolve.** Obtain the approved authority-limits document, map `DKK` / `KKK` / `BKK` / `İH` to the platform's `AUTHORITIES`, and reconcile the as-is preset against it. Note the largest governance change on the table: the Board threshold moves from **>300,000** (current) to **>500,000** (V1) or **>700,000** (V2) — quantified in the deck as moving 40 cases to 7 or 1 out of 1,132.

---

## 20. Eleven formula defects in the committee presentation template

**The question.** Are these defects known and will the template be fixed, and were opinions issued on the affected numbers?

**Why it matters.** Four of the eleven silently zero **every delinquency statistic** on the summary grid that goes to the committee. Two more make the workbook's own consistency tests report on the wrong row. These are not cosmetic: they remove information the committee is supposed to see.

**What the sources say.** All eleven were found in `Təqdimat 50 000 AZN çox (Əlavə № 2).xlsx`, `memo versiya - 01.10.2025`:

| # | Sheet | Cell | Defect |
|---|---|---|---|
| 1 | `Kredit tarixçəsi` | `AF31` | `=IF(S31<=0,"NO","YES")` tests **delinquency days (S)** instead of the outstanding balance (N); rows 10–30 all use N. Row 31 is mis-flagged active/inactive |
| 2 | `Kredit tarixçəsi` | `L45` | `=SUMIF(D10:D31,"Azər-Türk Bank",$R10:$R31)` sums column **R**, which is blank (delinquency facts live in Q). Always 0 |
| 3 | `Kredit tarixçəsi` | `M45` | Criteria range is **E (disbursement date)**, so it can never match "Azər-Türk Bank". Always 0 |
| 4 | `Kredit tarixçəsi` | `N45`, `P45` | `SUMIFS` criteria range is **H, the credit-line YES/NO flag**, not the institution. Always 0 |
| — | ⇒ consequence | rows 45–47 | **Every delinquency statistic in the summary grid — `Gecikmə Fakt`, `Gecikmə gün` and their "active loans only" variants — is structurally zero.** In the sample all show 0 although the raw per-loan columns are populated |
| 5 | `Müqayisəli təhlil` | `T61` | Cross-check narrative references `P60/O60/S60` while the row's data is in `P61/O61/S61` — off-by-one; the receivables cross-check reports on the wrong row |
| 6 | `Müqayisəli təhlil` | `T65` | Same off-by-one (`P64/O64/S64` instead of row 65) for the inventory cross-check |
| 7 | `Balans` | `Q31` / `T31` | Uses `'Sifarişçi…'!V11` — the offer amount, **not** its AZN equivalent — so a foreign-currency offer is not converted in the debt-to-equity stop-factor ratio |
| 8 | `MZH` | `E7:E10` vs `D132:D135` | Two different formulations of the same four sensitivities coexist (`E7` divides `J7` by 10000; `D132` computes the ratio directly). Rows 131–135 are an orphaned earlier version with different maths |
| 9 | `Pul axını_proqnoz` | `B84` | `=-SUM(C78:C82)+C83` while `Pul axını_cari!B84` is `=-SUM(C78:C83)` — the current sheet therefore **subtracts** investment inflows instead of adding them |
| 10 | workbook-wide | `[2]MZH!K2`, `[3]Pul axını_cari!I2` | Broken **external workbook references** left in `Pul axını_cari!I2` and `Pul axını_proqnoz!I2` |
| 11 | `Kredit tarixçəsi` | `F10` etc. | Tenor is entered as free text ("10 il", "9 AY") in some rows and as a number in others, while `PMT(J/12, F−I, −L)` treats it as a number → `T10` silently returns "" via `IFERROR`, so those loans' instalments are **excluded from every aggregate** |

**How the platform behaves.** None of the defects is reproduced. `domain/calculations/bureau.ts → summariseBureau` computes delinquency counts and days from the facility records directly; `domain/calculations/cross-checks.ts → runCrossChecks` computes each reconciliation from typed statement totals with an explicit tolerance (`CROSS_CHECK_TOLERANCES`) rather than a hand-wired cell reference; `config/policy.ts → DEBT_TO_EQUITY_INCL_NEW` operates on converted AZN amounts; `domain/calculations/amortisation.ts` computes instalments from a typed `LoanStructure`, so a tenor can never be free text; and the forecast/current cash-flow sign convention is fixed in `domain/calculations/statements.ts → cashFlowTotals`.

**To resolve.** Send the defect list to the template owner (KOB Centre / Biznes Proseslərin İdarə Edilməsi Departamenti). Separately, decide whether committee decisions taken on packs where defect #1–#4 hid delinquency data need review — that is a governance question, not a technical one.

---

## 21. Ledger sales are five times declared revenue

**The question.** Which revenue figure does the bank underwrite on, and what evidence tier does an informal ledger earn when the tax declaration contradicts it?

**Why it matters.** This is the single largest evidence question in the whole case file, and it recurs for every informally-trading SME borrower. It determines the P&L, the repayment capacity, and therefore whether the 0.8 coefficient (Q4) is met.

**What the sources say.** For the same 12-month window on the worked case:

| Source | Field | Amount (AZN) |
|---|---|---|
| Ledger / computer records → `MZH!Q16` | Sales, 07.2025–06.2026 | **3,205,546** |
| ATB account statement → `Biznes İNFO!M15` | Bank turnover, 01.07.2025–06.07.2026 | **432,544** |
| Income-tax declaration, line 1200, FY2025 | Declared revenue | **621,240** |
| `Balans!E15` (from the ledger book) | Inventory | **1,206,234** |
| Tax declaration Annex 1, line 1.3.2 (`Mallar`), closing 2025 | Declared inventory | **1,213,181.49** |

Declared revenue is roughly **19 %** of ledger-based sales, while declared inventory is within **0.6 %** of ledger-based inventory — stock is real, turnover is largely informal. The workbook's own commentary documents the reconstruction: goods for sale were "*Dəftər qeydiyyatından hesablanıb, dəftər qeydlərində mallar satış qiyməti ilə nəzərə alınıb*" (computed from the ledger entries, where goods are recorded at selling price) and then divided by 1.35 to reach cost; sales were "*Kompyuter qeydlərindən götürülmüşdür*" (taken from the computer records). The two declarations also disagree with each other on basis and size: FY2024 is `kassa metodu` / `Mikro` with revenue 143,378, while FY2025 is `hesablama metodu` / `Kiçik` with revenue 621,240 — both marked `Dəqiqləşdirilmiş (Vergi ödəyicisi)` (amended by the taxpayer). Metodologiya §6.3 ranks tax declarations in the **low-risk** evidence tier and margin-derived, partially-recorded sales in the **medium** tier only "when consistent with other statements".

**How the platform behaves.** The discrepancy is surfaced, not silently resolved: `domain/calculations/cross-checks.ts → runCrossChecks` runs `BANK_TURNOVER` (tolerance 15 %) and `SALES_TO_CASH` (10 %) and returns a failing result with its components and an Azerbaijani interpretation; `domain/rules/findings.ts → generateFindings` raises it as a finding; and `config/scorecards.ts → DATA_QUALITY_V1` scores the evidence tier of each figure (`evidenceWeight`: VERIFIED 1 · PARTIALLY_VERIFIED 0.65 · ANALYST_ESTIMATE 0.35 · VERBAL 0.25), so a case built on ledger-derived sales cannot reach data-quality grade A. The financial statements carry a `FinancialLens` (`domain/calculations/statements.ts`) so a declared-only view and an adjusted view can be computed side by side.

**To resolve.** A written bank policy on informal turnover: (a) which figure underwrites the loan; (b) the maximum accepted ratio of ledger to declared revenue before the case is escalated or the ledger is disregarded; (c) whether the ledger photographs must be OCR'd and retained as evidence (they were supplied but **not OCR'd** — see `docs/source-inventory.md`); (d) how an amended declaration and a change of accounting basis between years affect the evidence tier.

---

## 22. Two competing internal scoring artefacts

**The question.** Is the existing Yekun Rəy voting algorithm retired, run in parallel, or replaced by the optimised seven-question scorecard?

**Why it matters.** Three artefacts are on the table and the deck never states which survives: the approved 100-point methodology, the notching framework, and an optimised re-weighting that appears once and is then never referenced.

**What the sources say.** Slide 10: "**Do not redevelop or statistically fine-tune the voting algorithm at this stage. Implement a transparent notching framework anchored to bureau score.**" — which is not the same as "stop using it". Slide 28 nevertheless delivers a re-weighted question-level scorecard (Q1.4 15 %, Q1.5 15 %, Q1.6 15 %, Q1.7 25 %, Q2.1 10 %, Q2.2 10 %, Q2.3 10 %, with Q1.2 and Q1.3 dropped) improving GINI from **0.09 to 0.37**, "representing a significant improvement over the current scorecard structure but still not at good levels" — and this artefact is not referenced anywhere in the proposed process. Meanwhile slide 28 finds the Financial (35 %), Purpose (15 %) and Collateral (10 %) sections non-predictive — 60 % of the current weight.

**How the platform behaves.** They are kept strictly separate by design. `config/scorecards.ts → LEGACY_SCORECARD_V1` is documented as "an EXPERT ASSESSMENT, not the Final Internal Rating … must never be merged with the Prometeia rating waterfall" and is evaluated by its own engine (`domain/scoring/legacy-opinion.ts`); the rating waterfall lives in `domain/rating/rating-engine.ts → computeRating` and reads only `ACB_SCALE_*`, `BUSINESS_SCORECARD_PROMETEIA_V1` and the Altman layer. The slide-28 re-weighting is **not implemented**; the evidence for it is recorded in `config/monitoring.ts → CURRENT_SCORECARD_POWER`.

**To resolve.** A governance decision on the target operating model: does the underwriter still produce a 100-point opinion alongside the internal rating (recommended during transition, since the methodology is İH-approved and only İH can change it), and is the slide-28 re-weighting a candidate for a later phase or discarded?

---

## 23. The bad definition is 93 % bureau-driven

**The question.** Can a model anchored on the ACB rating be validated against a target that is itself mostly the ACB rating?

**Why it matters.** The headline discriminatory power quoted for the bureau anchor (GINI 74.8, AUC 87.7, KS 60.23) is computed on a target where 157 of 172 bad flags are "ACB rating Poor". That is close to a tautology and must not be read as predictive power against actual default.

**What the sources say.** "Internal Bad = occurrence of 30+ DPD or NPL during the observation period"; "External Bad = ACB Rating of 'Poor' at application date or at the end of the observation period"; "the final Bad Flag is an OR rule". Across 1,132 approvals: **157 external** bads vs **15 internal**; in the Small development sample, 20 external vs 3 internal. Prometeia acknowledges the limitation ("Bad classification is materially driven by external bureau-based triggers, limiting internal recalibration") and the sample constraint ("212 final observations, 27 bad observations, 3 internal bad hits").

**How the platform behaves.** `config/monitoring.ts → BAD_DEFINITIONS` holds three separately versioned definitions — `INTERNAL_BAD_V1`, `EXTERNAL_BAD_V1` (both `PROMETEIA_PROPOSED`) and `COMBINED_BAD_V1` (`BANK_PROPOSED`, derived as internal OR external) — precisely so a monitoring result is always reported alongside the definition that produced it. The observed benchmark is retained verbatim in `CURRENT_STATE_PERFORMANCE`.

**To resolve.** Agree that internal performance monitoring is reported primarily on `INTERNAL_BAD` once enough history exists, and set the observation window and the minimum bad count at which recalibration becomes meaningful. Until then, treat any GINI computed against the combined definition as diagnostic only.

---

## 24. The bureau's own score bands differ from the proposal's

**The question.** Which band table is authoritative — the ACB report's printed legend or Prometeia's?

**Why it matters.** The pre-screen cut-off of 399 is defined as "the max bound of Satisfactory rating". If the bureau's own boundary for that grade is 599, the cut-off rejects a materially different population.

**What the sources say.** The ACB report legend (`Skor üzrə şərti işarələmə`) prints: `>860–1000` **Əla** · `>750–859` **Yaxşı** · `>600–749` **Orta** · `>200–599` **Kafi** · `>0–199` **Pis**. Prometeia slide 12 prints: 0–149 Poor · 150–399 Satisfactory · 400–699 Medium · 700–859 Good · 860–1000 Excellent. Only the top band agrees. Prometeia's table is labelled "ACB Micro Score", so the two may be different products (Micro vs Individual) — but the deck also says the bureau rating is the worst across Micro *and* Individual, and gives no band table for the latter. Separately, the deck's own narrative contradicts its own table: the text says Poor is "6% of the overall rated ACB sample" and Satisfactory "6.1%", while the table says **10.8 %** and **26.4 %** — the narrative appears to have picked up the Good/Excellent shares. Taken from the table, a 399 cut-off rejects **37.2 %** of rated applicants, not ~12 %.

**How the platform behaves.** `config/rating.ts → ACB_SCALE_PROMETEIA_V1.bands` implements the Prometeia bands with `preScreenRejectBelow: 400`; `ACB_SCALE_ATB_CURRENT_V1` is the same band set with the gate disabled (`preScreenRejectBelow: null`), representing today's manual reading. Both are selectable, versioned scales, and `domain/rating/rating-engine.ts → gradeFromScore` reads whichever scale the case is assessed under.

**To resolve.** Obtain the band definitions directly from ACB for both the Micro and the Individual score, re-quantify the rejection rate from ATB's own distribution, and only then fix the pre-screen cut-off. This is a prerequisite for Q26.

---

## 25. Group exposure is not captured anywhere

**The question.** Where will post-transaction group exposure come from, given that every proposed routing rule keys on it?

**Why it matters.** Segmentation (300K), all routing buckets and the notching-layer selection depend on it. If it is unavailable, the platform silently routes on the financed amount, which is systematically lower — cases land in a lower bucket and a lower authority than intended.

**What the sources say.** Slide 7 NOTE 2: "**Financed amount is used instead of group exposure**, as the current dataset does not include group exposure information. Since group exposure is expected to be higher than the financed amount, applying this analysis with actual group exposure figures would likely shift application counts toward higher amount buckets." The proposed data model (slides 24–25) adds `Group Exposure` — "Total borrower group exposure reported by ACB at the time of the inquiry" — as a new field. The presentation template has **no group-exposure field**: `Kredit tarixçəsi` aggregates only the applicant's own facilities (rows 10–31) plus a thin `Digər əlaqəli şəxslər` block (rows 36–42) carrying only aggregate amounts and counts. The opinion form has a related-borrower table (`Bir-biri ilə əlaqəli borcalanlar qrupu`, per §3.3) but it is a narrative table, not an exposure computation.

**How the platform behaves.** `domain/calculations/bureau.ts → computeGroupExposure` computes post-transaction group exposure from the applicant's and related subjects' facilities plus the applied amount; `config/rating.ts → SEGMENTATION_PROMETEIA_V1.basis = 'POST_TRANSACTION_GROUP_EXPOSURE'` and `config/workflow.ts → routingBasis` both name the basis explicitly, and `WorkflowVersion.routingBasis` also accepts `'FINANCED_AMOUNT'` so the fallback is a visible configuration rather than a silent substitution. `WORKFLOW_ATB_CURRENT_V1.knownAmbiguities` records in Azerbaijani that group exposure is not stored in any system today.

**To resolve.** Confirm the source of truth (ACB group query at inquiry time vs the bank's own related-party register), the definition of the group (Metodologiya §3.3's `bir-biri ilə əlaqəli borcalanlar qrupu`), and whether the applied amount and undrawn limits are included.

---

## 26. Pre-screen: reject, or escalate?

**The question.** When the bureau rating is Poor or Satisfactory, is the application rejected or escalated to the Underwriting Team — and who decides?

**Why it matters.** Poor and Satisfactory together are 37 % of the rated population (Q24). Auto-rejecting them is a strategic change to the bank's addressable market; escalating them all is a large increase in UW workload. The deck states both outcomes and gives no selection rule.

**What the sources say.** The pre-screen box reads "Bureau Rating = Poor OR Satisfactory → **Application Rejected OR Escalated to UW team for further assessment**", with "data should be retained based on the proposed data model". Two further ambiguities sit in the same box: the opposite branch is written "Bureau Rating **≠ Poor OR Satisfactory**", which is logically malformed and must mean `NOT (Poor OR Satisfactory)`, i.e. score ≥ 400; and the notching table's first row routes pre-screen rejections "to the relevant decision authority (KOB KM / SME Committee / Management Board) based on the group exposure", which implies rejections are in fact reviewed, not terminal. The deck also states generally: "rejected applications can be escalated to the next higher approval authority", with the Management Board the only exception.

**How the platform behaves.** `config/rating.ts → ACB_SCALE_PROMETEIA_V1.preScreenAction = 'REJECT'` with `preScreenRejectBelow: 400`, while `config/policy.ts → STOP_FACTORS_V1 → SF_PRESCREEN_BUREAU_SCORE` is seeded `automaticRejection: true`, `escalationAllowed: true` and — importantly — **`enabled: false`**, since it is not ATB policy. `domain/rating/rating-engine.ts → preScreen` returns `'PASS' | 'REJECT' | 'ESCALATE_TO_UW'`, so switching the action is a data change. Pre-screen-rejected cases are routed by `preScreenRejectedAuthority: 'BY_EXPOSURE'` in `config/workflow.ts`. `noScoreAction: 'ESCALATE_TO_UW'` handles applicants with no bureau score at all (106 of 1,132 in the sample).

**To resolve.** A commercial and risk decision, informed by Q24's corrected rejection volumes: reject outright, escalate all, or escalate only above an exposure threshold. Whichever is chosen, the deck's requirement that rejected applications be **stored** is the prerequisite — today "Application Rejected (Not Processed Further, **No Record Kept**)".

---

## 27. Sector-methodology material that could not be used

**The question.** Do the unreadable and un-OCR'd sources contain rules the platform is missing?

**Why it matters.** Several sector methodologies are approved bank practice; if their thresholds are not in the platform, agro, transport and instalment-trade cases are assessed with a materially weaker rule set than the bank intends.

**What the sources say.** Concretely:

- `Aqro kreditləşmənin əsasları. Quşçuluq sahəsi üzrə maliyyə təhlili.ppt` and `Baş Sazişə kredit muqaviləsi.doc` are legacy binary formats and produced **no text**.
- The two ACB extract PDFs and the collateral valuation PDF are **image-only** (306, 40 and 20 bytes of text) — the bureau data and the appraised values are known only as re-keyed into the workbooks.
- Eight photographic archives (business premises, house, registry ledger ×2, monthly sales, cash count, VÖEN/ID, other documents including car documents, purchase waybills and title deeds, plus the collateral photos) were **not OCR'd**. These are the entire primary-evidence layer behind the reconstructed statements.
- The instalment methodology sets thresholds (≥180 days past due = `ümidsiz`; conservative loss = expired+hopeless ÷ longest instalment term booked monthly to the P&L; a **hard stop** — "analysis is not considered possible" — when the per-contract annex data is unavailable) but "no explicit approve/decline cutoffs (e.g. max bad-portfolio %, max >360-day share)".
- The transport annex hard-codes `O = (I − J) / 36` — a 36-month divisor rather than a reference to the term column L. Whether all terms are genuinely 36 months, or the formula is fragile, is unconfirmed.
- The agro norms workbook carries point-in-time market prices ("1 kq ətin qiyməti şərtidir, bazarda müəyyən olunur" — the meat price is indicative, set by the market) with **no refresh cadence defined**.

**How the platform behaves.** Sector rules are honoured where they exist as thresholds: `waivedForSectors: ['Xidmət']` on the debt-to-equity stop and `['Kənd təsərrüfatı']` on the repayment-capacity stop (`config/policy.ts`), and sector turnover-day rules per Q11. The instalment aging buckets and the agro/transport annex models are **not yet implemented** as modules; the photographic evidence is modelled as evidence *types* with a verification tier in `config/scorecards.ts → DATA_QUALITY_V1` (`REGISTRY_LEDGER`, `INVENTORY_LIST`, `COLLATERAL`, `VALUATION`, `CONTRACT`, `INVOICE`), not as parsed data.

**To resolve.** (a) Request the two legacy files in a modern format; (b) request text-layer PDFs of the ACB extracts and the valuation; (c) decide whether ledger OCR is in scope — it is the only way to make the Q21 reconciliation evidential rather than assertive; (d) confirm the instalment-portfolio decision thresholds and the transport annex's 36-month divisor; (e) set a refresh cadence and an owner for the agro norms workbook.
