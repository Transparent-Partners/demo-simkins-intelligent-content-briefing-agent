# ModCon Planning Tool — Ecosystem Strategy

## Strategic Position

This tool sits **upstream** from production automation platforms (Flashtalking, Innovid, Clinch, Celtra, Storyteq, etc.) to solve the **planning and alignment gap** that causes:

1. **Content explosion** — Too many variants without strategic rationale
2. **Rework loops** — Production discovers issues too late
3. **Misalignment** — Creative, Production, and Media operating on different assumptions
4. **Feed chaos** — DCO feeds that don't match platform capabilities

---

## The Problem We Solve

### Before ModCon Planning Tool

```
Creative Team          Production Team         Media Team
     │                      │                      │
     ├─ PowerPoint Brief    │                      │
     │                      │                      │
     ├─ Email threads ──────┼──────────────────────┤
     │                      │                      │
     ├─ Spreadsheet ────────┼──────────────────────┤
     │  (outdated)          │                      │
     │                      │                      │
     └──────────────────────┴──────────────────────┘
                            │
                            ↓
              Production team discovers:
              • "We need 200 variants?!"
              • "This format doesn't exist on TikTok"
              • "Who approved this scope?"
              • "The feed structure won't work"
```

### After ModCon Planning Tool

```
┌─────────────────────────────────────────────────────────────┐
│                  ModCon Planning Workspace                   │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  [Creative Lens]  [Production Lens]  [Media Lens]  [All]    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Activation Brief (Strategic Truth)                    │ │
│  │  Audience & Signal Map                                 │ │
│  │  Content Scope Matrix  ←──── THE CONTRACT              │ │
│  │  Production Plan (with live impact)                    │ │
│  │  Media Alignment Plan                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [✓ Creative Aligned] [✓ Production Aligned] [✓ Media OK]   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
              Structured handoff to production:
              • Clear module definitions
              • Reuse opportunities identified
              • Platform constraints validated
              • Decisioning logic documented
```

---

## Downstream Platform Requirements

### What Production Automation Platforms Need

| Platform | Input Requirements | ModCon Must Provide |
|----------|-------------------|---------------------|
| **Flashtalking** | Feed CSV, asset files, decisioning rules | Module manifest, audience signals, creative rules |
| **Innovid** | Video modules, interactive logic, feed data | Module specs, interaction triggers, audience mapping |
| **Clinch** | Creative templates, data signals, business rules | Template definitions, signal mapping, logic documentation |
| **Celtra** | Component library, design tokens, variation rules | Component specs, design system alignment, variation matrix |
| **Storyteq** | Video templates, text/asset variations, render specs | Template structure, variable definitions, output specs |

### Common Requirements Across Platforms

1. **Module Definitions**
   - What are the reusable creative modules?
   - What variations exist for each module?
   - What are the slot specifications (text limits, asset dimensions)?

2. **Decisioning Logic**
   - IF [audience segment] THEN [message variant]
   - IF [contextual trigger] THEN [creative treatment]
   - IF [funnel stage] THEN [CTA variant]

3. **Feed Structure**
   - What columns/fields are needed?
   - What are the variable vs. static elements?
   - How do modules map to feed rows?

4. **Platform Constraints**
   - Character limits per placement
   - Supported formats and dimensions
   - Animation/video length limits
   - Interactive capability support

---

## Enhanced Data Model for Production Handoff

### Module Taxonomy

```typescript
type ModuleType = 
  | 'hook'          // Opening attention-grabber
  | 'value_prop'    // Core value proposition
  | 'proof_point'   // Social proof, testimonials, data
  | 'cta'           // Call to action
  | 'background'    // Visual background/texture
  | 'logo'          // Brand logo treatment
  | 'legal'         // Disclaimers, terms
  | 'audio'         // Voiceover, music, SFX
  | 'end_card';     // Closing frame

type Module = {
  id: string;
  type: ModuleType;
  name: string;
  description: string;
  
  // Variation control
  variations: ModuleVariation[];
  
  // Reuse tracking
  used_in_cells: string[];  // Content matrix cell IDs
  reuse_count: number;
  
  // Technical specs
  specs: {
    format: 'text' | 'image' | 'video' | 'audio' | 'html5';
    dimensions?: string;
    duration?: string;
    character_limit?: number;
  };
  
  // Source
  source_type: 'new_shoot' | 'existing_asset' | 'ugc' | 'stock' | 'generated';
  dam_reference?: string;
};

type ModuleVariation = {
  id: string;
  name: string;
  audience_id?: string;       // For audience-specific variants
  funnel_stage?: string;      // For funnel-specific variants
  trigger?: string;           // For context-triggered variants
  content_preview?: string;   // Preview text or thumbnail
};
```

### Decisioning Rules

