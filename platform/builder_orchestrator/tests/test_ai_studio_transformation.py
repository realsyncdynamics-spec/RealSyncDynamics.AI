from app.services.audit_contracts import (
    DesignTokens,
    PageSection,
    PageSpec,
    VisualAsset,
)


def test_pagespec_preserves_customer_backend_boundary():
    spec = PageSpec(
        variant="modern",
        source_domain="example.de",
        evidence_hash="abc123",
        hero={"headline": "Modern", "subheadline": "Better"},
        sections=[PageSection(id="hero", type="cta_banner", title="Start")],
        design_tokens=DesignTokens(),
    )

    assert spec.backend_preservation == "preserve_all"
    assert spec.source_domain == "example.de"
    assert spec.evidence_hash == "abc123"
    assert spec.ai_disclosure_required is True


def test_visual_asset_is_optional_and_separate_from_pagespec_structure():
    spec = PageSpec(
        variant="executive",
        hero={"headline": "Executive"},
        sections=[],
        design_tokens=DesignTokens(),
        visual_asset=VisualAsset(
            mime_type="image/png",
            data_base64="ZmFrZQ==",
            model="gemini-3.1-flash-image",
        ),
    )

    assert spec.visual_asset is not None
    assert spec.visual_asset.model == "gemini-3.1-flash-image"
    assert spec.sections == []
