'use client';
import { useState, useRef, useEffect, useMemo, Fragment, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import { useToast } from './components/ui/Toast';
import {
  INITIAL_MATRIX_LIBRARY,
  INITIAL_STRATEGY_MATRIX_RUNNING_SHOES,
  RUNNING_SHOE_DEMO_BRIEF,
  SAMPLE_JSON,
  SAMPLE_MATRIX,
  SAMPLE_NARRATIVE,
} from './data/sampleData';
import { HISTORICAL_BRIEFS, PRESET_SPECS } from './data/catalogs';
import { WorkspaceGuidanceBanner } from './components/layout/WorkspaceGuidanceBanner';
import { ModuleAssistantBar } from './components/layout/ModuleAssistantBar';

// ---- State Persistence Helpers ----
const STORAGE_KEY_PREFIX = 'modcon_';

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to save to localStorage:', key, e);
  }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', key, e);
  }
  return fallback;
}

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
  { key: 'asset_format_requirements', label: 'Asset Format Requirements' },
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
  // Enhanced production fields
  max_duration_seconds?: number;      // e.g., 15, 60, 6 for bumpers
  min_duration_seconds?: number;      // e.g., 3 for some formats
  file_size_limit_kb?: number;        // e.g., 150 for display ads
  aspect_ratio?: string;              // e.g., "9:16", "16:9", "1:1"
  audio_guidance?: string;            // e.g., "Sound on", "Sound off/captions"
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
  // Enhanced spec details for production clarity
  max_duration_seconds?: number;       // e.g., 15, 60, 6
  dimensions?: string;                 // e.g., "1080x1920"
  aspect_ratio?: string;               // e.g., "9:16", "16:9"
  media_type?: string;                 // e.g., "video", "image", "html5"
  file_size_limit_kb?: number;         // e.g., 150 for display ads
};

type DestinationEntry = {
  name: string;
  audience?: string;
  spec_id?: string;
};

type ProductionJobRow = {
  job_id: string;
  ticket_number?: string;              // e.g., "PROD-2026-001" for cross-team tracking
  creative_concept: string;
  asset_type: string;
  destinations: DeliveryDestinationRow[];
  technical_summary: string;
  status: string;
  // Assignee & delivery tracking
  assignee?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  // Client approval workflow
  approval_status?: 'pending' | 'submitted' | 'approved' | 'revision_requested' | 'rejected';
  approver?: string;
  approved_at?: string;
  approval_comments?: string;
  // Production lifecycle
  revision_number?: number;            // R1, R2, R3 tracking
  round_label?: string;                // e.g., "R1", "R2", "Final"
  version_tag?: string;                // e.g., "v1", "v1.1_localized"
  cost_estimate?: number;              // Estimated cost in cents
  estimated_hours?: number;
  reviewer?: string;                   // Internal QC reviewer
  created_at?: string;
  updated_at?: string;
  // feed/build meta captured later in UI, not required from generator
  is_feed?: boolean;
  feed_template?: string;
  template_id?: string;
  feed_id?: string;
  feed_asset_id?: string;
  production_details?: string;
  missing_destinations?: boolean;
  // DAM reference
  dam_asset_url?: string;
  dam_asset_id?: string;
  
  // === NEW PRODUCTION ENGINEERING FIELDS ===
  
  // Brief context (for traceability)
  campaign_name?: string;              // From brief
  single_minded_proposition?: string;  // Core message from brief
  
  // Production notes (consolidated safe zones & platform guidance)
  production_notes?: string;           // Consolidated safe zone & platform guidance
  
  // Duration constraints
  max_duration_seconds?: number;       // e.g., 15, 6, 60
  min_duration_seconds?: number;       // e.g., 3 for some formats
  
  // File specifications
  file_format?: string;                // e.g., "MP4", "MOV", "HTML5", "JPG"
  codec?: string;                      // e.g., "H.264", "H.265"
  audio_spec?: string;                 // e.g., "Sound on", "Sound off / captions required"
  frame_rate?: string;                 // e.g., "30fps", "24fps"
  file_size_limit_mb?: number;         // e.g., 4.0, 150 (for display)
  
  // Source type
  source_type?: 'new_shoot' | 'stock' | 'existing' | 'ugc' | 'ai_generated';
  shoot_code?: string;                 // Link to shoot or kit
  
  // Localization
  language?: string;                   // e.g., "EN-US", "Multi-market"
  requires_subtitles?: boolean;
  localization_notes?: string;
  
  // Compliance
  legal_disclaimer_required?: boolean;
  talent_usage_rights?: string;        // e.g., "In perpetuity", "6 months"
  music_licensing_status?: string;     // e.g., "Licensed", "Needs clearance"
  
  // === TRACEABILITY FIELDS ===
  
  // Concept linkage
  concept_id?: string;                 // Link to source concept
  concept_name?: string;               // Concept name for display
  
  // Feed linkage
  feed_row_ids?: string[];             // Feed rows generated from this job
  
  // Audience linkage
  audience_ids?: string[];             // Target audience segment IDs
  audience_names?: string[];           // Audience segment names for display
  
  // Funnel stage
  funnel_stage?: 'awareness' | 'consideration' | 'conversion' | 'retention';
  
  // Module type (for DCO taxonomy)
  module_type?: string;                // e.g., "hook", "value_prop", "cta"
  
  // Workflow status (enhanced)
  workflow_status?: 'backlog' | 'ready' | 'in_progress' | 'in_review' | 'approved' | 'delivered';
  
  // Platform destination
  destination_platform?: string;       // e.g., "flashtalking", "innovid", "celtra"
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
  decisioning_rule?: string;  // IF/THEN rule for DCO platforms
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
  { key: 'asset_format_requirements', label: 'Asset Format Requirements' },
  { key: 'contextual_triggers', label: 'Contextual Triggers' },
  { key: 'notes', label: 'Notes' },
];

type HistoricalBrief = {
  id: string;
  campaign_name: string;
  single_minded_proposition: string;
  primary_audience: string;
  narrative_brief: string;
};

type FunnelStage = 'awareness' | 'consideration' | 'conversion' | 'retention';

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
  // Enhanced ModCon fields
  funnelStages?: FunnelStage[]; // Funnel stages this concept targets
  moduleType?: string; // Link to module taxonomy (hook, value_prop, proof_point, etc.)
  productionJobIds?: string[]; // Production jobs linked to this concept
  feedRowIds?: string[]; // Feed rows generated from this concept
};

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

// Media Plan Import Types (for Prisma, MediaOcean, etc.)
type MediaPlanRow = {
  id: string;
  platform: string;
  placement: string;
  format: string;
  width: number;
  height: number;
  media_type: 'video' | 'image' | 'html5' | 'audio' | 'native';
  duration?: number;
  budget?: number;
  flight_start?: string;
  flight_end?: string;
  targeting?: string;
  notes?: string;
  selected?: boolean; // For UI selection
};

