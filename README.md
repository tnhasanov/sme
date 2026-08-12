# ATB KOB Anderraytinq Platforması

An SME credit-analysis, risk-rating and underwriting workstation for Azər-Türk Bank,
built from the bank's own underwriting methodology and Prometeia's Phase-2 risk-diagnostic
proposal.

The interface is in Azerbaijani; English financial terminology appears in tooltips.
Documentation and code comments are in English.

---

## What this is

Not a dashboard. A working underwriting workstation that digitises the full credit process:

```
Customer / application → pre-screening → bureau (AKB) → group exposure → business analysis
→ documents & evidence → balance sheet → income statement → current cash flow
→ forecast cash flow → comparative analysis → ratios → cross-checks → risk rating
→ policy & stop factors → structuring → underwriting opinion → approval routing
→ committee decision → monitoring
```

### Four layers kept deliberately apart

The platform never merges these, because they answer different questions and merging them
is how a high score turns into an approval it did not earn:

| Layer | Question | Where |
|---|---|---|
| **Credit analysis** | How does the business work and what cash does it generate? | `domain/calculations` |
| **Risk rating** | How risky is this borrower relative to others? | `domain/rating`, `domain/scoring` |
| **Credit policy** | Which limits does this application breach? | `domain/rules` |
| **Credit decision** | What is proposed, on what conditions, and who may approve it? | `domain/workflow`, `domain/opinion` |

A high score is not an approval. A policy breach is shown separately from a low rating. A
scorecard override is not a policy exception. Collateral does not substitute for repayment
capacity.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm test             # 82 unit tests over the calculation and decision engines
npm run typecheck    # tsc --noEmit
npm run smoke        # run every engine over all seeded cases and print the results
```

Node 20+. No database or external service is required — the MVP seeds itself in memory.

---

## Architecture

```
/types          Domain types. TracedValue carries provenance on every material figure.
/config         Versioned configuration: scorecards, rating scales, policy rules,
                stop factors, workflow presets, haircuts, monitoring definitions.
                Every threshold in the system lives here.
/domain
  /calculations Pure functions: statements, ratios, Altman, amortisation,
                repayment capacity, forecast, stress, cross-checks, bureau, collateral.
  /scoring      Legacy ATB "Yekun Rəy" expert assessment.
  /rating       Prometeia rating waterfall: bureau → business → financial → final.
  /rules        Policy engine, stop factors, data quality, findings, commentary.
  /workflow     Config-driven approval routing.
  /opinion      Deterministic underwriting-opinion builder.
/services       assessment.ts orchestrates every engine into one snapshot.
/repositories   Interfaces + in-memory implementation (PostgreSQL/Prisma is a drop-in).
/data/seed      Five synthetic borrowers plus six retained rejections.
/app            Next.js App Router: dashboard, applications, customers, portfolio,
                model monitoring, configuration, and 16 application tabs.
/tests          Vitest suites for the calculation and decision engines.
/docs           Source inventory, traceability matrix, as-is vs to-be, spec,
                data dictionary, calculation catalog, policy matrix, workflow matrix,
                open questions.
