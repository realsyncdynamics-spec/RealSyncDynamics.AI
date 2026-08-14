"""Deterministic SiteOS renderer for AI Studio PageSpec previews.

The renderer accepts only the typed PageSpec contract. It emits frontend HTML
for preview purposes and has no capability to access a customer backend,
execute scripts, or perform network requests.
"""

from __future__ import annotations

from html import escape
from typing import Any

from .audit_contracts import PageSpec


def _text(value: Any, default: str = "") -> str:
    return escape(str(value)) if value is not None else default


def _items(items: list[dict[str, object]]) -> str:
    cards: list[str] = []
    for item in items[:8]:
        title = _text(item.get("title") or item.get("name") or item.get("label"), "Feature")
        body = _text(item.get("description") or item.get("body") or item.get("text"), "")
        cards.append(f'<article class="card"><h3>{title}</h3><p>{body}</p></article>')
    if not cards:
        return ""
    return '<div class="card-grid">' + "".join(cards) + "</div>"


def render_page_spec(spec: PageSpec) -> str:
    """Render a PageSpec into isolated, deterministic preview HTML."""
    tokens = spec.design_tokens
    dark = tokens.theme == "dark"
    bg = "#090d16" if dark else "#f7f9fc"
    fg = "#f5f7fb" if dark else "#111827"
    muted = "#aab4c7" if dark else "#5d6678"
    surface = "#111827" if dark else "#ffffff"
    border = "#29344a" if dark else "#dce2ec"
    accent = escape(tokens.accent_color)

    hero = spec.hero
    eyebrow = _text(hero.get("eyebrow"), "AI STUDIO")
    headline = _text(hero.get("headline") or hero.get("title"), "Modernisierte Website")
    subheadline = _text(hero.get("subheadline") or hero.get("description"), "")
    cta = hero.get("primary_cta")
    cta_label = _text(cta.get("label") if isinstance(cta, dict) else None, "Kontakt aufnehmen")

    rendered_sections: list[str] = []
    for section in spec.sections:
        title = _text(section.title)
        subtitle = _text(section.subtitle)
        content = _items(section.items)
        if not content:
            content = f'<p class="section-copy">{subtitle}</p>'
        rendered_sections.append(
            f'<section class="section"><div class="section-head"><h2>{title}</h2><p>{subtitle}</p></div>{content}</section>'
        )

    disclosure = (
        '<div class="disclosure">KI-generierte Vorschau · Inhalte vor Veröffentlichung prüfen</div>'
        if spec.ai_disclosure_required else ""
    )
    sections_html = "".join(f'<div class="wrap">{section}</div>' for section in rendered_sections)

    return f"""<!doctype html>
<html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{_text(spec.source_domain, 'RealSync AI Studio')}</title>
<style>
:root{{--accent:{accent};--bg:{bg};--fg:{fg};--muted:{muted};--surface:{surface};--border:{border}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 Inter,system-ui,sans-serif}}
.wrap{{max-width:1180px;margin:auto;padding:0 28px}}.bar{{padding:14px 0;border-bottom:1px solid var(--border);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}}
.hero{{padding:92px 0 72px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 13%,transparent),transparent 58%)}}
.eyebrow{{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:800}}h1{{font-size:clamp(42px,7vw,82px);line-height:.98;letter-spacing:-.055em;max-width:900px;margin:14px 0 20px}}.lead{{max-width:760px;color:var(--muted);font-size:19px}}
.cta{{display:inline-block;margin-top:24px;padding:13px 18px;background:var(--accent);color:#fff;border-radius:9px;text-decoration:none;font-weight:800}}.section{{padding:54px 0;border-top:1px solid var(--border)}}.section-head{{max-width:760px;margin-bottom:22px}}h2{{font-size:34px;letter-spacing:-.035em;margin:0 0 8px}}.section-head p,.section-copy{{color:var(--muted)}}.card-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}}.card{{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;min-height:120px}}h3{{margin:0 0 8px;font-size:18px}}.card p{{margin:0;color:var(--muted);font-size:14px}}.disclosure{{position:fixed;right:14px;bottom:14px;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:8px 12px;font-size:11px;color:var(--muted)}}
@media(max-width:700px){{.wrap{{padding:0 18px}}.hero{{padding:62px 0 48px}}}}
</style></head><body>
<div class="bar"><div class="wrap">RealSync AI Studio · {_text(spec.variant)} · {_text(spec.source_domain)}</div></div>
<main><section class="hero"><div class="wrap"><div class="eyebrow">{eyebrow}</div><h1>{headline}</h1><p class="lead">{subheadline}</p><a class="cta" href="#contact">{cta_label}</a></div></section>
{sections_html}</main>{disclosure}</body></html>"""
