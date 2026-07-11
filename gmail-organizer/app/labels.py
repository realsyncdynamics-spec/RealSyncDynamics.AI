import re
from app.logger import setup_logger

logger = setup_logger(__name__)


class LabelManager:
    """Manage Gmail labels."""

    def __init__(self, gmail_client):
        """Initialize label manager."""
        self.gmail_client = gmail_client
        self.labels_cache = None
        self._load_labels()

    def _load_labels(self) -> None:
        """Load all labels from Gmail."""
        try:
            results = self.gmail_client.service.users().labels().list(
                userId="me"
            ).execute()

            self.labels_cache = {label["name"]: label["id"] for label in results.get("labels", [])}
            logger.debug(f"Loaded {len(self.labels_cache)} labels")
        except Exception as e:
            logger.error(f"Error loading labels: {e}")
            self.labels_cache = {}

    def get_label_id(self, label_name: str) -> str:
        """Get label ID by name."""
        return self.labels_cache.get(label_name)

    def label_exists(self, label_name: str) -> bool:
        """Check if label exists."""
        return label_name in self.labels_cache

    def create_label(self, label_name: str) -> str:
        """Create new label."""
        try:
            label_body = {
                "name": label_name,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show"
            }

            result = self.gmail_client.service.users().labels().create(
                userId="me",
                body=label_body
            ).execute()

            label_id = result["id"]
            self.labels_cache[label_name] = label_id
            logger.info(f"Created label '{label_name}' with ID {label_id}")
            return label_id
        except Exception as e:
            logger.error(f"Error creating label '{label_name}': {e}")
            return None

    def get_or_create_label(self, label_name: str) -> str:
        """Get label ID, create if not exists."""
        if self.label_exists(label_name):
            return self.get_label_id(label_name)

        return self.create_label(label_name)

    @staticmethod
    def sanitize_label_name(email: str) -> str:
        """Convert email to safe label name."""
        email = email.lower().strip()

        # Extract domain and local part
        match = re.match(r"([^@]+)@([^@]+)", email)
        if not match:
            return "Unknown"

        local, domain = match.groups()

        # Get domain name (e.g., "google" from "gmail.com")
        domain_parts = domain.split(".")
        domain_name = domain_parts[0] if domain_parts else domain

        # Clean up names
        domain_clean = domain_name.replace("-", " ").replace("_", " ").title()
        local_clean = local.replace(".", " ").replace("+", "").title()

        # Format: "Domain/LocalPart" or just "Domain"
        if local_clean and local_clean != "Noreply" and len(local_clean) > 2:
            return f"{domain_clean}/{local_clean}"

        return domain_clean

    def get_label_for_sender(self, email: str) -> str:
        """Get or create label for sender email."""
        label_name = self.sanitize_label_name(email)
        return self.get_or_create_label(label_name)
