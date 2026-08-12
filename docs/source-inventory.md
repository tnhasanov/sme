# Source Inventory

Complete register of the material supplied for the ATB SME underwriting platform, grouped by the archive it arrived in. Every row records what the document is, why the bank uses it, what was actually recovered from it, its status in the platform, and which repository module consumes it.

**Scope.** 13 uploaded archives plus one standalone PDF (the Prometeia deck). 27 distinct text extractions were produced (36 files on disk — the extraction was run twice and the second pass carries a hash suffix). Five archives are photographic only and produced no text at all.

**Anonymisation rule (enforced).** The sources contain real customer, guarantor, bank-staff and third-party identifiers. No real personal name, tax identification number (VÖEN/FİN), phone number, postal address, IBAN or account number appears anywhere in this documentation set. The applicant is referred to as **[BORROWER]**; file names that embedded the applicant's surname are rewritten to `[BORROWER]`; the ACB report ID is written `[ID]`. Bank staff are referred to by role. The same rule is enforced in the platform's demo data: `data/seed/*` contains only synthetic entities (e.g. "Caspian Food"), and `types/application.ts` marks the tax-ID field as anonymised in demo data.

**Status vocabulary** (identical to `types/core.ts → SOURCE_STATUSES`): `CURRENT` · `PROMETEIA_PROPOSED` · `BANK_PROPOSED` · `HISTORICAL` · `INFERRED` · `NEEDS_CONFIRMATION`. Here it is applied to the *document*: whether what it describes is live bank practice, a proposal, or unusable.

---

## Summary by archive

| # | Archive | Files | Text recovered | Nature |
|---|---|---|---|---|
| — | `ATB_ERM_Diagnostic_Status_Meeting.pdf` (standalone) | 1 | 1 | Prometeia Phase-2 diagnostic deck, 29 slides |
| 1 | `Anderaytinq prosesi metodikası` | 12 | 11 | The methodology library (core PDF + 6 sector methodologies + annex workbooks) |
| 2 | `Anderaytinq tərəfindən tərtib edilən rəy` | 1 | 1 | A real completed underwriting opinion workbook, 16 sheets |
| 3 | `Təqdimat` | 1 | 1 | The credit-committee presentation template (>50,000 AZN), 11 sheets |
| 4 | `Daxil olan sifarişlər ATB 07.2026` | 1 | 1 | Pipeline / order tracker, 3 sheets |
| 5 | `3.AKB` | 4 | 4 (2 empty) | Credit-bureau reports and the CASA account statement |
| 6 | `Müqavilələr` | 6 | 5 | Contract and consent templates |
| 7 | `Qeydiyyat dəftəri` | 2 PDFs + 3 photo folders | 2 (glyph-decoded) | Income-tax declarations + hand-written ledger photos |
| 8 | `Qeydiyyat defteri - 2` | 55 images | 0 | Ledger photos, continuation |
| 9 | `Təminat` | 1 PDF + 15 images | 1 (empty) | Collateral valuation and collateral photos |
| 10 | `1.Biznes şəkilləri` | 151 images | 0 | Business premises photos |
| 11 | `Ev şəkilləri` | 30 images | 0 | House / apartment photos |
| 12 | `Digər sənədlər` | 59 images | 0 | Car documents, purchase waybills, title deeds, till receipts |
| 13 | `Ş.V` | 4 images | 0 | ID-card and VÖEN photos |

---

