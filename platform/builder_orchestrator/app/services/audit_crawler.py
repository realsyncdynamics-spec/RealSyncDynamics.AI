"""Browser-based evidence capture for website governance audits.

This collector records observable technical signals. It deliberately does not
make legal conclusions; deterministic findings describe evidence that the
Governance/Gemini layer can classify and explain.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from .audit_contracts import EvidenceFinding, EvidenceSnapshot, EvidenceTrace


LEGAL_PATTERNS = {
    "impressum": re.compile(r"(?:impressum|imprint)", re.I),
    "datenschutz": re.compile(r"(?:datenschutz|privacy|privacy-policy)", re.I),
    "cookie": re.compile(r"(?:cookie|consent|einwilligung)", re.I),
}

TRACKING_HOSTS = {
    "google-analytics.com": "Google Analytics",
    "googletagmanager.com": "Google Tag Manager",
    "doubleclick.net": "Google Ads/DoubleClick",
    "facebook.net": "Meta Pixel",
    "connect.facebook.net": "Meta Pixel",
    "hotjar.com": "Hotjar",
    "clarity.ms": "Microsoft Clarity",
}


def _technology(host: str) -> str | None:
    for pattern, name in TRACKING_HOSTS.items():
        if host == pattern or host.endswith("." + pattern):
            return name
    return None


def _hash_payload(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _finding(fid: str, category: str, severity: str, title: str, description: str,
             url: str, hint: str, confidence: float, detail: str = "") -> EvidenceFinding:
    return EvidenceFinding(
        finding_id=fid,
        category=category,
        severity=severity,
        title=title,
        description=description,
        evidence=EvidenceTrace(resource_url=url, timestamp=datetime.now(timezone.utc).isoformat(), detail=detail),
        remediation_hint=hint,
        confidence=confidence,
    )


async def collect(url: str, timeout_ms: int = 30000) -> EvidenceSnapshot:
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright ist im Builder-Image nicht installiert") from exc

    captured_at = datetime.now(timezone.utc).isoformat()
    parsed = urlparse(url if "://" in url else "https://" + url)
    target = parsed.geturl()
    requests: list[dict[str, str]] = []
    cookies_before: list[dict] = []
    cookies_after: list[dict] = []
    technologies: set[str] = set()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()

        async def on_request(request):
            host = urlparse(request.url).hostname or ""
            tech = _technology(host)
            if tech:
                technologies.add(tech)
                requests.append({"url": request.url[:500], "method": request.method, "technology": tech, "resource_type": request.resource_type})

        page.on("request", on_request)
        try:
            await page.goto(target, wait_until="domcontentloaded", timeout=timeout_ms)
            await page.wait_for_timeout(1500)
            cookies_before = await context.cookies()
            title = await page.title()
            meta = await page.locator('meta[name="description"]').get_attribute("content") or ""
            body_text = (await page.locator("body").inner_text())[:12000]
            links = await page.locator("a").evaluate_all("els => els.map(a => ({text:(a.innerText||'').trim(), href:a.href}))")
            scripts = await page.locator("script[src]").evaluate_all("els => els.map(s => s.src)")
            img_missing_alt = await page.locator("img:not([alt])").count()
            buttons = await page.locator("button, [role=button]").count()

            legal = {name: any(PAT.search((x.get("text") or "") + " " + (x.get("href") or "")) for x in links) for name, PAT in LEGAL_PATTERNS.items() if name in ("impressum", "datenschutz")}
            consent_detected = bool(LEGAL_PATTERNS["cookie"].search(body_text))

            # A real consent interaction is site-specific. We capture a
            # deterministic baseline and only attempt obvious accept buttons.
            accept = page.get_by_role("button", name=re.compile(r"accept|allow|zustimmen|akzeptieren|einverstanden", re.I))
            if consent_detected and await accept.count():
                try:
                    await accept.first.click(timeout=1500)
                    await page.wait_for_timeout(500)
                except Exception:
                    pass
            cookies_after = await context.cookies()
        finally:
            await browser.close()

    cookie_names_before = {c.get("name") for c in cookies_before}
    new_cookies = [c for c in cookies_after if c.get("name") not in cookie_names_before]
    third_party = [r for r in requests if r.get("technology")]
    findings: list[EvidenceFinding] = []
    base_url = target

    if not legal.get("impressum", False):
        findings.append(_finding("LEGAL-IMPRESSUM-01", "legal_notices", "warning", "Impressum link not detected", "No obvious Impressum/Imprint link was detected in the captured navigation.", base_url, "Verify the legally required provider identification and make it directly accessible.", .91))
    if not legal.get("datenschutz", False):
        findings.append(_finding("LEGAL-PRIVACY-01", "privacy_dsgvo", "warning", "Privacy policy link not detected", "No obvious Datenschutz/Privacy link was detected in the captured navigation.", base_url, "Verify that the applicable privacy information is accessible before relevant processing.", .91))
    if third_party and not consent_detected:
        findings.append(_finding("COOKIE-PRECONSENT-01", "ttdsg_consent", "critical", "Third-party tracking signal without detected consent UI", "Third-party analytics/advertising resources were observed while no obvious consent interface was detected.", base_url, "Verify consent collection and prior blocking of non-essential third-party resources.", .84, ", ".join(sorted(technologies))))
    if img_missing_alt:
        findings.append(_finding("A11Y-ALT-01", "accessibility_wcag", "recommendation", "Images without alt attributes detected", f"{img_missing_alt} image elements had no alt attribute in the captured DOM.", base_url, "Add meaningful alternative text or explicitly mark decorative images as empty-alt.", .96))
    if new_cookies and not consent_detected:
        findings.append(_finding("COOKIE-NEW-01", "ttdsg_consent", "warning", "Cookies set without detected consent interface", "New cookies appeared during the browser session while no obvious consent interface was detected.", base_url, "Classify cookies and verify that non-essential cookies are not set before valid consent.", .88, ", ".join(sorted(str(c.get("name")) for c in new_cookies))))

    payload = {
        "domain": parsed.hostname or "",
        "final_url": target,
        "title": title,
        "meta_description": meta,
        "legal_pages": legal,
        "technologies": sorted(technologies),
        "third_party_requests": third_party[:50],
        "cookies": [{"name": c.get("name", ""), "domain": c.get("domain", ""), "path": c.get("path", "")} for c in cookies_after[:50]],
        "consent": {"banner_detected": consent_detected, "new_cookies_after_interaction": [c.get("name", "") for c in new_cookies]},
        "accessibility": {"images_missing_alt": img_missing_alt, "interactive_controls": buttons},
        "content": {"headings": (await _headings_from_snapshot(body_text)) if False else [], "body_text": body_text[:4000], "script_count": len(scripts)},
        "deterministic_findings": [f.model_dump() for f in findings],
    }
    evidence_hash = _hash_payload(payload)
    return EvidenceSnapshot(
        domain=parsed.hostname or "",
        final_url=target,
        captured_at=captured_at,
        evidence_hash=evidence_hash,
        title=title,
        meta_description=meta,
        legal_pages=legal,
        technologies=sorted(technologies),
        third_party_requests=third_party[:50],
        cookies=[{"name": c.get("name", ""), "domain": c.get("domain", "")} for c in cookies_after[:50]],
        consent=payload["consent"],
        accessibility=payload["accessibility"],
        content=payload["content"],
        deterministic_findings=findings,
    )


async def _headings_from_snapshot(_: str) -> list[str]:
    return []
