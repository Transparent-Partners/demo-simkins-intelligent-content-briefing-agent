'use client';

import { useState } from 'react';
import { MediaContext, MediaPlanRow, MediaPlanUploader } from '../components/MediaPlanUploader';

type FeedRow = {
  row_id: string;
  creative_filename: string;
  reporting_label: string;
  is_default: boolean;
  asset_slot_a_path?: string | null;
  asset_slot_b_path?: string | null;
  asset_slot_c_path?: string | null;
  logo_asset_path?: string | null;
  copy_slot_a_text?: string | null;
  copy_slot_b_text?: string | null;
  copy_slot_c_text?: string | null;
  legal_disclaimer_text?: string | null;
  cta_button_text?: string | null;
  font_color_hex?: string | null;
  cta_bg_color_hex?: string | null;
  background_color_hex?: string | null;
  platform_id: string;
  placement_dimension: string;
  asset_format_type: string;
  audience_id?: string | null;
  geo_targeting?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  trigger_condition?: string | null;
  destination_url?: string | null;
  utm_suffix?: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// Simple demo stubs so the page is usable before full wiring from the main app.
const DEMO_AUDIENCE_STRATEGY = [
  { audience: 'Prospects', headline: 'Discover Aurora’s “Night Reset” ritual.' },
  { audience: 'Trialists', headline: 'Turn your first week into a new sleep habit.' },
];

const DEMO_ASSET_LIST = [
  {
    audience: 'Prospects',
    image_url: 'https://example.com/night-reset.jpg',
    exit_url: 'https://example.com/night-reset',
  },
  {
    audience: 'Trialists',
    image_url: 'https://example.com/trialist.jpg',
    exit_url: 'https://example.com/trialist',
  },
];

const DEMO_MEDIA_PLAN_ROWS: MediaPlanRow[] = [
  { 'Placement ID': 'PL-001', 'Target Audience': 'Prospects' },
  { 'Placement ID': 'PL-002', 'Target Audience': 'Trialists' },
];

export default function FeedReviewPage() {
  const [mediaContext, setMediaContext] = useState<MediaContext | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRows = mediaContext?.rows?.length ? mediaContext.rows : DEMO_MEDIA_PLAN_ROWS;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/generate-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience_strategy: DEMO_AUDIENCE_STRATEGY,
          asset_list: DEMO_ASSET_LIST,
          media_plan_rows: mediaRows,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Failed with status ${res.status}`);
      }

      const data = await res.json();
      setFeed(data.feed || []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to generate feed.');
    } finally {
      setLoading(false);
    }
  };

  const updateFeedCell = (index: number, key: keyof FeedRow, value: string) => {
    setFeed((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  };

  const handleExportCsv = () => {
    if (!feed.length) return;
    const headers = [
      'row_id',
      'creative_filename',
      'reporting_label',
      'is_default',
      'asset_slot_a_path',
      'asset_slot_b_path',
      'asset_slot_c_path',
      'logo_asset_path',
      'copy_slot_a_text',
      'copy_slot_b_text',
      'copy_slot_c_text',
      'legal_disclaimer_text',
      'cta_button_text',
      'font_color_hex',
      'cta_bg_color_hex',
      'background_color_hex',
      'platform_id',
      'placement_dimension',
      'asset_format_type',
      'audience_id',
      'geo_targeting',
      'date_start',
      'date_end',
      'trigger_condition',
      'destination_url',
      'utm_suffix',
    ];
    const rows = feed.map((r) => headers.map((h) => (r as any)[h] ?? '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dco_feed.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBrief = async () => {
    if (!feed.length) return;

    try {
      const res = await fetch(`${API_BASE_URL}/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: {
            campaign_name: 'DCO Feed – Production Brief',
            bill_of_materials: feed.map((row) => ({
              asset_id: row.creative_filename,
              concept: row.reporting_label,
              format: row.asset_format_type,
            })),
          },
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dco_production_brief.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">DCO Feed Review</h1>
            <p className="text-sm text-slate-500">
              Inspect the generated dynamic creative feed before handing it off to production.
            </p>
          </div>
        </header>

        {/* Media plan ingestor */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Media Plan Context
          </h2>
          <p className="text-[11px] text-slate-500 max-w-xl">
            Upload a media plan CSV to override the demo rows. Audience + placement
            information becomes the container for the DCO feed.
          </p>
          <div className="border border-slate-200 rounded-xl bg-white p-4">
            <MediaPlanUploader onMediaContextChange={setMediaContext} />
          </div>
        </section>

        {/* Controls */}
        <section className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {loading ? 'Generating…' : 'Generate DCO Feed'}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!feed.length}
            className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-300 text-slate-700 bg-white disabled:opacity-50"
          >
            Export to CSV
          </button>
          <button
            onClick={handleExportBrief}
            disabled={!feed.length}
            className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-300 text-slate-700 bg-white disabled:opacity-50"
          >
            Export Production Brief (PDF)
          </button>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </section>

        {/* Feed table */}
        <section className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
            <p className="text-[11px] text-slate-500">
              {feed.length
                ? `Showing ${feed.length} rows in the generated feed.`
                : 'No feed generated yet. Run "Generate DCO Feed" to see results.'}
            </p>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                    Row ID
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                    Creative Filename
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                    Reporting Label
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                    Platform / Dimension
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                    Asset Type
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                    Destination URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {feed.map((row, index) => (
                  <tr key={row.row_id} className="odd:bg-white even:bg-slate-50/40">
                    <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700">
                      {row.row_id}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <input
                        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                        value={row.creative_filename}
                        onChange={(e) => updateFeedCell(index, 'creative_filename', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <input
                        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                        value={row.reporting_label}
                        onChange={(e) => updateFeedCell(index, 'reporting_label', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <input
                        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                        value={row.platform_id + ' · ' + row.placement_dimension}
                        onChange={(e) => {
                          const [platformPart, dimensionPart] = e.target.value.split('·').map((s) => s.trim());
                          updateFeedCell(index, 'platform_id', platformPart || '');
                          updateFeedCell(index, 'placement_dimension', dimensionPart || '');
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <input
                        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                        value={row.asset_format_type}
                        onChange={(e) => updateFeedCell(index, 'asset_format_type', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <input
                        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                        value={row.destination_url ?? ''}
                        onChange={(e) => updateFeedCell(index, 'destination_url', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}