## Standalone PDF — Prometeia diagnostic

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `ATB_ERM_Diagnostic_Status_Meeting.pdf` — "Risk Diagnostics Project, Phase 2: Deep Dive on SME Scorecard", status meeting 07.08.2026, 29 slides | PDF, text-extractable | Consultant's diagnosis of the current SME assessment process and proposal of a bureau-anchored notching scorecard, revised approval routing and a data model | Full text. Sample funnel (1,132 approved → 212 final), ACB score→rating bands, business-analysis 1–3 matrix and 3–9 bands, Altman Z' layer, notching rules, as-is and proposed routing tables (V1/V2), current voting-algorithm weights and GINI analysis, bad definitions, proposed 33-field data model | `PROMETEIA_PROPOSED` (nothing in it is approved ATB policy) | `config/rating.ts → ACB_SCALE_PROMETEIA_V1, SEGMENTATION_PROMETEIA_V1, NOTCHING_PROMETEIA_V1, WORST_RATING_V1`; `config/scorecards.ts → BUSINESS_SCORECARD_PROMETEIA_V1`; `config/workflow.ts → WORKFLOW_PROMETEIA_PROPOSED_V1/V2, WORKFLOW_ATB_CURRENT_V1, WORKFLOW_ATB_INTERNAL_PROPOSAL_V1/V2`; `config/monitoring.ts → BAD_DEFINITIONS, CURRENT_STATE_PERFORMANCE, CURRENT_SCORECARD_POWER`; `domain/rating/rating-engine.ts` |

---

