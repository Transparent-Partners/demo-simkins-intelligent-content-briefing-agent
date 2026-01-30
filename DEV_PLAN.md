## Dev Plan

This plan sequences the ModCon workflow UX and platform hardening work into clear phases.

### Phase 1: Workflow Clarity (Now)
- Stage gate checklist with blockers and quick actions
- Per-workspace guidance banners
- Empty states with “next best actions”
- Consistent toasts for errors/success

### Phase 2: Performance + Stability
- Split `frontend/app/page.tsx` into feature components
- Memoize heavy panels (matrix, concepts, production)
- Async HTTP + retries in backend agent
- Spec caching + safe writes

### Phase 3: Scalability
- Rate limiting (backend)
- Replace in-memory stores with Redis/DB
- Background jobs for generation
- Structured error responses + observability

### Phase 4: Enterprise Integrations
- Workfront/Encodify/Storyteq/AEM connectors
- DAM asset linking + metadata sync
- Audit trails + role-based access

### Definition of Done
- Clear stage progression with blockers
- No dead-ends without a suggested action
- Consistent loading/progress feedback
- p95 latency targets met for key endpoints
