import json
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient import discovery
from app.logger import setup_logger
from app.config import Config

logger = setup_logger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
TOKEN_FILE = "/app/credentials/token.json"
CREDENTIALS_FILE = "/app/credentials/credentials.json"


class GmailClient:
    """Gmail API client with OAuth 2.0 authentication."""

    def __init__(self):
        """Initialize Gmail API client."""
        self.service = None
        self._authenticate()

    def _authenticate(self) -> None:
        """Authenticate with Gmail API."""
        creds = None

        # Load token if it exists
        if os.path.exists(TOKEN_FILE):
            try:
                creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
            except Exception as e:
                logger.warning(f"Failed to load token from {TOKEN_FILE}: {e}. Re-authenticating.")
                creds = None

        # Refresh token if expired
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                self._save_token(creds)
            except Exception as e:
                logger.warning(f"Failed to refresh token: {e}. Re-authenticating.")
                creds = None

        # Initiate OAuth flow if no valid token
        if not creds or not creds.valid:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(
                    f"credentials.json not found at {CREDENTIALS_FILE}. "
                    "Please download it from Google Cloud Console."
                )

            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES
            )
            # Use run_console() for headless/container environments (no browser available)
            creds = flow.run_console()
            self._save_token(creds)

        self.service = discovery.build("gmail", "v1", credentials=creds)
        logger.info("Gmail API authenticated successfully")

    @staticmethod
    def _save_token(creds: Credentials) -> None:
        """Save OAuth token to file."""
        os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    def get_unread_messages(self, max_results: int = None) -> list:
        """Get unread messages from inbox."""
        try:
            max_results = max_results or Config.MAX_RESULTS_PER_QUERY

            results = self.service.users().messages().list(
                userId="me",
                q="is:unread",
                maxResults=max_results
            ).execute()

            messages = results.get("messages", [])
            logger.debug(f"Found {len(messages)} unread messages")
            return messages
        except Exception as e:
            logger.error(f"Error getting unread messages: {e}")
            return []

    def get_read_messages(self, max_results: int = None) -> list:
        """Get read messages (for retroactive organization)."""
        try:
            max_results = max_results or Config.MAX_RESULTS_PER_QUERY

            results = self.service.users().messages().list(
                userId="me",
                q="-is:unread -has:attachment",
                maxResults=max_results
            ).execute()

            messages = results.get("messages", [])
            logger.debug(f"Found {len(messages)} read messages")
            return messages
        except Exception as e:
            logger.error(f"Error getting read messages: {e}")
            return []

    def get_message(self, msg_id: str) -> dict:
        """Get full message details."""
        try:
            message = self.service.users().messages().get(
                userId="me",
                id=msg_id,
                format="full"
            ).execute()
            return message
        except Exception as e:
            logger.error(f"Error getting message {msg_id}: {e}")
            return {}

    def add_label(self, msg_id: str, label_id: str) -> bool:
        """Add label to message."""
        try:
            if Config.DRY_RUN:
                logger.info(f"[DRY RUN] Would add label {label_id} to message {msg_id}")
                return True

            self.service.users().messages().modify(
                userId="me",
                id=msg_id,
                body={"addLabelIds": [label_id]}
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error adding label to message {msg_id}: {e}")
            return False

    def remove_label(self, msg_id: str, label_id: str) -> bool:
        """Remove label from message."""
        try:
            if Config.DRY_RUN:
                logger.info(f"[DRY RUN] Would remove label {label_id} from message {msg_id}")
                return True

            self.service.users().messages().modify(
                userId="me",
                id=msg_id,
                body={"removeLabelIds": [label_id]}
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error removing label from message {msg_id}: {e}")
            return False

    def archive_message(self, msg_id: str) -> bool:
        """Archive message (remove from INBOX)."""
        try:
            if Config.DRY_RUN:
                logger.info(f"[DRY RUN] Would archive message {msg_id}")
                return True

            self.service.users().messages().modify(
                userId="me",
                id=msg_id,
                body={"removeLabelIds": ["INBOX"]}
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Error archiving message {msg_id}: {e}")
            return False
