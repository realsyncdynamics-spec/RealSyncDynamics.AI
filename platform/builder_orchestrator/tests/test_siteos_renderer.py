from app.services.audit_contracts import DesignTokens, PageSection, PageSpec
from app.services.siteos_renderer import render_page_spec


def test_renderer_is_deterministic_and_escapes_customer_content():
    spec = PageSpec(
        variant="modern",
        source_domain="example.de",
        evidence_hash="abc123",
        hero={"headline": "<script>alert(1)</script>", "subheadline": "Safe"},
        sections=[PageSection(id="hero", type="cta_banner", title="Start", items=[{"title": "Feature", "description": "<b>text</b>"}])],
        design_tokens=DesignTokens(),
    )

    first = render_page_spec(spec)
    second = render_page_spec(spec)

    assert first == second
    assert "<script>alert(1)</script>" not in first
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in first
    assert "&lt;b&gt;text&lt;/b&gt;" in first
    assert "KI-generierte Vorschau" in first
    assert "backend" not in first.lower()
