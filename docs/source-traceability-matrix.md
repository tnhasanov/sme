# Source Traceability Matrix

One row per extracted rule, field, formula or threshold. Every row names the source document and the exact sheet/cell or PDF section it came from, the business purpose it serves, the formula and the rule as written in the source, the evidence quoted, its status, and the repository identifier that implements it.

**How to read the columns**

| Column | Meaning |
|---|---|
| Source | The supplied document (short form; see `docs/source-inventory.md` for the full file identity) |
| Sheet/Page | Sheet + cell, or PDF section / slide number |
| Business Purpose | Why the bank applies this rule |
| Field | The named quantity |
| Formula | The computation exactly as it appears in the source |
| Rule | The threshold, band or decision the formula feeds |
| Evidence | Quoted source text (Azerbaijani preserved) or the cell reference proving the row |
| Status | `CURRENT` · `PROMETEIA_PROPOSED` · `BANK_PROPOSED` · `HISTORICAL` · `INFERRED` · `NEEDS_CONFIRMATION` — the same enum as `types/core.ts → SOURCE_STATUSES` |
| Target Module | The repository path and exported identifier implementing it (all identifiers below were verified against the files) |

**Short names used in the Source column**

- **Metodologiya** = `Kiçik və Orta Biznes krediti sifarişlərinə Anderraytinq Mərkəzi tərəfindən rəy verilməsi Metodologiyası` (PDF)
- **Rəy workbook** = the completed underwriting opinion workbook, `Version 01.11.2025-14.07.2026`
- **Təqdimat** = `Təqdimat 50 000 AZN çox (Əlavə № 2).xlsx`, `memo versiya - 01.10.2025`
- **Prometeia deck** = `ATB_ERM_Diagnostic_Status_Meeting.pdf`, 07.08.2026
- **AKBÇ təlimatı** = `AKBÇ ı oxunması təlimatı.docx`
- **Tracker** = `Daxil olan sifarişlər ATB 07.2026.xlsx`

**Anonymisation rule (enforced).** No real personal name, VÖEN/FİN, phone number, address or account number appears in this matrix. The applicant of the worked example is **[BORROWER]**. Worked-example figures are retained only where they prove a formula's behaviour.

---

## 1. Yekun Rəy — model structure, weights and bands

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Metodologiya | §3.6 | Fix the assessment framework: 5 criteria, 100 points | Criterion weights | Credit history 20 + Business 20 + Financial 35 + Purpose 15 + Collateral 10 | Total max 100 points | Identical in Rəy workbook `Rəy forması` D111:D115 | CURRENT | `config/scorecards.ts → LEGACY_SCORECARD_V1.categories[].weight` |
| Rəy workbook | `Rəy forması` J109 | Enforce that any triggered stop factor voids the opinion | Total score | `J109 = IF(OR(J32=0, J44=0, J58=0, J86=0), 0, SUM(J32+J44+J58+J86+J93))` | If any of criteria 1–4 is zero → total 0. Collateral (J93) is deliberately outside the OR-guard | Metodologiya §8.5: collateral is not a stop factor | CURRENT | `domain/scoring/legacy-opinion.ts → evaluateLegacyOpinion` (`participatesInGlobalStop`) |
| Rəy workbook | `Rəy forması` I109 | Translate points into a risk label | Risk band | `I109 = IF(J109>=86,"Aşağı riskli", IF(J109>=71,"Orta aşağı riskli", IF(J109>=56,"Orta riskli", IF(J109>=41,"Orta yüksək riskli","Yüksək riskli"))))` | 86–100 Low · 71–85 Medium-low · 56–70 Medium · 41–55 Medium-high · 0–40 High. `>=` cutoffs; no rounding (worked total 59.665) | Metodologiya §3.7, same table | CURRENT | `config/scorecards.ts → LEGACY_SCORECARD_V1.bands` |
| Rəy workbook | `Rəy forması` F32/I31 | Give each criterion its own risk label | Criterion band | `I31 = J32/J31`; `F32 = IF(I31>=86%,…)` — the same ladder on percent | Band applied per criterion on achieved % | Cell formulas | CURRENT | `domain/scoring/legacy-opinion.ts` (`bandFor` on `achievedPct`) |
| Metodologiya | §3.1 | Match opinion depth to approval authority | Opinion format | — | `Geniş forma` (Əlavə № 2) for İH submissions; `Kiçik forma` (Əlavə № 1) for other authorities; **identical criteria**, shorter commentary | "qiymətləndirmə meyarları eynidir" | CURRENT | `domain/opinion/opinion-builder.ts → buildOpinionDraft` |
| Metodologiya | §3.5 | Keep the opinion independent of RMD's model | SME Scoring score/category | — | Recorded on the form, informational only; does not bind the opinion | §3.5 | CURRENT | Recorded field; not an input to `evaluateLegacyOpinion` |
| Prometeia deck | slide 27 (annex) | Consultant's restatement of the same weights | Voting-algorithm weights | Category maxima 20/20/35/15/10; question weights as in sections 2–6 below | Confirms the workbook, adds English question names | Slide 27 table | CURRENT (description of as-is) | `config/monitoring.ts → CURRENT_SCORECARD_POWER` |

---

## 2. Criterion 1 — Kredit tarixçəsi (Credit history), 20 points

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Rəy workbook | `Rəy forması` J32 | Aggregate credit-history answers, honouring two stop factors and the no-history cap | Criterion total | `J32 = IF(AND(F33="Mövcud deyil", F34="Bəli"), J31*60%, IF(OR(J34=0, J37=0), 0, SUM(J34:J39)))` | Stop if J34=0 or J37=0; cap at 60 % (12/20) when no history exists | Metodologiya §4.9–4.10 | CURRENT | `config/scorecards.ts → LEGACY_SCORECARD_V1.categories.CREDIT_HISTORY` (`noHistoryCapPct: 60`) |
| Rəy workbook | `Rəy forması` J34 / B34 | Ensure every business-connected person's bureau record is on file | AKB extracts obtained — **35 % = 7 pts** | `J34 = IF(F34="bəli", J31*35%, 0)` | "Bəli"=7, "Xeyr"=0 → **STOP FACTOR** | Metodologiya §4.3: extracts required for owners, shareholders, decision-makers, managers, persons visible in business documents, and anyone likely to have borrowed for the business | CURRENT | `…LEGACY_SCORECARD_V1 → AKB_EXTRACTS_OBTAINED` (`stopRule.when='ZERO'`) |
| Rəy workbook | `Rəy forması` J35 / B35 | Detect undisclosed parallel applications | Unjustified recent inquiries — **5 % = 1 pt** | `J35 = IF(F35="xeyr", J31*5%, 0)` | "Xeyr" (none) = 1; "Bəli" = 0. Mainly the last 1 month | Metodologiya §4.4; AKBÇ təlimatı §2.1 on `Kredit müraciəti` inquiries | CURRENT | `…→ UNJUSTIFIED_RECENT_INQUIRIES` |
| Rəy workbook | `Rəy forması` J36 / B36 | Price mild payment indiscipline | Unjustified 0–30 day DPD — **10 % = 2 pts** | `J36 = IF(F36="xeyr", J31*10%, 0)` | "Xeyr"=2; "Bəli"=0 (not a stop) | Cell formula | CURRENT | `…→ UNJUSTIFIED_DPD_0_30` |
| Rəy workbook | `Rəy forması` J37 / B37 | Block cases with structural payment failure | Unjustified 30+ day DPD — **20 % = 4 pts** | `J37 = IF(F37="xeyr", J31*20%, 0)` | "Xeyr"=4; "Bəli"=0 → **STOP FACTOR**. If documented/justified, answer "Xeyr" and explain in the comment field | Metodologiya §4.6 | CURRENT | `…→ UNJUSTIFIED_DPD_30_PLUS` (`stopRule.when='ZERO'`) |
| Rəy workbook | `Rəy forması` J38; `AKBÇ təhlili` E68–E70 | Distinguish real repayment from loan-by-loan refinancing | Loans closed by monthly instalments — **15 % = 3 pts** | `J38 = IF(F38="bəli", J31*15%, 0)`; benchmark `E70 = E69/E68` where `E68 = D26+D51` (total borrowed) and `E69 = L26+L51` (closed by instalments) | **>50 %** of original principal repaid by instalments = `qənaətbəxş` | Metodologiya §4.7 | CURRENT | `config/policy.ts → INSTALMENT_REPAYMENT_SHARE` (GT 0.5); `domain/calculations/bureau.ts → analyseRefinancing` (`instalmentRepaymentShare`) |
| Rəy workbook | `Rəy forması` J39; `Aylıq ödəniş` row 55 | Prevent leverage creep beyond historically serviced levels | Debt-burden increase — **15 % = 3 pts** | `J39 = IF(F39="xeyr", J31*15%, 0)`; the `Aylıq ödəniş` sheet sums all parallel monthly payments per calendar month (186 columns from 2016-01) | Increase of the new payment vs the max parallel payments serviced in the last **6–12 months** — **>50 % is undesirable** | Metodologiya §4.8 | CURRENT | `config/policy.ts → DEBT_BURDEN_INCREASE` (LTE 0.5); `domain/calculations/bureau.ts → debtBurdenIncrease` |
| Metodologiya | §4.9–4.10 | Avoid rewarding an absent credit history | No-history handling | `AND(F33="Mövcud deyil", F34="Bəli") → 20 × 60 % = 12` | Only sub-item 1 is assessed; criterion capped at 12/20 ("orta riskli"). If extracts are missing the stop factor still applies | §4.10 | CURRENT | `…CREDIT_HISTORY.noHistoryCapPct = 60` |
| AKBÇ təlimatı | §"Refinancing detection" | Judge how past loans were actually closed | Refinancing chain | Match each closure date against other loans' disbursement dates (same day or nearby); analyse from the oldest index backwards | Closing **30–40 %** of a loan with a new loan "is not negative in itself"; if **less than half** of term/amount was paid on schedule → liquidity problem. A tail-end closure (e.g. 10 of 12 months paid) is **not** loan-by-loan closure | Worked chain in the instruction | CURRENT | `domain/calculations/bureau.ts → REFINANCE_WINDOW_DAYS = 45`, `REFINANCE_COVERAGE_MIN = 0.6` |
| AKBÇ təlimatı | §"Header" | Prevent disbursing against a stale bureau picture | Report freshness | — | Use a freshly pulled AKBÇ; **refresh mandatorily just before signing**; if liabilities grew since analysis, do not disburse | "Borcalan haqqında tarixçənin açıldığı tarix" / refresh rule | CURRENT | `domain/rules/findings.ts` (bureau staleness finding) |
| ACB report | DPD legend | Normalise bureau delinquency history | 24-month DPD codes | `-` no data · `0` · `30` (1–30) · `90` (31–90) · `180` (91–180) · `360` (181–360) · `361+` | Bucketed months only — exact DPD per month is not available from the extract | `Tarixçə üzrə şərti işarələmə` | CURRENT | `domain/calculations/bureau.ts → summariseBureau` (`currentMaxDpd`) |

