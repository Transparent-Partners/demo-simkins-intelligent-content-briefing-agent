export const HISTORICAL_BRIEFS = [
  {
    id: 'HB-001',
    campaign_name: 'Aurora Sleep OS Launch',
    single_minded_proposition: 'Turn any bedroom into a personalized sleep studio in one week.',
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
    id: 'HB-002',
    campaign_name: 'VoltCharge Go – Workplace Fast Charging',
    single_minded_proposition: 'Make every office parking spot feel like a premium EV perk.',
    primary_audience:
      'HR and Facilities leaders at mid-market companies offering EV charging as an employee benefit.',
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
    id: 'HB-003',
    campaign_name: 'HarvestBox Micro-Market for Multi-Family Buildings',
    single_minded_proposition: 'Turn your lobby into the most loved amenity in the building.',
    primary_audience:
      'Property managers and owners of Class A/B multi-family buildings in urban cores.',
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

export const PRESET_SPECS = [
  // Meta
  { id: 'META_REELS_9x16', platform: 'Meta', placement: 'Reels / Stories', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: '15-60s; avoid top/bottom UI zones.', max_duration_seconds: 60, aspect_ratio: '9:16', audio_guidance: 'Sound on recommended; ensure captions for accessibility' },
  { id: 'META_FEED_1x1', platform: 'Meta', placement: 'Feed', width: 1080, height: 1080, orientation: 'Square', media_type: 'image_or_video', notes: 'Center focal area; minimal text.', max_duration_seconds: 60, aspect_ratio: '1:1' },
  { id: 'META_FEED_4x5', platform: 'Meta', placement: 'Feed 4:5', width: 1080, height: 1350, orientation: 'Vertical', media_type: 'image_or_video', notes: 'Treat as tall card; keep CTA mid-frame.', max_duration_seconds: 60, aspect_ratio: '4:5' },
  { id: 'META_INSTREAM_16x9', platform: 'Meta', placement: 'In-Stream', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'Sound-on; avoid lower-third overlays.', max_duration_seconds: 120, aspect_ratio: '16:9', audio_guidance: 'Sound on; design for active viewing' },
  // TikTok
  { id: 'TIKTOK_IN_FEED_9x16', platform: 'TikTok', placement: 'In-Feed', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Hook in first 2s; keep text off right/bottom edges.', max_duration_seconds: 60, aspect_ratio: '9:16', audio_guidance: 'Sound on essential; native feel required' },
  { id: 'TIKTOK_SPARK_9x16', platform: 'TikTok', placement: 'Spark Ads', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Native post re-use; captions high.', max_duration_seconds: 60, aspect_ratio: '9:16', audio_guidance: 'Sound on essential; use trending sounds where appropriate' },
  // YouTube
  { id: 'YOUTUBE_SHORTS_9x16', platform: 'YouTube', placement: 'Shorts', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Vertical; central band safe.', max_duration_seconds: 60, aspect_ratio: '9:16', audio_guidance: 'Sound on recommended' },
  { id: 'YOUTUBE_INSTREAM_16x9', platform: 'YouTube', placement: 'In-Stream', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'Sound-on; TV-safe margins.', max_duration_seconds: 180, aspect_ratio: '16:9', audio_guidance: 'Sound on; hook within 5s for skippable' },
  { id: 'YOUTUBE_BUMPER_16x9', platform: 'YouTube', placement: 'Bumper', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: '6s cap; message by 2s.', max_duration_seconds: 6, aspect_ratio: '16:9', audio_guidance: 'Sound on; single message only' },
  // LinkedIn
  { id: 'LINKEDIN_IMAGE_1x1', platform: 'LinkedIn', placement: 'Sponsored Image', width: 1200, height: 1200, orientation: 'Square', media_type: 'image', notes: 'B2B clarity; sparse text.', aspect_ratio: '1:1' },
  { id: 'LINKEDIN_VIDEO_1x1', platform: 'LinkedIn', placement: 'Sponsored Video 1:1', width: 1080, height: 1080, orientation: 'Square', media_type: 'video', notes: 'Subtitles above lower quarter.', max_duration_seconds: 30, aspect_ratio: '1:1', audio_guidance: 'Design for sound off; subtitles required' },
  { id: 'LINKEDIN_VIDEO_16x9', platform: 'LinkedIn', placement: 'Sponsored Video 16:9', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'Assume sound-off; clear supers.', max_duration_seconds: 30, aspect_ratio: '16:9', audio_guidance: 'Design for sound off; use supers for key messaging' },
  // X / Twitter
  { id: 'X_IMAGE_16x9', platform: 'X', placement: 'Promoted Image 16:9', width: 1600, height: 900, orientation: 'Horizontal', media_type: 'image', notes: 'Avoid corner copy; tweet text carries message.', aspect_ratio: '16:9' },
  { id: 'X_IMAGE_1x1', platform: 'X', placement: 'Promoted Image 1:1', width: 1200, height: 1200, orientation: 'Square', media_type: 'image', notes: 'Square preview; avoid tiny legal.', aspect_ratio: '1:1' },
  { id: 'X_VIDEO_9x16', platform: 'X', placement: 'Vertical Video', width: 1080, height: 1920, orientation: 'Vertical', media_type: 'video', notes: 'Subtitles above progress bar.', max_duration_seconds: 140, aspect_ratio: '9:16', audio_guidance: 'Sound optional; add captions' },
  // Google Display / Open Web (IAB)
  { id: 'GDN_MPU_300x250', platform: 'Open Web', placement: 'MPU', width: 300, height: 250, orientation: 'Rectangle', media_type: 'image_or_html5', notes: 'Max 150kb; logo + short CTA.', file_size_limit_kb: 150 },
  { id: 'GDN_LEADERBOARD_728x90', platform: 'Open Web', placement: 'Leaderboard', width: 728, height: 90, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Tight height; prioritize logo + CTA.', file_size_limit_kb: 150 },
  { id: 'GDN_SUPER_LEADERBOARD_970x90', platform: 'Open Web', placement: 'Super Leaderboard', width: 970, height: 90, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Wide canvas; maintain safe margins for responsive resize.', file_size_limit_kb: 150 },
  { id: 'GDN_HALF_PAGE_300x600', platform: 'Open Web', placement: 'Half Page', width: 300, height: 600, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Tall canvas; hook in top half.', file_size_limit_kb: 150 },
  { id: 'GDN_BILLBOARD_970x250', platform: 'Open Web', placement: 'Billboard', width: 970, height: 250, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Hero-friendly; maintain safe margins.', file_size_limit_kb: 150 },
  { id: 'GDN_SKYSCRAPER_160x600', platform: 'Open Web', placement: 'Wide Skyscraper', width: 160, height: 600, orientation: 'Vertical', media_type: 'image_or_html5', notes: 'Stack vertically; avoid dense copy at bottom.', file_size_limit_kb: 150 },
  { id: 'GDN_MED_RECT_336x280', platform: 'Open Web', placement: 'Med Rectangle', width: 336, height: 280, orientation: 'Rectangle', media_type: 'image_or_html5', notes: 'Larger MPU variant; keep hierarchy simple.', file_size_limit_kb: 150 },
  { id: 'GDN_SQUARE_250x250', platform: 'Open Web', placement: 'Square', width: 250, height: 250, orientation: 'Square', media_type: 'image_or_html5', notes: 'Compact square; minimal copy.', file_size_limit_kb: 150 },
  { id: 'GDN_MOBILE_LEADERBOARD_320x50', platform: 'Open Web', placement: 'Mobile Leaderboard', width: 320, height: 50, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Extremely short; logo + 1-2 words.', file_size_limit_kb: 150 },
  { id: 'GDN_MOBILE_LARGE_320x100', platform: 'Open Web', placement: 'Mobile Banner', width: 320, height: 100, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'More vertical room than 320x50; keep concise CTA.', file_size_limit_kb: 150 },
  { id: 'GDN_MOBILE_BANNER_300x50', platform: 'Open Web', placement: 'Mobile Banner 300x50', width: 300, height: 50, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Small; favor logo + CTA only.', file_size_limit_kb: 150 },
  { id: 'GDN_BANNER_468x60', platform: 'Open Web', placement: 'Banner 468x60', width: 468, height: 60, orientation: 'Horizontal', media_type: 'image_or_html5', notes: 'Legacy size; keep elements centered.', file_size_limit_kb: 150 },
  // CTV
  { id: 'CTV_FULLSCREEN_16x9', platform: 'CTV', placement: 'Full Screen', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'TV-safe framing; allow overscan margins.', max_duration_seconds: 30, aspect_ratio: '16:9', audio_guidance: 'Sound on; TV viewing context' },
  { id: 'CTV_QUARTERSCREEN_16x9', platform: 'CTV', placement: 'Quarter Screen Overlay', width: 960, height: 540, orientation: 'Horizontal', media_type: 'video_or_image', notes: 'Overlay; avoid lower-third UI.', max_duration_seconds: 15, aspect_ratio: '16:9' },
  { id: 'CTV_SLATE_16x9', platform: 'CTV', placement: 'End Slate', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video_or_image', notes: '3-5s slate; large CTA and URL.', max_duration_seconds: 5, aspect_ratio: '16:9' },
  // Amazon (demo)
  { id: 'AMZ_SP_1x1', platform: 'Amazon', placement: 'Sponsored Display 1:1', width: 1200, height: 1200, orientation: 'Square', media_type: 'image', notes: 'High-contrast CTA; 20% text max.', aspect_ratio: '1:1' },
  { id: 'AMZ_SP_1x1_VIDEO', platform: 'Amazon', placement: 'Sponsored Video 1:1', width: 1080, height: 1080, orientation: 'Square', media_type: 'video', notes: '6-15s; hook in first 1s.', max_duration_seconds: 15, aspect_ratio: '1:1', audio_guidance: 'Design for sound off; use text overlays' },
  { id: 'AMZ_DSP_16x9', platform: 'Amazon', placement: 'DSP Video 16:9', width: 1920, height: 1080, orientation: 'Horizontal', media_type: 'video', notes: 'CTV-safe; show product in 2s.', max_duration_seconds: 30, aspect_ratio: '16:9', audio_guidance: 'Sound on for CTV delivery' },
  // Retail / CRM
  { id: 'CRM_EMAIL_HERO', platform: 'CRM', placement: 'Email Hero', width: 1200, height: 600, orientation: 'Horizontal', media_type: 'image', notes: 'Keep CTA above the fold.', aspect_ratio: '2:1' },
  { id: 'CRM_EMAIL_TILE', platform: 'CRM', placement: 'Email Tile', width: 600, height: 600, orientation: 'Square', media_type: 'image', notes: 'Short copy; use overlays sparingly.', aspect_ratio: '1:1' },
  { id: 'RETAIL_APP_BANNER', platform: 'Retail App', placement: 'App Banner', width: 1080, height: 400, orientation: 'Horizontal', media_type: 'image', notes: 'Keep logo left and CTA right.', aspect_ratio: '2.7:1' },
];
