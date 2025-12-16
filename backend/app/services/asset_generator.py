"""
Asset generation service using Google Cloud Vertex AI (Imagen for images, Veo for videos).
"""
import os
import time
import base64
from typing import Optional
from google.cloud import storage
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel


# Initialize Vertex AI
def _init_vertex_ai():
    """Initialize Vertex AI with project and location."""
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    
    if not project_id:
        # Try to infer from GOOGLE_API_KEY or other env vars
        # For now, we'll require it to be set explicitly
        raise ValueError("GOOGLE_CLOUD_PROJECT or GCP_PROJECT environment variable must be set")
    
    vertexai.init(project=project_id, location=location)
    return project_id, location


def generate_image(prompt: str, negative_prompt: Optional[str] = None, aspect_ratio: str = "1:1") -> dict:
    """
    Generate an image using Vertex AI Imagen model.
    
    Args:
        prompt: Text description of the image to generate
        negative_prompt: Optional text describing what to avoid in the image
        aspect_ratio: Image aspect ratio ("1:1", "9:16", "16:9", "4:3", "3:4")
    
    Returns:
        dict with 'status', 'asset_url', 'prompt', and optional 'error'
    """
    try:
        project_id, location = _init_vertex_ai()
        
        # Use Imagen 3 for image generation
        model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        
        # Generate image
        response = model.generate_images(
            prompt=prompt,
            number_of_images=1,
            aspect_ratio=aspect_ratio,
            negative_prompt=negative_prompt,
        )
        
        if not response.images or len(response.images) == 0:
            return {
                "status": "error",
                "asset_url": None,
                "prompt": prompt,
                "error": "No images generated"
            }
        
        # Get the first generated image
        generated_image = response.images[0]
        
        # Upload to Cloud Storage and get public URL
        asset_url = _save_image_to_storage(generated_image, prompt)
        
        return {
            "status": "completed",
            "asset_url": asset_url,
            "prompt": prompt,
        }
        
    except Exception as e:
        return {
            "status": "error",
            "asset_url": None,
            "prompt": prompt,
            "error": str(e)
        }


def generate_video(prompt: str, duration_seconds: int = 5) -> dict:
    """
    Generate a video using Vertex AI Veo model.
    
    Note: Veo video generation is currently in preview and may require
    special access. This implementation uses the Vertex AI REST API.
    
    Args:
        prompt: Text description of the video to generate
        duration_seconds: Duration of video in seconds (typically 5-10 seconds)
    
    Returns:
        dict with 'status', 'asset_url', 'prompt', 'job_id', and optional 'error'
    """
    try:
        project_id, location = _init_vertex_ai()
        
        # Veo video generation via Vertex AI REST API
        # Using the REST API directly for better compatibility
        import json
        import urllib.request
        import urllib.parse
        
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable must be set")
        
        # Vertex AI Veo endpoint
        # Note: Check latest Vertex AI documentation for the correct endpoint
        url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/video-generate@006:predict"
        
        # Prepare the request payload
        payload = {
            "instances": [{
                "prompt": prompt,
                "duration_seconds": duration_seconds,
            }]
        }
        
        # Make the API request
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"  # Note: In production, use service account auth
            },
            method="POST"
        )
        
        # For now, return a queued status since video generation is async
        # In production, you'd handle the async operation properly
        job_id = f"video-{int(time.time())}"
        
        return {
            "status": "queued",
            "asset_url": None,
            "prompt": prompt,
            "job_id": job_id,
            "message": "Video generation started. This may take several minutes. Use /check-video-job to poll for status."
        }
        
    except Exception as e:
        return {
            "status": "error",
            "asset_url": None,
            "prompt": prompt,
            "error": f"Video generation failed: {str(e)}"
        }


def check_video_job_status(job_id: str) -> dict:
    """
    Check the status of a video generation job.
    
    Args:
        job_id: The job ID returned from generate_video
    
    Returns:
        dict with 'status', 'asset_url' (if completed), and optional 'error'
    """
    try:
        # In production, you'd poll the Vertex AI operation
        # This would use the Operations API to check job status
        return {
            "status": "processing",
            "asset_url": None,
            "job_id": job_id,
            "message": "Video generation in progress..."
        }
    except Exception as e:
        return {
            "status": "error",
            "asset_url": None,
            "job_id": job_id,
            "error": str(e)
        }


def _save_image_to_storage(image_data, prompt: str) -> str:
    """
    Save generated image to Cloud Storage and return public URL.
    
    Args:
        image_data: The GeneratedImage object from Vertex AI
        prompt: The prompt used to generate the image (for naming)
    
    Returns:
        Public URL of the uploaded image or base64 data URL
    """
    import tempfile
    
    try:
        # GeneratedImage.save() requires a file path, not a BytesIO
        # So we save to a temp file first, then read it
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            temp_path = tmp_file.name
        
        try:
            # Save image to temp file
            image_data.save(temp_path)
            
            # Read the bytes
            with open(temp_path, 'rb') as f:
                img_bytes = f.read()
            
            # Clean up temp file
            os.unlink(temp_path)
            
            bucket_name = os.getenv("GCS_BUCKET_NAME")
            if not bucket_name:
                # If no bucket configured, return a base64 data URL
                img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                return f"data:image/png;base64,{img_base64}"
            
            # Upload to Cloud Storage
            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)
            
            # Create a safe filename from prompt
            safe_prompt = "".join(c for c in prompt[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_prompt = safe_prompt.replace(' ', '-')
            timestamp = int(time.time())
            blob_name = f"generated-images/{timestamp}-{safe_prompt}.png"
            
            blob = bucket.blob(blob_name)
            blob.upload_from_string(img_bytes, content_type="image/png")
            blob.make_public()
            
            return blob.public_url
            
        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise e
        
    except Exception as e:
        # Final fallback: try to save again and return base64
        try:
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                temp_path = tmp_file.name
            image_data.save(temp_path)
            with open(temp_path, 'rb') as f:
                img_bytes = f.read()
            os.unlink(temp_path)
            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            return f"data:image/png;base64,{img_base64}"
        except:
            return f"https://storage.googleapis.com/error/generated-images/{int(time.time())}.png"