## Archive 1 — `Anderaytinq prosesi metodikası` (methodology library)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `Kiçik və Orta Biznes krediti sifarişlərinə Anderraytinq Mərkəzi tərəfindən rəy verilməsi Metodologiyası - Copy.pdf` | PDF, 55 KB text | The governing methodology: how the Underwriting Centre scores an SME application and issues its opinion | Complete: §1 scope, §3.1 two opinion formats, §3.2–3.7 opinion content flow and the 5 criteria / 100 points, §4 credit history, §5 business, §6 financials (incl. stop factors and sector waivers), §7 purpose, §8 collateral, §9 governance | `CURRENT` (İH-approved; appendix form stamped `version 26.04.2024`) | `config/scorecards.ts → LEGACY_SCORECARD_V1`; `config/policy.ts → STOP_FACTORS_V1`; `domain/scoring/legacy-opinion.ts`; `domain/rules/stop-factors.ts` |
| `Rəy Həşimov… .xlsx` → cited as **`Rəy [BORROWER] İH 550.000 AZN.xlsx`** *(this file physically lives in archive 2; listed here because it is the executable form of the methodology)* | — | — | see archive 2 | — | — |
| `AKBÇ ı oxunması təlimatı.docx` | DOCX, 22 KB | Instruction for reading an Azerbaijan Credit Bureau extract: which fields to take, how to interpret DPD, how to detect loan-by-loan refinancing and guarantee exposure | Field-by-field reading guide, 24-month history semantics, two interest-rate back-calculation methods, refinancing chain analysis with 30–40 % tolerance heuristic, "less than half paid = liquidity problem", guarantor scenarios | `CURRENT` | `domain/calculations/bureau.ts → analyseRefinancing, REFINANCE_WINDOW_DAYS, REFINANCE_COVERAGE_MIN, debtBurdenIncrease, summariseBureau` |
| `Aqro kreditləşmə təhlil metodikası.docx` | DOCX, 19 KB | Agricultural lending analysis: how to build farm financial statements, compute unit costs, cross-check herd/feed flows | Farm direction taxonomy, cost-at-cost/market rules, worked unit-cost build-ups (alfalfa bale, barley, milk, calves, cheese), 4 cross-check methods, red-flag list | `CURRENT` | `domain/calculations/cross-checks.ts`; `config/policy.ts` sector waivers (`waivedForSectors: ['Kənd təsərrüfatı']`) |
| `Təhlil Kənd təsərrüfatı məhsul normaları.xlsx` | XLSX, 69 KB (formulas) | Reference yield/cost norms per agricultural product used to validate farmer statements | 15 sheets of norms: cattle fattening & dairy, sheep, broiler, wheat, hazelnut, alfalfa, pomegranate, onion, persimmon, greenhouse tomato — with formulas and helper norms | `CURRENT` but point-in-time prices; no refresh cadence defined | Not yet consumed — reserved for a sector-norms table extending `config/policy.ts → sectorTurnoverRules()` |
| `Rəy forması.xlsx` (agro opinion form) | XLSX, 3.1 KB | Agro opinion form skeleton | 3 sheets only (`Məlumat`, `Data validation`, `Hesabat`) with one alfalfa cost example; no scoring model | `CURRENT` but **incomplete** — the fuller opinion structure lives in archive 2 | Informational only |
| `Kreditlə-hissələrlə satışın və barterin metodikası.docx` | DOCX, 18 KB | How to analyse traders who sell on instalments and who barter goods | Balance/P&L/cash-flow treatment of instalment sales, debtor aging buckets (0–30/30–90/90–360/>360/expired/hopeless), ≥180 days = hopeless rule, conservative loss recognition, barter channel margin split, hard stop when the per-contract annex data is unavailable | `CURRENT` | `domain/calculations/cross-checks.ts`; `types/financials.ts` receivable aging |
| `Kreditlə-hissələrlə satışın və barterin metodikası əlavə cədvəli.xlsx` | XLSX, 88 KB | The annex table the instalment methodology references (per-contract price, date, down payment, monthly payment, months paid/remaining) | Recovered on the second extraction pass (it was missing from the first) | `CURRENT` | Reserved — instalment-portfolio module |
| `Avtomobillə daşıma biznesinin, avtomobil nəğd və kreditlə satışı, icarəsi biznesinin təhlili metodikası.docx` | DOCX, 18.5 KB | Analysis of passenger/freight transport and vehicle sale-on-instalment businesses | Recovered on the second extraction pass | `CURRENT` | Reserved — transport sector module |
| `Texnika və avtomobil təhlili əlavə cədvəli.xlsx` (extracted under the transport-methodology folder name) | XLSX, 22.7 KB | Per-vehicle register: ownership documents, two power-of-attorney layers, instalment terms, month-by-month collections matrix | Column model and all formulas (`K=(Q−J)/L`, `O=(I−J)/36`, `P=K−O`, `R=K×N`, `S=O×N`) plus fleet totals | `CURRENT`; the hard-coded `/36` needs confirmation | Reserved — transport sector module |
| `Daşınmaz əmlak təhlil cədvəli.xlsx` | XLSX, 5.8 KB | Property register distinguishing beneficial vs registered owner, official vs actual use, rent vs market value | Full 17-column model, header tag `08.2023-1`, totals row | `CURRENT` | `domain/calculations/collateral.ts`; `config/policy.ts → COLLATERAL_HAIRCUTS_V1` |
| `KOB və Orta Biznes kreditlərində müştərilərin sənədləşməsində təhlil məqamları.docx` | DOCX, 23 KB | Which documents to demand and what to look for in each (charter, registry extract, supplier contract, bank turnover, profit-tax and VAT returns, customs declaration, invoice) | Entity size classification table, 4 document blocks, per-document analysis points, cash-out red flags, cash-transaction limits (30,000 / 15,000 AZN), loss carry-forward rules (5 years corporate, 3 years individual) | `CURRENT` | `config/scorecards.ts → DATA_QUALITY_V1`; `domain/rules/data-quality.ts` |
| `Aqro kreditləşmənin əsasları. Quşçuluq sahəsi üzrə maliyyə təhlili.ppt` | Legacy PPT (binary) | Poultry-sector financial analysis training material | **NOT USABLE** — legacy `.ppt` binary format; no text extractor was run and no `.txt` was produced | `NEEDS_CONFIRMATION` | none |

---

