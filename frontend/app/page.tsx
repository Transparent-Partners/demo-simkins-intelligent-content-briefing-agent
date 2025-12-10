'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

// Default to same-origin in the browser; fall back to localhost for local dev/server-side
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window === 'undefined' ? 'http://localhost:8000' : '');

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// MatrixRow is intentionally flexible: it supports the Strategy Matrix defaults
// plus any user-defined columns the strategist adds.
type MatrixRow = {
  [key: string]: string | undefined;
};

// MatrixFieldKey is string so we can support arbitrary user-defined columns.
type MatrixFieldKey = string;

type MatrixFieldConfig = {
  key: MatrixFieldKey;
  label: string;
  isCustom?: boolean;
};

// Strategic Matrix defaults
const PRIMARY_MATRIX_KEYS: MatrixFieldKey[] = [
  'segment_source',
  'segment_id',
  'segment_name',
  'segment_size',
  'priority_level',
  'segment_description',
  'key_insight',
  'current_perception',
  'desired_perception',
  'primary_message_pillar',
  'call_to_action_objective',
  'tone_guardrails',
];

const EXECUTION_MATRIX_KEYS: MatrixFieldKey[] = [
  'platform_environments',
  'contextual_triggers',
];

const SYSTEM_MATRIX_KEYS: MatrixFieldKey[] = ['asset_id', 'specs_lookup_key', 'notes'];

const BASE_MATRIX_FIELDS: MatrixFieldConfig[] = [
  // PRIMARY FIELDS – Identity Block
  { key: 'segment_source', label: 'Segment Source' },
  { key: 'segment_id', label: 'Segment ID' },
  { key: 'segment_name', label: 'Segment Name' },
  { key: 'segment_size', label: 'Segment Size' },
  { key: 'priority_level', label: 'Priority Level' },

  // Strategic Core
  { key: 'segment_description', label: 'Segment Description' },
  { key: 'key_insight', label: 'Key Insight' },
  { key: 'current_perception', label: 'Current Perception' },
  { key: 'desired_perception', label: 'Desired Perception' },

  // Message Architecture
  { key: 'primary_message_pillar', label: 'Primary Message Pillar' },
  { key: 'call_to_action_objective', label: 'CTA Objective' },
  { key: 'tone_guardrails', label: 'Tone Guardrails' },

  // Channel & Format Selection
  { key: 'platform_environments', label: 'Platform Environments' },
  { key: 'contextual_triggers', label: 'Contextual Triggers' },

  // SYSTEM FIELDS (initially hidden in UI)
  { key: 'asset_id', label: 'Asset ID' },
  { key: 'specs_lookup_key', label: 'Specs Key' },
  { key: 'notes', label: 'Notes' },
];

// Brief field configuration for the live brief editor
type BriefFieldKey = string;

type BriefFieldConfig = {
  key: BriefFieldKey;
  label: string;
  multiline?: boolean;
  isCustom?: boolean;
};

const BASE_BRIEF_FIELDS: BriefFieldConfig[] = [
  { key: 'campaign_name', label: 'Campaign Name' },
  { key: 'single_minded_proposition', label: 'Single-minded Proposition', multiline: true },
  { key: 'primary_audience', label: 'Primary Audience', multiline: true },
  { key: 'narrative_brief', label: 'Narrative Brief', multiline: true },
];

type ContentMatrixTemplate = {
  id: string;
  name: string;
  description: string;
  rows: MatrixRow[];
};

type ModConBriefState = {
  campaign_name: string;
  smp: string;
  audiences: string[];
  kpis: string[];
  flight_dates: Record<string, string>;
  status: 'Draft' | 'Approved';
};

type Spec = {
  id: string;
  platform: string;
  placement: string;
  width: number;
  height: number;
  orientation: string;
  media_type: string;
  notes?: string | null;
};

type ProductionBatch = {
  id: string;
  campaign_id: string;
  strategy_segment_id: string;
  concept_id: string;
  batch_name: string;
};

type ProductionAsset = {
  id: string;
  batch_id: string;
  asset_name: string;
  platform: string;
  placement: string;
  spec_dimensions: string;
  spec_details: any;
  status: string;
  assignee?: string | null;
  asset_type: string;
  visual_directive: string;
  copy_headline: string;
  source_asset_requirements?: string | null;
  adaptation_instruction?: string | null;
  file_url?: string | null;
};

type DeliveryDestinationRow = {
  platform_name: string;
  spec_id: string;
  format_name: string;
  special_notes: string;
};

type ProductionJobRow = {
  job_id: string;
  creative_concept: string;
  asset_type: string;
  destinations: DeliveryDestinationRow[];
  technical_summary: string;
  status: string;
};

type ProductionMatrixLine = {
  id: string;
  audience: string;
  concept_id: string;
  spec_id: string;
  destinations: string; // comma-separated partners/placements
  notes: string;
  is_feed: boolean;
  feed_template: string;
  template_id?: string;
  feed_id?: string;
  feed_asset_id?: string;
  production_details?: string;
};

// Feed Builder (Asset Feed) row type mirrors the Master Feed Variable Set
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
  // Support user-defined custom variables
  [key: string]: string | boolean | null | undefined;
};

type FeedFieldKey = string;

type FeedFieldConfig = {
  key: FeedFieldKey;
  label: string;
  isCustom?: boolean;
};

const BASE_FEED_FIELDS: FeedFieldConfig[] = [
  { key: 'row_id', label: 'Row ID' },
  { key: 'creative_filename', label: 'Creative Filename' },
  { key: 'reporting_label', label: 'Reporting Label' },
  { key: 'is_default', label: 'Is Default?' },
  { key: 'asset_slot_a_path', label: 'Asset Slot A (Primary)' },
  { key: 'asset_slot_b_path', label: 'Asset Slot B (Secondary)' },
  { key: 'asset_slot_c_path', label: 'Asset Slot C (Tertiary)' },
  { key: 'logo_asset_path', label: 'Logo Asset Path' },
  { key: 'copy_slot_a_text', label: 'Copy Slot A (Hook)' },
  { key: 'copy_slot_b_text', label: 'Copy Slot B (Support)' },
  { key: 'copy_slot_c_text', label: 'Copy Slot C (CTA)' },
  { key: 'legal_disclaimer_text', label: 'Legal Disclaimer' },
  { key: 'cta_button_text', label: 'CTA Button Text' },
  { key: 'font_color_hex', label: 'Font Color Hex' },
  { key: 'cta_bg_color_hex', label: 'CTA BG Color Hex' },
  { key: 'background_color_hex', label: 'Background Color Hex' },
  { key: 'platform_id', label: 'Platform ID' },
  { key: 'placement_dimension', label: 'Placement Dimension' },
  { key: 'asset_format_type', label: 'Asset Format Type' },
  { key: 'audience_id', label: 'Audience ID' },
  { key: 'geo_targeting', label: 'Geo Targeting' },
  { key: 'date_start', label: 'Date Start' },
  { key: 'date_end', label: 'Date End' },
  { key: 'trigger_condition', label: 'Trigger Condition' },
  { key: 'destination_url', label: 'Destination URL' },
  { key: 'utm_suffix', label: 'UTM Suffix' },
];

const INITIAL_MATRIX_LIBRARY: ContentMatrixTemplate[] = [
  {
    id: 'MTX-001',
    name: 'Aurora Sleep OS – Always-on funnel',
    description: 'Top/mid/bottom-funnel structure for a modular wellness subscription.',
    rows: [
      {
        id: 'VID-001',
        audience_segment: 'Broad prospects',
        funnel_stage: 'Awareness',
        trigger: 'Always on',
        channel: 'Meta Reels',
        format: '9:16 Video',
        message: 'Before / after story of wired-and-tired professional discovering Sleep OS.',
        variant: 'Emotional pain point',
      },
      {
        id: 'VID-002',
        audience_segment: 'High-intent site visitors',
        funnel_stage: 'Consideration',
        trigger: 'Visited pricing page',
        channel: 'YouTube In-Stream',
        format: '16:9 Video',
        message: 'Explainer on how scenes, routines, and data tie together in 7 days.',
        variant: 'Mechanics / proof',
      },
      {
        id: 'IMG-001',
        audience_segment: 'Trial starters',
        funnel_stage: 'Conversion',
        trigger: 'Started trial, no routine created',
        channel: 'CRM Email',
        format: 'Hero image + modules',
        message: 'Nudge to build first “Night Reset” routine with simple steps.',
        variant: 'Onboarding assist',
      },
    ],
  },
  {
    id: 'MTX-002',
    name: 'VoltCharge Go – B2B demand gen',
    description: 'Role-based matrix for HR, Facilities, and Finance leads.',
    rows: [
      {
        id: 'CAR-001',
        audience_segment: 'HR leaders',
        funnel_stage: 'Awareness',
        trigger: 'Matched to HR persona',
        channel: 'LinkedIn Feed',
        format: 'Carousel',
        message: 'Reframing parking as part of the benefits stack with employee vignettes.',
        variant: 'Benefits story',
      },
      {
        id: 'CAR-002',
        audience_segment: 'Facilities leaders',
        funnel_stage: 'Consideration',
        trigger: 'Visited solutions page',
        channel: 'LinkedIn Feed',
        format: 'Carousel',
        message: 'Operational simplicity, uptime guarantees, and site rollout playbook.',
        variant: 'Operations / proof',
      },
      {
        id: 'PDF-001',
        audience_segment: 'Buying committee',
        funnel_stage: 'Decision',
        trigger: 'Requested demo',
        channel: 'Sales enablement',
        format: '1-pager PDF',
        message: 'Shared economic case and KPI grid by role (HR, Facilities, Finance).',
        variant: 'Business case',
      },
    ],
  },
  {
    id: 'MTX-003',
    name: 'HarvestBox – Multi-family resident journey',
    description: 'Resident moments across awareness, move-in, and retention.',
    rows: [
      {
        id: 'VID-101',
        audience_segment: 'Prospective residents',
        funnel_stage: 'Awareness',
        trigger: 'Geo-targeted near property',
        channel: 'Short-form video',
        format: '9:16 Video',
        message: 'Week-in-the-life of residents using micro-market for real moments.',
        variant: 'Lifestyle montage',
      },
      {
        id: 'IMG-201',
        audience_segment: 'New move-ins',
        funnel_stage: 'Onboarding',
        trigger: 'Move-in date',
        channel: 'Welcome email',
        format: 'Hero image + secondary tiles',
        message: 'Orientation to micro-market, hours, and building-specific perks.',
        variant: 'Welcome / orientation',
      },
      {
        id: 'IMG-301',
        audience_segment: 'Long-term residents',
        funnel_stage: 'Retention',
        trigger: '12+ months tenure',
        channel: 'In-building signage',
        format: 'Poster',
        message: 'Celebrate favorite resident moments and new seasonal offerings.',
        variant: 'Community / loyalty',
      },
    ],
  },
];

type HistoricalBrief = {
  id: string;
  campaign_name: string;
  single_minded_proposition: string;
  primary_audience: string;
  narrative_brief: string;
};

type Concept = {
  id: string;
  asset_id: string;
  title: string;
  description: string;
  notes: string;
  kind?: 'image' | 'video' | 'copy';
  status?: 'idle' | 'generating' | 'ready' | 'error';
  generatedPrompt?: string;
};

// --- Sample Data ---
const SAMPLE_JSON = {
  "campaign_name": "Summer Glow 2024",
  "single_minded_proposition": "Radiance that lasts all day.",
  "primary_audience": "Women 25-40, urban professionals, interested in clean beauty.",
  "bill_of_materials": [
    {
      "asset_id": "VID-001",
      "format": "9:16 Video",
      "concept": "Morning Routine ASMR",
      "source_type": "New Shoot",
      "specs": "1080x1920, 15s, Sound On"
    },
    {
      "asset_id": "IMG-001",
      "format": "4:5 Static",
      "concept": "Product Hero Shot on Sand",
      "source_type": "Stock Composite",
      "specs": "1080x1350, JPEG"
    }
  ],
  "logic_map": [
    {
      "condition": "IF Weather = 'Sunny'",
      "action": "SHOW 'Beach Day' Variant"
    },
    {
      "condition": "IF Audience = 'Cart Abandoner'",
      "action": "SHOW '10% Off' Overlay"
    }
  ],
  "production_notes": "Ensure all lighting is natural. No heavy filters. Diversity in casting is mandatory."
};

const SAMPLE_NARRATIVE = `
CAMPAIGN: Summer Glow 2024
--------------------------------------------------
SINGLE MINDED PROPOSITION: 
"Radiance that lasts all day."

PRIMARY AUDIENCE:
Women 25-40, urban professionals, interested in clean beauty. 
They value authenticity and efficient routines.

CREATIVE DIRECTION:
The visual language should be warm, sun-drenched, and effortless. 
Avoid over-styling. Focus on "Golden Hour" lighting.

PRODUCTION NOTES:
- Ensure all lighting is natural. 
- No heavy filters. 
- Diversity in casting is mandatory to reflect our urban audience.
`;

const SAMPLE_MATRIX = [
  { id: "VID-001", audience: "Broad", trigger: "Always On", content: "Morning Routine ASMR", format: "9:16 Video" },
  { id: "IMG-001", audience: "Retargeting", trigger: "Cart Abandon", content: "Product Hero + Discount", format: "4:5 Static" },
  { id: "VID-002", audience: "Loyalty", trigger: "Purchase > 30d", content: "Replenish Reminder", format: "9:16 Video" },
];

