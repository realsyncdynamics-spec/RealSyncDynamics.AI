"""Governed tool contract for the RealSync AI Studio agent.

The model can request intent through these names, but the orchestrator remains
responsible for authorization, evidence, tenant binding and execution. No tool
in this registry can mutate a customer backend. Publish is a SiteOS operation
and must pass the existing governance gate before execution.
"""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


ToolName = Literal[
    "scanWebsite",
    "getEvidence",
    "getAudit",
    "generatePageSpec",
    "generateVisualAsset",
    "updateSection",
    "runGovernance",
    "preview",
    "publish",
]


class ToolRequest(BaseModel):
    tool: ToolName
    project_id: str = Field(min_length=1, max_length=160)
    source_domain: str = Field(min_length=1, max_length=253)
    arguments: dict[str, object] = Field(default_factory=dict)


class ToolPolicy(BaseModel):
    """Execution policy exposed to the agent planner."""

    read_only: bool
    requires_tenant: bool = True
    requires_governance_gate: bool = False
    mutates_customer_backend: bool = False


TOOL_POLICIES: dict[ToolName, ToolPolicy] = {
    "scanWebsite": ToolPolicy(read_only=True, requires_tenant=False),
    "getEvidence": ToolPolicy(read_only=True, requires_tenant=False),
    "getAudit": ToolPolicy(read_only=True, requires_tenant=False),
    "generatePageSpec": ToolPolicy(read_only=True),
    "generateVisualAsset": ToolPolicy(read_only=True),
    "updateSection": ToolPolicy(read_only=True),
    "runGovernance": ToolPolicy(read_only=True, requires_governance_gate=True),
    "preview": ToolPolicy(read_only=True, requires_governance_gate=True),
    "publish": ToolPolicy(read_only=False, requires_governance_gate=True),
}


def assert_tool_allowed(request: ToolRequest, *, governance_passed: bool = False) -> ToolPolicy:
    policy = TOOL_POLICIES[request.tool]
    if policy.requires_governance_gate and not governance_passed:
        raise PermissionError(f"Tool {request.tool} requires a successful governance gate")
    if policy.mutates_customer_backend:
        raise PermissionError("Customer backend mutation is forbidden by the SiteOS transformation contract")
    return policy