## Archive 2 — `Anderaytinq tərəfindən tərtib edilən rəy` (a real completed opinion)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `Rəy [BORROWER] İH 550.000 AZN.xlsx` — 16 sheets, header `Version 01.11.2025-14.07.2026` | XLSX, 345 KB (formulas + values) | The Underwriting Centre's live opinion workbook: it *is* the scoring model, built on top of the RM's presentation workbook | All 16 sheets with formulas: `Rəy forması` (the 5-criterion scoring model, cells J31–J109 and the band ladder), `AKBÇ təhlili`, `Aylıq ödəniş` (186-column parallel-payment calendar), `Balans chart`, `MZH chart`, `Cash chart`, `Əmsallar` (21 ratio rows + 3 Altman blocks), `Cash indirect`, `Sifariş`, `Kredit Tarixçəsi`, `Balans`, `MZH`, `MZH keçmiş`, `Cash flow cari`, `Cash flow proqnoz`, `Data validations` | `CURRENT` — the executable form of the methodology PDF; contains real customer data (excluded per the anonymisation rule) | `config/scorecards.ts → LEGACY_SCORECARD_V1`; `config/policy.ts → POLICY_ATB_CURRENT_V1`; `domain/scoring/legacy-opinion.ts → evaluateLegacyOpinion`; `domain/calculations/ratios.ts`, `altman.ts`, `repayment-capacity.ts`, `statements.ts` |

---

## Archive 3 — `Təqdimat` (committee presentation template)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `Təqdimat 50 000 AZN çox (Əlavə № 2).xlsx` — 11 sheets, stamp `memo versiya - 01.10.2025`, marked `> 50.000 AZN` | XLSX, 271 KB (formulas + values) | The RM-side pack that goes to the credit committee for loans above 50,000 AZN: applicant, loan structure, collateral schedule and LTV, credit history, balance sheet, P&L, both cash flows, agri annex, comparative analysis, ratio benchmarks | All 11 sheets with formulas, including the **sector × sub-sector norm table** (`Əmsallar`, 47 rows) and the `Data Base` lookup key `V21 = sector & sub-sector`; the `Balans` ratio panel with norms; the `MZH` repayment-capacity block (`Q6`–`Q12`) and the four sensitivity formulas; `Müqayisəli təhlil` cross-check panel; **11 formula defects** (see open questions) | `CURRENT` | `config/policy.ts → POLICY_ATB_CURRENT_V1, sectorTurnoverRules()`; `domain/calculations/repayment-capacity.ts`, `cross-checks.ts`, `collateral.ts`; `domain/opinion/opinion-builder.ts` |

---

## Archive 4 — `Daxil olan sifarişlər ATB 07.2026` (pipeline tracker)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `Daxil olan sifarişlər ATB 07.2026.xlsx` — 3 sheets | XLSX, 1.28 MB | Hand-maintained register of incoming SME applications: intake → analysis → committee → decision, with deficiency and proposal free text | Sheet 1 `Daxil olan sifarişlər` (≈250 orders, 07.2022–02.2025, 27 columns incl. the unused `KƏNARLAŞMA SƏBƏBİ` deviation taxonomy); sheet 2 `Təhlil data` (≈397 orders from 03.2023, 40 columns incl. sector, collateral, KTN %, margins, opinion/committee amounts and conditions); sheet 3 `Təkliflər` (2 improvement items). Enumerations for branches, committee types (`DKK/KKK/BKK/İH`), sectors, sale forms, collateral types, purposes | `HISTORICAL` — a legacy register; the file name says 07.2026 but the newest order is 02.2025 | `types/application.ts` (stage model, status enums); `services/application-service.ts`; `config/workflow.ts → SLA_V1` (stage dates only — no targets exist in the file) |

---

