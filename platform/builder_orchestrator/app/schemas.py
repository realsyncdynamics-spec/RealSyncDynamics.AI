"""Pydantic-v2-Schemas des Builder-Orchestrators."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class BuildSpec(BaseModel):
    """Eingabe des Nutzers: was gebaut werden soll und mit welchen Daten."""

    project_name: str
    description: str
    prompt: str
    data_types: List[str] = Field(default_factory=list)
    data_subjects: List[str] = Field(default_factory=list)
    models: List[str] = Field(default_factory=list)
    llm_provider: Optional[str] = None
    jurisdiction: Optional[str] = "eu"
    target_stack: str = "nextjs_supabase"


TaskStatus = Literal["pending", "running", "completed", "failed", "blocked"]

AgentType = Literal["planner", "architect", "coder", "devops", "governance"]


class AgentTask(BaseModel):
    id: str
    agent_type: str  # siehe AgentType
    input: Dict[str, str] = Field(default_factory=dict)
    output: Optional[Dict[str, str]] = None
    status: TaskStatus = "pending"
    depends_on: List[str] = Field(default_factory=list)


class TaskGraph(BaseModel):
    project_id: str
    tasks: List[AgentTask]

    def by_id(self, task_id: str) -> Optional[AgentTask]:
        return next((t for t in self.tasks if t.id == task_id), None)

    def ready_tasks(self) -> List[AgentTask]:
        """Tasks, deren Vorgänger alle abgeschlossen sind."""
        done = {t.id for t in self.tasks if t.status == "completed"}
        return [
            t for t in self.tasks if t.status == "pending" and set(t.depends_on).issubset(done)
        ]


class GovernanceContext(BaseModel):
    """Antwort des Governance-Backends, angereichert an den Graph."""

    project_id: str
    risk_tier: str
    required_gates: List[str] = Field(default_factory=list)