```typescript
type DecisioningRule = {
  id: string;
  name: string;
  priority: number;           // Evaluation order
  
  // Condition
  condition: {
    type: 'audience' | 'funnel_stage' | 'trigger' | 'platform' | 'custom';
    operator: 'equals' | 'contains' | 'in' | 'not_in';
    value: string | string[];
  };
  
  // Action
  action: {
    module_id: string;
    variation_id: string;
  };
  
  // Fallback
  fallback_variation_id?: string;
};

type DecisioningLogic = {
  rules: DecisioningRule[];
  default_path: {
    [module_type: string]: string;  // Default variation per module type
  };
};
```

### Production Ticket

```typescript
type ProductionTicket = {
  id: string;
  ticket_number: string;      // e.g., "PROD-2026-001"
  
  // What to build
  module: Module;
  variations_to_create: ModuleVariation[];
  
  // Context
  campaign_id: string;
  audience_context: string[];
  placement_context: string[];
  
  // Specs
  output_specs: {
    format: string;
    dimensions: string;
    file_type: string;
    color_space?: string;
    compression?: string;
  }[];
  
  // Priority
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string;
  
  // Status
  status: 'backlog' | 'in_progress' | 'review' | 'approved' | 'delivered';
  assignee?: string;
  
  // Downstream destination
  destination_platform: string;  // e.g., "Flashtalking", "Innovid"
  feed_mapping?: {
    field_name: string;
    value_source: string;
  }[];
};
```

---

## Feed Structure Preview

### Standard DCO Feed Columns

```
| Column | Description | Source in ModCon |
|--------|-------------|------------------|
| row_id | Unique row identifier | Auto-generated |
| audience_id | Target segment | Audience Map |
| audience_name | Human-readable segment | Audience Map |
| placement_id | Platform + placement | Media Plan |
| hook_asset | Hook module asset path | Module Library |
| hook_text | Hook copy variant | Module Library |
| value_prop_asset | Value prop asset | Module Library |
| value_prop_text | Value prop copy | Module Library |
| cta_text | CTA button text | Module Library |
| cta_url | Click destination | Content Matrix |
| background_asset | Background asset | Module Library |
| logo_asset | Logo variant | Module Library |
| legal_text | Disclaimer | Module Library |
| start_date | Flight start | Media Plan |
| end_date | Flight end | Media Plan |
| priority | Rotation priority | Decisioning Rules |
```

---

## Platform Compatibility Matrix

| Capability | Flashtalking | Innovid | Clinch | Celtra | Storyteq |
|------------|--------------|---------|--------|--------|----------|
| Static Display | ✓ | ✓ | ✓ | ✓ | ✓ |
| Video | ✓ | ✓ | ✓ | ✓ | ✓ |
| Interactive | Limited | ✓ | ✓ | ✓ | Limited |
| Sequential Messaging | ✓ | ✓ | ✓ | ✓ | ✓ |
| Real-time Decisioning | ✓ | ✓ | ✓ | ✓ | Limited |
| A/B Testing | ✓ | ✓ | ✓ | ✓ | ✓ |
| Feed-based Versioning | ✓ | ✓ | ✓ | ✓ | ✓ |
| CTV Support | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audio Ads | Limited | ✓ | Limited | Limited | ✓ |
| Social In-feed | ✓ | Limited | ✓ | ✓ | ✓ |

---

## Recommended Enhancements

### Phase 1: Module-First Architecture
1. Add Module Library with taxonomy
2. Enable module-to-cell mapping in Content Matrix
3. Show reuse metrics prominently

### Phase 2: Decisioning Logic Editor
1. Visual rule builder (IF/THEN/ELSE)
2. Logic validation (no orphan rules)
3. Preview decisioning outcomes

### Phase 3: Platform Compatibility
1. Add platform constraint library
2. Flag incompatible combinations
3. Suggest platform-specific adjustments

### Phase 4: Production Ticket Generator
1. Auto-generate tickets from Content Matrix
2. Export to Asana, Monday, Jira
3. Track ticket status in-app

### Phase 5: Feed Preview & Export
1. Preview feed structure before handoff
2. Export feed templates
3. Validate against platform schemas

---

## Integration Roadmap

### Near-term (API-ready exports)
- CSV/Excel exports for feed templates
- JSON exports for structured data
- PDF exports for human review

### Mid-term (Webhook integrations)
- Push to project management tools
- Notify on alignment completion
- Sync with DAM for asset references

### Long-term (Direct platform integrations)
- Flashtalking API integration
- Innovid creative library sync
- Celtra template generation

---

## Success Metrics

| Metric | Current State | Target State |
|--------|---------------|--------------|
| Time from brief to production handoff | 2-3 weeks | 3-5 days |
| Scope change requests in production | 40%+ of projects | <10% |
| Asset reuse rate | Unknown | >40% |
| Production rework due to misalignment | 25%+ | <5% |
| DCO feed errors at trafficking | Common | Rare |

---

*This document defines the strategic position of the ModCon Planning Tool in the content operations stack and guides product development priorities.*