---

## 3. Criterion 2 — Biznes fəaliyyəti (Business activity), 20 points

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Rəy workbook | `Rəy forması` J44 | Average three manually scored sub-blocks, with one stop condition | Criterion total | `J44 = IF(OR(J47<=40), 0, SUM((J47+J51+J55)/3) * 20/100)` | Each sub-block scored 0–100 by the underwriter; mean scaled to 20 points | Cell formula | CURRENT | `…LEGACY_SCORECARD_V1.categories.BUSINESS` (`aggregation: 'MEAN_OF_MANUAL_SCORES'`) |
| Rəy workbook + Metodologiya | J47 / §5.1.1 | Confirm the business really belongs to the applicant | 2.1 Business relationship to the applicant — **33.34 %** of the mean | manual 0–100 | **STOP FACTOR: score ≤ 40 zeroes the criterion** → whole opinion 0. Triggered when ownership is not confirmed by documents/evidence/facts, or period income does not match the applicant's social standing | Evidence catalogue accepted "together or separately": VÖEN; legal-entity/entrepreneur documents; premises ownership or lease; till receipt; purchase contracts / transfers / waybills (`qaimə`); cargo payment receipts; entrepreneur account turnover; sales contracts and receipts; fixed-asset ownership/purchase/invoice/lease documents; business card or advertising number; internet and social-media pages | CURRENT | `…→ BUSINESS_OWNERSHIP_LINK` (`stopRule.when='LTE', value:40`) |
| Metodologiya | §5.1.2 | Score tenure and management model | 2.2 Structure & management expertise — **33.33 %** | manual 0–100 | Official tenure: low risk 11–15+/6–10/3–5 yrs; medium 1–2 yrs; high <1 yr. Informal tenure: low 11–15+/6–10; medium 3–5; high 1–2 or <1. Management scored across three ownership archetypes (sole owner; equal partners; capital-owner plus operationally-essential partner) | §5.1.2 anchor tables | CURRENT | `…→ STRUCTURE_AND_MANAGEMENT` |
| Metodologiya | §5.1.3 | Score record-keeping quality | 2.3 Documentation & reporting — **33.33 %** | manual 0–100 | Band selection with a matching score, explicitly to limit subjectivity | §5.1.3 | CURRENT | `…→ DOCUMENTATION_REPORTING` |
| Prometeia deck | slide 27 | Consultant's restatement | Question weights | 2.1 / 2.2 / 2.3 at 33 % each | Matches the workbook's equal-mean treatment | Slide 27 | CURRENT (as-is description) | `config/monitoring.ts → CURRENT_SCORECARD_POWER` |
| Prometeia deck | slide 29 (current-state guideline) | Knock-out for unverifiable ownership | Area 1 High Risk | — | Marked "**(KNOCK OUT CRITERIA – WORST RATING)**" | Slide 29 | CURRENT (as-is) — dropped in the proposed matrix, see open question 12 | `config/rating.ts → WORST_RATING_V1` (status `NEEDS_CONFIRMATION`) |

---

## 4. Criterion 3 — Maliyyə məlumatları (Financial information), 35 points

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Rəy workbook | `Rəy forması` J58 | Average five equally weighted financial sub-items, with two stop conditions | Criterion total | `J58 = IF(OR(J63=0, J69=0), 0, (J63+J69+J74+J78+J83)/5) * 35/100` | Metodologiya §6.1 states the five items have equal influence; §6.7 phrases it as 7 points each | Cell formula | CURRENT | `…LEGACY_SCORECARD_V1.categories.FINANCIAL` |
| Metodologiya | §6.2 | Test capital adequacy of the deal | 3.1 Balans — **20 %** | manual 0–100 | **STOP FACTOR:** `Kapitala nəzərən borclanma əmsalı` > 100 % → item 0 → criterion 0 → opinion 0. **Waived for the `Xidmət` (services) sector** on the basis of other factors. Remedy: propose a reduced loan amount | §6.2; the workbook literally blanks the norm for services: `U31 = IF(…F11="Xidmət","",1)` | CURRENT | `…→ BALANCE_SHEET` (`stopRule.waivedForSectors: ['Xidmət']`); `config/policy.ts → DEBT_TO_EQUITY_INCL_NEW` |
| Metodologiya | §6.3 | Test affordability against retained profit | 3.2 MZH — **20 %** | manual 0–100 | **STOP FACTOR:** breach of the `Bölüşdürülməmiş mənfəətin aylıq ödənişə nisbəti` norm (equivalently the monthly-interest-to-payment ratio) → item 0 → criterion 0 → opinion 0. **Waived for `Kənd təsərrüfatı`** when the forecast cash-flow statement demonstrates capacity | §6.3; the numeric norm is not stated in the PDF — see section 9 and open question 4 | CURRENT (rule) / NEEDS_CONFIRMATION (value) | `…→ INCOME_STATEMENT` (`stopRule.waivedForSectors: ['Kənd təsərrüfatı']`) |
| Metodologiya | §6.4 | Assess cash-flow quality and DSCR | 3.3 Nağd pul axınları — **20 %** | manual 0–100 | No stop. Current and forecast DSCR are evaluated; owner contributions/withdrawals must be evidenced | §6.4 evidence anchors | CURRENT | `…→ CASH_FLOWS` |
| Metodologiya | §6.5 | Reconcile the three statements against each other | 3.4 Statement comparison — **20 %** | manual 0–100 | Three cross-checks: (a) MZH sales ↔ receivable growth ↔ cash inflows; (b) MZH COGS ↔ supplier payments ↔ Δinventory ↔ Δsupplier liability; (c) period retained profit ↔ capital growth ↔ out-of-business spending. Full/mostly consistent → low/medium; only partially → high risk | §6.5 | CURRENT | `…→ STATEMENT_COMPARISON`; `domain/calculations/cross-checks.ts → runCrossChecks` (`SALES_TO_CASH`, `COGS_TO_PURCHASES`, `EQUITY_RECONCILIATION`) |
| Metodologiya | §6.6 | Compare ratios against norms | 3.5 Maliyyə əmsalları — **20 %** | manual 0–100 | "**22 fərqli maliyyə əmsalı**" for capital stability, liquidity and profitability | §6.6 — the `Əmsallar` sheet actually carries 23 labelled rows (see open question 10) | CURRENT | `…→ RATIOS`; `domain/calculations/ratios.ts → computeRatios` |
| Təqdimat | `Müqayisəli təhlil` S61 / T61 | Automated receivables reconciliation | Debitor cross-check | `S61 = MZH!Q16 − 'Pul axını_cari'!O16 − Balans!L9` | Prints "**Uyğunsuzluq var.**" when the implied receivable is negative | Sheet formula (carries an off-by-one defect, see open question 17) | CURRENT | `domain/calculations/cross-checks.ts → SALES_TO_CASH` (tolerance 10 %) |
| Təqdimat | `Müqayisəli təhlil` S65 / T65 | Automated inventory reconciliation | Ehtiyat cross-check | `S65 = 'Pul axını_cari'!O43 − MZH!Q30 − Balans!N11 − Balans!G11` | Same "Uyğunsuzluq var." narrative test | Sheet formula (same off-by-one defect) | CURRENT | `domain/calculations/cross-checks.ts → COGS_TO_PURCHASES`, `INVENTORY_ROLLFORWARD` |
| Rəy workbook | `Cash indirect` C33/C35/C36 | Third, indirect proof of cash | Indirect cash reconciliation | `C33 = C3 + C28 + C30 − C31` compared with `C35 = 'Balans chart'!C7` and `C36 = 'Cash flow cari'!N78` | Cash that *should* exist at period end vs balance-sheet cash vs direct-method cash | Sheet formulas | CURRENT | `domain/calculations/cross-checks.ts → INDIRECT_CASH_FLOW` |
| Metodologiya | §6.2–6.4 | Rank the reliability of every figure | Evidence hierarchy | — | Low risk: tax declaration / bank transfers / till / barcode / computer records / written records. Medium: derived from purchase documents, WAGM margin table, physical count, market-consistent verbal costs. High: verbal only, till-cash at the analysis hour, market-minimum margins, unregistered data | §6.2 (A), §6.3 (B), §6.4 (C, D) | CURRENT | `config/scorecards.ts → DATA_QUALITY_V1.evidenceWeight` (VERIFIED 1 · PARTIALLY_VERIFIED 0.65 · ANALYST_ESTIMATE 0.35 · VERBAL 0.25 · MISSING/CONTRADICTORY 0); `domain/rules/data-quality.ts → computeDataQuality` |

