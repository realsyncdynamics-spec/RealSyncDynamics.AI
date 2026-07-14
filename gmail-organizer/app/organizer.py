import base64
import email
import json
from datetime import datetime
from typing import Optional
from app.logger import setup_logger
from app.gmail import GmailClient
from app.labels import LabelManager
from app.config import Config

logger = setup_logger(__name__)

STATE_FILE = "/app/data/organizer_state.json"


class EmailOrganizer:
    """Organize emails based on sender."""

    def __init__(self):
        """Initialize organizer."""
        self.gmail_client = GmailClient()
        self.label_manager = LabelManager(self.gmail_client)
        self.processed_messages = self._load_state()

    def _load_state(self) -> set:
        """Load processed message IDs from state file."""
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
                processed = set(data.get("processed_messages", []))
                logger.debug(f"Loaded {len(processed)} processed messages from state")
                return processed
        except FileNotFoundError:
            logger.debug("No state file found, starting fresh")
            return set()
        except Exception as e:
            logger.error(f"Error loading state: {e}")
            return set()

    def _save_state(self) -> None:
        """Save processed message IDs to state file."""
        try:
            import os
            os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)

            data = {
                "processed_messages": list(self.processed_messages),
                "last_update": datetime.now().isoformat()
            }

            with open(STATE_FILE, "w") as f:
                json.dump(data, f, indent=2)

            logger.debug(f"Saved state with {len(self.processed_messages)} processed messages")
        except Exception as e:
            logger.error(f"Error saving state: {e}")

    def _extract_sender_email(self, message: dict) -> Optional[str]:
        """Extract sender email from message headers."""
        try:
            headers = message.get("payload", {}).get("headers", [])

            for header in headers:
                if header.get("name") == "From":
                    from_value = header.get("value", "")

                    # Extract email from "Name <email@domain.com>" format
                    if "<" in from_value and ">" in from_value:
                        email_part = from_value.split("<")[1].split(">")[0]
                    else:
                        email_part = from_value

                    return email_part.strip().lower()

            return None
        except Exception as e:
            logger.error(f"Error extracting sender email: {e}")
            return None

    def _get_message_subject(self, message: dict) -> str:
        """Get message subject."""
        try:
            headers = message.get("payload", {}).get("headers", [])

            for header in headers:
                if header.get("name") == "Subject":
                    return header.get("value", "(no subject)")

            return "(no subject)"
        except Exception as e:
            logger.error(f"Error getting message subject: {e}")
            return "(error reading subject)"

    def organize_message(self, message: dict) -> bool:
        """Organize single message based on sender."""
        msg_id = message.get("id")

        # Skip if already processed
        if msg_id in self.processed_messages:
            logger.debug(f"Message {msg_id} already processed")
            return False

        # Fetch full message to get headers (list() doesn't include payload)
        full_message = self.gmail_client.get_message(msg_id)
        if not full_message:
            logger.error(f"Failed to fetch full message {msg_id}")
            return False

        sender_email = self._extract_sender_email(full_message)
        if not sender_email:
            logger.warning(f"Could not extract sender email from message {msg_id}")
            self.processed_messages.add(msg_id)
            return False

        subject = self._get_message_subject(message)
        logger.info(f"Processing: {sender_email} - {subject}")

        # Get or create label for sender
        label_id = self.label_manager.get_label_for_sender(sender_email)
        if not label_id:
            logger.error(f"Failed to get label for {sender_email}")
            return False

        # Add label to message
        success = self.gmail_client.add_label(msg_id, label_id)
        if success:
            self.processed_messages.add(msg_id)

            # Archive if configured
            if Config.ARCHIVE_READ_EMAILS:
                self.gmail_client.archive_message(msg_id)

            return True

        return False

    def run_once(self) -> None:
        """Run organizer once (process new unread emails)."""
        logger.info("=== Starting organization cycle ===")

        try:
            messages = self.gmail_client.get_unread_messages()

            if not messages:
                logger.info("No unread messages to process")
                return

            logger.info(f"Found {len(messages)} unread messages")

            processed_count = 0
            for message in messages:
                if self.organize_message(message):
                    processed_count += 1

            logger.info(f"Processed {processed_count}/{len(messages)} messages")

            self._save_state()
        except Exception as e:
            logger.error(f"Error during organization cycle: {e}")

    def run_retro(self) -> None:
        """Run organizer on existing messages (retroactive organization)."""
        logger.info("=== Starting retroactive organization ===")

        try:
            messages = self.gmail_client.get_read_messages()

            if not messages:
                logger.info("No read messages to organize")
                return

            logger.info(f"Found {len(messages)} read messages to organize")

            processed_count = 0
            for message in messages:
                if self.organize_message(message):
                    processed_count += 1

            logger.info(f"Retroactively organized {processed_count}/{len(messages)} messages")

            self._save_state()
        except Exception as e:
            logger.error(f"Error during retroactive organization: {e}")

    def run_continuous(self, interval_minutes: int = None) -> None:
        """Run organizer continuously at intervals."""
        import time

        interval_minutes = interval_minutes or Config.SCAN_INTERVAL_MINUTES
        interval_seconds = interval_minutes * 60

        logger.info(f"Starting continuous organization every {interval_minutes} minutes")

        try:
            while True:
                self.run_once()
                logger.info(f"Next scan in {interval_minutes} minutes...")
                time.sleep(interval_seconds)
        except KeyboardInterrupt:
            logger.info("Organizer stopped by user")
        except Exception as e:
            logger.error(f"Fatal error in continuous mode: {e}")
            raise
