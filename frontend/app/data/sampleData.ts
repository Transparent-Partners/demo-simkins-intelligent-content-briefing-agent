export const INITIAL_STRATEGY_MATRIX_RUNNING_SHOES = [
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

export const INITIAL_MATRIX_LIBRARY = [
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

export const SAMPLE_JSON = {
  campaign_name: 'Summer Glow 2024',
  single_minded_proposition: 'Radiance that lasts all day.',
  primary_audience: 'Women 25-40, urban professionals, interested in clean beauty.',
  bill_of_materials: [
    {
      asset_id: 'VID-001',
      format: '9:16 Video',
      concept: 'Morning Routine ASMR',
      source_type: 'New Shoot',
      specs: '1080x1920, 15s, Sound On',
    },
    {
      asset_id: 'IMG-001',
      format: '4:5 Static',
      concept: 'Product Hero Shot on Sand',
      source_type: 'Stock Composite',
      specs: '1080x1350, JPEG',
    },
  ],
  logic_map: [
    {
      condition: "IF Weather = 'Sunny'",
      action: "SHOW 'Beach Day' Variant",
    },
    {
      condition: "IF Audience = 'Cart Abandoner'",
      action: "SHOW '10% Off' Overlay",
    },
  ],
  production_notes:
    'Ensure all lighting is natural. No heavy filters. Diversity in casting is mandatory.',
};

export const SAMPLE_NARRATIVE = `
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

export const SAMPLE_MATRIX = [
  { id: 'VID-001', audience: 'Broad', trigger: 'Always On', content: 'Morning Routine ASMR', format: '9:16 Video' },
  { id: 'IMG-001', audience: 'Retargeting', trigger: 'Cart Abandon', content: 'Product Hero + Discount', format: '4:5 Static' },
  { id: 'VID-002', audience: 'Loyalty', trigger: 'Purchase > 30d', content: 'Replenish Reminder', format: '9:16 Video' },
];

export const RUNNING_SHOE_DEMO_BRIEF = {
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

export const DEMO_SPECS = [
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
    notes: '6s max, punchy intro.',
  },
  {
    id: 'DEMO_DISPLAY_MPU',
    platform: 'Display',
    placement: 'MPU',
    width: 300,
    height: 250,
    orientation: 'Square',
    media_type: 'image',
    notes: 'Static JPG or PNG.',
  },
];
