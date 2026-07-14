import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration from environment variables."""

    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8080/oauth2callback")

    # Gmail Config
    GMAIL_USER = os.getenv("GMAIL_USER", "")
    MAX_RESULTS_PER_QUERY = int(os.getenv("MAX_RESULTS_PER_QUERY", "10"))

    # Organizer Settings
    SCAN_INTERVAL_MINUTES = int(os.getenv("SCAN_INTERVAL_MINUTES", "5"))
    ARCHIVE_READ_EMAILS = os.getenv("ARCHIVE_READ_EMAILS", "false").lower() == "true"
    DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.getenv("LOG_FILE", "/app/logs/organizer.log")

    @classmethod
    def validate(cls):
        """Validate required configuration."""
        if not cls.GOOGLE_CLIENT_ID or not cls.GOOGLE_CLIENT_SECRET:
            raise ValueError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required")
        if not cls.GMAIL_USER:
            raise ValueError("GMAIL_USER is required")
