# Environment Variables Setup Guide

This guide explains where to set environment variables for different deployment environments.

## Required Environment Variables

```
GOOGLE_API_KEY=your-gemini-api-key
GEMINI_MODEL=models/gemini-2.5-pro
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GCS_BUCKET_NAME=your-bucket-name
```

## 1. Local Development

Create a `.env` file in the `backend/` directory:

```bash
cd backend
cp env.example .env
```

Then edit `.env` with your actual values:

```bash
GOOGLE_API_KEY=your-actual-api-key-here
GEMINI_MODEL=models/gemini-2.5-pro
GOOGLE_CLOUD_PROJECT=interview-to-user-stories
GOOGLE_CLOUD_LOCATION=us-central1
GCS_BUCKET_NAME=your-bucket-name
```

**Note:** The `.env` file is already in `.gitignore`, so it won't be committed to git.

## 2. Google Cloud Run (Production)

You have two options to set environment variables in Cloud Run:

### Option A: Using gcloud CLI (Recommended)

```bash
gcloud run services update intelligent-briefing-backend \
  --region=us-central1 \
  --update-env-vars="GOOGLE_API_KEY=your-key,GOOGLE_CLOUD_PROJECT=interview-to-user-stories,GOOGLE_CLOUD_LOCATION=us-central1,GCS_BUCKET_NAME=your-bucket-name,GEMINI_MODEL=models/gemini-2.5-pro"
```

### Option B: Using Google Cloud Console

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on `intelligent-briefing-backend` service
3. Click **EDIT & DEPLOY NEW REVISION**
4. Go to **Variables & Secrets** tab
5. Click **ADD VARIABLE** for each environment variable:
   - `GOOGLE_API_KEY` = your API key
   - `GOOGLE_CLOUD_PROJECT` = `interview-to-user-stories`
   - `GOOGLE_CLOUD_LOCATION` = `us-central1`
   - `GCS_BUCKET_NAME` = your bucket name
   - `GEMINI_MODEL` = `models/gemini-2.5-pro`
6. Click **DEPLOY**

### Option C: Using Secret Manager (Most Secure)

For sensitive values like `GOOGLE_API_KEY`, use Google Secret Manager:

1. Create a secret:
   ```bash
   echo -n "your-api-key" | gcloud secrets create google-api-key --data-file=-
   ```

2. Grant Cloud Run access:
   ```bash
   gcloud secrets add-iam-policy-binding google-api-key \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. Reference in Cloud Run:
   ```bash
   gcloud run services update intelligent-briefing-backend \
     --region=us-central1 \
     --update-secrets="GOOGLE_API_KEY=google-api-key:latest"
   ```

## 3. GitHub Actions (CI/CD)

Add secrets to your GitHub repository:

1. Go to: `https://github.com/bsimkins11/Intelligent-content-briefing-agent/settings/secrets/actions`
2. Click **New repository secret**
3. Add these secrets:
   - `GOOGLE_API_KEY` - Your Gemini API key
   - `GCS_BUCKET_NAME` - Your Cloud Storage bucket name
   - `GCP_SA_KEY` - Your Google Cloud service account JSON key (for deployment)

The workflow will automatically use these secrets when deploying.

## Quick Setup Commands

### One-time setup for Cloud Run:

```bash
# Set all environment variables at once
gcloud run services update intelligent-briefing-backend \
  --region=us-central1 \
  --update-env-vars="GOOGLE_API_KEY=YOUR_KEY,GOOGLE_CLOUD_PROJECT=interview-to-user-stories,GOOGLE_CLOUD_LOCATION=us-central1,GCS_BUCKET_NAME=YOUR_BUCKET,GEMINI_MODEL=models/gemini-2.5-pro"
```

### Verify environment variables:

```bash
gcloud run services describe intelligent-briefing-backend \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

## Current Values

Based on your deployment:
- **Project ID**: `interview-to-user-stories`
- **Region**: `us-central1`
- **Service Name**: `intelligent-briefing-backend`

You still need to set:
- `GOOGLE_API_KEY` (if not already set)
- `GCS_BUCKET_NAME` (create a bucket first)

## Create Cloud Storage Bucket

If you haven't created the bucket yet:

```bash
# Create bucket
gsutil mb -p interview-to-user-stories -l us-central1 gs://your-bucket-name

# Make it publicly readable (for generated assets)
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

Replace `your-bucket-name` with your desired bucket name (must be globally unique).

