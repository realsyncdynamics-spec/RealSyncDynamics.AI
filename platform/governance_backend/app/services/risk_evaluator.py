"""Heuristische Risiko-Einstufung nach EU AI Act.

Bewusst regelbasiert und nachvollziehbar gehalten: Jede Einstufung lässt sich
auf eine benannte Regel zurückführen (Prüfpfad-Anforderung). Kein LLM im Pfad.

TODO(Phase 2): Regelwerk aus `policy_packs` der Supabase-DB laden statt
Konstanten im Code, damit Compliance-Team Regeln ohne Deploy ändern kann.
"""

from __future__ import annotations

from typing import List, Tuple

from ..schemas import ProjectRegistration, RiskTier

# Art. 5 AI Act — verbotene Praktiken. Treffer => "unacceptable" (Hard-Stop).
PROHIBITED_MARKERS = {
    "social_scoring",
    "social_credit",
    "emotion_recognition_workplace",
    "emotion_recognition_education",
    "biometric_categorisation_sensitive",
    "predictive_policing_individual",
    "untargeted_face_scraping",
    "subliminal_manipulation",
}

# Datenarten, die eine High-Risk-Prüfung auslösen (Annex III + DSGVO Art. 9).
HIGH_RISK_DATA_TYPES = {
    "biometric",
    "biometrics",
    "health",
    "health_data",
    "genetic",
    "criminal_records",
    "credit_score",
    "employment_decisions",
    "education_scoring",
    "immigration_status",
}

# Anwendungsdomänen aus Annex III (via tags["domain"] oder Beschreibung).
HIGH_RISK_DOMAINS = {
    "hr",
    "recruiting",
    "credit",
    "lending",
    "insurance_pricing",
    "healthcare",
    "law_enforcement",
    "critical_infrastructure",
    "education",
    "migration",
}

# Besonders schutzbedürftige Betroffenengruppen.
VULNERABLE_SUBJECTS = {"children", "minors", "patients", "employees", "applicants", "asylum_seekers"}

# Generative/konversationale Modelle lösen Transparenzpflicht (Art. 50) aus.
GENERATIVE_MARKERS = ("gpt", "claude", "gemini", "llama", "mistral", "qwen", "gemma", "llm", "diffusion")

# Gate-Kataloge je Risikoklasse. Reihenfolge = Prüfreihenfolge in der Pipeline.
GATES_BY_TIER: dict[str, List[str]] = {
    "minimal": ["tests_passed"],
    "limited": ["tests_passed", "transparency_notice_enabled", "audit_logging_active"],
    "high": [
        "tests_passed",
        "transparency_notice_enabled",
        "audit_logging_active",
        "model_card_included",
        "pii_scan_passed",
    ],
    # Unacceptable: kein Gate-Katalog — der Build wird grundsätzlich blockiert.
    "unacceptable": [],
}


def _normalize(values: List[str]) -> set[str]:
    return {v.strip().lower().replace(" ", "_").replace("-", "_") for v in values if v}


def evaluate(payload: ProjectRegistration) -> Tuple[RiskTier, List[str]]:
    """Stuft ein Projekt ein und liefert (risk_tier, required_gates).

    Regelreihenfolge (erste passende Regel gewinnt):
      1. Verbotene Praktik      -> unacceptable
      2. Sensible Daten/Domäne  -> high
      3. Generatives Modell /
         personenbezogene Daten -> limited
      4. sonst                  -> minimal
    """
    data_types = _normalize(payload.data_types)
    data_subjects = _normalize(payload.data_subjects)
    models = _normalize(payload.models)
    tags = _normalize(list(payload.tags.values())) | _normalize(list(payload.tags.keys()))
    description = payload.description.lower()

    signals = data_types | tags | models

    # 1) Verbotene Praktiken (Art. 5).
    if signals & PROHIBITED_MARKERS or any(m in description for m in PROHIBITED_MARKERS):
        return "unacceptable", list(GATES_BY_TIER["unacceptable"])

    # 2) High-Risk: sensible Datenarten, Annex-III-Domäne oder biometrische Modelle.
    domain = payload.tags.get("domain", "").strip().lower()
    if (
        data_types & HIGH_RISK_DATA_TYPES
        or domain in HIGH_RISK_DOMAINS
        or tags & HIGH_RISK_DOMAINS
        or ("biometric" in " ".join(models))
    ):
        return "high", list(GATES_BY_TIER["high"])

    # Schutzbedürftige Betroffene heben minimal/limited auf high an.
    if data_subjects & VULNERABLE_SUBJECTS and data_types:
        return "high", list(GATES_BY_TIER["high"])

    # 3) Limited: generative Modelle (Transparenzpflicht) oder personenbezogene Daten.
    is_generative = any(marker in m for m in models for marker in GENERATIVE_MARKERS) or bool(
        payload.llm_provider
    )
    has_personal_data = bool(data_subjects) and bool(data_types)
    if is_generative or has_personal_data:
        gates = list(GATES_BY_TIER["limited"])
        # Drittlandtransfer (Kap. V DSGVO): Nicht-EU-Jurisdiktion verlangt
        # zusätzlich ein Audit-Log für Datenflüsse.
        if (payload.jurisdiction or "eu").lower() not in ("eu", "eea", "de", "at", "ch"):
            if "pii_scan_passed" not in gates:
                gates.append("pii_scan_passed")
        return "limited", gates

    # 4) Minimal.
    return "minimal", list(GATES_BY_TIER["minimal"])