const DEMO_SPECS: Spec[] = [
  {
    id: 'DEMO_META_STORY',
    platform: 'Meta',
    placement: 'Stories / Reels',
    width: 1080,
    height: 1920,
    orientation: 'Vertical',
    media_type: 'video',
    notes: '15s max, safe zones respected.',
  },
  {
    id: 'DEMO_TIKTOK_IN_FEED',
    platform: 'TikTok',
    placement: 'In-Feed',
    width: 1080,
    height: 1920,
    orientation: 'Vertical',
    media_type: 'video',
    notes: '9:16, 15-30s, include captions.',
  },
  {
    id: 'DEMO_YT_BUMPER',
    platform: 'YouTube',
    placement: 'Bumper',
    width: 1920,
    height: 1080,
    orientation: 'Horizontal',
    media_type: 'video',
    notes: '6s cap, :06 slate acceptable.',
  },
  {
    id: 'DEMO_DISPLAY_MPU',
    platform: 'Google Display',
    placement: 'MPU',
    width: 300,
    height: 250,
    orientation: 'Square-ish',
    media_type: 'image_or_html5',
    notes: 'Max 150kb, avoid dense legal.',
  },
];

// Local spec catalog – no API dependency.
const PRESET_SPECS: Spec[] = [
  // Meta
  { id: 'META_REELS_9x16', platform: 'Meta', placement: 'Reels / Stories', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: '15-60s; avoid top/bottom UI zones.' },
  { id: 'META_FEED_1x1', platform: 'Meta', placement: 'Feed', width: 1080, height: 1080, orientation: 'Square', media_type: 'image_or_video', notes: 'Center focal area; minimal text.' },
  { id: 'META_FEED_4x5', platform: 'Meta', placement: 'Feed 4:5', width: 1080, height: 1350, orientation: 'Vertical', media_type: 'image_or_video', notes: 'Treat as tall card; keep CTA mid-frame.' },
  { id: 'META_INSTREAM_16x9', platform: 'Meta', placement: 'In-Stream', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'Sound-on; avoid lower-third overlays.' },
  // TikTok
  { id: 'TIKTOK_IN_FEED_9x16', platform: 'TikTok', placement: 'In-Feed', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Hook in first 2s; keep text off right/bottom edges.' },
  { id: 'TIKTOK_SPARK_9x16', platform: 'TikTok', placement: 'Spark Ads', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Native post re-use; captions high.' },
  // YouTube
  { id: 'YOUTUBE_SHORTS_9x16', platform: 'YouTube', placement: 'Shorts', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Vertical; central band safe.' },
  { id: 'YOUTUBE_INSTREAM_16x9', platform: 'YouTube', placement: 'In-Stream', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'Sound-on; TV-safe margins.' },
  { id: 'YOUTUBE_BUMPER_16x9', platform: 'YouTube', placement: 'Bumper', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: '6s cap; message by 2s.' },
  // LinkedIn
  { id: 'LINKEDIN_IMAGE_1x1', platform: 'LinkedIn', placement: 'Sponsored Image', width: 1200, height: 1200, orientation: 'Square', media_type: 'image', notes: 'B2B clarity; sparse text.' },
  { id: 'LINKEDIN_VIDEO_1x1', platform: 'LinkedIn', placement: 'Sponsored Video 1:1', width: 1080, height: 1080, orientation: 'Square', media_type: 'video', notes: 'Subtitles above lower quarter.' },
  { id: 'LINKEDIN_VIDEO_16x9', platform: 'LinkedIn', placement: 'Sponsored Video 16:9', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'Assume sound-off; clear supers.' },
  // X / Twitter
  { id: 'X_IMAGE_16x9', platform: 'X', placement: 'Promoted Image 16:9', width: 1600, height: 900, orientation: 'Horizontal', media_type: 'image', notes: 'Avoid corner copy; tweet text carries message.' },
  { id: 'X_IMAGE_1x1', platform: 'X', placement: 'Promoted Image 1:1', width: 1200, height: 1200, orientation: 'Square', media_type: 'image', notes: 'Square preview; avoid tiny legal.' },
  { id: 'X_VIDEO_9x16', platform: 'X', placement: 'Vertical Video', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Subtitles above progress bar.' },
  // Google Display / Open Web (IAB)
  { id: 'GDN_MPU_300x250', platform: 'Open Web', placement: 'MPU', width: 300, height: 250, orientation: 'Rectangle', media_type: 'image_or_html5', notes: 'Max 150kb; logo + short CTA.' },
  { id: 'GDN_LEADERBOARD_728x90', platform: 'Open Web', placement: 'Leaderboard', width: 728, height: 90, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Tight height; prioritize logo + CTA.' },
  { id: 'GDN_SUPER_LEADERBOARD_970x90', platform: 'Open Web', placement: 'Super Leaderboard', width: 970, height: 90, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Wide canvas; maintain safe margins for responsive resize.' },
  { id: 'GDN_HALF_PAGE_300x600', platform: 'Open Web', placement: 'Half Page', width: 300, height: 600, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Tall canvas; hook in top half.' },
  { id: 'GDN_BILLBOARD_970x250', platform: 'Open Web', placement: 'Billboard', width: 970, height: 250, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Hero-friendly; maintain safe margins.' },
  { id: 'GDN_SKYSCRAPER_160x600', platform: 'Open Web', placement: 'Wide Skyscraper', width: 160, height: 600, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Stack vertically; avoid dense copy at bottom.' },
  { id: 'GDN_MED_RECT_336x280', platform: 'Open Web', placement: 'Med Rectangle', width: 336, height: 280, orientation: 'Rectangle', media_type: 'image_or_html5', notes: 'Larger MPU variant; keep hierarchy simple.' },
  { id: 'GDN_SQUARE_250x250', platform: 'Open Web', placement: 'Square', width: 250, height: 250, orientation: 'Square', media_type: 'image_or_html5', notes: 'Compact square; minimal copy.' },
  { id: 'GDN_MOBILE_LEADERBOARD_320x50', platform: 'Open Web', placement: 'Mobile Leaderboard', width: 320, height: 50, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Extremely short; logo + 1-2 words.' },
  { id: 'GDN_MOBILE_LARGE_320x100', platform: 'Open Web', placement: 'Mobile Banner', width: 320, height: 100, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'More vertical room than 320x50; keep concise CTA.' },
  { id: 'GDN_MOBILE_BANNER_300x50', platform: 'Open Web', placement: 'Mobile Banner 300x50', width: 300, height: 50, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Small; favor logo + CTA only.' },
  { id: 'GDN_BANNER_468x60', platform: 'Open Web', placement: 'Banner 468x60', width: 468, height: 60, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Legacy size; keep elements centered.' },
  // CTV
  { id: 'CTV_FULLSCREEN_16x9', platform: 'CTV', placement: 'Full Screen', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'TV-safe framing; allow overscan margins.' },
  { id: 'CTV_QUARTERSCREEN_16x9', platform: 'CTV', placement: 'Quarter Screen Overlay', width: 960, height: 540, orientation: 'Horizontal', media_type: 'video_or_image', notes: 'Overlay; avoid lower-third UI.' },
  { id: 'CTV_SLATE_16x9', platform: 'CTV', placement: 'End Slate', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video_or_image', notes: '3-5s slate; large CTA and URL.' },
  // Mobile (IAB New Ad Portfolio common units)
  { id: 'MOB_INLINE_RECT_300x250', platform: 'Mobile', placement: 'Inline Rectangle', width: 300, height: 250, orientation: 'Rectangle', media_type: 'image_or_html5', notes: 'Inline mobile rectangle; common in content feeds.' },
  { id: 'MOB_BANNER_320x50', platform: 'Mobile', placement: 'Standard Banner', width: 320, height: 50, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Standard mobile banner; ultra-limited height.' },
  { id: 'MOB_LARGE_BANNER_320x100', platform: 'Mobile', placement: 'Large Banner', width: 320, height: 100, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'More height for clearer CTA.' },
  { id: 'MOB_FULLPAGE_PORTRAIT_320x480', platform: 'Mobile', placement: 'Fullscreen Portrait', width: 320, height: 480, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Fullscreen interstitial; respect app safe areas.' },
  { id: 'MOB_FULLPAGE_LANDSCAPE_480x320', platform: 'Mobile', placement: 'Fullscreen Landscape', width: 480, height: 320, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Landscape interstitial; avoid edge-hugging CTAs.' },
  { id: 'MOB_TABLET_PORTRAIT_768x1024', platform: 'Mobile', placement: 'Tablet Portrait', width: 768, height: 1024, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Tablet portrait; maintain generous padding.' },
  { id: 'MOB_TABLET_LANDSCAPE_1024x768', platform: 'Mobile', placement: 'Tablet Landscape', width: 1024, height: 768, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Tablet landscape; keep focal area centered.' },
];

const HISTORICAL_BRIEFS: HistoricalBrief[] = [
  {
    id: "HB-001",
    campaign_name: "Aurora Sleep OS Launch",
    single_minded_proposition: "Turn any bedroom into a personalized sleep studio in one week.",
    primary_audience:
      "Urban professionals 28–45 who feel constantly 'wired and tired' and are willing to invest in wellness tech.",
    narrative_brief: `
BACKGROUND
Aurora is a subscription-based "Sleep OS" that orchestrates light, sound, temperature, and routine across devices to fix poor sleep hygiene in 7 days. The product is inherently modular: scenes, soundscapes, routines, and tips can all be mixed and matched based on data signals.

OBJECTIVE
Drive platform sign-ups and 90-day retention by repositioning "sleep tracking" from passive monitoring to active transformation, and by building a reusable content system that can recombine across audiences, stages, and channels.

SINGLE MINDED PROPOSITION
Turn any bedroom into a personalized sleep studio in one week.

PRIMARY AUDIENCE
Urban professionals 28–45 who feel constantly "wired and tired", have tried meditation / tracking apps, and now want a solution that actually changes their environment, not just their data. They are tech-forward, over-scheduled, and skeptical of wellness fluff.

MODULAR CONTENT STRATEGY
- Atomic units:
  - Problem frames (e.g., "doom scrolling at 1:30am", "3am wake-up", "weekend catch-up sleep").
  - Sleep studio scenes (Night Reset, Deep Focus, Gentle Wakeup).
  - Proof points (improved sleep efficiency %, fewer wake-ups, routine streaks).
  - Coaching micro-tips (30–60 character tiles that can travel across channels).
- Dimensions for recombination:
  - Audience sensitivity (biohackers vs burned-out professionals).
  - Funnel stage (Awareness = emotional consequences, Consideration = OS mechanics, Conversion = 7-day trial offer).
  - Channel constraints (short vertical video, static tiles, email modules).

CONTENT MATRIX INTENT
- Upper-funnel: 9:16 and 16:9 video stories that dramatize the "before" and "after" state using modular scenes and VO lines. Variants pivot on different pain points (anxiety, focus, mood).
- Mid-funnel: carousels and email modules that pair specific problems with Aurora "recipes" (bundles of scenes + settings).
- Lower-funnel / CRM: triggered flows that reuse the same ingredients but plug in personalized data (nights improved, routines completed).

GUARDRAILS
- Avoid medical claims; no promises to "cure" conditions.
- Visual language should feel cinematic and calm, not medical or clinical.
- The OS metaphor should stay intuitive: never show overwhelming dashboards; focus on simple, modular building blocks the viewer can imagine using.
`,
  },
  {
    id: "HB-002",
    campaign_name: "VoltCharge Go – Workplace Fast Charging",
    single_minded_proposition: "Make every office parking spot feel like a premium EV perk.",
    primary_audience:
      "HR and Facilities leaders at mid-market companies offering EV charging as an employee benefit.",
    narrative_brief: `
BACKGROUND
VoltCharge Go installs and manages Level 3 fast chargers in office parks under a revenue-share model. The proposition to employees is emotional (feels like a premium perk), while the proposition to HR / Facilities is rational (recruiting, retention, and ESG optics).

OBJECTIVE
Generate qualified leads from HR / Facilities leaders and position VoltCharge Go as the easiest way to turn parking lots into recruiting and retention assets, using a modular content system that can flex across buyer roles, verticals, and funnel stages.

SINGLE MINDED PROPOSITION
Make every office parking spot feel like a premium EV perk.

PRIMARY AUDIENCE
HR / People teams and Facilities leads at 500–5,000 employee companies who are under pressure to modernize benefits and sustainability optics without adding operational burden.

MODULAR CONTENT STRATEGY
- Atomic units:
  - Employee vignettes (new hire, working parent, sustainability champion).
  - Proof tiles (recruiting metric lifts, satisfaction scores, utilization rates).
  - Objection handlers (no CapEx, turnkey ops, transparent pricing).
  - Vertical overlays (tech, healthcare, professional services).
- Dimensions for recombination:
  - Role (HR vs Facilities vs Finance).
  - Building profile (HQ campus vs satellite office).
  - Funnel stage (Awareness = "parking as perk", Consideration = economics and operations, Decision = case studies and calculators).

CONTENT MATRIX INTENT
- Upper-funnel: snackable video and animation that reframes the parking lot as part of the "benefits stack". Variants swap in different employee vignettes.
- Mid-funnel: interactive calculators, one-pagers, and LinkedIn carousels that modularize business cases and objection handlers by role.
- Lower-funnel: retargeting units that reuse proof tiles and testimonials, but tailored to the vertical + role combination detected.

GUARDRAILS
- No "range anxiety fear-mongering"; keep tone confident and solution-forward.
- Avoid generic sustainability stock imagery; show real office environments and people.
- Make it obvious that the system is modular and scalable across multiple sites, not a one-off pilot.
`,
  },
  {
    id: "HB-003",
    campaign_name: "HarvestBox Micro-Market for Multi-Family Buildings",
    single_minded_proposition: "Turn your lobby into the most loved amenity in the building.",
    primary_audience:
      "Property managers and owners of Class A/B multi-family buildings in urban cores.",
    narrative_brief: `
BACKGROUND
HarvestBox installs 24/7 self-checkout "micro-markets" stocked with fresh, local groceries and ready-to-eat meals in residential buildings. It aims to convert everyday "forgot one thing" frictions into memorable building touchpoints.

OBJECTIVE
Increase inbound demos from property owners and demonstrate that HarvestBox drives both resident satisfaction and ancillary revenue, with a modular content system that can pivot across building archetypes, resident personas, and decision-maker needs.

SINGLE MINDED PROPOSITION
Turn your lobby into the most loved amenity in the building.

PRIMARY AUDIENCE
Property managers and asset managers of 150+ unit buildings, focused on NOI, retention, and reviews. They value amenities that are low-touch to operate but high-visibility to residents.

MODULAR CONTENT STRATEGY
- Atomic units:
  - Resident moments (late-night snack, forgotten breakfast, hosting friends, kid snack emergencies).
  - Amenity proof points (NPS lift, review score deltas, occupancy/renewal metrics).
  - Building archetypes (young professionals, families, active adults).
  - Operator promises (low-ops, no-staffing, merchandising handled).
- Dimensions for recombination:
  - Audience lens (owner, asset manager, property manager).
  - Building type and geography (downtown high-rise vs suburban garden).
  - Funnel stage (Awareness = resident stories, Consideration = economics and operations, Decision = case studies and testimonials).

CONTENT MATRIX INTENT
- Upper-funnel: short vertical video sequences that modularly string together resident moments to show how the micro-market "shows up" throughout a week.
- Mid-funnel: carousels and landing-page modules that pair a building archetype with the right mix of resident moments and amenity proof points.
- Lower-funnel: retargeting and CRM that reuse the same modules but swap in building-type specific proof, such as "families in mid-rise X" vs "professionals in tower Y".

GUARDRAILS
- Avoid framing HarvestBox as a full grocery replacement; position it as hyper-convenient top-up.
- Visuals should feel warm, neighborly, and food-first, not like a vending machine.
- Always make it clear that the system is turnkey and does not create new staffing headaches.
`,
  },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Creative Strategy Architect. I can help you build a production-ready intelligent content brief. Shall we start with the Campaign Name and your primary goal?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Sample View State
  const [showSample, setShowSample] = useState(false);
  const [sampleTab, setSampleTab] = useState<'narrative' | 'matrix' | 'json'>('narrative');
  const [showLibrary, setShowLibrary] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'brief' | 'matrix' | 'concepts' | 'production' | 'feed'>('brief');
  const [splitRatio, setSplitRatio] = useState(0.6); // kept for potential future resizing
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [rightTab, setRightTab] = useState<'builder' | 'board'>('builder');
  const [matrixFields, setMatrixFields] = useState<MatrixFieldConfig[]>(BASE_MATRIX_FIELDS);
  const [visibleMatrixFields, setVisibleMatrixFields] = useState<MatrixFieldKey[]>(
  [...PRIMARY_MATRIX_KEYS, ...EXECUTION_MATRIX_KEYS],
  );
  const [showMatrixFieldConfig, setShowMatrixFieldConfig] = useState(false);
  const [showMatrixLibrary, setShowMatrixLibrary] = useState(false);
  const [matrixLibrary, setMatrixLibrary] = useState<ContentMatrixTemplate[]>(INITIAL_MATRIX_LIBRARY);
  const [briefFields, setBriefFields] = useState<BriefFieldConfig[]>(BASE_BRIEF_FIELDS);
  const [briefState, setBriefState] = useState<ModConBriefState>({
    campaign_name: 'Intelligent Content System – Demo Campaign',
    smp: '',
    audiences: [],
    kpis: [],
    flight_dates: {},
    status: 'Draft',
  });
  const [specs, setSpecs] = useState<Spec[]>(PRESET_SPECS);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [specsError, setSpecsError] = useState<string | null>(null);
  const [productionBatch, setProductionBatch] = useState<ProductionBatch | null>(null);
  const [productionAssets, setProductionAssets] = useState<ProductionAsset[]>([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionError, setProductionError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ProductionAsset | null>(null);
  const [builderSelectedConceptId, setBuilderSelectedConceptId] = useState<string>('');
  const [builderSelectedSpecIds, setBuilderSelectedSpecIds] = useState<string[]>([]);
  const [builderJobs, setBuilderJobs] = useState<ProductionJobRow[]>([]);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [jobRequirements, setJobRequirements] = useState<{ [jobId: string]: string }>({});
  const [jobStatuses, setJobStatuses] = useState<{ [jobId: string]: string }>({});
  const [newSpecPlatform, setNewSpecPlatform] = useState('');
  const [newSpecPlacement, setNewSpecPlacement] = useState('');
  const [newSpecWidth, setNewSpecWidth] = useState('');
  const [newSpecHeight, setNewSpecHeight] = useState('');
  const [newSpecOrientation, setNewSpecOrientation] = useState('');
  const [newSpecMediaType, setNewSpecMediaType] = useState('');
  const [newSpecNotes, setNewSpecNotes] = useState('');
  const [creatingSpec, setCreatingSpec] = useState(false);
  const [createSpecError, setCreateSpecError] = useState<string | null>(null);
  const [showSpecCreator, setShowSpecCreator] = useState(false);
  const [productionTab, setProductionTab] = useState<'requirements' | 'specLibrary'>('requirements');
  const [productionMatrixRows, setProductionMatrixRows] = useState<ProductionMatrixLine[]>([
    {
      id: 'PR-001',
      audience: 'Summer Sale (Fast)',
      concept_id: '',
      spec_id: 'TIKTOK_IN_FEED_9x16',
      destinations: 'TikTok, Instagram, Shorts, Snap',
      notes: '15s vertical; keep supers high.',
      is_feed: false,
      feed_template: '',
      template_id: '',
      feed_id: '',
      feed_asset_id: '',
      production_details: '',
    },
    {
      id: 'PR-002',
      audience: 'Summer Sale (Fast)',
      concept_id: '',
      spec_id: 'YOUTUBE_INSTREAM_16x9',
      destinations: 'YouTube, CTV, X',
      notes: '16:9 instream cut; loud/clear open.',
      is_feed: false,
      feed_template: '',
      template_id: '',
      feed_id: '',
      feed_asset_id: '',
      production_details: '',
    },
    {
      id: 'PR-003',
      audience: 'Summer Sale (Slow)',
      concept_id: '',
      spec_id: 'META_FEED_1x1',
      destinations: 'Meta Feed, LinkedIn, Display',
      notes: 'Static JPG; simple offer lockup.',
      is_feed: false,
      feed_template: '',
      template_id: '',
      feed_id: '',
      feed_asset_id: '',
      production_details: '',
    },
  ]);
  const [feedFields, setFeedFields] = useState<FeedFieldConfig[]>(BASE_FEED_FIELDS);
  const [visibleFeedFields, setVisibleFeedFields] = useState<FeedFieldKey[]>(
    BASE_FEED_FIELDS.map((f) => f.key).filter((key) => key !== 'date_start' && key !== 'date_end'),
  );
  const [showFeedFieldConfig, setShowFeedFieldConfig] = useState(false);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);

  // This would eventually be live-updated from the backend
  const [previewPlan, setPreviewPlan] = useState<any>({
    campaign_name: 'Intelligent Content System – Demo Campaign',
    single_minded_proposition: 'Show how a single modular content system can serve multiple audiences and channels.',
    primary_audience: 'Marketing and creative leaders evaluating intelligent content and modular storytelling.',
    narrative_brief:
      'Use this brief to define the story, audiences, and guardrails for an intelligent content system. ' +
      'Capture objectives, constraints, and how modular assets should recombine across channels.',
    content_matrix: [],
  }); 
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([
    {
      id: 'CON-001',
      asset_id: 'VID-001',
      title: 'Night Reset Ritual',
      description:
        'Top-funnel vertical story that dramatizes the before/after of a wired-and-tired professional discovering Aurora’s “Night Reset” scene.',
      notes: 'Warm, cinematic; emphasize modular scenes and simple UI. Avoid heavy data dashboards.',
      kind: 'video',
      status: 'idle',
    },
    {
      id: 'CON-002',
      asset_id: 'IMG-001',
      title: 'Hero Shelf Moment',
      description:
        'Static hero frame that pairs the product with a simplified “Glow Grid” overlay showing morning, mid-day, and evening use moments.',
      notes: 'Use existing brand photography; keep grid minimal and legible on mobile. No small text blocks.',
      kind: 'image',
      status: 'idle',
    },
  ]);
  const [moodBoardConceptIds, setMoodBoardConceptIds] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // ---- Feed Builder helpers ----
  const updateFeedCell = (index: number, key: keyof FeedRow, value: string) => {
    setFeedRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  };

  const setDefaultFeedRow = (index: number) => {
    setFeedRows((prev) =>
      prev.map((row, i) => ({
        ...row,
        is_default: i === index,
      })),
    );
  };

  const addFeedRow = () => {
    setFeedRows((prev) => [
      ...prev,
      {
        row_id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : `ROW-${Date.now()}-${prev.length + 1}`,
        // Identity & Taxonomy – seeded with example structure from the Master Feed spec
        creative_filename: 'ConcreteJungle_Speed_300x250_H5_v1',
        reporting_label: 'Concept: Concrete Jungle | Msg: Speed Focus',
        is_default: prev.length === 0,
        // Visual assets – empty by default, strategist/producer fills in real URLs
        asset_slot_a_path: '',
        asset_slot_b_path: '',
        asset_slot_c_path: '',
        logo_asset_path: '',
        // Copy & messaging – empty text slots ready for hooks/support/CTA
        copy_slot_a_text: '',
        copy_slot_b_text: '',
        copy_slot_c_text: '',
        legal_disclaimer_text: '',
        // Design & style
        cta_button_text: 'Learn More',
        font_color_hex: '#FFFFFF',
        cta_bg_color_hex: '#14b8a6',
        background_color_hex: '#020617',
        // Technical specs – defaults aligned to the example MPU HTML5 row
        platform_id: 'META',
        placement_dimension: '300x250',
        asset_format_type: 'HTML5',
        // Targeting & delivery
        audience_id: 'AUD_001',
        geo_targeting: 'US',
        date_start: '',
        date_end: '',
        trigger_condition: '',
        // Destination & tracking
        destination_url: '',
        utm_suffix: '',
      },
    ]);
  };

  const exportFeedCsv = () => {
    if (!feedRows.length) return;
    const headers = feedFields.map((f) => f.key as string);
    const rows = feedRows.map((r) => headers.map((h) => (r as any)[h] ?? '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asset_feed.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFeedBrief = () => {
    if (!feedRows.length) return;
    const lines: string[] = [];
    lines.push('Asset Feed – Production Brief');
    lines.push('========================================');
    lines.push('');
    feedRows.forEach((row) => {
      lines.push(`Asset: ${row.creative_filename}`);
      lines.push(`Label: ${row.reporting_label}`);
      lines.push(`Platform: ${row.platform_id} · ${row.placement_dimension}`);
      lines.push(`Type: ${row.asset_format_type}`);
      lines.push(`Destination: ${row.destination_url ?? ''}`);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asset_feed_brief.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const addCustomFeedField = () => {
    const rawLabel = window.prompt('Name this feed variable (e.g., Geo Cluster, Offer ID):');
    if (!rawLabel) return;
    const trimmed = rawLabel.trim();
    if (!trimmed) return;

    // Derive a slug key from the label
    let baseKey = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!baseKey) {
      baseKey = 'custom_var';
    }

    const existingKeys = new Set(feedFields.map((f) => f.key));
    let uniqueKey = baseKey;
    let idx = 1;
    while (existingKeys.has(uniqueKey)) {
      uniqueKey = `${baseKey}_${idx}`;
      idx += 1;
    }

    const newKey = uniqueKey;
    const newField: FeedFieldConfig = {
      key: newKey,
      label: trimmed,
      isCustom: true,
    };
    setFeedFields((prev) => [...prev, newField]);
    setVisibleFeedFields((prev) => [...prev, newKey]);
    // Existing rows will just have this field as undefined until edited
  };

  const toggleFeedField = (key: FeedFieldKey) => {
    setVisibleFeedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const deleteCustomFeedField = (key: FeedFieldKey) => {
    setFeedFields((prev) => prev.filter((f) => f.key !== key));
    setVisibleFeedFields((prev) => prev.filter((k) => k !== key));
    setFeedRows((prev) =>
      prev.map((row) => {
        const clone = { ...row };
        delete clone[key];
        return clone;
      }),
    );
  };

  // Handle drag-to-resize for split view
  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.min(0.8, Math.max(0.3, x / rect.width));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  const sendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const newHistory = [...messages, { role: 'user' as const, content: textToSend }];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    // In demo mode, simulate the agent locally without calling the backend
    if (demoMode) {
      const snippet = textToSend.length > 220 ? `${textToSend.slice(0, 220)}…` : textToSend;
      const demoReply =
        `Demo mode: Based on what you just shared, I'm tightening the brief and thinking about modular content.\n\n` +
        `1) Brief refinement:\n` +
        `- I’ll treat this as an update to the narrative_brief and core fields.\n` +
        `- I’ll look for clear objectives, primary audience, and any guardrails inside:\n\"${snippet}\".\n\n` +
        `2) Next step:\n` +
        `- Once you're happy with the brief, say something like "let's build the content matrix" and I'll start suggesting rows ` +
        `(audience x stage x trigger x channel) that we can then edit in the grid on the right.`;

      setMessages([...newHistory, { role: 'assistant', content: demoReply }]);
      setLoading(false);
      return;
    }

    try {
      if (workspaceView === 'brief') {
        const res = await fetch(`${API_BASE_URL}/brief/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_state: briefState,
            chat_log: newHistory,
          }),
        });
        const data = await res.json();
        setMessages([...newHistory, { role: 'assistant', content: data.reply }]);
        if (data.state) {
          const nextBrief = data.state as ModConBriefState;
          setBriefState(nextBrief);
          setPreviewPlan((prev: any) => ({
            ...prev,
            campaign_name: nextBrief.campaign_name || prev.campaign_name,
            single_minded_proposition: nextBrief.smp || prev.single_minded_proposition,
            primary_audience:
              (Array.isArray(nextBrief.audiences) && nextBrief.audiences.join(', ')) ||
              prev.primary_audience,
          }));
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: newHistory,
            current_plan: previewPlan,
          }),
        });
        const data = await res.json();
        setMessages([...newHistory, { role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      if (demoMode) {
        // Lightweight client-side CSV handling for demo purposes
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const cols = line.split(',');
          const row: Record<string, string> = {};
          cols.forEach((val, idx) => {
            const key = headers[idx] ?? `col_${idx}`;
            row[key] = val.trim();
          });
          return row;
        });

        setPreviewPlan((prev: any) => ({
          ...prev,
          audience_matrix: rows,
          audience_headers: headers,
        }));

        const sampleRows = rows.slice(0, 3);
        const sampleJson = JSON.stringify(sampleRows, null, 2);
        const cols = headers.join(', ');

        const userMessage =
          `I just uploaded an audience matrix CSV called "${file.name}".\n` +
          `Columns: ${cols}.\n` +
          `Here is a small sample of the rows:\n${sampleJson}\n` +
          `Please use this audience structure when shaping the brief and content matrix.`;

        await sendMessage(userMessage);
      } else {
        const res = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        // If this is an audience CSV, keep a structured copy in the plan
        if (data.kind === 'audience_matrix') {
          setPreviewPlan((prev: any) => ({
            ...prev,
            audience_matrix: data.rows,
            audience_headers: data.headers,
          }));

          const sampleRows = Array.isArray(data.rows) ? data.rows.slice(0, 3) : [];
          const sampleJson = JSON.stringify(sampleRows, null, 2);
          const cols = Array.isArray(data.headers) ? data.headers.join(', ') : 'N/A';

          const userMessage =
            `I just uploaded an audience matrix CSV called "${data.filename}".\n` +
            `Columns: ${cols}.\n` +
            `Here is a small sample of the rows:\n${sampleJson}\n` +
            `Please use this audience structure when shaping the brief and content matrix.`;

          await sendMessage(userMessage);
        } else {
          const preview = (data.content || '').substring(0, 200);
          const userMessage = `I just uploaded a file named "${data.filename}". Content preview: ${preview}...`;
          await sendMessage(userMessage);
        }
      }
    } catch (error) {
      console.error("Upload failed", error);
      if (!demoMode) {
        alert("Failed to upload file");
      }
      setLoading(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadExport = async (format: 'pdf' | 'txt' | 'json') => {
    // Keep previewPlan.content_matrix in sync with local editable grid
    const planToSend = {
      ...previewPlan,
      content_matrix: matrixRows.map((row) => ({
        asset_id: row.id,
        audience_segment: row.audience_segment,
        funnel_stage: row.funnel_stage,
        trigger: row.trigger,
        channel: row.channel,
        format: row.format,
        message: row.message,
        variant: row.variant,
        source_type: row.source_type,
        specs: row.specs,
        notes: row.notes,
      })),
      concepts: concepts.map((c) => ({
        id: c.id,
        asset_id: c.asset_id,
        title: c.title,
        description: c.description,
        notes: c.notes,
      })),
    };

    if (format === 'json') {
        const blob = new Blob([JSON.stringify(planToSend, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'brief.json';
        a.click();
        return;
    }

    // In demo mode, generate a simple text export client-side for TXT/PDF
    if (demoMode) {
      const lines: string[] = [];
      lines.push(`Production Master Plan: ${planToSend.campaign_name ?? 'Untitled'}`);
      lines.push('==================================================');
      lines.push('');
      lines.push(`SMP: ${planToSend.single_minded_proposition ?? 'N/A'}`);
      lines.push('');
      if (planToSend.narrative_brief) {
        lines.push('Narrative Brief:');
        lines.push(planToSend.narrative_brief);
        lines.push('');
      }
      lines.push('Strategy Matrix (preview):');
      (planToSend.content_matrix || []).forEach((row: any) => {
        lines.push(
          `- asset=${row.asset_id} | audience=${row.audience_segment} | stage=${row.funnel_stage} | trigger=${row.trigger} | channel=${row.channel} | format=${row.format} | message=${row.message}`,
        );
      });
      if (planToSend.concepts && planToSend.concepts.length) {
        lines.push('');
        lines.push('Concepts:');
        (planToSend.concepts || []).forEach((c: any) => {
          lines.push(`- [${c.asset_id}] ${c.title}: ${c.description}`);
        });
      }
      const text = lines.join('\n') + '\n';
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief.${format === 'pdf' ? 'txt' : format}`;
      a.click();
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planToSend }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief.${format}`;
      a.click();
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const switchWorkspace = (view: 'brief' | 'matrix' | 'concepts' | 'production' | 'feed') => {
    setWorkspaceView(view);

    if (view === 'concepts') {
      setRightTab('builder');
    }

    if (view !== 'brief') {
      // Keep brief-only overlays tied to the brief tab
      setShowSample(false);
      setShowLibrary(false);
    }
  };

  function addMatrixRow() {
    setMatrixRows((rows) => [
      ...rows,
      {
        id: `AST-${rows.length + 1}`.padStart(3, '0'),
        audience_segment: '',
        funnel_stage: '',
        trigger: '',
        channel: '',
        format: '',
        message: '',
        variant: '',
        source_type: '',
        specs: '',
        notes: '',
      },
    ]);
  }

  function updateMatrixCell(index: number, field: keyof MatrixRow, value: string) {
    setMatrixRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function removeMatrixRow(index: number) {
    setMatrixRows((rows) => rows.filter((_, i) => i !== index));
  }

  function addConcept() {
    const defaultAssetId = matrixRows[0]?.id || `AST-${concepts.length + 1}`;
    setConcepts((prev) => [
      ...prev,
      {
        id: `CON-${prev.length + 1}`.padStart(3, '0'),
        asset_id: defaultAssetId,
        title: '',
        description: '',
        notes: '',
        // kind can be set later via the toggle controls in the Concept Canvas
        kind: undefined,
        status: 'idle',
      },
    ]);
  }

  function updateConceptField(index: number, field: keyof Concept, value: string) {
    setConcepts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  function removeConcept(index: number) {
    setConcepts((prev) => prev.filter((_, i) => i !== index));
  }

  async function draftConceptsFromBrief() {
    try {
      const res = await fetch(`${API_BASE_URL}/concepts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: briefState }),
      });
      if (!res.ok) {
        console.error('Failed to draft concepts from brief', await res.text());
        return;
      }
      const data = await res.json();
      const generated = (data?.state?.concepts ?? []) as any[];
      if (!Array.isArray(generated) || !generated.length) return;

      setConcepts((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const mapped = generated
          .filter((c) => c && typeof c.id === 'string' && !existingIds.has(c.id))
          .map((c) => ({
            id: c.id,
            asset_id: '',
            title: c.name ?? '',
            description: c.visual_description ?? '',
            notes: '',
            kind: undefined,
            status: 'idle' as const,
            generatedPrompt: undefined,
          }));
        return [...prev, ...mapped];
      });
    } catch (e) {
      console.error('Error calling /concepts/generate', e);
    }
  }

  async function generateProductionPlan() {
    // POC mode: if upstream modules aren't wired yet, fall back to a
    // deterministic demo Production Matrix so the board is never empty.
    if (!matrixRows.length || !concepts.length) {
      const demoConcept = concepts[0];
      const demoBatch: ProductionBatch = {
        id: 'DEMO-BATCH-001',
        campaign_id: briefState.campaign_name || 'DEMO_CAMPAIGN',
        strategy_segment_id: 'SEG-DEMO',
        concept_id: demoConcept?.id || 'CON-DEMO',
        batch_name: `${briefState.campaign_name || 'Demo Campaign'} – ${
          demoConcept?.title || 'Night Reset Ritual'
        }`,
      };

      const demoAssets: ProductionAsset[] = [
        {
          id: 'DEMO-ASSET-001',
          batch_id: demoBatch.id,
          asset_name: 'Loyalists_META_StoriesReels',
          platform: 'Meta',
          placement: 'Stories / Reels',
          spec_dimensions: '1080x1920',
          spec_details: {
            id: 'META_STORY',
            platform: 'Meta',
            placement: 'Stories / Reels',
            format_name: '9:16 Vertical',
            dimensions: '1080x1920',
            aspect_ratio: '9:16',
            max_duration: 15,
          },
          status: 'Todo',
          assignee: null,
          asset_type: 'video',
          visual_directive:
            demoConcept?.description ||
            'Top-funnel vertical story dramatizing the before/after of the core concept.',
          copy_headline:
            'Show the modular story in 6–15 seconds with a clear hero benefit in frame 1.',
          source_asset_requirements:
            'Master 9:16 video edit from hero shoot; export with safe zones respected.',
          adaptation_instruction: 'Localize supers and end card by market; keep structure identical.',
          file_url: null,
        },
        {
          id: 'DEMO-ASSET-002',
          batch_id: demoBatch.id,
          asset_name: 'Loyalists_YT_Bumper',
          platform: 'YouTube',
          placement: 'Bumper',
          spec_dimensions: '1920x1080',
          spec_details: {
            id: 'YT_BUMPER',
            platform: 'YouTube',
            placement: 'Bumper',
            format_name: '6s 16:9 Bumper',
            dimensions: '1920x1080',
            aspect_ratio: '16:9',
            max_duration: 6,
          },
          status: 'Todo',
          assignee: null,
          asset_type: 'video',
          visual_directive:
            'Ultra-tight 6s cut: cold open on payoff visual, 1 line of copy, brand lock-up.',
          copy_headline: 'Land one clear benefit and mnemonic; no body copy.',
          source_asset_requirements: '16:9 master edit; ensure framing works for TV and mobile.',
          adaptation_instruction: 'Version CTA and logo lock-up per channel package.',
          file_url: null,
        },
        {
          id: 'DEMO-ASSET-003',
          batch_id: demoBatch.id,
          asset_name: 'Loyalists_DISPLAY_MPU',
          platform: 'Google Display',
          placement: 'MPU',
          spec_dimensions: '300x250',
          spec_details: {
            id: 'DISPLAY_MPU',
            platform: 'Google Display',
            placement: 'MPU',
            format_name: 'Medium Rectangle',
            dimensions: '300x250',
            aspect_ratio: '1.2:1',
          },
          status: 'Todo',
          assignee: null,
          asset_type: 'html5',
          visual_directive:
            'Static or lightweight HTML5 MPU; hero visual + 1–2 lines of copy and CTA button.',
          copy_headline: 'Repurpose the master message into a short MPU-safe headline.',
          source_asset_requirements: 'Layered PSD/FIG file or HTML5 components for animator.',
          adaptation_instruction: 'Ensure legibility on small screens; avoid dense legal.',
          file_url: null,
        },
      ];

      setProductionBatch(demoBatch);
      setProductionAssets(demoAssets);
      setWorkspaceView('production');
      return;
    }

    const strategyRow = matrixRows[0] || {};
    const concept = concepts[0];

    const platformEnvs = (strategyRow.platform_environments || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const strategyPayload = {
      segment_source: strategyRow.segment_source || '1st Party (CRM)',
      segment_id: strategyRow.segment_id || 'SEG-DEMO',
      segment_name: strategyRow.segment_name || 'Demo Segment',
      segment_size: strategyRow.segment_size || '',
      priority_level: strategyRow.priority_level || 'Tier 1 (Bespoke)',
      segment_description: strategyRow.segment_description || '',
      key_insight: strategyRow.key_insight || '',
      current_perception: strategyRow.current_perception || '',
      desired_perception: strategyRow.desired_perception || '',
      primary_message_pillar: strategyRow.primary_message_pillar || '',
      call_to_action_objective: strategyRow.call_to_action_objective || 'Learn More',
      tone_guardrails: strategyRow.tone_guardrails || '',
      platform_environments: platformEnvs.length ? platformEnvs : ['META_STORY'],
      contextual_triggers: strategyRow.contextual_triggers || '',
      asset_id: strategyRow.asset_id,
      specs_lookup_key: strategyRow.specs_lookup_key,
      notes: strategyRow.notes,
    };

    const conceptPayload = {
      id: concept.id,
      name: concept.title || 'Untitled concept',
      visual_description: concept.description || '',
      components: [],
    };

    setProductionLoading(true);
    setProductionError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/production/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: briefState.campaign_name || 'DEMO_CAMPAIGN',
          strategy: strategyPayload,
          concept: conceptPayload,
          batch_name: `${strategyPayload.segment_name} – ${conceptPayload.name}`,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed with status ${res.status}`);
      }
      const data = await res.json();
      setProductionBatch(data.batch || null);
      setProductionAssets(data.assets || []);
      setWorkspaceView('production');
    } catch (e: any) {
      console.error('Error generating production plan', e);
      // POC fallback: if backend is not wired yet in this environment,
      // fall back to the same demo plan used when upstream modules are empty.
      setProductionError(
        e?.message ?? 'Unable to generate production plan from backend; showing demo plan.',
      );
      const demoConcept = concepts[0];
      const demoBatch: ProductionBatch = {
        id: 'DEMO-BATCH-001',
        campaign_id: briefState.campaign_name || 'DEMO_CAMPAIGN',
        strategy_segment_id: 'SEG-DEMO',
        concept_id: demoConcept?.id || 'CON-DEMO',
        batch_name: `${briefState.campaign_name || 'Demo Campaign'} – ${
          demoConcept?.title || 'Night Reset Ritual'
        }`,
      };
      const demoAssets: ProductionAsset[] = [
        {
          id: 'DEMO-ASSET-001',
          batch_id: demoBatch.id,
          asset_name: 'Loyalists_META_StoriesReels',
          platform: 'Meta',
          placement: 'Stories / Reels',
          spec_dimensions: '1080x1920',
          spec_details: {
            id: 'META_STORY',
            platform: 'Meta',
            placement: 'Stories / Reels',
            format_name: '9:16 Vertical',
            dimensions: '1080x1920',
          },
          status: 'Todo',
          assignee: null,
          asset_type: 'video',
          visual_directive:
            demoConcept?.description ||
            'Top-funnel vertical story dramatizing the before/after of the core concept.',
          copy_headline:
            'Show the modular story in 6–15 seconds with a clear hero benefit in frame 1.',
          source_asset_requirements:
            'Master 9:16 video edit from hero shoot; export with safe zones respected.',
          adaptation_instruction: 'Localize supers and end card by market; keep structure identical.',
          file_url: null,
        },
      ];
      setProductionBatch(demoBatch);
      setProductionAssets(demoAssets);
      setWorkspaceView('production');
    } finally {
      setProductionLoading(false);
    }
  }

  async function updateProductionStatus(assetId: string, status: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/production/asset/${assetId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed with status ${res.status}`);
      }
      const data = await res.json();
      const updated = data.asset as ProductionAsset;
      setProductionAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (selectedAsset && selectedAsset.id === updated.id) {
        setSelectedAsset(updated);
      }
    } catch (e) {
      console.error('Error updating asset status', e);
    }
  }

  function toggleBuilderSpec(id: string) {
    setBuilderSelectedSpecIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  const addProductionMatrixRow = () => {
    const nextId = `PR-${(productionMatrixRows.length + 1).toString().padStart(3, '0')}`;
    const defaultConceptId = concepts[0]?.id ?? '';
    setProductionMatrixRows((prev) => [
      ...prev,
      {
        id: nextId,
        audience: '',
        concept_id: defaultConceptId,
        spec_id: '',
        destinations: '',
        notes: '',
        is_feed: false,
        feed_template: '',
        template_id: '',
        feed_id: '',
        feed_asset_id: '',
        production_details: '',
      },
    ]);
  };

  const updateProductionMatrixCell = (
    index: number,
    field: keyof ProductionMatrixLine,
    value: string | boolean,
  ) => {
    setProductionMatrixRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeProductionMatrixRow = (index: number) => {
    setProductionMatrixRows((prev) => prev.filter((_, i) => i !== index));
  };

  const sendSpecsToProduction = () => {
    // Move to the Requirements tab and, if possible, generate jobs immediately.
    setProductionTab('requirements');
    if (builderSelectedConceptId && builderSelectedSpecIds.length > 0) {
      generateProductionJobsFromBuilder();
    } else {
      setBuilderError('Select a concept in Requirements to generate the production list for these specs.');
    }
  };

  async function generateProductionJobsFromBuilder() {
    // If rows exist, prefer local matrix-based generation
    if (productionMatrixRows.length > 0) {
      const jobs: ProductionJobRow[] = [];
      productionMatrixRows.forEach((row, idx) => {
        const spec = specs.find((s) => s.id === row.spec_id);
        const concept = concepts.find((c) => c.id === row.concept_id);
        const conceptLabel = concept?.title || concept?.description || concept?.id || 'Untitled Concept';
        const specLabel = spec ? `${spec.width}x${spec.height} ${spec.media_type}` : 'Spec not set';
        const metaSuffixParts = [];
        if (row.template_id) metaSuffixParts.push(`template:${row.template_id}`);
        if (row.feed_id) metaSuffixParts.push(`feed:${row.feed_id}`);
        if (row.feed_asset_id) metaSuffixParts.push(`asset:${row.feed_asset_id}`);
        if (row.production_details && !row.is_feed) metaSuffixParts.push(`build:${row.production_details}`);
        const metaSuffix = metaSuffixParts.length ? ` [${metaSuffixParts.join(' | ')}]` : '';
        const destinations = row.destinations
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => ({
            platform_name: d,
            spec_id: spec?.id || row.spec_id || `SPEC-${idx + 1}`,
            format_name: spec?.placement || spec?.media_type || '',
            special_notes: row.notes,
          }));
        jobs.push({
          job_id: row.id || `JOB-${idx + 1}`,
          creative_concept: conceptLabel,
          asset_type: spec?.media_type || 'asset',
          destinations,
          technical_summary: `${specLabel}${metaSuffix}`,
          status: 'Pending',
        });
      });
      setBuilderJobs(jobs);
      setBuilderError(null);
      setProductionTab('requirements');
      return;
    }

    if (!builderSelectedConceptId || builderSelectedSpecIds.length === 0) return;

    const concept = concepts.find((c) => c.id === builderSelectedConceptId);
    const conceptLabel =
      concept?.title || concept?.description || concept?.id || 'Untitled Concept';

    setBuilderLoading(true);
    setBuilderError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/production/builder/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creative_concept: conceptLabel,
          spec_ids: builderSelectedSpecIds,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed with status ${res.status}`);
      }
      const data = await res.json();
      setBuilderJobs(data.jobs || []);
    } catch (e: any) {
      console.error('Error generating production jobs', e);
      setBuilderError(e?.message ?? 'Unable to generate production list from backend.');
    } finally {
      setBuilderLoading(false);
    }
  }

  function toggleMatrixField(key: MatrixFieldKey) {
    setVisibleMatrixFields((prev) => {
      const exists = prev.includes(key);
      if (exists) {
        // Always keep at least one column visible
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }

  function addCustomBriefField() {
    const rawLabel = window.prompt('Name this brief field (e.g., Secondary Audience, Mandatories):');
    if (!rawLabel) return;
    const trimmed = rawLabel.trim();
    if (!trimmed) return;

    const derivedKey = trimmed
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    const key: BriefFieldKey = derivedKey || `field_${briefFields.length + 1}`;

    if (briefFields.some((f) => f.key === key)) {
      alert('A brief field with this name already exists.');
      return;
    }

    const newField: BriefFieldConfig = {
      key,
      label: trimmed,
      multiline: true,
      isCustom: true,
    };

    setBriefFields((prev) => [...prev, newField]);
    setPreviewPlan((prev: any) => ({
      ...prev,
      [key]: '',
    }));
  }

  function deleteCustomBriefField(key: BriefFieldKey) {
    setBriefFields((prev) => prev.filter((f) => !(f.key === key && f.isCustom)));
    setPreviewPlan((prev: any) => {
      if (!prev) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function updateBriefFieldValue(key: BriefFieldKey, value: string) {
    setPreviewPlan((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  function addCustomMatrixField() {
    const rawLabel = window.prompt('Name this new column (e.g., Market, Owner, Priority):');
    if (!rawLabel) return;
    const trimmed = rawLabel.trim();
    if (!trimmed) return;

    // Derive a safe key from the label
    const derivedKey = trimmed
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    const key = derivedKey || `field_${matrixFields.length + 1}`;

    if (matrixFields.some((f) => f.key === key)) {
      alert('A column with this name already exists.');
      return;
    }

    const newField: MatrixFieldConfig = {
      key,
      label: trimmed,
      isCustom: true,
    };

    setMatrixFields((prev) => [...prev, newField]);
    setVisibleMatrixFields((prev) => [...prev, key]);
  }

  function deleteCustomMatrixField(key: MatrixFieldKey) {
    setMatrixFields((prev) => prev.filter((f) => !(f.key === key && f.isCustom)));
    setVisibleMatrixFields((prev) => prev.filter((k) => k !== key));
  }

  function applyMatrixTemplate(templateId: string) {
    const template = matrixLibrary.find((t) => t.id === templateId);
    if (!template) return;
    setMatrixRows(template.rows);
    setShowMatrixLibrary(false);
  }

  function deleteMatrixTemplate(templateId: string) {
    setMatrixLibrary((prev) => prev.filter((t) => t.id !== templateId));
  }

  function saveCurrentMatrixToLibrary() {
    if (!matrixRows.length) {
      alert('Add at least one row to the content matrix before saving to the library.');
      return;
    }
    const name = window.prompt('Name this strategy matrix template:', 'New Strategy Matrix');
    if (!name) return;

    const description =
      'Saved from current workspace. Rows: ' +
      matrixRows.length +
      (previewPlan?.campaign_name ? ` | Campaign: ${previewPlan.campaign_name}` : '');

    const nextId = `MTX-${(matrixLibrary.length + 1).toString().padStart(3, '0')}`;
    setMatrixLibrary((prev) => [
      ...prev,
      {
        id: nextId,
        name,
        description,
        rows: matrixRows,
      },
    ]);
    setShowMatrixLibrary(true);
  }

  function createSpec() {
    setCreateSpecError(null);
    const width = parseInt(newSpecWidth, 10);
    const height = parseInt(newSpecHeight, 10);

    if (!newSpecPlatform.trim() || !newSpecPlacement.trim() || !width || !height) {
      setCreateSpecError('Platform, placement, width, and height are required.');
      return;
    }

    const cleanPlatform = newSpecPlatform.trim();
    const cleanPlacement = newSpecPlacement.trim();
    const orientation = newSpecOrientation.trim() || 'Unspecified';
    const mediaType = newSpecMediaType.trim() || 'image_or_video';
    const notes = newSpecNotes.trim() || '';
    const baseId = `${cleanPlatform}_${cleanPlacement}_${width}x${height}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    const existingIds = new Set(specs.map((s) => s.id));
    let candidate = baseId;
    let i = 1;
    while (existingIds.has(candidate)) {
      candidate = `${baseId}_${i}`;
      i += 1;
    }

    const newSpec: Spec = {
      id: candidate,
      platform: cleanPlatform,
      placement: cleanPlacement,
      width,
      height,
      orientation,
      media_type: mediaType,
      notes,
    };

    setSpecs((prev) => [...prev, newSpec]);
    setNewSpecPlatform('');
    setNewSpecPlacement('');
    setNewSpecWidth('');
    setNewSpecHeight('');
    setNewSpecOrientation('');
    setNewSpecMediaType('');
    setNewSpecNotes('');
  }

  useEffect(() => {
    if (workspaceView === 'production' && specs.length === 0) {
      setSpecs(PRESET_SPECS);
    }
  }, [workspaceView, specs.length]);

  const specsByPlatform: { [platform: string]: Spec[] } = {};
  for (const spec of specs) {
    const key = spec.platform || 'Other';
    if (!specsByPlatform[key]) {
      specsByPlatform[key] = [];
    }
    specsByPlatform[key].push(spec);
  }

  return (
    <main
      ref={containerRef}
      className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-800"
    >
      {/* Global header - shows across all workspace views */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-6">
          <div className="h-12 w-auto">
            {/* Increased logo size and removed fixed width container constraint */}
            <Image
              src="/logo.png"
              alt="Transparent Partners"
              width={180}
              height={48}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>
          <div className="border-l border-slate-200 pl-6 h-10 flex flex-col justify-center">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">
              Intelligent Creative Cortex
            </h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              The creative brain of your campaign
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {workspaceView === 'brief' && (
            <button
              onClick={() => {
                if (workspaceView !== 'brief') switchWorkspace('brief');
                setShowSample(false);
                setShowLibrary((prev) => !prev);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
            >
              Brief Library
            </button>
          )}
          <div className="hidden md:flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-1 py-0.5">
            <button
              onClick={() => switchWorkspace('brief')}
              className={`text-[11px] px-2 py-1 rounded-full ${
                workspaceView === 'brief'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Brief
            </button>
            <button
              onClick={() => switchWorkspace('matrix')}
              className={`text-[11px] px-2 py-1 rounded-full ${
                workspaceView === 'matrix'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Matrix
            </button>
            <button
              onClick={() => switchWorkspace('concepts')}
              className={`text-[11px] px-2 py-1 rounded-full ${
                workspaceView === 'concepts'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Concepts
            </button>
            <button
              onClick={() => switchWorkspace('production')}
              className={`text-[11px] px-2 py-1 rounded-full ${
                workspaceView === 'production'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Production
            </button>
            <button
              onClick={() => switchWorkspace('feed')}
              className={`text-[11px] px-2 py-1 rounded-full ${
                workspaceView === 'feed'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Feed
            </button>
          </div>
          <button
            onClick={() => {
              if (workspaceView !== 'brief') switchWorkspace('brief');
              setShowSample((prev) => !prev);
              setShowLibrary(false);
            }}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-5 py-2.5 rounded-full border border-teal-100 transition-colors shadow-sm"
          >
            {showSample ? 'Hide Sample' : 'View Sample Output'}
          </button>
          <button
            onClick={() => {
              setDemoMode((prev) => !prev);
              // Reset conversation when toggling demo mode for clarity
              setMessages([
                {
                  role: 'assistant',
                  content: !demoMode
                    ? 'Demo mode is ON. I will simulate the agent locally so you can click around the interface without a backend.'
                    : 'Demo mode is OFF. I will now talk to the live backend (when available on localhost:8000).',
                },
              ]);
            }}
            className={`text-xs font-semibold px-4 py-2 rounded-full border transition-colors ${
              demoMode
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-500 border-slate-200 hover:text-teal-600 hover:border-teal-300'
            }`}
          >
            {demoMode ? 'Demo Mode: On' : 'Demo Mode: Off'}
          </button>
        </div>
      </div>

      {/* Main workspace row: left chat + right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Chat Interface (Brief-only) */}
        {workspaceView === 'brief' && (
          <div className="flex flex-col border-r border-gray-200 relative w-full md:w-1/2 md:max-w-1/2">
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#F8FAFC]">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-teal-600 text-white rounded-br-sm' 
                  : 'bg-white border border-gray-100 text-slate-700 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl flex items-center gap-2 shadow-sm">
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                 <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-200">
          <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
            {/* File Upload */}
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-teal-600 hover:bg-white rounded-xl transition-colors"
                title="Upload Reference Document"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
            </button>

            <input
              className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400 text-base"
              placeholder="Type your response..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-70 font-semibold shadow-sm transition-colors text-sm"
            >
              Send
            </button>
          </div>
        </div>
        
        {/* Sample Brief Modal Overlay */}
        {showSample && (
            <div className="absolute inset-0 bg-white/98 backdrop-blur-md z-20 flex flex-col animate-in fade-in duration-200">
                {/* Sticky header so the close button is always visible */}
                <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Sample Output: &quot;Summer Glow 2024&quot;</h2>
                        <p className="text-sm text-slate-500">This is what a completed Master Plan looks like.</p>
                    </div>
                    <button 
                        onClick={() => setShowSample(false)}
                        className="p-2 hover:bg-gray-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-8">
                    <button 
                        onClick={() => setSampleTab('narrative')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${sampleTab === 'narrative' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Narrative Brief
                    </button>
                    <button 
                        onClick={() => setSampleTab('matrix')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${sampleTab === 'matrix' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Strategy Matrix
                    </button>
                    <button 
                        onClick={() => setSampleTab('json')}
                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${sampleTab === 'json' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        JSON Data
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    {sampleTab === 'narrative' && (
                        <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <pre className="whitespace-pre-wrap font-sans text-slate-600 leading-relaxed">
                                {SAMPLE_NARRATIVE}
                            </pre>
                        </div>
                    )}

                    {sampleTab === 'matrix' && (
                        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-xs">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Audience Segment</th>
                                        <th className="px-6 py-4">Trigger / Condition</th>
                                        <th className="px-6 py-4">Content Focus</th>
                                        <th className="px-6 py-4">Format</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {SAMPLE_MATRIX.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-mono text-slate-500">{row.id}</td>
                                            <td className="px-6 py-4 text-slate-800 font-medium">{row.audience}</td>
                                            <td className="px-6 py-4 text-blue-600 bg-blue-50/50 rounded">{row.trigger}</td>
                                            <td className="px-6 py-4 text-slate-600">{row.content}</td>
                                            <td className="px-6 py-4 text-slate-500">{row.format}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {sampleTab === 'json' && (
                        <div className="max-w-4xl mx-auto bg-slate-900 p-6 rounded-xl shadow-lg overflow-auto">
                            <pre className="font-mono text-xs text-green-400">
                                {JSON.stringify(SAMPLE_JSON, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Historical Brief Library Modal */}
        {showLibrary && (
          <div className="absolute inset-0 bg-white/98 backdrop-blur-md z-30 flex flex-col">
            {/* Sticky header so the close button is always visible */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Historical Intelligent Content Briefs</h2>
                <p className="text-sm text-slate-500">
                  Reference-ready examples of completed briefs and content plans for different categories.
                </p>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                {HISTORICAL_BRIEFS.map((brief) => (
                  <div
                    key={brief.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">{brief.campaign_name}</h3>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                          {brief.id}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600">
                        SMP: <span className="font-normal">{brief.single_minded_proposition}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Primary audience: {brief.primary_audience}
                      </p>
                      <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
                        <p className="text-[11px] text-slate-500 mb-1 font-semibold uppercase tracking-wide">
                          Narrative excerpt
                        </p>
                        <pre className="text-[11px] text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {brief.narrative_brief.trim()}
                        </pre>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-[11px] text-slate-400">
                        Content matrix + concepts available in final plan (coming soon).
                      </span>
                      <button
                        disabled
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-400 cursor-not-allowed"
                      >
                        Load into agent (future)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* RIGHT: Live Brief Panel on Brief tab */}
      {workspaceView === 'brief' && (
        <div className="hidden md:flex flex-col w-1/2 max-w-1/2 bg-white border-l border-gray-200 shadow-xl z-10">
          <div className="px-6 py-5 border-b border-gray-100 bg-white flex justify-between items-center select-none">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Intelligent Content Brief</h2>
            </div>
            <button
              type="button"
              onClick={addCustomBriefField}
              className="text-[11px] px-3 py-1.5 rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100"
            >
              + Add brief field
            </button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/40 space-y-4">
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Brief Fields</h3>
              </div>
              <div className="space-y-3">
                {briefFields.map((field) => {
                  const value = (previewPlan && (previewPlan as any)[field.key]) ?? '';
                  const multiline = field.multiline;
                  return (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-medium text-slate-600">
                          {field.label}
                        </label>
                        {field.isCustom && (
                          <button
                            type="button"
                            onClick={() => deleteCustomBriefField(field.key)}
                            className="text-[10px] text-slate-400 hover:text-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {multiline ? (
                        <textarea
                          className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 min-h-[72px]"
                          value={value}
                          onChange={(e) => updateBriefFieldValue(field.key, e.target.value)}
                          placeholder={field.label}
                        />
                      ) : (
                        <input
                          className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                          value={value}
                          onChange={(e) => updateBriefFieldValue(field.key, e.target.value)}
                          placeholder={field.label}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT: Live Preview / Strategy Matrix Workspace / Concepts */}
      {workspaceView !== 'brief' && (
      <>
        <div
          className="bg-white border-l border-gray-200 hidden md:flex flex-col shadow-xl z-20 w-full"
        >
          <div className="px-6 py-5 border-b border-gray-100 bg-white flex justify-between items-center select-none">
            <div className="flex items-center gap-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {workspaceView === 'matrix'
                  ? 'Strategy Matrix'
                  : workspaceView === 'concepts'
                  ? 'Concept Workspace'
                  : workspaceView === 'production'
                  ? 'Production Matrix'
                  : 'Content Feed'}
              </h2>
              {workspaceView === 'concepts' && (
                <div className="ml-4 flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-1 py-0.5">
                  <button
                    onClick={() => setRightTab('builder')}
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      rightTab === 'builder'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Concept Builder
                  </button>
                  <button
                    onClick={() => setRightTab('board')}
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      rightTab === 'board'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Concept Board
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => switchWorkspace('brief')}
                className="px-3 py-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 border border-teal-100 rounded-full transition-colors"
              >
                Back to Brief
              </button>
              {workspaceView === 'production' && (
                <div className="hidden md:flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-1 py-0.5">
                  <button
                    onClick={() => setProductionTab('requirements')}
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      productionTab === 'requirements'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Requirements
                  </button>
                  <button
                    onClick={() => setProductionTab('specLibrary')}
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      productionTab === 'specLibrary'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Spec Library
                  </button>
                </div>
              )}
              <button
                onClick={() => downloadExport('json')}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors"
              >
                JSON
              </button>
              <button
                onClick={() => downloadExport('txt')}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors"
              >
                TXT
              </button>
              <button
                onClick={() => downloadExport('pdf')}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors"
              >
                PDF
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 relative">
            <div className="space-y-6">
              {workspaceView === 'matrix' && (
                <>
                  {matrixRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-4 mt-20">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                      </div>
                      <p className="text-sm max-w-[240px]">
                        After your brief is complete, start sketching the content matrix here. Use the button below to add rows.
                      </p>
                      <button
                        onClick={addMatrixRow}
                        className="mt-2 px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full border border-teal-100"
                      >
                        Add first row
                      </button>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Strategy Matrix
                            </h3>
                            <button
                              type="button"
                              onClick={() => setShowMatrixFieldConfig((prev) => !prev)}
                              className="text-[11px] px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300 bg-white"
                            >
                              Customize columns
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMatrixLibrary(true)}
                              className="text-[11px] px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300 bg-white"
                            >
                              Matrix Library
                            </button>
                          </div>
                          <button
                            onClick={addMatrixRow}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium px-3 py-1 rounded-full bg-teal-50 border border-teal-100"
                          >
                            + Add row
                          </button>
                        </div>
                        {showMatrixFieldConfig && (
                          <div className="mb-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm">
                            <div className="flex items-center justify-between mb-2 gap-3">
                              <div>
                                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                  Matrix Fields
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Turn columns on/off and add custom fields for this content matrix.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={addCustomMatrixField}
                                className="text-[11px] px-3 py-1 rounded-full border border-teal-400 text-teal-700 bg-white hover:bg-teal-50"
                              >
                                + Add custom field
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {matrixFields.map((field) => {
                                const checked = visibleMatrixFields.includes(field.key);
                                const isCustom = field.isCustom;
                                return (
                                  <div
                                    key={field.key}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full border ${
                                      checked
                                        ? 'bg-white border-teal-500 text-teal-700 shadow-sm'
                                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleMatrixField(field.key)}
                                      className="outline-none"
                                    >
                                      {field.label}
                                    </button>
                                    {isCustom && (
                                      <button
                                        type="button"
                                        onClick={() => deleteCustomMatrixField(field.key)}
                                        className="ml-1 text-[10px] text-slate-400 hover:text-red-500"
                                        title="Remove custom field"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                {matrixFields.filter((f) => visibleMatrixFields.includes(f.key)).map((field) => (
                                  <th key={field.key} className="px-2 py-2">
                                    {field.label}
                                  </th>
                                ))}
                                <th className="px-2 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {matrixRows.map((row, index) => (
                                <tr key={index} className="align-top">
                                  {matrixFields.filter((f) => visibleMatrixFields.includes(f.key)).map((field) => (
                                    <td key={field.key} className="px-2 py-1">
                                      <input
                                        value={row[field.key] ?? ''}
                                        onChange={(e) =>
                                          updateMatrixCell(index, field.key as MatrixFieldKey, e.target.value)
                                        }
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-1 text-right">
                                    <button
                                      onClick={() => removeMatrixRow(index)}
                                      className="text-[11px] text-slate-400 hover:text-red-500"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}
                </>
              )}

              {workspaceView === 'production' && productionTab === 'requirements' && (
                <div className="space-y-4">
                  {/* Line-by-line Production Requirements Matrix */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Production Requirements Matrix
                        </h3>
                        <p className="text-[11px] text-slate-500 max-w-xl">
                          Connect audiences to concepts and specs line-by-line. This feeds the production list builder without a traffic sheet.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={addProductionMatrixRow}
                          className="px-3 py-1.5 text-[11px] rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100"
                        >
                          + Add row
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductionTab('specLibrary')}
                          className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                        >
                          Manage specs →
                        </button>
                      </div>
                    </div>
                    <div className="overflow-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-[11px] min-w-[900px]">
                        <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide text-[10px]">
                          <tr>
                            <th className="px-3 py-2 text-left">Audience</th>
                            <th className="px-3 py-2 text-left">Concept</th>
                            <th className="px-3 py-2 text-left">Spec</th>
                            <th className="px-3 py-2 text-left">Destinations</th>
                            <th className="px-3 py-2 text-left">Feed?</th>
                            <th className="px-3 py-2 text-left">Feed Template</th>
                            <th className="px-3 py-2 text-left">Template ID</th>
                            <th className="px-3 py-2 text-left">Feed ID</th>
                            <th className="px-3 py-2 text-left">Feed Asset ID</th>
                            <th className="px-3 py-2 text-left">Production Details (non-feed)</th>
                            <th className="px-3 py-2 text-left">Notes</th>
                            <th className="px-3 py-2 text-right"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {productionMatrixRows.map((row, index) => {
                            const specOptions = specs;
                            return (
                              <tr key={row.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 align-top">
                                  <input
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.audience}
                                    onChange={(e) => updateProductionMatrixCell(index, 'audience', e.target.value)}
                                    placeholder="Audience / cohort"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <select
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.concept_id}
                                    onChange={(e) => updateProductionMatrixCell(index, 'concept_id', e.target.value)}
                                  >
                                    <option value="">Select concept</option>
                                    {concepts.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.title || c.id}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <select
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.spec_id}
                                    onChange={(e) => {
                                      const nextSpecId = e.target.value;
                                      updateProductionMatrixCell(index, 'spec_id', nextSpecId);
                                      const selectedSpec = specs.find((s) => s.id === nextSpecId);
                                      if (selectedSpec && !row.destinations.trim()) {
                                        updateProductionMatrixCell(index, 'destinations', selectedSpec.platform);
                                      }
                                    }}
                                  >
                                    <option value="">Select spec</option>
                                    {specOptions.map((spec) => (
                                      <option key={spec.id} value={spec.id}>
                                        {spec.platform} · {spec.placement} ({spec.width}x{spec.height})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.destinations}
                                    onChange={(e) => updateProductionMatrixCell(index, 'destinations', e.target.value)}
                                    placeholder="Comma-separated: YouTube, TikTok…"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top text-center">
                                  <input
                                    type="checkbox"
                                    className="h-3 w-3 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                    checked={row.is_feed}
                                    onChange={(e) => updateProductionMatrixCell(index, 'is_feed', e.target.checked)}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.feed_template}
                                    onChange={(e) => updateProductionMatrixCell(index, 'feed_template', e.target.value)}
                                    placeholder="Feed/DCO template name"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.template_id ?? ''}
                                    onChange={(e) => updateProductionMatrixCell(index, 'template_id', e.target.value)}
                                    placeholder="Template ID"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.feed_id ?? ''}
                                    onChange={(e) => updateProductionMatrixCell(index, 'feed_id', e.target.value)}
                                    placeholder="Feed ID"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    value={row.feed_asset_id ?? ''}
                                    onChange={(e) =>
                                      updateProductionMatrixCell(index, 'feed_asset_id', e.target.value)
                                    }
                                    placeholder="Asset ID in feed"
                                    disabled={!row.is_feed}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <textarea
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 resize-none"
                                    rows={2}
                                    value={row.production_details ?? ''}
                                    onChange={(e) =>
                                      updateProductionMatrixCell(index, 'production_details', e.target.value)
                                    }
                                    placeholder="For non-feed composites: file type, safe zones, animation asks."
                                    disabled={row.is_feed}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <textarea
                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 resize-none"
                                    rows={2}
                                    value={row.notes}
                                    onChange={(e) => updateProductionMatrixCell(index, 'notes', e.target.value)}
                                    placeholder="Key guardrails / handoff notes"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeProductionMatrixRow(index)}
                                    className="text-[11px] text-slate-400 hover:text-red-500"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Production Requirements List – concept-to-spec grouper */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Production Requirements List
                        </h3>
                        <p className="text-[11px] text-slate-500 max-w-xl">
                          Define which master assets are needed, where they will run, and capture
                          high-level production requirements against each one. This is your
                          pre-production checklist before detailed tickets are created.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={generateProductionJobsFromBuilder}
                          disabled={
                            builderLoading ||
                            (!builderSelectedConceptId && productionMatrixRows.length === 0) ||
                            (builderSelectedSpecIds.length === 0 && productionMatrixRows.length === 0)
                          }
                          className="px-4 py-2 text-xs font-semibold rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          {builderLoading ? 'Generating…' : 'Generate Production List'}
                        </button>
                        <button
                          type="button"
                          onClick={() => generateProductionJobsFromBuilder()}
                          className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                        >
                          Send matrix rows →
                        </button>
                      </div>
                    </div>
                    {builderError && (
                      <p className="text-[11px] text-red-500">{builderError}</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                          Creative Concept
                        </label>
                        <select
                          value={builderSelectedConceptId}
                          onChange={(e) => {
                            setBuilderSelectedConceptId(e.target.value);
                          }}
                          className="w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        >
                          <option value="">Select a concept…</option>
                          {concepts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500">
                          Concepts come from the Concept Canvas above. Choose one to act as the
                          master idea for this asset group.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                          Selected Specs
                        </label>
                        <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between">
                            <span className="text-sm text-slate-600">
                                {builderSelectedSpecIds.length} specs selected
                            </span>
                            <button
                                onClick={() => setProductionTab('specLibrary')}
                                className="text-xs text-teal-600 font-medium hover:text-teal-700 hover:underline"
                            >
                                Manage in Library →
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Select the target formats for this production run in the Spec Library.
                        </p>
                      </div>
                    </div>

                    {builderJobs.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                          Consolidated Production Jobs
                        </h4>
                        <p className="text-[11px] text-slate-500 max-w-2xl">
                          Each row is one master asset to be produced, with multiple downstream
                          delivery destinations grouped by shared physical specs. Add requirements
                          and a simple status so producers can see what needs to be built and where
                          it stands.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-[11px]">
                            <thead>
                              <tr className="text-left text-slate-500 border-b border-slate-200">
                                <th className="py-1.5 pr-4 font-semibold">Production Asset</th>
                                <th className="py-1.5 pr-4 font-semibold">Tech Specs</th>
                                <th className="py-1.5 pr-4 font-semibold">Destinations</th>
                                <th className="py-1.5 pr-4 font-semibold">Meta</th>
                                <th className="py-1.5 pr-4 font-semibold">Requirements</th>
                                <th className="py-1.5 pr-4 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {builderJobs.map((job) => {
                                const uniqueNotes = Array.from(
                                  new Set(job.destinations.map((d) => d.special_notes).filter(Boolean)),
                                );
                                const effectiveStatus = jobStatuses[job.job_id] ?? job.status;
                                const requirementsValue = jobRequirements[job.job_id] ?? '';
                                return (
                                  <tr key={job.job_id} className="border-b border-slate-100 align-top">
                                    <td className="py-1.5 pr-4">
                                      <div className="font-semibold text-slate-800">
                                        {job.asset_type} – {job.creative_concept}
                                      </div>
                                      <div className="text-[10px] text-slate-400">{job.job_id}</div>
                                    </td>
                                    <td className="py-1.5 pr-4 text-slate-700">
                                      {job.technical_summary}
                                    </td>
                                    <td className="py-1.5 pr-4">
                                      <div className="flex flex-wrap gap-1">
                                        {job.destinations.map((dest) => (
                                          <span
                                            key={`${job.job_id}-${dest.spec_id}-${dest.platform_name}`}
                                            className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]"
                                          >
                                            {dest.platform_name}{' '}
                                            <span className="text-slate-400">
                                              · {dest.format_name}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="py-1.5 pr-4 text-slate-500 text-[10px]">
                                      {job.technical_summary}
                                    </td>
                                    <td className="py-1.5 pr-4 text-slate-700">
                                      <textarea
                                        className="w-full min-w-[220px] text-[11px] border border-slate-300 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                        rows={3}
                                        placeholder={
                                          uniqueNotes.length
                                            ? `Key cautions: ${uniqueNotes.join(' | ')}`
                                            : 'Capture source asset requirements, editing notes, or handoff details.'
                                        }
                                        value={requirementsValue}
                                        onChange={(e) =>
                                          setJobRequirements((prev) => ({
                                            ...prev,
                                            [job.job_id]: e.target.value,
                                          }))
                                        }
                                      />
                                    </td>
                                    <td className="py-1.5 pr-4 text-slate-700">
                                      <select
                                        className="text-[11px] border border-slate-300 rounded-full px-2 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        value={effectiveStatus}
                                        onChange={(e) =>
                                          setJobStatuses((prev) => ({
                                            ...prev,
                                            [job.job_id]: e.target.value,
                                          }))
                                        }
                                      >
                                        <option value="Pending">Pending</option>
                                        <option value="In-Production">In Production</option>
                                        <option value="Approved">Approved</option>
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Existing Production Matrix – asset-level kitchen tickets */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Production Matrix
                        </h3>
                        <p className="text-[11px] text-slate-500 max-w-xl">
                          Generate and manage the Bill of Materials for this campaign. Each card is a
                          single asset to be built, with full spec details for editors and producers.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={generateProductionPlan}
                        disabled={productionLoading}
                        className="px-4 py-2 text-xs font-semibold rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
                      >
                        {productionLoading
                          ? 'Generating…'
                          : productionBatch
                          ? 'Regenerate Plan'
                          : 'Generate Plan'}
                      </button>
                    </div>
                    {productionError && (
                      <p className="text-[11px] text-red-500">{productionError}</p>
                    )}
                    {!productionBatch || productionAssets.length === 0 ? (
                      <div className="mt-12 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                        <p className="text-sm max-w-xs">
                          Start by generating a production plan from the first Strategy card and Concept.
                          You can then move assets through Todo → In Progress → In Review → Approved.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {['Todo', 'In_Progress', 'Review', 'Approved'].map((col) => (
                          <div
                            key={col}
                            className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                {col === 'In_Progress'
                                  ? 'In Progress'
                                  : col === 'Review'
                                  ? 'In Review'
                                  : col}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {productionAssets.filter((a) => a.status === col).length}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {productionAssets
                                .filter((a) => a.status === col)
                                .map((asset) => (
                                  <button
                                    key={asset.id}
                                    type="button"
                                    onClick={() => setSelectedAsset(asset)}
                                    className="w-full text-left bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-semibold text-slate-800 truncate">
                                          {asset.asset_name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate">
                                          {asset.platform} · {asset.placement}
                                        </p>
                                      </div>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                                        {asset.asset_type}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedAsset && (
                      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
                        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 truncate">
                                {selectedAsset.asset_name}
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                {selectedAsset.platform} · {selectedAsset.placement} ·{' '}
                                {selectedAsset.spec_dimensions}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedAsset(null)}
                              className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                Spec Sheet
                              </h4>
                              <div className="text-[11px] text-slate-600 space-y-1">
                                <p>
                                  <span className="font-semibold">Platform:</span>{' '}
                                  {selectedAsset.spec_details?.platform}
                                </p>
                                <p>
                                  <span className="font-semibold">Placement:</span>{' '}
                                  {selectedAsset.spec_details?.placement}
                                </p>
                                <p>
                                  <span className="font-semibold">Format:</span>{' '}
                                  {selectedAsset.spec_details?.format_name}
                                </p>
                                <p>
                                  <span className="font-semibold">Dimensions:</span>{' '}
                                  {selectedAsset.spec_details?.dimensions}
                                </p>
                                <p>
                                  <span className="font-semibold">Aspect Ratio:</span>{' '}
                                  {selectedAsset.spec_details?.aspect_ratio}
                                </p>
                                <p>
                                  <span className="font-semibold">Max Duration:</span>{' '}
                                  {selectedAsset.spec_details?.max_duration || 0}s
                                </p>
                                <p>
                                  <span className="font-semibold">File Type:</span>{' '}
                                  {selectedAsset.spec_details?.file_type}
                                </p>
                                {selectedAsset.spec_details?.safe_zone && (
                                  <p>
                                    <span className="font-semibold">Safe Zone:</span>{' '}
                                    {selectedAsset.spec_details.safe_zone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                Creative Directives
                              </h4>
                              <div className="space-y-1 text-[11px] text-slate-700">
                                <p>
                                  <span className="font-semibold">Visual Directive:</span>
                                  <br />
                                  {selectedAsset.visual_directive}
                                </p>
                                <p>
                                  <span className="font-semibold">Copy Headline:</span>
                                  <br />
                                  {selectedAsset.copy_headline}
                                </p>
                                {selectedAsset.source_asset_requirements && (
                                  <p>
                                    <span className="font-semibold">Source Requirements:</span>
                                    <br />
                                    {selectedAsset.source_asset_requirements}
                                  </p>
                                )}
                                {selectedAsset.adaptation_instruction && (
                                  <p>
                                    <span className="font-semibold">Adaptation Instruction:</span>
                                    <br />
                                    {selectedAsset.adaptation_instruction}
                                  </p>
                                )}
                                {selectedAsset.file_url && (
                                  <p>
                                    <span className="font-semibold">File URL:</span>
                                    <br />
                                    {selectedAsset.file_url}
                                  </p>
                                )}
                              </div>
                              <div className="mt-3 space-y-1">
                                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                  Status
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {['Todo', 'In_Progress', 'Review', 'Approved'].map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => updateProductionStatus(selectedAsset.id, s)}
                                      className={`px-2.5 py-1 text-[11px] rounded-full border ${
                                        selectedAsset.status === s
                                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700'
                                      }`}
                                    >
                                      {s === 'In_Progress' ? 'In Progress' : s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex justify-between">
                            <span>
                              Batch: {productionBatch?.batch_name} · Campaign: {productionBatch?.campaign_id}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {workspaceView === 'production' && productionTab === 'specLibrary' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Spec Library
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Select placements for the current production run. View, refresh, and extend the spec database.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSpecs(PRESET_SPECS)}
                          className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                        >
                          Reset to defaults
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSpecCreator(true)}
                          className="px-3 py-1.5 text-[11px] rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100"
                        >
                        + Add spec
                      </button>
                      <button
                        type="button"
                        onClick={sendSpecsToProduction}
                        className="px-3 py-1.5 text-[11px] rounded-full border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      >
                        Add to production sheet
                      </button>
                    </div>
                  </div>
                  {loadingSpecs && <p className="text-[11px] text-slate-400">Loading specs…</p>}
                  {specsError && (
                    <p className="text-[11px] text-red-500">
                      {specsError} {specs.length ? '(showing fallback list)' : ''}
                    </p>
                  )}

                  {!loadingSpecs && specs.length === 0 && (
                    <div className="p-4 rounded-lg border border-dashed border-slate-200 bg-white text-[11px] text-slate-500">
                      No specs available yet. Add a placement to seed the library.
                    </div>
                  )}

                  {specs.length > 0 && (
                    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                      <div className="max-h-[520px] overflow-auto">
                        <table className="min-w-full text-[11px]">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th className="w-8 px-3 py-2 border-b border-slate-200 bg-slate-50">
                                <span className="sr-only">Select</span>
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                                Platform
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                                Placement
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                                Size
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                                Orientation
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                                Media Type
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">
                                Notes
                              </th>
                            </tr>
                          </thead>
                            <tbody>
                            {specs.map((spec) => (
                              <tr key={spec.id} className="odd:bg-white even:bg-slate-50/40 align-top hover:bg-slate-50">
                                <td className="px-3 py-2 border-b border-slate-100 text-center">
                                  <input
                                    type="checkbox"
                                    className="h-3 w-3 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                    checked={builderSelectedSpecIds.includes(spec.id)}
                                    onChange={() => toggleBuilderSpec(spec.id)}
                                  />
                                </td>
                                <td className="px-3 py-2 border-b border-slate-100 text-slate-700">
                                  {spec.platform}
                                </td>
                                <td className="px-3 py-2 border-b border-slate-100 text-slate-700">
                                  {spec.placement}
                                </td>
                                <td className="px-3 py-2 border-b border-slate-100 text-slate-700">
                                  {spec.width}×{spec.height}
                                </td>
                                <td className="px-3 py-2 border-b border-slate-100 text-slate-500">
                                  {spec.orientation}
                                </td>
                                <td className="px-3 py-2 border-b border-slate-100 text-slate-500">
                                  {spec.media_type}
                                </td>
                                <td className="px-3 py-2 border-b border-slate-100 text-slate-500">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{spec.notes}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard?.writeText?.(spec.id);
                                      }}
                                      className="text-[10px] text-slate-400 hover:text-teal-700"
                                      title="Copy spec ID"
                                    >
                                      Copy ID
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            </tbody>
                          </table>
                        </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                          Add spec to library
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          Capture a new placement or format and make it selectable for production requirements.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSpecCreator((prev) => !prev)}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                      >
                        {showSpecCreator ? 'Hide form' : 'Add spec'}
                      </button>
                    </div>
                    {showSpecCreator && (
                      <div className="space-y-2">
                        {createSpecError && (
                          <p className="text-[11px] text-red-500">{createSpecError}</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                              Platform
                            </label>
                            <input
                              className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              placeholder="Meta, TikTok, YouTube…"
                              value={newSpecPlatform}
                              onChange={(e) => setNewSpecPlatform(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                              Placement
                            </label>
                            <input
                              className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              placeholder="Stories, In-Feed, Bumper…"
                              value={newSpecPlacement}
                              onChange={(e) => setNewSpecPlacement(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                Width
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                placeholder="1080"
                                value={newSpecWidth}
                                onChange={(e) => setNewSpecWidth(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                Height
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                placeholder="1920"
                                value={newSpecHeight}
                                onChange={(e) => setNewSpecHeight(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                              Orientation
                            </label>
                            <input
                              className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              placeholder="Vertical, Horizontal, Square"
                              value={newSpecOrientation}
                              onChange={(e) => setNewSpecOrientation(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                              Media Type
                            </label>
                            <input
                              className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              placeholder="Video, Image, HTML5…"
                              value={newSpecMediaType}
                              onChange={(e) => setNewSpecMediaType(e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                              Notes
                            </label>
                            <textarea
                              className="w-full text-[11px] border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                              rows={2}
                              placeholder="File type, max duration, safe zones, or other guardrails."
                              value={newSpecNotes}
                              onChange={(e) => setNewSpecNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewSpecPlatform('');
                              setNewSpecPlacement('');
                              setNewSpecWidth('');
                              setNewSpecHeight('');
                              setNewSpecOrientation('');
                              setNewSpecMediaType('');
                              setNewSpecNotes('');
                            }}
                            className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={createSpec}
                            disabled={creatingSpec}
                            className="px-4 py-1.5 text-[11px] font-semibold rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
                          >
                            {creatingSpec ? 'Saving…' : 'Save spec'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showMatrixLibrary && (
                <div className="absolute inset-0 bg-white/98 backdrop-blur-md z-30 flex flex-col">
                  {/* Sticky header so the close button is always visible */}
                  <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-10">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800">Strategy Matrix Library</h2>
                      <p className="text-[11px] text-slate-500">
                        Save and reuse structured strategy matrices across campaigns.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveCurrentMatrixToLibrary}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100"
                      >
                        Save current matrix
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMatrixLibrary(false)}
                        className="p-2 hover:bg-gray-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {matrixLibrary.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                        <p className="text-sm max-w-xs">
                          No saved content matrices yet. Build a grid and click &quot;Save current matrix&quot; to add one.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                        {matrixLibrary.map((template) => (
                          <div
                            key={template.id}
                            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                                  {template.id}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600">{template.description}</p>
                              <div className="bg-slate-50 rounded-lg border border-slate-100 p-2">
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                  Preview rows
                                </p>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {template.rows.slice(0, 4).map((row) => (
                                    <div key={row.id} className="text-[11px] text-slate-600">
                                      <span className="font-mono text-slate-500 mr-1">{row.id}</span>
                                      <span>{row.audience_segment || 'Audience N/A'}</span>
                                      <span className="mx-1 text-slate-400">·</span>
                                      <span>{row.funnel_stage || 'Stage N/A'}</span>
                                      <span className="mx-1 text-slate-400">·</span>
                                      <span>{row.channel || 'Channel N/A'}</span>
                                    </div>
                                  ))}
                                  {template.rows.length > 4 && (
                                    <div className="text-[10px] text-slate-400">
                                      + {template.rows.length - 4} more row(s)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => applyMatrixTemplate(template.id)}
                                className="text-[11px] px-3 py-1.5 rounded-full bg-teal-600 text-white hover:bg-teal-700"
                              >
                                Apply to workspace
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMatrixTemplate(template.id)}
                                className="text-[11px] text-slate-400 hover:text-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {workspaceView === 'concepts' && rightTab === 'builder' && (
                <div className="space-y-4">
                  {/* Top-level Concept Canvas toolbar */}
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Concept Canvas
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={draftConceptsFromBrief}
                          className="text-xs text-slate-600 hover:text-teal-700 font-medium px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-teal-300"
                        >
                          Draft from brief
                        </button>
                        <button
                          onClick={addConcept}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium px-3 py-1 rounded-full bg-teal-50 border border-teal-100"
                        >
                          + Add concept
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => alert('DAM connection coming soon')}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Connect to DAM
                      </button>
                      <button
                        type="button"
                        onClick={() => alert('Brand assets integration coming soon')}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Add Brand Assets
                      </button>
                      <button
                        type="button"
                        onClick={() => alert('Brand voice loading coming soon')}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Load Brand Voice
                      </button>
                      <button
                        type="button"
                        onClick={() => alert('Brand style guide loading coming soon')}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Load Brand Style Guide
                      </button>
                    </div>
                  </div>

                  {/* Canvas body: per-concept input/output rows */}
                  {concepts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-4 mt-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 13h6m-3-3v6m7 1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414A1 1 0 0118 10.414V17z"
                          />
                        </svg>
                      </div>
                      <p className="text-sm max-w-[260px]">
                        Start capturing modular creative concepts here. Link each concept to an asset or audience row
                        from the Strategy Matrix.
                      </p>
                      <button
                        onClick={addConcept}
                        className="mt-2 px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full border border-teal-100"
                      >
                        Add first concept
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {concepts.map((c, index) => {
                        const isOnMoodBoard = moodBoardConceptIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
                          >
                            {/* LEFT: Concept input card */}
                            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                              <div className="flex items-center justify-between gap-3">
                                <input
                                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                  placeholder="Concept title (e.g., Night Reset Ritual)"
                                  value={c.title}
                                  onChange={(e) => updateConceptField(index, 'title', e.target.value)}
                                />
                                <input
                                  className="w-28 border border-gray-200 rounded px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                  placeholder="Asset ID"
                                  value={c.asset_id}
                                  onChange={(e) => updateConceptField(index, 'asset_id', e.target.value)}
                                />
                              </div>
                              <textarea
                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 min-h-[72px]"
                                placeholder="Short narrative of the idea, hooks, and how it modularly recombines across channels."
                                value={c.description}
                                onChange={(e) => updateConceptField(index, 'description', e.target.value)}
                              />
                              <textarea
                                className="w-full border border-dashed border-gray-200 rounded px-2 py-1 text-[11px] text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-400 min-h-[48px]"
                                placeholder="Production notes / visual references (e.g., color language, motion cues, mandatory elements)."
                                value={c.notes}
                                onChange={(e) => updateConceptField(index, 'notes', e.target.value)}
                              />
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => removeConcept(index)}
                                  className="text-[11px] text-slate-400 hover:text-red-500"
                                >
                                  Remove
                                </button>
                                <span className="text-[10px] text-slate-400">{c.id}</span>
                              </div>
                            </div>

                            {/* RIGHT: AI prompt + output card */}
                            <div className="space-y-2">
                              <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    AI asset prompt
                                  </span>
                                  <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-1 py-0.5">
                                    {(['image', 'copy', 'video'] as const).map((kind) => (
                                      <button
                                        key={kind}
                                        type="button"
                                        onClick={() => updateConceptField(index, 'kind', kind)}
                                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                                          (c.kind ?? 'image') === kind
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                      >
                                        {kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Copy'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <textarea
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 min-h-[72px]"
                                  placeholder="Optional: refine the prompt the system will send to generate this asset (image, copy, or video). If left blank, it will be built from the concept fields."
                                  value={c.generatedPrompt ?? ''}
                                  onChange={(e) =>
                                    updateConceptField(index, 'generatedPrompt', e.target.value as any)
                                  }
                                />
                                <div className="flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const plan: any = previewPlan || {};
                                      const lines: string[] = [];

                                      if (plan.campaign_name) {
                                        lines.push(`Campaign: ${plan.campaign_name}`);
                                      }
                                      if (plan.single_minded_proposition) {
                                        lines.push(`Single-minded proposition: ${plan.single_minded_proposition}`);
                                      }
                                      if (plan.primary_audience) {
                                        lines.push(`Primary audience: ${plan.primary_audience}`);
                                      }
                                      if (plan.brand_voice?.summary) {
                                        lines.push(`Brand voice: ${plan.brand_voice.summary}`);
                                      }

                                      lines.push(`Concept title: ${c.title || 'Untitled concept'}`);
                                      if (c.description) {
                                        lines.push(`Concept description: ${c.description}`);
                                      }
                                      if (c.notes) {
                                        lines.push(`Production notes: ${c.notes}`);
                                      }

                                      const prompt = lines.join('\n');
                                      setConcepts((prev) =>
                                        prev.map((existing, i) =>
                                          i === index
                                            ? {
                                                ...existing,
                                                status: 'ready',
                                                generatedPrompt: prompt,
                                              }
                                            : existing,
                                        ),
                                      );
                                    }}
                                    className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-teal-500 bg-teal-600 text-white hover:bg-teal-700"
                                  >
                                    {`Generate ${
                                      c.kind === 'video' ? 'video' : c.kind === 'copy' ? 'copy' : 'image'
                                    } prompt`}
                                  </button>
                                  <div className="flex items-center gap-2">
                                    {c.status === 'ready' && (
                                      <span className="text-[11px] text-emerald-600">Prompt ready for production</span>
                                    )}
                                    {c.status === 'error' && (
                                      <span className="text-[11px] text-red-500">Generation failed</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMoodBoardConceptIds((prev) =>
                                          isOnMoodBoard ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                                        );
                                      }}
                                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                        isOnMoodBoard
                                          ? 'border-amber-500 text-amber-700 bg-amber-50'
                                          : 'border-slate-200 text-slate-500 bg-white hover:border-amber-400 hover:text-amber-700'
                                      }`}
                                    >
                                      {isOnMoodBoard ? 'On concept board' : 'Add to concept board'}
                                    </button>
                                  </div>
                                </div>
                                <div className="border border-slate-100 rounded-lg bg-slate-50/60 px-2.5 py-2 min-h-[72px]">
                                  <p className="text-[11px] text-slate-600 whitespace-pre-wrap">
                                    {c.generatedPrompt ||
                                      'No AI output yet. Use "Generate prompt" to create an AI-ready description.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {workspaceView === 'concepts' && rightTab === 'board' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Concept Board
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        A curated board of final concepts you’ve marked from the Concepts canvas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRightTab('builder')}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                    >
                      Manage concepts
                    </button>
                  </div>

                  {moodBoardConceptIds.length === 0 || concepts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-3 mt-10">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 7v10a2 2 0 002 2h14M3 7a2 2 0 012-2h7m-9 2l4 4m10-6l-3.172 3.172M21 7a2 2 0 00-2-2h-1.5M21 7l-4 4M10 5l2 2"
                          />
                        </svg>
                      </div>
                      <p className="text-sm max-w-xs">
                        No concepts on the board yet. From the Concepts tab, use “Add to concept board” on any card to
                        pin it here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {concepts
                        .filter((c) => moodBoardConceptIds.includes(c.id))
                        .map((c) => (
                          <div
                            key={c.id}
                            className="relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">
                                  {c.title || 'Untitled concept'}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  <span className="font-mono">{c.asset_id}</span>
                                  {c.kind && (
                                    <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 capitalize">
                                      {c.kind}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setMoodBoardConceptIds((prev) => prev.filter((id) => id !== c.id))
                                }
                                className="text-[10px] text-slate-400 hover:text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                            {c.description && (
                              <p className="text-[11px] text-slate-600 line-clamp-3">{c.description}</p>
                            )}
                            {c.notes && (
                              <p className="text-[10px] text-slate-400 line-clamp-2 border-t border-dashed border-slate-200 pt-1 mt-1">
                                {c.notes}
                              </p>
                            )}
                            {c.generatedPrompt && (
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                                Prompt: <span className="text-slate-600">{c.generatedPrompt}</span>
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {workspaceView === 'feed' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Content Feed
                      </h3>
                      <p className="text-[11px] text-slate-500 max-w-xl">
                        Build and QA the Asset Feed that will be handed off to your DCO or activation team. Each row
                        represents one creative variant in the final manifest.
                      </p>
                    </div>
                  </div>

                  <section className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={addFeedRow}
                      className="px-4 py-2 text-xs font-semibold rounded-full bg-teal-600 text-white hover:bg-teal-700"
                    >
                      {feedRows.length === 0 ? 'Add first row' : 'Add row'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFeedFieldConfig((prev) => !prev)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                    >
                      Feed Fields
                    </button>
                    <button
                      type="button"
                      onClick={exportFeedCsv}
                      disabled={!feedRows.length}
                      className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-300 text-slate-700 bg-white disabled:opacity-50"
                    >
                      Export to CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportFeedBrief}
                      disabled={!feedRows.length}
                      className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-300 text-slate-700 bg-white disabled:opacity-50"
                    >
                      Export Production Brief (TXT)
                    </button>
                    <p className="text-[11px] text-slate-400">
                      Default values align to the Master Feed Variable Set. You can edit each cell inline.
                    </p>
                  </section>

                  {showFeedFieldConfig && (
                    <div className="mt-1 mb-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2 gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                            Feed Fields
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Turn feed columns on/off and add custom variables for this asset feed.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={addCustomFeedField}
                          className="text-[11px] px-3 py-1 rounded-full border border-teal-400 text-teal-700 bg-white hover:bg-teal-50"
                        >
                          + Add custom field
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {feedFields.map((field) => {
                          const checked = visibleFeedFields.includes(field.key);
                          const isCustom = field.isCustom;
                          return (
                            <div
                              key={field.key}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full border ${
                                checked
                                  ? 'bg-white border-teal-500 text-teal-700 shadow-sm'
                                  : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleFeedField(field.key)}
                                className="outline-none"
                              >
                                {field.label}
                              </button>
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => deleteCustomFeedField(field.key)}
                                  className="ml-1 text-[10px] text-slate-400 hover:text-red-500"
                                  title="Remove custom field"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <section className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                      <p className="text-[11px] text-slate-500">
                        {feedRows.length
                          ? `Showing ${feedRows.length} rows in the asset feed.`
                          : 'No rows yet. Use "Add first row" to start your feed.'}
                      </p>
                    </div>
                    <div className="max-h-[480px] overflow-auto">
                      <table className="w-full text-[11px] table-auto">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            {feedFields
                              .filter((col) => visibleFeedFields.includes(col.key))
                              .map((col) => (
                              <th
                                key={col.key as string}
                                className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-slate-200"
                              >
                                {col.label}
                              </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {feedRows.map((row, index) => (
                            <tr key={row.row_id} className="odd:bg-white even:bg-slate-50/40">
                              {feedFields
                                .filter((col) => visibleFeedFields.includes(col.key))
                                .map((col) => {
                                  const key = col.key as keyof FeedRow;
                                const cellValue = row[key];

                                if (key === 'row_id') {
                                  return (
                                    <td
                                      key={key as string}
                                      className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700"
                                    >
                                      {String(cellValue ?? '')}
                                    </td>
                                  );
                                }

                                if (key === 'is_default') {
                                  return (
                                    <td key={key as string} className="px-3 py-2 border-b border-slate-100">
                                      <button
                                        type="button"
                                        onClick={() => setDefaultFeedRow(index)}
                                        className={`px-2 py-1 rounded-full text-[10px] ${
                                          row.is_default
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                      >
                                        {row.is_default ? 'Default' : 'Make default'}
                                      </button>
                                    </td>
                                  );
                                }

                                  return (
                                    <td key={key as string} className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                                      <input
                                        className="border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                        value={(cellValue ?? '') as string}
                                        onChange={(e) => updateFeedCell(index, key, e.target.value)}
                                      />
                                    </td>
                                  );
                                })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
      )}

      {/* Close main workspace row container */}
      </div>

    </main>
  );
}
