'use client';

import type { ReactNode } from 'react';
import type {
  IntakeBureauInput,
  IntakeCollateralInput,
  IntakeCustomerInput,
  IntakeLoanInput,
} from '@/domain/intake/build-application';
import { DEFAULT_CASE_FORM, SECTORS, type CaseFormValue } from '@/domain/intake/case-defaults';
import { COLLATERAL_TYPES, PRODUCTS } from '@/types/application';
import { Panel } from '@/components/ui/primitives';
import { COLLATERAL_LABEL_AZ, PRODUCT_LABEL_AZ } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The facts a workbook cannot carry.
 *
 * The financial statements come out of the uploaded file; identity, the
 * requested structure, the bureau extract and the collateral are entered by the
 * analyst. They are kept in one form rather than scattered across the wizard so
 * the analyst can see at a glance what the assessment will actually be run on.
 * The values themselves live in `domain/intake/case-defaults`.
 */

export { DEFAULT_CASE_FORM, SECTORS } from '@/domain/intake/case-defaults';
export type { CaseFormValue } from '@/domain/intake/case-defaults';

/* ------------------------------------------------------------------ */
/* Field primitives                                                    */
/* ------------------------------------------------------------------ */

const inputClass =
  'w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[11.5px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-600';

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-[10px] uppercase leading-tight tracking-wide text-slate-500" title={hint}>
        {label}
      </span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  hint,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={cn(inputClass, 'text-right tabular-nums')}
      />
    </Field>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CheckField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-[11.5px] text-slate-300" title={hint}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-sky-500"
      />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

