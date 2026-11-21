"""
Production logging configuration for Margam AI Backend.
"""
import logging
import sys
from logging.handlers import RotatingFileHandler
import os

class ContextFormatter(logging.Formatter):
    """Custom formatter that includes request context in log messages."""
    
    def format(self, record):
        try:
            # Try to import and use context formatter (lazy import to avoid circular dependencies)
            from request_context import format_log_message
            original_msg = record.getMessage()
            formatted_msg = format_log_message(original_msg)
            record.msg = formatted_msg
            record.args = ()
        except (ImportError, AttributeError, Exception):
            # Fallback to normal formatting if context not available
            pass
        return super().format(record)

def setup_logging(log_level: str = "INFO", log_dir: str = "logs"):
    """
    Set up production logging with file rotation and console output.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory to store log files
    """
    # Create logs directory if it doesn't exist
    os.makedirs(log_dir, exist_ok=True)
    
    # Get root logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # Console handler with formatted output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    console_formatter = ContextFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    
    # File handler with rotation (10MB per file, keep 5 backups)
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'margam_ai.log'),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)  # Log everything to file
    file_formatter = ContextFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    
    # Error file handler (errors only)
    error_handler = RotatingFileHandler(
        os.path.join(log_dir, 'margam_ai_errors.log'),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    
    # Add handlers to logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    logger.addHandler(error_handler)
    
    return logger

# Initialize logger
logger = setup_logging(
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    log_dir=os.getenv("LOG_DIR", "logs")
)

