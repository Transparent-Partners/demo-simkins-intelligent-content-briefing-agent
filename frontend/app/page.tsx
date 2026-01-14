'use client';
import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import * as XLSX from 'xlsx';
import Image from 'next/image';

// API base selection:
// - In production on Vercel, we generally want SAME-ORIGIN so `vercel.json` routes can forward /brief/* etc.
// - In local dev, we want http://127.0.0.1:8000 (or whatever NEXT_PUBLIC_API_BASE_URL points to).
// - Guard against a misconfigured production env var accidentally set to localhost.
const API_BASE_URL = (() => {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';

    // If no env var is set and we're on localhost, default to local backend
    if (!envBase && isLocalHost) {
      return 'http://localhost:8000';
    }

    if (!envBase) return '';

    const envLooksLocal = /localhost|127\.0\.0\.1/i.test(envBase);
    if (envLooksLocal && !isLocalHost) {
      // Production (or any non-local host) should not try to call a localhost API.
      return '';
    }
    return envBase;
  }

  // Server-side render fallback for local tooling
  return envBase ?? 'http://localhost:8000';
})();

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

const PLATFORM_MATRIX_KEYS: MatrixFieldKey[] = [
  'crm_cohort',
  'site_behavior',
  'meta_audience',
  'tiktok_audience',
  'youtube_audience',
  'linkedin_audience',
  'dv360_audience',
  'open_web_audience',
  'liveramp_segment',
  'pixel_event_trigger',
];

const SYSTEM_MATRIX_KEYS: MatrixFieldKey[] = ['asset_id', 'specs_lookup_key', 'notes'];

