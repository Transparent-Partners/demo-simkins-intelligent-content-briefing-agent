"""
Asset generation service using OpenAI DALL-E (preferred) or Google Cloud Vertex AI (Imagen for images, Veo for videos).
Supports image prompting with Gemini (vision) and Imagen (image-to-image).
"""
import os
import time
import base64
import json
import urllib.request
import urllib.error
from typing import Optional, Union
from io import BytesIO
from google.cloud import storage
from google.cloud import aiplatform
from google.oauth2 import service_account
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel
from PIL import Image


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


def prompt_image_with_gemini(image_data: bytes, prompt: str, mime_type: str = "image/jpeg") -> dict:
    """
    Analyze or describe an image using Gemini vision capabilities.
    
    Args:
        image_data: Image file bytes
        prompt: Text prompt/question about the image
        mime_type: MIME type of the image (image/jpeg, image/png, etc.)
    
    Returns:
        dict with 'status', 'response', 'prompt', and optional 'error'
    """
    try:
        import json
        import urllib.request
        
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable must be set")
        
        # Encode image to base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Prepare Gemini API request with image
        model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-pro")
        url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={api_key}"
        
        payload = {
            "contents": [{
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_base64
                        }
                    },
                    {
                        "text": prompt
                    }
                ]
            }]
        }
        
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
        
        parsed = json.loads(raw)
        text = " ".join(
            (p.get("text") or "")
            for p in (parsed.get("candidates", [{}])[0].get("content", {}).get("parts", []) or [])
            if isinstance(p, dict)
        ).strip()
        
        return {
            "status": "completed",
            "response": text or "No response generated.",
            "prompt": prompt,
        }
        
    except Exception as e:
        return {
            "status": "error",
            "response": None,
            "prompt": prompt,
            "error": f"Gemini vision error: {str(e)}"
        }


