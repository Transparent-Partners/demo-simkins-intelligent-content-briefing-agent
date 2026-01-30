# Production Deployment Checklist

## Pre-Deployment Checklist

### Environment Configuration

- [ ] Set `ENVIRONMENT=production` in Cloud Run/Vercel
- [ ] Configure `ALLOWED_ORIGINS` with production domains (comma-separated)
  - Example: `https://yourdomain.com,https://www.yourdomain.com`
- [ ] Set `GOOGLE_API_KEY` for Gemini AI integration
- [ ] Set `APP_VERSION` to current release version
- [ ] Verify all secrets are in GitHub Secrets (not committed to repo)

### Backend (Cloud Run)

- [ ] Dockerfile builds successfully: `docker build -t modcon-backend ./backend`
- [ ] Health check passes: `curl https://your-backend-url/health`
- [ ] Readiness check passes: `curl https://your-backend-url/ready`
- [ ] Rate limiting configured appropriately for expected traffic
- [ ] Logging level set to INFO or WARNING (not DEBUG)

### Frontend (Vercel)

- [ ] `NEXT_PUBLIC_API_BASE_URL` points to production backend
- [ ] Build completes without errors: `npm run build`
- [ ] No console errors on initial page load
- [ ] All modules navigate correctly

### Security

- [ ] CORS restricted to production origins
- [ ] No API keys exposed in frontend code
- [ ] Rate limiting active
- [ ] HTTPS enforced on all endpoints

### Testing

- [ ] Unit tests pass: `npm run test`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] Manual smoke test of critical flows:
  - [ ] Brief creation and AI chat
  - [ ] Audience matrix import
  - [ ] Concept generation
  - [ ] Production job creation
  - [ ] DCO feed export

---

## Deployment Steps

### 1. Backend Deployment (Cloud Run)

```bash
# From repository root
cd backend

# Deploy via gcloud (or GitHub Actions)
gcloud run deploy intelligent-briefing-backend \
  --source . \
  --region us-central1 \
  --set-env-vars="ENVIRONMENT=production" \
  --set-env-vars="ALLOWED_ORIGINS=https://yourdomain.com" \
  --update-env-vars="GOOGLE_API_KEY=your-key"
```

### 2. Frontend Deployment (Vercel)

```bash
# From frontend directory
cd frontend

# Build and deploy
vercel --prod
```

### 3. Post-Deployment Verification

```bash
# Check backend health
curl https://your-backend-url/health

# Check backend readiness
curl https://your-backend-url/ready

# Check frontend loads
curl -I https://your-frontend-url
```

---

## Rollback Procedure

### Backend Rollback

```bash
# List recent revisions
gcloud run revisions list --service=intelligent-briefing-backend --region=us-central1

# Route traffic to previous revision
gcloud run services update-traffic intelligent-briefing-backend \
  --to-revisions=REVISION_NAME=100 \
  --region=us-central1
```

### Frontend Rollback

```bash
# Via Vercel dashboard or CLI
vercel rollback
```

---

## Monitoring & Alerting

### Recommended Setup

1. **Error Tracking**: Sentry or Rollbar
   - Frontend: Add `@sentry/nextjs`
   - Backend: Add `sentry-sdk[fastapi]`

2. **APM**: DataDog or New Relic
   - Monitor response times, error rates, throughput

3. **Logging**: Cloud Run logs → BigQuery (optional)
   - Set up log-based alerts for errors

4. **Uptime Monitoring**: UptimeRobot or Pingdom
   - Monitor `/health` endpoint every 1 minute

---

## Environment Variables Reference

### Backend (Cloud Run)

| Variable | Required | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | Yes | `production` or `development` |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `GOOGLE_API_KEY` | Yes | Gemini API key for AI features |
| `SENTRY_DSN` | Yes | Sentry DSN for error tracking |
| `APP_VERSION` | No | Version string for tracking (auto-set from git SHA) |
| `RATE_LIMIT_WINDOW_SECONDS` | No | Rate limit window (default: 60) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (default: 120) |
| `MAX_UPLOAD_MB` | No | Max file upload size (default: 10) |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_SENTRY_DSN` | Yes | Sentry DSN for frontend error tracking |
| `SENTRY_ORG` | No | Sentry organization (for source maps) |
| `SENTRY_PROJECT` | No | Sentry project (for source maps) |
| `SENTRY_AUTH_TOKEN` | No | Sentry auth token (for source maps) |

### GitHub Secrets Required

| Secret | Used By | Description |
|--------|---------|-------------|
| `GCP_SA_KEY` | Backend | GCP service account key JSON |
| `GOOGLE_API_KEY` | Backend | Gemini API key |
| `SENTRY_DSN_BACKEND` | Backend | Sentry DSN for backend |
| `ALLOWED_ORIGINS` | Backend | Production CORS origins |
| `VERCEL_TOKEN` | Frontend | Vercel deployment token |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Backend API URL |
| `SENTRY_DSN_FRONTEND` | Frontend | Sentry DSN for frontend |

---

## Support Contacts

- **Engineering**: [your-team@company.com]
- **On-Call**: [oncall-rotation]
- **Escalation**: [escalation-path]

---

*Last Updated: January 2026*
