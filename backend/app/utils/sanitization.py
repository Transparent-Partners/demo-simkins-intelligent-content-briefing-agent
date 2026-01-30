"""
Input sanitization and validation utilities for production security.
"""
import re
import html
from typing import Any, Dict, List, Optional


# ============================================================================
# STRING SANITIZATION
# ============================================================================

def sanitize_string(value: str, max_length: int = 10000) -> str:
    """
    Sanitize a string input by:
    - Stripping leading/trailing whitespace
    - Escaping HTML entities
    - Truncating to max length
    - Removing null bytes
    """
    if not isinstance(value, str):
        return ""
    
    # Remove null bytes
    value = value.replace("\x00", "")
    
    # Strip whitespace
    value = value.strip()
    
    # Escape HTML entities
    value = html.escape(value)
    
    # Truncate
    if len(value) > max_length:
        value = value[:max_length]
    
    return value


def sanitize_html(value: str, max_length: int = 50000) -> str:
    """
    Sanitize HTML content (more permissive than sanitize_string).
    Removes script tags and dangerous attributes.
    """
    if not isinstance(value, str):
        return ""
    
    # Remove null bytes
    value = value.replace("\x00", "")
    
    # Remove script tags
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove on* event handlers
    value = re.sub(r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', value, flags=re.IGNORECASE)
    
    # Remove javascript: URLs
    value = re.sub(r'href\s*=\s*["\']javascript:[^"\']*["\']', 'href=""', value, flags=re.IGNORECASE)
    
    # Truncate
    if len(value) > max_length:
        value = value[:max_length]
    
    return value


# ============================================================================
# DICTIONARY SANITIZATION
# ============================================================================

def sanitize_dict(data: Dict[str, Any], max_depth: int = 10, current_depth: int = 0) -> Dict[str, Any]:
    """
    Recursively sanitize all string values in a dictionary.
    """
    if current_depth >= max_depth:
        return {}
    
    if not isinstance(data, dict):
        return {}
    
    sanitized = {}
    for key, value in data.items():
        # Sanitize key
        clean_key = sanitize_string(str(key), max_length=100)
        
        # Sanitize value based on type
        if isinstance(value, str):
            sanitized[clean_key] = sanitize_string(value)
        elif isinstance(value, dict):
            sanitized[clean_key] = sanitize_dict(value, max_depth, current_depth + 1)
        elif isinstance(value, list):
            sanitized[clean_key] = sanitize_list(value, max_depth, current_depth + 1)
        else:
            # Pass through non-string primitives
            sanitized[clean_key] = value
    
    return sanitized


def sanitize_list(data: List[Any], max_depth: int = 10, current_depth: int = 0) -> List[Any]:
    """
    Recursively sanitize all string values in a list.
    """
    if current_depth >= max_depth:
        return []
    
    if not isinstance(data, list):
        return []
    
    sanitized = []
    for item in data:
        if isinstance(item, str):
            sanitized.append(sanitize_string(item))
        elif isinstance(item, dict):
            sanitized.append(sanitize_dict(item, max_depth, current_depth + 1))
        elif isinstance(item, list):
            sanitized.append(sanitize_list(item, max_depth, current_depth + 1))
        else:
            sanitized.append(item)
    
    return sanitized


# ============================================================================
# VALIDATION HELPERS
# ============================================================================

def is_valid_email(email: str) -> bool:
    """
    Basic email validation.
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def is_valid_url(url: str) -> bool:
    """
    Basic URL validation.
    """
    pattern = r'^https?://[^\s<>"{}|\\^`\[\]]+$'
    return bool(re.match(pattern, url))


def is_safe_filename(filename: str) -> bool:
    """
    Check if a filename is safe (no path traversal, etc.).
    """
    if not filename:
        return False
    
    # Check for path traversal
    if '..' in filename or '/' in filename or '\\' in filename:
        return False
    
    # Check for null bytes
    if '\x00' in filename:
        return False
    
    # Check length
    if len(filename) > 255:
        return False
    
    return True


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to be safe for storage.
    """
    if not filename:
        return "unnamed"
    
    # Remove path separators
    filename = filename.replace('/', '_').replace('\\', '_')
    
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Remove path traversal
    filename = filename.replace('..', '')
    
    # Remove other dangerous characters
    filename = re.sub(r'[<>:"|?*]', '', filename)
    
    # Truncate
    if len(filename) > 200:
        # Keep extension if present
        parts = filename.rsplit('.', 1)
        if len(parts) == 2 and len(parts[1]) <= 10:
            filename = parts[0][:200-len(parts[1])-1] + '.' + parts[1]
        else:
            filename = filename[:200]
    
    return filename or "unnamed"


# ============================================================================
# REQUEST SIZE VALIDATION
# ============================================================================

def validate_payload_size(data: Any, max_size_bytes: int = 10 * 1024 * 1024) -> bool:
    """
    Validate that a payload doesn't exceed the maximum size.
    """
    import json
    try:
        size = len(json.dumps(data).encode('utf-8'))
        return size <= max_size_bytes
    except (TypeError, ValueError):
        return False