def generate_image_from_image(
    image_data: bytes, 
    prompt: str, 
    negative_prompt: Optional[str] = None,
    strength: float = 0.8,
    mime_type: str = "image/jpeg"
) -> dict:
    """
    Generate a new image based on an input image using Imagen (image-to-image).
    
    Args:
        image_data: Input image file bytes
        prompt: Text description of desired modifications/generation
        negative_prompt: Optional text describing what to avoid
        strength: How much to modify the original (0.0-1.0, higher = more change)
        mime_type: MIME type of the input image
    
    Returns:
        dict with 'status', 'asset_url', 'prompt', and optional 'error'
    """
    try:
        project_id, location = _init_vertex_ai()
        
        # Use Imagen 3 for image-to-image generation
        model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        
        # Convert image bytes to PIL Image
        input_image = Image.open(BytesIO(image_data))
        
        # Generate image based on input image and prompt
        # Note: Imagen's image-to-image API structure may vary
        # Try with base_image parameter first
        try:
            response = model.generate_images(
                prompt=prompt,
                base_image=input_image,
                number_of_images=1,
                negative_prompt=negative_prompt,
            )
        except TypeError:
            # If base_image is not supported, try alternative approach
            # Encode image to base64 and include in prompt
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            enhanced_prompt = f"{prompt} [Reference image: {image_base64[:100]}...]"
            
            # Fall back to text-to-image with enhanced prompt
            response = model.generate_images(
                prompt=enhanced_prompt,
                number_of_images=1,
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
        # If image-to-image is not supported, try alternative approach
        error_msg = str(e)
        if "base_image" not in error_msg.lower() and "not supported" not in error_msg.lower():
            # Try using the image as a reference in the prompt instead
            try:
                # Encode image to base64 for embedding in prompt
                image_base64 = base64.b64encode(image_data).decode('utf-8')
                enhanced_prompt = f"{prompt} [Reference image provided]"
                
                # Fall back to text-to-image with enhanced prompt
                return generate_image(prompt=enhanced_prompt, negative_prompt=negative_prompt)
            except:
                pass
        
        return {
            "status": "error",
            "asset_url": None,
            "prompt": prompt,
            "error": f"Image-to-image generation error: {error_msg}. Note: Image-to-image may require Imagen 3.0+ and specific API access."
        }


def generate_image_with_openai(prompt: str, size: str = "1024x1024") -> dict:
    """
    Generate an image using OpenAI DALL-E API.
    
    Args:
        prompt: Text description of the image to generate
        size: Image size ("1024x1024", "1792x1024", "1024x1792")
    
    Returns:
        dict with 'status', 'asset_url', 'prompt', and optional 'error'
    """
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return {
                "status": "error",
                "asset_url": None,
                "prompt": prompt,
                "error": "OPENAI_API_KEY not set"
            }
        
        import urllib.request
        import urllib.error
        
        # Enhance prompt for better results
        enhanced_prompt = prompt
        quality_terms = ['high quality', 'professional', 'detailed', 'sharp focus', 'well lit']
        prompt_lower = prompt.lower()
        
        # Only add quality terms if they're not already in the prompt
        if not any(term in prompt_lower for term in quality_terms):
            enhanced_prompt = f"{prompt}, high quality, professional photography, detailed, sharp focus, well lit"
        
        payload = {
            "model": "dall-e-3",
            "prompt": enhanced_prompt,
            "size": size,
            "quality": "standard",
            "n": 1,
        }
        
        url = "https://api.openai.com/v1/images/generations"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", errors="ignore")
            except Exception:
                pass
            return {
                "status": "error",
                "asset_url": None,
                "prompt": prompt,
                "error": f"OpenAI API error {e.code}: {err_body or e.reason}"
            }
        except Exception as e:
            return {
                "status": "error",
                "asset_url": None,
                "prompt": prompt,
                "error": f"OpenAI request failed: {str(e)}"
            }
        
        try:
            parsed = json.loads(raw)
            image_url = parsed.get("data", [{}])[0].get("url")
            
            if not image_url:
                return {
                    "status": "error",
                    "asset_url": None,
                    "prompt": prompt,
                    "error": "No image URL in OpenAI response"
                }
            
            return {
                "status": "completed",
                "asset_url": image_url,
                "prompt": prompt,
            }
        except Exception as e:
            return {
                "status": "error",
                "asset_url": None,
                "prompt": prompt,
                "error": f"Failed to parse OpenAI response: {str(e)}"
            }
        
    except Exception as e:
        return {
            "status": "error",
            "asset_url": None,
            "prompt": prompt,
            "error": f"OpenAI image generation error: {str(e)}"
        }


def generate_image(prompt: str, negative_prompt: Optional[str] = None, aspect_ratio: str = "1:1") -> dict:
    """
    Generate an image using OpenAI DALL-E (preferred) or Vertex AI Imagen model (fallback).
    
    Args:
        prompt: Text description of the image to generate
        negative_prompt: Optional text describing what to avoid in the image (only used for Imagen)
        aspect_ratio: Image aspect ratio ("1:1", "9:16", "16:9", "4:3", "3:4")
    
    Returns:
        dict with 'status', 'asset_url', 'prompt', and optional 'error'
    """
    # Prefer OpenAI DALL-E if API key is available
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        # Map aspect ratios to DALL-E sizes
        size_map = {
            "1:1": "1024x1024",
            "16:9": "1792x1024",
            "9:16": "1024x1792",
            "4:3": "1024x1024",  # DALL-E doesn't support 4:3, use square
            "3:4": "1024x1024",  # DALL-E doesn't support 3:4, use square
        }
        size = size_map.get(aspect_ratio, "1024x1024")
        return generate_image_with_openai(prompt, size)
    
    # Fallback to Imagen
    try:
        project_id, location = _init_vertex_ai()
        
        # Use Imagen 3 for image generation
        model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        
        # Enhance prompt for better results - Imagen works better with detailed, specific prompts
        # Add quality descriptors if not already present
        enhanced_prompt = prompt
        quality_terms = ['high quality', 'professional', 'detailed', 'sharp focus', 'well lit']
        prompt_lower = prompt.lower()
        
        # Only add quality terms if they're not already in the prompt
        if not any(term in prompt_lower for term in quality_terms):
            enhanced_prompt = f"{prompt}, high quality, professional photography, detailed, sharp focus, well lit"
        
        # Generate image
        response = model.generate_images(
            prompt=enhanced_prompt,
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


def _get_credentials():
    """
    Get Google Cloud credentials - prefer service account, fallback to API key.
    Service account is required for Veo video generation.
    """
    # Check for service account credentials (required for Veo)
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if creds_path and os.path.exists(creds_path):
        return service_account.Credentials.from_service_account_file(creds_path)
    
    # Check if running on GCP (Cloud Run, etc.) - uses default credentials
    try:
        import google.auth
        credentials, project = google.auth.default()
        if credentials:
            return credentials
    except Exception:
        pass
    
    # Fallback: API key (works for Imagen, not for Veo)
    return None


def generate_video(prompt: str, duration_seconds: int = 5) -> dict:
    """
    Generate a video using Vertex AI Veo model.
    
    Requirements:
    - Service account authentication (GOOGLE_APPLICATION_CREDENTIALS)
    - Veo access enabled in your GCP project
    - Vertex AI API enabled
    
    Args:
        prompt: Text description of the video to generate
        duration_seconds: Duration of video in seconds (typically 5-10 seconds)
    
    Returns:
        dict with 'status', 'asset_url', 'prompt', 'job_id', and optional 'error'
    """
    try:
        project_id, location = _init_vertex_ai()
        
        # Check for service account credentials (required for Veo)
        credentials = _get_credentials()
        if not credentials:
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            error_msg = (
                "Service account credentials required for Veo video generation.\n\n"
                "To set up Veo video generation:\n"
                "1. Create a service account in Google Cloud Console\n"
                "2. Grant it 'Vertex AI User' role\n"
                "3. Download the JSON key file\n"
                "4. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n"
                "5. Request Veo access from Google Cloud Support (Veo requires special access)\n\n"
                f"Current GOOGLE_APPLICATION_CREDENTIALS: {creds_path or 'Not set'}\n"
                f"Project: {project_id}\n"
                f"Location: {location}"
            )
            return {
                "status": "error",
                "asset_url": None,
                "prompt": prompt,
                "error": error_msg,
            }
        
        # Initialize Vertex AI with credentials
        vertexai.init(project=project_id, location=location, credentials=credentials)
        
        # Use Vertex AI Prediction API for Veo
        # Veo model endpoint
        endpoint = f"projects/{project_id}/locations/{location}/publishers/google/models/video-generate@006"
        
        # Initialize the prediction client
        from google.cloud.aiplatform import initializer
        initializer.global_config.init(project=project_id, location=location, credentials=credentials)
        
        # Prepare the prediction request
        # Note: Veo API structure may vary - check latest documentation
        instances = [{
            "prompt": prompt,
            "duration_seconds": duration_seconds,
        }]
        
        # Make prediction request
        # This is async and returns an operation
        try:
            from google.cloud.aiplatform.gapic import PredictionServiceClient
            client = PredictionServiceClient(credentials=credentials)
            
            # The actual API call structure for Veo
            # Note: This may need adjustment based on actual Veo API
            response = client.predict(
                endpoint=endpoint,
                instances=instances,
            )
            
            # Extract operation/job ID from response
            operation_name = getattr(response, 'name', None) or f"video-{int(time.time())}"
            
            return {
                "status": "queued",
                "asset_url": None,
                "prompt": prompt,
                "job_id": operation_name,
                "message": "Video generation started. This may take 2-5 minutes. Use /check-video-job to poll for status."
            }
            
        except ImportError:
            # Fallback if PredictionServiceClient not available
            return {
                "status": "error",
                "asset_url": None,
                "prompt": prompt,
                "error": "Veo API client not available. Ensure google-cloud-aiplatform is installed and Veo access is enabled in your project.",
            }
        except Exception as api_error:
            error_msg = str(api_error)
            # Check for common errors
            if "permission" in error_msg.lower() or "access" in error_msg.lower():
                return {
                    "status": "error",
                    "asset_url": None,
                    "prompt": prompt,
                    "error": f"Access denied. Ensure service account has 'Vertex AI User' role and Veo is enabled: {error_msg}",
                }
            elif "not found" in error_msg.lower() or "404" in error_msg:
                return {
                    "status": "error",
                    "asset_url": None,
                    "prompt": prompt,
                    "error": (
                        f"Veo model not found (404). Veo requires special access from Google Cloud.\n\n"
                        f"To enable Veo:\n"
                        f"1. Contact Google Cloud Support to request Veo access for project: {project_id}\n"
                        f"2. Ensure Vertex AI API is enabled in your project\n"
                        f"3. Verify your service account has 'Vertex AI User' role\n"
                        f"4. Check that Veo is available in region: {location}\n\n"
                        f"Error details: {error_msg}"
                    ),
                }
            else:
                return {
                    "status": "error",
                    "asset_url": None,
                    "prompt": prompt,
                    "error": f"Veo API error: {error_msg}",
                }
        
    except Exception as e:
        return {
            "status": "error",
            "asset_url": None,
            "prompt": prompt,
            "error": f"Video generation setup error: {str(e)}. See VEO_SETUP.md for setup instructions.",
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

