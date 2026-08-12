/* Smoke check: run the full assessment pipeline over every seeded case. */
import { seedData } from '../data/seed';
import { assessApplication } from '../services/assessment';

const { customers, applications } = seedData();
const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(d);
const azn = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

for (const app of applications) {
  const customer = customers.find((c) => c.id === app.customerId)!;
  const a = assessApplication(app, customer);

  console.log('='.repeat(78));
  console.log(`${app.reference}  ${customer.displayName}  [${app.stage}]`);
  console.log(
    `  request ${azn(app.requestedStructure.amount)} AZN / ${app.requestedStructure.tenorMonths}m @ ${app.requestedStructure.annualRatePct}%`,
  );
  if (app.rejection) {
    console.log(`  REJECTED at ${app.rejection.stage}: ${app.rejection.reasonCode}`);
    continue;
  }
  console.log(
    `  group exposure: existing ${azn(a.groupExposure.existingTotalExposure)} → post ${azn(
      a.groupExposure.postTransactionGroupExposure,
    )} | segment ${a.rating.segment}`,
  );
  console.log(
    `  ACB ${a.bureauRating.score ?? '—'} (${a.bureauRating.grade}) → business ${fmt(
      a.rating.business.totalScore,
    )}/9 ${a.rating.business.riskBand} notch ${a.rating.business.notch} → altman ${fmt(
      a.altman?.z,
    )} ${a.altman?.zone} notch ${a.rating.financial.notch} → FINAL ${a.rating.finalGrade}${
      a.rating.isWorstRating ? ' (WORST)' : ''
    }`,
  );
  console.log(
    `  legacy yekun rəy: ${fmt(a.legacy.totalScore, 2)}/100 ${a.legacy.bandLabelEn}${
      a.legacy.globalStopTriggered ? ' [STOP]' : ''
    }`,
  );
  console.log(
    `  monthly payment ${azn(a.proposedMonthlyPayment)} | CFADS ${azn(a.repayment?.cfads)} | DSCR ${fmt(
      a.repayment?.dscrAfter,
    )} | pay/capacity ${fmt(a.repayment?.paymentToCapacity)}`,
  );
  console.log(
    `  max sustainable loan ${azn(a.maxLoan?.maxSustainableLoan)} vs requested ${azn(app.requestedStructure.amount)}`,
  );
  console.log(
    `  collateral: eligible ${azn(a.collateral.totalEligibleValue)} / exposure ${azn(
      a.collateral.exposure,
    )} = ${fmt(a.collateral.eligibleCoverage)}`,
  );
  console.log(
    `  ratios: current ${fmt(a.ratios.currentRatio?.value)} | D/E incl new ${fmt(
      a.ratios.debtToEquityInclNew?.value,
    )} | debt/EBITDA ${fmt(a.ratios.debtToEbitda?.value)} | recv days ${fmt(a.ratios.receivableDays?.value, 0)}`,
  );
  console.log(
    `  refinancing: instalment share ${fmt(a.refinancing.instalmentRepaymentShare)} | flags ${a.refinancing.flags.length}`,
  );
  console.log(
    `  cross-checks: ${a.crossChecks.filter((c) => !c.passed).length}/${a.crossChecks.length} failing`,
  );
  console.log(`  data quality: ${a.dataQuality.grade} (${fmt(a.dataQuality.scorePct, 0)})`);
  console.log(
    `  policy: ${a.policy.breaches.length} breaches (${a.policy.stops.length} stop, ${a.policy.exceptions.length} exception) | stop factors ${a.activeStopFactors.length}`,
  );
  console.log(`  forecast: min cash ${azn(a.forecast?.minimumCash)} | negative months ${a.forecast?.negativeMonths}`);
  console.log(
    `  routing: ${a.routing.bucketLabelAz} → ${a.routing.decisionAuthority}${a.routing.escalated ? ' (escalated)' : ''}`,
  );
  console.log(`  findings: ${a.findings.length} | commentary lines: ${a.commentary.length}`);
  for (const f of a.findings.slice(0, 4)) console.log(`     [${f.severity}] ${f.title}`);
  for (const c of a.commentary.slice(0, 3)) console.log(`     » ${c}`);
}
console.log('='.repeat(78));
console.log('smoke complete');
