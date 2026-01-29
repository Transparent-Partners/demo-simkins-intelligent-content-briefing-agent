'use client';

import { PlanningWorkspace } from '../components/layout/PlanningWorkspace';

// ============================================================================
// MODCON PLANNING WORKSPACE
// ============================================================================
// A Modular Activation Planning Workspace that outputs:
// - A single source of truth brief
// - A content scope + matrix
// - A production plan
// - A media-informed placement plan
// - A decisioning hypothesis
//
// This is NOT a DAM, trafficking tool, ad server, or creative generator.
// The UI feels closer to Notion × Miro × media planning software, not ChatGPT.
// ============================================================================

export default function PlanningPage() {
  return <PlanningWorkspace />;
}
