-- Performance: auth.<fn>() in RLS-Policies in (select auth.<fn>()) wrappen.
-- Supabase-empfohlene, WERTERHALTENDE Optimierung (identisches Boolean-Ergebnis,
-- aber Postgres wertet den Aufruf einmal pro Query statt pro Zeile aus).
-- Advisor: auth_rls_initplan. Kontext: docs/runtime/SYSTEMCHECK-2026-05-28.md.
-- Idempotent: rewritet nur Policies mit noch ungewrappten auth.*()-Aufrufen.

do $$
declare r record; nq text; nc text; changed boolean;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname='public'
      and ( (qual is not null and qual ~* 'auth\.(uid|role|jwt|email)\(\)' and qual !~* '\(\s*select\s+auth\.')
         or (with_check is not null and with_check ~* 'auth\.(uid|role|jwt|email)\(\)' and with_check !~* '\(\s*select\s+auth\.') )
  loop
    nq := r.qual; nc := r.with_check; changed := false;
    if r.qual is not null and r.qual ~* 'auth\.(uid|role|jwt|email)\(\)' and r.qual !~* '\(\s*select\s+auth\.' then
      nq := regexp_replace(r.qual, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g'); changed := true;
    end if;
    if r.with_check is not null and r.with_check ~* 'auth\.(uid|role|jwt|email)\(\)' and r.with_check !~* '\(\s*select\s+auth\.' then
      nc := regexp_replace(r.with_check, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g'); changed := true;
    end if;
    if changed then
      if nq is not null and nc is not null then
        execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, nq, nc);
      elsif nq is not null then
        execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, nq);
      else
        execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, nc);
      end if;
    end if;
  end loop;
end $$;