const BASE_MATRIX_FIELDS: MatrixFieldConfig[] = [
  // PRIMARY FIELDS – Identity Block
  { key: 'segment_source', label: 'Segment Source' },
  { key: 'segment_id', label: 'Segment ID' },
  { key: 'segment_name', label: 'Audience / Segment' },
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

  // Platform-specific audience handles
  { key: 'crm_cohort', label: 'CRM / 1P Segment' },
  { key: 'site_behavior', label: 'Site Behavior / Trigger' },
  { key: 'meta_audience', label: 'Meta Audience' },
  { key: 'tiktok_audience', label: 'TikTok Audience' },
  { key: 'youtube_audience', label: 'YouTube Audience' },
  { key: 'linkedin_audience', label: 'LinkedIn Audience' },
  { key: 'dv360_audience', label: 'DV360 Audience' },
  { key: 'open_web_audience', label: 'Open Web / Display Audience' },
  { key: 'liveramp_segment', label: 'LiveRamp Segment' },
  { key: 'pixel_event_trigger', label: 'Pixel Event Trigger' },

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
  // Allow dynamic brief fields added by the user or agent
  [key: string]: any;
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

type DestinationEntry = {
  name: string;
  audience?: string;
  spec_id?: string;
};

type ProductionJobRow = {
  job_id: string;
  creative_concept: string;
  asset_type: string;
  destinations: DeliveryDestinationRow[];
  technical_summary: string;
  status: string;
  // feed/build meta captured later in UI, not required from generator
  is_feed?: boolean;
  feed_template?: string;
  template_id?: string;
  feed_id?: string;
  feed_asset_id?: string;
  production_details?: string;
  missing_destinations?: boolean;
};

type BuildDetails = {
  build_direction?: string;
  copy_tone?: string;
  copy_length?: string;
  copy_cta?: string;
  image_composition?: string;
  image_treatments?: string;
  image_alt?: string;
  h5_frame_1?: string;
  h5_frame_2?: string;
  h5_frame_3?: string;
  h5_interactions?: string;
  video_duration?: string;
  video_shotlist?: string;
  video_voiceover?: string;
  audio_script?: string;
  audio_sfx?: string;
};

type RequirementField = {
  id: string;
  label: string;
  value: string;
};

const ASSET_TYPES: ('copy' | 'image' | 'h5' | 'video' | 'audio')[] = ['copy', 'image', 'h5', 'video', 'audio'];

type ProductionMatrixLine = {
  id: string;
  segment_source?: string;
  audience: string;
  concept_id: string;
  spec_id: string;
  destinations: DestinationEntry[];
  notes: string;
  is_feed: boolean;
  production_details?: string;
  feed_template?: string;
  template_id?: string;
  feed_id?: string;
  feed_asset_id?: string;
   production_status?: 'Todo' | 'In_Progress' | 'Review' | 'Approved' | 'Pending';
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

const PARTNER_FIELD_LIBRARY: Record<string, FeedFieldConfig[]> = {
  Facebook: [
    { key: 'primary_text', label: 'Primary Text' },
    { key: 'headline', label: 'Headline' },
    { key: 'description', label: 'Description' },
    { key: 'cta', label: 'CTA' },
    { key: 'link_url', label: 'Link URL' },
    { key: 'display_link', label: 'Display Link' },
    { key: 'image_url', label: 'Image URL' },
    { key: 'video_url', label: 'Video URL' },
    { key: 'tracking_template', label: 'Tracking Template' },
  ],
  Instagram: [
    { key: 'caption', label: 'Caption' },
    { key: 'cta', label: 'CTA' },
    { key: 'image_url', label: 'Image URL' },
    { key: 'reel_url', label: 'Reel/Video URL' },
    { key: 'landing_url', label: 'Landing URL' },
    { key: 'hashtags', label: 'Hashtags' },
    { key: 'sponsored_tag', label: 'Sponsored Tag' },
  ],
  TikTok: [
    { key: 'primary_text', label: 'Primary Text' },
    { key: 'cta_text', label: 'CTA Text' },
    { key: 'video_url', label: 'Video URL' },
    { key: 'landing_url', label: 'Landing URL' },
    { key: 'display_name', label: 'Display Name' },
    { key: 'tracking_code', label: 'Tracking Code' },
  ],
  DV360: [
    { key: 'headline', label: 'Headline' },
    { key: 'long_headline', label: 'Long Headline' },
    { key: 'description', label: 'Description' },
    { key: 'cta_text', label: 'CTA Text' },
    { key: 'image_url', label: 'Image URL' },
    { key: 'video_url', label: 'Video URL' },
    { key: 'landing_url', label: 'Landing URL' },
    { key: 'backup_image', label: 'Backup Image' },
    { key: 'impression_pixel', label: 'Impression Pixel' },
  ],
  LinkedIn: [
    { key: 'intro_text', label: 'Intro Text' },
    { key: 'headline', label: 'Headline' },
    { key: 'description', label: 'Description' },
    { key: 'cta', label: 'CTA' },
    { key: 'image_url', label: 'Image URL' },
    { key: 'video_url', label: 'Video URL' },
    { key: 'destination_url', label: 'Destination URL' },
    { key: 'lead_form_id', label: 'Lead Form ID' },
  ],
  Innovid: [
    { key: 'primary_asset', label: 'Primary Asset' },
    { key: 'backup_image', label: 'Backup Image' },
    { key: 'click_url', label: 'Click URL' },
    { key: 'beacon_url', label: 'Beacon URL' },
    { key: 'tracking_code', label: 'Tracking Code' },
    { key: 'dynamic_key', label: 'Dynamic Data Key' },
    { key: 'data_feed_url', label: 'Data Feed URL' },
    { key: 'cta_text', label: 'CTA Text' },
  ],
  GCM: [
    { key: 'headline', label: 'Headline' },
    { key: 'description', label: 'Description' },
    { key: 'final_url', label: 'Final URL' },
    { key: 'path1', label: 'Path 1' },
    { key: 'path2', label: 'Path 2' },
    { key: 'utm', label: 'UTM' },
    { key: 'image_url', label: 'Image URL' },
    { key: 'backup_image', label: 'Backup Image' },
    { key: 'impression_url', label: 'Impression URL' },
    { key: 'click_tracker', label: 'Click Tracker' },
  ],
};

const DEFAULT_FEED_PLATFORM = Object.keys(PARTNER_FIELD_LIBRARY)[0] || 'Meta';

const INITIAL_STRATEGY_MATRIX_RUNNING_SHOES: MatrixRow[] = [
  {
    segment_source: 'CRM + site analytics',
    segment_id: 'RUN-LOYAL',
    segment_name: 'Run Club Loyalists',
    segment_size: '48k',
    priority_level: 'Tier 1 (Bespoke)',
    segment_description: 'Members logging >30 miles/week; purchase 2+ pairs/year.',
    key_insight: 'They chase PRs and want proof that lighter shoes = faster splits.',
    current_perception: 'Our shoes are reliable daily trainers.',
    desired_perception: 'We are their fastest race-day partner.',
    primary_message_pillar: 'Speed with evidence (race times, athlete data).',
    call_to_action_objective: 'Shop the race-day lineup',
    tone_guardrails: 'Confident, not cocky. Evidence-led.',
    platform_environments: 'Meta, TikTok, YouTube',
    contextual_triggers: 'Race calendar, long-run days',
    notes: 'Use Run Club UGC and Strava overlays.',
  },
  {
    segment_source: 'Prospecting lookalikes',
    segment_id: 'RUN-NEW',
    segment_name: 'New to Running',
    segment_size: '310k',
    priority_level: 'Tier 2',
    segment_description: 'Brand-new runners seeking first “real” running shoe.',
    key_insight: 'They fear injury and decision overwhelm more than price.',
    current_perception: 'Unsure which model fits their gait/goals.',
    desired_perception: 'We make choosing easy and reduce injury risk.',
    primary_message_pillar: 'Confidence + guidance (fit quiz, store fitting).',
    call_to_action_objective: 'Take the fit quiz',
    tone_guardrails: 'Encouraging, beginner-safe, avoid jargon.',
    platform_environments: 'Meta, YouTube, Retail/CRM',
    contextual_triggers: 'New year, spring training, first 5k sign-up',
    notes: 'Lead with cushioning/comfort visuals; invite to quiz.',
  },
  {
    segment_source: 'Paid social + search retargeting',
    segment_id: 'RUN-TRAIL',
    segment_name: 'Trail Explorers',
    segment_size: '95k',
    priority_level: 'Tier 2',
    segment_description: 'Outdoor-focused runners adding weekly trail miles.',
    key_insight: 'They want grip + stability without losing speed.',
    current_perception: 'We are road-first; unsure about trail cred.',
    desired_perception: 'We’re their trusted trail weapon—light, grippy, stable.',
    primary_message_pillar: 'Grip + stability proven on technical terrain.',
    call_to_action_objective: 'Shop trail collection',
    tone_guardrails: 'Grounded, technical clarity; avoid hype.',
    platform_environments: 'YouTube, TikTok, Open Web',
    contextual_triggers: 'Weekend trail plans, park visits, REI-style content',
    notes: 'Use muddy/gritty textures; show outsole close-ups.',
  },
  {
    segment_source: 'Amazon DSP / Shopping Signals',
    segment_id: 'RUN-AMZ',
    segment_name: 'Prime Runners (Footwear Buyers)',
    segment_size: '120k',
    priority_level: 'Tier 1',
    segment_description: 'Recent Amazon purchasers of running shoes/accessories.',
    key_insight: 'Ready to repurchase on replenishment cadence; care about price + speed.',
    current_perception: 'See us as a safe mid-tier option; default to Prime deals.',
    desired_perception: 'We’re the best performance-for-value option with Prime-fast delivery.',
    primary_message_pillar: 'Value + speed: race-day comfort with Prime convenience.',
    call_to_action_objective: 'Buy now on Amazon',
    tone_guardrails: 'Value-forward, straightforward, avoid heavy jargon.',
    platform_environments: 'Amazon, Open Web',
    contextual_triggers: '30/60/90-day purchase windows',
    notes: 'Lead with “Prime fast” + comfort; show price/value.',
  },
  {
    segment_source: 'Meta Retargeting (Pixel)',
    segment_id: 'RUN-RET-META',
    segment_name: 'Cart Abandons (Meta)',
    segment_size: '42k',
    priority_level: 'Tier 1',
    segment_description: 'Site visitors who abandoned cart on racing models.',
    key_insight: 'High intent but need reassurance on fit/return policy.',
    current_perception: 'Worried shoe may not fit or returns are a hassle.',
    desired_perception: 'Confident they’ll nail the fit and can return easily.',
    primary_message_pillar: 'Fit assurance + risk-free checkout.',
    call_to_action_objective: 'Complete purchase',
    tone_guardrails: 'Reassuring, concise, proof-driven on fit/returns.',
    platform_environments: 'Meta',
    contextual_triggers: 'Cart abandon events, 48-hr window',
    notes: 'Use dynamic product feed; highlight free returns.',
  },
  {
    segment_source: 'DV360 3P Fitness Data',
    segment_id: 'RUN-DV360',
    segment_name: 'Fitness Enthusiasts (DV360)',
    segment_size: '260k',
    priority_level: 'Tier 2',
    segment_description: '3P segments of endurance/fitness content consumers.',
    key_insight: 'Respond to performance proof and athlete validation.',
    current_perception: 'View us as solid but not the most performance-proven.',
    desired_perception: 'Believe we’re race-proven with data and athlete backing.',
    primary_message_pillar: 'Performance receipts: splits, cushioning tech, athlete quotes.',
    call_to_action_objective: 'Explore performance lineup',
    tone_guardrails: 'Proof-first, athletic, avoid fluff.',
    platform_environments: 'DV360, YouTube, CTV',
    contextual_triggers: 'Sports highlights, fitness content, CTV sports slots',
    notes: 'Lean on pro/coach voiceover; show split times.',
  },
  {
    segment_source: 'LiveRamp Syndicated',
    segment_id: 'RUN-LR',
    segment_name: 'Loyalty Lookalikes (LiveRamp)',
    segment_size: '180k',
    priority_level: 'Tier 2',
    segment_description: 'Modeled lookalikes off CRM heavy buyers.',
    key_insight: 'Similar buying power; need proof this is “worth switching.”',
    current_perception: 'Loyal to incumbent brands; not convinced to switch.',
    desired_perception: 'See clear upside in switching for speed + perks.',
    primary_message_pillar: 'Switch incentive + performance upgrade story.',
    call_to_action_objective: 'Claim loyalty offer',
    tone_guardrails: 'Confident, value-positive, avoid heavy discounting language.',
    platform_environments: 'Meta, TikTok, YouTube',
    contextual_triggers: 'Seasonal sale windows, race weekends',
    notes: 'Price + performance bundles; show loyalty perks.',
  },
  {
    segment_source: 'Epsilon Household Data',
    segment_id: 'RUN-EPS',
    segment_name: 'Household Athletes (HH)',
    segment_size: '90k',
    priority_level: 'Tier 3',
    segment_description: 'HH-level runners buying for family (2+ pairs).',
    key_insight: 'Value durability + deals for multiple pairs.',
    current_perception: 'Assume performance shoes are pricey for households.',
    desired_perception: 'Believe bundles make premium performance affordable for family.',
    primary_message_pillar: 'Durable mileage + bundle value for households.',
    call_to_action_objective: 'Shop family bundle',
    tone_guardrails: 'Practical, warm, avoid overly technical claims.',
    platform_environments: 'CTV, Open Web, Meta',
    contextual_triggers: 'Back-to-school, holiday gifting',
    notes: 'Bundle offers; family/household creative frames.',
  },
  {
    segment_source: 'LinkedIn Matched Audiences',
    segment_id: 'RUN-B2B',
    segment_name: 'Wellness-at-Work Leads',
    segment_size: '55k',
    priority_level: 'Tier 3',
    segment_description: 'HR/benefits leaders exploring wellness stipends.',
    key_insight: 'Care about employee engagement + perk differentiation.',
    current_perception: 'See us as consumer-first; unsure about workplace fit.',
    desired_perception: 'View us as a turnkey wellness perk that boosts engagement.',
    primary_message_pillar: 'Employee perk value + easy rollout.',
    call_to_action_objective: 'Book a perks consult',
    tone_guardrails: 'Professional, outcomes-focused, avoid hype.',
    platform_environments: 'LinkedIn, Open Web',
    contextual_triggers: 'Budget planning, benefit cycle',
    notes: 'Emphasize perk value and participation; softer CTA.',
  },
  {
    segment_source: 'TikTok Creator Affinity',
    segment_id: 'RUN-CREATORS',
    segment_name: 'Running Creators & Fans',
    segment_size: '150k',
    priority_level: 'Tier 2',
    segment_description: 'TikTok users engaging with running/fitness creators.',
    key_insight: 'React to authentic creator POV and gear breakdowns.',
    current_perception: 'Think our ads feel polished but less authentic.',
    desired_perception: 'Trust creator-led proofs that our shoes perform.',
    primary_message_pillar: 'Creator-tested performance stories.',
    call_to_action_objective: 'Watch the collab + shop featured shoe',
    tone_guardrails: 'Authentic, energetic, avoid corporate polish.',
    platform_environments: 'TikTok, Meta',
    contextual_triggers: 'Creator collabs, race recaps',
    notes: 'Use creator-led hooks; unboxings and on-foot tests.',
  },
];

const AUDIENCE_IMPORT_FIELDS: { key: MatrixFieldKey; label: string }[] = [
  { key: 'segment_name', label: 'Audience / Segment' },
  { key: 'segment_id', label: 'Segment ID' },
  { key: 'segment_size', label: 'Segment Size' },
  { key: 'priority_level', label: 'Priority Level' },
  { key: 'segment_description', label: 'Segment Description' },
  { key: 'key_insight', label: 'Key Insight' },
  { key: 'current_perception', label: 'Current Perception' },
  { key: 'desired_perception', label: 'Desired Perception' },
  { key: 'primary_message_pillar', label: 'Primary Message Pillar' },
  { key: 'call_to_action_objective', label: 'CTA Objective' },
  { key: 'tone_guardrails', label: 'Tone Guardrails' },
  { key: 'platform_environments', label: 'Platform Environments' },
  { key: 'contextual_triggers', label: 'Contextual Triggers' },
  { key: 'notes', label: 'Notes' },
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
  status?: 'idle' | 'generating' | 'ready' | 'completed' | 'error';
  generatedPrompt?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  generatedAssetUrl?: string; // URL or base64 data URL for generated image/video
  generationJobId?: string; // For video generation polling
  audienceLineIds?: string[]; // Array of audience matrix row IDs associated with this concept
  selectedFields?: Array<{ lineId: string; fieldKey: string; fieldLabel: string; fieldValue: string }>; // Selected fields from audience lines
  errorMessage?: string; // Error message if generation failed
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

const RUNNING_SHOE_DEMO_BRIEF = {
  campaignName: 'Velocity Run System Launch',
  smp: 'Prove faster splits come from lighter shoes and smarter training prompts.',
  primaryAudience:
    'Run club loyalists and returning racers logging >30 miles/week who want proof they can PR again.',
  narrative: `CAMPAIGN: Velocity Run System
--------------------------------------------------
SINGLE MINDED PROPOSITION:
"Light, race-ready shoes plus smart cues make you faster on real courses."

PRIMARY AUDIENCE:
Run club loyalists and returning racers logging >30 miles/week who want proof they can PR again. They watch Strava segments, compare splits, and swap gear advice in group chats.

CREATIVE DIRECTION:
- Anchor every story in proof: recent race times, split improvements, and athlete validation.
- Show real runners and coaches in city and trail settings; no sterile studio looks.
- Keep copy short, verb-led, and confident. Visual cues of speed: cadence, stride, lightness.

PRODUCTION NOTES:
- 9:16 and 16:9 cutdowns with captions; show outsole close-ups and stability on corners.
- Use on-screen data overlays sparingly; 1–2 stats per frame.
- Avoid generic "fitness montage" shots; prioritize race prep moments and post-run recovery.`,
  audiences: ['Run Club Loyalists', 'New to Running', 'Trail Explorers'],
  kpis: ['Race shoe revenue lift', 'Fit quiz completions', 'Store visit bookings'],
  flight: { start: '2024-08-01', end: '2024-09-30' },
};

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
  // Amazon (demo)
  { id: 'AMAZON_DISPLAY_1x1', platform: 'Amazon', placement: 'Sponsored Display', width: 1080, height: 1080, orientation: 'Square', media_type: 'image_or_video', notes: 'Prime-first messaging; keep product + price clear.' },
  // Mobile (IAB New Ad Portfolio common units)
  { id: 'MOB_INLINE_RECT_300x250', platform: 'Mobile', placement: 'Inline Rectangle', width: 300, height: 250, orientation: 'Rectangle', media_type: 'image_or_html5', notes: 'Inline mobile rectangle; common in content feeds.' },
  { id: 'MOB_BANNER_320x50', platform: 'Mobile', placement: 'Standard Banner', width: 320, height: 50, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Standard mobile banner; ultra-limited height.' },
  { id: 'MOB_LARGE_BANNER_320x100', platform: 'Mobile', placement: 'Large Banner', width: 320, height: 100, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'More height for clearer CTA.' },
  { id: 'MOB_FULLPAGE_PORTRAIT_320x480', platform: 'Mobile', placement: 'Fullscreen Portrait', width: 320, height: 480, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Fullscreen interstitial; respect app safe areas.' },
  { id: 'MOB_FULLPAGE_LANDSCAPE_480x320', platform: 'Mobile', placement: 'Fullscreen Landscape', width: 480, height: 320, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Landscape interstitial; avoid edge-hugging CTAs.' },
  { id: 'MOB_TABLET_PORTRAIT_768x1024', platform: 'Mobile', placement: 'Tablet Portrait', width: 768, height: 1024, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Tablet portrait; maintain generous padding.' },
  { id: 'MOB_TABLET_LANDSCAPE_1024x768', platform: 'Mobile', placement: 'Tablet Landscape', width: 1024, height: 768, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Tablet landscape; keep focal area centered.' },
];

const DESTINATION_OPTIONS_BY_PLATFORM: Record<string, string[]> = {
  Meta: ['Meta Reels/Stories', 'Meta Feed', 'Meta In-Stream'],
  TikTok: ['TikTok In-Feed'],
  YouTube: ['YouTube Shorts', 'YouTube In-Stream', 'YouTube Bumper'],
  LinkedIn: ['LinkedIn Feed', 'LinkedIn Video'],
  X: ['X Feed', 'X Video'],
  'Open Web': ['Open Web Display', 'GDN'],
  CTV: ['CTV Fullscreen', 'CTV Overlay'],
  Mobile: ['In-App Banner', 'In-App Interstitial'],
  Amazon: ['Amazon Sponsored Display', 'Amazon Video'],
};

const PLATFORM_NATIVE_KEYWORDS: Record<string, string[]> = {
  Meta: ['meta', 'facebook', 'instagram'],
  TikTok: ['tiktok'],
  YouTube: ['youtube'],
  LinkedIn: ['linkedin'],
  X: ['x', 'twitter'],
  'Open Web': ['open web', 'gdn', 'dv360', 'display'],
  CTV: ['ctv', 'dv360', 'ott'],
  Mobile: ['mobile', 'in-app'],
  Amazon: ['amazon', 'prime'],
};

const isAudienceNativeToPlatform = (segmentSource: string | undefined, platform: string | undefined) => {
  if (!segmentSource || !platform) return true;
  const keywords = PLATFORM_NATIVE_KEYWORDS[platform] || [];
  const src = segmentSource.toLowerCase();
  return keywords.some((kw) => src.includes(kw));
};

const deriveProductionRowsFromMatrix = (rows: MatrixRow[]): ProductionMatrixLine[] => {
  return rows.map((r, idx) => {
    const dests: DestinationEntry[] = [];
    const platforms = (r.platform_environments || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    platforms.forEach((p) => {
      const options = DESTINATION_OPTIONS_BY_PLATFORM[p] || [p];
      if (options.length) {
        dests.push({ name: options[0] });
      }
    });
    return {
      id: `PR-${(idx + 1).toString().padStart(3, '0')}`,
      segment_source: r.segment_source || '',
      audience: r.segment_name || `Audience ${idx + 1}`,
      concept_id: '',
      spec_id: '',
      destinations: dests,
      notes: r.notes || '',
      is_feed: false,
      production_details: '',
    };
  });
};

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
    campaign_name: '',
    smp: '',
    audiences: [],
    kpis: [],
    flight_dates: {},
    status: 'Draft',
  });
  // Completion score: instant, local heuristic (useful feedback while typing).
  const [briefCompletionScore, setBriefCompletionScore] = useState<number | null>(null);
  const [briefCompletionGaps, setBriefCompletionGaps] = useState<string[]>([]);

  // Quality score: owned by the Quality Assistant (model-backed).
  const [briefQualityScore, setBriefQualityScore] = useState<number | null>(null);
  const [briefQualityGaps, setBriefQualityGaps] = useState<string[]>([]);
  const [briefQualityRationale, setBriefQualityRationale] = useState<string>('');
  const [briefQualityAgentLoading, setBriefQualityAgentLoading] = useState(false);
  const [briefQualityEval, setBriefQualityEval] = useState<{
    strengths?: string[];
    risks?: string[];
    recommendations?: string[];
    next_questions?: string[];
    suggested_edits?: { field: string; suggestion: string }[];
  } | null>(null);
  const [showQualityDetails, setShowQualityDetails] = useState(false);
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
  const [jobFeedMeta, setJobFeedMeta] = useState<{
    [jobId: string]: {
      feed_template?: string;
      template_id?: string;
      feed_id?: string;
      feed_asset_id?: string;
      production_details?: string;
    };
  }>({});
  const [jobCopyFields, setJobCopyFields] = useState<{
    [jobId: string]: {
      id: string;
      label: string;
      font: string;
      instructions: string;
      text: string;
    }[];
  }>({});
  const [jobBuildDetails, setJobBuildDetails] = useState<{ [jobId: string]: BuildDetails }>({});
  const [jobRequirementFields, setJobRequirementFields] = useState<{ [jobId: string]: RequirementField[] }>({});
  const [requirementsLibrary, setRequirementsLibrary] = useState<{
    [assetType: string]: RequirementField[];
  }>({
    copy: [
      { id: 'copy-headline', label: 'Headline', value: '' },
      { id: 'copy-body', label: 'Body', value: '' },
      { id: 'copy-cta', label: 'CTA', value: '' },
      { id: 'copy-tone', label: 'Tone/Voice', value: '' },
      { id: 'copy-length', label: 'Word count', value: '' },
    ],
    image: [
      { id: 'img-composition', label: 'Composition', value: '' },
      { id: 'img-subject', label: 'Subject', value: '' },
      { id: 'img-background', label: 'Background', value: '' },
      { id: 'img-text', label: 'Text overlay', value: '' },
      { id: 'img-brand', label: 'Brand elements', value: '' },
    ],
    h5: [
      { id: 'h5-frame1', label: 'Frame 1 (Hook)', value: '' },
      { id: 'h5-frame2', label: 'Frame 2 (Value)', value: '' },
      { id: 'h5-frame3', label: 'Frame 3 (CTA)', value: '' },
      { id: 'h5-interaction', label: 'Interaction/CTA', value: '' },
      { id: 'h5-animation', label: 'Animation notes', value: '' },
    ],
    video: [
      { id: 'vid-hook', label: 'Hook (0-3s)', value: '' },
      { id: 'vid-beats', label: 'Story beats', value: '' },
      { id: 'vid-duration', label: 'Duration', value: '' },
      { id: 'vid-captions', label: 'Captions', value: '' },
      { id: 'vid-cta', label: 'CTA/End card', value: '' },
    ],
    audio: [
      { id: 'aud-script', label: 'Script', value: '' },
      { id: 'aud-vo', label: 'VO tone', value: '' },
      { id: 'aud-sfx', label: 'SFX/Music', value: '' },
      { id: 'aud-cta', label: 'CTA/Tag', value: '' },
      { id: 'aud-length', label: 'Length', value: '' },
    ],
  });
  const [audienceImportOpen, setAudienceImportOpen] = useState(false);
  const [audienceImportColumns, setAudienceImportColumns] = useState<string[]>([]);
  const [audienceImportRows, setAudienceImportRows] = useState<any[]>([]);
  const [audienceImportMapping, setAudienceImportMapping] = useState<Record<string, string>>({});
  const audienceFileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [productionTab, setProductionTab] = useState<'requirements' | 'specLibrary' | 'requirementsLibrary'>('requirements');
  const [pendingDestAudience, setPendingDestAudience] = useState<{ [rowId: string]: string }>({});
  const [showPlan, setShowPlan] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [showBoard, setShowBoard] = useState(true);
  const [productionMatrixRows, setProductionMatrixRows] = useState<ProductionMatrixLine[]>(
    deriveProductionRowsFromMatrix(INITIAL_STRATEGY_MATRIX_RUNNING_SHOES),
  );
  const [feedFields, setFeedFields] = useState<FeedFieldConfig[]>(BASE_FEED_FIELDS);
  const [visibleFeedFields, setVisibleFeedFields] = useState<FeedFieldKey[]>(
    BASE_FEED_FIELDS.map((f) => f.key).filter((key) => key !== 'date_start' && key !== 'date_end'),
  );
  const [showFeedFieldConfig, setShowFeedFieldConfig] = useState(false);
  const [feedFieldLibrary, setFeedFieldLibrary] = useState<FeedFieldConfig[]>(BASE_FEED_FIELDS);
  const [showPartnerLibrary, setShowPartnerLibrary] = useState(false);
  const [feedFieldPartners, setFeedFieldPartners] =
    useState<Record<string, FeedFieldConfig[]>>(PARTNER_FIELD_LIBRARY);
  const [feedMappingPlatform, setFeedMappingPlatform] = useState<string>(DEFAULT_FEED_PLATFORM);
  const [feedFieldMappings, setFeedFieldMappings] = useState<
    { id: string; source: string; destination: string; platform: string }[]
  >([]);
  const destinationTemplates = useMemo(() => {
    const baseTemplates: Record<string, string[]> = {
      StoryTeq: ['variant_key', 'copy_slot_a', 'copy_slot_b', 'asset_url', 'cta_text'],
    };
    Object.entries(feedFieldPartners).forEach(([partner, fields]) => {
      baseTemplates[partner] = fields.map((f) => f.key);
    });
    return baseTemplates;
  }, [feedFieldPartners]);
  const [destinationFieldLibrary, setDestinationFieldLibrary] = useState<string[]>(() => {
    const defaults = PARTNER_FIELD_LIBRARY[DEFAULT_FEED_PLATFORM] || [];
    if (defaults.length) return defaults.map((f) => f.key);
    return ['title', 'body', 'cta', 'image_url', 'video_url', 'tracking_code'];
  });
  const [dragSourceField, setDragSourceField] = useState<string | null>(null);
  const [showFeedMapping, setShowFeedMapping] = useState(true);
  const [showFeedSourceFields, setShowFeedSourceFields] = useState(true);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [expandedMatrixRows, setExpandedMatrixRows] = useState<Record<number, boolean>>({});
  const feedEligible = useMemo(
    () => builderJobs.some((j) => j.is_feed) || productionMatrixRows.some((r) => r.is_feed),
    [builderJobs, productionMatrixRows],
  );

  // This would eventually be live-updated from the backend
  const [previewPlan, setPreviewPlan] = useState<any>({
    workflow_job_tool: '',
    job_code: '',
    campaign_name: '',
    single_minded_proposition: '',
    primary_audience: '',
    narrative_brief: '',
    content_matrix: [],
  }); 
  // Ensure all matrix rows have an 'id' field for proper tracking
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>(() => {
    return INITIAL_STRATEGY_MATRIX_RUNNING_SHOES.map((row, index) => {
      // If row doesn't have an id, generate one based on index
      if (!row.id) {
        return { ...row, id: `ROW-${(index + 1).toString().padStart(3, '0')}` };
      }
      return row;
    });
  });
  const productionMatrixAudienceOptions = useMemo(
    () => Array.from(new Set(matrixRows.map((r) => r.segment_name).filter(Boolean))),
    [matrixRows],
  );
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
    {
      id: 'CON-003',
      asset_id: 'CAR-001',
      title: 'Proof Stack Carousel',
      description:
        'Carousel that pairs three proof tiles (time saved, lift in KPIs, testimonial) with a consistent visual system.',
      notes: 'Each card should be self-contained; avoid heavy body copy. Keep proof numbers bold.',
      kind: 'image',
      status: 'idle',
    },
    {
      id: 'CON-004',
      asset_id: 'VID-002',
      title: 'Signal → Action Explainer',
      description:
        '15–20s video showing a signal entering the system and the adaptive content response across two channels.',
      notes: 'Use simple UI motion graphics; keep labels legible on mobile. CTA in final 3 seconds.',
      kind: 'video',
      status: 'idle',
    },
    {
      id: 'CON-005',
      asset_id: 'IMG-002',
      title: 'System Blueprint One-Pager',
      description:
        'Static “blueprint” layout that maps campaign inputs, decisioning, and outputs with a hero hook and CTA.',
      notes: 'Use a modular grid, minimal copy, and strong hierarchy; printable as PDF.',
      kind: 'image',
      status: 'idle',
    },
    {
      id: 'CON-006',
      asset_id: 'VID-003',
      title: 'Creator + Data Split-Screen',
      description:
        'Split-screen vertical showing creator footage on left and dynamic metrics/variants on right to dramatize adaptability.',
      notes: 'Balance motion between sides; add captions. Keep data labels short.',
      kind: 'video',
      status: 'idle',
    },
    {
      id: 'CON-007',
      asset_id: 'DOC-001',
      title: 'Offer Matrix Cheat Sheet',
      description:
        'Single-page cheat sheet that lists audience → offer → channel mappings with best-performing variants.',
      notes: 'Tabular layout with color-coded priority; include a quick “how to deploy” footer.',
      kind: 'copy',
      status: 'idle',
    },
  ]);
  const [moodBoardConceptIds, setMoodBoardConceptIds] = useState<string[]>([]);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [brandAssets, setBrandAssets] = useState<string[]>([]);
  const [brandVoiceGuide, setBrandVoiceGuide] = useState('');
  const [brandStyleGuide, setBrandStyleGuide] = useState('');
  const [conceptDetail, setConceptDetail] = useState<Concept | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conceptFileInputRef = useRef<HTMLInputElement | null>(null);
  const conceptMediaInputRef = useRef<HTMLInputElement | null>(null);
  const conceptVideoUploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const brandAssetFileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const createId = (prefix: string) => {
    const uuid =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : null;
    return uuid || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);
  useEffect(() => {
    if (workspaceView !== 'concepts' || rightTab !== 'board') {
      setConceptDetail(null);
    }
  }, [workspaceView, rightTab]);

  useEffect(() => {
    setJobRequirementFields((prev) => {
      let next: typeof prev | null = null;
      for (const job of builderJobs) {
        if (!prev[job.job_id] && !(next && next[job.job_id])) {
          if (!next) next = { ...prev };
          next[job.job_id] = getDefaultRequirementFields(job.asset_type);
        }
      }
      return next ?? prev;
    });
    setJobBuildDetails((prev) => {
      let next: typeof prev | null = null;
      for (const job of builderJobs) {
        if (!prev[job.job_id] && !(next && next[job.job_id])) {
          if (!next) next = { ...prev };
          next[job.job_id] = {};
        }
      }
      return next ?? prev;
    });
  }, [builderJobs]);

  const toggleMatrixRowExpanded = (index: number) => {
    setExpandedMatrixRows((prev) => ({ ...prev, [index]: !prev[index] }));
  };

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
        row_id: createId('ROW'),
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
    setFeedFieldLibrary((prev) => [...prev, newField]);
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

  const addLibraryFeedField = () => {
    const rawLabel = window.prompt('Add a feed library field (label):');
    if (!rawLabel) return;
    const trimmed = rawLabel.trim();
    if (!trimmed) return;
    let baseKey = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!baseKey) baseKey = 'custom';
    const existingKeys = new Set(feedFieldLibrary.map((f) => f.key));
    let uniqueKey = baseKey;
    let idx = 1;
    while (existingKeys.has(uniqueKey)) {
      uniqueKey = `${baseKey}_${idx}`;
      idx += 1;
    }
    const newField: FeedFieldConfig = { key: uniqueKey, label: trimmed, isCustom: true };
    setFeedFieldLibrary((prev) => [...prev, newField]);
  };

  const applyFeedLibrary = () => {
    setFeedFields(feedFieldLibrary);
    setVisibleFeedFields(feedFieldLibrary.map((f) => f.key));
  };

  const deleteFeedMappingRow = (id: string) => {
    setFeedFieldMappings((prev) => prev.filter((row) => row.id !== id));
  };

  const addDestinationField = () => {
    const raw = window.prompt('Add a destination/platform field name:');
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    setDestinationFieldLibrary((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed],
    );
  };

  const handleDropMapping = (destination: string) => {
    if (!dragSourceField) return;
    setFeedFieldMappings((prev) => {
      const platform = feedMappingPlatform || 'Meta';
      // Remove any existing mapping for this destination+platform
      const filtered = prev.filter(
        (m) => !(m.destination === destination && m.platform === platform),
      );
      return [
        ...filtered,
        {
          id: createId('MAP'),
          source: dragSourceField,
          destination,
          platform,
        },
      ];
    });
    setDragSourceField(null);
  };

  const updateJobFeedFlag = (jobId: string, value: boolean) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, is_feed: value } : job)));
    setJobFeedMeta((prev) => ({
      ...prev,
      [jobId]: {
        feed_template: prev[jobId]?.feed_template || '',
        template_id: prev[jobId]?.template_id || '',
        feed_id: prev[jobId]?.feed_id || '',
        feed_asset_id: prev[jobId]?.feed_asset_id || '',
        production_details: prev[jobId]?.production_details || '',
      },
    }));
  };

  const applyPartnerFields = (partner: string, target: 'feed' | 'mapping' | 'both' = 'both') => {
    const fields = feedFieldPartners[partner];
    if (!fields) return;
    if (target !== 'mapping') {
      setFeedFields(fields);
      setVisibleFeedFields(fields.map((f) => f.key));
      setFeedFieldLibrary(fields);
    }
    if (target !== 'feed') {
      setDestinationFieldLibrary(fields.map((f) => f.key));
      setFeedMappingPlatform(partner);
    }
    setShowPartnerLibrary(false);
  };

  const addPartnerTemplate = () => {
    const name = window.prompt('Partner name:');
    if (!name) return;
    const rawFields = window.prompt('Comma-separated field labels (e.g., Headline, Body, CTA):');
    if (!rawFields) return;
    const labels = rawFields
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!labels.length) return;
    const newFields: FeedFieldConfig[] = labels.map((label, idx) => {
      let key = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!key) key = `custom_${idx}`;
      return { key, label, isCustom: true };
    });
    setFeedFieldPartners((prev) => ({
      ...prev,
      [name]: newFields,
    }));
  };

  const applyDestinationTemplate = (template: string) => {
    const fields = destinationTemplates[template];
    if (!fields || !fields.length) return;
    setDestinationFieldLibrary(fields);
  };

  useEffect(() => {
    const partnerFields = feedFieldPartners[feedMappingPlatform];
    if (partnerFields && partnerFields.length) {
      setDestinationFieldLibrary(partnerFields.map((f) => f.key));
      setFeedFieldLibrary(partnerFields);
    }
  }, [feedMappingPlatform, feedFieldPartners]);

  useEffect(() => {
    if (!feedFieldPartners[feedMappingPlatform]) {
      const firstPartner = Object.keys(feedFieldPartners)[0];
      if (firstPartner) setFeedMappingPlatform(firstPartner);
    }
  }, [feedFieldPartners, feedMappingPlatform]);

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
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25000);

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
        // Build a dynamic brief payload that mirrors the visible brief fields (including custom ones)
        const briefPayload = briefFields.reduce((acc, field) => {
          const value = (previewPlan && (previewPlan as any)[field.key]) ?? (briefState as any)[field.key] ?? '';
          acc[field.key] = value;
          return acc;
        }, { ...briefState } as Record<string, any>);

        // Use the Next.js serverless proxy to keep the Gemini key server-side.
        const res = await fetch('/api/brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            current_state: briefPayload,
            chat_log: newHistory,
          }),
        });
        const rawText = await res.text();
        const data = (() => {
          try {
            return rawText ? JSON.parse(rawText) : ({} as any);
          } catch {
            return ({} as any);
          }
        })();
        if (!res.ok) {
          // FastAPI errors are typically { detail: "..." } while our Next proxy used { error: "..." }
          const serverError =
            typeof data?.detail === 'string'
              ? data.detail
              : typeof data?.error === 'string'
                ? data.error
                : rawText || JSON.stringify(data);
          throw new Error(serverError || `Brief request failed (${res.status})`);
        }
        setMessages([...newHistory, { role: 'assistant', content: data.reply || '' }]);
        // Quality is computed locally in real-time from the current brief fields.
      } else {
        const res = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            history: newHistory,
            current_plan: previewPlan,
          }),
        });
        const data = await res.json();
        setMessages([...newHistory, { role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      const errMsg = (error as any)?.message ? String((error as any).message) : String(error);
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            `I could not reach the briefing agent.\n\n` +
            `Details: ${errMsg}\n\n` +
            `Please confirm your API key is set (OPENAI_API_KEY or GOOGLE_API_KEY). If offline, toggle Demo Mode.`,
        },
      ]);
    }
    clearTimeout(timeoutId);
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
      // Workflow Job Tool and Job Code at the top
      if (planToSend.workflow_job_tool || planToSend.job_code) {
        if (planToSend.workflow_job_tool) {
          lines.push(`Workflow Job Tool: ${planToSend.workflow_job_tool}`);
        }
        if (planToSend.job_code) {
          lines.push(`Job Code: ${planToSend.job_code}`);
        }
        lines.push('');
      }
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
      const mime =
        (format as string) === 'json'
          ? 'application/json'
          : (format as string) === 'pdf'
          ? 'application/pdf'
          : 'text/plain';
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief.${format}`;
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
        audienceLineIds: [],
        selectedFields: [],
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

  async function generateAssetForConcept(conceptIndex: number) {
    const concept = concepts[conceptIndex];
    if (!concept || !concept.kind || concept.kind === 'copy') {
      return; // Only generate for image/video
    }

    // Update status to generating
    setConcepts((prev) =>
      prev.map((c, i) =>
        i === conceptIndex
          ? {
              ...c,
              status: 'generating',
            }
          : c,
      ),
    );

    try {
      // Build prompt from concept fields if not provided
      let prompt = concept.generatedPrompt;
      
      if (!prompt || prompt.trim() === '') {
        // Build comprehensive prompt from concept description
        const parts: string[] = [];
        if (concept.title) parts.push(`Concept: ${concept.title}`);
        if (concept.description) parts.push(concept.description);
        
        // Add selected audience fields to inform the prompt
        if (concept.selectedFields && concept.selectedFields.length > 0) {
          const fieldParts: string[] = [];
          concept.selectedFields.forEach((field) => {
            fieldParts.push(`${field.fieldLabel}: ${field.fieldValue}`);
          });
          if (fieldParts.length > 0) {
            parts.push(`Audience Context:\n${fieldParts.join('\n')}`);
          }
        }
        
        if (concept.notes) parts.push(`Production notes: ${concept.notes}`);
        
        // Add context from brief if available
        const plan: any = previewPlan || {};
        if (plan.campaign_name) parts.unshift(`Campaign: ${plan.campaign_name}`);
        if (plan.single_minded_proposition) parts.unshift(`SMP: ${plan.single_minded_proposition}`);
        if (plan.primary_audience) parts.unshift(`Audience: ${plan.primary_audience}`);
        
        prompt = parts.join('\n\n');
      } else {
        // Even if prompt is provided, include selected fields for context
        if (concept.selectedFields && concept.selectedFields.length > 0) {
          const fieldParts: string[] = [];
          concept.selectedFields.forEach((field) => {
            fieldParts.push(`${field.fieldLabel}: ${field.fieldValue}`);
          });
          if (fieldParts.length > 0) {
            prompt = `${prompt}\n\nAudience Context:\n${fieldParts.join('\n')}`;
          }
        }
      }
      
      // Enhance prompt for better image generation
      if (concept.kind === 'image' && !prompt.toLowerCase().includes('high quality') && !prompt.toLowerCase().includes('professional')) {
        prompt = `${prompt.trim()}, high quality, professional photography, detailed, sharp focus`;
      }

      const response = await fetch(`${API_BASE_URL}/generate-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: concept.kind,
          prompt: prompt.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'error') {
        const errorMsg = data.error || 'Generation failed';
        // For video generation, provide more helpful error message
        if (concept.kind === 'video' && (errorMsg.includes('Service account') || errorMsg.includes('GOOGLE_APPLICATION_CREDENTIALS'))) {
          throw new Error('Video generation requires service account authentication. Please configure GOOGLE_APPLICATION_CREDENTIALS in your backend environment. See backend logs for details.');
        } else if (concept.kind === 'video' && (errorMsg.includes('Veo') || errorMsg.includes('not available'))) {
          throw new Error('Veo video generation is not available. Veo requires special access from Google Cloud. Contact your administrator to enable Veo access.');
        } else {
          throw new Error(errorMsg);
        }
      }

      // Update concept with generated asset
      setConcepts((prev) =>
        prev.map((c, i) =>
          i === conceptIndex
            ? {
                ...c,
                status: data.status === 'completed' ? 'completed' : 'ready',
                generatedAssetUrl: data.asset_url || null,
                generationJobId: data.job_id || null,
              }
            : c,
        ),
      );

      // If video is queued, add to mood board automatically and start polling
      if (data.status === 'queued' && data.job_id && concept.kind === 'video') {
        setMoodBoardConceptIds((prev) => {
          if (!prev.includes(concept.id)) {
            return [...prev, concept.id];
          }
          return prev;
        });
        // Note: Video polling can be added later if needed
      } else if (data.status === 'completed' && data.asset_url) {
        // Auto-add completed images to mood board
        setMoodBoardConceptIds((prev) => {
          if (!prev.includes(concept.id)) {
            return [...prev, concept.id];
          }
          return prev;
        });
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Generation failed. Please try again.';
      setConcepts((prev) =>
        prev.map((c, i) =>
          i === conceptIndex
            ? {
                ...c,
                status: 'error',
                errorMessage: errorMessage, // Store error message for display
              }
            : c,
        ),
      );
      console.error('Error generating asset:', error);
      // Show error alert to user
      alert(`Failed to generate ${concept.kind}: ${errorMessage}`);
    }
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
    const buildDemoProductionPlan = () => {
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
    };

    // In demo mode or if upstream modules aren't wired yet, use deterministic demo data.
    if (demoMode || !matrixRows.length || !concepts.length) {
      buildDemoProductionPlan();
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
      if (!demoMode) {
        setProductionError(
          e?.message ?? 'Unable to generate production plan from backend; showing demo plan.',
        );
      }
      buildDemoProductionPlan();
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
        destinations: [],
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
    value: string | boolean | DestinationEntry[],
  ) => {
    setProductionMatrixRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const getDestinationOptionsForSpec = (specId: string): string[] => {
    const spec = specs.find((s) => s.id === specId);
    if (!spec) return [];
    return DESTINATION_OPTIONS_BY_PLATFORM[spec.platform] || [spec.platform];
  };

  const addDestinationToRow = (index: number, destination: string, specId?: string) => {
    if (!destination) return;
    setProductionMatrixRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const existing = (row.destinations || []).map((d) => d.name);
        if (existing.includes(destination)) return row;
        const next = [...(row.destinations || []), { name: destination, spec_id: specId }];
        return { ...row, destinations: next };
      }),
    );
  };

  const removeDestinationFromRow = (index: number, destination: string) => {
    setProductionMatrixRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = (row.destinations || []).filter((d) => d.name !== destination);
        return { ...row, destinations: next };
      }),
    );
  };

  const removeProductionMatrixRow = (index: number) => {
    setProductionMatrixRows((prev) => prev.filter((_, i) => i !== index));
  };

  const inferAssetType = (spec?: Spec | null, destinations: DestinationEntry[] = []): string => {
    const media = (spec?.media_type || '').toLowerCase();
    const placement = (spec?.placement || '').toLowerCase();
    const format = (spec as any)?.format_name ? String((spec as any).format_name).toLowerCase() : '';
    const destStrings = destinations.map((d) => `${d.name || ''} ${d.spec_id || ''}`.toLowerCase()).join(' ');

    const isAudio = media.includes('audio') || placement.includes('audio') || destStrings.includes('audio') || destStrings.includes('podcast');
    if (isAudio) return 'audio';

    const isH5 = media.includes('html') || media.includes('h5') || placement.includes('html') || placement.includes('h5') || format.includes('html');
    if (isH5) return 'h5';

    const isVideo =
      media.includes('video') || placement.includes('video') || format.includes('video') || placement.includes('reel') || placement.includes('story');
    if (isVideo) return 'video';

    const isCopy = media.includes('copy') || media.includes('text') || format.includes('copy') || placement.includes('copy');
    if (isCopy) return 'copy';

    return 'image';
  };

  const getDefaultRequirementFields = (assetType: string): RequirementField[] => {
    const type = (assetType || '').toLowerCase();
    const fromLibrary = requirementsLibrary[type];
    if (fromLibrary && fromLibrary.length) return fromLibrary;
    return [
      { id: 'composition', label: 'Composition', value: '' },
      { id: 'subject', label: 'Subject', value: '' },
      { id: 'background', label: 'Background', value: '' },
    ];
  };

  const updateJobFeedMeta = (
    jobId: string,
    field: 'feed_template' | 'template_id' | 'feed_id' | 'feed_asset_id' | 'production_details',
    value: string,
  ) => {
    setJobFeedMeta((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        [field]: value,
      },
    }));
  };

  const updateJobStatus = (
    jobId: string,
    status: 'Pending' | 'In_Progress' | 'Review' | 'Approved' | string,
  ) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, status } : job)));
  };

  const addJobCopyField = (jobId: string) => {
    const id =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID && crypto.randomUUID()) ||
      `COPY-${Date.now()}`;
    setJobCopyFields((prev) => ({
      ...prev,
      [jobId]: [
        ...(prev[jobId] || []),
        {
          id,
          label: 'Copy block',
          font: '',
          instructions: '',
          text: '',
        },
      ],
    }));
  };

  const updateJobCopyField = (
    jobId: string,
    copyId: string,
    field: 'label' | 'font' | 'instructions' | 'text',
    value: string,
  ) => {
    setJobCopyFields((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] || []).map((c) => (c.id === copyId ? { ...c, [field]: value } : c)),
    }));
  };

  const removeJobCopyField = (jobId: string, copyId: string) => {
    setJobCopyFields((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] || []).filter((c) => c.id !== copyId),
    }));
  };

  const updateBuildDetail = (jobId: string, field: keyof BuildDetails, value: string) => {
    setJobBuildDetails((prev) => ({
      ...prev,
      [jobId]: {
        ...(prev[jobId] || {}),
        [field]: value,
      },
    }));
  };

  const addRequirementField = (jobId: string) => {
    const id =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID && crypto.randomUUID()) ||
      `REQ-${Date.now()}`;
    setJobRequirementFields((prev) => ({
      ...prev,
      [jobId]: [...(prev[jobId] || []), { id, label: 'Custom field', value: '' }],
    }));
  };

  const updateRequirementFieldValue = (jobId: string, fieldId: string, key: 'label' | 'value', value: string) => {
    setJobRequirementFields((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] || []).map((f) => (f.id === fieldId ? { ...f, [key]: value } : f)),
    }));
  };

  const addLibraryField = (assetType: string) => {
    const label = window.prompt(`Add a ${assetType} requirement field (label)`);
    if (!label) return;
    const id =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID && crypto.randomUUID()) ||
      `LIB-${Date.now()}`;
    setRequirementsLibrary((prev) => ({
      ...prev,
      [assetType]: [...(prev[assetType] || []), { id, label: label.trim(), value: '' }],
    }));
  };

  const applyLibraryToJob = (jobId: string, assetType: string) => {
    const libFields = requirementsLibrary[assetType] || [];
    if (!libFields.length) return;
    setJobRequirementFields((prev) => {
      const existing = prev[jobId] || [];
      const existingLabels = new Set(existing.map((f) => f.label.toLowerCase()));
      const merged = [
        ...existing,
        ...libFields
          .filter((f) => !existingLabels.has(f.label.toLowerCase()))
          .map((f) => ({ ...f, value: '' })),
      ];
      return { ...prev, [jobId]: merged };
    });
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
      const nonNative: string[] = [];
      productionMatrixRows.forEach((row, idx) => {
        const spec = specs.find((s) => s.id === row.spec_id);
        const platform = spec?.platform;
        if (!isAudienceNativeToPlatform(row.segment_source, platform)) {
          nonNative.push(`${row.audience || `Row ${idx + 1}`} → ${platform || 'Unknown platform'}`);
        }
      });
      if (nonNative.length) {
        const proceed = window.confirm(
          `Audience is not native to platform for:\n- ${nonNative.join(
            '\n- ',
          )}\nContinue anyway? (Choosing OK assumes you are importing this audience into that platform)`,
        );
        if (!proceed) return;
      }
      const jobs: ProductionJobRow[] = [];
      const nextJobFeedMeta: {
        [jobId: string]: {
          feed_template?: string;
          template_id?: string;
          feed_id?: string;
          feed_asset_id?: string;
          production_details?: string;
        };
      } = {};
      productionMatrixRows.forEach((row, idx) => {
        const rowConcept = concepts.find((c) => c.id === row.concept_id);
        const conceptLabel =
          rowConcept?.title ||
          rowConcept?.description ||
          rowConcept?.id ||
          'Untitled Concept';

        // Meta suffixes for build instructions
        const metaSuffixParts = [];
        if (row.template_id) metaSuffixParts.push(`template:${row.template_id}`);
        if (row.feed_id) metaSuffixParts.push(`feed:${row.feed_id}`);
        if (row.feed_asset_id) metaSuffixParts.push(`asset:${row.feed_asset_id}`);
        if (row.production_details && !row.is_feed)
          metaSuffixParts.push(`build:${row.production_details}`);
        const metaSuffix = metaSuffixParts.length
          ? ` [${metaSuffixParts.join(' | ')}]`
          : '';

        // Group destinations by Spec ID
        // If a destination has no specific spec_id, fall back to the row's main spec_id
        const destsBySpec: Record<string, DestinationEntry[]> = {};
        const unmappedDests: DestinationEntry[] = [];

        (row.destinations || []).forEach((dest) => {
          let sId = dest.spec_id || row.spec_id;
          
          // Try to infer spec from name if missing
          if (!sId && dest.name) {
             const match = specs.find(s => `${s.platform} · ${s.placement}` === dest.name);
             if (match) sId = match.id;
          }

          if (sId) {
            if (!destsBySpec[sId]) destsBySpec[sId] = [];
            destsBySpec[sId].push(dest);
          } else {
            unmappedDests.push(dest);
          }
        });

        // If no destinations but we have a row spec, create a placeholder job
        if ((!row.destinations || row.destinations.length === 0) && row.spec_id) {
          destsBySpec[row.spec_id] = [];
        }

        // Handle unmapped destinations (assign to row spec or 'Unknown')
        if (unmappedDests.length > 0) {
          const fallback = row.spec_id || 'UNKNOWN_SPEC';
          if (!destsBySpec[fallback]) destsBySpec[fallback] = [];
          destsBySpec[fallback].push(...unmappedDests);
        }

        // Generate a job for each Spec bucket
        Object.entries(destsBySpec).forEach(([sId, dests], i) => {
          const spec = specs.find((s) => s.id === sId);
          const specLabel = spec
            ? `${spec.width}x${spec.height} ${spec.media_type}`
            : 'Spec not set';

          const jobDestinations = dests.map((dest) => ({
            platform_name: dest.name,
            spec_id: sId,
            format_name: spec?.placement || spec?.media_type || '',
            special_notes: dest.audience ? `Audience: ${dest.audience}` : row.notes,
          }));
          const hasDestinations = jobDestinations.length > 0;

          // Create unique Job ID for this slice
          // If we exploded into multiple jobs, append suffix
          const baseId = row.id || `JOB-${idx + 1}`;
          const jobId = Object.keys(destsBySpec).length > 1 ? `${baseId}-${i + 1}` : baseId;

          nextJobFeedMeta[jobId] = {
            feed_template: row.feed_template || '',
            template_id: row.template_id || '',
            feed_id: row.feed_id || '',
            feed_asset_id: row.feed_asset_id || '',
            production_details: row.production_details || '',
          };

          const inferredAssetType = hasDestinations ? inferAssetType(spec, dests) : 'asset';
          const destinationNotice = hasDestinations ? '' : ' | No destination selected';

          jobs.push({
            job_id: jobId,
            creative_concept: conceptLabel,
            asset_type: inferredAssetType,
            destinations: jobDestinations,
            technical_summary: `${specLabel}${metaSuffix}${destinationNotice}`,
            status: 'Pending',
            is_feed: row.is_feed,
            feed_template: row.feed_template,
            template_id: row.template_id,
            feed_id: row.feed_id,
            feed_asset_id: row.feed_asset_id,
            production_details: row.production_details,
            missing_destinations: !hasDestinations,
          });
        });
      });
      setBuilderJobs(jobs);
      setJobFeedMeta(nextJobFeedMeta);
      setBuilderError(null);
      setProductionTab('requirements');
      setShowJobs(true);
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
      setJobFeedMeta({});
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
    setBriefState((prev) => ({
      ...prev,
      [key]: '',
    }));
  }

  function deleteCustomBriefField(key: BriefFieldKey) {
    const confirmDelete = window.confirm('Remove this brief field?');
    if (!confirmDelete) return;

    setBriefFields((prev) => prev.filter((f) => f.key !== key));
    setPreviewPlan((prev: any) => {
      if (!prev) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
    setBriefState((prev) => {
      const next = { ...prev };
      delete (next as any)[key];
      return next;
    });
  }

  function loadHistoricalBrief(brief: HistoricalBrief) {
    setPreviewPlan((prev: any) => ({
      ...prev,
      campaign_name: brief.campaign_name,
      single_minded_proposition: brief.single_minded_proposition,
      primary_audience: brief.primary_audience,
      narrative_brief: brief.narrative_brief,
    }));
    setBriefState({
      campaign_name: brief.campaign_name,
      smp: brief.single_minded_proposition,
      audiences: [brief.primary_audience],
      kpis: [],
      flight_dates: {},
      status: 'Draft',
    });
    setBriefState((prev) => ({
      ...prev,
      campaign_name: brief.campaign_name,
      smp: brief.single_minded_proposition,
      audiences: [brief.primary_audience],
      kpis: [],
      flight_dates: {},
      status: 'Draft',
    }));
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: `Load the historical brief for ${brief.campaign_name} so we can reuse its structure.`,
      },
      {
        role: 'assistant',
        content:
          'Loaded the historical brief into the form. You can edit fields or export immediately; matrix and concepts will pick this up.',
      },
    ]);
    setShowLibrary(false);
  }

  function computeBriefQualityAndGaps(brief: Record<string, any>): { score: number; gaps: string[] } {
    const clean = (v: any) => (typeof v === 'string' ? v.trim() : '');
    const list = (v: any) => {
      if (Array.isArray(v)) {
        return v.map((x) => String(x ?? '').trim()).filter(Boolean);
      }
      if (typeof v === 'string') {
        return v
          .split(/[\n,]/g)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    };

    const name = clean(brief.campaign_name);
    const smp = clean(brief.smp || brief.single_minded_proposition);
    const audiences = list(brief.audiences);
    const primaryAudience = clean(brief.primary_audience);
    const kpis = list(brief.kpis);
    const narrative = clean(brief.narrative_brief);
    const flight = brief.flight_dates && typeof brief.flight_dates === "object" ? brief.flight_dates : {};
    const flightStart = clean((flight as any).start);
    const flightEnd = clean((flight as any).end);

    let score = 0.0;
    const gaps: string[] = [];

    if (name) score += 2.0;
    else gaps.push('Campaign Name');

    if (smp && smp.length >= 8) score += 3.0;
    else gaps.push('Single Minded Proposition');

    if (audiences.length > 0 || primaryAudience) score += 2.0;
    else gaps.push('Audiences');

    if (kpis.length > 0) score += 2.0;
    else gaps.push('KPIs');

    if (flightStart && flightEnd) score += 1.0;
    if (narrative && narrative.length >= 40) score += 0.5;

    score = Math.min(10.0, score);
    return { score, gaps: gaps.slice(0, 3) };
  }

  function updateBriefFieldValue(key: BriefFieldKey, value: string) {
    setPreviewPlan((prev: any) => ({
      ...prev,
      [key]: value,
    }));
    setBriefState((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  // Keep Quality score/gaps reactive as the brief fields change (instant feedback as you type).
  useEffect(() => {
    const merged = { ...(briefState as any), ...(previewPlan as any) };
    const { score, gaps } = computeBriefQualityAndGaps(merged);

    setBriefCompletionScore((prev) => (prev === score ? prev : score));
    setBriefCompletionGaps((prev) => (prev.join('|') === gaps.join('|') ? prev : gaps));
  }, [briefState, previewPlan]);

  // ECD-quality scoring agent (debounced) — runs only when not in demo mode.
  useEffect(() => {
    if (demoMode) return;
    if (workspaceView !== 'brief') return;

    const merged = { ...(briefState as any), ...(previewPlan as any) };
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setBriefQualityAgentLoading(true);
        const res = await fetch('/brief/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ current_state: merged }),
        });
        const rawText = await res.text();
        const data = rawText ? JSON.parse(rawText) : {};
        if (!res.ok) {
          const err = typeof data?.detail === 'string' ? data.detail : rawText;
          throw new Error(err || `Score request failed (${res.status})`);
        }
        if (typeof data?.quality_score === 'number') setBriefQualityScore(data.quality_score);
        if (Array.isArray(data?.gaps)) setBriefQualityGaps(data.gaps as string[]);
        if (typeof data?.rationale === 'string') setBriefQualityRationale(data.rationale);
        setBriefQualityEval({
          strengths: Array.isArray(data?.strengths) ? (data.strengths as string[]) : undefined,
          risks: Array.isArray(data?.risks) ? (data.risks as string[]) : undefined,
          recommendations: Array.isArray(data?.recommendations) ? (data.recommendations as string[]) : undefined,
          next_questions: Array.isArray(data?.next_questions) ? (data.next_questions as string[]) : undefined,
          suggested_edits: Array.isArray(data?.suggested_edits)
            ? (data.suggested_edits as { field: string; suggestion: string }[])
            : undefined,
        });
      } catch (e: any) {
        // Don't spam the UI; keep last known values and surface a small hint.
        const msg = e?.message ? String(e.message) : String(e);
        setBriefQualityRationale(msg ? `Scoring agent unavailable: ${msg}` : '');
        setBriefQualityEval(null);
      } finally {
        setBriefQualityAgentLoading(false);
      }
    }, 900);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [demoMode, workspaceView, briefState, previewPlan]);

  function runDemoBriefSimulation() {
    if (!demoMode) return;
    setLoading(true);

    const extraFields: BriefFieldConfig[] = [
      { key: 'audience_subsegments', label: 'Audience Sub-segments', multiline: true, isCustom: true },
      { key: 'mandatories', label: 'Mandatories', multiline: true, isCustom: true },
      { key: 'tone_voice', label: 'Tone / Voice', multiline: true, isCustom: true },
      { key: 'offers', label: 'Offers & CTAs', multiline: true, isCustom: true },
      { key: 'proof_points', label: 'Proof Points', multiline: true, isCustom: true },
    ];

    // Merge in extra brief fields for the demo without duplicating existing keys
    setBriefFields((prev) => {
      const existingKeys = new Set(prev.map((f) => f.key));
      const merged = [...prev];
      extraFields.forEach((f) => {
        if (!existingKeys.has(f.key)) {
          merged.push(f);
        }
      });
      return merged;
    });

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: 'Can you draft a running shoe performance brief that ladders into modular content?',
      },
      {
        role: 'assistant',
        content:
          'Absolutely. I will draft the brief, add missing fields, and populate the form on the right so you can move straight into the matrix and production.',
      },
      {
        role: 'assistant',
        content:
          'Filling in campaign name, SMP, audience, tone, offers, and proof points now. I will also tag mandatories and sub-segments for targeting.',
      },
    ]);

    setPreviewPlan((prev: any) => ({
      ...prev,
      campaign_name: RUNNING_SHOE_DEMO_BRIEF.campaignName,
      single_minded_proposition: RUNNING_SHOE_DEMO_BRIEF.smp,
      primary_audience: RUNNING_SHOE_DEMO_BRIEF.primaryAudience,
      narrative_brief: RUNNING_SHOE_DEMO_BRIEF.narrative,
      audience_subsegments: '- Run Club Loyalists (30+ mi/week)\n- Trail Explorers (technical terrain)\n- New-to-running 5k starters',
      mandatories: '- Show outsole/stability close-ups\n- Include captions for sound-off\n- Avoid medical claims; highlight fit guarantee',
      tone_voice: 'Confident, proof-first, no hype; coach-like clarity with short verbs.',
      offers: 'Race-day bundle offer; Fit Quiz CTA for new runners; Loyalty perk for repeat buyers.',
      proof_points: 'Recent PR improvements (+12s/mi avg), athlete quotes, lab-tested cushioning data.',
    }));

    setBriefState((prev) => ({
      ...prev,
      campaign_name: RUNNING_SHOE_DEMO_BRIEF.campaignName,
      smp: RUNNING_SHOE_DEMO_BRIEF.smp,
      audiences: RUNNING_SHOE_DEMO_BRIEF.audiences,
      kpis: RUNNING_SHOE_DEMO_BRIEF.kpis,
      flight_dates: RUNNING_SHOE_DEMO_BRIEF.flight,
      status: 'Draft',
      audience_subsegments: '- Run Club Loyalists (30+ mi/week)\n- Trail Explorers (technical terrain)\n- New-to-running 5k starters',
      mandatories: '- Show outsole/stability close-ups\n- Include captions for sound-off\n- Avoid medical claims; highlight fit guarantee',
      tone_voice: 'Confident, proof-first, no hype; coach-like clarity with short verbs.',
      offers: 'Race-day bundle offer; Fit Quiz CTA for new runners; Loyalty perk for repeat buyers.',
      proof_points: 'Recent PR improvements (+12s/mi avg), athlete quotes, lab-tested cushioning data.',
    }));

    // Simulate quick back-and-forth to feel like co-editing the brief
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: 'Can we make sure tone is proof-first and not hypey?',
        },
        {
          role: 'assistant',
          content: 'Updated tone to proof-first, coach-like, short verbs. Added mandatories and offers to the form.',
        },
      ]);
    }, 350);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: 'Add a loyalty perk and a fit guarantee note to mandatories.',
        },
        {
          role: 'assistant',
          content: 'Done. Loyalty perk + fit guarantee captured under Mandatories and Offers. Proof points pinned.',
        },
        {
          role: 'assistant',
          content:
            'The brief fields are filled with SMP, audiences, tone, mandatories, offers, and proof points. Ready to sync into the matrix and production.',
        },
        {
          role: 'assistant',
          content: 'You can export the brief as TXT, PDF, or JSON using the buttons in the brief panel.',
        },
      ]);
      setLoading(false);
    }, 850);
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

  function openBrandAssetPicker() {
    brandAssetFileInputRef.current?.click();
  }

  function handleBrandAssetChange(e: any) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const names = files.map((f: File) => f.name);
    setBrandAssets((prev) => [...prev, ...names]);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Uploading brand assets: ${names.join(', ')}` },
      {
        role: 'assistant',
        content: 'Brand assets loaded. I will use these as visual references when drafting concepts and prompts.',
      },
    ]);
    e.target.value = '';
  }

  function openConceptFilePicker() {
    conceptFileInputRef.current?.click();
  }

  function openConceptMediaPicker() {
    conceptMediaInputRef.current?.click();
  }

  function handleConceptMediaChange(e: any) {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;
    const newConcepts: Concept[] = files.map((file, idx) => {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video')
        ? 'video'
        : file.type === 'application/pdf'
        ? 'copy'
        : 'image';
      return {
        id: `CON-MEDIA-${Date.now()}-${idx + 1}`,
        asset_id: '',
        title: file.name,
        description: `Uploaded from local file (${file.type || 'unknown type'}).`,
        notes: 'Use this uploaded asset as a reference in prompts and production mapping.',
        kind: type as any,
        status: 'idle',
        file_url: url,
        file_name: file.name,
        file_type: file.type,
      };
    });
    setConcepts((prev) => [...prev, ...newConcepts]);
    setMoodBoardConceptIds((prev) => [...prev, ...newConcepts.map((c) => c.id)]);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Uploaded ${files.length} media file(s) to the concept board.` },
      {
        role: 'assistant',
        content: 'Media added to concept board. They will guide prompts and be available for production mapping.',
      },
    ]);
    e.target.value = '';
  }

  function handleConceptFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = evt.target?.result as string;
        if (!raw) throw new Error('Unable to read file.');
        let parsed: any = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          parsed = [parsed];
        }
        const newConcepts: Concept[] = [];
        parsed.forEach((item: any, idx: number) => {
          if (!item) return;
          const id = `CON-UPLOAD-${Date.now()}-${idx + 1}`;
          newConcepts.push({
            id,
            asset_id: item.asset_id || '',
            title: item.title || item.name || `Uploaded Concept ${idx + 1}`,
            description: item.description || item.summary || '',
            notes: item.notes || '',
            kind: item.kind || undefined,
            status: 'idle',
            generatedPrompt: item.prompt || '',
          });
        });
        if (!newConcepts.length) {
          alert('No concepts found in the file. Please upload a JSON array of concepts.');
          return;
        }
        setConcepts((prev) => [...prev, ...newConcepts]);
        setMoodBoardConceptIds((prev) => [...prev, ...newConcepts.map((c) => c.id)]);
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: `Uploaded ${newConcepts.length} concepts from file "${file.name}".` },
          { role: 'assistant', content: 'Added uploaded concepts to the board. You can map them to specs and production next.' },
        ]);
      } catch (err) {
        console.error('Error parsing concept file', err);
        alert('Could not read file. Please upload a JSON file with an array of concept objects.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function simulateDamImport() {
    const damConcept: Concept = {
      id: `CON-DAM-${Date.now()}`,
      asset_id: 'DAM-ASSET-001',
      title: 'Imported from DAM – Hero Visual',
      description: 'Hero visual pulled from DAM with layered assets and brand-safe styling.',
      notes: 'Check license and region locks before export.',
      kind: 'image',
      status: 'idle',
    };
    setConcepts((prev) => [...prev, damConcept]);
    setMoodBoardConceptIds((prev) => [...prev, damConcept.id]);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: 'Pull a hero visual from DAM to use as a concept.' },
      { role: 'assistant', content: 'Fetched a hero visual from DAM and pinned it to the concept board. Map it to specs in production.' },
    ]);
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

  const normalizeHeader = (h: string) =>
    h
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  function buildDefaultAudienceMapping(headers: string[]) {
    const mapping: Record<string, string> = {};
    const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
    const guesses: Record<string, string[]> = {
      segment_name: ['audience', 'segment', 'cohort', 'audience_segment'],
      segment_id: ['segment_id', 'id'],
      segment_size: ['size', 'segment_size', 'audience_size'],
      priority_level: ['priority', 'tier'],
      segment_description: ['description', 'segment_description'],
      key_insight: ['insight', 'key_insight'],
      current_perception: ['current', 'current_perception'],
      desired_perception: ['desired', 'desired_perception'],
      primary_message_pillar: ['pillar', 'message', 'primary_message_pillar'],
      call_to_action_objective: ['cta', 'call_to_action', 'objective'],
      tone_guardrails: ['tone', 'guardrails'],
      platform_environments: ['platform', 'platforms', 'placements', 'channels', 'platform_environments'],
      contextual_triggers: ['triggers', 'signals', 'context', 'contextual_triggers'],
      notes: ['notes', 'comments'],
    };
    AUDIENCE_IMPORT_FIELDS.forEach((field) => {
      const guessList = guesses[field.key] || [field.key];
      const found = normalized.find((h) => guessList.includes(h.norm));
      if (found) mapping[field.key] = found.raw;
    });
    return mapping;
  }

  function openAudienceFilePicker() {
    audienceFileInputRef.current?.click();
  }

  function handleAudienceFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Unable to read file.');
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const rowsArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[];
        const headers = (rowsArray[0] as string[])?.map((h) => (typeof h === 'string' ? h : String(h))) || [];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        setAudienceImportColumns(headers);
        setAudienceImportRows(jsonRows as any[]);
        setAudienceImportMapping(buildDefaultAudienceMapping(headers));
        setAudienceImportOpen(true);
      } catch (err) {
        console.error('Error parsing audience file', err);
        alert('Could not read file. Please upload a CSV or Excel with a header row.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function applyAudienceImport() {
    if (!audienceImportRows.length) {
      setAudienceImportOpen(false);
      return;
    }
    const mappedRows: MatrixRow[] = [];
    audienceImportRows.forEach((row: any) => {
      const next: MatrixRow = {};
      AUDIENCE_IMPORT_FIELDS.forEach((field) => {
        const source = audienceImportMapping[field.key];
        if (source && row[source] !== undefined && row[source] !== null) {
          next[field.key] = String(row[source]);
        }
      });
      if (Object.keys(next).length) {
        mappedRows.push(next);
      }
    });
    if (!mappedRows.length) {
      alert('No rows were mapped. Please adjust the field mapping.');
      return;
    }
    setMatrixRows((prev) => [...prev, ...mappedRows]);
    setProductionMatrixRows((prev) => [
      ...prev,
      ...deriveProductionRowsFromMatrix(mappedRows).map((line, idx) => {
        const nextId = `PR-${(prev.length + idx + 1).toString().padStart(3, '0')}`;
        return { ...line, id: nextId };
      }),
    ]);
    setAudienceImportOpen(false);
    setAudienceImportRows([]);
    setAudienceImportColumns([]);
    setAudienceImportMapping({});
  }

  // Keep production matrix audience/segment data aligned with the latest strategy rows
  useEffect(() => {
    setProductionMatrixRows((prev) => {
      const derived = deriveProductionRowsFromMatrix(matrixRows);
      let changed = derived.length !== prev.length;

      const next = derived.map((derivedRow, idx) => {
        const existing = prev[idx];
        const id = existing?.id || derivedRow.id || `PR-${(idx + 1).toString().padStart(3, '0')}`;

        if (existing) {
          const updated: ProductionMatrixLine = {
            ...existing,
            id,
            segment_source: derivedRow.segment_source ?? existing.segment_source,
            audience: derivedRow.audience ?? existing.audience,
            notes: existing.notes || derivedRow.notes,
          };

          if (!existing.spec_id && (!existing.destinations || existing.destinations.length === 0)) {
            updated.destinations = derivedRow.destinations;
          }

          if (
            updated.segment_source !== existing.segment_source ||
            updated.audience !== existing.audience ||
            updated.notes !== existing.notes ||
            updated.destinations !== existing.destinations
          ) {
            changed = true;
          }

          return updated;
        }

        changed = true;
        return {
          ...derivedRow,
          id,
          concept_id: '',
          spec_id: '',
          destinations: derivedRow.destinations || [],
          notes: derivedRow.notes || '',
          is_feed: false,
          production_details: '',
        };
      });

      if (prev.length > derived.length) {
        next.push(...prev.slice(derived.length));
      }

      return changed ? next : prev;
    });
  }, [matrixRows]);

  // Demo-only: seed production matrix rows with concepts, specs, and destinations for richer simulations
  useEffect(() => {
    if (!demoMode || !concepts.length || !specs.length) return;
    const specMap = Object.fromEntries(specs.map((s) => [s.id, s]));
    const patchRow = (
      row: ProductionMatrixLine,
      data: Partial<ProductionMatrixLine>,
      destinations?: DestinationEntry[],
    ) => ({
      ...row,
      ...data,
      destinations: destinations ?? row.destinations,
    });

    setProductionMatrixRows((prev) =>
      prev.map((row) => {
        switch (row.id) {
          case 'PR-004':
            return patchRow(
              row,
              {
                concept_id: 'CON-003',
                spec_id: specMap['AMAZON_DISPLAY_1x1'] ? 'AMAZON_DISPLAY_1x1' : row.spec_id,
                notes: 'Lead with “Prime fast” + comfort; show price/value.',
                production_details: 'File type, safe zones, animation asks.',
              },
              [
                { name: 'Amazon Sponsored Display' },
                { name: 'Open Web Display' },
              ],
            );
          case 'PR-005':
            return patchRow(
              row,
              {
                concept_id: 'CON-004',
                spec_id: specMap['META_REELS_9x16'] ? 'META_REELS_9x16' : row.spec_id,
                notes: 'Use dynamic product feed; highlight free returns.',
                production_details: 'File type, safe zones, animation asks.',
              },
              [{ name: 'Meta Reels/Stories' }],
            );
          case 'PR-006':
            return patchRow(
              row,
              {
                concept_id: 'CON-006',
                spec_id: specMap['YOUTUBE_SHORTS_9x16'] ? 'YOUTUBE_SHORTS_9x16' : row.spec_id,
                notes: 'Lean on pro/coach voiceover; show split times.',
                production_details: 'File type, safe zones, animation asks.',
              },
              [
                { name: 'DV360' },
                { name: 'YouTube Shorts' },
                { name: 'CTV Fullscreen' },
              ],
            );
          case 'PR-007':
            return patchRow(
              row,
              {
                concept_id: 'CON-002',
                spec_id: specMap['META_REELS_9x16'] ? 'META_REELS_9x16' : row.spec_id,
                notes: 'Price + performance bundles; show loyalty perks.',
                production_details: 'File type, safe zones, animation asks.',
              },
              [
                { name: 'Meta Reels/Stories' },
                { name: 'TikTok In-Feed' },
                { name: 'YouTube Shorts' },
              ],
            );
          case 'PR-008':
            return patchRow(
              row,
              {
                concept_id: 'CON-005',
                spec_id: specMap['CTV_FULLSCREEN_16x9'] ? 'CTV_FULLSCREEN_16x9' : row.spec_id,
                notes: 'Bundle offers; family/household creative frames.',
                production_details: 'File type, safe zones, animation asks.',
              },
              [
                { name: 'CTV Fullscreen' },
                { name: 'Open Web Display' },
                { name: 'Meta Reels/Stories' },
              ],
            );
          case 'PR-009':
            return patchRow(
              row,
              {
                concept_id: 'CON-007',
                spec_id: specMap['LINKEDIN_IMAGE_1x1'] ? 'LINKEDIN_IMAGE_1x1' : row.spec_id,
                notes: 'Emphasize perk value and participation; softer CTA.',
                production_details: 'File type, safe zones, animation asks.',
              },
              [
                { name: 'LinkedIn Feed' },
                { name: 'Open Web Display' },
              ],
            );
          case 'PR-010':
            return patchRow(
              row,
              {
                concept_id: 'CON-001',
                spec_id: specMap['TIKTOK_IN_FEED_9x16'] ? 'TIKTOK_IN_FEED_9x16' : row.spec_id,
                notes: 'Use creator-led hooks; unboxings and on-foot tests.',
                production_details: 'File type, safe zones, animation asks.',
              },
              [
                { name: 'TikTok In-Feed' },
                { name: 'Meta Reels/Stories' },
              ],
            );
          default:
            return row;
        }
      }),
    );
  }, [demoMode, concepts, specs]);

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
    <>
    <main
      ref={containerRef}
      className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-800"
    >
      {/* Global header - shows across all workspace views */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-50 relative">
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
              type="button"
              onClick={() => switchWorkspace('brief')}
              className={`text-[11px] px-2 py-1 rounded-full cursor-pointer transition-colors ${
                workspaceView === 'brief'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Brief
            </button>
            <button
              type="button"
              onClick={() => switchWorkspace('matrix')}
              className={`text-[11px] px-2 py-1 rounded-full cursor-pointer transition-colors ${
                workspaceView === 'matrix'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Audiences
            </button>
            <button
              type="button"
              onClick={() => switchWorkspace('concepts')}
              className={`text-[11px] px-2 py-1 rounded-full cursor-pointer transition-colors ${
                workspaceView === 'concepts'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Concepts
            </button>
            <button
              type="button"
              onClick={() => switchWorkspace('production')}
              className={`text-[11px] px-2 py-1 rounded-full cursor-pointer transition-colors ${
                workspaceView === 'production'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Production
            </button>
            <button
              type="button"
              onClick={() => switchWorkspace('feed')}
              className={`text-[11px] px-2 py-1 rounded-full cursor-pointer transition-colors ${
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
              } whitespace-pre-wrap break-words`}>
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
                      {demoMode ? (
                        <button
                          onClick={() => loadHistoricalBrief(brief)}
                          className="text-[11px] px-3 py-1.5 rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100"
                        >
                          Load into brief
                        </button>
                      ) : (
                        <button
                          disabled
                          className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-400 cursor-not-allowed"
                        >
                          Load (demo only)
                        </button>
                      )}
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
            <div className="flex items-center gap-2">
              {demoMode && (
                <button
                  type="button"
                  onClick={runDemoBriefSimulation}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100"
                >
                  Simulate running shoe brief
                </button>
              )}
              <button
                type="button"
                onClick={addCustomBriefField}
                className="text-[11px] px-3 py-1.5 rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100"
              >
                + Add brief field
              </button>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/40 space-y-4">
            {/* Administrative Section - Workflow & Job Tracking */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project Administration</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600">
                    Workflow Tool
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 bg-white"
                    value={(previewPlan && (previewPlan as any).workflow_job_tool) ?? ''}
                    onChange={(e) => updateBriefFieldValue('workflow_job_tool', e.target.value)}
                  >
                    <option value="">Select tool...</option>
                    <option value="jira">Jira</option>
                    <option value="workfront">Workfront</option>
                    <option value="encodify">Encodify</option>
                    <option value="screendragon">Screendragon</option>
                    <option value="asana">Asana</option>
                    <option value="monday">Monday.com</option>
                    <option value="trello">Trello</option>
                    <option value="clickup">ClickUp</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600">
                    Job Code
                  </label>
                  <input
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 bg-white"
                    value={(previewPlan && (previewPlan as any).job_code) ?? ''}
                    onChange={(e) => updateBriefFieldValue('job_code', e.target.value)}
                    placeholder="e.g., PROJ-2024-001"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Brief Fields</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    <span className="text-[10px] font-semibold text-slate-500">Quality</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        (briefQualityScore ?? briefCompletionScore) !== null &&
                        (briefQualityScore ?? briefCompletionScore)! >= 8
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {(briefQualityScore ?? briefCompletionScore) !== null
                        ? `${(briefQualityScore ?? briefCompletionScore)!.toFixed(1)}/10`
                        : '—'}
                    </span>
                  </div>
                  {(briefQualityGaps.length > 0 || briefCompletionGaps.length > 0) && (
                    <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-600">Gaps:</span>
                      <span className="truncate max-w-[200px]">
                        {(briefQualityGaps.length ? briefQualityGaps : briefCompletionGaps).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {(briefQualityAgentLoading || briefQualityRationale) && (
                <div className="mt-2 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-600">Quality Assistant:</span>{' '}
                  <span className="truncate">
                    {briefQualityAgentLoading ? 'Scoring…' : briefQualityRationale}
                  </span>
                </div>
              )}
              {briefQualityEval && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowQualityDetails((v) => !v)}
                    className="text-[10px] font-semibold text-slate-600 hover:text-teal-700"
                  >
                    {showQualityDetails ? 'Hide Quality Assistant details' : 'Show Quality Assistant details'}
                  </button>
                  {showQualityDetails && (
                    <div className="mt-2 text-[11px] text-slate-600 space-y-2">
                      {briefQualityEval.recommendations?.length ? (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                            Recommendations
                          </div>
                          <div className="mt-1">
                            {briefQualityEval.recommendations.slice(0, 4).map((r, idx) => (
                              <div key={idx} className="leading-relaxed">
                                - {r}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {briefQualityEval.suggested_edits?.length ? (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                            Suggested edits (copy/paste)
                          </div>
                          <div className="mt-1 space-y-1">
                            {briefQualityEval.suggested_edits.slice(0, 4).map((e, idx) => (
                              <div key={idx} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                                <div className="text-[10px] font-mono text-slate-500">{e.field}</div>
                                <div className="text-[11px] text-slate-700">{e.suggestion}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {briefQualityEval.risks?.length ? (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Risks</div>
                          <div className="mt-1">
                            {briefQualityEval.risks.slice(0, 4).map((r, idx) => (
                              <div key={idx} className="leading-relaxed">
                                - {r}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {briefQualityEval.next_questions?.length ? (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                            Next questions
                          </div>
                          <div className="mt-1">
                            {briefQualityEval.next_questions.slice(0, 3).map((q, idx) => (
                              <div key={idx} className="leading-relaxed">
                                - {q}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
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
                        <button
                          type="button"
                          onClick={() => deleteCustomBriefField(field.key)}
                          className="text-[10px] text-slate-400 hover:text-red-500"
                        >
                          Remove
                        </button>
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
              <div className="pt-4 mt-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => downloadExport('txt')}
                  className="px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors"
                >
                  Download TXT
                </button>
                <button
                  onClick={() => downloadExport('pdf')}
                  className="px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => downloadExport('json')}
                  className="px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50 rounded transition-colors"
                >
                  Download JSON
                </button>
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
                  ? 'Audience Matrix'
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
                  <button
                    onClick={() => setProductionTab('requirementsLibrary')}
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      productionTab === 'requirementsLibrary'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Requirements Library
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
                            <button
                              type="button"
                              onClick={openAudienceFilePicker}
                              className="text-[11px] px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300 bg-white"
                            >
                              Import audiences (CSV/XLSX)
                            </button>
                            <input
                              type="file"
                              accept=".csv, .xlsx, .xls"
                              ref={audienceFileInputRef}
                              className="hidden"
                              onChange={handleAudienceFileChange}
                            />
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
                                <th className="px-2 py-2 w-16 text-center font-semibold">Line</th>
                                <th className="px-2 py-2 w-8 text-center"></th>
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
                                <Fragment key={index}>
                                  <tr className="align-top hover:bg-slate-50/70">
                                    <td className="px-2 py-1 text-center">
                                      <span className="text-xs font-mono font-semibold text-slate-700">
                                        {(index + 1).toString().padStart(3, '0')}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      <button
                                        type="button"
                                        onClick={() => toggleMatrixRowExpanded(index)}
                                        className="text-[11px] text-slate-500 hover:text-teal-700"
                                      >
                                        {expandedMatrixRows[index] ? '−' : '+'}
                                      </button>
                                    </td>
                                    {matrixFields.filter((f) => visibleMatrixFields.includes(f.key)).map((field) => (
                                      <td key={field.key} className="px-2 py-1">
                                        <input
                                          value={row[field.key] ?? ''}
                                          onChange={(e) =>
                                            updateMatrixCell(index, field.key as MatrixFieldKey, e.target.value)
                                          }
                                          className="w-full border border-gray-200 rounded px-2 py-2 text-sm leading-5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
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
                                  {expandedMatrixRows[index] && (
                                    <tr className="bg-slate-50/70">
                                      <td colSpan={visibleMatrixFields.length + 3} className="px-3 py-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-700">
                                          {matrixFields
                                            .filter((f) => visibleMatrixFields.includes(f.key))
                                            .map((field) => (
                                              <div
                                                key={`${field.key}-detail-${index}`}
                                                className="rounded-lg border border-slate-200 bg-white p-2"
                                              >
                                                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                                                  {field.label}
                                                </div>
                                                <div className="text-slate-700 whitespace-pre-wrap min-h-[32px]">
                                                  {row[field.key] || '—'}
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
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
                  {/* Single module: Plan + Jobs */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Plan (Audience → Concept → Spec) (What & Where)
                      </h3>
                      <p className="text-[11px] text-slate-500 max-w-xl">
                        Optional planning table that feeds the production jobs. Collapse if you prefer to work only from jobs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPlan((prev) => !prev)}
                      className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                    >
                      {showPlan ? 'Hide plan' : 'Show plan'}
                    </button>
                  </div>

                  {!showPlan && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
                      Plan is hidden. Expand to edit the audience → concept → spec mapping that feeds jobs.
                    </div>
                  )}

                    {showPlan && (
                      <div className="pt-3 border-t border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Production Requirements Matrix
                          </h3>
                          <p className="text-[11px] text-slate-500 max-w-xl">
                            Connect audiences to concepts and specs line-by-line. This feeds the production list builder without a traffic sheet. Feed template/ID details now live in Production Jobs under Build Details.
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
                              <th className="px-3 py-2 text-left">Segment Source</th>
                              <th className="px-3 py-2 text-left">Audience</th>
                              <th className="px-3 py-2 text-left">Concept</th>
                              <th className="px-3 py-2 text-left">Destination</th>
                              <th className="px-3 py-2 text-left">Destinations (add more)</th>
                              <th className="px-3 py-2 text-left">Feed?</th>
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
                                      value={row.segment_source ?? ''}
                                      onChange={(e) => updateProductionMatrixCell(index, 'segment_source' as any, e.target.value)}
                                      placeholder="CRM, Paid Social, Search, etc."
                                    />
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    <input
                                      className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                      value={row.audience}
                                      onChange={(e) => updateProductionMatrixCell(index, 'audience', e.target.value)}
                                      placeholder="Audience / cohort"
                                      list={`audience-options-${index}`}
                                    />
                                    <datalist id={`audience-options-${index}`}>
                                      {productionMatrixAudienceOptions.map((opt) => (
                                        <option key={opt} value={opt} />
                                      ))}
                                    </datalist>
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
                                        if (selectedSpec) {
                                          const destEntry: DestinationEntry = {
                                            name: `${selectedSpec.platform} · ${selectedSpec.placement}`,
                                            spec_id: selectedSpec.id,
                                          };
                                          updateProductionMatrixCell(index, 'destinations', [destEntry]);
                                        }
                                      }}
                                    >
                                      <option value="">Select destination</option>
                                      {specOptions.map((spec) => (
                                        <option key={spec.id} value={spec.id}>
                                          {spec.platform} · {spec.placement} ({spec.width}x{spec.height})
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2 align-top space-y-2">
                                    <div className="flex flex-wrap gap-1">
                                      {(row.destinations || []).map((dest) => (
                                        <span
                                          key={`${dest.name}-${dest.audience || 'any'}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]"
                                        >
                                          {dest.name}
                                          {dest.audience && (
                                            <span className="text-amber-700 bg-amber-50 px-1 rounded">
                                              {dest.audience}
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => removeDestinationFromRow(index, dest.name)}
                                            className="text-slate-400 hover:text-red-500"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))}
                                      {!row.destinations || row.destinations.length === 0 ? (
                                        <span className="text-[10px] text-slate-400">None yet</span>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <select
                                        className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                        value=""
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (!val) return;
                                          const parts = val.split(':::');
                                          if (parts.length === 2) {
                                            addDestinationToRow(index, parts[1], parts[0]);
                                          }
                                        }}
                                      >
                                        <option value="">Add destination...</option>
                                        {specs.map((s) => {
                                          const dName = `${s.platform} · ${s.placement}`;
                                          return (
                                            <option key={s.id} value={`${s.id}:::${dName}`}>
                                              {dName}
                                            </option>
                                          );
                                        })}
                                      </select>
                                      <input
                                        className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                        placeholder="Custom destination"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            addDestinationToRow(index, val, row.spec_id);
                                            (e.target as HTMLInputElement).value = '';
                                          }
                                        }}
                                      />
                                    </div>
                                    {row.destinations && row.destinations.length > 0 && (
                                      <div className="flex items-center gap-2">
                                        <select
                                          className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                          value={pendingDestAudience[row.id] ?? ''}
                                          onChange={(e) =>
                                            setPendingDestAudience((prev) => ({ ...prev, [row.id]: e.target.value }))
                                          }
                                        >
                                          <option value="">Audience tag (optional)</option>
                                          <option value="Prospecting">Prospecting</option>
                                          <option value="Retargeting">Retargeting</option>
                                          <option value="Loyalty">Loyalty</option>
                                          <option value="B2B">B2B</option>
                                          <option value="B2C">B2C</option>
                                        </select>
                                        <button
                                          type="button"
                                          className="px-2 py-1 text-[10px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                                          onClick={() => {
                                            const audienceTag = (pendingDestAudience[row.id] || '').trim();
                                            if (!audienceTag) return;
                                            // Apply to the last added destination
                                            setProductionMatrixRows((prev) =>
                                              prev.map((r) => {
                                                if (r.id !== row.id) return r;
                                                if (!r.destinations || r.destinations.length === 0) return r;
                                                const nextDests = [...r.destinations];
                                                nextDests[nextDests.length - 1] = {
                                                  ...nextDests[nextDests.length - 1],
                                                  audience: audienceTag,
                                                };
                                                return { ...r, destinations: nextDests };
                                              }),
                                            );
                                          }}
                                        >
                                          Tag last
                                        </button>
                                      </div>
                                    )}
                                    <p className="text-[10px] text-slate-400">
                                      Destinations determine the build specs. Add multiples per asset and optionally tag audience.
                                    </p>
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
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-100">
                        <p className="text-[11px] text-slate-500 max-w-2xl">
                          When your matrix rows look right, generate the production list to create the jobs below.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowJobs(true);
                            generateProductionJobsFromBuilder();
                          }}
                          disabled={builderLoading || productionMatrixRows.length === 0}
                          className="px-4 py-2 text-xs font-semibold rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          {builderLoading ? 'Generating…' : 'Generate Production List'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Production Requirements List – concept-to-spec grouper */}
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Production Jobs (How)
                        </h3>
                        <p className="text-[11px] text-slate-500 max-w-xl">
                          Execution view: the assets to build, where they go, and the requirements for each one.
                          Driven by the plan above.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowJobs((prev) => !prev)}
                          className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                        >
                          {showJobs ? 'Hide jobs' : 'Show jobs'}
                        </button>
                      </div>
                    </div>
                    {showJobs ? (
                      <>
                        {builderError && (
                          <p className="text-[11px] text-red-500">{builderError}</p>
                        )}
                        {builderJobs.length === 0 && (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
                            No jobs generated yet. Scroll up to the bottom of the Production Requirements Matrix and click
                            <span className="font-semibold text-slate-700"> Generate Production List</span>.
                          </div>
                        )}

                        {builderJobs.length > 0 && (
                          <div className="pt-3 border-t border-slate-200 space-y-2">
                            <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                              Jobs Preview (How)
                            </h4>
                            <p className="text-[11px] text-slate-500 max-w-2xl">
                              One row per asset to be built, grouped by shared specs with destinations attached.
                              Add requirements and a simple status before you move work to the board.
                            </p>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-[11px]">
                                <thead>
                                  <tr className="text-left text-slate-500 border-b border-slate-200">
                                    <th className="py-1.5 pr-4 font-semibold">Production Asset</th>
                                    <th className="py-1.5 pr-4 font-semibold">Tech Specs</th>
                                    <th className="py-1.5 pr-4 font-semibold">Destinations</th>
                                    <th className="py-1.5 pr-4 font-semibold">Build Details</th>
                                    <th className="py-1.5 pr-4 font-semibold">Requirements</th>
                                    <th className="py-1.5 pr-4 font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {builderJobs.map((job) => {
                                    const uniqueNotes = Array.from(
                                      new Set(job.destinations.map((d) => d.special_notes).filter(Boolean)),
                                    );
                                    const requirementsValue = jobRequirements[job.job_id] ?? '';
                                    const copyBlocks = jobCopyFields[job.job_id] || [];
                                    const meta = jobFeedMeta[job.job_id] || {};
                                    const isFeed = job.is_feed;
                                    const specMissing =
                                      (job.technical_summary || '').toLowerCase().includes('spec not set') ||
                                      job.asset_type === 'asset';
                                    const missingDestinations = job.missing_destinations || job.destinations.length === 0;
                                    const requirementFields =
                                      jobRequirementFields[job.job_id] || getDefaultRequirementFields(job.asset_type);
                                    const buildDirectionValue = jobBuildDetails[job.job_id]?.build_direction || '';
                                    return (
                                      <tr key={job.job_id} className="border-b border-slate-100 align-top">
                                        <td className="py-1.5 pr-4">
                                          <div className="font-semibold text-slate-800">
                                            {job.asset_type} – {job.creative_concept}
                                          </div>
                                          <div className="text-[10px] text-slate-400">{job.job_id}</div>
                                          {missingDestinations && (
                                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                                              No destination selected; asset type cannot be finalized.
                                            </p>
                                          )}
                                        </td>
                                        <td className="py-1.5 pr-4 text-slate-700">
                                          {job.technical_summary}
                                        </td>
                                        <td className="py-1.5 pr-4">
                                          <div className="flex flex-wrap gap-1">
                                            {job.destinations.map((dest) => (
                                              <span
                                                key={`${job.job_id}-${dest.spec_id}-${dest.platform_name}-${dest.special_notes || ''}`}
                                                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]"
                                              >
                                                {dest.platform_name}{' '}
                                                <span className="text-slate-400">
                                                  · {dest.format_name}
                                                </span>
                                                {dest.special_notes && (
                                                  <span className="ml-1 text-amber-700 bg-amber-50 px-1 rounded">
                                                    {dest.special_notes}
                                                  </span>
                                                )}
                                              </span>
                                            ))}
                                          </div>
                                        </td>
                                        <td className="py-1.5 pr-4 text-slate-700">
                                          {isFeed ? (
                                            <div className="space-y-1.5">
                                              {specMissing && (
                                                <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                  Spec missing – assign a spec to generate build details for this asset type.
                                                </p>
                                              )}
                                              {missingDestinations && (
                                                <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                  No destination selected – pick a destination to set asset type and build details.
                                                </p>
                                              )}
                                              <textarea
                                                className="w-full border border-slate-300 rounded-md px-2 py-1 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                rows={3}
                                                placeholder="Build direction for production team (free form)."
                                                value={buildDirectionValue}
                                                onChange={(e) =>
                                                  updateBuildDetail(job.job_id, 'build_direction' as any, e.target.value)
                                                }
                                              />
                                              <div className="flex gap-2">
                                                <input
                                                  className="w-1/2 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                  placeholder="Feed template"
                                                  value={meta.feed_template ?? job.feed_template ?? ''}
                                                  onChange={(e) =>
                                                    updateJobFeedMeta(job.job_id, 'feed_template', e.target.value)
                                                  }
                                                />
                                                <input
                                                  className="w-1/2 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                  placeholder="Template ID"
                                                  value={meta.template_id ?? job.template_id ?? ''}
                                                  onChange={(e) =>
                                                    updateJobFeedMeta(job.job_id, 'template_id', e.target.value)
                                                  }
                                                />
                                              </div>
                                              <div className="flex gap-2">
                                                <input
                                                  className="w-1/2 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                  placeholder="Feed ID"
                                                  value={meta.feed_id ?? job.feed_id ?? ''}
                                                  onChange={(e) => updateJobFeedMeta(job.job_id, 'feed_id', e.target.value)}
                                                />
                                                <input
                                                  className="w-1/2 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                  placeholder="Feed asset ID"
                                                  value={meta.feed_asset_id ?? job.feed_asset_id ?? ''}
                                                  onChange={(e) =>
                                                    updateJobFeedMeta(job.job_id, 'feed_asset_id', e.target.value)
                                                  }
                                                />
                                              </div>
                                              <p className="text-[10px] text-slate-400">
                                                Feed build details live here (template, IDs). Kept out of the plan table.
                                              </p>
                                            </div>
                                          ) : (
                                            <div className="space-y-1.5">
                                              <textarea
                                                className="w-full min-w-[200px] text-[11px] border border-slate-300 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                rows={3}
                                                placeholder="Build direction for production team (free form)."
                                                value={buildDirectionValue}
                                                onChange={(e) =>
                                                  updateBuildDetail(job.job_id, 'build_direction' as any, e.target.value)
                                                }
                                              />
                                              <textarea
                                                className="w-full min-w-[200px] text-[11px] border border-slate-300 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                rows={3}
                                                placeholder="File type, safe zones, animation asks."
                                                value={meta.production_details ?? job.production_details ?? ''}
                                                onChange={(e) =>
                                                  updateJobFeedMeta(job.job_id, 'production_details', e.target.value)
                                                }
                                              />
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-1.5 pr-4 text-slate-700">
                                          <div className="space-y-2">
                                            {specMissing && (
                                              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                Spec missing – set a spec to tailor build details and requirements.
                                              </p>
                                            )}
                                            {missingDestinations && (
                                              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                No destination selected – add a destination to finalize asset type and requirements.
                                              </p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                              {(jobRequirementFields[job.job_id] ||
                                                getDefaultRequirementFields(job.asset_type)).map((field) => (
                                                <div
                                                  key={field.id}
                                                  className="min-w-[220px] flex-1 border border-slate-200 rounded-lg bg-white px-2.5 py-2 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                                                >
                                                  <div className="flex items-center justify-between gap-2 mb-1">
                                                    <input
                                                      className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500"
                                                      value={field.label}
                                                      onChange={(e) =>
                                                        updateRequirementFieldValue(job.job_id, field.id, 'label', e.target.value)
                                                      }
                                                    />
                                                  </div>
                                                  <textarea
                                                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                                    rows={2}
                                                    placeholder="Requirement detail"
                                                    value={field.value}
                                                    onChange={(e) =>
                                                      updateRequirementFieldValue(job.job_id, field.id, 'value', e.target.value)
                                                    }
                                                  />
                                                </div>
                                              ))}
                                              <button
                                                type="button"
                                                onClick={() => addRequirementField(job.job_id)}
                                                className="px-3 py-2 text-[11px] rounded-lg border border-dashed border-slate-300 text-slate-600 bg-slate-50 hover:bg-slate-100"
                                              >
                                                + Add field
                                              </button>
                                            </div>
                                            <textarea
                                              className="w-full border border-slate-300 rounded-md px-2 py-1 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                              rows={2}
                                              placeholder={
                                                uniqueNotes.length
                                                  ? `Key cautions: ${uniqueNotes.join(' | ')}`
                                                  : 'Any remaining notes for requirements.'
                                              }
                                              value={requirementsValue}
                                              onChange={(e) =>
                                                setJobRequirements((prev) => ({
                                                  ...prev,
                                                  [job.job_id]: e.target.value,
                                                }))
                                              }
                                            />
                                            <div className="border border-dashed border-slate-200 rounded-lg bg-slate-50/70 p-2 space-y-2">
                                              <div className="flex items-center justify-between">
                                                <div className="text-[11px] text-slate-600 font-semibold uppercase tracking-wide">
                                                  Copy Blocks
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => addJobCopyField(job.job_id)}
                                                  className="text-[11px] px-2 py-1 rounded-full border border-teal-400 text-teal-700 bg-white hover:bg-teal-50"
                                                >
                                                  + Add copy field
                                                </button>
                                              </div>
                                              {copyBlocks.length === 0 ? (
                                                <p className="text-[11px] text-slate-500">
                                                  Add custom-named copy fields with font and usage notes for this job.
                                                </p>
                                              ) : (
                                                <div className="space-y-2">
                                                  {copyBlocks.map((copy) => (
                                                    <div
                                                      key={copy.id}
                                                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 space-y-2 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <input
                                                          className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500"
                                                          placeholder="Copy field name (e.g., Hook, CTA, Body)"
                                                          value={copy.label}
                                                          onChange={(e) =>
                                                            updateJobCopyField(job.job_id, copy.id, 'label', e.target.value)
                                                          }
                                                        />
                                                        <input
                                                          className="w-40 border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500"
                                                          placeholder="Font / style"
                                                          value={copy.font}
                                                          onChange={(e) =>
                                                            updateJobCopyField(job.job_id, copy.id, 'font', e.target.value)
                                                          }
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={() => removeJobCopyField(job.job_id, copy.id)}
                                                          className="text-[10px] text-slate-400 hover:text-red-500"
                                                        >
                                                          Remove
                                                        </button>
                                                      </div>
                                                      <textarea
                                                        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                                        rows={2}
                                                        placeholder="Copy text or direction (paste final copy or instructions)."
                                                        value={copy.text}
                                                        onChange={(e) =>
                                                          updateJobCopyField(job.job_id, copy.id, 'text', e.target.value)
                                                        }
                                                      />
                                                      <input
                                                        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                                        placeholder="Instructions for this copy (tone, length, placement)."
                                                        value={copy.instructions}
                                                        onChange={(e) =>
                                                          updateJobCopyField(job.job_id, copy.id, 'instructions', e.target.value)
                                                        }
                                                      />
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-1.5 pr-4 text-slate-500 text-[11px]">
                                          {job.status}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
                        Jobs module is collapsed. Expand to edit production jobs.
                      </div>
                    )}
                  </div>
                  </div>

                  {/* Existing Production Matrix – asset-level kitchen tickets */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Production Matrix (Board) (When / Progress)
                        </h3>
                        <p className="text-[11px] text-slate-500 max-w-xl">
                          Kanban view of the production jobs. Each card is a single asset to be built with full spec details.
                        </p>
                      </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBoard((prev) => !prev)}
                        className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                        >
                          {showBoard ? 'Hide board' : 'Show board'}
                        </button>
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
                    </div>
                    {showBoard && (
                      <>
                        {productionError && (
                          <p className="text-[11px] text-red-500">{productionError}</p>
                        )}
                        {builderJobs.length === 0 ? (
                          <div className="mt-12 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                            <p className="text-sm max-w-xs">
                              Generate the Production List above to view the two-column board linking creative details to live status.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {builderJobs.map((job) => {
                              const requirementsValue = jobRequirements[job.job_id] ?? '';
                              const copyBlocks = jobCopyFields[job.job_id] || [];
                              const meta = jobFeedMeta[job.job_id] || {};
                              const status = job.status || 'Pending';
                              const specMissing =
                                (job.technical_summary || '').toLowerCase().includes('spec not set') ||
                                job.asset_type === 'asset';
                              const missingDestinations = job.missing_destinations || job.destinations.length === 0;
                              const requirementFields =
                                jobRequirementFields[job.job_id] || getDefaultRequirementFields(job.asset_type);
                              const buildDirectionValue = jobBuildDetails[job.job_id]?.build_direction || '';
                              const humanStatus =
                                status === 'In_Progress' ? 'In Progress' : status === 'Review' ? 'In Review' : status;
                              const progressColor =
                                status === 'Approved'
                                  ? 'bg-emerald-500'
                                  : status === 'Review'
                                  ? 'bg-amber-500'
                                  : status === 'In_Progress'
                                  ? 'bg-sky-500'
                                  : 'bg-slate-300';
                              return (
                                <div
                                  key={job.job_id}
                                  className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
                                >
                                  {/* Left: creative unit details */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <p className="text-[11px] font-semibold text-slate-800">
                                          {job.creative_concept}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          {job.asset_type} · {job.job_id}
                                        </p>
                                      </div>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        Specs
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-700">{job.technical_summary}</p>
                                    {missingDestinations && (
                                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                        No destination selected – add one to finalize asset type and creative build.
                                      </p>
                                    )}
                                    {specMissing && (
                                      <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                        Spec missing – add a spec to unlock tailored build details and requirements.
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                      {job.destinations.map((dest) => (
                                        <span
                                          key={`${job.job_id}-${dest.platform_name}-${dest.format_name}-${dest.spec_id}`}
                                          className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] text-slate-700"
                                        >
                                          {dest.platform_name} · {dest.format_name}
                                          {dest.special_notes && (
                                            <span className="ml-1 text-amber-700 bg-amber-50 px-1 rounded">
                                              {dest.special_notes}
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                        Requirements
                                      </p>
                                    {requirementFields.length ? (
                                      <div className="flex flex-wrap gap-2">
                                        {requirementFields.map((field) => (
                                          <div
                                            key={field.id}
                                              className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"
                                            >
                                              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                                {field.label || 'Field'}
                                              </p>
                                              <p className="text-[11px] text-slate-700 whitespace-pre-wrap mt-0.5">
                                                {field.value || 'No detail added.'}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-[11px] text-slate-500">No requirements added yet.</p>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => applyLibraryToJob(job.job_id, job.asset_type)}
                                        className="mt-1 text-[11px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                                      >
                                        Add from Requirements Library
                                      </button>
                                      {requirementsValue && (
                                        <p className="text-[11px] text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg px-2 py-2">
                                          {requirementsValue}
                                        </p>
                                      )}
                                    </div>
                                    {copyBlocks.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                          Copy Blocks
                                        </p>
                                        <div className="space-y-1.5">
                                          {copyBlocks.map((copy) => (
                                            <div
                                              key={copy.id}
                                              className="border border-slate-200 rounded-lg bg-slate-50 px-2.5 py-2"
                                            >
                                              <div className="flex items-center justify-between text-[11px] text-slate-700">
                                                <span className="font-semibold truncate">{copy.label || 'Copy field'}</span>
                                                {copy.font && <span className="text-[10px] text-slate-500">{copy.font}</span>}
                                              </div>
                                              {copy.text && (
                                                <p className="text-[11px] text-slate-700 whitespace-pre-wrap mt-1">
                                                  {copy.text}
                                                </p>
                                              )}
                                              {copy.instructions && (
                                                <p className="text-[10px] text-slate-500 whitespace-pre-wrap mt-1">
                                                  {copy.instructions}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {(buildDirectionValue ||
                                      meta.production_details ||
                                      meta.feed_template ||
                                      meta.template_id ||
                                      meta.feed_id ||
                                      meta.feed_asset_id) && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                          Build Details
                                        </p>
                                        <div className="text-[11px] text-slate-700 space-y-0.5">
                                          {buildDirectionValue && <p>Direction: {buildDirectionValue}</p>}
                                          {meta.production_details && <p>Build: {meta.production_details}</p>}
                                          {meta.feed_template && <p>Feed template: {meta.feed_template}</p>}
                                          {meta.template_id && <p>Template ID: {meta.template_id}</p>}
                                          {meta.feed_id && <p>Feed ID: {meta.feed_id}</p>}
                                          {meta.feed_asset_id && <p>Feed asset ID: {meta.feed_asset_id}</p>}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: production status + creative preview */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${progressColor}`} />
                                        <span className="text-[11px] font-semibold text-slate-700">{humanStatus}</span>
                                      </div>
                                      <select
                                        value={status}
                                        onChange={(e) =>
                                          updateJobStatus(
                                            job.job_id,
                                            e.target.value as 'Pending' | 'In_Progress' | 'Review' | 'Approved',
                                          )
                                        }
                                        className="text-[11px] border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                      >
                                        <option value="Pending">Todo</option>
                                        <option value="In_Progress">In Progress</option>
                                        <option value="Review">In Review</option>
                                        <option value="Approved">Approved</option>
                                      </select>
                                    </div>
                                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                      Actual creative can be dropped here (e.g., link or embed). Use Production Plan export to align with ops.
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                      This column mirrors status across jobs. Each row ties 1:1 to the creative details on the left.
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
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

              {workspaceView === 'production' && productionTab === 'requirementsLibrary' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Requirements Library
                      </h3>
                      <p className="text-[11px] text-slate-500 max-w-xl">
                        Pre-populate requirement fields by asset type. These can be pulled into jobs with one click.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ASSET_TYPES.map((type) => {
                      const label =
                        type === 'h5'
                          ? 'HTML5'
                          : type.charAt(0).toUpperCase() + type.slice(1);
                      const fields = requirementsLibrary[type] || [];
                      return (
                        <div key={type} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-700">{label}</p>
                              <p className="text-[10px] text-slate-500">Default fields for {label} builds</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addLibraryField(type)}
                              className="text-[11px] px-2 py-1 rounded-full border border-teal-400 text-teal-700 bg-white hover:bg-teal-50"
                            >
                              + Add field
                            </button>
                          </div>
                          {fields.length === 0 ? (
                            <p className="text-[11px] text-slate-400">No fields yet.</p>
                          ) : (
                            <div className="space-y-1">
                              {fields.map((f) => (
                                <div key={f.id} className="text-[11px] text-slate-700 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50">
                                  {f.label}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400">
                            Use “Add from Requirements Library” in Jobs Preview to insert these.
                          </p>
                        </div>
                      );
                    })}
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
                        <input
                          type="file"
                          ref={brandAssetFileInputRef}
                          className="hidden"
                          multiple
                          onChange={handleBrandAssetChange}
                        />
                        <input
                          type="file"
                          ref={conceptFileInputRef}
                          className="hidden"
                          accept=".json"
                          onChange={handleConceptFileChange}
                        />
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
                        onClick={simulateDamImport}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-amber-400 bg-amber-50 text-amber-800 hover:border-amber-500 hover:text-amber-900 transition-colors"
                      >
                        Connect to DAM
                      </button>
                      <button
                        type="button"
                        onClick={openBrandAssetPicker}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Add Brand Assets
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const voice = window.prompt('Paste brand voice guidelines (key phrases, tone, dos/donts):');
                          if (!voice) return;
                          setBrandVoiceGuide(voice);
                          setMessages((prev) => [
                            ...prev,
                            { role: 'user', content: 'Setting brand voice guidelines for concept generation.' },
                            { role: 'assistant', content: 'Brand voice captured. I will keep tone aligned for all concepts.' },
                          ]);
                        }}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Load Brand Voice
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const style = window.prompt('Paste brand style guide highlights (colors, typography, motifs):');
                          if (!style) return;
                          setBrandStyleGuide(style);
                          setMessages((prev) => [
                            ...prev,
                            { role: 'user', content: 'Adding brand style guide highlights for concept visuals.' },
                            {
                              role: 'assistant',
                              content: 'Style guide captured. I will reference these visual rules when drafting concepts.',
                            },
                          ]);
                        }}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Load Brand Style Guide
                      </button>
                      <button
                        type="button"
                        onClick={openConceptFilePicker}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                      >
                        Upload Concepts (JSON)
                      </button>
                    </div>
                    {(brandAssets.length > 0 || brandVoiceGuide || brandStyleGuide) && (
                      <div className="mt-2 p-3 rounded-lg border border-teal-100 bg-teal-50 text-[11px] text-teal-800 flex flex-wrap gap-3">
                        <span className="font-semibold">Guided by:</span>
                        {brandAssets.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-teal-200">
                            {brandAssets.length} brand asset{brandAssets.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {brandVoiceGuide && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-teal-200">
                            Voice: locked in
                          </span>
                        )}
                        {brandStyleGuide && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-teal-200">
                            Style guide: loaded
                          </span>
                        )}
                        <span className="text-teal-700">
                          AI will use these as guardrails for concept generation and prompts.
                        </span>
                      </div>
                    )}
                    {(brandAssets.length > 0 || brandVoiceGuide || brandStyleGuide) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-[11px] text-slate-700">
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="font-semibold text-slate-800 mb-1">Brand assets</p>
                          {brandAssets.length ? (
                            <ul className="list-disc list-inside space-y-1">
                              {brandAssets.slice(0, 6).map((asset) => (
                                <li key={asset}>{asset}</li>
                              ))}
                              {brandAssets.length > 6 && (
                                <li className="text-slate-400">+{brandAssets.length - 6} more</li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-slate-400">None uploaded.</p>
                          )}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="font-semibold text-slate-800 mb-1">Brand voice</p>
                          <p className="text-slate-600 whitespace-pre-wrap min-h-[60px]">
                            {brandVoiceGuide || 'No voice guidelines yet.'}
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="font-semibold text-slate-800 mb-1">Style guide</p>
                          <p className="text-slate-600 whitespace-pre-wrap min-h-[60px]">
                            {brandStyleGuide || 'No style rules yet.'}
                          </p>
                        </div>
                      </div>
                    )}
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
                    <div className="space-y-6">
                      {concepts.map((c, index) => {
                        const isOnMoodBoard = moodBoardConceptIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
                          >
                            {/* LEFT COLUMN: Concept Instructions (Asset Type → Audience Line → Fields → Description) */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4 h-full">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-700">
                                  Concept Instructions
                                  {c.audienceLineIds && Array.isArray(c.audienceLineIds) && c.audienceLineIds.length > 0 && (
                                    <span className="ml-2 text-xs text-slate-400 font-normal">
                                      (Audience: {c.audienceLineIds.map((id) => {
                                        const lineIndex = matrixRows.findIndex((r) => r.id === id);
                                        return (lineIndex + 1).toString().padStart(3, '0');
                                      }).join(', ')})
                                    </span>
                                  )}
                                </h4>
                                <button
                                  onClick={() => removeConcept(index)}
                                  className="text-xs text-slate-400 hover:text-red-500"
                                >
                                  Remove
                                </button>
                              </div>
                              
                              {/* 1. Asset Type Selector */}
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-2 block">Asset Type</label>
                                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 p-1 w-full">
                                  {(['image', 'copy', 'video'] as const).map((kind) => (
                                    <button
                                      key={kind}
                                      type="button"
                                      onClick={() => updateConceptField(index, 'kind', kind)}
                                      className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors font-medium ${
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

                              {/* 2. Audience Line Selection */}
                              <div className="border-t border-gray-100 pt-4">
                                <label className="text-xs font-medium text-slate-600 mb-2 block">Select Audience Line</label>
                                  <select
                                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                    defaultValue=""
                                    onChange={(e) => {
                                      const selectedId = e.target.value;
                                      console.log('🎯 Audience line selected:', selectedId);
                                      if (selectedId) {
                                        const matrixRow = matrixRows.find((r) => r.id === selectedId);
                                        if (matrixRow) {
                                          // Track the audience line ID
                                          setConcepts((prev) => {
                                            const currentConcept = prev[index];
                                            if (!currentConcept) {
                                              console.warn('❌ Concept not found at index:', index);
                                              return prev;
                                            }
                                            
                                            const currentLineIds = currentConcept.audienceLineIds || [];
                                            if (!currentLineIds.includes(selectedId)) {
                                              const updatedLineIds = [...currentLineIds, selectedId];
                                              console.log('✅ Adding audience line:', selectedId, 'to concept:', currentConcept.id, 'Updated IDs:', updatedLineIds);
                                              
                                              // Automatically inject segment_source and segment_name fields
                                              const currentFields = currentConcept.selectedFields || [];
                                              const newFields: Array<{ lineId: string; fieldKey: string; fieldLabel: string; fieldValue: string }> = [];
                                              const descriptionParts: string[] = [];
                                              
                                              // Add segment_source if it exists and not already added
                                              if (matrixRow.segment_source) {
                                                const sourceFieldKey = 'segment_source';
                                                const sourceFieldExists = currentFields.some(
                                                  (f) => f.lineId === selectedId && f.fieldKey === sourceFieldKey
                                                );
                                                if (!sourceFieldExists) {
                                                  const sourceFieldLabel = matrixFields.find((f) => f.key === sourceFieldKey)?.label || 'Segment Source';
                                                  const sourceFieldValue = String(matrixRow.segment_source);
                                                  newFields.push({
                                                    lineId: selectedId,
                                                    fieldKey: sourceFieldKey,
                                                    fieldLabel: sourceFieldLabel,
                                                    fieldValue: sourceFieldValue,
                                                  });
                                                  descriptionParts.push(`${sourceFieldLabel}: ${sourceFieldValue}`);
                                                }
                                              }
                                              
                                              // Add segment_name if it exists and not already added
                                              if (matrixRow.segment_name) {
                                                const nameFieldKey = 'segment_name';
                                                const nameFieldExists = currentFields.some(
                                                  (f) => f.lineId === selectedId && f.fieldKey === nameFieldKey
                                                );
                                                if (!nameFieldExists) {
                                                  const nameFieldLabel = matrixFields.find((f) => f.key === nameFieldKey)?.label || 'Segment Name';
                                                  const nameFieldValue = String(matrixRow.segment_name);
                                                  newFields.push({
                                                    lineId: selectedId,
                                                    fieldKey: nameFieldKey,
                                                    fieldLabel: nameFieldLabel,
                                                    fieldValue: nameFieldValue,
                                                  });
                                                  descriptionParts.push(`${nameFieldLabel}: ${nameFieldValue}`);
                                                }
                                              }
                                              
                                              // Update selectedFields with auto-injected fields
                                              const updatedFields = [...currentFields, ...newFields];
                                              
                                              // Update description with auto-injected fields
                                              const autoInjectedText = descriptionParts.join('\n');
                                              const newDescription = currentConcept.description
                                                ? `${currentConcept.description}\n${autoInjectedText}`
                                                : autoInjectedText;
                                              
                                              return prev.map((concept, i) =>
                                                i === index
                                                  ? { 
                                                      ...concept, 
                                                      audienceLineIds: updatedLineIds,
                                                      selectedFields: updatedFields,
                                                      description: newDescription
                                                    }
                                                  : concept
                                              );
                                            }
                                            console.log('⚠️ Audience line already added:', selectedId);
                                            return prev;
                                          });
                                          
                                          // Reset dropdown
                                          e.target.value = '';
                                        } else {
                                          console.warn('❌ Matrix row not found for ID:', selectedId, 'Available IDs:', matrixRows.map(r => r.id));
                                        }
                                      }
                                    }}
                                  >
                                    <option value="">Select audience line...</option>
                                    {matrixRows.map((row, rowIndex) => {
                                      // Ensure row has an id - use existing id or generate one
                                      const rowId = row.id || `ROW-${(rowIndex + 1).toString().padStart(3, '0')}`;
                                      // If row doesn't have id, add it to the row
                                      if (!row.id) {
                                        // Update the row to have an id (this is a one-time fix)
                                        setTimeout(() => {
                                          setMatrixRows((prev) =>
                                            prev.map((r, i) => (i === rowIndex ? { ...r, id: rowId } : r))
                                          );
                                        }, 0);
                                      }
                                      return (
                                        <option key={rowId} value={rowId}>
                                          {(rowIndex + 1).toString().padStart(3, '0')}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {/* Show selected audience lines */}
                                  {c.audienceLineIds && Array.isArray(c.audienceLineIds) && c.audienceLineIds.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {c.audienceLineIds.map((lineId) => {
                                        const lineIndex = matrixRows.findIndex((r) => r.id === lineId);
                                        return (
                                          <span
                                            key={lineId}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded"
                                          >
                                            {(lineIndex + 1).toString().padStart(3, '0')}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setConcepts((prev) =>
                                                  prev.map((concept, i) =>
                                                    i === index
                                                      ? { ...concept, audienceLineIds: concept.audienceLineIds?.filter((id) => id !== lineId) || [] }
                                                      : concept
                                                  )
                                                );
                                              }}
                                              className="text-blue-500 hover:text-red-500"
                                            >
                                              ×
                                            </button>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                              </div>

                              {/* 3. Audience Attribute Fields (Field Selection + Display) */}
                              <div className="border-t border-gray-100 pt-4 space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-slate-600 mb-2 block">
                                    {c.audienceLineIds && Array.isArray(c.audienceLineIds) && c.audienceLineIds.length > 0 
                                      ? `Add Fields from Selected Audience Line(s) (${c.audienceLineIds.length} line${c.audienceLineIds.length !== 1 ? 's' : ''} selected)`
                                      : 'Add Fields from Selected Audience Line(s) (select audience line above first)'}
                                  </label>
                                  {/* Debug info */}
                                  {process.env.NODE_ENV === 'development' && (
                                    <div className="text-[9px] text-slate-400 mb-1 font-mono bg-slate-50 p-1 rounded">
                                      Debug: audienceLineIds={JSON.stringify(c.audienceLineIds)}, matrixRows={matrixRows.length}, matrixFields={matrixFields.length}
                                    </div>
                                  )}
                                  {matrixRows.length === 0 && (
                                    <p className="text-xs text-red-500 mb-2">⚠️ No matrix rows available. Please add rows in the Audience module first.</p>
                                  )}
                                  {matrixFields.length === 0 && (
                                    <p className="text-xs text-red-500 mb-2">⚠️ No matrix fields configured.</p>
                                  )}
                                  <select
                                        key={`field-selector-${c.id}-${c.selectedFields?.length || 0}-${c.audienceLineIds?.join(',') || ''}`}
                                        className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 bg-white"
                                        defaultValue=""
                                        onChange={(e) => {
                                          const selectedValue = e.target.value;
                                          if (!selectedValue) return;
                                          
                                          const [rowId, fieldKey] = selectedValue.split('|');
                                          if (!rowId || !fieldKey) return;
                                          
                                          const matrixRow = matrixRows.find((r) => r.id === rowId);
                                          if (!matrixRow || !matrixRow[fieldKey]) return;
                                          
                                          const fieldLabel = matrixFields.find((f) => f.key === fieldKey)?.label || fieldKey;
                                          const fieldValue = matrixRow[fieldKey]?.toString() || '';
                                          
                                          // Update state
                                          setConcepts((prev) => {
                                            const currentConcept = prev[index];
                                            if (!currentConcept) return prev;
                                            
                                            const currentFields = currentConcept.selectedFields || [];
                                            
                                            // Check if field already exists
                                            const fieldExists = currentFields.some(
                                              (f) => f.lineId === rowId && f.fieldKey === fieldKey
                                            );
                                            
                                            if (fieldExists) {
                                              return prev; // Field already added
                                            }
                                            
                                            const newField = {
                                              lineId: rowId,
                                              fieldKey: fieldKey,
                                              fieldLabel: fieldLabel,
                                              fieldValue: fieldValue,
                                            };
                                            
                                            // Add to selectedFields
                                            const updatedFields = [...currentFields, newField];
                                            
                                            // Also add to description for context
                                            const descriptionText = `${fieldLabel}: ${fieldValue}`;
                                            const newDescription = currentConcept.description 
                                              ? `${currentConcept.description}\n${descriptionText}` 
                                              : descriptionText;
                                            
                                            // Return updated concepts array
                                            return prev.map((concept, i) =>
                                              i === index
                                                ? { 
                                                    ...concept, 
                                                    selectedFields: updatedFields,
                                                    description: newDescription
                                                  }
                                                : concept
                                            );
                                          });
                                          
                                          // Force select reset by changing key
                                          e.target.value = '';
                                        }}
                                      >
                                        <option value="">Select a field to add...</option>
                                        {(() => {
                                          // Always log for debugging
                                          const hasAudienceLines = c.audienceLineIds && Array.isArray(c.audienceLineIds) && c.audienceLineIds.length > 0;
                                          
                                          if (!hasAudienceLines) {
                                            return <option value="" disabled>Select audience lines first</option>;
                                          }
                                          
                                          // Process all selected audience lines
                                          const optGroups: JSX.Element[] = [];
                                          
                                          c.audienceLineIds.forEach((lineId) => {
                                            console.log('🔍 Looking for row with ID:', lineId);
                                            console.log('📊 Available matrixRows:', matrixRows.map((r, idx) => ({ 
                                              id: r.id || `ROW-${(idx + 1).toString().padStart(3, '0')}`, 
                                              segment_name: r.segment_name 
                                            })));
                                            
                                            // Find row by id, or by generated id pattern
                                            let matrixRow = matrixRows.find((r) => r.id === lineId);
                                            let lineIndex = matrixRows.findIndex((r) => r.id === lineId);
                                            
                                            // If not found by id, try index-based lookup (ROW-001, ROW-002, etc.)
                                            if (!matrixRow && lineId && lineId.startsWith('ROW-')) {
                                              const indexMatch = lineId.match(/ROW-(\d+)/);
                                              if (indexMatch) {
                                                const targetIndex = parseInt(indexMatch[1]) - 1;
                                                if (targetIndex >= 0 && targetIndex < matrixRows.length) {
                                                  matrixRow = matrixRows[targetIndex];
                                                  lineIndex = targetIndex;
                                                  console.log('✅ Found row by index pattern:', targetIndex);
                                                }
                                              }
                                            }
                                            
                                            // If still not found, try matching by generated id
                                            if (!matrixRow) {
                                              matrixRows.forEach((r, idx) => {
                                                const generatedId = r.id || `ROW-${(idx + 1).toString().padStart(3, '0')}`;
                                                if (generatedId === lineId) {
                                                  matrixRow = r;
                                                  lineIndex = idx;
                                                }
                                              });
                                            }
                                            
                                            if (!matrixRow) {
                                              console.error('❌ Row not found! Looking for:', lineId, 'Available IDs:', matrixRows.map((r, idx) => r.id || `ROW-${(idx + 1).toString().padStart(3, '0')}`));
                                              optGroups.push(
                                                <optgroup key={lineId} label={`Line (not found)`}>
                                                  <option value="" disabled>Row not found for ID: {lineId}</option>
                                                </optgroup>
                                              );
                                              return;
                                            }
                                            
                                            console.log('✅ Row found!', matrixRow);
                                            
                                            // Get ALL field keys from the row (excluding 'id')
                                            const rowKeys = Object.keys(matrixRow).filter(key => key !== 'id');
                                            
                                            // Show ALL fields that have values (non-empty strings)
                                            // This ensures we show everything that has actual data
                                            const availableFields = rowKeys.filter((key) => {
                                              const value = matrixRow[key];
                                              // Include if value exists and is not empty
                                              const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
                                              return hasValue;
                                            });
                                            
                                            console.log(`📋 Line ${(lineIndex + 1).toString().padStart(3, '0')} (${lineId}):`, {
                                              totalRowKeys: rowKeys.length,
                                              fieldsWithValues: availableFields.length,
                                              allKeys: rowKeys,
                                              fieldsWithData: availableFields,
                                              sampleData: availableFields.slice(0, 3).map(k => ({
                                                key: k,
                                                value: String(matrixRow[k]).substring(0, 40)
                                              }))
                                            });
                                            
                                            if (availableFields.length === 0) {
                                              optGroups.push(
                                                <optgroup key={lineId} label={`Line ${(lineIndex + 1).toString().padStart(3, '0')} (no values)`}>
                                                  <option value="" disabled>No fields with values. Row has {rowKeys.length} keys: {rowKeys.slice(0, 5).join(', ')}...</option>
                                                </optgroup>
                                              );
                                              return;
                                            }
                                            
                                            // Create options for this line - show ALL fields with values
                                            const options = availableFields.map((fieldKey) => {
                                              const fieldLabel = matrixFields.find((f) => f.key === fieldKey)?.label || fieldKey;
                                              const rawValue = matrixRow[fieldKey];
                                              const fieldValue = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : '';
                                              const isSelected = c.selectedFields?.some(
                                                (f) => f.lineId === lineId && f.fieldKey === fieldKey
                                              );
                                              
                                              return (
                                                <option 
                                                  key={`${lineId}-${fieldKey}`} 
                                                  value={`${lineId}|${fieldKey}`}
                                                  disabled={isSelected}
                                                >
                                                  {fieldLabel}: {fieldValue.substring(0, 50)}{fieldValue.length > 50 ? '...' : ''} {isSelected ? '(added)' : ''}
                                                </option>
                                              );
                                            });
                                            
                                            console.log(`✅ Created ${options.length} field options for line ${(lineIndex + 1).toString().padStart(3, '0')}`);
                                            
                                            console.log(`✅ Created ${options.length} options for line ${(lineIndex + 1).toString().padStart(3, '0')}`);
                                            
                                            optGroups.push(
                                              <optgroup key={lineId} label={`Line ${(lineIndex + 1).toString().padStart(3, '0')} (${availableFields.length} fields)`}>
                                                {options}
                                              </optgroup>
                                            );
                                          });
                                          
                                          return optGroups.length > 0 ? optGroups : <option value="" disabled>No fields found</option>;
                                        })()}
                                  </select>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    Select fields to add their values to the concept description for prompting.
                                  </p>
                                </div>

                                {/* Display selected fields */}
                                <div>
                                      <label className="text-xs font-medium text-slate-600 mb-2 block">
                                        Selected Fields (informing prompt) {c.selectedFields && Array.isArray(c.selectedFields) ? `(${c.selectedFields.length})` : '(0)'}
                                      </label>
                                      {c.selectedFields && Array.isArray(c.selectedFields) && c.selectedFields.length > 0 ? (
                                        <div className="space-y-2 border border-slate-200 rounded-lg bg-slate-50/40 p-3 max-h-48 overflow-y-auto">
                                          {c.selectedFields.map((field, fieldIndex) => {
                                            if (!field || !field.lineId || !field.fieldKey) return null;
                                            const lineIndex = matrixRows.findIndex((r) => r.id === field.lineId);
                                            if (lineIndex === -1) return null;
                                            
                                            return (
                                              <div
                                                key={`${field.lineId}-${field.fieldKey}-${fieldIndex}`}
                                                className="flex items-start justify-between gap-2 bg-white border border-slate-200 rounded px-2 py-2 text-xs"
                                              >
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-[10px] text-blue-600 font-semibold">
                                                      {(lineIndex + 1).toString().padStart(3, '0')}
                                                    </span>
                                                    <span className="font-medium text-slate-700">{field.fieldLabel || field.fieldKey}:</span>
                                                  </div>
                                                  <p className="text-slate-600 whitespace-pre-wrap break-words">
                                                    {field.fieldValue || ''}
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConcepts((prev) => {
                                                      const currentConcept = prev[index];
                                                      if (!currentConcept || !currentConcept.selectedFields) return prev;
                                                      
                                                      // Remove the field
                                                      const fieldToRemove = currentConcept.selectedFields[fieldIndex];
                                                      const updatedFields = currentConcept.selectedFields.filter(
                                                        (_, i) => i !== fieldIndex
                                                      );
                                                      
                                                      // Remove the field's text from description
                                                      const descriptionTextToRemove = `${fieldToRemove?.fieldLabel || fieldToRemove?.fieldKey}: ${fieldToRemove?.fieldValue || ''}`;
                                                      let updatedDescription = currentConcept.description || '';
                                                      if (descriptionTextToRemove && updatedDescription.includes(descriptionTextToRemove)) {
                                                        // Remove the field text from description
                                                        updatedDescription = updatedDescription
                                                          .split('\n')
                                                          .filter(line => line.trim() !== descriptionTextToRemove.trim())
                                                          .join('\n')
                                                          .trim();
                                                      }
                                                      
                                                      return prev.map((concept, i) =>
                                                        i === index 
                                                          ? { ...concept, selectedFields: updatedFields, description: updatedDescription } 
                                                          : concept
                                                      );
                                                    });
                                                  }}
                                                  className="text-slate-400 hover:text-red-500 text-xs flex-shrink-0 px-1"
                                                  title="Remove this field"
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-slate-400 italic border border-slate-200 rounded-lg bg-slate-50/40 p-3">
                                          No fields selected yet. Select fields from the dropdown above.
                                        </div>
                                      )}
                                    </div>
                              </div>

                              {/* 4. Creative Description Details for Concept Prompt */}
                              <div className="border-t border-gray-100 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-xs font-medium text-slate-600">Creative Description Details</label>
                                  {c.description && c.description.trim() && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Copy description to the AI Prompt field
                                        updateConceptField(index, 'generatedPrompt', c.description);
                                      }}
                                      className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded hover:bg-teal-50 transition-colors"
                                      title="Add description to Concept Generator prompt"
                                    >
                                      Add to Generator →
                                    </button>
                                  )}
                                </div>
                                <textarea
                                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 min-h-[200px]"
                                  placeholder="Free form description of the concept, narrative, hooks, and how it modularly recombines across channels. This will inform the AI prompt for generating the asset."
                                  value={c.description}
                                  onChange={(e) => updateConceptField(index, 'description', e.target.value)}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Describe the creative concept, visual style, narrative, and any specific requirements for the asset generation.
                                </p>
                              </div>
                            </div>

                            {/* RIGHT COLUMN: Concept Generator (Prompt + Output) */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4 h-full">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-700">Concept Generator</h4>
                                {c.kind && (
                                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    Generating: {c.kind === 'image' ? 'Image' : c.kind === 'video' ? 'Video' : 'Copy'}
                                  </span>
                                )}
                              </div>

                              {/* Prompt Box */}
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-2 block">
                                  AI Prompt {c.kind ? `(for ${c.kind})` : ''}
                                </label>
                                <textarea
                                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 min-h-[120px]"
                                  placeholder={c.kind 
                                    ? `Enter your prompt for generating this ${c.kind}. If left blank, it will be built from the concept description and selected fields.`
                                    : "Select an asset type in the left column first, then enter your prompt here. If left blank, it will be built from the concept description."
                                  }
                                  value={c.generatedPrompt ?? ''}
                                  onChange={(e) =>
                                    updateConceptField(index, 'generatedPrompt', e.target.value as any)
                                  }
                                />
                              </div>

                              {/* Generate or Upload Buttons */}
                              {c.kind === 'image' || c.kind === 'video' ? (
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => generateAssetForConcept(index)}
                                    disabled={c.status === 'generating'}
                                    className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-teal-500 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {c.status === 'generating'
                                      ? 'Generating...'
                                      : `Generate ${c.kind === 'video' ? 'Video' : 'Image'}`}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Create input if it doesn't exist
                                      if (!conceptVideoUploadRefs.current[c.id]) {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = c.kind === 'video' ? 'video/*' : 'image/*';
                                        input.style.display = 'none';
                                        input.onchange = (e: any) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const isVideo = file.type.startsWith('video');
                                            const isImage = file.type.startsWith('image');
                                            if ((c.kind === 'video' && isVideo) || (c.kind === 'image' && isImage)) {
                                              const url = URL.createObjectURL(file);
                                              setConcepts((prev) =>
                                                prev.map((concept, i) =>
                                                  i === index
                                                    ? {
                                                        ...concept,
                                                        generatedAssetUrl: url,
                                                        file_url: url,
                                                        file_name: file.name,
                                                        file_type: file.type,
                                                        status: 'completed',
                                                        kind: c.kind,
                                                      }
                                                    : concept
                                                )
                                              );
                                            }
                                          }
                                          // Clean up
                                          document.body.removeChild(input);
                                        };
                                        document.body.appendChild(input);
                                        conceptVideoUploadRefs.current[c.id] = input;
                                      }
                                      conceptVideoUploadRefs.current[c.id]?.click();
                                    }}
                                    className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    Upload {c.kind === 'video' ? 'Video' : 'Image'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => generateAssetForConcept(index)}
                                  disabled={c.status === 'generating' || !c.kind}
                                  className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-teal-500 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {c.status === 'generating'
                                    ? 'Generating...'
                                    : 'Generate Copy'}
                                </button>
                              )}

                              {/* Output Box */}
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-2 block">Generated Output</label>
                                <div className="border border-slate-200 rounded-lg bg-slate-50/40 p-4 min-h-[250px] flex items-center justify-center">
                                  {c.status === 'generating' ? (
                                    <div className="text-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
                                      <p className="text-sm text-slate-600">Generating {c.kind}...</p>
                                    </div>
                                  ) : (c.generatedAssetUrl || c.file_url) && (c.kind === 'image' || c.kind === 'video') ? (
                                    <div className="w-full space-y-3">
                                      {c.kind === 'image' ? (
                                        <img
                                          src={c.generatedAssetUrl || c.file_url}
                                          alt={c.title || 'Generated image'}
                                          className="w-full rounded-lg border border-slate-200 max-h-64 object-contain bg-white cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => setExpandedImageUrl(c.generatedAssetUrl || c.file_url || null)}
                                        />
                                      ) : (
                                        <video
                                          src={c.generatedAssetUrl || c.file_url}
                                          controls
                                          className="w-full rounded-lg border border-slate-200 max-h-64 bg-black"
                                        >
                                          Your browser does not support the video tag.
                                        </video>
                                      )}
                                      {c.file_name && (
                                        <p className="text-xs text-slate-500 text-center">
                                          {c.file_name}
                                        </p>
                                      )}
                                    </div>
                                  ) : c.generatedAssetUrl && c.kind === 'copy' ? (
                                    <div className="w-full">
                                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-4 rounded border border-slate-200">
                                        {c.generatedAssetUrl}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-400 text-center">
                                      {c.kind ? `Generated ${c.kind} will appear here.` : 'Select an asset type and enter a prompt to begin.'}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              {c.status === 'completed' && c.generatedAssetUrl && (
                                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMoodBoardConceptIds((prev) =>
                                        isOnMoodBoard ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                                      );
                                    }}
                                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                                      isOnMoodBoard
                                        ? 'border-red-500 text-red-700 bg-red-50 hover:bg-red-100'
                                        : 'border-amber-400 text-amber-600 bg-white hover:bg-amber-50'
                                    }`}
                                  >
                                    {isOnMoodBoard ? 'Remove from Concept Board' : 'Add to Concept Board'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => generateAssetForConcept(index)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-teal-500 bg-white text-teal-600 hover:bg-teal-50 transition-colors"
                                  >
                                    Re-prompt
                                  </button>
                                </div>
                              )}

                              {c.status === 'error' && (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                                  <p className="font-medium mb-1">Generation failed</p>
                                  <p className="text-red-700">
                                    {c.kind === 'video' 
                                      ? 'Video generation requires Veo API access and service account authentication. Please check your backend configuration.'
                                      : 'Please try again or adjust your prompt.'}
                                  </p>
                                  {c.errorMessage && (
                                    <p className="mt-1 text-[10px] text-red-600 opacity-75">
                                      {c.errorMessage}
                                    </p>
                                  )}
                                </div>
                              )}
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
                        A curated board of final concepts you’ve marked from the Concepts canvas. Click a tile to quick-view details.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={conceptFileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleConceptFileChange}
                      />
                      <input
                        type="file"
                        ref={conceptMediaInputRef}
                        className="hidden"
                        accept="image/*,application/pdf,video/*"
                        multiple
                        onChange={handleConceptMediaChange}
                      />
                      <button
                        type="button"
                        onClick={openConceptFilePicker}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                      >
                        Upload concepts
                      </button>
                      <button
                        type="button"
                        onClick={openConceptMediaPicker}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                      >
                        Upload media
                      </button>
                      <button
                        type="button"
                        onClick={simulateDamImport}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100"
                      >
                        Add from DAM
                      </button>
                      <button
                        type="button"
                        onClick={() => setRightTab('builder')}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                      >
                        Manage concepts
                      </button>
                    </div>
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
                                  onClick={() => setConceptDetail(c)}
                                  className="relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow"
                                >
                                  {c.generatedAssetUrl && (c.kind === 'image' || c.kind === 'video') && (
                                    <div 
                                      className="w-full rounded-lg border border-slate-200 overflow-hidden mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (c.kind === 'image') {
                                          setExpandedImageUrl(c.generatedAssetUrl);
                                        }
                                      }}
                                    >
                                      {c.kind === 'image' ? (
                                        <img
                                          src={c.generatedAssetUrl}
                                          alt={c.title || 'Generated image'}
                                          className="w-full h-32 object-cover bg-white"
                                        />
                                      ) : (
                                        <video
                                          src={c.generatedAssetUrl}
                                          className="w-full h-32 object-cover bg-black"
                                          controls
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Your browser does not support the video tag.
                                        </video>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
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
                                      {/* Display associated audience lines as numbers */}
                                      {c.audienceLineIds && c.audienceLineIds.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {c.audienceLineIds.map((lineId) => {
                                            const lineIndex = matrixRows.findIndex((r) => r.id === lineId);
                                            if (lineIndex === -1) return null;
                                            return (
                                              <span
                                                key={lineId}
                                                className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded"
                                                title={`Audience Line ${(lineIndex + 1).toString().padStart(3, '0')}`}
                                              >
                                                {(lineIndex + 1).toString().padStart(3, '0')}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {/* Display selected fields if any */}
                                      {c.selectedFields && c.selectedFields.length > 0 && (
                                        <div className="mt-1.5 text-[10px] text-slate-500">
                                          <span className="font-medium">Fields:</span>{' '}
                                          {c.selectedFields.slice(0, 3).map((field, idx) => (
                                            <span key={`${field.lineId}-${field.fieldKey}`}>
                                              {idx > 0 && ', '}
                                              {field.fieldLabel}
                                            </span>
                                          ))}
                                          {c.selectedFields.length > 3 && ` +${c.selectedFields.length - 3} more`}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMoodBoardConceptIds((prev) => prev.filter((id) => id !== c.id));
                                      }}
                                      className="text-[10px] text-slate-400 hover:text-red-500"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  {c.file_url && c.file_type?.startsWith('image') && (
                                    <div className="rounded-lg overflow-hidden border border-slate-100">
                                      <img
                                        src={c.file_url}
                                        alt={c.title || c.file_name || 'Uploaded concept asset'}
                                        className="w-full h-32 object-cover"
                                      />
                                    </div>
                                  )}
                                  {c.file_url && c.file_type?.startsWith('video') && (
                                    <div className="rounded-lg overflow-hidden border border-slate-100">
                                      <video
                                        src={c.file_url}
                                        controls
                                        playsInline
                                        controlsList="nodownload noremoteplayback nofullscreen"
                                        disablePictureInPicture
                                        onDoubleClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        className="w-full h-32 object-cover"
                                      />
                                    </div>
                                  )}
                                  {c.file_url && c.file_type === 'application/pdf' && (
                                    <div className="text-[11px] text-slate-600 flex items-center gap-2">
                                      <span className="font-semibold">PDF:</span>
                                      <a
                                        href={c.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-teal-700 hover:underline"
                                      >
                                        {c.file_name || 'Open PDF'}
                                      </a>
                                    </div>
                                  )}
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

                  {!feedEligible && (
                    <div className="border border-dashed border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-[11px] text-amber-800">
                      No feed-eligible rows yet. Mark a production row as “Feed?” to enable feed editing, or continue to add feed rows manually below.
                    </div>
                  )}

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
                  onClick={() => setShowPartnerLibrary(true)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-teal-500 text-teal-700 bg-white hover:bg-teal-50"
                >
                  Partner Field Library
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
                      <div className="mt-3 border border-slate-200 rounded-lg bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                              Partner Templates
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Select a partner preset to load its fields into Feed Fields.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={addPartnerTemplate}
                            className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                          >
                            + Add partner
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-auto">
                          {Object.entries(feedFieldPartners).map(([partner, fields]) => (
                            <button
                              key={partner}
                              type="button"
                              onClick={() => applyPartnerFields(partner)}
                              className="text-left border border-slate-200 rounded-lg p-2 bg-slate-50 hover:border-teal-400 hover:bg-teal-50"
                            >
                              <p className="text-[11px] font-semibold text-slate-700">{partner}</p>
                              <p className="text-[10px] text-slate-500">{fields.length} field(s)</p>
                            </button>
                          ))}
                          {Object.keys(feedFieldPartners).length === 0 && (
                            <p className="text-[11px] text-slate-400">No partner templates yet.</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-slate-500">
                        Need all saved fields? Apply feed library directly.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowPartnerLibrary(true)}
                        className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                      >
                        Open partner library
                      </button>
                    </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                          Field Mapping
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Connect feed source fields to destination platform fields.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFeedMapping((prev) => !prev)}
                        className="text-[11px] px-3 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                      >
                        {showFeedMapping ? 'Hide mapping' : 'Show mapping'}
                      </button>
                    </div>
                    {showFeedMapping && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                Source fields
                              </p>
                              <p className="text-[10px] text-slate-500">Feed fields you’ve defined.</p>
                            </div>
                            <button
                              type="button"
                        onClick={() => setShowPartnerLibrary(true)}
                        className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                      >
                        Load library
                      </button>
                            <button
                              type="button"
                              onClick={() => setShowFeedSourceFields((prev) => !prev)}
                              className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                            >
                              {showFeedSourceFields ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          {showFeedSourceFields ? (
                            <div className="space-y-1 max-h-56 overflow-auto">
                              {feedFieldLibrary.map((field) => (
                                <div
                                  key={field.key as string}
                                  draggable
                                  onDragStart={() => setDragSourceField(field.key as string)}
                                  onClick={() => setDragSourceField(field.key as string)}
                                  className={`text-[11px] px-2 py-1 rounded border ${
                                    dragSourceField === field.key
                                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-400'
                                  }`}
                                >
                                  {field.label}
                                </div>
                              ))}
                              {feedFieldLibrary.length === 0 && (
                                <p className="text-[11px] text-slate-400">No source fields.</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500">Source fields hidden.</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                Destination fields
                              </p>
                              <p className="text-[10px] text-slate-500">Platform fields to map into.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white"
                                onChange={(e) => applyDestinationTemplate(e.target.value)}
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Load template…
                                </option>
                                {Object.keys(destinationTemplates).map((tpl) => (
                                  <option key={tpl} value={tpl}>
                                    {tpl}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={addDestinationField}
                                className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                              >
                                + Add destination
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-56 overflow-auto">
                            {destinationFieldLibrary.map((dest) => {
                              const mapped = feedFieldMappings.find(
                                (m) => m.destination === dest && m.platform === feedMappingPlatform,
                              );
                              return (
                                <div
                                  key={dest}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => handleDropMapping(dest)}
                                  className="text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:border-teal-400 flex items-center justify-between"
                                >
                                  <span>{dest}</span>
                                  <button
                                    type="button"
                                    className="text-[10px] text-teal-600"
                                    onClick={() => handleDropMapping(dest)}
                                    disabled={!dragSourceField}
                                  >
                                    Map
                                  </button>
                                  {mapped && (
                                    <span className="text-[10px] text-slate-500 ml-2">
                                      ← {mapped.source}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {destinationFieldLibrary.length === 0 && (
                              <p className="text-[11px] text-slate-400">No destination fields.</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                Field Associations
                              </p>
                              <p className="text-[10px] text-slate-500">Source → Destination</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                className="text-[11px] border border-slate-200 rounded px-2 py-1 bg-white"
                                value={feedMappingPlatform}
                                onChange={(e) =>
                                  setFeedMappingPlatform(e.target.value)
                                }
                              >
                                {Object.keys(feedFieldPartners).length === 0 ? (
                                  <option value="">No partners</option>
                                ) : (
                                  Object.keys(feedFieldPartners).map((platform) => (
                                    <option key={platform} value={platform}>
                                      {platform}
                                    </option>
                                  ))
                                )}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const raw = window.prompt('Add destination platform name:');
                                  if (!raw) return;
                                  const trimmed = raw.trim();
                                  if (!trimmed) return;
                                  setFeedMappingPlatform(trimmed);
                                }}
                                className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100"
                              >
                                + Add platform
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-56 overflow-auto">
                            {feedFieldMappings.filter((m) => m.platform === feedMappingPlatform).map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50"
                              >
                                <span className="text-slate-700">
                                  {m.source} → {m.destination}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deleteFeedMappingRow(m.id)}
                                  className="text-[10px] text-slate-400 hover:text-red-500"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            {feedFieldMappings.filter((m) => m.platform === feedMappingPlatform).length === 0 && (
                              <p className="text-[11px] text-slate-400">No mappings yet. Drag or click Map to connect.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

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

      {showPartnerLibrary && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-900">Partner field library</p>
                <p className="text-[11px] text-slate-500">
                  Pick a platform to load its creative fields into the feed builder and mapping view.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    applyFeedLibrary();
                    setShowPartnerLibrary(false);
                  }}
                  className="text-[10px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-100"
                >
                  Use current feed library
                </button>
                <button
                  type="button"
                  onClick={() => setShowPartnerLibrary(false)}
                  className="text-[10px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-auto">
                {Object.entries(feedFieldPartners).map(([partner, fields]) => (
                  <div
                    key={partner}
                    className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 hover:border-teal-400 hover:bg-teal-50 cursor-pointer transition-colors"
                    onClick={() => applyPartnerFields(partner, 'both')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-800">{partner}</p>
                        <p className="text-[10px] text-slate-500">{fields.length} platform field(s)</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyPartnerFields(partner, 'both');
                        }}
                        className="text-[10px] px-2 py-1 rounded-full border border-teal-400 text-teal-700 bg-white hover:bg-teal-50"
                      >
                        Load both
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {fields.slice(0, 12).map((field) => (
                        <span
                          key={field.key}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600"
                        >
                          {field.label}
                        </span>
                      ))}
                      {fields.length > 12 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-dashed border-slate-200 text-slate-500">
                          +{fields.length - 12} more
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyPartnerFields(partner, 'feed');
                        }}
                        className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-teal-50"
                      >
                        Load to feed fields
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyPartnerFields(partner, 'mapping');
                        }}
                        className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-700 bg-white hover:bg-teal-50"
                      >
                        Load to field mapping
                      </button>
                    </div>
                  </div>
                ))}
                {Object.keys(feedFieldPartners).length === 0 && (
                  <p className="text-[11px] text-slate-500">No partner templates yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Concept detail shadowbox */}
      {conceptDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setConceptDetail(null)}
        >
          <div
            className="w-[75vw] max-w-5xl h-[75vh] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {conceptDetail.title || 'Untitled concept'}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono text-slate-600">{conceptDetail.asset_id || 'No asset ID'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-slate-400">{conceptDetail.id}</span>
                  {conceptDetail.kind && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 capitalize">
                      {conceptDetail.kind}
                    </span>
                  )}
                  {conceptDetail.status && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] text-emerald-700 capitalize">
                      {conceptDetail.status}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConceptDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
                {conceptDetail.file_url ? (
                  conceptDetail.file_type?.startsWith('image') ? (
                    <img
                      src={conceptDetail.file_url}
                      alt={conceptDetail.title || conceptDetail.file_name || 'Concept asset'}
                      className="w-full max-h-[60vh] object-contain"
                    />
                  ) : conceptDetail.file_type?.startsWith('video') ? (
                    <video
                      src={conceptDetail.file_url}
                      controls
                      playsInline
                      controlsList="nodownload noremoteplayback nofullscreen"
                      disablePictureInPicture
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="w-full max-h-[60vh] object-contain bg-black"
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[12px] text-slate-700">
                      <div className="flex flex-col">
                        <span className="font-semibold">Attachment</span>
                        <span className="text-slate-500">{conceptDetail.file_name || 'Download file'}</span>
                      </div>
                      <a
                        href={conceptDetail.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 text-[11px] font-semibold hover:underline"
                      >
                        Open
                      </a>
                    </div>
                  )
                ) : (
                  <div className="px-4 py-6 bg-gradient-to-br from-slate-50 to-slate-100 text-center text-[12px] text-slate-500">
                    No media uploaded for this concept yet. Add a reference from the concept board or DAM.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Concept</p>
                  <p className="text-[12px] text-slate-700 whitespace-pre-wrap">
                    {conceptDetail.description || 'No description provided.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Notes</p>
                  <p className="text-[12px] text-slate-700 whitespace-pre-wrap">
                    {conceptDetail.notes || 'No production notes yet.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">AI Prompt</p>
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[12px] text-slate-700 whitespace-pre-wrap">
                    {conceptDetail.generatedPrompt || 'Prompt not generated yet. Use the Concept Canvas to build one.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close main workspace row container */}
      </div>

      {/* Audience import modal */}
      {audienceImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Import Audience Matrix</h3>
                <p className="text-[11px] text-slate-500">
                  Map columns from your CSV/XLSX to the Strategy Matrix. Unmapped fields stay empty.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAudienceImportOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AUDIENCE_IMPORT_FIELDS.map((field) => (
                  <label key={field.key} className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600">{field.label}</span>
                    <select
                      className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 bg-white"
                      value={audienceImportMapping[field.key] ?? ''}
                      onChange={(e) =>
                        setAudienceImportMapping((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Not mapped --</option>
                      {audienceImportColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {audienceImportRows.length > 0 && (
                <div className="border border-slate-200 rounded-lg">
                  <div className="px-3 py-2 border-b border-slate-100 text-[11px] text-slate-600 font-semibold">
                    Preview (first 5 rows)
                  </div>
                  <div className="max-h-48 overflow-auto">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          {audienceImportColumns.map((col) => (
                            <th key={col} className="px-2 py-1 text-left">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {audienceImportRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            {audienceImportColumns.map((col) => (
                              <td key={`${idx}-${col}`} className="px-2 py-1 text-slate-700">
                                {String((row as any)[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAudienceImportOpen(false)}
                className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyAudienceImport}
                className="px-4 py-1.5 text-[11px] rounded-full border border-teal-500 text-white bg-teal-600 hover:bg-teal-700"
              >
                Import to matrix
              </button>
            </div>
          </div>
        </div>
      )}

    </main>

      {/* Image Expansion Modal */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setExpandedImageUrl(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              onClick={() => setExpandedImageUrl(null)}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={expandedImageUrl}
              alt="Expanded view"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
