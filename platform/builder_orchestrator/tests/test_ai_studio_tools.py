import pytest

from app.services.ai_studio_tools import ToolRequest, assert_tool_allowed


def test_publish_requires_governance_gate():
    request = ToolRequest(tool="publish", project_id="p1", source_domain="example.de")
    with pytest.raises(PermissionError):
        assert_tool_allowed(request, governance_passed=False)


def test_scan_is_allowed_without_tenant_for_public_value_first_flow():
    request = ToolRequest(tool="scanWebsite", project_id="example.de", source_domain="example.de")
    policy = assert_tool_allowed(request)
    assert policy.requires_tenant is False
    assert policy.mutates_customer_backend is False


def test_no_registered_tool_can_mutate_customer_backend():
    from app.services.ai_studio_tools import TOOL_POLICIES

    assert all(not policy.mutates_customer_backend for policy in TOOL_POLICIES.values())
