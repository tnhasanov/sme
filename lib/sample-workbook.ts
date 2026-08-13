'use client';

/**
 * Downloadable intake template.
 *
 * Branch RM workbooks differ, and the parser is built to tolerate that. But a
 * demo needs one file that is guaranteed to parse, and a bank rolling this out
 * needs something to hand the branches. Both come from the same generator, so
 * the template can never drift away from the label vocabulary the parser knows.
 *
 * The figures are synthetic and fully articulated — the balance sheet is
 * derived from the P&L and the cash flow, so every reconciliation the platform
 * runs actually holds. They are not flattering, though: 2025 sales grow 32%
 * while receivable days stretch from 39 to 43, so the analysis produced from
 * the template shows the growth-versus-cash-conversion divergence rather than a
 * clean sheet.
 */

type Row = Array<string | number>;

const BALANCE: Row[] = [
  ['KOB maliyyə şablonu — Balans', '', '', ''],
  ['Bütün məbləğlər AZN ilə', '', '', ''],
  ['Maddə', '2023', '2024', '2025'],
  ['AKTİVLƏR', '', '', ''],
  ['Likvid vəsaitlər (kassa və bank)', 143_000, 199_000, 205_000],
  ['Debitor borclar', 232_000, 268_000, 385_000],
  ['Mal-material ehtiyatları', 362_000, 395_000, 430_000],
  ['Digər dövriyyə aktivləri', 14_000, 14_000, 14_000],
  ['Əsas vəsaitlər', 646_000, 690_000, 739_000],
  ['Digər uzunmüddətli aktivlər', 8_000, 8_000, 8_000],
  ['ÖHDƏLİKLƏR', '', '', ''],
  ['Qısamüddətli bank kreditləri', 118_000, 140_000, 110_000],
  ['Mal təchizatçılarına borc', 196_000, 214_000, 239_000],
  ['Digər cari öhdəliklər', 25_000, 25_000, 25_000],
  ['Uzunmüddətli bank kreditləri', 130_000, 92_000, 54_000],
  ['Digər öhdəliklər', 6_000, 6_000, 6_000],
  ['KAPİTAL', '', '', ''],
  ['Nizamnamə kapitalı', 50_000, 50_000, 50_000],
  ['Bölüşdürülməmiş mənfəət', 920_000, 1_091_000, 1_345_000],
  ['Sahibkar qoyuluşu', 0, 0, 0],
  ['Sahibkar çıxarışı (dövr ərzində)', 40_000, 44_000, 48_000],
];

const INCOME: Row[] = [
  ['KOB maliyyə şablonu — Mənfəət və Zərər (MZH)', '', '', ''],
  ['Maddə', '2023', '2024', '2025'],
  ['Satış', 2_180_000, 2_460_000, 3_247_000],
  ['Satışın maya dəyəri', 1_613_000, 1_820_000, 2_403_000],
  ['Daimi xərclər (əmək haqqı, icarə, kommunal)', 268_000, 301_000, 407_000],
  ['Amortizasiya', 34_000, 36_000, 41_000],
  ['Faiz xərcləri', 44_000, 42_000, 38_000],
  ['Əlavə gəlirlər', 0, 0, 0],
  ['Digər xərclər', 0, 0, 0],
  ['Gəlir vergisi', 45_000, 50_000, 60_000],
];

const CASH_FLOW: Row[] = [
  ['KOB maliyyə şablonu — Pul axını (cari)', '', '', ''],
  ['Maddə', '2023', '2024', '2025'],
  ['Dövrün əvvəlinə nağd qalıq', 96_000, 143_000, 199_000],
  ['Satışdan daxilolmalar', 2_158_000, 2_424_000, 3_130_000],
  ['Təchizatçılara ödənişlər', 1_624_000, 1_835_000, 2_413_000],
  ['Əmək haqqı', 156_000, 174_000, 232_000],
  ['İcarə', 48_000, 52_000, 66_000],
  ['Vergi ödənişləri', 45_000, 50_000, 60_000],
  ['Digər əməliyyat xərcləri', 64_000, 75_000, 109_000],
  ['İnvestisiya (əsas vəsait alışı)', 70_000, 80_000, 90_000],
  ['Sahibkar qoyuluşu', 0, 0, 0],
  ['Sahibkar çıxarışı (dividend)', 40_000, 44_000, 48_000],
  ['Alınmış kreditlər', 70_000, 80_000, 60_000],
  ['Ödənilmiş əsas borc', 90_000, 96_000, 128_000],
  ['Ödənilmiş faizlər', 44_000, 42_000, 38_000],
];

const README: Row[] = [
  ['Şablondan istifadə qaydası'],
  [''],
  ['1. Hər vərəqin adını dəyişməyin — sistem vərəqləri adına görə tanıyır.'],
  ['2. Başlıq sətrində dövrləri il ilə göstərin (məs. 2025). Yarımillik üçün "2025 6 ay" yazın.'],
  ['3. Sətir adlarını saxlayın. Yeni sətir əlavə etmək olar — sistem sətir nömrəsinə deyil, adına baxır.'],
  ['4. Tanınmayan sətirlər itmir: onlar "uyğunlaşdırılmayan sətirlər" cədvəlində göstərilir.'],
  ['5. Oxunmuş hər dəyəri yükləmədən sonra ekranda yoxlaya və düzəldə bilərsiniz.'],
  [''],
  ['Bu fayldakı rəqəmlər sintetikdir və yalnız nümunə məqsədi daşıyır.'],
];

/**
 * The template as a plain grid, so the parser and the test suite can read it
 * without going anywhere near a real file. The test asserts that every
 * reconciliation the platform runs passes on this data — if somebody edits a
 * figure and breaks the articulation, the suite says so rather than the demo
 * quietly rating itself E for data quality.
 */
export const SAMPLE_SHEETS: Array<{ name: string; rows: Row[] }> = [
  { name: 'Təlimat', rows: README },
  { name: 'Balans', rows: BALANCE },
  { name: 'MZH', rows: INCOME },
  { name: 'Pul axını cari', rows: CASH_FLOW },
];

/**
 * SheetJS is ~180 kB, and the intake page is useful before anybody touches a
 * workbook, so it is pulled in on demand rather than at page load.
 */
export async function buildSampleWorkbook() {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const sheet of SAMPLE_SHEETS) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  return wb;
}

export async function downloadSampleWorkbook(fileName = 'KOB-maliyye-sablonu.xlsx'): Promise<void> {
  const XLSX = await import('xlsx');
  XLSX.writeFile(await buildSampleWorkbook(), fileName);
}
