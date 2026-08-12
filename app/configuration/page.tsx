import {
  ACB_SCALES,
  NOTCHING_PROMETEIA_V1,
  SEGMENTATION_PROMETEIA_V1,
  WORST_RATING_V1,
} from '@/config/rating';
import { COLLATERAL_HAIRCUTS_V1, COVENANT_TEMPLATES, POLICY_ATB_CURRENT_V1, STOP_FACTORS_V1 } from '@/config/policy';
import { AUTHORITY_LABEL_AZ, SLA_V1, WORKFLOW_VERSIONS } from '@/config/workflow';
import { BUSINESS_SCORECARD_PROMETEIA_V1, DATA_QUALITY_V1, LEGACY_SCORECARD_V1 } from '@/config/scorecards';
import { ALTMAN_VARIANTS } from '@/domain/calculations/altman';
import { Badge, DataTable, Panel, StatusBadge, Td, Th } from '@/components/ui/primitives';
import { formatValue, operatorSymbol } from '@/domain/rules/policy-engine';
import { aznFull, COLLATERAL_LABEL_AZ } from '@/lib/format';

/**
 * Administrator configuration (§9 Administrator role).
 *
 * Every threshold the platform uses appears here with its provenance. Nothing
 * is hard-coded in a component, and the badge on each row says whether it is
 * ATB's live policy, a proposal, or an inference that still needs confirming.
 */
