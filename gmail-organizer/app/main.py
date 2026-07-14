import sys
import os
from app.config import Config
from app.logger import setup_logger
from app.organizer import EmailOrganizer

logger = setup_logger(__name__)


def main():
    """Main entry point."""
    try:
        # Validate configuration
        Config.validate()
        logger.info(f"Configuration loaded: GMAIL_USER={Config.GMAIL_USER}")

        # Initialize organizer
        organizer = EmailOrganizer()

        # Run once initially
        organizer.run_once()

        # Continue running at intervals
        organizer.run_continuous()

    except KeyboardInterrupt:
        logger.info("Application terminated by user")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