```

No financial calculation lives in a React component, and no threshold is hard-coded in
one. Pages read a single `Assessment` snapshot, which is what keeps the sticky decision
panel, the rating waterfall and the credit memo from ever disagreeing with each other.

---

## As-is and to-be are versioned, not merged

ATB's current process and Prometeia's proposal are different things, and the platform
refuses to blur them. Every application freezes the versions it was decided under, so a
later policy change cannot rewrite a historic decision.

**Workflow versions** — `ATB_CURRENT_V1`, `ATB_INTERNAL_PROPOSAL_V1`,
`ATB_INTERNAL_PROPOSAL_V2`, `PROMETEIA_PROPOSED_V1`, `PROMETEIA_PROPOSED_V2`.

**Scorecard versions** — `ATB_YEKUN_REY_V1` (the bank's current expert assessment) and
`PROMETEIA_QUICK_WIN_V1` (the proposed rating layer). They run side by side and are
displayed side by side.

Every rule carries a provenance badge: `CURRENT`, `PROMETEIA_PROPOSED`, `BANK_PROPOSED`,
`INFERRED` or `NEEDS_CONFIRMATION`. The approval-routing tab re-runs the routing engine
under all five workflow versions so you can see exactly what each proposal would change.

Where the sources contradict each other, the platform does not pick a winner silently. The
Prometeia deck states the 100–300k routing condition as **AND** in its flow diagrams and as
**OR** in its notching tables, which produce opposite outcomes for an uncollateralised
borrower with an acceptable rating. That choice is a configuration switch
(`collateralRatingOperator`), the UI shows which one was applied, and the conflict is
recorded in `docs/underwriting-open-questions.md`.

---

## What the engines actually do

- **Repayment capacity** in both conventions: ATB's `MZH!Q6` formula (the denominator of
  the 0.8 stop-factor coefficient) and a cash-based CFADS that drives DSCR and loan sizing.
- **Cross-checks**: eight reconciliations — balance integrity, equity movement, sales to
  cash, COGS to purchases, inventory roll-forward, bureau debt to balance sheet, turnover
  triangle, indirect cash flow — each with a materiality tolerance and an interpretation.
- **Refinancing engine**: splits each past loan into what was genuinely amortised and what
  was extinguished by a new loan, against the methodology's >50% benchmark, and flags loan
  cycling, cash-out and evergreening.
- **Rating waterfall**: bureau rating → business notch → Altman notch (Medium only) →
  cumulative cap → override, with the calculated grade always retained.
- **Legacy Yekun Rəy**: the 20/20/35/15/10 scorecard reproduced exactly, including the
  stop-factor short-circuit that zeroes the whole opinion, the 60% cap when there is no
  credit history, and the fact that collateral can never zero it.
- **Structuring**: maximum sustainable loan solved at several DSCR floors, six alternative
  structures re-priced through the same engine, and three stress scenarios.
- **Findings and commentary**: generated deterministically from calculation results. No
  language model is involved anywhere in the credit process.

---

## Demo cases

Five synthetic borrowers with genuinely different risk shapes, plus six retained
rejections:

| Case | Shape |
|---|---|
| **Xəzər Ərzaq Distribusiya** | Sales +32% while EBITDA grows only +14%; receivables and inventory balloon; operating cash weakens. Profitable on paper, deteriorating in cash. |
| **Şirvan Ticarət Evi** | Serial refinancing — each closure followed within days by a larger loan; only 34% of past principal genuinely amortised. |
| **Gəncə Metal Emalı** | Strong borrower: verified data, DSCR 1.63x, collateral coverage 105%, data quality A, no stop factors. |
| **Abşeron İnşaat Servis** | Construction: lumpy contract cash flow, receivable days 158, heavy customer concentration. |
| **Mil-Muğan Aqro** | Agriculture: poor monthly DSCR but a positive seasonal forecast, demonstrating the sector waiver the methodology grants. |

Rejected applications are retained in full — reason code, bureau score, exposure, frozen
versions — because Prometeia's diagnostic found ATB currently discards pre-screen
rejections entirely, which makes reject analysis and future model calibration impossible.

---

## Data protection

All demo data is synthetic. No real customer name, tax number (VÖEN), FIN, phone number,
address, account number or bureau record from the reference material appears anywhere in
this repository. The reference documents were read to extract **business rules,
calculations, workflow and risk methodology** — never to seed data. Real cases informed the
*shape* of risk in the fixtures (growth outrunning cash conversion, serial refinancing,
thin documentation) and nothing else. No data was sent to any external service.

---

## Migration to PostgreSQL

`repositories/types.ts` defines `CustomerRepository`, `ApplicationRepository` and
`UnitOfWork`. `repositories/in-memory.ts` is the current implementation. A Prisma
implementation satisfies the same interfaces without touching a single module, service or
page — the seam was drawn there deliberately.

---

## Known gaps

Recorded honestly rather than papered over — see `docs/underwriting-open-questions.md`:

- The 0.8 payment-to-capacity coefficient is a stop factor whose source document
  (*KOB kreditlərinin verilməsi Metodologiyası*) was not supplied.
- Sector turnover-day norms come from a `Data Base` sheet that was not part of the material.
- "Fully collateralized" and "80% collateralized" are used in routing but never defined.
- SLA targets appear in no source document; the seeded values are indicative.
- The Prometeia AND/OR routing conflict is unresolved and configurable.
