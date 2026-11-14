import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';
import { ProtectedRoute } from '../../src/features/demo/ProtectedRoute';

const state = { isAuthenticated: false, isLoading: false };

vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => state,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/risk" element={<ProtectedRoute><p>geheim</p></ProtectedRoute>} />
        <Route path="/welcome" element={<p>welcome-gate</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    state.isAuthenticated = false;
    state.isLoading = false;
  });

  it('leitet ohne Sitzung nach /welcome und rendert den Inhalt mit Sitzung', () => {
    const blocked = renderAt('/app/risk?tab=1');
    expect(screen.getByText('welcome-gate')).toBeInTheDocument();
    expect(screen.queryByText('geheim')).not.toBeInTheDocument();
    blocked.unmount();

    state.isAuthenticated = true;
    renderAt('/app/risk?tab=1');
    expect(screen.getByText('geheim')).toBeInTheDocument();
  });

  it('zeigt beim Laden keinen Inhalt', () => {
    state.isLoading = true;
    renderAt('/app/risk');
    expect(screen.getByText('Lade …')).toBeInTheDocument();
    expect(screen.queryByText('geheim')).not.toBeInTheDocument();
  });
});
