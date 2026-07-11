const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_TEST_URL || '';
const anonKey = process.env.SUPABASE_TEST_ANON_KEY || '';
const email = process.env.SUPABASE_TEST_EMAIL || '';
const password = process.env.SUPABASE_TEST_PASSWORD || '';
const enabled = Boolean(url && anonKey && email && password);

test.describe('Supabase real', () => {
  test.skip(!enabled, 'Configura SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_EMAIL y SUPABASE_TEST_PASSWORD.');

  test('autentica y valida las funciones de endurecimiento', async () => {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });
    expect(authError, authError?.message).toBeNull();
    expect(authData.user?.id).toBeTruthy();

    const { data, error } = await client.rpc('team_hardening_self_check');
    expect(error, error?.message).toBeNull();
    expect(data?.ok).toBe(true);
    expect(data?.business_id).toBeTruthy();
    expect(data?.role).toBeTruthy();

    const operationId = crypto.randomUUID();
    const { data: first, error: firstError } = await client.rpc('commit_team_batch', {
      p_operation_id: operationId,
      p_branch_id: null,
      p_operations: []
    });
    expect(firstError, firstError?.message).toBeNull();
    expect(first?.ok).toBe(true);
    expect(first?.replayed).toBe(false);

    const { data: replay, error: replayError } = await client.rpc('commit_team_batch', {
      p_operation_id: operationId,
      p_branch_id: null,
      p_operations: []
    });
    expect(replayError, replayError?.message).toBeNull();
    expect(replay?.ok).toBe(true);
    expect(replay?.replayed).toBe(true);

    await client.auth.signOut();
  });
});
