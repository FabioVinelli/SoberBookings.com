import logging
import json
import os
import sys
from datetime import datetime

class StructuredLogger:
    """
    Structured logger for consistent logging format across the application.
    Ensures proper logging of execution, errors, and warnings.
    """
    
    def __init__(self, name=None, level=logging.INFO):
        self.logger = logging.getLogger(name or __name__)
        self.logger.setLevel(level)
        
        # Clear existing handlers if any
        self.logger.handlers = []
        
        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)
        
        # Add handler to logger
        self.logger.addHandler(console_handler)
        
        # Add file handler if LOG_FILE env var is set
        log_file = os.environ.get('LOG_FILE')
        if log_file:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(level)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
    
    def _format_log(self, message, **kwargs):
        """Format log message with additional context."""
        if kwargs:
            return f"{message} | {json.dumps(kwargs)}"
        return message
    
    def info(self, message, **kwargs):
        """Log info message with structured metadata."""
        self.logger.info(self._format_log(message, **kwargs))
    
    def warning(self, message, **kwargs):
        """Log warning message with structured metadata."""
        self.logger.warning(self._format_log(message, **kwargs))
    
    def error(self, message, exc_info=None, **kwargs):
        """Log error message with structured metadata and optional exception info."""
        self.logger.error(self._format_log(message, **kwargs), exc_info=exc_info)
    
    def debug(self, message, **kwargs):
        """Log debug message with structured metadata."""
        self.logger.debug(self._format_log(message, **kwargs))
    
    def critical(self, message, exc_info=None, **kwargs):
        """Log critical message with structured metadata and optional exception info."""
        self.logger.critical(self._format_log(message, **kwargs), exc_info=exc_info)

# Create a default logger instance
logger = StructuredLogger("soberbookings")

# Example usage
if __name__ == "__main__":
    logger.info("Application started")
    logger.warning("Resource running low", resource="memory", available_mb=128)
    
    try:
        1/0
    except Exception as e:
        logger.error("Division error occurred", exc_info=True, operation="division") 