## Archive 5 — `3.AKB` (bureau and account evidence)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `acb-credit-report-[ID].html` | HTML, 33 KB | The Azerbaijan Credit Bureau extract that anchors credit-history analysis and (under the proposal) the rating | Complete data model: header, borrower personal block, credit summary (active/closed/guarantee totals, monthly payment), 118 inquiry records with purpose codes, active and closed facility records with all fields, 24-month DPD history block, **DPD legend** (`-`/0/30/90/180/360/361+), **score legend** (5 bands on 1–1000) and 7 score-refusal codes | `CURRENT` | `domain/calculations/bureau.ts`; `config/rating.ts → ACB_SCALE_ATB_CURRENT_V1` |
| `AKB-[BORROWER].pdf` | PDF, 306 bytes of text | Bureau extract for the applicant | **NOT USABLE** — scanned/image PDF, no text layer; only a fragment recovered | `NEEDS_CONFIRMATION` | none |
| `AKB-[BORROWER] hy.pdf` | PDF, 40 bytes of text | Bureau extract for a related family member | **NOT USABLE** — image-only PDF, effectively empty | `NEEDS_CONFIRMATION` | none |
| `ATB_BPIED_CASA_HESABDAN_CHIXARISH… .pdf` (CASA account statement) | PDF, 5.5 MB text / 1,836 pages | 12-month current-account statement used to corroborate declared turnover | Header metadata model, transaction table columns (`TARİX`, document no., counter-account, DEBET/CREDİT, `Təyinat`), daily turnover and closing-balance aggregates. Content is dominated by POS acquiring credits — i.e. a merchant account | `CURRENT` | `domain/calculations/cross-checks.ts → BANK_TURNOVER`; `config/scorecards.ts → DATA_QUALITY_V1` factor `BANK` |

---

## Archive 6 — `Müqavilələr` (contract and consent templates)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `BASH_SAZİSH (KOB).docx` — Master Agreement on Credit Limit Allocation | DOCX, 34 KB | Governing facility agreement: limit, tenor, max rate, facility forms, waterfall, covenants, acceleration | Full clause set: 30/360 day count, payment waterfall (costs → penalty → overdue interest → overdue principal → interest → principal), 3 early-repayment options (the only grace mechanism), 5 % max late-payment interest, drawdown-refusal grounds incl. ESG breaches, acceleration triggers (90+ days; two consecutive ≥90-day breaches; failure to submit financials twice a year), direct-debit right, 5 counterparts | `CURRENT` | `config/policy.ts → COVENANT_TEMPLATES`; `domain/calculations/amortisation.ts` |
| `İpoteka müqaviləsi (Baş Saziş üzrə)-ev.docx` | DOCX, 20 KB | Mortgage agreement under the master agreement | Required registration fields (registry no., registration no./date, cadastre office), initial sale (liquidation) price, secured-obligation scope, insurance ≥ claim amount, revaluation/substitution duty, enforcement after 90 days | `CURRENT` | `domain/calculations/collateral.ts` |
| `sahibkar kredit müraciəti 1.docx` | DOCX, 664 bytes | Entrepreneur's application letter | Fields: branch/manager, applicant, purpose, tenor, amount. No rate or commission fields | `CURRENT` | `types/application.ts` |
| `Razılıq_ərizəsi.DOCX` | DOCX, 211 bytes | Consent to bureau data submission / report retrieval | **PARTIALLY USABLE** — only the table title survived; the body is not in the dump | `NEEDS_CONFIRMATION` | none |
| `egov-az [REDACTED].docx` | DOCX, 1.5 KB | ASAN Finans consent (ID, employment and pension data), valid 5 years, revocable | Full field list and the three consent clauses | `CURRENT` | `types/application.ts` consent block |
| `Baş Sazişə kredit muqaviləsi.doc` | Legacy DOC (binary) | Sub-loan agreement under the master agreement | **NOT USABLE** — legacy `.doc` binary; no `.txt` was produced | `NEEDS_CONFIRMATION` | none |

---