---

## 5. Criterion 4 — Kreditin təyinatı (Loan purpose), 15 points

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Rəy workbook | `Rəy forması` J86 | Sum the three purpose answers with a joint stop | Criterion total | `J86 = IF(AND(J88=0, J89=0), 0, SUM(J87:J89))` | Zeroed only when efficiency **and** control are both zero; either one alone does not | Metodologiya §7.5 | CURRENT | `…LEGACY_SCORECARD_V1.categories.PURPOSE` (`jointStopComponents: ['PURPOSE_EFFICIENCY','PURPOSE_CONTROL']`) |
| Rəy workbook | `Rəy forması` J87 / B87 | Require documentary support for the stated purpose | Supporting documents — **25 % = 3.75 pts** | `J87 = IF(F87="Var", J85*25%, IF(F87="Qismən var", J85*12.5%, 0))` | `Var`=3.75 · `Qismən var`=1.875 · else 0 | Cell formula | CURRENT | `…→ PURPOSE_DOCUMENTS` (achievement 1 / 0.5 / 0) |
| Rəy workbook | `Rəy forması` J88 / B88 | Judge whether the money will actually help the business | Purpose efficiency — **50 % = 7.5 pts** | `J88 = IF(F88="Səmərəlidir", J85*50%, IF(F88="Qismən səmərəlidir", J85*25%, IF(F88="Səmərəsizdir", J85*0, 0)))` | `Səmərəlidir`=7.5 · `Qismən səmərəlidir`=3.75 · `Səmərəsizdir`=0 · **`Səmərəsi ölçülməyib`=0 via fall-through** | `Data validations` dropdown contains `Səmərəsi ölçülməyib` | CURRENT (mechanics) / NEEDS_CONFIRMATION (whether "not measured" should equal "inefficient" — open question 13) | `…→ PURPOSE_EFFICIENCY` (option `NOT_MEASURED`, achievement 0, `adverse: true`) |
| Rəy workbook | `Rəy forması` J89 / B89 | Ensure use of proceeds can be monitored | Control possibility — **25 % = 3.75 pts** | `J89 = IF(F89="İmkan var", J85*25%, IF(F89="Qismən imkan var", J85*12.5%, 0))` | `İmkan var`=3.75 · `Qismən imkan var`=1.875 · `İmkan yoxdur`=0 | Cell formula | CURRENT | `…→ PURPOSE_CONTROL` |
| Rəy workbook | `Data validations` | Post-disbursement monitoring vocabulary | Purpose-use states | — | `Təyinat üzrə istifadə edib` / `qismən istifadə edib` / `istifadə etməyib` | Dropdown list | CURRENT | `config/monitoring.ts` (purpose-monitoring outcome); `domain/rules/findings.ts` |

---

## 6. Criterion 5 — Təminatın təhlili (Collateral), 10 points — never a stop factor

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Rəy workbook | `Rəy forması` J93 | Score collateral in two modes | Criterion total | `J93 = IF(F94="", (J92*J96)*0.33333, IF(F94="var", SUM(J94:J96), IF(F94="qismən var", SUM(J94:J96), IF(F94="yoxdur", SUM(J94:J96)))))` | With real-estate collateral: property items earn at most 7 of 10, guarantor 3. Without real estate: score only on guarantors (0 % = 0, 50 % = 5, 100 % = 10) | Metodologiya §8.5; the blank-vs-`yoxdur` asymmetry is a defect — see open question 15 | CURRENT (mechanics) / NEEDS_CONFIRMATION (the asymmetry) | `…LEGACY_SCORECARD_V1.categories.COLLATERAL` (`participatesInGlobalStop: false`) |
| Rəy workbook | `Rəy forması` J94 / B94 | Align the pledgor's interest with the borrower's | Collateral owner relation — **50 % = 5 pts** | `J94 = IF(F94="var", J92*50%, IF(F94="Qismən var", J92*25%, IF(F94="yoxdur", J92*0%, "")))` | `Var`=5 · `Qismən var`=2.5 · `Yoxdur`=0 | Cell formula | CURRENT | `…→ COLLATERAL_OWNER_RELATION` |
| Rəy workbook | `Rəy forması` J95 / B95 | Price the quality of the property | Real-estate risk grade — **20 % = 2 pts** | `J95 = IF(F95="Aşağı riskli", J92*20%, IF(F95="Orta riskli", J92*10%, 0))` | `Aşağı riskli`=2 · `Orta riskli`=1 · else 0 | Cell formula | CURRENT | `…→ COLLATERAL_RISK_GRADE` |
| Rəy workbook | `Rəy forması` J96 / B96 | Price guarantor quality | Guarantor suitability — **30 % = 3 pts** | `J96 = IF(F96="Uyğundur", J92*30%, IF(F96="Qismən uyğundur", J92*15%, IF(F96="Uyğun deyil", 0, "")))` | `Uyğundur`=3 · `Qismən uyğundur`=1.5 · `Uyğun deyil`=0 | Cell formula | CURRENT | `…→ GUARANTOR_SUITABILITY` |
| Rəy workbook | `Rəy forması` collateral register | Record and total the security | Collateral schedule | `SUM` over `Bazar dəyəri` and `Likvid dəyəri` | Fields: type, status (`Yeni`/`Mövcud`/`Mövcud və təklif olunan`), address, owner, valuation date and company, market value, liquidation value; classification into `Təminat səviyyəsi` and `Təminat qrupu` (`Təminatsız`, `Üçüncü/Dördüncü/Beşinci qrup təminat`) | Narrative cites "AMB-nın təminat kredit nisbəti tələbi" (Central Bank collateral/loan requirement) — the exact percentage is not in the sources | CURRENT (fields) / INFERRED (the coverage threshold) | `domain/calculations/collateral.ts → valueCollateral, computeCollateralCoverage`; `config/policy.ts → COLLATERAL_COVERAGE` (GTE 1.0, `INFERRED`) |
| Təqdimat | `Sifarişçi…` L41 / L44 | The de-facto LTV metric the routing rules would consume | Collateral coverage | `L41 = IFERROR(E41/H41,"")` (existing loans / last liquid value); `H44 = D44−E44+F44`; `L44 = IFERROR(H44/H41,"")` (total resulting debt / last liquid value) | Uses **liquid** value, not market value; no pass/fail flag exists in the workbook | Sheet formulas | CURRENT | `domain/calculations/collateral.ts → computeCollateralCoverage`; `domain/workflow/routing-engine.ts` (`eligibleCollateralCoverage`) |
| Inferred | — | Convert forced-sale values into eligible collateral | Haircuts | eligible = forced-sale value × (1 − haircut) | Residential RE 0 % · Commercial RE 10 % · Land 25 % · Equipment 30 % · Vehicle 25 % · Cash deposit 0 % · Receivables 50 % · Inventory 50 %; personal and corporate guarantees **ineligible** | No haircut table exists in any source — the sources use `Likvid dəyər` directly | INFERRED | `config/policy.ts → COLLATERAL_HAIRCUTS_V1` |

---

## 7. Stop factors

The six methodology stop factors, plus the proposed bureau pre-screen. All are implemented as data in `config/policy.ts → STOP_FACTORS_V1` and evaluated by `domain/rules/stop-factors.ts → evaluateStopFactors`; each row's `evaluator` key names the function.

| # | Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Metodologiya §4.3, §4.10 | `Rəy forması` J32 (`J34=0`) | No objective assessment is possible without the connected persons' bureau records | Bureau extracts of connected persons | `J34 = 0` | Credit-history criterion = 0 → opinion = 0 | "Biznesə aidiyyəti olan şəxslərin AKB çıxarışlarının alınması" = Xeyr | CURRENT | `STOP_FACTORS_V1 → SF_AKB_EXTRACTS_MISSING` (`evaluator: 'akbExtractsMissing'`) |
| 2 | Metodologiya §4.6 | `Rəy forması` J32 (`J37=0`) | Structural payment failure | Unjustified 30+ day DPD | `J37 = 0` | Credit-history criterion = 0 → opinion = 0. Documented justification ⇒ answer "Xeyr" + comment | §4.6 | CURRENT | `SF_UNJUSTIFIED_DPD_30_PLUS` (`unjustifiedDpd30Plus`) |
| 3 | Metodologiya §5.1.1 | `Rəy forması` J44 (`J47<=40`) | The applicant must actually own the business, and income must fit their social standing | Ownership not evidenced | `IF(OR(J47<=40), 0, …)` | Business criterion = 0 → opinion = 0 | §5.1.1; note the guard covers **only** sub-block 2.1 (open question 14) | CURRENT | `SF_OWNERSHIP_NOT_CONFIRMED` (`ownershipNotConfirmed`) |
| 4 | Metodologiya §6.2 | `Rəy forması` J58 (`J63=0`); `Balans` T31 | Capital adequacy after the new facility | Debt-to-equity incl. new loan > 100 % | `T31 = ('Sifarişçi…'!V11 + Balans!L4 − 'Kredit tarixçəsi'!V33) / Balans!L22` | > 1.00 → financial criterion 0 → opinion 0. **Waived for `Xidmət`** | Norm cell `U31 = IF(…F11="Xidmət","",1)` | CURRENT | `SF_DEBT_TO_EQUITY_OVER_100` (`debtToEquityOver100`, `waivedForSectors: ['Xidmət']`) |
| 5 | Metodologiya §6.3 | `Rəy forması` J58 (`J69=0`); `MZH` Q10 | Affordability from retained profit | Repayment-capacity norm breached | `Q10 = Q8/Q6` (ATB post-deal monthly payment / forecast repayment capacity) | **> 0.8 → stop.** Waived for `Kənd təsərrüfatı` when the forecast cash flow shows capacity | The 0.8 coefficient is cited in the opinion narrative as a requirement of the separate *KOB kreditlərinin verilməsi Metodologiyası*, which was **not supplied** | NEEDS_CONFIRMATION | `SF_REPAYMENT_CAPACITY_NORM` (`repaymentCapacityNorm`, `waivedForSectors: ['Kənd təsərrüfatı']`) |
| 6 | Metodologiya §7.5 | `Rəy forması` J86 | An unmeasurable and uncontrollable purpose cannot be underwritten | Efficiency = 0 **AND** control = 0 | `J86 = IF(AND(J88=0, J89=0), 0, …)` | Purpose criterion = 0 → opinion = 0 | §7.5 | CURRENT | `SF_PURPOSE_NOT_ASSESSABLE` (`purposeNotAssessable`) |
| — | Metodologiya §8.5 | `Rəy forması` J109 | Collateral must not veto an otherwise sound case | Collateral | `J93` excluded from the `OR` guard | Explicitly **not** a stop factor | §8.5 | CURRENT | `LEGACY_SCORECARD_V1.categories.COLLATERAL.participatesInGlobalStop = false` |
| 7 | Prometeia deck slide 12 | — | Reject the weakest bureau grades before analysis begins | ACB Micro Score ≤ 399 | — | "we recommend to use the score threshold as **399** … for the rejection criteria to be used in the prescreening process" | Slide 12 | PROMETEIA_PROPOSED | `SF_PRESCREEN_BUREAU_SCORE` (`prescreenBureauScore`, `enabled: false`, `automaticRejection: true`) |
| — | Prometeia deck slides 18/20 | — | Governance of stop-factor cases | Stop-factor escalation | — | "Any application that triggers a Stop Factor is automatically rejected, and **no escalation route is available except to the Management Board**" (V2: "except to the **Big Committee**") | Slides 18, 20 | PROMETEIA_PROPOSED | `config/workflow.ts → stopFactorEscalationAuthority` (`MANAGEMENT_BOARD` in V1, `BIG_COMMITTEE` in V2) |

---

## 8. Financial-ratio norms

