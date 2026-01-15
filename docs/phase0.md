Phase 0 - Current front-end map (Gestor de Pelada)

Routes / pages
- Single-page app with one main component: src/App.jsx
- Auth, reset-password, and logged-in views are conditional branches inside App.
- No router or nested routes yet.

Main components / modules
- src/App.jsx: all UI and state for auth + logged-in flow.
- src/lib/supabaseClient.js: Supabase client setup (env vars, auth session persistence).

Key local state (App)
- Auth: session, profile, authView, loginMode, magicSent, resetMode, authForm, resetForm.
- Peladas: peladas, selectedPeladaId, createPeladaForm, joinPeladaId.
- Eventos: eventos, activeEvento (memo), createEventoForm.
- Confirmacoes: confirmacao, fila.
- Admin: members, forceStatusForm.
- UI: loading, notice.

Supabase usage map (queries + intent)
- List peladas do usuario
  - supabase.from('pelada_users')
    .select('id, tipo, ativo, peladas (id, name, admin_id, max_players)')
    .eq('user_id', userId)
    .eq('ativo', true)
  - Used in loadPeladas().

- Criar pelada
  - supabase.from('peladas').insert({ name, max_players, admin_id }).select().single()
  - supabase.from('pelada_users').insert({ pelada_id, user_id, tipo: 'mensalista', ativo: true })
  - Used in createPelada().

- Entrar em pelada por ID
  - supabase.from('pelada_users').insert({ pelada_id: joinPeladaId, user_id, tipo: 'diarista', ativo: true })
  - Used in joinPelada().

- Buscar eventos da pelada (proximo / atual)
  - supabase.from('eventos').select('*')
    .eq('pelada_id', peladaId)
    .order('data_evento', { ascending: true })
  - Active event derived by status === 'aberto' or first in list.
  - Used in loadPeladaDashboard().

- Buscar confirmacao do usuario
  - supabase.from('confirmacoes').select('*')
    .eq('evento_id', eventoId)
    .eq('user_id', userId)
    .maybeSingle()
  - Used in loadEventoInfo().

- Buscar fila/confirmacoes do evento
  - supabase.from('confirmacoes').select('id, user_id, status, ordem_fila, users (name, email)')
    .eq('evento_id', eventoId)
    .order('status', { ascending: true })
    .order('ordem_fila', { ascending: true, nullsFirst: true })
  - Used in loadEventoInfo().

- Confirmar presenca
  - supabase.rpc('confirm_presence', { p_evento_id: activeEvento.id })
  - Used in confirmarPresenca().

- Marcar fora
  - supabase.from('confirmacoes')
    .update({ status: 'fora' })
    .eq('evento_id', activeEvento.id)
    .eq('user_id', userId)
  - Used in marcarFora().

Other Supabase calls (admin / auth)
- Perfil: supabase.from('users').select('*').eq('id', userId).maybeSingle()
- Admin members: supabase.from('pelada_users')
  .select('id, user_id, tipo, ativo, users (id, name, email)')
  .eq('pelada_id', peladaId)
  .order('created_at', { ascending: true })
- Admin event status: supabase.from('eventos').update({ status }).eq('id', eventoId)
- Admin force status: supabase.rpc('admin_force_status', { p_evento_id, p_user_id, p_status })
- Auth: signInWithOtp, signUp, signInWithPassword, signInWithOAuth, resetPasswordForEmail, updateUser, signOut.

Reusables likely to keep
- loadPeladas(), loadPeladaDashboard(), loadEventoInfo() data logic.
- createPelada(), joinPelada(), confirmarPresenca(), marcarFora().
