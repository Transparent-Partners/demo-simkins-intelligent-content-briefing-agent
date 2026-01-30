# Product Engineering Backlog

This backlog captures platform stability, performance, scalability, and UX improvements.
Items are grouped by impact horizon. Each item should be broken into small, testable tickets.

## Now (0-2 weeks)
- Replace blocking HTTP calls in backend agent with async client + retries.
- Cache platform and custom specs with TTL and safe writes.
- Standardize frontend error handling using toast notifications.
- Add upload size validation and user feedback for file inputs.
- Add basic API rate limiting in backend.
- Introduce structured error responses (error code, message, details).

## Next (2-6 weeks)
- Split large `frontend/app/page.tsx` into scoped components with memoization.
- Add request deduplication + caching with SWR or React Query.
- Move in-memory batch/asset state to Redis or DB.
- Add background jobs for asset generation (Celery/RQ/Cloud Tasks).
- Add granular ErrorBoundary segments for high-risk UI modules.
- Add observability: request logging, metrics, and tracing.

## Later (6+ weeks)
- Migrate JSON-based specs storage to Postgres with versioning.
- Add circuit breaker for external API dependencies.
- Build file processing pipeline with worker pool and backpressure.
- Implement role-based access and audit trails.
- Add multi-tenant configuration and per-client quotas.
