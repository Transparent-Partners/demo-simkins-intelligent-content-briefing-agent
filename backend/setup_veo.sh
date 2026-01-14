#!/bin/bash
# Quick setup script for Veo video generation

PROJECT_ID="interview-to-user-stories"
SERVICE_ACCOUNT_NAME="veo-video-generator"
REGION="us-central1"

echo "Setting up Veo video generation for project: $PROJECT_ID"
echo ""

# 1. Enable Vertex AI API
echo "1. Enabling Vertex AI API..."
gcloud services enable aiplatform.googleapis.com --project=$PROJECT_ID

# 2. Create service account
echo ""
echo "2. Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --display-name="Veo Video Generator" \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "Service account may already exist"

# 3. Grant permissions
echo ""
echo "3. Granting Vertex AI User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --condition=None

# 4. Create and download key
echo ""
echo "4. Creating service account key..."
KEY_FILE="veo-service-account-key.json"
gcloud iam service-accounts keys create $KEY_FILE \
  --iam-account=${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com \
  --project=$PROJECT_ID

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add to backend/.env:"
echo "   GOOGLE_APPLICATION_CREDENTIALS=$KEY_FILE"
echo ""
echo "2. Check Veo access in Vertex AI Model Garden:"
echo "   https://console.cloud.google.com/vertex-ai/model-garden?project=$PROJECT_ID"
echo ""
echo "3. If Veo models are not visible, contact Google Cloud Support to request access"
echo ""
echo "⚠️  Keep the $KEY_FILE secure and add it to .gitignore"

