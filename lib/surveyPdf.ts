import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Primary logo used in PDF header – use Hapyjoimage.png for clear, sharp output. */
const LOGO_MODULE = require('../assets/images/Hapyjoimage.png');

let cachedLogoBase64: string | null = null;

async function getLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const asset = Asset.fromModule(LOGO_MODULE);
    await asset.downloadAsync();
    if (!asset.localUri) return '';

    // Resize to 2x display size (360px) so the logo stays sharp when shown at 180px in the PDF.
    // PNG with compress 1 keeps edges crisp (no blur).
    const manipulated = await manipulateAsync(
      asset.localUri,
      [{ resize: { width: 360 } }],
      {
        compress: 1,
        format: SaveFormat.PNG,
        base64: true,
      }
    );

    const base64 = manipulated.base64 ?? '';
    if (!base64) return '';

    const approxBytes = (base64.length * 3) / 4;
    const MAX_BYTES = 280 * 1024;
    if (approxBytes > MAX_BYTES) return '';

    cachedLogoBase64 = base64;
    return base64;
  } catch {
    return '';
  }
}

export interface SurveyPdfData {
  survey: {
    id: string;
    siteId: string;
    surveyDate: string;
    volumeM3: number;
    status: string;
    surveyorId: string;
    createdAt: string;
    approvedById?: string | null;
    approvedAt?: string | null;
  };
  siteName: string;
  surveyorName: string;
  approvedByName?: string | null;
  /** Optional: from create flow (before/after counts, surface, triangles, etc.) */
  calculation?: {
    beforePoints: number;
    afterPoints: number;
    surfaceUtile?: number;
    triangleCount?: number;
    totalFill?: number;
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(value: number): string {
  try {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return value.toFixed(2);
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export async function buildSurveyPdfHtml(data: SurveyPdfData): Promise<string> {
  const logoBase64 = await getLogoBase64();
  const logoImg = logoBase64
    ? `<img src="data:image/png;base64,${logoBase64}" width="180" height="56" style="display:block;object-fit:contain" alt="HAPYJO LTD" />`
    : '<h2 style="margin:0;font-size:20px;font-weight:700;color:#2563eb;">HAPYJO LTD</h2>';

  const s = data.survey;
  const createdAtFormatted = formatDateTime(s.createdAt);
  const approvedAtFormatted = s.approvedAt ? formatDateTime(s.approvedAt) : '—';
  const generatedAt = formatDateTime(new Date().toISOString());

  const tableStyle = 'width:100%;border-collapse:collapse;margin-top:8px;';
  const thStyle = 'text-align:left;padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;border:1px solid #e2e8f0;';
  const tdStyle = 'padding:8px 12px;border:1px solid #e2e8f0;color:#334155;';

  const calcRows =
    data.calculation != null
      ? `
    <tr><td style="${tdStyle}">Before points</td><td style="${tdStyle}">${data.calculation.beforePoints}</td></tr>
    <tr><td style="${tdStyle}">After points</td><td style="${tdStyle}">${data.calculation.afterPoints}</td></tr>
    ${data.calculation.surfaceUtile != null ? `<tr><td style="${tdStyle}">Surface utile (m²)</td><td style="${tdStyle}">${formatNumber(data.calculation.surfaceUtile)}</td></tr>` : ''}
    ${data.calculation.triangleCount != null ? `<tr><td style="${tdStyle}">Triangles</td><td style="${tdStyle}">${data.calculation.triangleCount}</td></tr>` : ''}
    ${(data.calculation.totalFill ?? 0) > 0 ? `<tr><td style="${tdStyle}">Fill volume (m³)</td><td style="${tdStyle}">${formatNumber(data.calculation.totalFill!)}</td></tr>` : ''}
  `
      : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Earthwork Survey Report – HAPYJO LTD</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #334155; padding: 24px 20px; margin: 0; background:#f8fafc; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #2563eb; }
    h1 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.04em; }
    h2 { font-size: 14px; font-weight: 600; color: #0f172a; margin: 18px 0 6px 0; }
    .meta { font-size: 10px; color: #64748b; }
    .section-label { font-size: 11px; font-weight: 600; color:#475569; text-transform: uppercase; letter-spacing: 0.06em; margin-top:16px; }
    .section { margin-bottom: 8px; }
    table { ${tableStyle} }
    th { ${thStyle} }
    td { ${tdStyle} }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; display:flex; justify-content:space-between; gap:12px; }
    .sign-row { display:flex; gap:32px; margin-top:18px; }
    .sign-block { flex:1; font-size:11px; color:#475569; }
    .sign-line { margin-top:24px; border-top:1px solid #cbd5f5; height:1px; }
  </style>
</head>
<body>
  <div class="header">
    <div>${logoImg}</div>
    <div style="text-align:right;">
      <div class="meta">EARTHWORK VOLUME SURVEY REPORT</div>
      <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
    </div>
  </div>

  <h1>Earthwork volume survey</h1>
  <div class="meta" style="margin-bottom:12px;">
    Site: <strong>${escapeHtml(data.siteName)}</strong> • Survey date: <strong>${escapeHtml(s.surveyDate)}</strong>
  </div>

  <div class="section">
    <div class="section-label">1. Project / site information</div>
    <table>
      <tr><th style="${thStyle}">Field</th><th style="${thStyle}">Value</th></tr>
      <tr><td style="${tdStyle}">Site name</td><td style="${tdStyle}">${escapeHtml(data.siteName)}</td></tr>
      <tr><td style="${tdStyle}">Survey date</td><td style="${tdStyle}">${escapeHtml(s.surveyDate)}</td></tr>
      <tr><td style="${tdStyle}">Surveyor</td><td style="${tdStyle}">${escapeHtml(data.surveyorName)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-label">2. Survey & volume summary</div>
    <table>
    <tr><th style="${thStyle}">Field</th><th style="${thStyle}">Value</th></tr>
    <tr><td style="${tdStyle}">Survey date</td><td style="${tdStyle}">${escapeHtml(s.surveyDate)}</td></tr>
    <tr><td style="${tdStyle}">Calculated volume (m³)</td><td style="${tdStyle}"><strong>${formatNumber(s.volumeM3)}</strong></td></tr>
    <tr><td style="${tdStyle}">Status</td><td style="${tdStyle}">${escapeHtml(s.status)}</td></tr>
    <tr><td style="${tdStyle}">Surveyor</td><td style="${tdStyle}">${escapeHtml(data.surveyorName)}</td></tr>
    <tr><td style="${tdStyle}">Submitted at</td><td style="${tdStyle}">${escapeHtml(createdAtFormatted)}</td></tr>
    <tr><td style="${tdStyle}">Approved by</td><td style="${tdStyle}">${data.approvedByName ? escapeHtml(data.approvedByName) : '—'}</td></tr>
    <tr><td style="${tdStyle}">Approved at</td><td style="${tdStyle}">${escapeHtml(approvedAtFormatted)}</td></tr>
  </table>
  </div>

  ${
    calcRows
      ? `
  <div class="section">
    <div class="section-label">3. Calculation details</div>
    <table>
      <tr><th style="${thStyle}">Parameter</th><th style="${thStyle}">Value</th></tr>
      ${calcRows}
    </table>
  </div>`
      : ''
  }

  <div class="section">
    <div class="section-label">4. Sign-off</div>
    <div class="sign-row">
      <div class="sign-block">
        Surveyor: <strong>${escapeHtml(data.surveyorName)}</strong>
        <div class="sign-line"></div>
      </div>
      <div class="sign-block">
        Approved by: <strong>${data.approvedByName ? escapeHtml(data.approvedByName) : '________________'}</strong>
        <div class="sign-line"></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>HAPYJO LTD – Civil engineering earthwork survey report.</span>
    <span>Generated: ${escapeHtml(generatedAt)}</span>
  </div>
</body>
</html>
  `.trim();

  return html;
}

/**
 * Generate a PDF file for the survey and return its URI.
 * Use with expo-sharing to share or save.
 */
export async function printSurveyToPdf(data: SurveyPdfData): Promise<string> {
  const html = await buildSurveyPdfHtml(data);

  // Professional, descriptive PDF file name, e.g.:
  // Hapyjo_SiteA_2025-03-15_Survey_ABC123.pdf
  const safeSite = data.siteName
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safeDate = data.survey.surveyDate.replace(/[^0-9-]/g, '');
  const shortId = data.survey.id.slice(0, 8);
  const fileNameParts = ['Hapyjo', safeSite || 'Site', safeDate || 'Survey', shortId || 'Report'];
  const fileName = fileNameParts.filter(Boolean).join('_');

  // First let expo-print create a temporary file
  const { uri: rawUri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Then rename/move it to a descriptive, data-based file name so that
  // share targets (e.g. WhatsApp) show a professional file name.
  let finalUri = rawUri;
  try {
    // Prefer Expo documentDirectory when available; otherwise derive from rawUri.
    const dir =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((FileSystem as any).documentDirectory as string | undefined) ??
      rawUri.replace(/[^/]+$/, '');
    const target = `${dir}${fileName}.pdf`;
    // Overwrite if a file with the same name already exists.
    try {
      const existing = await FileSystem.getInfoAsync(target);
      if (existing.exists) {
        await FileSystem.deleteAsync(target, { idempotent: true });
      }
    } catch {
      // ignore
    }
    await FileSystem.moveAsync({ from: rawUri, to: target });
    finalUri = target;
  } catch {
    // If rename fails, fall back to the original URI.
  }

  return finalUri;
}