export default function ConfigurationPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-6 py-5">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Konfiqurasiya</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">
          Bütün hədlər, skorkartlar, siyasət qaydaları və workflow versiyaları — mənbəsi və statusu ilə birlikdə
        </p>
      </header>

      <Panel
        title="Versiya reyestri"
        subtitle="Hər sifariş bu versiyaları dondurur; siyasət sonradan dəyişsə də tarixi nəticə dəyişmir"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Artefakt</Th>
              <Th>Versiya</Th>
              <Th align="center">Status</Th>
              <Th>Qüvvəyə minmə</Th>
              <Th>Mənbə</Th>
            </tr>
          }
        >
          {[
            LEGACY_SCORECARD_V1,
            BUSINESS_SCORECARD_PROMETEIA_V1,
            DATA_QUALITY_V1,
            POLICY_ATB_CURRENT_V1,
            SEGMENTATION_PROMETEIA_V1,
            NOTCHING_PROMETEIA_V1,
            WORST_RATING_V1,
            COLLATERAL_HAIRCUTS_V1,
            SLA_V1,
            ...Object.values(ACB_SCALES),
            ...Object.values(WORKFLOW_VERSIONS),
          ].map((artifact) => (
            <tr key={artifact.id}>
              <Td>
                <div className="text-slate-200">{artifact.label}</div>
                <div className="font-mono text-[9.5px] text-slate-600">{artifact.id}</div>
              </Td>
              <Td>{artifact.version}</Td>
              <Td align="center">
                <StatusBadge status={artifact.status} />
              </Td>
              <Td>{artifact.effectiveFrom}</Td>
              <Td className="max-w-[420px] text-[10.5px] leading-snug text-slate-500">{artifact.sourceRef}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel
        className="mt-4"
        title="AKB reytinq şkalası və ilkin süzgəc"
        subtitle="Prometeia təklifi konfiqurasiya kimi saxlanılır — production siyasəti kimi hard-code edilmir"
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Şkala</Th>
              <Th align="center">Status</Th>
              <Th>Bandlar</Th>
              <Th align="right">İlkin süzgəc həddi</Th>
              <Th>Süzgəc tədbiri</Th>
              <Th>Skoru olmayan</Th>
              <Th align="center">Aktiv</Th>
            </tr>
          }
        >
          {Object.values(ACB_SCALES).map((scale) => (
            <tr key={scale.id}>
              <Td>{scale.label}</Td>
              <Td align="center">
                <StatusBadge status={scale.status} />
              </Td>
              <Td className="text-[10.5px]">
                {scale.bands.map((b) => `${b.min}-${b.max}: ${b.grade}`).join(' · ')}
              </Td>
              <Td align="right">{scale.preScreenRejectBelow ?? 'tətbiq edilmir'}</Td>
              <Td>{scale.preScreenAction}</Td>
              <Td>{scale.noScoreAction}</Td>
              <Td align="center">
                {scale.enabled ? <Badge tone="emerald">Bəli</Badge> : <Badge tone="slate">Xeyr</Badge>}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Biznes təhlili notching" subtitle="Bal → risk bandı → reytinq düzəlişi" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Risk bandı</Th>
                <Th align="right">Bal aralığı</Th>
                <Th align="right">Düzəliş</Th>
              </tr>
            }
          >
            {NOTCHING_PROMETEIA_V1.businessBands.map((b) => (
              <tr key={b.band}>
                <Td>{b.band}</Td>
                <Td align="right">
                  {b.min} – {b.max}
                </Td>
                <Td align="right" className={b.notch < 0 ? 'text-rose-300' : ''}>
                  {b.notch === 0 ? '—' : `${b.notch} pillə`}
                </Td>
              </tr>
            ))}
          </DataTable>
          <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
            Kumulyativ limit: {NOTCHING_PROMETEIA_V1.maxTotalDowngrade} … +{NOTCHING_PROMETEIA_V1.maxTotalUpgrade} pillə.
            Seqment həddi: {aznFull(SEGMENTATION_PROMETEIA_V1.mediumThresholdAzn)} (
            {SEGMENTATION_PROMETEIA_V1.basis}).
          </div>
        </Panel>

        <Panel title="Altman Z variantları" subtitle="Rəy iş kitabında üç variant mövcuddur" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Variant</Th>
                <Th>Əmsallar</Th>
                <Th align="right">Aşağı risk</Th>
                <Th align="right">Yüksək risk</Th>
              </tr>
            }
          >
            {Object.values(ALTMAN_VARIANTS).map((v) => (
              <tr key={v.key} className={v.key === 'PRIVATE' ? 'bg-sky-500/5' : undefined}>
                <Td>
                  {v.labelAz}
                  {v.key === 'PRIVATE' && <div className="text-[9.5px] text-sky-400">standart seçim</div>}
                </Td>
                <Td className="font-mono text-[10px] text-slate-400">
                  {v.coefficients.constant !== 0 ? `${v.coefficients.constant} + ` : ''}
                  {v.coefficients.x1}·X1 + {v.coefficients.x2}·X2 + {v.coefficients.x3}·X3 + {v.coefficients.x4}·X4
                  {v.usesX5 ? ` + ${v.coefficients.x5}·X5` : ''}
                </Td>
                <Td align="right">Z &gt; {v.lowRiskAbove}</Td>
                <Td align="right">Z &lt; {v.highRiskBelow}</Td>
              </tr>
            ))}
          </DataTable>
          <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
            Sərhəd dəyərinin traktovkası: {NOTCHING_PROMETEIA_V1.altman.boundaryInclusive}. Yüksək risk{' '}
            {NOTCHING_PROMETEIA_V1.altman.highRiskNotch} pillə, aşağı risk +{NOTCHING_PROMETEIA_V1.altman.lowRiskNotch}{' '}
            pillə (ilkin reytinq {NOTCHING_PROMETEIA_V1.altman.lowRiskUpgradeBlockedForGrades.join(', ')} olduqda
            tətbiq edilmir).
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Siyasət qaydaları"
        subtitle={`${POLICY_ATB_CURRENT_V1.rules.length} qayda. Alt-sektor → sektor → baza prioriteti tətbiq olunur.`}
        bodyClassName="px-0 py-0"
      >
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Qayda</Th>
              <Th>Göstərici</Th>
              <Th>Əhatə</Th>
              <Th align="right">Norma</Th>
              <Th align="center">Tədbir</Th>
              <Th align="center">Status</Th>
              <Th>Mənbə</Th>
            </tr>
          }
        >
          {POLICY_ATB_CURRENT_V1.rules.map((rule) => (
            <tr key={rule.id}>
              <Td>
                <div className="text-slate-200">{rule.nameAz}</div>
                <div className="text-[10px] text-slate-500">{rule.explanation}</div>
              </Td>
              <Td className="font-mono text-[10px] text-slate-400">{rule.metric}</Td>
              <Td className="text-[10.5px]">
                {rule.scope}
                {rule.sector && <div className="text-slate-500">{rule.sector}</div>}
                {rule.waivedForSectors && (
                  <div className="text-amber-400">İstisna: {rule.waivedForSectors.join(', ')}</div>
                )}
              </Td>
              <Td align="right">
                {operatorSymbol(rule.operator)} {formatValue(rule.threshold, rule.unit)}
              </Td>
              <Td align="center">
                <Badge
                  tone={
                    rule.action === 'STOP' || rule.action === 'REJECT'
                      ? 'rose'
                      : rule.action === 'POLICY_EXCEPTION'
                        ? 'orange'
                        : rule.action === 'WARNING'
                          ? 'amber'
                          : 'slate'
                  }
                >
                  {rule.action}
                </Badge>
              </Td>
              <Td align="center">
                <StatusBadge status={rule.status} />
              </Td>
              <Td className="max-w-[300px] text-[10px] leading-snug text-slate-500">{rule.sourceRef}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel className="mt-4" title="Stop faktorlar" bodyClassName="px-0 py-0">
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Qayda</Th>
              <Th align="center">Aktiv</Th>
              <Th align="center">Avtomatik imtina</Th>
              <Th align="center">Eskalasiya</Th>
              <Th>Seqment / məhsul</Th>
              <Th>Sektor istisnası</Th>
              <Th align="center">Status</Th>
              <Th>Mənbə</Th>
            </tr>
          }
        >
          {STOP_FACTORS_V1.map((sf) => (
            <tr key={sf.id}>
              <Td className="max-w-[300px]">
                <div className="text-slate-200">{sf.labelAz}</div>
                <div className="text-[10px] leading-snug text-slate-500">{sf.description}</div>
              </Td>
              <Td align="center">
                {sf.enabled ? <Badge tone="emerald">Bəli</Badge> : <Badge tone="slate">Xeyr</Badge>}
              </Td>
              <Td align="center">{sf.automaticRejection ? 'Bəli' : 'Xeyr'}</Td>
              <Td align="center">{sf.escalationAllowed ? 'Mümkündür' : 'Yoxdur'}</Td>
              <Td className="text-[10.5px]">
                {sf.applicableSegments.join(', ')}
                <div className="text-slate-500">
                  {sf.applicableProducts === 'ALL' ? 'Bütün məhsullar' : sf.applicableProducts.join(', ')}
                </div>
              </Td>
              <Td className="text-[10.5px] text-amber-300">{sf.waivedForSectors?.join(', ') ?? '—'}</Td>
              <Td align="center">
                <StatusBadge status={sf.status} />
              </Td>
              <Td className="max-w-[240px] text-[10px] leading-snug text-slate-500">{sf.sourceRef}</Td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel
        className="mt-4"
        title="Workflow versiyaları və qərar səlahiyyətləri"
        subtitle="Beş preset ayrıca saxlanılır; heç biri digərini əvəz etmir"
        bodyClassName="px-0 py-0"
      >
        {Object.values(WORKFLOW_VERSIONS).map((wf) => (
          <div key={wf.id} className="border-b border-slate-800 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2">
              <span className="text-[12px] font-medium text-slate-100">{wf.label}</span>
              <StatusBadge status={wf.status} />
              <span className="font-mono text-[9.5px] text-slate-600">{wf.id}</span>
              <span className="text-[10px] text-slate-500">
                Bazası: {wf.routingBasis} · Operator: {wf.collateralRatingOperator === 'OR' ? 'VƏ YA' : 'VƏ'} · İlkin
                süzgəc: {wf.preScreenEnabled ? 'aktiv' : 'deaktiv'}
              </span>
            </div>
            <DataTable
              className="mx-0"
              head={
                <tr>
                  <Th>İnterval</Th>
                  <Th>Təminat şərti</Th>
                  <Th>Qiymətləndirmə</Th>
                  <Th>Qərar</Th>
                  <Th>Eskalasiya</Th>
                  <Th>Şərt</Th>
                  <Th>Notching</Th>
                </tr>
              }
            >
              {wf.buckets.map((b) => (
                <tr key={`${wf.id}-${b.key}`}>
                  <Td>{b.labelAz}</Td>
                  <Td className="text-[10.5px]">{b.collateralCondition}</Td>
                  <Td className="text-[10.5px]">{AUTHORITY_LABEL_AZ[b.assessmentAuthority]}</Td>
                  <Td className="text-[10.5px] text-slate-200">{AUTHORITY_LABEL_AZ[b.decisionAuthority]}</Td>
                  <Td className="text-[10.5px]">
                    {b.escalationAuthority ? AUTHORITY_LABEL_AZ[b.escalationAuthority] : '—'}
                  </Td>
                  <Td className="text-[10px] text-slate-500">{b.escalationCondition}</Td>
                  <Td className="text-[10px] text-slate-400">{b.notchingLayers.join(' + ') || '—'}</Td>
                </tr>
              ))}
            </DataTable>
            {wf.knownAmbiguities.length > 0 && (
              <ul className="space-y-1 px-4 py-2">
                {wf.knownAmbiguities.map((amb, i) => (
                  <li key={i} className="text-[10.5px] leading-relaxed text-amber-300">
                    • {amb}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Girov diskontları" subtitle={COLLATERAL_HAIRCUTS_V1.sourceRef} bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Girov növü</Th>
                <Th align="right">Diskont</Th>
                <Th align="center">Uyğun örtüyə daxildir</Th>
              </tr>
            }
          >
            {Object.entries(COLLATERAL_HAIRCUTS_V1.haircuts).map(([type, haircut]) => (
              <tr key={type}>
                <Td>{COLLATERAL_LABEL_AZ[type] ?? type}</Td>
                <Td align="right">{haircut}%</Td>
                <Td align="center">
                  {COLLATERAL_HAIRCUTS_V1.ineligibleTypes.includes(type) ? (
                    <Badge tone="slate">Xeyr</Badge>
                  ) : (
                    <Badge tone="emerald">Bəli</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel title="Kovenant şablonları" bodyClassName="px-0 py-0">
          <DataTable
            className="mx-0"
            head={
              <tr>
                <Th>Kovenant</Th>
                <Th>Göstərici</Th>
                <Th align="right">Standart hədd</Th>
                <Th>Tezlik</Th>
              </tr>
            }
          >
            {COVENANT_TEMPLATES.map((t) => (
              <tr key={t.key}>
                <Td>{t.labelAz}</Td>
                <Td className="font-mono text-[10px] text-slate-400">{t.metric}</Td>
                <Td align="right">
                  {t.operator === 'GTE' ? '≥' : '≤'} {t.defaultThreshold}
                </Td>
                <Td>{t.defaultFrequency}</Td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>

      <Panel className="mt-4" title="Yekun Rəy skorkartı" subtitle={LEGACY_SCORECARD_V1.sourceRef} bodyClassName="px-0 py-0">
        <DataTable
          className="mx-0"
          head={
            <tr>
              <Th>Meyar</Th>
              <Th align="right">Çəki</Th>
              <Th>Aqreqasiya</Th>
              <Th align="center">Qlobal stop</Th>
              <Th>Bəndlər</Th>
            </tr>
          }
        >
          {LEGACY_SCORECARD_V1.categories.map((cat) => (
            <tr key={cat.key}>
              <Td>
                {cat.labelAz}
                <div className="text-[10px] text-slate-500">{cat.labelEn}</div>
              </Td>
              <Td align="right">{cat.weight}%</Td>
              <Td className="text-[10.5px]">
                {cat.aggregation === 'MEAN_OF_MANUAL_SCORES' ? 'Bəndlərin orta balı' : 'Çəkili cəm'}
              </Td>
              <Td align="center">
                {cat.participatesInGlobalStop ? <Badge tone="rose">Bəli</Badge> : <Badge tone="slate">Xeyr</Badge>}
              </Td>
              <Td className="max-w-[520px] text-[10.5px] leading-snug text-slate-400">
                {cat.components.map((cp) => `${cp.labelAz} (${cp.weightWithinCategory}%)`).join(' · ')}
              </Td>
            </tr>
          ))}
        </DataTable>
        <div className="border-t border-slate-800 px-4 py-2 text-[10.5px] text-slate-500">
          Risk bandları: {LEGACY_SCORECARD_V1.bands.map((b) => `${b.min}+ ${b.labelAz}`).join(' · ')}. Kredit
          tarixçəsi mövcud olmadıqda kredit tarixçəsi meyarı 60% ilə məhdudlaşdırılır.
        </div>
      </Panel>
    </div>
  );
}