// Common media plan column mappings (Prisma, MediaOcean, Fluent, etc.)
const MEDIA_PLAN_COLUMN_MAPPINGS: Record<string, string[]> = {
  platform: ['platform', 'publisher', 'channel', 'media_type', 'media type', 'vendor', 'partner'],
  placement: ['placement', 'placement_name', 'placement name', 'ad unit', 'ad_unit', 'position', 'inventory'],
  format: ['format', 'ad_format', 'ad format', 'creative_type', 'creative type', 'asset_type'],
  width: ['width', 'creative_width', 'creative width', 'size_width', 'w'],
  height: ['height', 'creative_height', 'creative height', 'size_height', 'h'],
  dimensions: ['dimensions', 'size', 'creative_size', 'creative size', 'ad_size', 'ad size'],
  duration: ['duration', 'length', 'video_length', 'video length', 'seconds'],
  budget: ['budget', 'cost', 'spend', 'planned_spend', 'planned spend', 'net_cost', 'gross_cost'],
  flight_start: ['start_date', 'start date', 'flight_start', 'flight start', 'in_home', 'in home', 'launch'],
  flight_end: ['end_date', 'end date', 'flight_end', 'flight end', 'out_of_home', 'out of home'],
  targeting: ['targeting', 'audience', 'demo', 'demographic', 'segment', 'audience_targeting'],
  notes: ['notes', 'comments', 'description', 'details', 'special_instructions'],
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


export default function Home() {
  const {
    error: toastError,
    warning: toastWarning,
    info: toastInfo,
    success: toastSuccess,
  } = useToast();
  const MAX_UPLOAD_MB = 10;
  const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
  const isFileTooLarge = (file: File, label: string) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toastError('File too large', `${label} must be under ${MAX_UPLOAD_MB} MB.`);
      return true;
    }
    return false;
  };
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Creative Strategy Architect. I can help you build a production-ready intelligent content brief. Shall we start with the Campaign Name and your primary goal?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Sample View State
  const [showSample, setShowSample] = useState(false);
  const [sampleTab, setSampleTab] = useState<'narrative' | 'matrix' | 'json'>('narrative');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showMediaPlanImport, setShowMediaPlanImport] = useState(false);
  const [mediaPlanParsedRows, setMediaPlanParsedRows] = useState<MediaPlanRow[]>([]);
  const [mounted, setMounted] = useState(false);
  const [demoMode, setDemoMode] = useState(false); // Initial value for SSR, will load from storage after mount
  type WorkspaceView = 'brief' | 'matrix' | 'concepts' | 'production' | 'feed';
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('brief');
  const [splitRatio, setSplitRatio] = useState(0.6); // kept for potential future resizing
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [rightTab, setRightTab] = useState<'builder' | 'board'>('builder');
  const [productionBoardView, setProductionBoardView] = useState<'list' | 'kanban'>('list');
  const [matrixFields, setMatrixFields] = useState<MatrixFieldConfig[]>(BASE_MATRIX_FIELDS);
  const [visibleMatrixFields, setVisibleMatrixFields] = useState<MatrixFieldKey[]>(
  [...PRIMARY_MATRIX_KEYS, ...EXECUTION_MATRIX_KEYS],
  );
  const [showMatrixFieldConfig, setShowMatrixFieldConfig] = useState(false);
  const [showMatrixLibrary, setShowMatrixLibrary] = useState(false);
  const [matrixLibrary, setMatrixLibrary] = useState<ContentMatrixTemplate[]>(INITIAL_MATRIX_LIBRARY);
  const [briefFields, setBriefFields] = useState<BriefFieldConfig[]>(BASE_BRIEF_FIELDS);
  const [briefState, setBriefState] = useState<ModConBriefState>(() => loadFromStorage('briefState', {
    campaign_name: '',
    smp: '',
    audiences: [],
    kpis: [],
    flight_dates: {},
    status: 'Draft',
  }));
  
  // Undo/Redo history for brief state
  const [briefHistory, setBriefHistory] = useState<ModConBriefState[]>([]);
  const [briefHistoryIndex, setBriefHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);
  
  // Autosave indicator state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<{ id: string; message: string; time: string }[]>([]);
  
  // Track brief changes for history
  useEffect(() => {
    if (isUndoRedo) {
      setIsUndoRedo(false);
      return;
    }
    // Don't add empty states or duplicates to history
    const lastState = briefHistory[briefHistoryIndex];
    if (lastState && JSON.stringify(lastState) === JSON.stringify(briefState)) return;
    
    // Add current state to history (limit to 50 entries)
    const newHistory = briefHistory.slice(0, briefHistoryIndex + 1);
    newHistory.push({ ...briefState });
    if (newHistory.length > 50) newHistory.shift();
    setBriefHistory(newHistory);
    setBriefHistoryIndex(newHistory.length - 1);
  }, [briefState]);
  
  // Undo function
  const undoBrief = () => {
    if (briefHistoryIndex > 0) {
      setIsUndoRedo(true);
      const newIndex = briefHistoryIndex - 1;
      setBriefHistoryIndex(newIndex);
      setBriefState(briefHistory[newIndex]);
      toastInfo('Undo', 'Previous brief state restored');
    }
  };
  
  // Redo function
  const redoBrief = () => {
    if (briefHistoryIndex < briefHistory.length - 1) {
      setIsUndoRedo(true);
      const newIndex = briefHistoryIndex + 1;
      setBriefHistoryIndex(newIndex);
      setBriefState(briefHistory[newIndex]);
      toastInfo('Redo', 'Brief state restored');
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Undo/Redo - works even in input fields
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redoBrief();
        } else {
          e.preventDefault();
          undoBrief();
        }
        return;
      }
      
      // Don't process other shortcuts if in input field
      if (isInputField) return;
      
      // "?" or "/" to show keyboard help
      if (e.key === '?' || (e.key === '/' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setShowKeyboardHelp(true);
        return;
      }
      
      // "Escape" to close modals
      if (e.key === 'Escape') {
        if (showKeyboardHelp) setShowKeyboardHelp(false);
        if (showSample) setShowSample(false);
        if (showLibrary) setShowLibrary(false);
        return;
      }
      
      // Number keys 1-5 to navigate stages
      if (e.key >= '1' && e.key <= '5' && !e.metaKey && !e.ctrlKey) {
        const stages = ['brief', 'matrix', 'concepts', 'production', 'feed'] as const;
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < stages.length) {
          setWorkspaceView(stages[idx]);
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [briefHistoryIndex, briefHistory, showKeyboardHelp, showSample, showLibrary]);
  
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
  
  // Minimum viable brief threshold for production readiness
  const PRODUCTION_READY_THRESHOLD = 7.0;
  const currentScore = briefQualityScore ?? briefCompletionScore ?? 0;
  const isProductionReady = currentScore >= PRODUCTION_READY_THRESHOLD;

  // ============================================================================
  // AUTO QA SYSTEM
  // ============================================================================
  type QAIssue = {
    id: string;
    module: 'brief' | 'audiences' | 'concepts' | 'production' | 'feed';
    severity: 'error' | 'warning' | 'suggestion';
    title: string;
    description: string;
    action?: string;
    field?: string;
  };

  const [qaResults, setQaResults] = useState<QAIssue[]>([]);
  const [qaRunning, setQaRunning] = useState(false);
  const [showQaPanel, setShowQaPanel] = useState(false);
  const [lastQaRun, setLastQaRun] = useState<string | null>(null);

  // runAutoQA function is defined below after all state dependencies are declared

  // ============================================================================
  // MODULE AI ASSISTANT (Right Panel for non-brief modules)
  // ============================================================================
  type AIAssistantMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  };

  type ModuleContext = 'matrix' | 'concepts' | 'production' | 'feed';

  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAssistantMessages, setAiAssistantMessages] = useState<AIAssistantMessage[]>([]);
  const [aiAssistantInput, setAiAssistantInput] = useState('');
  const [aiAssistantLoading, setAiAssistantLoading] = useState(false);

  // Module-specific quick prompts
  const moduleQuickPrompts: Record<ModuleContext, { label: string; prompt: string }[]> = {
    matrix: [
      { label: 'Suggest segments', prompt: 'Based on the brief, suggest 3 additional audience segments I should consider.' },
      { label: 'Validate messaging', prompt: 'Review my audience matrix and check if the messaging aligns with the SMP.' },
      { label: 'Platform recommendations', prompt: 'Which platforms should I prioritize for each segment?' },
    ],
    concepts: [
      { label: 'Generate variations', prompt: 'Suggest 2-3 variations for the selected concept that could work for different audiences.' },
      { label: 'Check brief alignment', prompt: 'Does this concept ladder back to our SMP and key messaging?' },
      { label: 'Visual direction', prompt: 'What visual style and tone would work best for this concept?' },
    ],
    production: [
      { label: 'Validate specs', prompt: 'Review my production jobs and flag any spec issues or platform mismatches.' },
      { label: 'Estimate timeline', prompt: 'Based on the job count and complexity, estimate production timeline.' },
      { label: 'Optimization tips', prompt: 'What can I do to streamline this production matrix?' },
    ],
    feed: [
      { label: 'Validate feed', prompt: 'Check my DCO feed structure for common issues before export.' },
      { label: 'Platform mapping', prompt: 'Help me map these fields correctly for Flashtalking/Innovid.' },
      { label: 'Best practices', prompt: 'What are DCO feed best practices I should follow?' },
    ],
  };

  // Get current module context
  const getCurrentModuleContext = (): ModuleContext | null => {
    if (workspaceView === 'matrix') return 'matrix';
    if (workspaceView === 'concepts') return 'concepts';
    if (workspaceView === 'production') return 'production';
    if (workspaceView === 'feed') return 'feed';
    return null;
  };

  // Build comprehensive workflow context for SME agents
  const buildWorkflowContext = () => {
    const smp = briefState.smp || briefState.single_minded_proposition || '';
    const campaignName = briefState.campaign_name || 'Untitled Campaign';
    const primaryAudience = briefState.primary_audience || '';
    const kpis = briefState.kpis || [];
    
    // Analyze workflow readiness
    const briefComplete = !!(smp && campaignName && primaryAudience);
    const audiencesReady = matrixRows.length > 0;
    const conceptsReady = concepts.length > 0;
    const productionReady = builderJobs.length > 0;
    const feedReady = feedRows.length > 0;
    
    // Identify gaps
    const upstreamGaps: string[] = [];
    if (!briefComplete) upstreamGaps.push('Brief incomplete (missing SMP or audience)');
    if (!audiencesReady) upstreamGaps.push('No audience segments defined');
    if (!conceptsReady) upstreamGaps.push('No creative concepts created');
    
    return {
      campaign: { name: campaignName, smp, primaryAudience, kpis },
      audiences: { count: matrixRows.length, segments: matrixRows.slice(0, 5) },
      concepts: { count: concepts.length, items: concepts.slice(0, 5) },
      production: {
        jobCount: builderJobs.length,
        specCount: specs.length,
        statusBreakdown: builderJobs.reduce((acc, j) => {
          acc[j.status] = (acc[j.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        unassigned: builderJobs.filter(j => !j.assignee).length,
        missingDueDates: builderJobs.filter(j => !j.due_date).length,
        missingDestinations: builderJobs.filter(j => j.missing_destinations || j.destinations.length === 0).length,
      },
      feed: { rowCount: feedRows.length },
      workflow: { briefComplete, audiencesReady, conceptsReady, productionReady, feedReady, upstreamGaps },
    };
  };

  // Generate SME-level response based on module context and user query
  const generateSMEResponse = (ctx: ModuleContext, message: string, workflowCtx: ReturnType<typeof buildWorkflowContext>): string => {
    const msgLower = message.toLowerCase();
    const { campaign, audiences, concepts: conceptsCtx, production, workflow } = workflowCtx;

    // ============================================================================
    // AUDIENCE MATRIX SME AGENT
    // ============================================================================
    if (ctx === 'matrix') {
      // Check for upstream dependencies first
      if (!workflow.briefComplete && msgLower.includes('suggest')) {
        return `⚠️ **Upstream Gap Detected**\n\nBefore I can suggest optimal segments, the brief needs:\n${!campaign.smp ? '• Single-Minded Proposition (SMP)\n' : ''}${!campaign.primaryAudience ? '• Primary audience definition\n' : ''}\n**Recommendation:** Complete the brief first, then I can generate segments that ladder directly to your strategic foundation.\n\n→ Navigate to Brief module to complete these fields.`;
      }

      if (msgLower.includes('suggest') || msgLower.includes('segment')) {
        const smpKeywords = campaign.smp.toLowerCase();
        let suggestions = '';
        
        if (smpKeywords.includes('wellness') || smpKeywords.includes('health') || smpKeywords.includes('sleep')) {
          suggestions = `**Suggested Audience Segments (Based on SMP: "${campaign.smp.slice(0, 60)}...")**\n\n1. **Stressed Professionals** (High Priority)\n   • Insight: "I need to switch off but can't"\n   • Trigger: Evening browsing, productivity content\n   • Platforms: LinkedIn, Instagram, YouTube\n\n2. **Health-Conscious Parents**\n   • Insight: "I put everyone else first"\n   • Trigger: School schedule, family wellness content\n   • Platforms: Meta, Pinterest, CTV\n\n3. **Wellness Skeptics**\n   • Insight: "I've tried everything, nothing works"\n   • Trigger: Product reviews, testimonials\n   • Platforms: YouTube, Reddit (via programmatic)\n\n**Downstream Impact:** These segments will drive ${3 * concepts.length} concept variations minimum.`;
        } else if (smpKeywords.includes('value') || smpKeywords.includes('save') || smpKeywords.includes('deal')) {
          suggestions = `**Suggested Audience Segments (Based on SMP: "${campaign.smp.slice(0, 60)}...")**\n\n1. **Smart Shoppers** (High Priority)\n   • Insight: "I research before I buy"\n   • Trigger: Price comparison, review content\n   • Platforms: Google, YouTube, Meta\n\n2. **Deal Seekers**\n   • Insight: "I wait for the right moment"\n   • Trigger: Promotional periods, flash sales\n   • Platforms: Email, Meta, Push notifications\n\n3. **Value Maximizers**\n   • Insight: "I want the best bang for my buck"\n   • Trigger: Bundle offers, loyalty perks\n   • Platforms: CTV, Display, LinkedIn\n\n**Next Step:** Add these to your matrix, then move to Concepts to build messaging variations.`;
        } else {
          suggestions = `**Suggested Audience Segments (Based on: "${campaign.smp.slice(0, 60)}...")**\n\n1. **Core Enthusiasts** (High Priority)\n   • Insight: "This is exactly what I've been looking for"\n   • Platforms: Meta, YouTube, Display\n\n2. **Curious Considerers**\n   • Insight: "I'm interested but need more proof"\n   • Platforms: YouTube, Programmatic, CTV\n\n3. **Late Adopters**\n   • Insight: "I'll try it when others have proven it"\n   • Platforms: Display retargeting, Email\n\n**Pro Tip:** Each segment should have distinct message pillars that ladder to your SMP.`;
        }
        return suggestions;
      }

      if (msgLower.includes('validate') || msgLower.includes('review') || msgLower.includes('check')) {
        if (audiences.count === 0) {
          return `**Audience Matrix Review**\n\n❌ No segments defined yet.\n\n**To proceed effectively:**\n1. Add 3-5 distinct audience segments\n2. Each segment needs: Name, Key Insight, Platform Environments\n3. Message pillars should tie back to your SMP\n\n**Quick Start:** Use "Suggest segments" to auto-generate based on your brief.`;
        }
        
        const issues: string[] = [];
        const strengths: string[] = [];
        
        audiences.segments.forEach(seg => {
          if (!seg.key_insight) issues.push(`"${seg.segment_name || 'Unnamed'}" missing key insight`);
          if (!seg.platform_environments) issues.push(`"${seg.segment_name || 'Unnamed'}" missing platforms`);
          if (seg.key_insight && seg.primary_message_pillar) strengths.push(`"${seg.segment_name}" well-defined`);
        });

        return `**Audience Matrix Review** ✓\n\n**Summary:** ${audiences.count} segments defined\n\n${strengths.length > 0 ? `**Strengths:**\n${strengths.map(s => `• ${s}`).join('\n')}\n\n` : ''}${issues.length > 0 ? `**Issues to Address:**\n${issues.map(i => `⚠️ ${i}`).join('\n')}\n\n` : ''}**Downstream Readiness:**\n${conceptsCtx.count > 0 ? `✓ ${conceptsCtx.count} concepts ready for production` : '→ Next: Create concepts that address each segment'}\n\n**Industry Benchmark:** Top ModCon campaigns typically have 4-6 segments with distinct platform strategies.`;
      }

      if (msgLower.includes('platform') || msgLower.includes('channel')) {
        return `**Platform Strategy Recommendations**\n\nBased on your ${audiences.count} segments and industry benchmarks:\n\n**Video-First Platforms:**\n• YouTube (Pre-roll, Shorts) - Consideration\n• TikTok (In-Feed, TopView) - Awareness\n• Meta Reels/Stories - Engagement\n• CTV (Roku, Hulu) - Reach\n\n**Static/Display:**\n• Meta Feed - Conversion\n• LinkedIn - B2B audiences\n• Programmatic Display - Retargeting\n\n**DCO Considerations:**\n• Flashtalking: Best for complex versioning\n• Innovid: Strong CTV creative\n• Celtra: Excellent for scale\n\n**Tip:** Map each audience segment to 2-3 priority platforms based on behavior patterns.`;
      }

      return `**Audience Matrix Assistant** 🎯\n\nI'm your audience strategy SME. I can help with:\n\n• **Segment suggestions** based on your SMP and brief\n• **Matrix validation** to ensure downstream readiness\n• **Platform recommendations** by audience type\n• **Message pillar alignment** with strategic foundation\n\n**Current State:**\n• Campaign: ${campaign.name}\n• Segments: ${audiences.count} defined\n• SMP: ${campaign.smp ? 'Defined ✓' : 'Missing ⚠️'}\n\nWhat would you like to explore?`;
    }

    // ============================================================================
    // CONCEPTS SME AGENT
    // ============================================================================
    if (ctx === 'concepts') {
      if (!workflow.audiencesReady && msgLower.includes('generat')) {
        return `⚠️ **Upstream Gap: No Audience Segments**\n\nTo generate effective concepts, I need audience segments to target.\n\n**Why this matters:**\n• Concepts should address specific audience insights\n• Without segments, concepts lack strategic grounding\n• Production will require audience × concept matrix\n\n**Recommendation:**\n→ Navigate to Audiences module\n→ Add 3-5 segments with key insights\n→ Return here to generate targeted concepts\n\nAlternatively, I can generate generic concepts, but they'll need refinement later.`;
      }

      if (msgLower.includes('variation') || msgLower.includes('generat') || msgLower.includes('suggest')) {
        const existingConcepts = conceptsCtx.items.map(c => c.title).join(', ');
        return `**Concept Variations Based on Your Strategy**\n\n${campaign.smp ? `SMP: "${campaign.smp.slice(0, 80)}..."` : ''}\n${audiences.count > 0 ? `Targeting: ${audiences.segments.slice(0, 3).map(s => s.segment_name).join(', ')}` : ''}\n\n**Video Concepts:**\n1. **"The Moment It Clicks"** (15-30s)\n   • Hook: Problem visualization\n   • Story: Journey to solution\n   • CTA: Discovery-focused\n   • Best for: YouTube, CTV, TikTok\n\n2. **"Before/After Transformation"** (6-15s)\n   • Hook: Pain point callout\n   • Story: Quick proof\n   • CTA: Action-oriented\n   • Best for: Stories, Reels, Shorts\n\n**Static Concepts:**\n3. **"Proof Stack"** (Carousel)\n   • Frame 1: Bold claim\n   • Frames 2-4: Supporting evidence\n   • Frame 5: CTA\n   • Best for: Meta, LinkedIn\n\n4. **"Hero Moment"** (Single Image)\n   • Product in context\n   • Minimal copy, strong visual\n   • Best for: Display, Native\n\n**Production Estimate:** ${audiences.count} segments × 4 concepts = ~${audiences.count * 4} base assets before spec variations.`;
      }

      if (msgLower.includes('align') || msgLower.includes('brief') || msgLower.includes('check')) {
        if (conceptsCtx.count === 0) {
          return `**Brief Alignment Check**\n\n❌ No concepts to evaluate yet.\n\n**Your SMP:** "${campaign.smp || 'Not defined'}"\n\n**Next Steps:**\n1. Use "Generate variations" to create concept ideas\n2. Or manually add concepts via the Concept Builder\n3. Each concept should directly address your SMP\n\n**Quality Standard:** Every concept should answer "How does this deliver the SMP?"`;
        }

        return `**Brief Alignment Analysis** ✓\n\n**SMP:** "${campaign.smp?.slice(0, 100) || 'Not defined'}"\n\n**Concept Audit:**\n${conceptsCtx.items.slice(0, 3).map(c => `• **${c.title}**: ${c.description?.slice(0, 60)}...\n  ${c.description?.toLowerCase().includes(campaign.smp?.toLowerCase().split(' ')[0] || '') ? '✓ Aligns with SMP language' : '⚠️ Consider stronger SMP connection'}`).join('\n\n')}\n\n**Recommendation:** Ensure each concept can complete this sentence:\n"This concept delivers the SMP by showing [specific execution]."\n\n**Downstream Impact:** ${conceptsCtx.count} concepts × ${production.specCount} specs = ~${conceptsCtx.count * production.specCount} potential production jobs.`;
      }

      if (msgLower.includes('visual') || msgLower.includes('style') || msgLower.includes('direction')) {
        return `**Visual Direction Recommendations**\n\n**Based on your brief and industry best practices:**\n\n**Color & Mood:**\n• Lead with brand colors in CTA elements\n• Background should support, not compete\n• Contrast ratio: 4.5:1 minimum for accessibility\n\n**Typography:**\n• Headlines: Bold, 6-10 words max\n• Body: 14px+ for mobile legibility\n• CTA: High contrast, action verbs\n\n**Composition:**\n• Rule of thirds for hero imagery\n• Product placement: right third (Western reading)\n• Safe zones: 10% margin for platform cropping\n\n**Motion (Video):**\n• Hook within first 2 seconds\n• Text animations: 1.5-2s per frame\n• Logo lockup: final 3 seconds\n• Sound-off optimization: subtitles required\n\n**Platform-Specific:**\n• Stories/Reels: Vertical, full bleed\n• Feed: Square performs best\n• CTV: 16:9, larger text for 10-ft viewing`;
      }

      return `**Concept Development Assistant** 🎨\n\nI'm your creative strategy SME. I can help with:\n\n• **Generate variations** based on brief and audiences\n• **Brief alignment check** for strategic fit\n• **Visual direction** recommendations\n• **Format optimization** by platform\n\n**Current State:**\n• Concepts: ${conceptsCtx.count} created\n• Audiences: ${audiences.count} segments (for targeting)\n• Production-ready: ${conceptsCtx.count > 0 ? 'Ready to proceed ✓' : 'Add concepts first'}\n\nWhat would you like to explore?`;
    }

    // ============================================================================
    // PRODUCTION SME AGENT
    // ============================================================================
    if (ctx === 'production') {
      if (workflow.upstreamGaps.length > 0 && msgLower.includes('generat')) {
        return `⚠️ **Upstream Dependencies Check**\n\n${workflow.upstreamGaps.map(g => `• ${g}`).join('\n')}\n\n**Production Best Practice:**\nGenerate production jobs only after:\n1. Brief is complete with clear SMP\n2. Audiences are defined with platform mapping\n3. Concepts are approved for production\n\n**Why this matters:**\n• Prevents rework when strategy changes\n• Ensures proper asset versioning\n• Maintains traceability from brief to deliverable\n\n**Current Readiness:**\n• Brief: ${workflow.briefComplete ? '✓' : '⚠️'}\n• Audiences: ${workflow.audiencesReady ? '✓' : '⚠️'}\n• Concepts: ${workflow.conceptsReady ? '✓' : '⚠️'}`;
      }

      if (msgLower.includes('validate') || msgLower.includes('spec') || msgLower.includes('check')) {
        if (production.jobCount === 0) {
          return `**Production Validation**\n\n❌ No production jobs created yet.\n\n**To generate jobs:**\n1. Select concepts in the Production Matrix\n2. Choose target specs from the library\n3. Click "Generate Production Plan"\n\n**Current Resources:**\n• Specs in library: ${production.specCount}\n• Concepts available: ${conceptsCtx.count}\n• Potential combinations: ${production.specCount * conceptsCtx.count}\n\n**Recommendation:** Start with high-impact placements (Meta, YouTube, CTV) before expanding to full matrix.`;
        }

        const issues: string[] = [];
        if (production.unassigned > 0) issues.push(`${production.unassigned} jobs without assignees`);
        if (production.missingDueDates > 0) issues.push(`${production.missingDueDates} jobs without due dates`);
        if (production.missingDestinations > 0) issues.push(`${production.missingDestinations} jobs without destinations`);

        const statusBreakdown = Object.entries(production.statusBreakdown).map(([status, count]) => `• ${status}: ${count}`).join('\n');

        return `**Production Matrix Validation** ✓\n\n**Summary:** ${production.jobCount} jobs across ${production.specCount} specs\n\n**Status Breakdown:**\n${statusBreakdown}\n\n${issues.length > 0 ? `**Issues to Address:**\n${issues.map(i => `⚠️ ${i}`).join('\n')}\n\n` : '**No critical issues detected** ✓\n\n'}**Spec Validation:**\n• All dimensions appear valid\n• Platform requirements met\n• File type specifications complete\n\n**Downstream:** ${production.jobCount} jobs ready for DCO feed export.\n\n**Industry Benchmark:** Typical ModCon campaigns have 15-40 base assets with 3-5x versioning for DCO.`;
      }

      if (msgLower.includes('timeline') || msgLower.includes('estimate') || msgLower.includes('schedule')) {
        const videoCount = builderJobs.filter(j => j.asset_type === 'video').length;
        const staticCount = builderJobs.filter(j => j.asset_type === 'image' || j.asset_type === 'static').length;
        const h5Count = builderJobs.filter(j => j.asset_type === 'html5' || j.asset_type === 'h5').length;
        
        return `**Production Timeline Estimate**\n\n**Asset Breakdown:**\n• Video: ${videoCount} assets\n• Static: ${staticCount} assets\n• HTML5: ${h5Count} assets\n• Total: ${production.jobCount} production jobs\n\n**Estimated Timeline:**\n\n📅 **Week 1: Creative Development**\n• Video storyboards & scripts\n• Static design mockups\n• Internal review cycle\n\n📅 **Week 2: Production**\n• Video editing & motion\n• Static finalization\n• HTML5 build & testing\n\n📅 **Week 3: QC & Trafficking**\n• Platform-specific QC\n• DCO feed generation\n• Trafficking to ad servers\n\n**Acceleration Options:**\n• Template-based production for static\n• AI-assisted video editing\n• Parallel workstreams by asset type\n\n**Resource Recommendation:**\n• ${videoCount > 5 ? 'Consider external video production partner' : 'In-house video team can handle'}\n• ${staticCount > 20 ? 'Use Celtra/StoryTeq for scale' : 'Standard design workflow'}`;
      }

      if (msgLower.includes('optim') || msgLower.includes('tip') || msgLower.includes('efficiency')) {
        return `**Production Optimization Tips**\n\n**1. Template-Based Scaling**\nFor ${production.jobCount}+ assets, use:\n• Celtra for static versioning\n• StoryTeq for video templates\n• Google Creative Studio for display\n\n**2. Batch Processing**\nGroup jobs by:\n• Asset type (video, static, H5)\n• Aspect ratio (16:9, 1:1, 9:16)\n• Creative concept\n\n**3. Spec Prioritization**\nFocus production order on:\n• High-reach placements first (CTV, YouTube)\n• Core social (Meta, TikTok)\n• Programmatic display last\n\n**4. QC Efficiency**\n• Automated spec validation\n• Platform preview tools\n• Batch approval workflows\n\n**5. DCO Best Practices**\n• Design for modular swapping\n• Plan feed structure early\n• Test with 3 variants before full build\n\n**Your Efficiency Score:** ${production.unassigned === 0 && production.missingDueDates === 0 ? 'High ✓' : 'Medium - address missing assignments/dates'}`;
      }

      return `**Production Operations Assistant** 🏭\n\nI'm your production workflow SME. I can help with:\n\n• **Spec validation** for platform compliance\n• **Timeline estimation** based on asset complexity\n• **Optimization tips** for efficiency at scale\n• **DCO preparation** for feed export\n\n**Current State:**\n• Production Jobs: ${production.jobCount}\n• Specs in Library: ${production.specCount}\n• Unassigned: ${production.unassigned}\n• Status: ${Object.entries(production.statusBreakdown).map(([k, v]) => `${k}:${v}`).join(' | ')}\n\nWhat would you like to explore?`;
    }

    // ============================================================================
    // FEED / DCO SME AGENT
    // ============================================================================
    if (ctx === 'feed') {
      if (!workflow.productionReady && (msgLower.includes('export') || msgLower.includes('generat'))) {
        return `⚠️ **Upstream Gap: No Production Jobs**\n\nFeed export requires completed production jobs.\n\n**Current State:**\n• Production Jobs: ${production.jobCount}\n• Feed Rows: ${workflowCtx.feed.rowCount}\n\n**To proceed:**\n1. Navigate to Production module\n2. Generate production jobs from matrix\n3. Return here to export DCO feed\n\n**Feed Structure Preview:**\nOnce jobs are ready, I can help with:\n• Platform-specific field mapping\n• Validation before export\n• Best practices by DCO platform`;
      }

      if (msgLower.includes('validate') || msgLower.includes('check')) {
        if (workflowCtx.feed.rowCount === 0) {
          return `**Feed Validation**\n\n❌ No feed rows created yet.\n\n**To create feed:**\n1. Ensure production jobs are complete\n2. Use "Generate Feed" or manually add rows\n3. Map fields to DCO platform requirements\n\n**Available for Export:**\n• Production Jobs: ${production.jobCount}\n• Ready for feed: ${builderJobs.filter(j => j.status === 'Approved' || j.status === 'Complete').length}`;
        }

        return `**DCO Feed Validation** ✓\n\n**Summary:** ${workflowCtx.feed.rowCount} feed rows\n\n**Platform Compliance:**\n• Flashtalking: ✓ Dimensions mapped\n• Innovid: ✓ Asset IDs present\n• Celtra: ✓ Component structure valid\n\n**Common Issues Checked:**\n• ✓ No empty required fields\n• ✓ Creative filenames valid\n• ✓ Platform IDs consistent\n\n**Export Readiness:** Ready for DCO platform trafficking\n\n**Recommendation:** Test with 2-3 rows on platform before full upload.`;
      }

      if (msgLower.includes('map') || msgLower.includes('flashtalking') || msgLower.includes('innovid')) {
        return `**DCO Platform Field Mapping**\n\n**Flashtalking/Innovid Required Fields:**\n• \`Placement ID\` → Platform-assigned ID\n• \`Creative ID\` → Your creative identifier\n• \`Dimensions\` → WxH format (300x250)\n• \`Asset URL\` → CDN/DAM path\n• \`Click URL\` → Landing page with macros\n\n**Celtra Specific:**\n• \`Component ID\` → Celtra component ref\n• \`Variant ID\` → Feed variant identifier\n• \`Dynamic Text\` → Text layers to swap\n\n**StoryTeq Specific:**\n• \`Template ID\` → Template reference\n• \`Scene Variables\` → JSON object\n• \`Output Format\` → MP4/MOV/GIF\n\n**Best Practice:**\n• Use consistent naming: \`{Campaign}_{Audience}_{Concept}_{Spec}\`\n• Include fallback values for optional fields\n• Test click macros before trafficking\n\n**Your Mapping Status:** ${workflowCtx.feed.rowCount > 0 ? 'In progress' : 'Not started'}`;
      }

      if (msgLower.includes('best practice') || msgLower.includes('practice')) {
        return `**DCO Feed Best Practices**\n\n**1. Naming Conventions**\n• Pattern: \`{Client}_{Campaign}_{Audience}_{Format}_{Size}\`\n• Example: \`ACME_Q1Launch_Millennials_Video_16x9\`\n• Avoid: spaces, special characters, version numbers in names\n\n**2. Feed Structure**\n• One row per unique creative\n• Separate feeds by platform when field requirements differ\n• Include all variants in single feed for DCO platforms\n\n**3. Asset References**\n• Use CDN URLs, not local paths\n• Include file extensions\n• Validate URLs resolve before export\n\n**4. Dynamic Fields**\n• Mark optional fields with fallbacks\n• Use consistent variable names across rows\n• Document variable logic in notes column\n\n**5. QA Before Trafficking**\n• Export preview first (10 rows max)\n• Validate on platform sandbox\n• Check click tracking macros\n• Verify asset rendering\n\n**6. Version Control**\n• Include date in feed filename\n• Archive previous versions\n• Track changes in revision notes`;
      }

      return `**DCO Feed Assistant** 📊\n\nI'm your DCO trafficking SME. I can help with:\n\n• **Feed validation** before export\n• **Platform mapping** for Flashtalking, Innovid, Celtra, StoryTeq\n• **Best practices** for feed structure and naming\n• **Troubleshooting** common export issues\n\n**Current State:**\n• Feed Rows: ${workflowCtx.feed.rowCount}\n• Production Jobs: ${production.jobCount}\n• Export-ready: ${builderJobs.filter(j => j.status === 'Approved').length}\n\n**Workflow Position:**\nYou're at the final stage! After feed export:\n→ Traffic to DCO platform\n→ QA on staging\n→ Launch 🚀\n\nWhat would you like to explore?`;
    }

    // Default fallback
    return `I'm here to help with the ${ctx} module. Try asking about:\n\n• Validation and reviews\n• Suggestions and recommendations\n• Best practices\n• Workflow status`;
  };

  // Send message to AI Assistant
  const sendAIAssistantMessage = async (message: string) => {
    if (!message.trim() || aiAssistantLoading) return;

    const userMsg: AIAssistantMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setAiAssistantMessages(prev => [...prev, userMsg]);
    setAiAssistantInput('');
    setAiAssistantLoading(true);

    try {
      const ctx = getCurrentModuleContext();
      const workflowCtx = buildWorkflowContext();

      if (demoMode) {
        // Demo mode: Generate SME-level responses
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        
        const demoResponse = ctx ? generateSMEResponse(ctx, message, workflowCtx) : 'Please navigate to a module to get contextual assistance.';

        const assistantMsg: AIAssistantMessage = {
          id: `msg-${Date.now()}-response`,
          role: 'assistant',
          content: demoResponse,
          timestamp: new Date(),
        };
        setAiAssistantMessages(prev => [...prev, assistantMsg]);
      } else {
        // Live mode: call API with enhanced context
        const contextSummary = JSON.stringify(workflowCtx, null, 2);
        const systemPrompt = `You are a ModCon production SME helping with the ${ctx} module. Advisory-only: provide QA, recommendations, and guidance. Do NOT complete, write, or modify any fields; do NOT assume changes have been applied. Understand the full workflow: Brief → Audiences → Concepts → Production → Feed. Be concise and actionable.\n\nContext:\n${contextSummary}`;

        const response = await fetch('/api/brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${systemPrompt}\n\nUser: ${message}`,
            context: { module: ctx, workflow: workflowCtx, advisory_only: true },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const assistantMsg: AIAssistantMessage = {
            id: `msg-${Date.now()}-response`,
            role: 'assistant',
            content: data.response || data.message || generateSMEResponse(ctx!, message, workflowCtx),
            timestamp: new Date(),
          };
          setAiAssistantMessages(prev => [...prev, assistantMsg]);
        } else {
          throw new Error('API error');
        }
      }
    } catch (err) {
      const errorMsg: AIAssistantMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an issue. Please try again.',
        timestamp: new Date(),
      };
      setAiAssistantMessages(prev => [...prev, errorMsg]);
    } finally {
      setAiAssistantLoading(false);
    }
  };

  // Clear AI Assistant messages when switching modules
  useEffect(() => {
    setAiAssistantMessages([]);
  }, [workspaceView]);
  
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
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [ticketCounter, setTicketCounter] = useState(() => loadFromStorage('ticketCounter', 0));
  const [builderLoading, setBuilderLoading] = useState(false);
  
  // Generate ticket number in PROD-YYYY-NNN format
  const generateTicketNumber = useCallback(() => {
    const year = new Date().getFullYear();
    const nextNum = ticketCounter + 1;
    setTicketCounter(nextNum);
    saveToStorage('ticketCounter', nextNum);
    return `PROD-${year}-${String(nextNum).padStart(3, '0')}`;
  }, [ticketCounter]);
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
      { id: 'copy-headline', label: 'Headline', value: 'Lead with benefit; 6-10 words max' },
      { id: 'copy-body', label: 'Body', value: 'Expand on SMP; 2-3 sentences' },
      { id: 'copy-cta', label: 'CTA', value: 'Clear action verb + destination' },
      { id: 'copy-tone', label: 'Tone/Voice', value: 'Reference brief tone guardrails' },
      { id: 'copy-length', label: 'Word count', value: 'Platform-specific (see spec)' },
    ],
    image: [
      { id: 'img-composition', label: 'Composition', value: 'Rule of thirds; product focal point' },
      { id: 'img-subject', label: 'Subject', value: 'Hero product or benefit demonstration' },
      { id: 'img-background', label: 'Background', value: 'Lifestyle context or brand gradient' },
      { id: 'img-text', label: 'Text overlay', value: 'Keep to safe zones; max 20% coverage' },
      { id: 'img-brand', label: 'Brand elements', value: 'Logo placement per brand guidelines' },
    ],
    h5: [
      { id: 'h5-frame1', label: 'Frame 1 (Hook)', value: 'Attention-grabbing visual + headline' },
      { id: 'h5-frame2', label: 'Frame 2 (Value)', value: 'Key benefit or proof point' },
      { id: 'h5-frame3', label: 'Frame 3 (CTA)', value: 'Clear CTA with button styling' },
      { id: 'h5-interaction', label: 'Interaction/CTA', value: 'Click-through to landing page' },
      { id: 'h5-animation', label: 'Animation notes', value: 'Subtle transitions; 15fps max' },
    ],
    video: [
      { id: 'vid-hook', label: 'Hook (0-3s)', value: 'Immediate visual impact; no slow builds' },
      { id: 'vid-beats', label: 'Story beats', value: 'Problem → Solution → Proof → CTA' },
      { id: 'vid-duration', label: 'Duration', value: 'Per platform spec (6s/15s/30s)' },
      { id: 'vid-captions', label: 'Captions', value: 'Burned-in or platform-native; 80%+ watch muted' },
      { id: 'vid-cta', label: 'CTA/End card', value: 'Final 2-3s; logo lockup + destination' },
    ],
    audio: [
      { id: 'aud-script', label: 'Script', value: 'Conversational; match brand voice' },
      { id: 'aud-vo', label: 'VO tone', value: 'Warm/authoritative per brief' },
      { id: 'aud-sfx', label: 'SFX/Music', value: 'Licensed track or brand audio signature' },
      { id: 'aud-cta', label: 'CTA/Tag', value: 'Verbal CTA + brand mention' },
      { id: 'aud-length', label: 'Length', value: '15s/30s/60s per placement' },
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
  const [exportLoadingFormat, setExportLoadingFormat] = useState<'pdf' | 'txt' | 'json' | null>(null);
  const briefFieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const feedEligible = useMemo(
    () => builderJobs.some((j) => j.is_feed) || productionMatrixRows.some((r) => r.is_feed),
    [builderJobs, productionMatrixRows],
  );

  // This would eventually be live-updated from the backend
  const [previewPlan, setPreviewPlan] = useState<any>(() => loadFromStorage('previewPlan', {
    workflow_job_tool: '',
    job_code: '',
    campaign_name: '',
    single_minded_proposition: '',
    primary_audience: '',
    narrative_brief: '',
    content_matrix: [],
  })); 
  // Ensure all matrix rows have an 'id' field for proper tracking
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>(() => {
    return (INITIAL_STRATEGY_MATRIX_RUNNING_SHOES as MatrixRow[]).map((row, index) => {
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
  const [conceptDraftLoading, setConceptDraftLoading] = useState(false);
  const hasAudienceMatrix = matrixRows.length > 0;
  const hasConcepts = concepts.length > 0;
  const hasProductionPlan = productionMatrixRows.length > 0 || builderJobs.length > 0;

  // ============================================================================
  // AUTO QA FUNCTION (defined after all state dependencies)
  // ============================================================================
  const runAutoQA = useCallback((targetModule?: 'brief' | 'audiences' | 'concepts' | 'production' | 'feed') => {
    setQaRunning(true);
    const issues: QAIssue[] = [];
    let issueCounter = 0;
    const addIssue = (issue: Omit<QAIssue, 'id'>) => {
      issueCounter++;
      issues.push({ ...issue, id: `QA-${issueCounter}` });
    };

    // ---- BRIEF MODULE QA ----
    if (!targetModule || targetModule === 'brief') {
      if (!briefState.campaign_name?.trim()) {
        addIssue({
          module: 'brief',
          severity: 'error',
          title: 'Missing campaign name',
          description: 'Every brief needs a campaign name for tracking and reference.',
          action: 'Add a campaign name',
          field: 'campaign_name',
        });
      }

      if (!briefState.smp?.trim() && !briefState.single_minded_proposition?.trim()) {
        addIssue({
          module: 'brief',
          severity: 'error',
          title: 'Missing Single-Minded Proposition',
          description: 'The SMP is the strategic core of your brief.',
          action: 'Define your SMP',
          field: 'smp',
        });
      } else if ((briefState.smp || briefState.single_minded_proposition || '').length < 20) {
        addIssue({
          module: 'brief',
          severity: 'warning',
          title: 'SMP may be too brief',
          description: 'A strong SMP typically needs more context.',
          field: 'smp',
        });
      }

      if (!briefState.audiences?.length && !briefState.primary_audience?.trim()) {
        addIssue({
          module: 'brief',
          severity: 'warning',
          title: 'No audiences defined',
          description: 'Define at least one target audience.',
          action: 'Add audiences',
          field: 'primary_audience',
        });
      }

      if (!briefState.kpis?.length) {
        addIssue({
          module: 'brief',
          severity: 'suggestion',
          title: 'No KPIs specified',
          description: 'Adding measurable KPIs helps align production with business goals.',
          action: 'Add KPIs',
        });
      }
    }

    // ---- AUDIENCES MODULE QA ----
    if (!targetModule || targetModule === 'audiences') {
      if (matrixRows.length === 0) {
        addIssue({
          module: 'audiences',
          severity: 'warning',
          title: 'No audience segments',
          description: 'Add audience segments for targeted content strategy.',
          action: 'Import or create audiences',
        });
      } else {
        const missingNames = matrixRows.filter((r) => !r.segment_name?.trim()).length;
        if (missingNames > 0) {
          addIssue({
            module: 'audiences',
            severity: 'warning',
            title: `${missingNames} segments missing names`,
            description: 'Each audience segment needs a clear name.',
          });
        }
      }
    }

    // ---- CONCEPTS MODULE QA ----
    if (!targetModule || targetModule === 'concepts') {
      if (concepts.length === 0) {
        addIssue({
          module: 'concepts',
          severity: 'warning',
          title: 'No creative concepts',
          description: 'Generate or add creative concepts to proceed.',
          action: 'Generate concepts',
        });
      }
    }

    // ---- PRODUCTION MODULE QA ----
    if (!targetModule || targetModule === 'production') {
      if (builderJobs.length === 0) {
        addIssue({
          module: 'production',
          severity: 'warning',
          title: 'No production jobs',
          description: 'Generate production jobs to start building assets.',
          action: 'Generate production plan',
        });
      } else {
        const unassigned = builderJobs.filter((j) => !j.assignee?.trim()).length;
        if (unassigned > 0) {
          addIssue({
            module: 'production',
            severity: 'suggestion',
            title: `${unassigned} jobs unassigned`,
            description: 'Assign team members for accountability.',
          });
        }

        const noDueDate = builderJobs.filter((j) => !j.due_date).length;
        if (noDueDate > 0) {
          addIssue({
            module: 'production',
            severity: 'suggestion',
            title: `${noDueDate} jobs without due dates`,
            description: 'Set due dates to keep production on schedule.',
          });
        }

        const noDestination = builderJobs.filter((j) => j.missing_destinations || j.destinations.length === 0).length;
        if (noDestination > 0) {
          addIssue({
            module: 'production',
            severity: 'warning',
            title: `${noDestination} jobs without destinations`,
            description: 'Jobs need destinations for final specs.',
          });
        }
      }

      if (specs.length === 0) {
        addIssue({
          module: 'production',
          severity: 'warning',
          title: 'No specs in library',
          description: 'Add specs or import a media plan.',
        });
      }
    }

    // ---- FEED MODULE QA ----
    if (!targetModule || targetModule === 'feed') {
      if (feedRows.length === 0 && builderJobs.length > 0) {
        addIssue({
          module: 'feed',
          severity: 'suggestion',
          title: 'No feed rows created',
          description: 'Create feed rows for DCO platform export.',
        });
      }
    }

    setQaResults(issues);
    setQaRunning(false);
    setLastQaRun(new Date().toLocaleTimeString());
    setShowQaPanel(true);
  }, [briefState, matrixRows, concepts, builderJobs, specs, feedRows]);

  const workspaceGuidance = (() => {
    switch (workspaceView) {
      case 'brief':
        return {
          title: 'Briefing',
          body: 'Capture campaign goal, SMP, audience, and proof points to unlock downstream planning.',
          actionLabel: 'Review quality gaps',
          action: () => setShowQualityDetails(true),
          disabled: false,
        };
      case 'matrix':
        return {
          title: 'Audience Map',
          body: 'Add segments, insights, triggers, and platform environments so concepts can map cleanly.',
          actionLabel: 'Import audience CSV',
          action: openAudienceFilePicker,
          disabled: false,
        };
      case 'concepts':
        return {
          title: 'Concept Canvas',
          body: 'Draft concepts from the brief or upload media, then map them to audience rows.',
          actionLabel: conceptDraftLoading ? 'Drafting...' : 'Draft from brief',
          action: draftConceptsFromBrief,
          disabled: conceptDraftLoading,
        };
      case 'production':
        return {
          title: 'Production Plan',
          body: 'Generate build-ready jobs from concepts, specs, and destinations.',
          actionLabel: productionLoading ? 'Generating...' : 'Generate production plan',
          action: generateProductionPlan,
          disabled: productionLoading,
        };
      case 'feed':
        return {
          title: 'Content Feed',
          body: 'Map fields and validate output before exporting to downstream platforms.',
          actionLabel: 'Open feed mapping',
          action: () => {
            setShowFeedMapping(true);
            setShowFeedSourceFields(true);
          },
          disabled: false,
        };
      default:
        return null;
    }
  })();

  const resolveBriefFieldKey = (gap: string) => {
    const normalized = gap.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const direct = briefFields.find((f) => f.key.toLowerCase() === gap.toLowerCase());
    if (direct) return direct.key;
    const byLabel = briefFields.find(
      (f) => f.label && f.label.toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized,
    );
    if (byLabel) return byLabel.key;
    const byKey = briefFields.find(
      (f) => f.key && f.key.toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized,
    );
    return byKey?.key;
  };

  const focusBriefField = (key: string) => {
    const node = briefFieldRefs.current[key];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.focus();
      toastInfo('Jumped to field', 'Complete the highlighted brief input.');
    }
  };

  const addActivity = (message: string) => {
    setActivityLog((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, message, time: new Date().toLocaleTimeString() },
      ...prev,
    ].slice(0, 6));
  };

  const briefFieldHints: Record<string, string> = {
    campaign_name: 'Name the campaign and timeframe so production can label outputs.',
    single_minded_proposition: 'Use a single sentence: core benefit + proof + target audience.',
    primary_audience: 'Describe the primary segment and why they care.',
    narrative_brief: 'Summarize the story arc, proof, and tone in 3–5 sentences.',
    objective: 'State the business outcome (e.g., trials, purchases, demos).',
    kpis: 'List measurable outcomes (CTR, conversions, bookings, ROAS).',
    known_constraints: 'Add mandatories, legal constraints, or asset limitations.',
  };

  const clampScore = (value: number) => Math.min(10, Math.max(1, Math.round(value)));

  const computeMatrixScore = () => {
    if (!matrixRows.length) return 1;
    const required = ['segment_name', 'platform_environments', 'key_insight'];
    const filled = matrixRows.reduce((acc, row) => {
      const score = required.reduce((sum, key) => sum + (row[key] ? 1 : 0), 0);
      return acc + score / required.length;
    }, 0);
    return clampScore((filled / matrixRows.length) * 10);
  };

  const computeConceptScore = () => {
    if (!concepts.length) return 1;
    const filled = concepts.reduce((acc, concept) => {
      const score = [
        concept.title ? 1 : 0,
        concept.description ? 1 : 0,
        concept.audienceLineIds && concept.audienceLineIds.length ? 1 : 0,
      ].reduce((sum, v) => sum + v, 0) / 3;
      return acc + score;
    }, 0);
    return clampScore((filled / concepts.length) * 10);
  };

  const computeProductionScore = () => {
    if (!builderJobs.length) return 1;
    const filled = builderJobs.reduce((acc, job) => {
      const score = [
        job.destinations && job.destinations.length ? 1 : 0,
        job.technical_summary ? 1 : 0,
      ].reduce((sum, v) => sum + v, 0) / 2;
      return acc + score;
    }, 0);
    return clampScore((filled / builderJobs.length) * 10);
  };

  const computeFeedScore = () => {
    if (!feedRows.length) return 1;
    const mappingCount = feedFieldMappings.filter((m) => m.platform === feedMappingPlatform).length;
    const base = Math.min(1, mappingCount / Math.max(1, destinationFieldLibrary.length));
    return clampScore((base + 0.5) * 10);
  };

  const moduleAssistant = (() => {
    const gapList = (briefQualityGaps.length ? briefQualityGaps : briefCompletionGaps).slice(0, 4);
    if (workspaceView === 'brief') {
      return {
        title: 'Brief',
        score: currentScore || 1,
        completionNote: isProductionReady ? 'Brief is production-ready.' : 'Strengthen the brief to unlock production.',
        tips: gapList.length ? gapList : ['Add proof points', 'Clarify audience triggers', 'Define CTA'],
        dataFlowNote: 'Brief inputs shape the audience matrix, which drives concepts, production jobs, and the final feed.',
      };
    }
    if (workspaceView === 'matrix') {
      return {
        title: 'Audience Matrix',
        score: computeMatrixScore(),
        completionNote: matrixRows.length ? `${matrixRows.length} audience rows mapped.` : 'Add audience rows to start.',
        tips: ['Add segment insight', 'Add platform environments', 'Add triggers'],
        dataFlowNote: 'Audience rows become targets for concepts and production destinations.',
      };
    }
    if (workspaceView === 'concepts') {
      return {
        title: 'Concepts',
        score: computeConceptScore(),
        completionNote: concepts.length ? `${concepts.length} concepts captured.` : 'Draft or upload concepts.',
        tips: ['Map to audience rows', 'Add visual description', 'Define asset type'],
        dataFlowNote: 'Concepts drive production jobs and populate feed variants.',
      };
    }
    if (workspaceView === 'production') {
      return {
        title: 'Production',
        score: computeProductionScore(),
        completionNote: builderJobs.length ? `${builderJobs.length} jobs ready for build.` : 'Generate a production plan.',
        tips: ['Confirm specs', 'Add requirements', 'Set status'],
        dataFlowNote: 'Production outputs feed into the final content feed export.',
      };
    }
    return {
      title: 'Content Feed',
      score: computeFeedScore(),
      completionNote: feedRows.length ? `${feedRows.length} feed rows mapped.` : 'Add feed rows and mappings.',
      tips: ['Map fields', 'Validate destination formats', 'Export feed'],
      dataFlowNote: 'Feed uses production outputs and audience mappings for activation.',
    };
  })();
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

  // Handle client-side mounting to avoid hydration mismatches with localStorage values
  useEffect(() => {
    setMounted(true);
    const storedDemoMode = loadFromStorage('demoMode', false);
    setDemoMode(storedDemoMode);
  }, []);

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

  // ============================================================================
  // DCO PLATFORM EXPORT FUNCTIONS
  // ============================================================================
  
  const [showDcoExport, setShowDcoExport] = useState(false);
  const [dcoExportPlatform, setDcoExportPlatform] = useState<'flashtalking' | 'innovid' | 'celtra' | 'storyteq'>('flashtalking');
  const [dcoExportValidation, setDcoExportValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] }>({ valid: true, errors: [], warnings: [] });

  // Validate production jobs for DCO export
  const validateDcoExport = (platform: string): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (builderJobs.length === 0) {
      errors.push('No production jobs to export. Generate a production plan first.');
      return { valid: false, errors, warnings };
    }

    builderJobs.forEach((job, idx) => {
      const jobRef = job.ticket_number || `Job ${idx + 1}`;
      
      // Check required fields
      if (!job.creative_concept) errors.push(`${jobRef}: Missing creative concept name.`);
      if (!job.asset_type) errors.push(`${jobRef}: Missing asset type.`);
      if (job.destinations.length === 0) warnings.push(`${jobRef}: No destinations specified.`);
      if (!job.technical_summary || job.technical_summary.includes('Spec not set')) {
        warnings.push(`${jobRef}: Spec not fully defined.`);
      }

      // Platform-specific validation
      if (platform === 'flashtalking' || platform === 'innovid') {
        if (job.asset_type === 'video' && !job.technical_summary.includes('x')) {
          warnings.push(`${jobRef}: Video assets should have dimensions specified.`);
        }
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  };

  // Export to Flashtalking CSV format
  const exportFlashtalkingCsv = () => {
    const campaignName = briefState.campaign_name || 'Campaign';
    const now = new Date().toISOString().split('T')[0];
    
    // Flashtalking CSV headers (standard feed format)
    const headers = [
      'Ad Name',
      'Concept ID',
      'Creative Type',
      'Width',
      'Height',
      'Duration',
      'Platform',
      'Placement',
      'Targeting',
      'Click URL',
      'Impression Tracking',
      'Ticket Number',
      'Status',
      'Priority',
      'Assignee',
      'Due Date',
      'Notes',
    ];

    const rows = builderJobs.map((job) => {
      // Parse dimensions from technical summary
      const dimMatch = job.technical_summary.match(/(\d+)x(\d+)/);
      const width = dimMatch ? dimMatch[1] : '';
      const height = dimMatch ? dimMatch[2] : '';
      const durMatch = job.technical_summary.match(/(\d+)s/);
      const duration = durMatch ? durMatch[1] : '';

      return [
        `${campaignName}_${job.creative_concept}_${job.asset_type}`,
        job.job_id,
        job.asset_type.toUpperCase(),
        width,
        height,
        duration,
        job.destinations.map(d => d.platform_name).join('; '),
        job.destinations.map(d => d.format_name).join('; '),
        job.destinations.map(d => d.special_notes).filter(Boolean).join('; '),
        '', // Click URL - to be filled
        '', // Impression Tracking - to be filled
        job.ticket_number || '',
        job.status,
        job.priority || 'medium',
        job.assignee || '',
        job.due_date || '',
        job.destinations.map(d => d.special_notes).filter(Boolean).join('; '),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashtalking_feed_${campaignName.replace(/\s+/g, '_')}_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess('Flashtalking export complete', `Exported ${builderJobs.length} assets to CSV.`);
    setShowDcoExport(false);
  };

  // Export to Innovid JSON format
  const exportInnovidJson = () => {
    const campaignName = briefState.campaign_name || 'Campaign';
    const now = new Date().toISOString();
    
    const innovidPayload = {
      meta: {
        campaign_name: campaignName,
        exported_at: now,
        source: 'ModCon Planning Tool',
        version: '1.0',
      },
      creatives: builderJobs.map((job) => {
        // Parse dimensions
        const dimMatch = job.technical_summary.match(/(\d+)x(\d+)/);
        const durMatch = job.technical_summary.match(/(\d+)s/);
        
        return {
          creative_id: job.job_id,
          ticket_number: job.ticket_number,
          name: `${campaignName}_${job.creative_concept}_${job.asset_type}`,
          type: job.asset_type,
          dimensions: dimMatch ? { width: parseInt(dimMatch[1], 10), height: parseInt(dimMatch[2], 10) } : null,
          duration: durMatch ? parseInt(durMatch[1], 10) : null,
          placements: job.destinations.map(d => ({
            platform: d.platform_name,
            format: d.format_name,
            spec_id: d.spec_id,
            notes: d.special_notes,
          })),
          workflow: {
            status: job.status,
            priority: job.priority || 'medium',
            assignee: job.assignee || null,
            due_date: job.due_date || null,
            revision: job.revision_number || 1,
          },
          approval: {
            status: job.approval_status || 'pending',
            approver: job.approver || null,
            approved_at: job.approved_at || null,
            comments: job.approval_comments || null,
          },
          tracking: {
            click_url: null, // To be filled
            impression_url: null, // To be filled
            beacon_urls: [],
          },
        };
      }),
    };

    const jsonContent = JSON.stringify(innovidPayload, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `innovid_feed_${campaignName.replace(/\s+/g, '_')}_${now.split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess('Innovid export complete', `Exported ${builderJobs.length} creatives to JSON.`);
    setShowDcoExport(false);
  };

  // Export to Celtra format
  const exportCeltraJson = () => {
    const campaignName = briefState.campaign_name || 'Campaign';
    const now = new Date().toISOString();
    
    const celtraPayload = {
      campaign: {
        name: campaignName,
        created: now,
      },
      creatives: builderJobs.map((job) => {
        const dimMatch = job.technical_summary.match(/(\d+)x(\d+)/);
        return {
          id: job.job_id,
          name: job.creative_concept,
          type: job.asset_type,
          size: dimMatch ? `${dimMatch[1]}x${dimMatch[2]}` : 'responsive',
          variants: job.destinations.map(d => ({
            platform: d.platform_name,
            placement: d.format_name,
          })),
          status: job.status,
          ticket: job.ticket_number,
        };
      }),
    };

    const jsonContent = JSON.stringify(celtraPayload, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celtra_feed_${campaignName.replace(/\s+/g, '_')}_${now.split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess('Celtra export complete', `Exported ${builderJobs.length} creatives.`);
    setShowDcoExport(false);
  };

  // Export to StoryTeq format
  const exportStorytTeqCsv = () => {
    const campaignName = briefState.campaign_name || 'Campaign';
    const now = new Date().toISOString().split('T')[0];
    
    // StoryTeq CSV format
    const headers = ['creative_name', 'template_id', 'size', 'platform', 'headline', 'body', 'cta', 'image_url', 'video_url', 'status', 'ticket'];
    
    const rows = builderJobs.map((job) => {
      const dimMatch = job.technical_summary.match(/(\d+)x(\d+)/);
      const size = dimMatch ? `${dimMatch[1]}x${dimMatch[2]}` : '';
      
      return [
        `${campaignName}_${job.creative_concept}`,
        job.template_id || '',
        size,
        job.destinations.map(d => d.platform_name).join('; '),
        '', // headline - to be filled
        '', // body - to be filled
        '', // cta - to be filled
        '', // image_url - to be filled
        '', // video_url - to be filled
        job.status,
        job.ticket_number || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyteq_feed_${campaignName.replace(/\s+/g, '_')}_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess('StoryTeq export complete', `Exported ${builderJobs.length} creatives.`);
    setShowDcoExport(false);
  };

  const handleDcoExport = () => {
    const validation = validateDcoExport(dcoExportPlatform);
    setDcoExportValidation(validation);
    
    if (!validation.valid) {
      return; // Show errors in modal
    }

    switch (dcoExportPlatform) {
      case 'flashtalking':
        exportFlashtalkingCsv();
        break;
      case 'innovid':
        exportInnovidJson();
        break;
      case 'celtra':
        exportCeltraJson();
        break;
      case 'storyteq':
        exportStorytTeqCsv();
        break;
    }
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
        
        // Apply any extracted brief fields from the AI response
        if (data.extracted_fields && typeof data.extracted_fields === 'object') {
          const extracted = data.extracted_fields as Record<string, string>;
          if (Object.keys(extracted).length > 0) {
            // Update briefState with extracted values
            setBriefState((prev) => ({
              ...prev,
              ...(extracted.campaign_name && { campaign_name: extracted.campaign_name }),
              ...(extracted.smp && { smp: extracted.smp }),
              ...(extracted.primary_audience && { audiences: [extracted.primary_audience, ...(prev.audiences?.slice(1) || [])] }),
            }));
            
            // Update previewPlan with extracted values
            setPreviewPlan((prev: any) => ({
              ...prev,
              ...(extracted.campaign_name && { campaign_name: extracted.campaign_name }),
              ...(extracted.smp && { single_minded_proposition: extracted.smp }),
              ...(extracted.primary_audience && { primary_audience: extracted.primary_audience }),
              ...(extracted.objective && { objective: extracted.objective }),
            }));
          }
        }
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

        addActivity(`Uploaded audience matrix (${file.name})`);
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

          addActivity(`Uploaded audience matrix (${data.filename})`);
          await sendMessage(userMessage);
        } else {
          const preview = (data.content || '').substring(0, 200);
          const userMessage = `I just uploaded a file named "${data.filename}". Content preview: ${preview}...`;
          addActivity(`Uploaded file (${data.filename})`);
          await sendMessage(userMessage);
        }
      }
    } catch (error) {
      console.error("Upload failed", error);
      if (!demoMode) {
        toastError('Upload failed', 'Failed to upload file.');
      }
      setLoading(false);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadExport = async (format: 'pdf' | 'txt' | 'json') => {
    setExportLoadingFormat(format);
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
        // Enhanced JSON export with metadata
        const exportData = {
          _metadata: {
            exported_at: new Date().toISOString(),
            version: '1.0',
            tool: 'ModCon Planning Tool',
          },
          brief: {
            campaign_name: planToSend.campaign_name || 'Untitled',
            single_minded_proposition: planToSend.single_minded_proposition || null,
            primary_audience: planToSend.primary_audience || null,
            objective: planToSend.objective || null,
            narrative_brief: planToSend.narrative_brief || null,
            kpis: planToSend.kpis || [],
            known_constraints: planToSend.known_constraints || [],
          },
          workflow: {
            job_tool: planToSend.workflow_job_tool || null,
            job_code: planToSend.job_code || null,
          },
          content_matrix: planToSend.content_matrix || [],
          concepts: planToSend.concepts || [],
          quality_metrics: {
            completion_score: briefCompletionScore,
            quality_score: briefQualityScore,
            gaps: briefQualityGaps,
          },
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        const safeName = (planToSend.campaign_name || 'brief').replace(/[^a-zA-Z0-9]/g, '_');
        a.download = `${safeName}_${timestamp}.json`;
        a.click();
        toastSuccess('Export Complete', 'Brief exported as JSON');
      addActivity('Exported brief (JSON)');
        setExportLoadingFormat(null);
        return;
    }

    // In demo mode, generate a simple text export client-side for TXT/PDF
    if (demoMode) {
      const lines: string[] = [];
      const divider = '═'.repeat(60);
      const sectionDivider = '─'.repeat(40);
      
      // Header
      lines.push(divider);
      lines.push(`  INTELLIGENT CONTENT BRIEF`);
      lines.push(`  ${planToSend.campaign_name ?? 'Untitled Campaign'}`);
      lines.push(divider);
      lines.push('');
      lines.push(`Exported: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);
      lines.push('');
      
      // Workflow Info
      if (planToSend.workflow_job_tool || planToSend.job_code) {
        lines.push('📋 WORKFLOW ADMINISTRATION');
        lines.push(sectionDivider);
        if (planToSend.workflow_job_tool) {
          lines.push(`   Tool:     ${planToSend.workflow_job_tool}`);
        }
        if (planToSend.job_code) {
          lines.push(`   Job Code: ${planToSend.job_code}`);
        }
        lines.push('');
      }
      
      // Brief Fields
      lines.push('📝 BRIEF FIELDS');
      lines.push(sectionDivider);
      lines.push(`   Campaign Name:  ${planToSend.campaign_name ?? 'Not specified'}`);
      lines.push(`   SMP:            ${planToSend.single_minded_proposition ?? 'Not specified'}`);
      lines.push(`   Primary Audience: ${planToSend.primary_audience ?? 'Not specified'}`);
      lines.push(`   Objective:      ${planToSend.objective ?? 'Not specified'}`);
      lines.push('');
      
      // Quality Score
      if (briefQualityScore || briefCompletionScore) {
        lines.push('📊 QUALITY METRICS');
        lines.push(sectionDivider);
        if (briefQualityScore) lines.push(`   Quality Score:     ${briefQualityScore.toFixed(1)}/10`);
        if (briefCompletionScore) lines.push(`   Completion Score:  ${briefCompletionScore.toFixed(1)}/10`);
        if (briefQualityGaps.length > 0) {
          lines.push(`   Gaps:              ${briefQualityGaps.join(', ')}`);
        }
        lines.push('');
      }
      
      // Narrative Brief
      if (planToSend.narrative_brief) {
        lines.push('📖 NARRATIVE BRIEF');
        lines.push(sectionDivider);
        lines.push(planToSend.narrative_brief.split('\n').map((l: string) => `   ${l}`).join('\n'));
        lines.push('');
      }
      
      // Strategy Matrix
      if (planToSend.content_matrix && planToSend.content_matrix.length > 0) {
        lines.push('🎯 CONTENT MATRIX');
        lines.push(sectionDivider);
        (planToSend.content_matrix || []).forEach((row: any, idx: number) => {
          lines.push(`   ${idx + 1}. ${row.audience_segment || 'All'} → ${row.channel || 'TBD'}`);
          lines.push(`      Stage: ${row.funnel_stage || 'N/A'} | Format: ${row.format || 'N/A'}`);
          if (row.message) lines.push(`      Message: ${row.message}`);
          lines.push('');
        });
      }
      
      // Concepts
      if (planToSend.concepts && planToSend.concepts.length > 0) {
        lines.push('💡 CREATIVE CONCEPTS');
        lines.push(sectionDivider);
        (planToSend.concepts || []).forEach((c: any, idx: number) => {
          lines.push(`   ${idx + 1}. ${c.title || 'Untitled Concept'}`);
          if (c.description) lines.push(`      ${c.description}`);
          lines.push('');
        });
      }
      
      // Footer
      lines.push(divider);
      lines.push('  Generated by ModCon Planning Tool');
      lines.push(divider);
      
      const text = lines.join('\n') + '\n';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/plain';
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      const safeName = (planToSend.campaign_name || 'brief').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `${safeName}_${timestamp}.${format}`;
      a.click();
      toastSuccess('Export Complete', `Brief exported as ${format.toUpperCase()}`);
        addActivity(`Exported brief (${format.toUpperCase()})`);
      setExportLoadingFormat(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planToSend }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `Export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief.${format}`;
      a.click();
      toastSuccess('Export Complete', `Brief exported as ${format.toUpperCase()}`);
      addActivity(`Exported brief (${format.toUpperCase()})`);
    } catch (error) {
      console.error("Export failed", error);
      const message = error instanceof Error ? error.message : 'Export failed';
      toastError('Export failed', message);
    } finally {
      setExportLoadingFormat(null);
    }
  };

  const switchWorkspace = (view: 'brief' | 'matrix' | 'concepts' | 'production' | 'feed') => {
    if ((view === 'production' || view === 'feed') && !isProductionReady) {
      toastWarning(
        'Brief not production-ready',
        `Reach ${PRODUCTION_READY_THRESHOLD}/10 before moving to ${view === 'production' ? 'Production' : 'Feed'}.`,
      );
      return;
    }

    if (view === 'concepts' && matrixRows.length === 0) {
      toastWarning('Missing audience matrix', 'Add at least one audience row before concepting.');
      setWorkspaceView('matrix');
      return;
    }

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
      toastError(`Generation failed`, `Failed to generate ${concept.kind}: ${errorMessage}`);
    }
  }

  async function draftConceptsFromBrief() {
    setConceptDraftLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/concepts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: briefState }),
      });
      if (!res.ok) {
        const message = await res.text();
        console.error('Failed to draft concepts from brief', message);
        toastError('Drafting failed', message || 'Unable to draft concepts from brief.');
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
        if (mapped.length) {
          toastSuccess('Concepts drafted', `${mapped.length} new concepts added to the canvas.`);
          addActivity(`Drafted ${mapped.length} concepts from brief`);
        }
        return [...prev, ...mapped];
      });
    } catch (e) {
      console.error('Error calling /concepts/generate', e);
      toastError('Drafting failed', 'Unable to draft concepts. Please try again.');
    } finally {
      setConceptDraftLoading(false);
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
      
      // Use campaign name from brief for demo assets
      const campaignName = briefState.campaign_name || demoConcept?.title || 'Campaign';
      const now = new Date().toISOString();
      
      // Also populate builderJobs so the board displays the assets
      let localTicketCounter = ticketCounter;
      const demoBuilderJobs: ProductionJobRow[] = demoAssets.map((asset, idx) => {
        localTicketCounter += 1;
        const ticketNum = `PROD-${new Date().getFullYear()}-${String(localTicketCounter).padStart(3, '0')}`;
        return {
          job_id: asset.id,
          ticket_number: ticketNum,
          creative_concept: campaignName,
          asset_type: asset.asset_type || 'video',
          destinations: [{
            platform_name: asset.platform,
            spec_id: asset.spec_details?.id || '',
            format_name: asset.placement,
            special_notes: asset.visual_directive || '',
            max_duration_seconds: asset.spec_details?.max_duration,
            dimensions: asset.spec_dimensions,
            aspect_ratio: asset.spec_details?.aspect_ratio,
          }],
          technical_summary: `${asset.spec_dimensions} ${asset.spec_details?.format_name || asset.asset_type}`,
          status: asset.status || 'Pending',
          priority: idx === 0 ? 'high' : 'medium',
          approval_status: 'pending' as const,
          revision_number: 1,
          created_at: now,
          updated_at: now,
          is_feed: false,
          // NEW: Brief context for traceability
          campaign_name: briefState.campaign_name || campaignName,
          single_minded_proposition: briefState.single_minded_proposition || '',
          // NEW: Production engineering fields
          production_notes: `SAFE ZONE GUIDANCE:\n• ${asset.platform} (${asset.placement}): Keep text/logo clear of UI chrome; respect safe zones.\n• Standard safe zones apply across all destinations.`,
          // Only set duration for video assets
          max_duration_seconds: (asset.asset_type === 'video') ? (asset.spec_details?.max_duration || 15) : undefined,
          // Correct file format based on asset type
          file_format: asset.asset_type === 'video' ? 'MP4' : (asset.asset_type === 'html5' ? 'HTML5' : 'JPG/PNG'),
          codec: asset.asset_type === 'video' ? 'H.264' : undefined,
          audio_spec: asset.asset_type === 'video' ? 'Sound on recommended; ensure captions for accessibility' : undefined,
          frame_rate: asset.asset_type === 'video' ? '30fps' : undefined,
          requires_subtitles: asset.asset_type === 'video',
          // File size limit for display assets
          file_size_limit_mb: (asset.asset_type === 'html5' || asset.asset_type === 'image') ? 150 : undefined,
          round_label: 'R1',
          version_tag: 'v1',
        };
      });
      setTicketCounter(localTicketCounter);
      saveToStorage('ticketCounter', localTicketCounter);
      setBuilderJobs(demoBuilderJobs);
      addActivity(`Production plan generated (demo, ${demoBuilderJobs.length} jobs)`);
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
      
      // Also populate builderJobs from the returned assets
      const assets = data.assets || [];
      if (assets.length > 0) {
        const now = new Date().toISOString();
        let localTicketCounter = ticketCounter;
        const jobs: ProductionJobRow[] = assets.map((asset: ProductionAsset, idx: number) => {
          localTicketCounter += 1;
          const ticketNum = `PROD-${new Date().getFullYear()}-${String(localTicketCounter).padStart(3, '0')}`;
          return {
            job_id: asset.id,
            ticket_number: ticketNum,
            creative_concept: conceptPayload.name,
            asset_type: asset.asset_type || 'video',
            destinations: [{
              platform_name: asset.platform,
              spec_id: asset.spec_details?.id || '',
              format_name: asset.placement,
              special_notes: asset.visual_directive || '',
              max_duration_seconds: asset.spec_details?.max_duration,
              dimensions: asset.spec_dimensions,
              aspect_ratio: asset.spec_details?.aspect_ratio,
            }],
            technical_summary: `${asset.spec_dimensions} ${asset.spec_details?.format_name || asset.asset_type}`,
            status: asset.status || 'Pending',
            priority: idx === 0 ? 'high' : 'medium',
            approval_status: 'pending' as const,
            revision_number: 1,
            created_at: now,
            updated_at: now,
            is_feed: false,
            // NEW: Brief context for traceability
            campaign_name: briefState.campaign_name || '',
            single_minded_proposition: briefState.single_minded_proposition || '',
            // NEW: Production engineering fields
            production_notes: `SAFE ZONE GUIDANCE:\n• ${asset.platform} (${asset.placement}): ${asset.spec_details?.safe_zone || 'Standard safe zones apply.'}\n`,
            // Only set duration for video assets
            max_duration_seconds: (asset.asset_type === 'video') ? asset.spec_details?.max_duration : undefined,
            // Correct file format based on asset type
            file_format: asset.asset_type === 'video' ? 'MP4' : (asset.asset_type === 'html5' ? 'HTML5' : 'JPG/PNG'),
            codec: asset.asset_type === 'video' ? 'H.264' : undefined,
            audio_spec: asset.asset_type === 'video' ? 'Sound on recommended; ensure captions for accessibility' : undefined,
            frame_rate: asset.asset_type === 'video' ? '30fps' : undefined,
            requires_subtitles: asset.asset_type === 'video',
            // File size limit for display assets
            file_size_limit_mb: (asset.asset_type === 'html5' || asset.asset_type === 'image') ? 150 : undefined,
            round_label: 'R1',
            version_tag: 'v1',
          };
        });
        setTicketCounter(localTicketCounter);
        saveToStorage('ticketCounter', localTicketCounter);
        setBuilderJobs(jobs);
        addActivity(`Production plan generated (${jobs.length} jobs)`);
      }
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
    // Check for direct match first
    let fromLibrary = requirementsLibrary[type];
    // Fallback: check common aliases
    if (!fromLibrary || !fromLibrary.length) {
      if (type === 'html5' || type === 'display') {
        fromLibrary = requirementsLibrary['h5'];
      }
    }
    if (fromLibrary && fromLibrary.length) return fromLibrary;
    // Default for static/image assets
    return [
      { id: 'composition', label: 'Composition', value: 'Rule of thirds; product focal point' },
      { id: 'subject', label: 'Subject', value: 'Hero product or benefit demonstration' },
      { id: 'background', label: 'Background', value: 'Lifestyle context or brand gradient' },
    ];
  };

  // Platform validation for production assets
  type PlatformWarning = {
    type: 'error' | 'warning' | 'info';
    message: string;
  };

  const validatePlatformSpec = (job: ProductionJobRow): PlatformWarning[] => {
    const warnings: PlatformWarning[] = [];
    const assetType = (job.asset_type || '').toLowerCase();
    const summary = (job.technical_summary || '').toLowerCase();
    
    // Check for missing destinations
    if (!job.destinations.length) {
      warnings.push({ type: 'warning', message: 'No destination platform selected' });
    }
    
    // Platform-specific validations
    job.destinations.forEach((dest) => {
      const platform = (dest.platform_name || '').toLowerCase();
      const format = (dest.format_name || '').toLowerCase();
      
      // TikTok validations
      if (platform.includes('tiktok')) {
        if (assetType !== 'video') {
          warnings.push({ type: 'error', message: 'TikTok requires video content' });
        }
        if (!summary.includes('9:16') && !summary.includes('1080x1920')) {
          warnings.push({ type: 'warning', message: 'TikTok performs best with 9:16 vertical video' });
        }
      }
      
      // YouTube Shorts validations
      if (platform.includes('youtube') && format.includes('short')) {
        if (!summary.includes('9:16') && !summary.includes('1080x1920')) {
          warnings.push({ type: 'warning', message: 'YouTube Shorts require 9:16 vertical format' });
        }
      }
      
      // Meta Stories/Reels validations
      if (platform.includes('meta') && (format.includes('stor') || format.includes('reel'))) {
        if (!summary.includes('9:16') && !summary.includes('1080x1920')) {
          warnings.push({ type: 'warning', message: 'Stories/Reels perform best in 9:16 vertical' });
        }
      }
      
      // LinkedIn validations
      if (platform.includes('linkedin')) {
        if (assetType === 'video' && !summary.includes('1:1') && !summary.includes('16:9')) {
          warnings.push({ type: 'info', message: 'LinkedIn video supports 1:1 or 16:9 aspect ratios' });
        }
      }
      
      // Display validations
      if (platform.includes('display') || platform.includes('dv360')) {
        if (assetType === 'video' && !summary.includes('html5')) {
          warnings.push({ type: 'info', message: 'Display ads typically use HTML5 or static images' });
        }
      }
    });
    
    // Check for missing assignee on high/urgent priority
    if ((job.priority === 'high' || job.priority === 'urgent') && !job.assignee) {
      warnings.push({ type: 'warning', message: 'High priority asset without assignee' });
    }
    
    // Check for missing due date
    if (job.priority === 'urgent' && !job.due_date) {
      warnings.push({ type: 'warning', message: 'Urgent asset without due date' });
    }
    
    return warnings;
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

  const updateJobAssignee = (jobId: string, assignee: string) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, assignee } : job)));
  };

  const updateJobDueDate = (jobId: string, due_date: string) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, due_date } : job)));
  };

  const updateJobPriority = (jobId: string, priority: 'low' | 'medium' | 'high' | 'urgent') => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, priority } : job)));
  };

  const updateJobApprovalStatus = (jobId: string, approval_status: 'pending' | 'submitted' | 'approved' | 'revision_requested' | 'rejected') => {
    const now = new Date().toISOString();
    setBuilderJobs((prev) => prev.map((job) => {
      if (job.job_id !== jobId) return job;
      const updates: Partial<ProductionJobRow> = { approval_status, updated_at: now };
      if (approval_status === 'approved') updates.approved_at = now;
      if (approval_status === 'revision_requested') updates.revision_number = (job.revision_number || 1) + 1;
      return { ...job, ...updates };
    }));
  };

  const updateJobReviewer = (jobId: string, reviewer: string) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, reviewer, updated_at: new Date().toISOString() } : job)));
  };

  const updateJobApprover = (jobId: string, approver: string) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, approver, updated_at: new Date().toISOString() } : job)));
  };

  const updateJobApprovalComments = (jobId: string, approval_comments: string) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, approval_comments, updated_at: new Date().toISOString() } : job)));
  };

  const updateJobCostEstimate = (jobId: string, cost_estimate: number) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, cost_estimate, updated_at: new Date().toISOString() } : job)));
  };

  const updateJobEstimatedHours = (jobId: string, estimated_hours: number) => {
    setBuilderJobs((prev) => prev.map((job) => (job.job_id === jobId ? { ...job, estimated_hours, updated_at: new Date().toISOString() } : job)));
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const selectAllJobs = () => {
    setSelectedJobIds(new Set(builderJobs.map((job) => job.job_id)));
  };

  const clearJobSelection = () => {
    setSelectedJobIds(new Set());
  };

  const bulkUpdateStatus = (status: 'Pending' | 'In_Progress' | 'Review' | 'Approved') => {
    setBuilderJobs((prev) =>
      prev.map((job) => (selectedJobIds.has(job.job_id) ? { ...job, status } : job))
    );
    toastSuccess('Status updated', `${selectedJobIds.size} jobs updated to ${status === 'In_Progress' ? 'In Progress' : status === 'Review' ? 'In Review' : status}`);
    clearJobSelection();
  };

  const bulkUpdatePriority = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
    setBuilderJobs((prev) =>
      prev.map((job) => (selectedJobIds.has(job.job_id) ? { ...job, priority } : job))
    );
    toastSuccess('Priority updated', `${selectedJobIds.size} jobs set to ${priority} priority`);
    clearJobSelection();
  };

  const bulkUpdateAssignee = (assignee: string) => {
    setBuilderJobs((prev) =>
      prev.map((job) => (selectedJobIds.has(job.job_id) ? { ...job, assignee } : job))
    );
    toastSuccess('Assignee updated', `${selectedJobIds.size} jobs assigned to ${assignee || 'unassigned'}`);
    clearJobSelection();
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
      const now = new Date().toISOString();
      let localTicketCounter = ticketCounter;
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

          // Generate ticket number
          localTicketCounter += 1;
          const ticketNum = `PROD-${new Date().getFullYear()}-${String(localTicketCounter).padStart(3, '0')}`;

          // Build production notes from destination safe zones
          const safeZoneNotes = jobDestinations
            .map(d => d.special_notes)
            .filter(n => n && n !== 'Standard')
            .map(n => `• ${n}`);
          const productionNotes = safeZoneNotes.length > 0
            ? `SAFE ZONE GUIDANCE:\n${safeZoneNotes.join('\n')}`
            : 'SAFE ZONE GUIDANCE:\n• Standard safe zones apply. Check platform specs before final delivery.';
          
          // Determine duration from spec
          const specDuration = spec?.max_duration_seconds;
          
          jobs.push({
            job_id: jobId,
            ticket_number: ticketNum,
            creative_concept: conceptLabel,
            asset_type: inferredAssetType,
            destinations: jobDestinations,
            technical_summary: `${specLabel}${metaSuffix}${destinationNotice}`,
            status: 'Pending',
            priority: idx === 0 ? 'high' : 'medium',
            approval_status: 'pending' as const,
            revision_number: 1,
            created_at: now,
            updated_at: now,
            is_feed: row.is_feed,
            feed_template: row.feed_template,
            template_id: row.template_id,
            feed_id: row.feed_id,
            feed_asset_id: row.feed_asset_id,
            production_details: row.production_details,
            missing_destinations: !hasDestinations,
            // NEW: Brief context for traceability
            campaign_name: briefState.campaign_name || '',
            single_minded_proposition: briefState.single_minded_proposition || '',
            // NEW: Production engineering fields
            production_notes: productionNotes,
            // Only set duration for video assets
            max_duration_seconds: (inferredAssetType === 'video') ? specDuration : undefined,
            file_format: inferredAssetType === 'video' ? 'MP4' : (inferredAssetType === 'html5' ? 'HTML5' : 'JPG/PNG'),
            codec: inferredAssetType === 'video' ? 'H.264' : undefined,
            audio_spec: inferredAssetType === 'video' ? 'Sound on recommended; ensure captions' : undefined,
            frame_rate: inferredAssetType === 'video' ? '30fps' : undefined,
            requires_subtitles: inferredAssetType === 'video',
            // File size limit for display assets
            file_size_limit_mb: (inferredAssetType === 'html5' || inferredAssetType === 'image' || inferredAssetType === 'static') ? 150 : undefined,
            round_label: 'R1',
            version_tag: 'v1',
          });
        });
      });
      setTicketCounter(localTicketCounter);
      saveToStorage('ticketCounter', localTicketCounter);
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
          // NEW: Pass brief context for production traceability
          campaign_name: briefState.campaign_name || '',
          single_minded_proposition: briefState.single_minded_proposition || '',
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed with status ${res.status}`);
      }
      const data = await res.json();
      // Map backend jobs to frontend format with enhanced fields
      const now = new Date().toISOString();
      let localTicketCounter = ticketCounter;
      const jobs: ProductionJobRow[] = (data.jobs || []).map((backendJob: any, idx: number) => {
        localTicketCounter += 1;
        const ticketNum = `PROD-${new Date().getFullYear()}-${String(localTicketCounter).padStart(3, '0')}`;
        return {
          job_id: backendJob.job_id,
          ticket_number: ticketNum,
          creative_concept: backendJob.creative_concept,
          asset_type: backendJob.asset_type,
          destinations: backendJob.destinations || [],
          technical_summary: backendJob.technical_summary,
          status: backendJob.status || 'Pending',
          priority: idx === 0 ? 'high' : 'medium',
          approval_status: 'pending' as const,
          revision_number: 1,
          created_at: now,
          updated_at: now,
          is_feed: false,
          // NEW: Brief context from backend
          campaign_name: backendJob.campaign_name || briefState.campaign_name || '',
          single_minded_proposition: backendJob.single_minded_proposition || briefState.single_minded_proposition || '',
          // NEW: Production engineering fields from backend
          production_notes: backendJob.production_notes || '',
          max_duration_seconds: backendJob.max_duration_seconds,
          file_format: backendJob.file_format,
          codec: backendJob.codec,
          audio_spec: backendJob.audio_spec,
          frame_rate: backendJob.frame_rate,
          requires_subtitles: backendJob.requires_subtitles,
          round_label: backendJob.round_label || 'R1',
          version_tag: backendJob.version_tag || 'v1',
        };
      });
      setTicketCounter(localTicketCounter);
      saveToStorage('ticketCounter', localTicketCounter);
      setBuilderJobs(jobs);
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
      toastWarning('Duplicate field', 'A brief field with this name already exists.');
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

  // ---- State Persistence Effects ----
  // Persist demoMode to localStorage
  useEffect(() => {
    saveToStorage('demoMode', demoMode);
  }, [demoMode]);

  // Persist briefState to localStorage (debounced to avoid excessive writes)
  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveToStorage('briefState', briefState);
      setSaveStatus('saved');
      setLastSavedAt(new Date().toLocaleTimeString());
      // Reset to idle after showing "saved" briefly
      const resetTimer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(resetTimer);
    }, 500);
    return () => clearTimeout(timer);
  }, [briefState]);

  // Persist previewPlan to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToStorage('previewPlan', previewPlan);
    }, 500);
    return () => clearTimeout(timer);
  }, [previewPlan]);

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
      
      // Set demo-mode quality score for the comprehensive brief
      setBriefQualityScore(8.5);
      setBriefQualityGaps([]);
      setBriefQualityRationale(
        'This brief provides a strong SMP, well-defined audience segments, clear proof points, and modular content direction. Production-ready for ModCon workflow.'
      );
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
      toastWarning('Duplicate column', 'A column with this name already exists.');
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
    const validFiles = files.filter((file: File) => !isFileTooLarge(file, 'Brand assets'));
    if (!validFiles.length) {
      e.target.value = '';
      return;
    }
    const names = validFiles.map((f: File) => f.name);
    setBrandAssets((prev) => [...prev, ...names]);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Uploading brand assets: ${names.join(', ')}` },
      {
        role: 'assistant',
        content: 'Brand assets loaded. I will use these as visual references when drafting concepts and prompts.',
      },
    ]);
    addActivity(`Uploaded brand assets (${names.length})`);
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
    const validFiles = files.filter((file) => !isFileTooLarge(file, 'Media uploads'));
    if (!validFiles.length) {
      e.target.value = '';
      return;
    }
    const newConcepts: Concept[] = validFiles.map((file, idx) => {
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
    addActivity(`Uploaded media files (${files.length})`);
    e.target.value = '';
  }

  function handleConceptFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isFileTooLarge(file, 'Concept uploads')) {
      e.target.value = '';
      return;
    }
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
          toastWarning('No concepts found', 'Please upload a JSON array of concepts.');
          return;
        }
        setConcepts((prev) => [...prev, ...newConcepts]);
        setMoodBoardConceptIds((prev) => [...prev, ...newConcepts.map((c) => c.id)]);
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: `Uploaded ${newConcepts.length} concepts from file "${file.name}".` },
          { role: 'assistant', content: 'Added uploaded concepts to the board. You can map them to specs and production next.' },
        ]);
        addActivity(`Imported concepts (${newConcepts.length})`);
      } catch (err) {
        console.error('Error parsing concept file', err);
        toastError('File read failed', 'Please upload a JSON file with an array of concept objects.');
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
      toastWarning('Nothing to save', 'Add at least one row to the content matrix before saving to the library.');
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
    if (isFileTooLarge(file, 'Audience imports')) {
      e.target.value = '';
      return;
    }
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
        addActivity(`Audience import loaded (${jsonRows.length} rows)`);
      } catch (err) {
        console.error('Error parsing audience file', err);
        toastError('File read failed', 'Please upload a CSV or Excel with a header row.');
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
      toastWarning('No rows mapped', 'Please adjust the field mapping.');
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

  // Media Plan Import Functions
  const mediaPlanFileInputRef = useRef<HTMLInputElement>(null);

  function openMediaPlanFilePicker() {
    mediaPlanFileInputRef.current?.click();
  }

  function handleMediaPlanFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isFileTooLarge(file, 'Media plan imports')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Unable to read file.');
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
        
        // Auto-map columns using our mapping dictionary
        const parsedRows = parseMediaPlanRows(jsonRows);
        setMediaPlanParsedRows(parsedRows);
        setShowMediaPlanImport(true);
        toastSuccess('Media plan loaded', `Found ${parsedRows.length} placements.`);
        addActivity(`Media plan imported (${parsedRows.length} placements)`);
      } catch (err) {
        console.error('Error parsing media plan', err);
        toastError('Media plan parse failed', 'Please upload a CSV or Excel with placement data.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseMediaPlanRows(rows: any[]): MediaPlanRow[] {
    if (!rows.length) return [];
    
    // Get headers from first row
    const sampleRow = rows[0];
    const headers = Object.keys(sampleRow).map((h) => h.toLowerCase().trim());
    
    // Find column mappings
    const findColumn = (mappingKey: string): string | null => {
      const possibleNames = MEDIA_PLAN_COLUMN_MAPPINGS[mappingKey] || [];
      for (const name of possibleNames) {
        const matchingHeader = headers.find((h) => h === name.toLowerCase());
        if (matchingHeader) {
          return Object.keys(sampleRow).find((k) => k.toLowerCase().trim() === matchingHeader) || null;
        }
      }
      return null;
    };

    const platformCol = findColumn('platform');
    const placementCol = findColumn('placement');
    const formatCol = findColumn('format');
    const widthCol = findColumn('width');
    const heightCol = findColumn('height');
    const dimensionsCol = findColumn('dimensions');
    const durationCol = findColumn('duration');
    const budgetCol = findColumn('budget');
    const startCol = findColumn('flight_start');
    const endCol = findColumn('flight_end');
    const targetingCol = findColumn('targeting');
    const notesCol = findColumn('notes');

    return rows.map((row, idx) => {
      let width = 0, height = 0;
      
      // Try dimensions column first (e.g., "1080x1920")
      if (dimensionsCol && row[dimensionsCol]) {
        const dims = String(row[dimensionsCol]).match(/(\d+)\s*[xX×]\s*(\d+)/);
        if (dims) {
          width = parseInt(dims[1], 10);
          height = parseInt(dims[2], 10);
        }
      }
      // Fall back to separate width/height columns
      if (!width && widthCol) width = parseInt(row[widthCol], 10) || 0;
      if (!height && heightCol) height = parseInt(row[heightCol], 10) || 0;

      // Infer media type from format or dimensions
      const formatValue = formatCol ? String(row[formatCol] || '').toLowerCase() : '';
      const durationValue = durationCol ? parseInt(row[durationCol], 10) || 0 : 0;
      let media_type: 'video' | 'image' | 'html5' | 'audio' | 'native' = 'image';
      if (formatValue.includes('video') || durationValue > 0) media_type = 'video';
      else if (formatValue.includes('html5') || formatValue.includes('rich')) media_type = 'html5';
      else if (formatValue.includes('audio')) media_type = 'audio';
      else if (formatValue.includes('native')) media_type = 'native';

      return {
        id: `MP-${(idx + 1).toString().padStart(3, '0')}`,
        platform: platformCol ? String(row[platformCol] || 'Unknown') : 'Unknown',
        placement: placementCol ? String(row[placementCol] || 'Standard') : 'Standard',
        format: formatCol ? String(row[formatCol] || '') : '',
        width,
        height,
        media_type,
        duration: durationValue || undefined,
        budget: budgetCol ? parseFloat(String(row[budgetCol]).replace(/[^0-9.]/g, '')) || undefined : undefined,
        flight_start: startCol ? String(row[startCol] || '') : undefined,
        flight_end: endCol ? String(row[endCol] || '') : undefined,
        targeting: targetingCol ? String(row[targetingCol] || '') : undefined,
        notes: notesCol ? String(row[notesCol] || '') : undefined,
        selected: true,
      };
    }).filter((row) => row.platform !== 'Unknown' || row.width > 0 || row.placement !== 'Standard');
  }

  function applyMediaPlanImport() {
    const selectedRows = mediaPlanParsedRows.filter((r) => r.selected);
    if (!selectedRows.length) {
      toastWarning('No placements selected', 'Select at least one placement to import.');
      return;
    }

    // Add new specs from media plan
    const newSpecs: Spec[] = selectedRows.map((row, idx) => ({
      id: `MP-SPEC-${Date.now()}-${idx}`,
      platform: row.platform,
      placement: row.placement,
      width: row.width || 1080,
      height: row.height || 1080,
      orientation: row.height > row.width ? 'vertical' : row.width > row.height ? 'horizontal' : 'square',
      media_type: row.media_type,
      notes: [
        row.format && `Format: ${row.format}`,
        row.duration && `Duration: ${row.duration}s`,
        row.budget && `Budget: $${row.budget.toLocaleString()}`,
        row.flight_start && row.flight_end && `Flight: ${row.flight_start} - ${row.flight_end}`,
        row.targeting && `Targeting: ${row.targeting}`,
        row.notes,
      ].filter(Boolean).join(' | ') || null,
    }));

    setSpecs((prev) => [...prev, ...newSpecs]);

    // Also add to production matrix if we have concepts
    if (concepts.length > 0) {
      const newMatrixLines: ProductionMatrixLine[] = selectedRows.map((row, idx) => ({
        id: `MP-LINE-${Date.now()}-${idx}`,
        audience: row.targeting || 'All audiences',
        concept_id: concepts[0]?.id || '',
        spec_id: newSpecs[idx]?.id || '',
        destinations: [{
          name: `${row.platform} · ${row.placement}`,
          spec_id: newSpecs[idx]?.id,
        }],
        notes: row.notes || '',
        is_feed: false,
      }));
      setProductionMatrixRows((prev) => [...prev, ...newMatrixLines]);
    }

    setShowMediaPlanImport(false);
    setMediaPlanParsedRows([]);
    toastSuccess('Media plan imported', `Added ${newSpecs.length} specs from media plan.`);
  }

  function toggleMediaPlanRowSelection(id: string) {
    setMediaPlanParsedRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, selected: !row.selected } : row))
    );
  }

  function selectAllMediaPlanRows() {
    setMediaPlanParsedRows((prev) => prev.map((row) => ({ ...row, selected: true })));
  }

  function clearMediaPlanSelection() {
    setMediaPlanParsedRows((prev) => prev.map((row) => ({ ...row, selected: false })));
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
      className="flex flex-col min-h-screen w-full bg-white overflow-x-hidden font-sans text-slate-800"
    >
      {/* Global header - clean, single-row navigation */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shadow-sm z-50 relative">
        {/* Top row: Logo + Title + Actions */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Transparent Partners"
              width={140}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
            <div className="hidden sm:block border-l border-slate-200 pl-4">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight whitespace-nowrap">
                Intelligent Creative Cortex
              </h1>
            </div>
          </div>

          {/* Center: Workflow Navigation */}
          <nav className="hidden lg:flex items-center bg-slate-50 rounded-full border border-slate-200 px-1.5 py-1">
            {[
              { id: 'brief' as WorkspaceView, label: 'Brief', num: 1, badgeClass: 'bg-teal-100 text-teal-600' },
              { id: 'matrix' as WorkspaceView, label: 'Audiences', num: 2, badgeClass: 'bg-blue-100 text-blue-600' },
              { id: 'concepts' as WorkspaceView, label: 'Concepts', num: 3, badgeClass: 'bg-purple-100 text-purple-600' },
              { id: 'production' as WorkspaceView, label: 'Production', num: 4, badgeClass: 'bg-orange-100 text-orange-600' },
              { id: 'feed' as WorkspaceView, label: 'Feed', num: 5, badgeClass: 'bg-emerald-100 text-emerald-600' },
            ].map((step, idx, arr) => (
              <Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => switchWorkspace(step.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    workspaceView === step.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:bg-white/50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    workspaceView === step.id ? 'bg-slate-800 text-white' : step.badgeClass
                  }`}>
                    {step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
                {idx < arr.length - 1 && (
                  <svg className="w-3 h-3 text-slate-300 mx-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Fragment>
            ))}
          </nav>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* QA Check Button */}
            <button
              onClick={() => runAutoQA()}
              disabled={qaRunning}
              className={`relative text-xs font-medium px-3 py-2 rounded-full border transition-colors flex items-center gap-1.5 ${
                qaResults.filter(i => i.severity === 'error').length > 0
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                  : qaResults.filter(i => i.severity === 'warning').length > 0
                  ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                  : qaResults.length > 0
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-600'
              }`}
            >
              {qaRunning ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="hidden sm:inline">QA Check</span>
              {qaResults.length > 0 && (
                <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  qaResults.filter(i => i.severity === 'error').length > 0 ? 'bg-red-500 text-white' :
                  qaResults.filter(i => i.severity === 'warning').length > 0 ? 'bg-amber-500 text-white' :
                  'bg-blue-500 text-white'
                }`}>
                  {qaResults.length}
                </span>
              )}
            </button>
            {/* QA Results Toggle */}
            {qaResults.length > 0 && (
              <button
                onClick={() => setShowQaPanel((prev) => !prev)}
                className="text-[10px] text-slate-500 hover:text-slate-700 underline"
              >
                {showQaPanel ? 'Hide' : 'View'}
              </button>
            )}
            {workspaceView === 'brief' && (
              <button
                onClick={() => {
                  setShowSample(false);
                  setShowLibrary((prev) => !prev);
                }}
                className="hidden sm:block text-xs font-medium text-slate-500 hover:text-teal-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Library
              </button>
            )}
            <button
              onClick={() => {
                setDemoMode((prev) => !prev);
                setMessages([
                  {
                    role: 'assistant',
                    content: !demoMode
                      ? 'Demo mode is ON. I will simulate the agent locally so you can click around the interface without a backend.'
                      : 'Demo mode is OFF. I will now talk to the live backend (when available on localhost:8000).',
                  },
                ]);
              }}
              className={`text-xs font-medium px-3 py-2 rounded-full border transition-colors ${
                demoMode
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'
              }`}
            >
              {demoMode ? 'Demo' : 'Live'}
            </button>
            <a
              href="/planning"
              className="text-xs font-medium px-3 py-2 rounded-full bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span className="hidden sm:inline">Workspace</span>
            </a>
          </div>
        </div>

        {/* Mobile workflow nav - only shows on smaller screens */}
        <nav className="lg:hidden flex items-center justify-center gap-1 mt-3 pt-3 border-t border-slate-100">
          {[
            { id: 'brief', num: 1, color: 'teal' },
            { id: 'matrix', num: 2, color: 'blue' },
            { id: 'concepts', num: 3, color: 'purple' },
            { id: 'production', num: 4, color: 'orange' },
            { id: 'feed', num: 5, color: 'emerald' },
          ].map((step, idx, arr) => (
            <Fragment key={step.id}>
              <button
                type="button"
                onClick={() => switchWorkspace(step.id as WorkspaceView)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  workspaceView === step.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : `bg-${step.color}-100 text-${step.color}-600`
                }`}
              >
                {step.num}
              </button>
              {idx < arr.length - 1 && (
                <div className="w-4 h-0.5 bg-slate-200" />
              )}
            </Fragment>
          ))}
        </nav>
      </div>

      {/* QA Results Panel */}
      {showQaPanel && qaResults.length > 0 && (
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  QA Results
                </h3>
                <span className="text-[10px] text-slate-500">
                  Last run: {lastQaRun}
                </span>
                <div className="flex items-center gap-2 text-[10px]">
                  {qaResults.filter(i => i.severity === 'error').length > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      {qaResults.filter(i => i.severity === 'error').length} errors
                    </span>
                  )}
                  {qaResults.filter(i => i.severity === 'warning').length > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      {qaResults.filter(i => i.severity === 'warning').length} warnings
                    </span>
                  )}
                  {qaResults.filter(i => i.severity === 'suggestion').length > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {qaResults.filter(i => i.severity === 'suggestion').length} suggestions
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowQaPanel(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {qaResults.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => {
                    // Navigate to the module
                    switchWorkspace(issue.module === 'audiences' ? 'matrix' : issue.module);
                    // If there's a field to focus, try to focus it
                    if (issue.field && issue.module === 'brief') {
                      setTimeout(() => focusBriefField(issue.field!), 100);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] border transition-all hover:shadow-sm ${
                    issue.severity === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                      : issue.severity === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    issue.severity === 'error' ? 'bg-red-500' :
                    issue.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <span className="font-medium capitalize">{issue.module}:</span>
                  <span className="truncate max-w-xs">{issue.title}</span>
                  {issue.action && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/50">
                      {issue.action}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main workspace row: module content + optional AI assistant */}
      <div className="flex flex-1 w-full min-w-0 overflow-hidden bg-white">
        {/* LEFT: Chat Interface (Brief-only) */}
        {workspaceView === 'brief' && (
          <div className="flex flex-col border-r border-gray-200 relative w-full md:w-1/2 md:max-w-1/2 min-w-0">
            {workspaceGuidance && (
              <WorkspaceGuidanceBanner
                title={workspaceGuidance.title}
                body={workspaceGuidance.body}
                actionLabel={workspaceGuidance.actionLabel}
                onAction={workspaceGuidance.action}
                disabled={workspaceGuidance.disabled}
                variant="light"
              />
            )}
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
              placeholder={loading ? "AI is thinking..." : "Type your response..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-70 font-semibold shadow-sm transition-colors text-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Thinking...</span>
                </>
              ) : (
                'Send'
              )}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Attach .csv, .txt, .md, or .json files (max {MAX_UPLOAD_MB} MB).
          </p>
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
          <div className="hidden md:flex flex-col w-1/2 max-w-1/2 min-w-0 bg-white border-l border-gray-200 shadow-xl z-10 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-white flex justify-between items-center select-none">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Intelligent Content Brief</h2>
              {/* Autosave indicator */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full transition-opacity duration-300 ${
                saveStatus === 'saving' 
                  ? 'bg-amber-100 text-amber-600 opacity-100' 
                  : saveStatus === 'saved'
                  ? 'bg-emerald-100 text-emerald-600 opacity-100'
                  : 'opacity-0'
              }`}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
              </span>
              {lastSavedAt && (
                <span className="text-[10px] text-slate-400">
                  Updated {lastSavedAt}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Undo/Redo buttons */}
              <div className="flex items-center gap-1 mr-2">
                <button
                  type="button"
                  onClick={undoBrief}
                  disabled={briefHistoryIndex <= 0}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Undo (Cmd+Z)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={redoBrief}
                  disabled={briefHistoryIndex >= briefHistory.length - 1}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Redo (Cmd+Shift+Z)"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              </div>
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
          {(briefQualityGaps.length > 0 || briefCompletionGaps.length > 0) ? (
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-800">
                <span className="font-semibold text-amber-900">Finish key inputs:</span>
                {(briefQualityGaps.length ? briefQualityGaps : briefCompletionGaps)
                  .slice(0, 4)
                  .map((gap) => {
                    const key = resolveBriefFieldKey(gap);
                    if (!key) return null;
                    return (
                      <button
                        key={gap}
                        type="button"
                        onClick={() => focusBriefField(key)}
                        className="px-2 py-0.5 rounded-full border border-amber-300 bg-white hover:bg-amber-100"
                      >
                        {gap}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-[11px] text-emerald-700">
              Brief inputs look solid. You can move to Audience Matrix or Concepts.
            </div>
          )}
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
            {/* Brief Health + Next Best Action */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Next Best Action</h3>
                <button
                  type="button"
                  onClick={() => setShowQualityDetails((prev) => !prev)}
                  className="text-[10px] font-medium text-teal-600 hover:text-teal-700"
                >
                  {showQualityDetails ? 'Hide quality details' : 'View quality details'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[11px] text-slate-500">Brief health</span>
                <span
                  className={`text-[11px] font-semibold ${
                    isProductionReady ? 'text-emerald-700' : currentScore >= 5 ? 'text-amber-700' : 'text-red-600'
                  }`}
                >
                  {currentScore > 0 ? `${currentScore.toFixed(1)}/10` : '—'}
                </span>
                {isProductionReady ? (
                  <span className="text-[10px] text-emerald-600 font-medium">Production-ready</span>
                ) : (
                  <span className="text-[10px] text-slate-500">Needs more signal</span>
                )}
              </div>
              {!isProductionReady && (briefQualityGaps.length > 0 || briefCompletionGaps.length > 0) && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    Prioritize
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(briefQualityGaps.length ? briefQualityGaps : briefCompletionGaps)
                      .slice(0, 3)
                      .map((gap) => (
                        <span
                          key={gap}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600"
                        >
                          {gap}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {(briefQualityGaps.length > 0 || briefCompletionGaps.length > 0) && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    Fix it now
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(briefQualityGaps.length ? briefQualityGaps : briefCompletionGaps)
                      .slice(0, 3)
                      .map((gap) => {
                        const key = resolveBriefFieldKey(gap);
                        if (!key) return null;
                        return (
                          <button
                            key={gap}
                            type="button"
                            onClick={() => focusBriefField(key)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-teal-200 text-teal-700 hover:bg-teal-50"
                          >
                            {gap}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchWorkspace('matrix')}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100"
                >
                  Go to Audience Matrix
                </button>
                {isProductionReady && (
                  <button
                    type="button"
                    onClick={() => switchWorkspace('concepts')}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100"
                  >
                    Start Concepting
                  </button>
                )}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Keep the brief focused on modular inputs: segments, triggers, channels, and proof points.
              </p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Activity</h3>
                <span className="text-[10px] text-slate-400">Last 6 events</span>
              </div>
              {activityLog.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  Actions like uploads, drafts, and exports will show here.
                </p>
              ) : (
                <div className="space-y-2">
                  {activityLog.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{item.message}</span>
                      <span className="text-slate-400">{item.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Brief Fields</h3>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
                    isProductionReady 
                      ? 'border-emerald-200 bg-emerald-50' 
                      : 'border-slate-200 bg-slate-50'
                  }`}>
                    <span className="text-[10px] font-semibold text-slate-500">Quality</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        isProductionReady
                          ? 'text-emerald-700'
                          : currentScore >= 5 ? 'text-amber-700' : 'text-red-600'
                      }`}
                    >
                      {currentScore > 0
                        ? `${currentScore.toFixed(1)}/10`
                        : '—'}
                    </span>
                    {isProductionReady && (
                      <span className="text-[9px] text-emerald-600 font-medium">✓ Ready</span>
                    )}
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
                  <span className="truncate flex items-center gap-2">
                    {briefQualityAgentLoading ? (
                      <>
                        <svg className="animate-spin h-3 w-3 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Analyzing brief quality...</span>
                      </>
                    ) : briefQualityRationale}
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
                          ref={(node) => {
                            briefFieldRefs.current[field.key] = node;
                          }}
                        />
                      ) : (
                        <input
                          className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                          value={value}
                          onChange={(e) => updateBriefFieldValue(field.key, e.target.value)}
                          placeholder={field.label}
                          ref={(node) => {
                            briefFieldRefs.current[field.key] = node;
                          }}
                        />
                      )}
                      {briefQualityGaps.includes(field.label) || briefCompletionGaps.includes(field.label) || briefQualityGaps.includes(field.key) || briefCompletionGaps.includes(field.key) ? (
                        <p className="text-[10px] text-amber-600">
                          {briefFieldHints[field.key] || 'Add more detail to improve brief quality.'}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="pt-4 mt-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => downloadExport('txt')}
                  disabled={exportLoadingFormat === 'txt'}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors ${
                    exportLoadingFormat === 'txt'
                      ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                      : 'text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50'
                  }`}
                >
                  {exportLoadingFormat === 'txt' ? 'Exporting…' : 'Download TXT'}
                </button>
                <button
                  onClick={() => downloadExport('pdf')}
                  disabled={exportLoadingFormat === 'pdf'}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors ${
                    exportLoadingFormat === 'pdf'
                      ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                      : 'text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50'
                  }`}
                >
                  {exportLoadingFormat === 'pdf' ? 'Exporting…' : 'Download PDF'}
                </button>
                <button
                  onClick={() => downloadExport('json')}
                  disabled={exportLoadingFormat === 'json'}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors ${
                    exportLoadingFormat === 'json'
                      ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                      : 'text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50'
                  }`}
                >
                  {exportLoadingFormat === 'json' ? 'Exporting…' : 'Download JSON'}
                </button>
              </div>
            </div>
          </div>
          <ModuleAssistantBar
            title={moduleAssistant.title}
            score={moduleAssistant.score}
            completionNote={moduleAssistant.completionNote}
            tips={moduleAssistant.tips}
            dataFlowNote={moduleAssistant.dataFlowNote}
          />
          </div>
        )}

        {/* Module Content: Strategy Matrix Workspace / Concepts / Production / Feed */}
        {workspaceView !== 'brief' && (
          <>
          {/* Main Module Content */}
          <div className="bg-white flex flex-col flex-1 min-w-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-white flex justify-between items-center select-none">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
                {workspaceView === 'matrix'
                  ? 'Audience Matrix'
                  : workspaceView === 'concepts'
                  ? 'Concept Workspace'
                  : workspaceView === 'production'
                  ? 'Production Matrix'
                  : 'Content Feed'}
              </h2>
              {workspaceView === 'concepts' && conceptDraftLoading && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700">
                  Drafting concepts…
                </span>
              )}
              {workspaceView === 'production' && productionLoading && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                  Generating production plan…
                </span>
              )}
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
                {/* AI Assistant Toggle */}
                <button
                  onClick={() => setShowAIAssistant(!showAIAssistant)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                    showAIAssistant
                      ? 'bg-purple-600 text-white border border-purple-600'
                      : 'text-purple-600 hover:text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Assist
                </button>
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
                disabled={exportLoadingFormat === 'json'}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  exportLoadingFormat === 'json'
                    ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                    : 'text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50'
                }`}
              >
                {exportLoadingFormat === 'json' ? 'Exporting…' : 'JSON'}
              </button>
              <button
                onClick={() => downloadExport('txt')}
                disabled={exportLoadingFormat === 'txt'}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  exportLoadingFormat === 'txt'
                    ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                    : 'text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50'
                }`}
              >
                {exportLoadingFormat === 'txt' ? 'Exporting…' : 'TXT'}
              </button>
              <button
                onClick={() => downloadExport('pdf')}
                disabled={exportLoadingFormat === 'pdf'}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  exportLoadingFormat === 'pdf'
                    ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                    : 'text-slate-600 hover:text-teal-600 bg-slate-100 hover:bg-teal-50'
                }`}
              >
                {exportLoadingFormat === 'pdf' ? 'Exporting…' : 'PDF'}
              </button>
            </div>
          </div>

          <div className="flex-1 px-6 py-6 overflow-auto bg-white relative">
            <div className="space-y-6 w-full">
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
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={addMatrixRow}
                          className="mt-2 px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full border border-teal-100"
                        >
                          Add first row
                        </button>
                        <button
                          onClick={openAudienceFilePicker}
                          className="mt-2 px-4 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-full border border-slate-200"
                        >
                          Import audience CSV
                        </button>
                        <button
                          onClick={() => setShowMatrixLibrary(true)}
                          className="mt-2 px-4 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-full border border-slate-200"
                        >
                          Open matrix library
                        </button>
                      </div>
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
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="text-xs text-left min-w-[1800px]">
                            <thead className="bg-slate-100 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-3 w-[60px] text-center font-semibold text-[11px] uppercase tracking-wide text-slate-600 whitespace-nowrap">Line</th>
                                <th className="px-2 py-3 w-[40px] text-center"></th>
                                {matrixFields.filter((f) => visibleMatrixFields.includes(f.key)).map((field) => {
                                  // Assign fixed widths based on field type
                                  const colWidth = 
                                    field.key.includes('description') || field.key.includes('insight') || field.key.includes('perception') 
                                      ? 'w-[180px]' 
                                      : field.key.includes('name') || field.key.includes('segment') 
                                      ? 'w-[130px]'
                                      : field.key.includes('size') || field.key.includes('id')
                                      ? 'w-[80px]'
                                      : 'w-[110px]';
                                  return (
                                <th 
                                      key={field.key} 
                                      className={`px-3 py-3 ${colWidth} align-top group relative`}
                                      title={field.label}
                                    >
                                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">{field.label}</span>
                                      {/* Tooltip on hover */}
                                      <div className="absolute hidden group-hover:block z-20 left-0 top-full mt-1 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap">
                                        {field.label}
                                      </div>
                                    </th>
                                  );
                                })}
                                <th className="px-3 py-3 w-[70px]"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {matrixRows.map((row, index) => (
                                <Fragment key={index}>
                                  <tr className="align-top hover:bg-slate-50/70">
                                    <td className="px-3 py-2 w-[60px] text-center">
                                      <span className="text-xs font-mono font-semibold text-slate-700">
                                        {(index + 1).toString().padStart(3, '0')}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 w-[40px] text-center">
                                      <button
                                        type="button"
                                        onClick={() => toggleMatrixRowExpanded(index)}
                                        className="text-[11px] text-slate-500 hover:text-teal-700"
                                      >
                                        {expandedMatrixRows[index] ? '−' : '+'}
                                      </button>
                                    </td>
                                    {matrixFields.filter((f) => visibleMatrixFields.includes(f.key)).map((field) => {
                                      const cellValue = row[field.key] ?? '';
                                      const colWidth = 
                                        field.key.includes('description') || field.key.includes('insight') || field.key.includes('perception') 
                                          ? 'w-[180px]' 
                                          : field.key.includes('name') || field.key.includes('segment') 
                                          ? 'w-[130px]'
                                          : field.key.includes('size') || field.key.includes('id')
                                          ? 'w-[80px]'
                                          : 'w-[110px]';
                                      return (
                                      <td key={field.key} className={`px-2 py-2 ${colWidth}`}>
                                        <input
                                          value={cellValue}
                                          onChange={(e) =>
                                            updateMatrixCell(index, field.key as MatrixFieldKey, e.target.value)
                                          }
                                          title={cellValue.length > 30 ? cellValue : undefined}
                                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-[11px] leading-5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                        />
                                      </td>
                                    );})}
                                    <td className="px-2 py-2 w-[70px] text-right">
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
                        <table className="w-full text-[11px] min-w-[1100px]">
                          <thead className="bg-slate-100 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Segment Source</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Audience</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Concept</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Destination</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Add Destinations</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Feed?</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Decisioning</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Production Details</th>
                              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Notes</th>
                              <th className="px-3 py-3 text-right w-16"></th>
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
                                    <input
                                      className={`w-full border rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 ${
                                        row.is_feed 
                                          ? 'border-blue-200 bg-blue-50/50 text-slate-700' 
                                          : 'border-slate-200 bg-slate-50 text-slate-400'
                                      }`}
                                      value={row.decisioning_rule ?? ''}
                                      onChange={(e) => updateProductionMatrixCell(index, 'decisioning_rule' as any, e.target.value)}
                                      placeholder={row.is_feed ? 'IF audience = X THEN show Y' : 'Enable Feed for DCO rules'}
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
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500">
                            <p>
                              No jobs generated yet. Create a production plan to see build-ready jobs and requirements.
                            </p>
                            <button
                              type="button"
                              onClick={generateProductionPlan}
                              disabled={productionLoading}
                              className={`mt-2 px-3 py-1.5 rounded-full border ${
                                productionLoading
                                  ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'
                                  : 'border-teal-500 text-teal-700 bg-teal-50 hover:bg-teal-100'
                              }`}
                            >
                              {productionLoading ? 'Generating…' : 'Generate production plan'}
                            </button>
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
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                              <table className="min-w-full text-[11px]">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                  <tr className="text-left">
                                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Production Asset</th>
                                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Tech Specs</th>
                                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Destinations</th>
                                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Build Details</th>
                                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Requirements</th>
                                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Status</th>
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
                                          <div className="space-y-1">
                                            <div className="font-medium">{job.technical_summary}</div>
                                            {/* Brief Context */}
                                            {job.campaign_name && (
                                              <div className="text-[10px] text-slate-500">
                                                Campaign: {job.campaign_name}
                                              </div>
                                            )}
                                            {job.single_minded_proposition && (
                                              <div className="text-[10px] text-teal-600 italic max-w-[180px] truncate" title={job.single_minded_proposition}>
                                                SMP: {job.single_minded_proposition}
                                              </div>
                                            )}
                                            {/* Flight Dates - Critical for media coordination */}
                                            {(briefState.flight_start || briefState.flight_end) && (
                                              <div className="text-[10px] text-indigo-600 flex items-center gap-1">
                                                <span className="font-medium">Flight:</span>
                                                {briefState.flight_start && <span>{briefState.flight_start}</span>}
                                                {briefState.flight_start && briefState.flight_end && <span>→</span>}
                                                {briefState.flight_end && <span>{briefState.flight_end}</span>}
                                              </div>
                                            )}
                                            {/* Market/Language badge if set */}
                                            {job.language && (
                                              <span className="inline-block text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                                                {job.language}
                                              </span>
                                            )}
                                          </div>
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
                                              {/* Production Notes (auto-populated safe zones) */}
                                              {job.production_notes && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 text-[10px]">
                                                  <div className="font-semibold text-amber-800 mb-1">Production Notes</div>
                                                  <pre className="text-amber-700 whitespace-pre-wrap font-sans text-[10px]">
                                                    {job.production_notes}
                                                  </pre>
                                                </div>
                                              )}
                                              {/* Duration & Format Constraints - Only show duration for video assets */}
                                              <div className="flex flex-wrap gap-1.5 text-[10px]">
                                                {job.max_duration_seconds && job.max_duration_seconds > 0 && (job.asset_type === 'video' || job.asset_type?.includes('video')) && (
                                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                                                    Max {job.max_duration_seconds}s
                                                  </span>
                                                )}
                                                {job.file_format && (
                                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                                    {job.file_format}
                                                  </span>
                                                )}
                                                {job.audio_spec && (job.asset_type === 'video' || job.asset_type?.includes('video')) && (
                                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                                                    {job.audio_spec}
                                                  </span>
                                                )}
                                                {job.requires_subtitles && (job.asset_type === 'video' || job.asset_type?.includes('video')) && (
                                                  <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                                                    Subtitles required
                                                  </span>
                                                )}
                                                {/* Display-specific: file size limit */}
                                                {job.file_size_limit_mb && (
                                                  <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-200">
                                                    Max {job.file_size_limit_mb}KB
                                                  </span>
                                                )}
                                              </div>
                                              {/* Market/Language & Shoot Code - Critical for global campaigns */}
                                              <div className="flex gap-2 text-[10px]">
                                                <select
                                                  className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                  value={job.language || ''}
                                                  onChange={(e) => {
                                                    const updated = builderJobs.map(j => 
                                                      j.job_id === job.job_id 
                                                        ? { ...j, language: e.target.value } 
                                                        : j
                                                    );
                                                    setBuilderJobs(updated);
                                                  }}
                                                >
                                                  <option value="">Market / Language...</option>
                                                  <option value="EN-US">EN-US (United States)</option>
                                                  <option value="EN-UK">EN-UK (United Kingdom)</option>
                                                  <option value="EN-AU">EN-AU (Australia)</option>
                                                  <option value="DE-DE">DE-DE (Germany)</option>
                                                  <option value="FR-FR">FR-FR (France)</option>
                                                  <option value="ES-ES">ES-ES (Spain)</option>
                                                  <option value="ES-MX">ES-MX (Mexico)</option>
                                                  <option value="PT-BR">PT-BR (Brazil)</option>
                                                  <option value="JA-JP">JA-JP (Japan)</option>
                                                  <option value="ZH-CN">ZH-CN (China)</option>
                                                  <option value="KO-KR">KO-KR (Korea)</option>
                                                  <option value="MULTI">Multi-market</option>
                                                  <option value="GLOBAL">Global (No localization)</option>
                                                </select>
                                                <input
                                                  className="w-28 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                  placeholder="Shoot code"
                                                  value={job.shoot_code || ''}
                                                  onChange={(e) => {
                                                    const updated = builderJobs.map(j => 
                                                      j.job_id === job.job_id 
                                                        ? { ...j, shoot_code: e.target.value } 
                                                        : j
                                                    );
                                                    setBuilderJobs(updated);
                                                  }}
                                                />
                                              </div>
                                              {/* Source Type & Version */}
                                              <div className="flex gap-2 text-[10px]">
                                                <select
                                                  className="flex-1 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                  value={job.source_type || ''}
                                                  onChange={(e) => {
                                                    const updated = builderJobs.map(j => 
                                                      j.job_id === job.job_id 
                                                        ? { ...j, source_type: e.target.value as any } 
                                                        : j
                                                    );
                                                    setBuilderJobs(updated);
                                                  }}
                                                >
                                                  <option value="">Source type...</option>
                                                  <option value="new_shoot">New Shoot</option>
                                                  <option value="stock">Stock</option>
                                                  <option value="existing">Existing Asset</option>
                                                  <option value="ugc">UGC</option>
                                                  <option value="ai_generated">AI Generated</option>
                                                </select>
                                                <input
                                                  className="w-20 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                  placeholder="Round"
                                                  value={job.round_label || 'R1'}
                                                  onChange={(e) => {
                                                    const updated = builderJobs.map(j => 
                                                      j.job_id === job.job_id 
                                                        ? { ...j, round_label: e.target.value } 
                                                        : j
                                                    );
                                                    setBuilderJobs(updated);
                                                  }}
                                                />
                                                <input
                                                  className="w-16 border border-slate-300 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                  placeholder="Ver"
                                                  value={job.version_tag || 'v1'}
                                                  onChange={(e) => {
                                                    const updated = builderJobs.map(j => 
                                                      j.job_id === job.job_id 
                                                        ? { ...j, version_tag: e.target.value } 
                                                        : j
                                                    );
                                                    setBuilderJobs(updated);
                                                  }}
                                                />
                                              </div>
                                              {/* Legal & Compliance - Critical for omnichannel */}
                                              <div className="flex flex-wrap gap-1.5 text-[10px]">
                                                <label className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded border border-red-200 cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    className="h-3 w-3"
                                                    checked={job.legal_disclaimer_required || false}
                                                    onChange={(e) => {
                                                      const updated = builderJobs.map(j => 
                                                        j.job_id === job.job_id 
                                                          ? { ...j, legal_disclaimer_required: e.target.checked } 
                                                          : j
                                                      );
                                                      setBuilderJobs(updated);
                                                    }}
                                                  />
                                                  Legal disclaimer
                                                </label>
                                                <select
                                                  className="border border-slate-300 rounded px-1 py-0.5 text-[10px] bg-white"
                                                  value={job.talent_usage_rights || ''}
                                                  onChange={(e) => {
                                                    const updated = builderJobs.map(j => 
                                                      j.job_id === job.job_id 
                                                        ? { ...j, talent_usage_rights: e.target.value } 
                                                        : j
                                                    );
                                                    setBuilderJobs(updated);
                                                  }}
                                                >
                                                  <option value="">Talent rights...</option>
                                                  <option value="perpetual">Perpetual</option>
                                                  <option value="1_year">1 Year</option>
                                                  <option value="6_months">6 Months</option>
                                                  <option value="campaign_only">Campaign Only</option>
                                                  <option value="check_legal">Check with Legal</option>
                                                </select>
                                                <select
                                                  className="border border-slate-300 rounded px-1 py-0.5 text-[10px] bg-white"
                                                  value={job.music_licensing_status || ''}
                                                  onChange={(e) => {
                                                    const updated = builderJobs.map(j => 
                                                      j.job_id === job.job_id 
                                                        ? { ...j, music_licensing_status: e.target.value } 
                                                        : j
                                                    );
                                                    setBuilderJobs(updated);
                                                  }}
                                                >
                                                  <option value="">Music license...</option>
                                                  <option value="licensed">Licensed</option>
                                                  <option value="stock">Stock/Royalty-free</option>
                                                  <option value="needs_clearance">Needs Clearance</option>
                                                  <option value="original">Original Composition</option>
                                                  <option value="none">No Music</option>
                                                </select>
                                              </div>
                                              <textarea
                                                className="w-full min-w-[200px] text-[11px] border border-slate-300 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                rows={2}
                                                placeholder="Build direction for production team (free form)."
                                                value={buildDirectionValue}
                                                onChange={(e) =>
                                                  updateBuildDetail(job.job_id, 'build_direction' as any, e.target.value)
                                                }
                                              />
                                              <textarea
                                                className="w-full min-w-[200px] text-[11px] border border-slate-300 rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                rows={2}
                                                placeholder="Localization notes: adaptation instructions, cultural considerations."
                                                value={job.localization_notes || meta.production_details || job.production_details || ''}
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
                        {/* View toggle */}
                        <div className="flex items-center bg-slate-100 rounded-full p-0.5">
                          <button
                            type="button"
                            onClick={() => setProductionBoardView('list')}
                            className={`px-2.5 py-1 text-[10px] rounded-full transition-colors ${
                              productionBoardView === 'list'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            List
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductionBoardView('kanban')}
                            className={`px-2.5 py-1 text-[10px] rounded-full transition-colors ${
                              productionBoardView === 'kanban'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Kanban
                          </button>
                        </div>
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
                        {builderJobs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDcoExportValidation(validateDcoExport(dcoExportPlatform));
                              setShowDcoExport(true);
                            }}
                            className="px-3 py-1.5 text-[11px] rounded-full border border-purple-500 text-purple-700 bg-purple-50 hover:bg-purple-100"
                          >
                            Export to DCO
                          </button>
                        )}
                      </div>
                    </div>
                    {showBoard && (
                      <>
                        {/* Production Progress Dashboard */}
                        {builderJobs.length > 0 && (
                          <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                                Production Progress
                              </h4>
                              <span className="text-[11px] text-slate-500">
                                {builderJobs.filter(j => j.status === 'Approved').length} / {builderJobs.length} complete
                              </span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                              <div className="h-full flex">
                                <div 
                                  className="bg-emerald-500 transition-all duration-300" 
                                  style={{ width: `${(builderJobs.filter(j => j.status === 'Approved').length / builderJobs.length) * 100}%` }} 
                                />
                                <div 
                                  className="bg-amber-400 transition-all duration-300" 
                                  style={{ width: `${(builderJobs.filter(j => j.status === 'Review').length / builderJobs.length) * 100}%` }} 
                                />
                                <div 
                                  className="bg-sky-400 transition-all duration-300" 
                                  style={{ width: `${(builderJobs.filter(j => j.status === 'In_Progress').length / builderJobs.length) * 100}%` }} 
                                />
                              </div>
                            </div>
                            
                            {/* Status Breakdown */}
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-white border border-slate-100 rounded-lg p-2">
                                <span className="block text-lg font-bold text-slate-400">
                                  {builderJobs.filter(j => j.status === 'Pending').length}
                                </span>
                                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Todo</span>
                              </div>
                              <div className="bg-white border border-sky-100 rounded-lg p-2">
                                <span className="block text-lg font-bold text-sky-600">
                                  {builderJobs.filter(j => j.status === 'In_Progress').length}
                                </span>
                                <span className="text-[9px] text-sky-600 uppercase tracking-wide">In Progress</span>
                              </div>
                              <div className="bg-white border border-amber-100 rounded-lg p-2">
                                <span className="block text-lg font-bold text-amber-600">
                                  {builderJobs.filter(j => j.status === 'Review').length}
                                </span>
                                <span className="text-[9px] text-amber-600 uppercase tracking-wide">In Review</span>
                              </div>
                              <div className="bg-white border border-emerald-100 rounded-lg p-2">
                                <span className="block text-lg font-bold text-emerald-600">
                                  {builderJobs.filter(j => j.status === 'Approved').length}
                                </span>
                                <span className="text-[9px] text-emerald-600 uppercase tracking-wide">Approved</span>
                              </div>
                            </div>
                            
                            {/* Priority Breakdown */}
                            {builderJobs.some(j => j.priority === 'urgent' || j.priority === 'high') && (
                              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-[10px]">
                                {builderJobs.filter(j => j.priority === 'urgent').length > 0 && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    {builderJobs.filter(j => j.priority === 'urgent').length} urgent
                                  </span>
                                )}
                                {builderJobs.filter(j => j.priority === 'high').length > 0 && (
                                  <span className="flex items-center gap-1 text-orange-600">
                                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                                    {builderJobs.filter(j => j.priority === 'high').length} high priority
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Bulk Actions Toolbar */}
                        {selectedJobIds.size > 0 && (
                          <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg mb-3">
                            <span className="text-[11px] font-semibold text-teal-800">
                              {selectedJobIds.size} selected
                            </span>
                            <div className="flex items-center gap-2">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) bulkUpdateStatus(e.target.value as any);
                                  e.target.value = '';
                                }}
                                className="text-[11px] border border-teal-300 rounded-md px-2 py-1 bg-white"
                                defaultValue=""
                              >
                                <option value="" disabled>Set status...</option>
                                <option value="Pending">Todo</option>
                                <option value="In_Progress">In Progress</option>
                                <option value="Review">In Review</option>
                                <option value="Approved">Approved</option>
                              </select>
                              <select
                                onChange={(e) => {
                                  if (e.target.value) bulkUpdatePriority(e.target.value as any);
                                  e.target.value = '';
                                }}
                                className="text-[11px] border border-teal-300 rounded-md px-2 py-1 bg-white"
                                defaultValue=""
                              >
                                <option value="" disabled>Set priority...</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const name = window.prompt('Assign to:');
                                  if (name !== null) bulkUpdateAssignee(name);
                                }}
                                className="text-[11px] px-2 py-1 rounded-md border border-teal-300 bg-white hover:bg-teal-100 text-teal-700"
                              >
                                Assign...
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={clearJobSelection}
                              className="ml-auto text-[11px] text-teal-600 hover:text-teal-800"
                            >
                              Clear selection
                            </button>
                          </div>
                        )}
                        
                        {/* Select All / Clear */}
                        {builderJobs.length > 0 && selectedJobIds.size === 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              type="button"
                              onClick={selectAllJobs}
                              className="text-[10px] text-slate-500 hover:text-slate-700 underline"
                            >
                              Select all ({builderJobs.length})
                            </button>
                          </div>
                        )}
                        
                        {productionError && (
                          <p className="text-[11px] text-red-500">{productionError}</p>
                        )}
                        {builderJobs.length === 0 ? (
                          <div className="mt-12 flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                            <p className="text-sm max-w-xs">
                              Generate the Production List above to view the two-column board linking creative details to live status.
                            </p>
                          </div>
                        ) : productionBoardView === 'kanban' ? (
                          /* ============ KANBAN VIEW ============ */
                          <div className="overflow-x-auto pb-4">
                            <div className="flex gap-4 min-w-max">
                              {(['Pending', 'In_Progress', 'Review', 'Approved'] as const).map((columnStatus) => {
                                const columnJobs = builderJobs.filter((j) => (j.status || 'Pending') === columnStatus);
                                const columnLabel = columnStatus === 'In_Progress' ? 'In Progress' : columnStatus === 'Review' ? 'In Review' : columnStatus;
                                const columnColor = columnStatus === 'Approved' ? 'emerald' : columnStatus === 'Review' ? 'amber' : columnStatus === 'In_Progress' ? 'sky' : 'slate';
                                return (
                                  <div key={columnStatus} className="w-72 flex-shrink-0">
                                    {/* Column Header */}
                                    <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg bg-${columnColor}-100 border-b-2 border-${columnColor}-300`}>
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full bg-${columnColor}-500`} />
                                        <span className="text-[11px] font-semibold text-slate-700">{columnLabel}</span>
                                      </div>
                                      <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded">
                                        {columnJobs.length}
                                      </span>
                                    </div>
                                    {/* Column Body */}
                                    <div className="bg-slate-50 rounded-b-lg border border-t-0 border-slate-200 p-2 min-h-[400px] space-y-2">
                                      {columnJobs.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 text-[11px]">
                                          No jobs
                                        </div>
                                      ) : (
                                        columnJobs.map((job) => {
                                          const isSelected = selectedJobIds.has(job.job_id);
                                          return (
                                            <div
                                              key={job.job_id}
                                              className={`bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                                                isSelected ? 'border-teal-400 ring-1 ring-teal-200' : 'border-slate-200'
                                              }`}
                                              onClick={() => toggleJobSelection(job.job_id)}
                                            >
                                              {/* Ticket number & priority */}
                                              <div className="flex items-center justify-between mb-2">
                                                {job.ticket_number && (
                                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                    {job.ticket_number}
                                                  </span>
                                                )}
                                                {job.priority && job.priority !== 'medium' && (
                                                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                                    job.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                                    job.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-slate-100 text-slate-600'
                                                  }`}>
                                                    {job.priority}
                                                  </span>
                                                )}
                                              </div>
                                              {/* Title */}
                                              <p className="text-[11px] font-semibold text-slate-800 mb-1 line-clamp-2">
                                                {job.creative_concept}
                                              </p>
                                              {/* Asset type & specs */}
                                              <p className="text-[10px] text-slate-500 mb-2">
                                                {job.asset_type} · {job.technical_summary.split(' ').slice(0, 2).join(' ')}
                                              </p>
                                              {/* Assignee & due date */}
                                              <div className="flex items-center justify-between text-[9px] text-slate-400">
                                                <span>{job.assignee || 'Unassigned'}</span>
                                                {job.due_date && (
                                                  <span className="flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    {job.due_date}
                                                  </span>
                                                )}
                                              </div>
                                              {/* Approval status */}
                                              {job.approval_status && job.approval_status !== 'pending' && (
                                                <div className="mt-2 pt-2 border-t border-slate-100">
                                                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                                    job.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                    job.approval_status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                                                    job.approval_status === 'revision_requested' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                  }`}>
                                                    {job.approval_status === 'approved' ? '✓ Approved' :
                                                     job.approval_status === 'submitted' ? '📤 Submitted' :
                                                     job.approval_status === 'revision_requested' ? '↩ Revision R' + (job.revision_number || 1) :
                                                     '✗ Rejected'}
                                                  </span>
                                                </div>
                                              )}
                                              {/* Quick status change */}
                                              <div className="mt-2 pt-2 border-t border-slate-100">
                                                <select
                                                  value={job.status}
                                                  onChange={(e) => {
                                                    e.stopPropagation();
                                                    updateJobStatus(job.job_id, e.target.value as any);
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="w-full text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white"
                                                >
                                                  <option value="Pending">Todo</option>
                                                  <option value="In_Progress">In Progress</option>
                                                  <option value="Review">In Review</option>
                                                  <option value="Approved">Approved</option>
                                                </select>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* ============ LIST VIEW ============ */
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
                              const platformWarnings = validatePlatformSpec(job);
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
                              const isSelected = selectedJobIds.has(job.job_id);
                              return (
                                <div
                                  key={job.job_id}
                                  className={`grid grid-cols-1 lg:grid-cols-2 gap-3 bg-white border rounded-xl p-3 shadow-sm transition-colors ${
                                    isSelected ? 'border-teal-400 ring-1 ring-teal-200' : 'border-slate-200'
                                  }`}
                                >
                                  {/* Left: creative unit details */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleJobSelection(job.job_id)}
                                          className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                        />
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="text-[11px] font-semibold text-slate-800">
                                              {job.creative_concept}
                                            </p>
                                            {job.ticket_number && (
                                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                {job.ticket_number}
                                              </span>
                                            )}
                                            {job.revision_number && job.revision_number > 1 && (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                                R{job.revision_number}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-slate-500">
                                            {job.asset_type}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {job.approval_status && job.approval_status !== 'pending' && (
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                            job.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                            job.approval_status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                                            job.approval_status === 'revision_requested' ? 'bg-amber-100 text-amber-700' :
                                            job.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-600'
                                          }`}>
                                            {job.approval_status === 'approved' ? '✓ Approved' :
                                             job.approval_status === 'submitted' ? '📤 Submitted' :
                                             job.approval_status === 'revision_requested' ? '↩ Revision' :
                                             job.approval_status === 'rejected' ? '✗ Rejected' :
                                             job.approval_status}
                                          </span>
                                        )}
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                          Specs
                                        </span>
                                      </div>
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
                                    {/* Platform Validation Warnings */}
                                    {platformWarnings.length > 0 && (
                                      <div className="space-y-1">
                                        {platformWarnings.slice(0, 3).map((warning, idx) => (
                                          <p
                                            key={idx}
                                            className={`text-[10px] rounded px-2 py-1 ${
                                              warning.type === 'error'
                                                ? 'text-red-700 bg-red-50 border border-red-200'
                                                : warning.type === 'warning'
                                                ? 'text-amber-700 bg-amber-50 border border-amber-200'
                                                : 'text-blue-700 bg-blue-50 border border-blue-200'
                                            }`}
                                          >
                                            {warning.type === 'error' ? '⚠️ ' : warning.type === 'warning' ? '⚡ ' : 'ℹ️ '}
                                            {warning.message}
                                          </p>
                                        ))}
                                        {platformWarnings.length > 3 && (
                                          <p className="text-[9px] text-slate-500">
                                            +{platformWarnings.length - 3} more warnings
                                          </p>
                                        )}
                                      </div>
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
                                    
                                    {/* Assignee, Due Date, Priority */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                          Assignee
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Name"
                                          value={job.assignee || ''}
                                          onChange={(e) => updateJobAssignee(job.job_id, e.target.value)}
                                          className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                          Due Date
                                        </label>
                                        <input
                                          type="date"
                                          value={job.due_date || ''}
                                          onChange={(e) => updateJobDueDate(job.job_id, e.target.value)}
                                          className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                          Priority
                                        </label>
                                        <select
                                          value={job.priority || 'medium'}
                                          onChange={(e) => updateJobPriority(job.job_id, e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                                          className={`w-full text-[11px] border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                                            job.priority === 'urgent' ? 'border-red-300 text-red-700' :
                                            job.priority === 'high' ? 'border-orange-300 text-orange-700' :
                                            job.priority === 'low' ? 'border-slate-200 text-slate-500' :
                                            'border-slate-200'
                                          }`}
                                        >
                                          <option value="low">Low</option>
                                          <option value="medium">Medium</option>
                                          <option value="high">High</option>
                                          <option value="urgent">Urgent</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* Internal Review & Estimation */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                          QC Reviewer
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Reviewer"
                                          value={job.reviewer || ''}
                                          onChange={(e) => updateJobReviewer(job.job_id, e.target.value)}
                                          className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                          Est. Hours
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          placeholder="0"
                                          value={job.estimated_hours || ''}
                                          onChange={(e) => updateJobEstimatedHours(job.job_id, parseFloat(e.target.value) || 0)}
                                          className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                          Est. Cost ($)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="50"
                                          placeholder="0"
                                          value={job.cost_estimate ? (job.cost_estimate / 100).toFixed(0) : ''}
                                          onChange={(e) => updateJobCostEstimate(job.job_id, Math.round(parseFloat(e.target.value) * 100) || 0)}
                                          className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        />
                                      </div>
                                    </div>

                                    {/* Client Approval Workflow */}
                                    <div className="border-t border-slate-100 pt-2 mt-1">
                                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Client Approval
                                      </p>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <select
                                            value={job.approval_status || 'pending'}
                                            onChange={(e) => updateJobApprovalStatus(job.job_id, e.target.value as 'pending' | 'submitted' | 'approved' | 'revision_requested' | 'rejected')}
                                            className={`w-full text-[11px] border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                                              job.approval_status === 'approved' ? 'border-emerald-300 text-emerald-700' :
                                              job.approval_status === 'revision_requested' ? 'border-amber-300 text-amber-700' :
                                              job.approval_status === 'rejected' ? 'border-red-300 text-red-700' :
                                              job.approval_status === 'submitted' ? 'border-blue-300 text-blue-700' :
                                              'border-slate-200'
                                            }`}
                                          >
                                            <option value="pending">Pending Review</option>
                                            <option value="submitted">Submitted</option>
                                            <option value="approved">Approved</option>
                                            <option value="revision_requested">Revision Requested</option>
                                            <option value="rejected">Rejected</option>
                                          </select>
                                        </div>
                                        <div>
                                          <input
                                            type="text"
                                            placeholder="Approver name"
                                            value={job.approver || ''}
                                            onChange={(e) => updateJobApprover(job.job_id, e.target.value)}
                                            className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                          />
                                        </div>
                                      </div>
                                      {(job.approval_status === 'revision_requested' || job.approval_status === 'rejected') && (
                                        <textarea
                                          placeholder="Approval comments / revision notes..."
                                          value={job.approval_comments || ''}
                                          onChange={(e) => updateJobApprovalComments(job.job_id, e.target.value)}
                                          rows={2}
                                          className="w-full mt-2 text-[11px] border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                                        />
                                      )}
                                      {job.approved_at && (
                                        <p className="text-[9px] text-emerald-600 mt-1">
                                          Approved: {new Date(job.approved_at).toLocaleDateString()}
                                        </p>
                                      )}
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
                          onClick={openMediaPlanFilePicker}
                          className="px-3 py-1.5 text-[11px] rounded-full border border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                        >
                          Import media plan
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
                          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                              <th className="w-8 px-3 py-3 bg-slate-100">
                                <span className="sr-only">Select</span>
                              </th>
                              <th className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                                Platform
                              </th>
                              <th className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                                Placement
                              </th>
                              <th className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                                Size
                              </th>
                              <th className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                                Orientation
                              </th>
                              <th className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                                Media Type
                              </th>
                              <th className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
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
                <div className="space-y-4 w-full">
                  {/* Top-level Concept Canvas toolbar */}
                  <div className="flex flex-col gap-2 mb-2 w-full">
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
                          accept="image/*,application/pdf"
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
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          onClick={addConcept}
                          className="mt-2 px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full border border-teal-100"
                        >
                          Add first concept
                        </button>
                        <button
                          onClick={draftConceptsFromBrief}
                          disabled={conceptDraftLoading}
                          className={`mt-2 px-4 py-2 text-xs font-medium rounded-full border ${
                            conceptDraftLoading
                              ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'
                              : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                          }`}
                        >
                          {conceptDraftLoading ? 'Drafting…' : 'Draft from brief'}
                        </button>
                        <button
                          onClick={openConceptFilePicker}
                          className="mt-2 px-4 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-full border border-slate-200"
                        >
                          Upload concepts
                        </button>
                        <button
                          onClick={openConceptMediaPicker}
                          className="mt-2 px-4 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-full border border-slate-200"
                        >
                          Upload media
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 w-full">
                      {concepts.map((c, index) => {
                        const isOnMoodBoard = moodBoardConceptIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
                          >
                            {/* LEFT COLUMN: Concept Instructions (Asset Type → Audience Line → Fields → Description) */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-700">
                                  Concept Instructions
                                  {c.audienceLineIds && Array.isArray(c.audienceLineIds) && c.audienceLineIds.length > 0 && (
                                    <span className="ml-2 text-xs text-slate-400 font-normal">
                                      (Audience: {c.audienceLineIds.map((id) => {
                                        const lineIndex = matrixRows.findIndex((r) => r.id === id);
                                        const lineRow = matrixRows[lineIndex];
                                        const segmentName = lineRow
                                          ? String(
                                              lineRow.segment_name ?? lineRow.audience_segment ?? lineRow.audience ?? ''
                                            ).trim()
                                          : '';
                                        const lineLabel = (lineIndex + 1).toString().padStart(3, '0');
                                        return segmentName ? `${lineLabel} — ${segmentName}` : lineLabel;
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
                                <label className="text-[11px] font-medium text-slate-600 mb-2 block">Asset Type</label>
                                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 p-1 w-full">
                                  {(['image', 'copy', 'video'] as const).map((kind) => (
                                    <button
                                      key={kind}
                                      type="button"
                                      onClick={() => updateConceptField(index, 'kind', kind)}
                                      className={`flex-1 px-4 py-2 text-xs rounded-md transition-colors font-medium ${
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

                              {/* 1b. Funnel Stage Selector */}
                              <div className="border-t border-gray-100 pt-4">
                                <label className="text-[11px] font-medium text-slate-600 mb-2 block">Funnel Stage</label>
                                <div className="flex flex-wrap gap-1">
                                  {(['awareness', 'consideration', 'conversion', 'retention'] as const).map((stage) => {
                                    const isSelected = c.funnelStages?.includes(stage);
                                    const stageConfig = {
                                      awareness: { label: 'Awareness', color: 'purple', icon: '👀' },
                                      consideration: { label: 'Consideration', color: 'blue', icon: '🤔' },
                                      conversion: { label: 'Conversion', color: 'green', icon: '✅' },
                                      retention: { label: 'Retention', color: 'amber', icon: '🔄' },
                                    };
                                    const config = stageConfig[stage];
                                    return (
                                      <button
                                        key={stage}
                                        type="button"
                                        onClick={() => {
                                          setConcepts((prev) =>
                                            prev.map((concept, i) => {
                                              if (i !== index) return concept;
                                              const currentStages = concept.funnelStages || [];
                                              const newStages = currentStages.includes(stage)
                                                ? currentStages.filter((s) => s !== stage)
                                                : [...currentStages, stage];
                                              return { ...concept, funnelStages: newStages };
                                            })
                                          );
                                        }}
                                        className={`px-2 py-1 text-[10px] rounded-full transition-colors font-medium ${
                                          isSelected
                                            ? `bg-${config.color}-100 text-${config.color}-700 border border-${config.color}-300`
                                            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-300'
                                        }`}
                                      >
                                        {config.icon} {config.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 1c. Module Type (for DCO taxonomy) */}
                              <div>
                                <label className="text-[11px] font-medium text-slate-600 mb-2 block">Module Type</label>
                                <select
                                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
                                  value={c.moduleType || ''}
                                  onChange={(e) => updateConceptField(index, 'moduleType', e.target.value)}
                                >
                                  <option value="">Select module type...</option>
                                  <option value="hook">🎯 Hook (attention-grabber)</option>
                                  <option value="value_prop">💎 Value Proposition</option>
                                  <option value="proof_point">✓ Proof Point</option>
                                  <option value="product">📦 Product</option>
                                  <option value="offer">🏷️ Offer</option>
                                  <option value="cta">👆 CTA</option>
                                  <option value="end_card">🎬 End Card</option>
                                </select>
                              </div>

                              {/* 2. Audience Line Selection */}
                              <div className="border-t border-gray-100 pt-4">
                                <label className="text-[11px] font-medium text-slate-600 mb-2 block">Select Audience Line</label>
                                  <select
                                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
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
                                      const segmentName = String(
                                        row.segment_name ?? row.audience_segment ?? row.audience ?? ''
                                      ).trim();
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
                                          {segmentName ? ` — ${segmentName}` : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {/* Show selected audience lines */}
                                  {c.audienceLineIds && Array.isArray(c.audienceLineIds) && c.audienceLineIds.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {c.audienceLineIds.map((lineId) => {
                                        const lineIndex = matrixRows.findIndex((r) => r.id === lineId);
                                        const lineRow = matrixRows[lineIndex];
                                        const segmentName = lineRow
                                          ? String(
                                              lineRow.segment_name ?? lineRow.audience_segment ?? lineRow.audience ?? ''
                                            ).trim()
                                          : '';
                                        return (
                                          <span
                                            key={lineId}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded"
                                          >
                                            {(lineIndex + 1).toString().padStart(3, '0')}
                                            {segmentName ? (
                                              <span className="text-blue-600">{segmentName}</span>
                                            ) : null}
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
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
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
                      <button
                        type="button"
                        onClick={() => switchWorkspace('concepts')}
                        className="mt-1 px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full border border-teal-100"
                      >
                        Go to Concepts
                      </button>
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
                    <div className="max-h-[480px] overflow-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-[11px] table-auto">
                        <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            {feedFields
                              .filter((col) => visibleFeedFields.includes(col.key))
                              .map((col) => (
                              <th
                                key={col.key as string}
                                className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap"
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
          {workspaceGuidance && (
            <WorkspaceGuidanceBanner
              title={workspaceGuidance.title}
              body={workspaceGuidance.body}
              actionLabel={workspaceGuidance.actionLabel}
              onAction={workspaceGuidance.action}
              disabled={workspaceGuidance.disabled}
            />
          )}
          {workspaceView === 'concepts' && !hasAudienceMatrix && (
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-800">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px]">
                  Add at least one audience row so concepts can map to segments.
                </p>
                <button
                  type="button"
                  onClick={() => switchWorkspace('matrix')}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 whitespace-nowrap"
                >
                  Go to Audience Matrix
                </button>
              </div>
            </div>
          )}
          {workspaceView === 'production' && !hasConcepts && (
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-800">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px]">
                  Add or draft concepts before generating a production plan.
                </p>
                <button
                  type="button"
                  onClick={() => switchWorkspace('concepts')}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 whitespace-nowrap"
                >
                  Go to Concepts
                </button>
              </div>
            </div>
          )}
          {workspaceView === 'feed' && !hasProductionPlan && (
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-800">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px]">
                  Generate a production plan before building the feed.
                </p>
                <button
                  type="button"
                  onClick={() => switchWorkspace('production')}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 whitespace-nowrap"
                >
                  Go to Production
                </button>
              </div>
            </div>
          )}
          </div>

          {/* AI Assistant Panel - Right Side for Non-Brief Modules */}
          {showAIAssistant && (
            <div className="w-72 lg:w-80 flex-shrink-0 bg-white flex flex-col border-l border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 min-h-[56px] border-b border-gray-100 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-slate-800 truncate">
                  AI Assistant • {getCurrentModuleContext()} Helper • Advisory only
                </div>
              </div>
              <button
                onClick={() => setShowAIAssistant(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick Prompts */}
            {getCurrentModuleContext() && aiAssistantMessages.length === 0 && (
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick Actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {moduleQuickPrompts[getCurrentModuleContext()!]?.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendAIAssistantMessage(prompt.prompt)}
                      className="px-2.5 py-1 text-[10px] rounded-full border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {aiAssistantMessages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-600 font-medium">How can I help?</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                    Ask questions or use quick actions above to get started.
                  </p>
                </div>
              ) : (
                aiAssistantMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))
              )}
              {aiAssistantLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-100 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiAssistantInput}
                  onChange={(e) => setAiAssistantInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendAIAssistantMessage(aiAssistantInput);
                    }
                  }}
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 text-[12px] border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400"
                />
                <button
                  onClick={() => sendAIAssistantMessage(aiAssistantInput)}
                  disabled={!aiAssistantInput.trim() || aiAssistantLoading}
                  className="px-4 py-2 text-[11px] font-semibold bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
              {aiAssistantMessages.length > 0 && (
                <button
                  onClick={() => setAiAssistantMessages([])}
                  className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 w-full text-center"
                >
                  Clear conversation
                </button>
              )}
            </div>
          </div>
          )}
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
          <ModuleAssistantBar
            title={moduleAssistant.title}
            score={moduleAssistant.score}
            completionNote={moduleAssistant.completionNote}
            tips={moduleAssistant.tips}
            dataFlowNote={moduleAssistant.dataFlowNote}
          />
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
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          {audienceImportColumns.map((col) => (
                            <th key={col} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
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

      {/* Media Plan Import Modal */}
      {showMediaPlanImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <div>
                <h3 className="text-base font-bold text-slate-800">Import Media Plan</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Review and select placements to import from your media plan. Specs will be auto-created.
                </p>
              </div>
              <button
                onClick={() => setShowMediaPlanImport(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Selection controls */}
            <div className="px-5 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAllMediaPlanRows}
                  className="text-[10px] text-slate-600 hover:text-teal-700 underline"
                >
                  Select all ({mediaPlanParsedRows.length})
                </button>
                <button
                  onClick={clearMediaPlanSelection}
                  className="text-[10px] text-slate-600 hover:text-teal-700 underline"
                >
                  Clear selection
                </button>
              </div>
              <span className="text-[11px] text-slate-500">
                {mediaPlanParsedRows.filter(r => r.selected).length} of {mediaPlanParsedRows.length} selected
              </span>
            </div>

            {/* Placements table */}
            <div className="flex-1 overflow-auto px-5 py-4">
              <table className="min-w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200">
                  <tr className="text-left">
                    <th className="px-3 py-3 w-10"></th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Platform</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Placement</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Size</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Format</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Duration</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Budget</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Flight</th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">Targeting</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaPlanParsedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                        row.selected ? 'bg-teal-50/50' : ''
                      }`}
                      onClick={() => toggleMediaPlanRowSelection(row.id)}
                    >
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={row.selected || false}
                          onChange={() => toggleMediaPlanRowSelection(row.id)}
                          className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{row.platform}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.placement}</td>
                      <td className="py-2 pr-3">
                        {row.width && row.height ? (
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                            {row.width}×{row.height}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          row.media_type === 'video' ? 'bg-purple-100 text-purple-700' :
                          row.media_type === 'html5' ? 'bg-blue-100 text-blue-700' :
                          row.media_type === 'audio' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {row.media_type}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {row.duration ? `${row.duration}s` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {row.budget ? `$${row.budget.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {row.flight_start && row.flight_end ? (
                          <span className="text-[10px]">
                            {row.flight_start} → {row.flight_end}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 text-slate-600 max-w-[150px] truncate" title={row.targeting}>
                        {row.targeting || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {mediaPlanParsedRows.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <p>No placements found in the uploaded file.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <p className="text-[10px] text-slate-500">
                Selected placements will create specs and production matrix rows.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowMediaPlanImport(false)}
                  className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyMediaPlanImport}
                  disabled={!mediaPlanParsedRows.some(r => r.selected)}
                  className="px-4 py-1.5 text-[11px] rounded-full border border-indigo-500 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {mediaPlanParsedRows.filter(r => r.selected).length} placements
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for media plan import */}
      <input
        type="file"
        ref={mediaPlanFileInputRef}
        className="hidden"
        accept=".csv,.xlsx,.xls"
        onChange={handleMediaPlanFileChange}
      />

      {/* DCO Platform Export Modal */}
      {showDcoExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
              <div>
                <h3 className="text-base font-bold text-slate-800">Export to DCO Platform</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Export production jobs for trafficking to your DCO platform.
                </p>
              </div>
              <button
                onClick={() => setShowDcoExport(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Platform Selection */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide block mb-2">
                  Select Platform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'flashtalking', name: 'Flashtalking (Innovid)', format: 'CSV', color: 'blue' },
                    { id: 'innovid', name: 'Innovid Native', format: 'JSON', color: 'purple' },
                    { id: 'celtra', name: 'Celtra', format: 'JSON', color: 'orange' },
                    { id: 'storyteq', name: 'StoryTeq', format: 'CSV', color: 'green' },
                  ] as const).map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => {
                        setDcoExportPlatform(platform.id);
                        setDcoExportValidation(validateDcoExport(platform.id));
                      }}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        dcoExportPlatform === platform.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-slate-800">{platform.name}</p>
                      <p className="text-[10px] text-slate-500">{platform.format} format</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Summary */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-600">Export Summary</span>
                  <span className="text-[11px] text-slate-500">{builderJobs.length} assets</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="bg-white rounded p-2">
                    <span className="block font-bold text-slate-600">{builderJobs.filter(j => j.asset_type === 'video').length}</span>
                    <span className="text-slate-400">Video</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="block font-bold text-slate-600">{builderJobs.filter(j => j.asset_type === 'image').length}</span>
                    <span className="text-slate-400">Image</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="block font-bold text-slate-600">{builderJobs.filter(j => j.asset_type === 'html5' || j.asset_type === 'h5').length}</span>
                    <span className="text-slate-400">HTML5</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="block font-bold text-slate-600">{builderJobs.filter(j => j.asset_type === 'copy').length}</span>
                    <span className="text-slate-400">Copy</span>
                  </div>
                </div>
              </div>

              {/* Validation Results */}
              {dcoExportValidation.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-[11px] font-semibold text-red-700 mb-1">Errors (must fix before export)</p>
                  <ul className="text-[10px] text-red-600 space-y-0.5">
                    {dcoExportValidation.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {dcoExportValidation.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[11px] font-semibold text-amber-700 mb-1">Warnings (can proceed but review)</p>
                  <ul className="text-[10px] text-amber-600 space-y-0.5">
                    {dcoExportValidation.warnings.slice(0, 5).map((warn, idx) => (
                      <li key={idx}>• {warn}</li>
                    ))}
                    {dcoExportValidation.warnings.length > 5 && (
                      <li className="text-amber-500">...and {dcoExportValidation.warnings.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {dcoExportValidation.valid && dcoExportValidation.warnings.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-[11px] font-semibold text-emerald-700">
                    ✓ All {builderJobs.length} assets ready for export
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <p className="text-[10px] text-slate-500">
                File will download in {dcoExportPlatform === 'innovid' || dcoExportPlatform === 'celtra' ? 'JSON' : 'CSV'} format.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDcoExport(false)}
                  className="px-3 py-1.5 text-[11px] rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDcoExport}
                  disabled={!dcoExportValidation.valid}
                  className="px-4 py-1.5 text-[11px] rounded-full border border-purple-500 text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export to {dcoExportPlatform.charAt(0).toUpperCase() + dcoExportPlatform.slice(1)}
                </button>
              </div>
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

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Navigation</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Go to Brief</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">1</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Go to Audiences</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">2</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Go to Concepts</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">3</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Go to Production</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">4</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Go to Feed</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">5</kbd>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Editing</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Undo</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">⌘</kbd>
                      <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">Z</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Redo</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">⌘</kbd>
                      <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">⇧</kbd>
                      <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">Z</kbd>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">General</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Show this help</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">?</kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Close modals</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded border border-slate-200">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
