/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  setPostCheckoutReturn, getPostCheckoutReturn, clearPostCheckoutReturn,
} from '../../src/lib/optimizer/state';

describe('post-checkout return path', () => {
  beforeEach(() => {
    clearPostCheckoutReturn();
  });

  it('speichert und liest einen internen Pfad', () => {
    setPostCheckoutReturn('/optimizer/dashboard');
    expect(getPostCheckoutReturn()).toBe('/optimizer/dashboard');
  });

  it('lehnt externe/Protocol-relative Ziele ab (kein Open-Redirect)', () => {
    setPostCheckoutReturn('https://evil.example.com');
    expect(getPostCheckoutReturn()).toBeNull();
    setPostCheckoutReturn('//evil.example.com');
    expect(getPostCheckoutReturn()).toBeNull();
  });

  it('clear entfernt den Wert', () => {
    setPostCheckoutReturn('/optimizer/dashboard');
    clearPostCheckoutReturn();
    expect(getPostCheckoutReturn()).toBeNull();
  });
});
