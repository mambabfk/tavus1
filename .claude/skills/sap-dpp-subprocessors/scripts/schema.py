"""Vendor JSON shape. Researcher writes this; verifier annotates it."""

EXAMPLE = {
  "vendor_name": "Amazon Web Services, Inc.",
  "slug": "aws",
  "level": 1,
  "contact_directly": False,
  "fields": {
    "1.1":   {"value": "Amazon Web Services, Inc. (Delaware corporation)",
              "source_url": "https://...", "locator": "DPA signature block",
              "confidence": "high", "notes": ""},
    "3.1.2": {"value": "AES-256", "source_url": "https://...",
              "locator": "Security whitepaper, Encryption at Rest",
              "confidence": "high", "notes": "documented as AES-256-GCM"},
    "3.1.3": {"value": "Not known", "source_url": None, "locator": None,
              "confidence": "none", "notes": "backup encryption not documented separately"},
    "2.3":   {"value": "Yes", "source_url": None,
              "notes": "processes raw media in plaintext during inference",
              "requires_signoff": True, "signed_off_by": None},
  },
  "verification": {
    "verified_by": "verifier pass 2026-07-30",
    "verdicts": {"1.1": "confirmed", "3.1.2": "confirmed", "3.1.3": "unsupported"},
    "disputes": [],
  },
  "open_questions_for_vendor": [
    "Do you encrypt backups, and with which algorithm?",
  ],
}
