# Data Dictionary

Domain types live in `/types`. Every entity below maps to a TypeScript interface; the file
and interface name are given so the definition is one click away.

A design rule runs through the whole model: **a bare `number` is only acceptable for values
the calculation engine derives.** Anything that originates from a document, a customer
statement or an analyst estimate is a `TracedValue`, which carries its own provenance.

---

## 1. Core primitives — `types/core.ts`

### `TracedValue`

| Field | Type | Meaning |
|---|---|---|
| `raw` | number | What was reported or collected. Never overwritten. |
| `adjusted` | number? | What the underwriter decided to use. |
| `sourceType` | `SourceType` | Where the figure came from. |
| `evidence` | `EvidenceStatus` | How well it is backed. |
| `documentRef` | string? | Supporting document. |
| `enteredBy` / `modifiedBy` | string? | Who touched it. |
| `modificationReason` | string? | Why it was changed. |
| `modifiedAt` | ISO datetime? | When. |

`valueOf(v, lens)` resolves a traced value under the `REPORTED` or `ADJUSTED` lens, which
is how the whole application switches between reported and adjusted financials without
mutating anything.

### Enumerations

| Enum | Values |
|---|---|
| `EvidenceStatus` | `VERIFIED`, `PARTIALLY_VERIFIED`, `VERBAL`, `ANALYST_ESTIMATE`, `MISSING`, `CONTRADICTORY` |
| `SourceType` | `TAX_AUTHORITY`, `BANK_STATEMENT`, `POS`, `CREDIT_BUREAU`, `CUSTOMER_DOCUMENT`, `CUSTOMER_VERBAL`, `FIELD_VISIT`, `INTERNAL_SYSTEM`, `ANALYST_CALCULATION`, `THIRD_PARTY_APPRAISAL`, `REGISTRY` |
| `SourceStatus` | `CURRENT`, `PROMETEIA_PROPOSED`, `BANK_PROPOSED`, `HISTORICAL`, `INFERRED`, `NEEDS_CONFIRMATION` |
| `Severity` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO` |
| `RuleAction` | `INFO`, `WARNING`, `POLICY_EXCEPTION`, `STOP`, `REJECT`, `ESCALATE` |
| `ComparisonOperator` | `GTE`, `GT`, `LTE`, `LT`, `EQ`, `NEQ`, `BETWEEN` |
| `FinancialLens` | `REPORTED`, `ADJUSTED` |

`SourceStatus` is the one that keeps ATB's live policy separate from Prometeia's proposal.
It appears on every versioned artifact and every rule, and the UI renders it as a badge
next to any threshold it influenced.

### `ExplainedMetric`

Carries `key`, `label` (Azerbaijani), `labelEn`, `value`, `unit`, `formula`, `inputs[]`,
`source`, `period` and `lens`. This is what makes every ratio in the UI clickable and
self-explaining.

### `VersionedArtifact`

`version`, `label`, `status`, `effectiveFrom`, `effectiveTo?`, `sourceRef`. Every
scorecard, policy set, rating scale, workflow and haircut table extends it.

---

## 2. Customer and business — `types/application.ts`

### `Customer`

| Field | Type | Notes |
|---|---|---|
| `legalName`, `displayName` | string | |
| `customerType` | `LEGAL_ENTITY` \| `INDIVIDUAL_ENTREPRENEUR` \| `PHYSICAL_PERSON` | |
| `legalForm` | `MMC` \| `ASC` \| `FST` \| `QSC` \| `KT` \| `OTHER` | |
| `taxId` | string | Anonymised in all demo data |
| `registrationDate`, `activityStartDate` | ISO date | |
| `officialActivityYears`, `unofficialActivityYears` | number | Both matter — the methodology scores them separately |
| `address`, `region` | string | |
| `sector`, `subSector` | string | Drives sector policy resolution |
| `businessModel`, `products`, `geography` | | |
| `locations`, `employees` | number | |
| `keyCustomers`, `keySuppliers` | array | Name, share %, payment terms — feeds concentration analysis |
| `seasonality` | string | |
| `seasonalityIndex` | number[12] | Monthly weights applied to the forecast |
| `shareholders` | `Shareholder[]` | Name, ownership %, UBO flag, other businesses |
| `management` | `ManagementMember[]` | Role, years in company, years in sector, key-person flag |

---

## 3. Loan request — `types/application.ts`

### `LoanStructure`

`amount`, `currency`, `tenorMonths`, `gracePeriodMonths`, `annualRatePct`,
`commissionPct`, `repaymentFrequency`, `amortisation`, `product`.

Stored **twice** on every application — `requestedStructure` and `proposedStructure` — so
what the customer asked for and what the bank offers never overwrite one another.

### `PurposeLine`

Purpose is decomposed, never free text alone.

| Field | Notes |
|---|---|
| `category` | `INVENTORY`, `WORKING_CAPITAL`, `CAPEX`, `VEHICLE`, `PROPERTY`, `REFINANCE_ATB`, `REFINANCE_OTHER_BANK`, `PERSONAL_NON_BUSINESS`, `OTHER` |
| `amount` | |
| `evidence` | `EvidenceStatus` |
| `businessBenefit` | What the business gains |
| `controlMechanism` | How disbursement is controlled |
| `effectiveness` | `PurposeEffectiveness` — investment, own contribution, financed amount, additional sales and EBITDA, annual cash benefit, payback years |

---

## 4. Group exposure — `types/application.ts`

### `GroupMember`

`name`, `relationship`, `taxId?`, `atbExposure`, `externalExposure`, `requestedExposure`,
`guaranteesGiven`, `includeInGroup`, `note?`.

`RelationshipType`: `SELF`, `PARENT`, `SUBSIDIARY`, `SISTER_COMPANY`, `SHAREHOLDER`,
`SOLE_PROPRIETOR`, `GUARANTOR`, `RELATED_BORROWER`, `ECONOMICALLY_RELATED`.

Derived by `computeGroupExposure`: existing ATB / external / total, requested,
debt being refinanced, **post-transaction ATB exposure** and **post-transaction group
exposure** — the last of which drives both segmentation and approval routing.

---

## 5. Credit bureau — `types/application.ts`

### `CreditBureauReport`

`subjectName`, `inquiryDate`, `reportReference`, `acbMicroScore`, `acbMicroRating?`,
`individualBureauRating?`, `facilities[]`, `guarantees[]`, `inquiries[]`.

One report per subject: the applicant, each shareholder, each guarantor. The methodology
makes obtaining all of them a stop factor.

### `CreditFacility`

`subjectName`, `lender`, `isAtb`, `product`, `originalAmount`, `outstanding`, `currency`,
`issueDate`, `maturityDate`, `monthlyPayment`, `currentDpd`, `maxDpd`, `dpd30PlusEvents`,
`status` (`ACTIVE` \| `CLOSED` \| `RESTRUCTURED` \| `WRITTEN_OFF`), `closureDate?`,
`earlyClosure?`, `collateralised?`.

`closureDate` and `earlyClosure` are what make the refinancing engine possible.

### `BureauGuarantee`, `BureauInquiryRecord`

Guarantees: guarantor, beneficiary, lender, amount, outstanding, DPD, status.
Inquiries: date, institution, purpose, `resultedInLoan` — an inquiry that led nowhere is
the signal the methodology asks about.

---

## 6. Financial statements — `types/financials.ts`

### `FinancialPeriod`

`label`, `year`, `periodType` (`HISTORICAL` \| `YTD` \| `FORECAST`), `startDate`,
`endDate`, `monthsCovered`, `isPrimary`.

`monthsCovered` is what lets the ratio engine annualise a YTD stub correctly.

### `BalanceSheet` — all fields `TracedValue`

Assets: `cash`, `receivables`, `inventory`, `otherCurrentAssets`, `fixedAssets`,
`otherNonCurrentAssets`.
Liabilities: `shortTermBankDebt`, `payables`, `otherCurrentLiabilities`,
`longTermBankDebt`, `otherLiabilities`.
Equity: `shareCapital`, `retainedEarnings`, `ownerContributions`, `ownerWithdrawals`,
`otherEquity`.

### `IncomeStatement` — all fields `TracedValue`

`sales`, `cogs`, `operatingExpenses`, `depreciation`, `interestExpense`, `otherIncome`,
`otherExpenses`, `tax`.

### `CashFlowStatement` — all fields `TracedValue`, direct method

`openingCash`, `customerReceipts`, `supplierPayments`, `payroll`, `rent`, `taxPaid`,
`otherOperatingExpenses`, `capex`, `ownerInjection`, `ownerWithdrawal`, `newBorrowing`,
`principalRepaid`, `interestPaid`.

### `ForecastMonth`

`label`, `openingCash`, `salesReceipts`, `supplierPayments`, `payroll`, `tax`, `opex`,
`capex`, `existingDebtPrincipal`, `existingDebtInterest`, `newDebtPrincipal`,
`newDebtInterest`, `ownerWithdrawals`, `financingInflow`, `closingCash`.

### `FinancialAdjustment`

`periodId`, `target`, `field`, `originalValue`, `adjustedValue`, `difference`, `reason`,
`narrative`, `evidence`, `analyst`, `createdAt`. Append-only — the original is never
mutated.

`AdjustmentReason`: `NORMALIZE_EBITDA`, `REMOVE_ONE_OFF_INCOME`, `UNSUPPORTED_INVENTORY`,
`RECEIVABLE_HAIRCUT`, `NON_BUSINESS_ASSET`, `SHAREHOLDER_LOAN_RECLASS`,
`UNDOCUMENTED_TURNOVER`, `RELATED_PARTY_ELIMINATION`, `OTHER`.

### `MonthlyTurnover`

`month`, `bankCredits`, `posTurnover`, `cashSales`, `declaredSales`, `taxDeclaredSales`.
Feeds the turnover reconciliation triangle.

---

## 7. Collateral and documents

### `Collateral`

`type`, `description`, `ownerName`, `ownerRelationship`, `marketValue`,
`forcedSaleValue`, `haircutOverridePct?`, `lienRanking`, `existingLienAmount`,
`valuationDate`, `appraiser`, `insured`, `insuranceExpiry?`, `registered`, `evidence`,
`currency`.

`CollateralType`: real estate (residential / commercial / land), equipment, vehicle,
cash deposit, receivables, inventory, personal guarantee, corporate guarantee.

### `CreditDocument`

`category`, `name`, `documentDate?`, `sourceType`, `uploadedBy`, `uploadedAt`,
`verifiedBy?`, `evidence`, `relatedMetrics[]`, `expiryDate?`, `mandatory`, `received`.

`relatedMetrics` is what links a document to the figures it supports, which is how the
data-quality engine knows whether inventory has evidence behind it.

---

## 8. Assessment inputs

### `BusinessAssessment` / `BusinessAssessmentAnswer`

`areaKey`, `dimensionKey`, `score` (1 | 2 | 3), `justification`, `supportingDocuments[]`.

### `LegacyAssessment` / `LegacyScoreAnswer`

`componentKey`, `achievement` (0..1), `optionKey?`, `comment?`.

For `OPTION` components `optionKey` selects the answer; for `MANUAL_0_100` components
`achievement × 100` is the 0–100 score.

---

## 9. Findings, risks, covenants, conditions

### `Finding`

`category`, `severity`, `title`, `description`, `observedValue?`, `expectedValue?`,
`source`, `evidence?`, `financialImpact?`, `mitigant?`, `analystComment?`,
`resolutionStatus`, `autoGenerated`.

### `RiskMitigant`

`category`, `severity`, `description`, `mitigant`, `residualRisk`.

### `Covenant`

`templateKey`, `label`, `metric`, `operator`, `threshold`, `testFrequency`, `source`,
`breachAction`, `active`.

### `CreditCondition`

`kind` (`PRECEDENT` \| `SUBSEQUENT`), `label`, `description`, `responsible`, `dueBy?`,
`status`.

---

## 10. Decision and governance

### `ApplicationStage`

`DRAFT`, `PRE_SCREENING`, `RM_SUBMITTED`, `SME_CENTER_ANALYSIS`, `UNDERWRITING`,
`RISK_REVIEW`, `COMMITTEE`, `DECIDED`, `REJECTED_PRESCREEN`, `RETURNED`, `CANCELLED`.

### `RejectionRecord`

`stage`, `reasonCode`, `description`, `acbScore`, `acbRating`, `groupExposure`,
`requestedAmount`, `rm`, `branch`, `rejectedAt`, `policyVersion`, `scorecardVersion`,
`workflowVersion`.

A rejection is a record, not a deletion. Prometeia's diagnostic found that ATB currently
discards pre-screen rejections entirely, which makes reject analysis, approval-rate
reporting and reject inference impossible.

### `RatingOverride`

`calculatedGrade`, `overrideGrade`, `direction`, `reason`, `requestedBy`, `approver`,
`approvedAt`. The calculated grade is retained, never replaced.

### `PolicyExceptionRecord`

`ruleId`, `ruleName`, `threshold`, `actual`, `requestedWaiver`, `justification`,
`mitigant`, `approver`, `status`. Distinct from a scorecard override.

### `AuditEntry`

`entity`, `field`, `oldValue`, `newValue`, `user`, `role`, `reason?`, `timestamp`,
`category`. Categories: financial adjustment, bureau update, rating, notching, override,
policy exception, structure, decision, workflow, data entry.

### `PipelineTimestamps`

`receivedAt`, `assignedToUwAt?`, `uwCompletedAt?`, `committeeAt?`, `decidedAt?`,
`returnCount`, `waitingReason?`, `missingDocuments[]`.

### Frozen versions on every application

`workflowVersion`, `scorecardVersion`, `legacyScorecardVersion`, `policyVersion`. A later
policy change cannot rewrite a historic decision.

---

## 11. Sector plugin payloads — `types/application.ts`

### `AgricultureData`

`subType` (crop / livestock / dairy / poultry / horticulture / beekeeping),
`landHectares?`, `crops[]` (crop, hectares, actual and norm yield per hectare, price,
unit, cost per hectare), `livestock` (opening, births, purchases, sales, mortality,
closing, average unit value), `feed` (opening, produced, purchased, consumed, closing).

The livestock and feed shapes exist to support the roll-forward reconciliations the agro
methodology requires.

### `TransportVehicle`

`ownership`, `model`, `year`, `acquisitionCost`, `currentValue`, `mileageKm`, `route`,
`tripsPerMonth`, `tariffPerTrip`, `fuelCostPerTrip`, `driverCostPerMonth`,
`maintenancePerMonth`, `insurancePerYear`, `isCollateral` — enough to cross-check revenue
as trips × tariff.

### `InstallmentSalesData`

Debtor ageing (`current`, `d0_30`, `d31_90`, `d91_360`, `d360Plus`), `writtenOff`,
`monthlyBilled`, `monthlyCollected`, `provisionRatePct`.

### `BarterData`

`ownGoodsSales`, `barterOutValue`, `barterInValue`, `barterResaleValue`,
`barterMarginPct` — kept separate so barter is never presented as cash turnover.