All rows are evaluated by `domain/rules/policy-engine.ts → evaluatePolicy` against `config/policy.ts → POLICY_ATB_CURRENT_V1`; the metric keys are produced by `domain/calculations/ratios.ts → computeRatios` unless noted.

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule (Norma) | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Rəy workbook | `Əmsallar` (Current Ratio); Təqdimat `Balans` T32 | Short-term liquidity | Cari likvidlik əmsalı | `='Balans chart'!C6/'Balans chart'!C43`; Təqdimat `T32 = E4/L5` | **≥ 1.50** | Norma column = 1.50 on both sheets | CURRENT | `config/policy.ts → RATIO_CURRENT_RATIO` (GTE 1.5, `POLICY_EXCEPTION`) |
| Rəy workbook | `Əmsallar` (Quick Ratio) | Liquidity excluding stock | Ani likvidlik əmsalı | `=('Balans chart'!C6−C10−C11−C12−C13)/'Balans chart'!C43` | **≥ 1.00** | Definition text says "(Cari aktivlər − mal qalığı) / cari öhdəliklər" but the formula subtracts **all** inventory classes (open question 8) | CURRENT (norm) / NEEDS_CONFIRMATION (definition) | `RATIO_QUICK_RATIO` (GTE 1.0, `WARNING`) |
| Rəy workbook | `Əmsallar` (DSCR cari) | Historic debt-service capacity | Borcun ödənilmə əmsalı — cari | `=('Cash flow cari'!O76+O75)/(O75+O100)`; monthly row `C109 = IFERROR((C76+C75)/(C75+C100),"")` | **≥ 1.50** | Norma 1.50 | CURRENT | `DSCR_CURRENT` (GTE 1.5) |
| Rəy workbook | `Əmsallar` (DSCR proqnoz); `Cash flow cari` N10 | Debt-service capacity including the new facility | Borcun ödənilmə əmsalı — proqnoz | `=('Cash flow proqnoz'!O76+O75)/(O75+O100)`; `N10 = (H7+H8)/(H9+H8+H10)` | **≥ 1.50** | "BÖƏ yeni kredit verildiyi halda" | CURRENT | `DSCR_FORECAST` (metric `dscrPostTransaction`) |
| Rəy workbook | `Əmsallar` (Debt to Equity); Təqdimat `Balans` T31 | Capital adequacy | Kapitala nəzərən borclanma əmsalı | `=(('Balans chart'!C43+C44+'Kredit Tarixçəsi'!E59)−('Kredit Tarixçəsi'!F59))/'Balans chart'!C45` | **≤ 1.00**; breach is a stop factor; **waived for `Xidmət`** | `U31 = IF(…="Xidmət","",1)` | CURRENT | `DEBT_TO_EQUITY_INCL_NEW` (LTE 1.0, `STOP`, `waivedForSectors: ['Xidmət']`) |
| Rəy workbook | `Əmsallar` (Leverage); Təqdimat `Balans` AA33 | Total leverage | Leverec — Aktivlərin kapitala nisbəti | `='Balans chart'!C5/'Balans chart'!C45`; `AA33 = E27/L22` | **≤ 2.00** | Norma 2 on both | CURRENT | `LEVERAGE_ASSETS_TO_EQUITY` (LTE 2.0) |
| Təqdimat | `Balans` AA32 | Bank-debt concentration in capital | Gearing | `AA32 = (L6+L7)/L22` | **≤ 0.5** | Present on the `Balans` panel only; the `Əmsallar` sheet lists Gearing with an **empty** norm (open question 9). The Təqdimat sector table separately prints `Gearing = max 30%` | NEEDS_CONFIRMATION | `GEARING` (LTE 0.5, status `NEEDS_CONFIRMATION`) |
| Təqdimat | `Balans` T35 (and Rəy `Əmsallar` ROA) | Asset profitability | Aktivlərin mənfəətliliyi (ROA) | Rəy: `='MZH chart'!C15/'Balans chart'!C5` (retained profit); Təqdimat: `T35 = MZH!Q6*12/Balans!E27` (annualised net profit) | **≥ 5 %** | Two different numerators for the same norm (open question 7) | CURRENT (norm) / NEEDS_CONFIRMATION (numerator) | `ROA` (GTE 0.05, `INFO`) |
| Təqdimat | `Balans` T36 (and Rəy `Əmsallar` ROE) | Equity profitability | Kapitalın mənfəətliliyi (ROE) | Rəy: `='MZH chart'!C15/'Balans chart'!C45`; Təqdimat: `T36 = MZH!Q6*12/L22` | **≥ 8 %** | Same numerator conflict | CURRENT / NEEDS_CONFIRMATION | `ROE` (GTE 0.08, `INFO`) |
| Rəy workbook | `Əmsallar` (Asset Turnover) | Asset efficiency | Aktivlərin dövretməsi | `='MZH chart'!C2/'Balans chart'!C5` | **≥ 1.00** | Norma 1.00 | CURRENT | `ASSET_TURNOVER` (GTE 1.0, `INFO`) |
| Təqdimat | `Balans` AA31 | Working-capital efficiency | İşlək kapitalın dövretməsi | `AA31 = MZH!Q16/(Balans!E4 − Balans!L5)` | **≥ 1.5** ( `Əmsallar` sector table prints "min 1.5") | Norma 1.5 | CURRENT | `WORKING_CAPITAL_TURNOVER` (GTE 1.5, `INFO`) |
| Təqdimat | `Balans` T38 | Annual cash coverage of bank debt | Öhdəliklərin nağd ödənə bilmə əmsalı (il ərzində) | `T38 = ('Pul axını_proqnoz'!O100 + 'Pul axını_proqnoz'!O108) / 'Kredit tarixçəsi'!J59` | **≥ 0.35** | Norma 0.35; the sector table repeats `J = 0.35` on every row | CURRENT | `CASH_COVERAGE_OF_OBLIGATIONS` (GTE 0.35) |
| Təqdimat | `Balans` T37 | No month may run out of cash | Sərbəst proqnoz pul axını | `T37 = MIN('Pul axını_proqnoz'!C108:N108)` | **≥ 0** — "Nağd ödəmə qabiliyyəti olmalıdır"; the sector table prints `I = "Mənfi olmamalıdır"` | Norm cell | CURRENT | `MIN_FORECAST_FREE_CASH` (GTE 0, `POLICY_EXCEPTION`) |
| Təqdimat | `MZH` Q6–Q10 | The affordability gate | Aylıq ödəniş / proqnoz ödəmə qabiliyyəti | `Q6 = (O71+O72+O77+O78+O88) − 'Kredit tarixçəsi'!L58`; `Q8 = 'Kredit tarixçəsi'!L57`; `Q10 = IFERROR(Q8/Q6,"")` | **≤ 0.8** (stop factor #5). The `Əmsallar` sector table prints the same metric with norm **0.7** — the two disagree (open question 4) | Worked case: `Q10 = 0.9415`, i.e. the deal fails the bank's own norm and nothing in the workbook flags it | NEEDS_CONFIRMATION | `PAYMENT_TO_CAPACITY` (LTE 0.8, `STOP`) ; `domain/calculations/repayment-capacity.ts → computeRepaymentCapacity` (`paymentToCapacity`) |
| Təqdimat | `MZH` E12/J12/Q12 | Group-wide affordability | Bütün ödənişlərin bölüşdürülməmiş mənfəətlə ödənilmə əmsalı | `E12 = O71+O72+O77+O78+O88`; `J12 = 'Kredit tarixçəsi'!L59`; `Q12 = J12/E12` | Norm not stated in any source — seeded at **≤ 0.8** by analogy | Sheet formula | INFERRED | `ALL_PAYMENTS_TO_RETAINED_PROFIT` (LTE 0.8, status `INFERRED`); `repayment-capacity.ts` (`allPaymentsToRetainedProfit`) |
| Metodologiya §4.7 | `AKBÇ təhlili` E70 | Detect refinancing carousels | Kreditlərin aylıq ödənişlərlə bağlanma payı | `E70 = E69/E68` | **> 50 %** = satisfactory | §4.7 | CURRENT | `INSTALMENT_REPAYMENT_SHARE` (GT 0.5) |
| Metodologiya §4.8 | `Aylıq ödəniş` row 55 | Cap leverage growth | Aylıq borc yükünün artımı | new payment vs max parallel payments in the last 6–12 months | **> 50 % undesirable** | §4.8 | CURRENT | `DEBT_BURDEN_INCREASE` (LTE 0.5) |
| Metodologiya §4.6 | — | No live delinquency at application | Cari gecikmə günləri | — | Seeded **≤ 0 days** at application; documented justification requires an exception | Derived from the 30+ DPD stop factor; the sources do not state a live-DPD gate | INFERRED | `MAX_DPD_CURRENT` (LTE 0, `STOP`, status `INFERRED`) |
| Rəy workbook | `Əmsallar` (unnormed rows) | Analytical context, no threshold | Working Capital; Net Working Capital Ratio; Inventory / Receivable / Supplier Turnover; Cash Conversion Cycle; Breakeven Point; Net Profit Margin | e.g. `Working Capital = 'Balans chart'!C6−'Balans chart'!C27`; `CCC = C16+C18−C20`; `Breakeven = 'MZH chart'!C5/'MZH chart'!C4` | No norm in the source | Norma column empty | CURRENT (as metrics) | `domain/calculations/ratios.ts → computeRatios` (`workingCapital`, `workingCapitalToSales`, `inventoryTurnover`, `cashConversionCycle`, `breakevenPoint`, `netMargin`, `grossMargin`, `ebitdaMargin`, `cashRatio`, `debtToEquity`, `liabilitiesToAssets`, `equityToAssets`, `debtToEbitda`, `netDebtToEbitda`, `interestCoverage`, `ebitdaToInterest`) |
| Təqdimat | `Əmsallar` R / S columns | Benchmarks defined but never computed | Debt service coverage ratio = 1.2; Debt Service: Operational = 0.25; CCC = F+M−P | — | Printed on every sector row but not referenced by any sheet — dead benchmarks | Sector table | NEEDS_CONFIRMATION | Not implemented; candidate additions to `POLICY_ATB_CURRENT_V1` |

---

## 9. Sector turnover-day norms

The source table lives in the Təqdimat workbook (`Əmsallar` sheet, tier "50.000 AZN-dən çox"), and is consumed by `Balans!U33`/`U34` through `Data Base!V21 = sector & sub-sector` → `VLOOKUP(V22:Y68, 4)` (inventory days) and `VLOOKUP(V22:Z68, 5)` (receivable days). The opinion workbook reaches the same table through an **external `[1] Data Base` reference that was not supplied** — see open question 20.

| Source | Sheet/Page | Business Purpose | Field (Sahə / Sektor) | Formula | Rule — inventory (F) / receivable (M) / payable (P) days | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Təqdimat | `Balans` T33 | Stock turnover vs sector norm | Ehtiyatların dövretmə müddəti | `T33 = 360*E15/MZH!Q30` — **divides by COGS although the label says "İllik satış"** (open question 6) | Norm by sub-sector, `U33 = VLOOKUP('Data Base'!$V$21, $V$22:$Y$68, 4, 0)` | Sample returned 180 days | CURRENT | `config/policy.ts → SECTOR_INVENTORY_DAYS_<sector>` |
| Təqdimat | `Balans` T34 | Receivable discipline vs sector norm | Debitor borcların dövretməsi | `T34 = IFERROR(E11*360/MZH!Q16, 0)` | `U34 = VLOOKUP(…, 5, 0)`; sample 30 days | Sheet formula | CURRENT | `SECTOR_RECEIVABLE_DAYS_<sector>` |
| Təqdimat | `Əmsallar` col P | Supplier credit vs sector norm | Kreditor borcların dövretmə günləri | `360 × təchizatçı öhdəlikləri / illik mal alışı` | Per sub-sector, see table below | Sector table | INFERRED (never computed in the workbook) | `SECTOR_CREDITOR_DAYS_<sector>` |
| Təqdimat | `Əmsallar` — Ticarət | Trade sub-sector norms | Ərzaq · Minbir xırdavat · Məişət avadanlıqları · Ət və ət məhsulları · Meyvə tərəvəz · Geyim və aksesuarlar · İnşaat materialları · Avtomobil ehtiyyat hissələri · Tibbi mallar · Səyyar satış · Parfümeriya və kosmetik · Hədiyyə/oyuncaq/ofis · Avtomobil satışı · Qızıl və zərgərlik · Vitrindən satış | — | 60/30/60 · 180/30/60 · 180/30/60 · 15/15/30 · 15/30/30 · 180/30/60 · 180/60/60 · 180/60/60 · 180/30/60 · 180/30/30 · 180/30/30 · 180/30/60 · 180/30/60 · 180/60/60 · 30/—/— | `Əmsallar` rows | CURRENT (source) | Seeded as a coarser sector list — see the note below |
| Təqdimat | `Əmsallar` — İstehsal | Production sub-sector norms | Taxta məmulatları · Metal/plastik/şüşə · Çörək və un məmulatları · İnşaat materialları · Yüngül sənaye · Ərzaq məhsulları · Zərgərlik məmulatları · Daş karxanası · Qablaşdırma | — | 120/30/60 · 120/30/60 · **7**/30/30 · 120/30/60 · 120/30/60 · 15/30/30 · 60/60/60 · 120/60/60 · 120/30/60 | `Əmsallar` rows | CURRENT (source) | as above |
| Təqdimat | `Əmsallar` — Xidmət (16 sub-sectors) | Services carry no stock norm | İctimai iaşə · Fərdi peşə · İcarə · Yük daşımaları · Sərnişin daşımaları · Tədris · Təmir və texniki xidmət · Avtomobil təmiri · Bərbərlik · Əyləncə · Foto studio · Avtoyuma · Avtodayanacaq · Turizm · Poliqrafiya · İdman zalı | — | Inventory days = `Tələb yoxdur` (not required) for all; receivable 30 or `Tələb yoxdur` (`Təmir və texniki xidmət` = 90); payable 0/30/60 | `Əmsallar` rows; `D = "Tələb yoxdur"` for debt-to-equity on all services rows | CURRENT (source) | `config/policy.ts` waives D/E for `Xidmət` via `waivedForSectors` |
| Təqdimat | `Əmsallar` — Kənd təsərrüfatı | Agriculture | Əkinçilik · Balıqçılıq · Heyvandarlıq · Quşçuluq · Arıçılıq · Bağçılıq · Süd satışı | — | 120/30/30 for all except **Süd satışı 10/15/0** | `Əmsallar` rows | CURRENT (source) | as above |
| Təqdimat | `Əmsallar` — universal columns | Norms identical on every sector row | Ödəmə qabiliyyəti 0.7 · Kapitala nəzərən borclanma 1 (or `Tələb yoxdur` for services) · Cari likvidlik 1.5 · ROA 0.05 · ROE 0.08 · Sərbəst pul axını "Mənfi olmamalıdır" · Debt service operational 0.35 · WC turnover "min 1.5" · Gearing "max 30%" · Working capital ">0" · DSCR 1.2 · Debt service operational 0.25 | — | as printed | `Əmsallar` header rows C1/C2 distinguish the 5,000–50,000 tier from the >50,000 tier | CURRENT | `POLICY_ATB_CURRENT_V1` base rules |
| Seeded default | — | Make the platform runnable before the norm table is confirmed | Sector day norms as configured | — | Ticarət 60/45/60 · Topdan ticarət 75/60/75 · Pərakəndə ticarət 45/15/45 · İstehsal 90/60/60 · Tikinti 120/90/90 · Xidmət 30/30/45 · Nəqliyyat 20/45/30 · Kənd təsərrüfatı 180/60/90 | **These are indicative defaults at sector level; the source table is at sub-sector level with different values.** Every row is administrator-editable | NEEDS_CONFIRMATION | `config/policy.ts → sectorTurnoverRules()` producing `SECTOR_INVENTORY_DAYS_*`, `SECTOR_RECEIVABLE_DAYS_*`, `SECTOR_CREDITOR_DAYS_*` |

---

## 10. Altman Z-score — three variants

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule (zones) | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Rəy workbook | `Əmsallar` rows 29–41; selector `G116`, output `I116` | Independent bankruptcy indicator shown next to the opinion total | **Altman Z — Ümumi (General)** | `Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5` | Sağlam Z > **2.99** · Təhlükəli 1.81 < Z < 2.99 · Müflis Z < **1.81** | `I116 = IF(G116="Altman Z Score- Ümumi", Əmsallar!D30, …)` | CURRENT | `domain/calculations/altman.ts → ALTMAN_VARIANTS.GENERAL` |
| Rəy workbook | `Əmsallar` rows 42–53 | as above | **Altman Z — Özəl Şirkətlər (Private, Z′)** | `Z = 0.717·X1 + 0.847·X2 + 3.107·X3 + 0.420·X4 + 0.998·X5` | Sağlam Z > **2.90** · grey 1.23 < Z < 2.90 · Müflis Z < **1.23** | `…Əmsallar!D42` | CURRENT | `ALTMAN_VARIANTS.PRIVATE` — the platform default, because Prometeia's financial layer uses it |
| Rəy workbook | `Əmsallar` rows 54–63 | as above | **Altman Z — İnkişaf etməkdə olan ölkələr (Emerging)** | `Z = 3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4` (**no X5**) | Sağlam Z > **2.60** · Təhlükəli 1.1 < Z < 2.60 · Müflis Z < **1.1** | `…Əmsallar!D54`; this is the variant the worked opinion displayed | CURRENT | `ALTMAN_VARIANTS.EMERGING` (`usesX5: false`, `constant: 3.25`) |
| Rəy workbook | `Əmsallar` X-inputs | Common inputs | X1…X5 | X1 = `('Balans chart'!C21−C27)/C20` (working capital / total assets); X2 = `'MZH chart'!C15/C20` (retained profit / total assets); X3 = `'MZH chart'!C8/C20` (EBIT / total assets); X4 = `'Balans chart'!C37/C26` (equity / liabilities); X5 = `'MZH chart'!C2/C20` (sales / total assets) | — | Cell formulas | CURRENT | `domain/calculations/altman.ts → AltmanInputs, altmanInputsFrom, computeAltman` |
| Rəy workbook | `Rəy forması` J109 vs I116 | Keep the indicator out of the score | Z-score in the opinion | — | Displayed beside the totals; **does not enter `J109`** | Metodologiya §3.5 (opinion independent of RMD's Altman-based SME scoring) | CURRENT | Altman result is reported, not scored, in `evaluateLegacyOpinion` |
| Prometeia deck | slide 14 | Financial notch for the Medium segment | Altman Z′ layer | Same private-firm coefficients | Low risk Z > 2.90 · Medium 1.23 < Z < 2.90 · High Z < 1.23. "applied **only for Medium segment** applications and is calculated by the Underwriting (UW) Team" | Slide 14 | PROMETEIA_PROPOSED | `config/rating.ts → NOTCHING_PROMETEIA_V1.altman` (`appliesToSegments: ['MEDIUM']`) |
| Inferred | — | Zone edges are not defined in any source | Boundary handling | `altmanZone(z, cfg, boundary)` | Exact-boundary Z treated as **GREY** by default; configurable `LOW_SIDE` / `HIGH_SIDE` / `GREY` | Neither the workbook nor the deck states whether `Z = 2.90` is Low or grey (open question 5) | INFERRED | `domain/calculations/altman.ts → altmanZone`; `NOTCHING_PROMETEIA_V1.altman.boundaryInclusive = 'GREY'` |

---

## 11. ACB bureau rating, pre-screen and segmentation

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Prometeia deck | slide 12 | Anchor the internal rating on the bureau score | ACB Micro Score → rating band | — | **0–149 Poor · 150–399 Satisfactory · 400–699 Medium · 700–859 Good · 860–1000 Excellent** | Slide 12 table (obs shares 10.8 / 26.4 / 50.6 / 6.1 / 6.2 %) | PROMETEIA_PROPOSED | `config/rating.ts → ACB_SCALE_PROMETEIA_V1.bands`; `domain/rating/rating-engine.ts → gradeFromScore` |
| ACB report | Score legend | The bureau's own published bands | Score bands | — | `>860–1000` Əla · `>750–859` Yaxşı · `>600–749` Orta · `>200–599` Kafi · `>0–199` Pis | `Skor üzrə şərti işarələmə` — **note these differ from Prometeia's cut-points (750/600/200 vs 700/400/150)** | CURRENT (bureau's own scale) | Recorded; the platform runs the Prometeia band set and flags the divergence |
| Prometeia deck | slide 12 | Reject the weakest grades up front | Pre-screen cut-off | — | Score **≤ 399** → "Application Rejected **OR** Escalated to UW team" | "we recommend to use the score threshold as 399 (eqv to max bound of Satisfactory rating)" | PROMETEIA_PROPOSED | `ACB_SCALE_PROMETEIA_V1.preScreenRejectBelow = 400`, `preScreenAction: 'REJECT'`; `domain/rating/rating-engine.ts → preScreen` |
| Prometeia deck | slides 18/20 | Which subjects the bureau rating is taken from | Bureau rating definition | — | "the **worst rating** observed across both **Micro and Individual** bureau ratings"; related-party checks "extend bureau assessment beyond the applicant to key shareholders / parent company" | Slides 10, 18, 20 | NEEDS_CONFIRMATION (no Individual-score band mapping is given) | `config/rating.ts → WORST_RATING_V1.include = ['APPLICANT','SHAREHOLDERS','GROUP_BORROWERS','GUARANTORS']`; `rating-engine.ts → weakerGrade, computeBureauRating` |
| AKBÇ təlimatı | full document | The current, manual alternative to an automated gate | As-is bureau handling | — | No automated gate; the analyst reads the extract per the instruction | The instruction contains no score threshold | CURRENT | `config/rating.ts → ACB_SCALE_ATB_CURRENT_V1` (`preScreenRejectBelow: null`) |
| Prometeia deck | slide 12 | No score available | Missing bureau score | — | 106 of 1,132 sample cases had no ACB score; the deck does not state a handling rule | Data-construction funnel | INFERRED | `ACB_SCALE_*.noScoreAction = 'ESCALATE_TO_UW'` |
| Prometeia deck | slides 4, 18, 20 | Choose which scorecard and layers apply | Segmentation | — | Group exposure **< AZN 300,000 → Small (Kiçik)**; **≥ 300,000 → Medium (İri)**. "Total group exposure also includes the applied amount" | Slides 4, 18 | PROMETEIA_PROPOSED | `config/rating.ts → SEGMENTATION_PROMETEIA_V1.mediumThresholdAzn = 300_000`, `basis: 'POST_TRANSACTION_GROUP_EXPOSURE'`; `rating-engine.ts → determineSegment` |
| Prometeia deck | slides 7, 11 | Group exposure is not actually captured | Routing basis fallback | — | "Financed amount is used instead of group exposure, as the current dataset does not include group exposure information" | NOTE 2, slide 7 | CURRENT (limitation) | `config/workflow.ts → routingBasis`; `domain/calculations/bureau.ts → computeGroupExposure` |
| Prometeia deck | slides 9, 10 | Performance definitions behind every backtest number | Bad definitions | — | **Internal Bad** = 30+ DPD or NPL during the observation period. **External Bad** = ACB rating "Poor" at application date or period end. Final flag is an **OR** rule | "the counts should not be summed" | PROMETEIA_PROPOSED | `config/monitoring.ts → BAD_DEFINITIONS` (`INTERNAL_BAD_V1`, `EXTERNAL_BAD_V1`, `COMBINED_BAD_V1` — the last is `BANK_PROPOSED`, derived) |

---

## 12. Business-analysis layer — bands and notches

| Source | Sheet/Page | Business Purpose | Field | Formula | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|---|
| Prometeia deck | slide 13 | Qualitative overlay on the bureau anchor | Section 2 total score | Area 1 (1–3) + Area 2 (**mean of two dimensions**, 1–3) + Area 3 (1–3) | Total **3 – 9** | "The final Section 2 score is calculated by summing the scores of the three assessment areas"; "The final score for Area 2 is calculated as the average of the two dimensions scores" | PROMETEIA_PROPOSED | `config/scorecards.ts → BUSINESS_SCORECARD_PROMETEIA_V1` (`minScore: 3`, `maxScore: 9`); `domain/rating/rating-engine.ts → evaluateBusinessAnalysis` |
| Prometeia deck | slide 13 | Map the score to a risk category | Risk bands | — | **9** Low · **7.0–8.99** Low-Medium · **6.0–6.99** Moderate · **4.0–5.99** Medium-High · **3.0–3.99** High | Slide 13 table. Note "Low Risk" is a single point, not an interval (open question 12) | PROMETEIA_PROPOSED | `config/rating.ts → NOTCHING_PROMETEIA_V1.businessBands` |
| Prometeia deck | slides 15, 16 | Convert the band into a rating notch | Business notch | — | **Medium-High → −1 notch**; **High → −2 notches**; Low / Low-Medium / Moderate → 0 | Slides 15 (Small) and 16 (Medium) | PROMETEIA_PROPOSED | `NOTCHING_PROMETEIA_V1.businessBands[].notch` |
| Prometeia deck | slide 16 | Financial notch for the Medium segment | Altman notch | — | Altman **High Risk → −2 notches**; Altman **Low Risk → +1 notch, but only if the initial rating is not Poor (Rating 1)**; grey zone → 0 | Slide 16 | PROMETEIA_PROPOSED | `NOTCHING_PROMETEIA_V1.altman` (`highRiskNotch: -2`, `lowRiskNotch: 1`, `lowRiskUpgradeBlockedForGrades: ['POOR']`) |
| Prometeia deck | slide 10 | Cap the total adjustment | Notching cap | — | "**Maximum cumulative downgrade: 2 notches**" | Slide 10, step 4 | PROMETEIA_PROPOSED | `NOTCHING_PROMETEIA_V1.maxTotalDowngrade = -2`, `maxTotalUpgrade = 1`, `cumulativeDowngrades: true` |
| Prometeia deck | slide 13 | Ownership verification anchors | Area 1 | — | 3 = ownership clearly supported by multiple independent documents and income consistent with profile; 2 = sufficient evidence but some documents missing; 1 = ownership cannot be verified or income inconsistent | Slide 13 matrix; supporting evidence list: VÖEN, registration documents, property/lease, purchase & sales invoices, bank transactions, POS receipts, purchase contracts | PROMETEIA_PROPOSED | `BUSINESS_SCORECARD_PROMETEIA_V1.areas.RELATIONSHIP_VERIFICATION` |
| Prometeia deck | slide 13 | Track record and structure | Area 2 (two dimensions) | mean of the two | Track record: 3 = ≥3 yrs official activity **OR** >5 yrs relevant management experience; 2 = 1–2 yrs **OR** 3–5 yrs; 1 = <1 yr **OR** <3 yrs. Structure: 3 = owner actively controls, no material third-party dependency; 2 = manageable dependency; 1 = insufficient involvement / material dependency | Slide 13 | PROMETEIA_PROPOSED | `…areas.STRUCTURE_AND_MANAGEMENT` (dimensions `TRACK_RECORD`, `BUSINESS_STRUCTURE`) |
| Prometeia deck | slide 13 | Documentation quality | Area 3 | — | 3 = limited documentation/reporting risk; 2 = weaknesses that do not materially undermine the assessment; 1 = significant weaknesses creating material uncertainty | Slide 13 (identical wording in the current-state guideline) | PROMETEIA_PROPOSED | `…areas.DOCUMENTATION_REPORTING` |
| Prometeia deck | slide 29 | The as-is version of the same layer | Current-state guideline | — | Same 3–9 scale and bands, but Area 2 track record uses **official vs unofficial** years (3 yrs official OR 6 yrs unofficial), structure is decomposed into **three ownership archetypes**, and Area 1 High Risk is a **knock-out to Worst rating** | Slide 29 | CURRENT (as-is) | Differences recorded; `LEGACY_SCORECARD_V1` carries the archetype guidance under `STRUCTURE_AND_MANAGEMENT.guidanceAz` |
| Prometeia deck | slide 13 | Who scores it | Answering team | — | "The same Business Analysis questions are answered for both Small and Medium segment applications. The team responsible … varies depending on the group exposure amount and collateralization criteria" | Slide 13 note | PROMETEIA_PROPOSED | `config/workflow.ts → RoutingBucket.assessmentAuthority` |
| Prometeia deck | slide 28 | An alternative, question-level re-weighting | Optimised scorecard | — | Q1.4 15 % · Q1.5 15 % · Q1.6 15 % · Q1.7 25 % · Q2.1 10 % · Q2.2 10 % · Q2.3 10 % (Q1.2 and Q1.3 dropped); GINI 0.09 → 0.37 | Slide 28 | PROMETEIA_PROPOSED — **not referenced by the proposed process**; a second, competing artefact (open question 22) | Not implemented; recorded in `config/monitoring.ts → CURRENT_SCORECARD_POWER` context |

---

## 13. Approval routing — all five workflow presets

All buckets below are implemented as data in `config/workflow.ts` and resolved by `domain/workflow/routing-engine.ts → routeApplication`. Authority ranks (`AUTHORITY_RANK`) drive escalation: RM 1 · KOB KM financial analysis 2 · KOB KM internal committee 3 · Underwriting 4 · Director UW + Head KOB 5 · SME/Small Committee 6 · Big Committee 7 · Management Board 8.

### 13.1 `WORKFLOW_ATB_CURRENT_V1` — the live process (status `CURRENT`, source: Prometeia deck slide 4)

| Bucket key | Exposure | Collateral condition | Assessment authority | Decision authority | Escalation | Notching layers | Evidence |
|---|---|---|---|---|---|---|---|
| `LT_50K` | 0 – 50,000 | ANY | RM | KOB KM internal committee | none | — | "The Branch RM completes a structured assessment form … the final assessment is conducted by the SME Center's internal committee" |
| `B_50K_100K` | 50,000 – 100,000 | ANY | Underwriting Team | KOB KM internal committee | `UW_ASSESSMENT_NEGATIVE` → SME Committee | — | "Positive → finalized by KOB KM; Negative → Rejected OR escalated to SME Committee" |
| `B_100K_300K` | 100,000 – 300,000 | ANY | Underwriting Team | SME Committee | none | — | Slide 4 (printed "AZN 100,00 - 300,000" — a typo for 100,000) |
| `GT_300K` | > 300,000 | ANY | Underwriting Team | Management Board | none | — | Slide 4; the `Geniş forma` (Əlavə № 2) opinion is used |

Preset flags: `preScreenEnabled: false`, `stopFactorEscalationAuthority: 'MANAGEMENT_BOARD'`, `escalationOfRejectionsAllowed: true`. Recorded ambiguities: rejected applications are not stored; group exposure is not stored anywhere, so routing effectively runs on the financed amount.

### 13.2 `WORKFLOW_ATB_INTERNAL_PROPOSAL_V1` — the bank's own alternative (status `BANK_PROPOSED`, slide 5)

| Bucket key | Exposure | Collateral condition | Assessment | Decision | Escalation | Layers |
|---|---|---|---|---|---|---|
| `LT_50K` | 0 – 50,000 | ANY | RM | KOB KM internal committee | none | — |
| `B_50K_100K_FULL_COLL` | 50,000 – 100,000 | FULLY_COLLATERALISED | RM | KOB KM internal committee | none | — |
| `B_50K_100K_PART_COLL` | 50,000 – 100,000 | NOT_FULLY_COLLATERALISED | Underwriting | KOB KM internal committee | `UW_ASSESSMENT_NEGATIVE` → SME Committee | — |
| `B_100K_200K` | 100,000 – 200,000 | ANY | Underwriting | Director UW + Head KOB | `NOT_COLLATERALISED_OR_WORST` → SME Committee | — |
| `B_200K_300K` | 200,000 – 300,000 | ANY | Underwriting | Director UW + Head KOB | `NOT_COLLATERALISED_OR_WORST` → SME Committee | — |
| `B_300K_UPPER` | 300,000 – 500,000 | ANY | Underwriting | SME Committee | none | — |
| `GT_UPPER` | > 500,000 | ANY | Underwriting | Management Board | none | — |

Evidence: "This is one of the internally discussed versions and has not yet been implemented." Recorded ambiguity: "fully collateralized" / "80 % collateralized" are not numerically defined.

### 13.3 `WORKFLOW_ATB_INTERNAL_PROPOSAL_V2` — same, renamed committees (status `BANK_PROPOSED`, slide 6)

Identical to 13.2 except: committee = **Small Committee**, top authority = **Big Committee**, and the upper split moves from 500,000 to **700,000** (`B_300K_UPPER` = 300,000–700,000; `GT_UPPER` = >700,000).

### 13.4 `WORKFLOW_PROMETEIA_PROPOSED_V1` (status `PROMETEIA_PROPOSED`, slides 18–19)

| Bucket key | Exposure | Collateral condition | Assessment | Decision | Escalation | Layers |
|---|---|---|---|---|---|---|
| `LT_50K` | 0 – 50,000 | ANY | KOB KM financial analysis | KOB KM internal committee | `RATING_IS_WORST` → SME Committee | BUSINESS |
| `B_50K_100K_FULL_COLL` | 50,000 – 100,000 | FULLY_COLLATERALISED | KOB KM financial analysis | KOB KM internal committee | `RATING_IS_WORST` → SME Committee | BUSINESS |
| `B_50K_100K_PART_COLL` | 50,000 – 100,000 | NOT_FULLY_COLLATERALISED | Underwriting | KOB KM internal committee | `RATING_IS_WORST` → SME Committee | BUSINESS |
| `B_100K_200K` | 100,000 – 200,000 | MIN_80_PCT | Underwriting | Director UW + Head KOB | `NOT_COLLATERALISED_OR_WORST` → SME Committee | BUSINESS |
| `B_200K_300K` | 200,000 – 300,000 | FULLY_COLLATERALISED | Underwriting | Director UW + Head KOB | `NOT_COLLATERALISED_OR_WORST` → SME Committee | BUSINESS |
| `B_300K_UPPER` | 300,000 – 500,000 | ANY | Underwriting | SME Committee | none | BUSINESS + FINANCIAL |
| `GT_UPPER` | > 500,000 | ANY | Underwriting | Management Board | none | BUSINESS + FINANCIAL |

Preset flags: `preScreenEnabled: true`, `preScreenRejectedAuthority: 'BY_EXPOSURE'` ("Applications are routed to the relevant decision authority (KOB KM / SME Committee / Management Board) based on the group exposure"), `stopFactorEscalationAuthority: 'MANAGEMENT_BOARD'`, `collateralRatingOperator: 'OR'` with an explicit note that the flow diagram says AND. Quantified impact recorded from slide 19: ≈16 % of applications move from KOB KM to the UW Team; ≈12 % escalate from KOB KM to the SME Committee.

### 13.5 `WORKFLOW_PROMETEIA_PROPOSED_V2` (status `PROMETEIA_PROPOSED`, slides 20–21)

Identical to 13.4 except: committee = **Small Committee**, top = **Big Committee**, upper split at **700,000**, and `stopFactorEscalationAuthority: 'BIG_COMMITTEE'`. Source residue recorded as an ambiguity: the V2 table still says "escalated to **SME** Committee" in the `<50K` and `50–100K fully collateralized` rows.

### 13.6 Routing inputs and non-source items

| Source | Sheet/Page | Business Purpose | Field | Rule | Status | Target Module |
|---|---|---|---|---|---|---|
| Prometeia deck slide 19/21 | — | Escalate the weakest final ratings | "Final Rating = Worst" | Escalate when the post-notching internal rating is the worst grade (slide 16 equates it with "the Poor rating grade (Rating 1)") | NEEDS_CONFIRMATION | `config/rating.ts → WORST_RATING_V1.escalateAtOrBelow = 'SATISFACTORY'` (a deliberately conservative default, see open question 6) |
| Prometeia deck slide 23 | — | Justify the whole redesign | Risk-sensitive routing | "Approval authority is determined based on post-transaction Group Exposure, Bureau Rating, Final Internal Rating and eligible collateral coverage, rather than exposure size alone" | PROMETEIA_PROPOSED | `domain/workflow/routing-engine.ts → routeApplication` |
| Tracker | sheet 1 col G | The committee tiers actually used in practice | Komitə növü | Observed values `DKK`, `KKK`, `BKK`, `İH` — never expanded anywhere in the file | HISTORICAL / NEEDS_CONFIRMATION | `AUTHORITIES` uses the Prometeia naming; the tracker codes are unmapped |
| Tracker | sheets 1–2 date columns | Measure turnaround | Stage dates | `Daxil olma → Təhlil tarixi → Komitə tarixi → Qərar tarixi`; **no TAT formula and no target exists** | HISTORICAL | `config/workflow.ts → SLA_V1` |
| No source | — | Make stage monitoring possible | SLA targets | Seeded: to underwriting 2 days · in underwriting 5 days · to committee 3 days · total TAT 12 days | INFERRED | `config/workflow.ts → SLA_V1.targets` |

---

## 14. Monitoring, performance and data quality

| Source | Sheet/Page | Business Purpose | Field | Rule | Evidence | Status | Target Module |
|---|---|---|---|---|---|---|---|
| Prometeia deck | slide 7 | Benchmark any future model against observed behaviour | Current-state bucket performance | <50K: 566 obs, 7 internal / 47 external bad · 50–100K: 343, 5/50 · 100–300K: 183, 2/48 · >300K: 40, 1/12 | Approved applications 01.01.2024–31.03.2026 | CURRENT (observation) | `config/monitoring.ts → CURRENT_STATE_PERFORMANCE` |
| Prometeia deck | slides 27–28 | Show why the current scorecard must change | Section discriminatory power | Overall Small GINI **0.09**; Financial **−0.021**, Purpose **0**, Collateral **−0.137** — all economically insignificant, yet they carry 60 % of the weight | "this expected risk ranking is not consistently achieved by the current voting algorithms" | CURRENT (observation) | `config/monitoring.ts → CURRENT_SCORECARD_POWER` |
| Prometeia deck | slide 12 | Bureau discriminatory power on ATB's book | ACB rating power | GINI 74.8 · AUC 87.7 · KS 60.23 | Slide 12 — computed against a target that is itself bureau-derived (open question 23) | PROMETEIA_PROPOSED | Recorded alongside `BAD_DEFINITIONS` |
| Prometeia deck | slides 24–25 | Make future recalibration possible | Proposed data model | 33 fields across application, decision, ACB and exposure blocks, incl. rejection reason codes, ACB score/rating/query results, group exposure, DPD and DPD history | "Currently, rejected SME loan applications are not retained in the system" | PROMETEIA_PROPOSED | `types/application.ts`; `services/application-service.ts` |
| Metodologiya §6.2–6.4 + KOB documentation guide | — | Grade how well the numbers are evidenced | Data-quality rating | 10 weighted factors (Tax 15 · Bank 15 · Inventory 12 · Reporting 12 · Receivables 10 · Suppliers 10 · Collateral docs 8 · Purpose docs 8 · Reconciliation 6 · Verbal dependency 4) → bands A ≥90 · B ≥75 · C ≥60 · D ≥40 · E <40 | Derived from the source evidence hierarchies; no such rating exists in the sources | BANK_PROPOSED | `config/scorecards.ts → DATA_QUALITY_V1`; `domain/rules/data-quality.ts → computeDataQuality` |
| Master agreement (`BASH SAZİSH (KOB)`) | §2.4, §2.6, §5.1, §6.2 | Post-approval control | Contract mechanics | 30/360 day count; waterfall costs → penalty → overdue interest → overdue principal → interest → principal; acceleration at 90+ days or two consecutive ≥90-day breaches or failure to submit financials twice yearly; late-payment interest max 5 %/yr | Clause text | CURRENT | `domain/calculations/amortisation.ts`; `config/policy.ts → COVENANT_TEMPLATES` |
| Inferred | — | Give the platform a covenant library | Covenant templates | Debt/EBITDA ≤3.5 (quarterly) · DSCR ≥1.25 (quarterly) · Equity/Assets ≥0.3 (semi-annual) · Current ratio ≥1.2 (quarterly) · Minimum turnover · Dividend restriction · Additional-debt restriction · Collateral coverage ≥1.0 | No covenant schedule exists in any source | INFERRED | `config/policy.ts → COVENANT_TEMPLATES` |
| Tracker | sheet 2 cols U–Z, AE, AG | Categorise underwriting findings | Deficiency taxonomy | Free-text findings under Balans / MZH / Cash-flow / Müqayisəli təhlil / Təyinat / Digər; sheet 1 carries an unused deviation taxonomy (`Əmsal, maliyyə göstəriciləri` / `Biznes limitlər` / `Təminat` / `Digər`) | Column headers | HISTORICAL | `domain/rules/findings.ts → generateFindings` |
