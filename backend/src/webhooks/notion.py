import hmac
import hashlib
import json
import os
from typing import Dict, Any, Optional

# Import from parent directory
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.logger import logger

def validate_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Validate webhook signature using HMAC.
    
    Args:
        payload: Raw request body
        signature: Signature from request header
        secret: Shared secret for validation
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not payload or not signature or not secret:
        return False
        
    computed_signature = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(computed_signature, signature)

def process_notion_webhook(payload: Dict[str, Any], headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """
    Process incoming Notion webhook with security validation.
    
    Args:
        payload: The parsed JSON payload from the webhook
        headers: HTTP headers from the request
        
    Returns:
        Processed response or None if validation fails
    """
    # Get the signature from headers
    signature = headers.get('Notion-Signature')
    if not signature:
        logger.error("Missing signature header")
        return None
    
    # Get the webhook secret from environment variables
    webhook_secret = os.environ.get('NOTION_WEBHOOK_SECRET')
    if not webhook_secret:
        logger.error("Webhook secret not configured")
        return None
    
    # Convert payload back to bytes for validation
    payload_bytes = json.dumps(payload).encode('utf-8')
    
    # Validate the signature
    if not validate_signature(payload_bytes, signature, webhook_secret):
        logger.error("Invalid webhook signature")
        return None
    
    # Log successful validation
    logger.info("Webhook signature validated", source="notion")
    
    # Process the webhook data
    try:
        event_type = payload.get('type')
        facility_id = payload.get('facility_id')
        
        logger.info(
            f"Received {event_type} event", 
            facility_id=facility_id
        )
        
        # Process different event types
        if event_type == 'facility.updated':
            # Handle facility update logic
            logger.info("Processing facility update", facility_id=facility_id)
            # Call facility update service
            
        elif event_type == 'facility.verified':
            # Handle facility verification
            logger.info("Processing facility verification", facility_id=facility_id)
            # Update verification status
            
        elif event_type == 'facility.deleted':
            # Handle facility deletion
            logger.info("Processing facility deletion", facility_id=facility_id)
            # Remove or archive facility
            
        # Return successful response
        response = {
            "status": "success",
            "message": f"Processed {event_type} event for facility {facility_id}",
            "data": {
                "facility_id": facility_id,
                "event_type": event_type,
                "timestamp": payload.get('timestamp')
            }
        }
        
        return response
        
    except Exception as e:
        logger.error("Error processing webhook", exc_info=True)
        return None 