## Archive 7 — `Qeydiyyat dəftəri` (tax declarations + ledger photos)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `492ddfb5-….pdf` — `Gəlir vergisi bəyannaməsi`, tax year **2024**, `kassa metodu`, size criterion **Mikro**, amended by taxpayer | PDF, CID-encoded | Declared revenue, expenses, taxable income and the annexed balance sheet — the highest-ranking evidence tier in the methodology's confirmation hierarchy | Recovered only by extracting the embedded TrueType subsets and shape-matching glyphs (the PDFs use `Identity-H` with no `/ToUnicode` CMap and no `cmap` table). Full line structure: 1200/1223/1225 income, 1226.x expenses, 1241/1246/1250 tax, Annex 1 balance sheet | `CURRENT`; **decoding defect**: digit `6` sometimes renders as `o`, word spaces are lost | `domain/calculations/cross-checks.ts`; `config/scorecards.ts → DATA_QUALITY_V1` factor `TAX` |
| `4fa0daaf-….pdf` — same form, tax year **2025**, `hesablama metodu`, size criterion **Kiçik** | PDF, CID-encoded | as above | as above | `CURRENT`, same decoding defect | as above |
| `Qeydiyyat dəftəri/` — 65 images | JPG | The hand-written sales/stock ledger from which inventory and sales are reconstructed | **NOT OCR'd.** What the ledger contains is known only indirectly, from the workbook commentary: goods are counted at retail price and divided by the mark-up factor to reach cost | `NEEDS_CONFIRMATION` | none (evidence-type `REGISTRY_LEDGER` in `DATA_QUALITY_V1`) |
| `[BUSINESS] — aylıq satışlar/` — monthly sales photos | JPG | Monthly sales records supporting the P&L | **NOT OCR'd** | `NEEDS_CONFIRMATION` | none |
| `nağd pul/` — 5 images | JPG | Cash-on-hand count | **NOT OCR'd** | `NEEDS_CONFIRMATION` | none |

---

## Archive 8 — `Qeydiyyat defteri - 2`

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| 55 images (`IMG-…WA0293`…) | JPG | Continuation of the hand-written registry ledger | **NOT OCR'd** — image-only archive, no text extraction was attempted | `NEEDS_CONFIRMATION` | none |

---

## Archive 9 — `Təminat` (collateral)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `Girov/Qiymətləndirmə/0679-ATB-[BORROWER]-ilkin rey.pdf` | PDF, 20 bytes of text | Appraiser's preliminary valuation opinion — the source of `Bazar dəyəri` / `Likvid dəyər` on the collateral schedule | **NOT USABLE** — scanned/image PDF with no text layer | `NEEDS_CONFIRMATION` | none |
| `Girov/…` — 15 images (WhatsApp photos of the pledged apartment and of the guarantee/collateral documents) | JPG/JPEG | Visual evidence of the pledged property and guarantee documents | **NOT OCR'd** | `NEEDS_CONFIRMATION` | none |

---

## Archives 10–13 — image-only evidence packs (no text extraction)

| Source | Type | Business Purpose | What was extracted | Status | Target Module |
|---|---|---|---|---|---|
| `1.Biznes şəkilləri/` — 151 images in 3 sub-folders (two existing outlets, one outlet to be opened) | JPG | Photographic evidence that the business exists, is operating and is at the declared premises — the primary evidence for criterion 2.1 (`BUSINESS_OWNERSHIP_LINK`) and for stock plausibility | **NOT OCR'd.** No text extraction attempted; content is described only from the workbook narrative | `NEEDS_CONFIRMATION` | Evidence category feeding `config/scorecards.ts → LEGACY_SCORECARD_V1 → BUSINESS_OWNERSHIP_LINK` |
| `Ev şəkilləri/` — 30 images | JPG | Photos of the house / apartment relevant to the fixed-asset purchase purpose and to collateral | **NOT OCR'd** | `NEEDS_CONFIRMATION` | Evidence for `PURPOSE_DOCUMENTS` |
| `Digər sənədlər/` — 59 images: `avtomobil sənədləri` (car documents), `mal alış qaimələri` (purchase waybills), `ev torpaq sənədləri` (house/land title deeds), `kassa qəbzi` / `kassa çeki` (till receipts), phone numbers registered to the applicant | JPG | The evidence catalogue the methodology lists for business-ownership confirmation (§5.1.1): waybills, till receipts, vehicle and property documents | **NOT OCR'd.** Vehicle documents and waybills would materially change the fixed-asset and COGS evidence tier if read | `NEEDS_CONFIRMATION` | Evidence for `BUSINESS_OWNERSHIP_LINK`, `BALANCE_SHEET`, `INCOME_STATEMENT` |
| `Ş.V/` — 4 images (`voen 1`, `voen 2`, applicant ID, related-person ID) | JPG | VÖEN (tax registration) certificate and identity documents — the first item in the ownership-evidence list | **NOT OCR'd** | `NEEDS_CONFIRMATION` | Evidence for `BUSINESS_OWNERSHIP_LINK` |

---

## Files that were NOT usable, and why

| Source | Reason |
|---|---|
| `Aqro kreditləşmənin əsasları. Quşçuluq sahəsi üzrə maliyyə təhlili.ppt` | Legacy binary `.ppt`; no extractor produced text |
| `Baş Sazişə kredit muqaviləsi.doc` | Legacy binary `.doc`; no extractor produced text |
| `AKB-[BORROWER].pdf`, `AKB-[BORROWER] hy.pdf` | Image-only PDFs (306 and 40 bytes of text) — the two bureau extracts that would have shown the applicant's and the related person's actual bureau data |
| `0679-ATB-[BORROWER]-ilkin rey.pdf` (valuation) | Image-only PDF (20 bytes) — the collateral valuation figures are therefore known only as they were re-keyed into the presentation workbook |
| `Razılıq_ərizəsi.DOCX` | Only the table title survived extraction; body missing |
| `Qeydiyyat dəftəri`, `Qeydiyyat defteri - 2`, `[BUSINESS] — aylıq satışlar`, `nağd pul`, `1.Biznes şəkilləri`, `Ev şəkilləri`, `Digər sənədlər`, `Ş.V`, `Təminat/Girov` | Photographic archives — **no OCR was run**. Together these are the entire primary-evidence layer behind the reconstructed statements; the platform models them as evidence *types* with a verification tier, not as parsed data |
| Two extraction passes produced duplicate `.txt` files with hash suffixes | Filenames are truncated at ~160 characters, which caused name collisions in the first pass; the second pass recovered two files that had been lost (the instalment/barter annex XLSX and the transport methodology DOCX) |

---

## Sources referenced by the methodology but never supplied

| Missing source | Why it matters | Consequence in the platform |
|---|---|---|
| `KOB kreditlərinin verilməsi Metodologiyası` (SME Lending Methodology) | Holds the **0.8 payment-capacity coefficient** that arms stop factor #5 | `config/policy.ts → PAYMENT_TO_CAPACITY` and `STOP_FACTORS_V1 → SF_REPAYMENT_CAPACITY_NORM` are seeded at 0.8 with status `NEEDS_CONFIRMATION` |
| `Təsdiq edilmiş səlahiyyət limitləri` (approved authority limits) | The AZN thresholds behind the two opinion formats and the approval bodies | Routing thresholds are taken from the Prometeia deck instead; all five presets in `config/workflow.ts` are explicitly labelled |
| The RM workbook's external `Data Base` sheet referenced as `[1]` from the opinion workbook | Sector inventory-day and receivable-day norms consumed by the opinion `Əmsallar` panel | Norms recovered from the `Təqdimat` workbook instead; `sectorTurnoverRules()` is seeded `NEEDS_CONFIRMATION` |
| Product / commission tariff schedule | Master agreement references commissions but carries no rates | Not modelled |
| SLA / turnaround targets | No target exists in any source | `config/workflow.ts → SLA_V1` seeded `INFERRED` |
