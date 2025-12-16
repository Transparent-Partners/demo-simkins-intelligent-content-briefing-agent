# Asset Generation Setup Guide

This guide explains how to set up and use Google Cloud Vertex AI for image and video generation in the concepting module.

## Overview

The asset generation service uses:
- **Imagen 3** (via Vertex AI) for image generation
- **Veo 2** (via Vertex AI) for video generation

## Prerequisites

1. **Google Cloud Project** with the following APIs enabled:
   - Vertex AI API
   - Cloud Storage API (for storing generated assets)

2. **Service Account** with the following roles:
   - Vertex AI User
   - Storage Object Admin (for Cloud Storage bucket)

3. **Environment Variables** (set in `.env` or Cloud Run):
   ```
   GOOGLE_API_KEY=your-api-key
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   GCS_BUCKET_NAME=your-bucket-name
   ```

## Setup Steps

### 1. Enable APIs

```bash
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage-api.googleapis.com
```

### 2. Create Cloud Storage Bucket

```bash
gsutil mb -p your-project-id -l us-central1 gs://your-bucket-name
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

### 3. Install Dependencies

The required packages are already in `requirements.txt`:
- `google-cloud-aiplatform==1.68.0`
- `google-cloud-storage==2.18.0`

Install with:
```bash
pip install -r requirements.txt
```

## API Endpoints

### Generate Asset

**POST** `/generate-asset`

Request:
```json
{
  "kind": "image" | "video" | "copy",
  "prompt": "A beautiful sunset over mountains"
}
```

Response:
```json
{
  "kind": "image",
  "prompt": "A beautiful sunset over mountains",
  "status": "completed",
  "asset_url": "https://storage.googleapis.com/...",
  "job_id": null,
  "error": null
}
```

For video generation, the response will include a `job_id`:
```json
{
  "kind": "video",
  "prompt": "A beautiful sunset over mountains",
  "status": "queued",
  "asset_url": null,
  "job_id": "video-1234567890",
  "error": null
}
```

### Check Video Job Status

**POST** `/check-video-job`

Request:
```json
{
  "job_id": "video-1234567890"
}
```

Response:
```json
{
  "status": "completed" | "processing" | "error",
  "asset_url": "https://storage.googleapis.com/...",
  "job_id": "video-1234567890",
  "error": null
}
```

## Usage in Frontend

The frontend can call these endpoints when generating concepts:

```typescript
// Generate an image
const response = await fetch(`${API_BASE_URL}/generate-asset`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'image',
    prompt: conceptDescription
  })
});

// For video, poll for completion
if (response.kind === 'video' && response.job_id) {
  // Poll /check-video-job until status is 'completed'
}
```

## Notes

- **Image Generation**: Synchronous, returns immediately with asset URL
- **Video Generation**: Asynchronous, returns job ID that must be polled
- **Storage**: Generated assets are automatically uploaded to Cloud Storage
- **Costs**: Both Imagen and Veo are billed per generation. Check Google Cloud pricing.

## Troubleshooting

1. **"GOOGLE_CLOUD_PROJECT not set"**: Ensure the environment variable is set
2. **"Veo API not available"**: Ensure Vertex AI API is enabled and you have access to Veo models
3. **Storage errors**: Check that the bucket exists and the service account has permissions

