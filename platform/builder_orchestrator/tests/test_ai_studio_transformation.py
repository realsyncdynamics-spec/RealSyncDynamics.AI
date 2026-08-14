from app.services.audit_contracts import DesignTokens, PageSection, PageSpec


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


def test_asset_prompts_are_spec_instructions_not_generated_markup():
    spec = PageSpec(
        variant="executive",
        hero={"headline": "Executive"},
        sections=[],
        design_tokens=DesignTokens(),
        asset_prompts=[{"slot": "hero", "prompt": "Premium B2B hero visual"}],
    )

    assert spec.asset_prompts[0]["slot"] == "hero"
    assert "Premium" in spec.asset_prompts[0]["prompt"]
    assert not hasattr(spec, "html")
    assert not hasattr(spec, "backend_code")
