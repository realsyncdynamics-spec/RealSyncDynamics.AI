import asyncio
from types import SimpleNamespace

from app.services import audit_pipeline


def test_ai_studio_variants_use_gemini_directly(monkeypatch):
    providers = []

    class FakeGeminiProvider:
        name = "gemini"

        def __init__(self):
            providers.append(self)

    calls = []

    async def fake_complete_json(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(), SimpleNamespace()

    monkeypatch.setattr(audit_pipeline, "GeminiProvider", FakeGeminiProvider)
    monkeypatch.setattr(audit_pipeline.llm, "complete_json", fake_complete_json)

    snapshot = SimpleNamespace(
        domain="example.test",
        evidence_hash="hash",
        model_dump=lambda: {"domain": "example.test"},
    )
    audit = SimpleNamespace(model_dump=lambda: {"score": 42})

    variants = asyncio.run(
        audit_pipeline.generate_variants(
            company_context="Example",
            snapshot=snapshot,
            audit=audit,
            project_id="test-project",
        )
    )

    assert len(providers) == 1
    assert len(calls) == 4
    assert all(call["provider"] is providers[0] for call in calls)
    assert [variant.variant for variant in variants] == [
        "executive",
        "modern",
        "authority",
        "minimal",
    ]
    assert all(variant.backend_preservation == "preserve_all" for variant in variants)