export function CaseForm({
  value,
  onChange,
}: {
  value: CaseFormValue;
  onChange: (v: CaseFormValue) => void;
}) {
  const setCustomer = (patch: Partial<IntakeCustomerInput>) =>
    onChange({ ...value, customer: { ...value.customer, ...patch } });
  const setLoan = (patch: Partial<IntakeLoanInput>) => onChange({ ...value, loan: { ...value.loan, ...patch } });
  const setBureau = (patch: Partial<IntakeBureauInput>) =>
    onChange({ ...value, bureau: { ...value.bureau, ...patch } });
  const setCollateral = (patch: Partial<IntakeCollateralInput>) =>
    onChange({
      ...value,
      collateral: value.collateral ? { ...value.collateral, ...patch } : null,
    });

  return (
    <div className="space-y-4">
      <Panel
        title="Müştəri"
        subtitle="Fayl maliyyə rəqəmlərini verir; kimlik və biznes profili analitik tərəfindən daxil edilir"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Hüquqi ad"
            value={value.customer.legalName}
            onChange={(v) => setCustomer({ legalName: v })}
            placeholder="məs. Zaqatala Ticarət MMC"
            className="lg:col-span-2"
          />
          <TextField
            label="VÖEN"
            value={value.customer.taxId}
            onChange={(v) => setCustomer({ taxId: v })}
            placeholder="0000000000"
          />
          <SelectField
            label="Müştəri tipi"
            value={value.customer.customerType}
            onChange={(v) => setCustomer({ customerType: v })}
            options={[
              { value: 'LEGAL_ENTITY', label: 'Hüquqi şəxs' },
              { value: 'INDIVIDUAL_ENTREPRENEUR', label: 'Fərdi sahibkar' },
              { value: 'PHYSICAL_PERSON', label: 'Fiziki şəxs' },
            ]}
          />
          <SelectField
            label="Hüquqi forma"
            value={value.customer.legalForm}
            onChange={(v) => setCustomer({ legalForm: v })}
            options={[
              { value: 'MMC', label: 'MMC' },
              { value: 'ASC', label: 'ASC' },
              { value: 'QSC', label: 'QSC' },
              { value: 'FST', label: 'FST' },
              { value: 'KT', label: 'KT' },
              { value: 'OTHER', label: 'Digər' },
            ]}
          />
          <SelectField
            label="Sektor"
            hint="Sektor ehtiyat və debitor gün normalarını, həmçinin stop faktor istisnalarını müəyyən edir"
            value={value.customer.sector}
            onChange={(v) => setCustomer({ sector: v })}
            options={SECTORS.map((s) => ({ value: s as string, label: s }))}
          />
          <TextField
            label="Alt sektor"
            value={value.customer.subSector}
            onChange={(v) => setCustomer({ subSector: v })}
          />
          <TextField label="Region" value={value.customer.region} onChange={(v) => setCustomer({ region: v })} />
          <NumberField
            label="İşçi sayı"
            value={value.customer.employees}
            onChange={(v) => setCustomer({ employees: v })}
          />
          <NumberField
            label="Rəsmi fəaliyyət (il)"
            value={value.customer.officialActivityYears}
            onChange={(v) => setCustomer({ officialActivityYears: v })}
          />
          <NumberField
            label="Faktiki fəaliyyət (il)"
            hint="Rəsmi qeydiyyatdan əvvəlki fəaliyyət daxil olmaqla"
            value={value.customer.unofficialActivityYears}
            onChange={(v) => setCustomer({ unofficialActivityYears: v })}
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Field label="Biznes modeli">
            <textarea
              rows={2}
              value={value.customer.businessModel}
              onChange={(e) => setCustomer({ businessModel: e.target.value })}
              className={cn(inputClass, 'resize-y leading-relaxed')}
            />
          </Field>
          <Field label="Mövsümilik">
            <textarea
              rows={2}
              value={value.customer.seasonality}
              onChange={(e) => setCustomer({ seasonality: e.target.value })}
              className={cn(inputClass, 'resize-y leading-relaxed')}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Kredit sifarişi" subtitle="Struktur ödəniş cədvəlini və ödəmə qabiliyyəti hesablamasını müəyyən edir">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Məbləğ (AZN)" value={value.loan.amount} onChange={(v) => setLoan({ amount: v })} />
          <NumberField label="Müddət (ay)" value={value.loan.tenorMonths} onChange={(v) => setLoan({ tenorMonths: v })} />
          <NumberField
            label="Güzəşt dövrü (ay)"
            value={value.loan.gracePeriodMonths}
            onChange={(v) => setLoan({ gracePeriodMonths: v })}
          />
          <NumberField
            label="İllik faiz (%)"
            step={0.1}
            value={value.loan.annualRatePct}
            onChange={(v) => setLoan({ annualRatePct: v })}
          />
          <NumberField
            label="Komissiya (%)"
            step={0.1}
            value={value.loan.commissionPct}
            onChange={(v) => setLoan({ commissionPct: v })}
          />
          <SelectField
            label="Məhsul"
            value={value.loan.product}
            onChange={(v) => setLoan({ product: v })}
            options={PRODUCTS.map((p) => ({ value: p, label: PRODUCT_LABEL_AZ[p] ?? p }))}
          />
          <SelectField
            label="Amortizasiya"
            value={value.loan.amortisation}
            onChange={(v) => setLoan({ amortisation: v })}
            options={[
              { value: 'ANNUITY', label: 'Annuitet' },
              { value: 'EQUAL_PRINCIPAL', label: 'Bərabər əsas borc' },
              { value: 'BULLET', label: 'Müddət sonunda' },
              { value: 'SEASONAL', label: 'Mövsümi' },
            ]}
          />
          <SelectField
            label="Ödəniş tezliyi"
            value={value.loan.repaymentFrequency}
            onChange={(v) => setLoan({ repaymentFrequency: v })}
            options={[
              { value: 'MONTHLY', label: 'Aylıq' },
              { value: 'QUARTERLY', label: 'Rüblük' },
              { value: 'SEASONAL', label: 'Mövsümi' },
              { value: 'BULLET', label: 'Müddət sonunda' },
            ]}
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <TextField
            label="Təyinat"
            value={value.loan.purposeSummary}
            onChange={(v) => setLoan({ purposeSummary: v })}
          />
          <TextField
            label="Əsas ödəniş mənbəyi"
            value={value.loan.primaryRepaymentSource}
            onChange={(v) => setLoan({ primaryRepaymentSource: v })}
          />
          <TextField
            label="Əlavə ödəniş mənbəyi"
            value={value.loan.secondaryRepaymentSource}
            onChange={(v) => setLoan({ secondaryRepaymentSource: v })}
          />
          <TextField label="Filial" value={value.loan.branch} onChange={(v) => setLoan({ branch: v })} />
          <TextField label="Analitik" value={value.loan.rm} onChange={(v) => setLoan({ rm: v })} />
        </div>
      </Panel>

      <Panel
        title="Kredit tarixçəsi (AKB)"
        subtitle="AKB çıxarışından oxunan xülasə — reytinq, borc yükü və stop faktorlar bu məlumatdan asılıdır"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="AKB mikro skor"
            hint="Prometeia şkalası: 400-dən aşağı pre-screen imtinası"
            value={value.bureau.acbMicroScore ?? 0}
            onChange={(v) => setBureau({ acbMicroScore: v })}
          />
          <NumberField
            label="Cəmi aktiv borc"
            value={value.bureau.totalDebt}
            onChange={(v) => setBureau({ totalDebt: v })}
          />
          <NumberField
            label="Aylıq borc xidməti"
            value={value.bureau.monthlyDebtService}
            onChange={(v) => setBureau({ monthlyDebtService: v })}
          />
          <NumberField
            label="Aktiv kredit sayı"
            value={value.bureau.activeFacilityCount}
            onChange={(v) => setBureau({ activeFacilityCount: v })}
          />
          <NumberField
            label="Maksimum gecikmə (gün)"
            value={value.bureau.maxDpd}
            onChange={(v) => setBureau({ maxDpd: v })}
          />
          <NumberField
            label="Cari gecikmə (gün)"
            value={value.bureau.currentDpd}
            onChange={(v) => setBureau({ currentDpd: v })}
          />
          <NumberField
            label="30+ gün hadisə sayı"
            value={value.bureau.dpd30PlusEvents}
            onChange={(v) => setBureau({ dpd30PlusEvents: v })}
          />
          <NumberField
            label="ATB-dəki ekspozisiya"
            value={value.bureau.atbExposure}
            onChange={(v) => setBureau({ atbExposure: v })}
          />
          <NumberField
            label="Qrup üzrə xarici ekspozisiya"
            value={value.bureau.externalGroupExposure}
            onChange={(v) => setBureau({ externalGroupExposure: v })}
          />
          <NumberField
            label="Refinansman olunacaq borc"
            value={value.bureau.debtBeingRefinanced}
            onChange={(v) => setBureau({ debtBeingRefinanced: v })}
          />
        </div>
        <div className="mt-2 border-t border-slate-800 pt-2">
          <CheckField
            label="Bütün əlaqəli şəxslər üzrə AKB çıxarışı alınıb"
            hint="Alınmayıbsa metodologiyaya görə stop faktor yaranır"
            checked={value.bureau.extractsObtainedForAllParties}
            onChange={(v) => setBureau({ extractsObtainedForAllParties: v })}
          />
        </div>
      </Panel>

      <Panel
        title="Təminat"
        subtitle="Girov örtüyü marşrutlaşdırmaya təsir edir"
        actions={
          <CheckField
            label="Girov var"
            checked={value.collateral !== null}
            onChange={(v) =>
              onChange({
                ...value,
                collateral: v ? (DEFAULT_CASE_FORM.collateral as IntakeCollateralInput) : null,
              })
            }
          />
        }
      >
        {value.collateral === null ? (
          <p className="text-[11.5px] text-slate-500">
            Təminatsız sifariş — girov örtüyü 0% kimi qiymətləndiriləcək.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Növ"
              value={value.collateral.type}
              onChange={(v) => setCollateral({ type: v })}
              options={COLLATERAL_TYPES.map((t) => ({ value: t as string, label: COLLATERAL_LABEL_AZ[t] ?? t }))}
            />
            <NumberField
              label="Bazar dəyəri"
              value={value.collateral.marketValue}
              onChange={(v) => setCollateral({ marketValue: v })}
            />
            <NumberField
              label="Likvid dəyəri"
              value={value.collateral.forcedSaleValue}
              onChange={(v) => setCollateral({ forcedSaleValue: v })}
            />
            <div className="flex flex-col justify-end">
              <CheckField
                label="Təsisçiyə məxsusdur"
                checked={value.collateral.ownerIsShareholder}
                onChange={(v) => setCollateral({ ownerIsShareholder: v })}
              />
              <CheckField
                label="Qeydiyyatdan keçib"
                checked={value.collateral.registered}
                onChange={(v) => setCollateral({ registered: v })}
              />
              <CheckField
                label="Sığortalanıb"
                checked={value.collateral.insured}
                onChange={(v) => setCollateral({ insured: v })}
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
