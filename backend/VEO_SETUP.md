# Veo Video Generation API Setup Guide

This guide explains how to enable and configure Google Cloud Veo for video generation.

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Vertex AI API** enabled
3. **Veo Access** - May require special access/whitelist (contact Google Cloud support)

## Step-by-Step Setup

### 1. Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com --project=interview-to-user-stories
```

Or via Console:
- Go to [APIs & Services](https://console.cloud.google.com/apis/dashboard)
- Search for "Vertex AI API"
- Click "Enable"

### 2. Request Veo Access (if needed)

Veo may require special access. Check:
- [Vertex AI Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)
- Look for "Veo" models
- If not visible, contact Google Cloud Support to request access

### 3. Create Service Account

Veo requires service account authentication (not API keys):

```bash
# Create service account
gcloud iam service-accounts create veo-video-generator \
  --display-name="Veo Video Generator" \
  --project=interview-to-user-stories

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding interview-to-user-stories \
  --member="serviceAccount:veo-video-generator@interview-to-user-stories.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create and download key
gcloud iam service-accounts keys create ~/veo-service-account-key.json \
  --iam-account=veo-video-generator@interview-to-user-stories.iam.gserviceaccount.com \
  --project=interview-to-user-stories
```

### 4. Set Environment Variables

Add to your `.env` file:

```bash
# Service account for Veo (required for video generation)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/veo-service-account-key.json

# Or set the path relative to backend/
GOOGLE_APPLICATION_CREDENTIALS=veo-service-account-key.json
```

### 5. Update Code Implementation

The code will automatically use service account authentication when `GOOGLE_APPLICATION_CREDENTIALS` is set.

## Veo API Details

### Model Information
- **Model ID**: `video-generate@006` or `veo-2.0-generate-001`
- **Region**: `us-central1` (check availability in your region)
- **Endpoint**: Vertex AI Prediction API

### Pricing (as of 2024)
- **Veo 3.1 Standard**: $0.20 per second (video only)
- **Veo 3.1 Fast**: $0.10 per second (video only)
- Video + Audio: Higher rates

### API Characteristics
- **Async**: Video generation is asynchronous (returns operation/job)
- **Duration**: Typically 5-10 seconds per video
- **Processing Time**: 2-5 minutes per video
- **Format**: MP4, various resolutions up to 1080p

## Testing Veo Access

Once set up, test with:

```bash
curl -X POST http://localhost:8000/generate-asset \
  -H "Content-Type: application/json" \
  -d '{"kind": "video", "prompt": "A beautiful sunset over mountains"}'
```

If properly configured, you should receive a `job_id` instead of an error.

## Troubleshooting

1. **"Access denied"**: Check service account permissions
2. **"Model not found"**: Veo may not be available in your region/project
3. **"Quota exceeded"**: Check API quotas in Cloud Console
4. **"Billing not enabled"**: Ensure billing is set up for the project

## Next Steps

After setup:
1. Update `asset_generator.py` to use the actual Veo API
2. Implement job polling for async video generation
3. Add video storage to Cloud Storage
4. Update frontend to poll for video completion

