"""
realsync-cli — Governance Evidence Bundle Verification

Reference verifier for SPEC-001 / RFC-002 evidence bundles produced by the
RealSyncDynamics.AI runtime. Designed so external auditors can verify a
sealed audit bundle offline, without access to the producing system —
needing only the public-key sidecar.

Conceptual reference prototype. Use at your own risk; no legal guarantees.
"""

__version__ = "0.2.0"
__spec_version__ = "1.0"  # SPEC-001 envelope schema this verifier understands
