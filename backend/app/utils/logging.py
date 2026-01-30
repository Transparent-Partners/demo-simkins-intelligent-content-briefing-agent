"""
Structured logging utilities for production observability.
"""
import logging
import json
import time
import os
from typing import Any, Dict, Optional
from functools import wraps


# ============================================================================
# STRUCTURED LOGGER
# ============================================================================

class StructuredLogger:
    """
    Logger that outputs JSON-formatted logs for production observability.
    Compatible with Cloud Run logging and can be parsed by log aggregators.
    """
    
    def __init__(self, name: str = "app"):
        self.logger = logging.getLogger(name)
        self.is_production = os.getenv("ENVIRONMENT") == "production"
        
        # Configure logging format
        if self.is_production:
            # JSON format for production (Cloud Run, etc.)
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter('%(message)s'))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
        else:
            # Human-readable format for development
            logging.basicConfig(
                level=logging.DEBUG,
                format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
    
    def _format_message(self, level: str, message: str, **kwargs) -> str:
        """Format log message as JSON for production."""
        log_entry = {
            "severity": level,
            "message": message,
            "timestamp": time.time(),
            **kwargs
        }
        return json.dumps(log_entry)
    
    def info(self, message: str, **kwargs):
        if self.is_production:
            self.logger.info(self._format_message("INFO", message, **kwargs))
        else:
            self.logger.info(f"{message} | {kwargs}" if kwargs else message)
    
    def warning(self, message: str, **kwargs):
        if self.is_production:
            self.logger.warning(self._format_message("WARNING", message, **kwargs))
        else:
            self.logger.warning(f"{message} | {kwargs}" if kwargs else message)
    
    def error(self, message: str, **kwargs):
        if self.is_production:
            self.logger.error(self._format_message("ERROR", message, **kwargs))
        else:
            self.logger.error(f"{message} | {kwargs}" if kwargs else message)
    
    def debug(self, message: str, **kwargs):
        if not self.is_production:
            self.logger.debug(f"{message} | {kwargs}" if kwargs else message)


# Global logger instance
logger = StructuredLogger("intelligent-briefing-agent")


# ============================================================================
# REQUEST LOGGING
# ============================================================================

def log_request(
    request_id: str,
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    error: Optional[str] = None,
):
    """
    Log an API request with structured data.
    """
    log_data = {
        "request_id": request_id,
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
    }
    
    if client_ip:
        log_data["client_ip"] = client_ip
    
    if user_agent:
        log_data["user_agent"] = user_agent[:200]  # Truncate
    
    if error:
        log_data["error"] = error
        logger.error(f"Request failed: {method} {path}", **log_data)
    else:
        logger.info(f"Request completed: {method} {path}", **log_data)


# ============================================================================
# PERFORMANCE TIMING
# ============================================================================

def timed(operation_name: str):
    """
    Decorator to log the duration of a function call.
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                duration = (time.perf_counter() - start) * 1000
                logger.info(f"{operation_name} completed", duration_ms=round(duration, 2))
                return result
            except Exception as e:
                duration = (time.perf_counter() - start) * 1000
                logger.error(
                    f"{operation_name} failed",
                    duration_ms=round(duration, 2),
                    error=str(e)
                )
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration = (time.perf_counter() - start) * 1000
                logger.info(f"{operation_name} completed", duration_ms=round(duration, 2))
                return result
            except Exception as e:
                duration = (time.perf_counter() - start) * 1000
                logger.error(
                    f"{operation_name} failed",
                    duration_ms=round(duration, 2),
                    error=str(e)
                )
                raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator
