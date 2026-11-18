// WCAG Color Contrast Checker — W3C Standard Implementation

import { ContrastResult, UXFinding } from './types'

// RealSync color palette
export const REALSYNC_COLORS = {
  obsidian: '#0a0e27',
  titanium: '#1a1a2e',
  security_blue: '#1366d9',
  petrol: '#184e6f',
  slate: '#4a5568'
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

// W3C relative luminance formula
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return rs * 0.2126 + gs * 0.7152 + bs * 0.0722
}

export function getContrastRatio(L1: number, L2: number): number {
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  return Math.round(ratio * 100) / 100
}

export function checkContrast(fg: string, bg: string): ContrastResult {
  const fgRgb = hexToRgb(fg)
  const bgRgb = hexToRgb(bg)

  if (!fgRgb || !bgRgb) {
    return {
      foreground: fg,
      background: bg,
      ratio: 0,
      wcagAA: false,
      wcagAAA: false,
      status: 'fail'
    }
  }

  const L1 = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b)
  const L2 = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b)
  const ratio = getContrastRatio(L1, L2)

  const wcagAA = ratio >= 4.5
  const wcagAAA = ratio >= 7.0

  const status: 'pass' | 'warn' | 'fail' = wcagAAA ? 'pass' : wcagAA ? 'warn' : 'fail'

  return {
    foreground: fg,
    background: bg,
    ratio,
    wcagAA,
    wcagAAA,
    status: status as 'pass' | 'warn' | 'fail'
  }
}

export interface ColorCombination {
  name: string
  fg: string
  bg: string
  usage: string
}

export function validateCommonCombinations(): ContrastResult[] {
  const combinations: ColorCombination[] = [
    { name: 'obsidian-on-white', fg: REALSYNC_COLORS.obsidian, bg: '#ffffff', usage: 'default text' },
    { name: 'security-blue-on-white', fg: REALSYNC_COLORS.security_blue, bg: '#ffffff', usage: 'links' },
    { name: 'titanium-on-obsidian', fg: REALSYNC_COLORS.titanium, bg: REALSYNC_COLORS.obsidian, usage: 'dark mode text' },
    { name: 'white-on-security-blue', fg: '#ffffff', bg: REALSYNC_COLORS.security_blue, usage: 'buttons' },
    { name: 'white-on-obsidian', fg: '#ffffff', bg: REALSYNC_COLORS.obsidian, usage: 'header text' }
  ]

  return combinations.map((c) => ({
    ...checkContrast(c.fg, c.bg),
    foreground: `${c.name} (${c.usage})`
  }))
}

export interface ContrastIssue {
  location: string
  element: string
  fg: string
  bg: string
  ratio: number
  recommendation: string
}

export function detectContrastIssues(
  elements: Array<{ fg: string; bg: string; location: string; element?: string }>,
  minRatio: number = 4.5
): ContrastIssue[] {
  return elements
    .map((el) => {
      const result = checkContrast(el.fg, el.bg)
      return {
        location: el.location,
        element: el.element || 'unknown',
        fg: el.fg,
        bg: el.bg,
        ratio: result.ratio,
        passes: result.ratio >= minRatio,
        recommendation: ''
      }
    })
    .filter((issue) => !issue.passes)
    .map((issue) => ({
      location: issue.location,
      element: issue.element,
      fg: issue.fg,
      bg: issue.bg,
      ratio: issue.ratio,
      recommendation: `Increase contrast ratio from ${issue.ratio}:1 to at least ${minRatio}:1 for WCAG compliance`
    }))
}
