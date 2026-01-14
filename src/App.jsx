import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabaseClient';

const statusLabel = {
  confirmado: 'Confirmado',
  espera: 'Espera',
  fora: 'Fora',
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [peladas, setPeladas] = useState([]);
  const [selectedPeladaId, setSelectedPeladaId] = useState('');
  const [eventos, setEventos] = useState([]);
  const [confirmacao, setConfirmacao] = useState(null);
  const [fila, setFila] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [createPeladaForm, setCreatePeladaForm] = useState({ name: '', max_players: 16 });
  const [joinPeladaId, setJoinPeladaId] = useState('');
  const [createEventoForm, setCreateEventoForm] = useState({ data_evento: '', prioridade_ate: '' });
  const [forceStatusForm, setForceStatusForm] = useState({ user_id: '', status: 'confirmado' });
  const [authForm, setAuthForm] = useState({ email: '', name: '', password: '' });
  const [authView, setAuthView] = useState('login');
  const [loginMode, setLoginMode] = useState('magic');
  const [magicSent, setMagicSent] = useState(false);
  const [magicSentAt, setMagicSentAt] = useState(0);
  const [magicTick, setMagicTick] = useState(0);
  const [resetMode, setResetMode] = useState(false);
  const [resetForm, setResetForm] = useState({ password: '', confirm: '' });

  const userId = session?.user?.id;
  const emailValue = authForm.email.trim();
  const emailValid = /\S+@\S+\.\S+/.test(emailValue);

  const selectedPelada = useMemo(
    () => peladas.find((pelada) => pelada.id === selectedPeladaId),
    [peladas, selectedPeladaId]
  );

  const isAdmin = selectedPelada?.admin_id === userId;

  const activeEvento = useMemo(() => {
    if (!eventos.length) return null;
    return eventos.find((evento) => evento.status === 'aberto') || eventos[0];
  }, [eventos]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setResetMode(true);
      }
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setPeladas([]);
        setSelectedPeladaId('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      setResetMode(true);
    }
  }, []);

  useEffect(() => {
    if (!magicSentAt) return;
    const id = setInterval(() => {
      setMagicTick((value) => value + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [magicSentAt]);

  useEffect(() => {
    if (!userId) return;
    loadProfile();
    loadPeladas();
  }, [userId]);

  useEffect(() => {
    if (!selectedPeladaId) return;
    loadPeladaDashboard(selectedPeladaId);
  }, [selectedPeladaId]);

  const loadProfile = async () => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (!error) {
      setProfile(data);
    }
  };

  const loadPeladas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pelada_users')
      .select('id, tipo, ativo, peladas (id, name, admin_id, max_players)')
      .eq('user_id', userId)
      .eq('ativo', true);

    if (error) {
      setNotice(error.message);
    } else {
      const list = (data || [])
        .map((row) => row.peladas)
        .filter(Boolean);
      setPeladas(list);
      if (list.length && !selectedPeladaId) {
        setSelectedPeladaId(list[0].id);
      }
    }
    setLoading(false);
  };

  const loadPeladaDashboard = async (peladaId) => {
    setLoading(true);
    const admin = peladas.find((pelada) => pelada.id === peladaId)?.admin_id === userId;

    const { data: eventosData, error: eventosError } = await supabase
      .from('eventos')
      .select('*')
      .eq('pelada_id', peladaId)
      .order('data_evento', { ascending: true });

    if (eventosError) {
      setNotice(eventosError.message);
      setLoading(false);
      return;
    }

    setEventos(eventosData || []);

    const eventoAtual = (eventosData || []).find((evento) => evento.status === 'aberto');
    if (eventoAtual) {
      await loadEventoInfo(eventoAtual.id, peladaId);
    } else {
      setConfirmacao(null);
      setFila([]);
    }

    if (admin) {
      const { data: membersData } = await supabase
        .from('pelada_users')
        .select('id, user_id, tipo, ativo, users (id, name, email)')
        .eq('pelada_id', peladaId)
        .order('created_at', { ascending: true });
      setMembers(membersData || []);
    }

    setLoading(false);
  };

  const loadEventoInfo = async (eventoId, peladaId) => {
    const { data: confirmacaoData } = await supabase
      .from('confirmacoes')
      .select('*')
      .eq('evento_id', eventoId)
      .eq('user_id', userId)
      .maybeSingle();

    setConfirmacao(confirmacaoData || null);

    const { data: filaData } = await supabase
      .from('confirmacoes')
      .select('id, user_id, status, ordem_fila, users (name, email)')
      .eq('evento_id', eventoId)
      .order('status', { ascending: true })
      .order('ordem_fila', { ascending: true, nullsFirst: true });
    setFila(filaData || []);
  };

  const signInWithMagicLink = async () => {
    setNotice('');
    setLoading(true);
    setMagicSent(false);
    setMagicSentAt(0);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailValue,
      options: {
        data: { name: authForm.name },
      },
    });
    if (error) {
      setNotice(error.message);
    } else {
      setNotice('Link de acesso enviado para seu email.');
      setMagicSent(true);
      setMagicSentAt(Date.now());
    }
    setLoading(false);
  };

  const signUpWithPassword = async () => {
    setNotice('');
    setLoading(true);
    setMagicSent(false);
    setMagicSentAt(0);
    const { error } = await supabase.auth.signUp({
      email: emailValue,
      password: authForm.password,
      options: { data: { name: authForm.name } },
    });
    if (error) {
      setNotice(error.message);
    } else {
      setNotice('Conta criada. Verifique seu email se a confirmacao estiver ativa.');
    }
    setLoading(false);
  };

  const signInWithPassword = async () => {
    setNotice('');
    setLoading(true);
    setMagicSent(false);
    setMagicSentAt(0);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailValue,
      password: authForm.password,
    });
    if (error) {
      setNotice(error.message);
    }
    setLoading(false);
  };

  const resetPassword = async () => {
    setNotice('');
    setLoading(true);
    setMagicSentAt(0);
    const { error } = await supabase.auth.resetPasswordForEmail(emailValue, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setNotice(error.message);
    } else {
      setNotice('Enviamos um email para redefinir sua senha.');
    }
    setLoading(false);
  };

  const updatePassword = async () => {
    setNotice('');
    if (!resetForm.password || resetForm.password !== resetForm.confirm) {
      setNotice('As senhas nao conferem.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: resetForm.password });
    if (error) {
      setNotice(error.message);
    } else {
      setNotice('Senha atualizada com sucesso.');
      setResetMode(false);
      setResetForm({ password: '', confirm: '' });
      window.history.replaceState(null, '', window.location.pathname);
    }
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const createPelada = async () => {
    setNotice('');
    setLoading(true);
    const { data, error } = await supabase
      .from('peladas')
      .insert({
        name: createPeladaForm.name,
        max_players: Number(createPeladaForm.max_players),
        admin_id: userId,
      })
      .select()
      .single();

    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }

    await supabase.from('pelada_users').insert({
      pelada_id: data.id,
      user_id: userId,
      tipo: 'mensalista',
      ativo: true,
    });

    setCreatePeladaForm({ name: '', max_players: 16 });
    await loadPeladas();
    setSelectedPeladaId(data.id);
    setLoading(false);
  };

  const joinPelada = async () => {
    if (!joinPeladaId) return;
    setNotice('');
    setLoading(true);
    const { error } = await supabase.from('pelada_users').insert({
      pelada_id: joinPeladaId,
      user_id: userId,
      tipo: 'diarista',
      ativo: true,
    });

    if (error) {
      setNotice(error.message);
    } else {
      setJoinPeladaId('');
      await loadPeladas();
    }
    setLoading(false);
  };

  const createEvento = async () => {
    if (!selectedPeladaId) return;
    setNotice('');
    setLoading(true);
    const payload = {
      pelada_id: selectedPeladaId,
      data_evento: createEventoForm.data_evento,
      status: 'aberto',
      prioridade_ate: createEventoForm.prioridade_ate || null,
    };
    const { error } = await supabase.from('eventos').insert(payload);
    if (error) {
      setNotice(error.message);
    } else {
      setCreateEventoForm({ data_evento: '', prioridade_ate: '' });
      await loadPeladaDashboard(selectedPeladaId);
    }
    setLoading(false);
  };

  const toggleEventoStatus = async (eventoId, status) => {
    setNotice('');
    setLoading(true);
    const { error } = await supabase.from('eventos').update({ status }).eq('id', eventoId);
    if (error) {
      setNotice(error.message);
    } else {
      await loadPeladaDashboard(selectedPeladaId);
    }
    setLoading(false);
  };

  const confirmarPresenca = async () => {
    if (!activeEvento) return;
    setNotice('');
    setLoading(true);
    const { error } = await supabase.rpc('confirm_presence', { p_evento_id: activeEvento.id });
    if (error) {
      setNotice(error.message);
    }
    await loadPeladaDashboard(selectedPeladaId);
    setLoading(false);
  };

  const marcarFora = async () => {
    if (!activeEvento) return;
    setNotice('');
    setLoading(true);
    const { error } = await supabase
      .from('confirmacoes')
      .update({ status: 'fora' })
      .eq('evento_id', activeEvento.id)
      .eq('user_id', userId);
    if (error) {
      setNotice(error.message);
    }
    await loadPeladaDashboard(selectedPeladaId);
    setLoading(false);
  };

  const updateMemberTipo = async (memberId, tipo) => {
    setNotice('');
    const { error } = await supabase
      .from('pelada_users')
      .update({ tipo })
      .eq('id', memberId);
    if (error) {
      setNotice(error.message);
    } else {
      await loadPeladaDashboard(selectedPeladaId);
    }
  };

  const adminForceStatus = async () => {
    if (!activeEvento || !forceStatusForm.user_id) return;
    setNotice('');
    setLoading(true);
    const { error } = await supabase.rpc('admin_force_status', {
      p_evento_id: activeEvento.id,
      p_user_id: forceStatusForm.user_id,
      p_status: forceStatusForm.status,
    });
    if (error) {
      setNotice(error.message);
    }
    await loadPeladaDashboard(selectedPeladaId);
    setLoading(false);
  };

  if (!session && !resetMode) {
    const primaryLoginLabel =
      loginMode === 'magic'
        ? loading
          ? 'Enviando...'
        : 'Enviar link'
        : loading
        ? 'Entrando...'
        : 'Entrar';
    const now = Date.now() + magicTick;
    const resendRemaining = magicSentAt
      ? Math.max(0, 30 - Math.floor((now - magicSentAt) / 1000))
      : 0;

    return (
      <div className="app">
        <div className="header">
          <h1>Gestor de Pelada</h1>
        </div>
        <div className="card">
          <div className="tabs">
            <button
              className={`tab ${authView === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthView('login');
                setNotice('');
                setMagicSent(false);
                setMagicSentAt(0);
              }}
            >
              Entrar
            </button>
            <button
              className={`tab ${authView === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setAuthView('signup');
                setNotice('');
                setMagicSent(false);
                setMagicSentAt(0);
              }}
            >
              Criar conta
            </button>
          </div>

          {authView === 'login' ? (
            <>
              <h2>Entrar</h2>
              <p>Entre com Google ou receba um link de acesso no seu email.</p>
              <div className="stack">
                <button className="primary" onClick={signInWithGoogle} disabled={loading}>
                  Continuar com Google
                </button>
                <div className="divider">
                  <span>ou</span>
                </div>
                <label>
                  Email
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="voce@email.com"
                  />
                </label>
                <div className="radio-group">
                  <label className="radio">
                    <input
                      type="radio"
                      name="loginMode"
                      checked={loginMode === 'magic'}
                      onChange={() => setLoginMode('magic')}
                    />
                    Receber link por email (recomendado)
                  </label>
                  <label className="radio">
                    <input
                      type="radio"
                      name="loginMode"
                      checked={loginMode === 'password'}
                      onChange={() => setLoginMode('password')}
                    />
                    Usar senha
                  </label>
                </div>
                {loginMode === 'password' && (
                  <label>
                    Senha
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Minimo 6 caracteres"
                    />
                  </label>
                )}
                <small>
                  {loginMode === 'magic'
                    ? 'Enviaremos um link que expira em alguns minutos.'
                    : 'Use a senha da sua conta.'}
                </small>
                <button
                  onClick={loginMode === 'magic' ? signInWithMagicLink : signInWithPassword}
                  disabled={
                    loading ||
                    !emailValid ||
                    (loginMode === 'password' && !authForm.password)
                  }
                >
                  {primaryLoginLabel}
                </button>
                {magicSent && (
                  <div className="notice">
                    <small>Cheque seu email. Voce pode reenviar em {resendRemaining}s.</small>
                    <button
                      className="secondary"
                      onClick={signInWithMagicLink}
                      disabled={loading || !emailValid || resendRemaining > 0}
                    >
                      Reenviar link
                    </button>
                  </div>
                )}
              </div>
              <div className="auth-links">
                <button
                  className="link"
                  onClick={() => {
                    setAuthView('signup');
                    setNotice('');
                    setMagicSent(false);
                    setMagicSentAt(0);
                  }}
                >
                  Nao tem conta? Criar conta
                </button>
                <button className="link" onClick={resetPassword} disabled={!emailValid || loading}>
                  Esqueci minha senha
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Criar conta</h2>
              <p>Crie sua conta com email e senha.</p>
              <div className="stack">
                <label>
                  Nome
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Seu nome"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="voce@email.com"
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Minimo 6 caracteres"
                  />
                </label>
                <button
                  onClick={signUpWithPassword}
                  disabled={loading || !emailValid || !authForm.password || !authForm.name}
                >
                  {loading ? 'Criando...' : 'Criar conta'}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setAuthView('login');
                    setNotice('');
                    setMagicSent(false);
                    setMagicSentAt(0);
                  }}
                  disabled={loading}
                >
                  Voltar para entrar
                </button>
              </div>
            </>
          )}

          {notice && (
            <p>
              <small>{notice}</small>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (resetMode) {
    return (
      <div className="app">
        <div className="header">
          <h1>Gestor de Pelada</h1>
        </div>
        <div className="card">
          <h2>Redefinir senha</h2>
          <p>Crie uma nova senha para sua conta.</p>
          <div className="stack">
            <label>
              Nova senha
              <input
                type="password"
                value={resetForm.password}
                onChange={(event) => setResetForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Minimo 6 caracteres"
              />
            </label>
            <label>
              Confirmar senha
              <input
                type="password"
                value={resetForm.confirm}
                onChange={(event) => setResetForm((prev) => ({ ...prev, confirm: event.target.value }))}
                placeholder="Repita a senha"
              />
            </label>
            <button onClick={updatePassword} disabled={loading || !resetForm.password}>
              {loading ? 'Salvando...' : 'Atualizar senha'}
            </button>
            <button
              className="secondary"
              onClick={() => {
                setResetMode(false);
                setResetForm({ password: '', confirm: '' });
                window.history.replaceState(null, '', window.location.pathname);
              }}
              disabled={loading}
            >
              Cancelar
            </button>
          </div>
          {notice && (
            <p>
              <small>{notice}</small>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Gestor de Pelada</h1>
          <div className="badge">{profile?.name || session.user.email}</div>
        </div>
        <button className="ghost" onClick={signOut}>Sair</button>
      </div>

      {notice && (
        <div className="card">
          <small>{notice}</small>
        </div>
      )}

      <div className="grid two">
        <div className="card">
          <h2>Suas peladas</h2>
          {peladas.length === 0 && <p>Nenhuma pelada ainda.</p>}
          {peladas.length > 0 && (
            <label>
              Selecionar pelada
              <select
                value={selectedPeladaId}
                onChange={(event) => setSelectedPeladaId(event.target.value)}
              >
                {peladas.map((pelada) => (
                  <option key={pelada.id} value={pelada.id}>
                    {pelada.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="card">
          <h2>Criar pelada</h2>
          <label>
            Nome
            <input
              value={createPeladaForm.name}
              onChange={(event) => setCreatePeladaForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Pelada de quinta"
            />
          </label>
          <label>
            Maximo de jogadores
            <input
              type="number"
              min="1"
              value={createPeladaForm.max_players}
              onChange={(event) => setCreatePeladaForm((prev) => ({ ...prev, max_players: event.target.value }))}
            />
          </label>
          <div className="actions" style={{ marginTop: 12 }}>
            <button onClick={createPelada} disabled={loading || !createPeladaForm.name}>
              Criar
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Entrar em uma pelada</h2>
        <p>Use o ID da pelada informado pelo admin.</p>
        <div className="actions">
          <input
            value={joinPeladaId}
            onChange={(event) => setJoinPeladaId(event.target.value)}
            placeholder="ID da pelada"
            style={{ minWidth: 220 }}
          />
          <button className="secondary" onClick={joinPelada} disabled={loading || !joinPeladaId}>
            Entrar
          </button>
        </div>
      </div>

      {selectedPelada && (
        <div className="card">
          <h2>Evento atual</h2>
          <p><small>ID da pelada: {selectedPelada.id}</small></p>
          {activeEvento ? (
            <div className="grid">
              <div>
                <p><strong>Data:</strong> {new Date(activeEvento.data_evento).toLocaleString()}</p>
                <p><strong>Status:</strong> {activeEvento.status}</p>
                <p><strong>Prioridade ate:</strong> {activeEvento.prioridade_ate ? new Date(activeEvento.prioridade_ate).toLocaleString() : 'Sem janela'}</p>
              </div>
              <div>
                <p><strong>Sua situacao:</strong> {confirmacao ? statusLabel[confirmacao.status] : 'Nao confirmado'}</p>
                {confirmacao?.status === 'espera' && (
                  <p><strong>Posicao na fila:</strong> {confirmacao.ordem_fila}</p>
                )}
              </div>
              <div className="actions">
                <button onClick={confirmarPresenca} disabled={loading || activeEvento.status !== 'aberto'}>
                  Confirmar presenca
                </button>
                <button className="secondary" onClick={marcarFora} disabled={loading || !confirmacao}>
                  Marcar fora
                </button>
              </div>
              <div>
                <h3>Confirmacoes</h3>
                {fila.length ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Jogador</th>
                        <th>Status</th>
                        <th>Fila</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fila.map((item) => (
                        <tr key={item.id}>
                          <td>{item.users?.name || item.users?.email || item.user_id}</td>
                          <td>
                            <span className={`status-pill status-${item.status}`}>
                              {statusLabel[item.status]}
                            </span>
                          </td>
                          <td>{item.ordem_fila || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>Nenhuma confirmacao ainda.</p>
                )}
              </div>
            </div>
          ) : (
            <p>Nenhum evento aberto ainda.</p>
          )}
        </div>
      )}

      {isAdmin && selectedPelada && (
        <div className="card">
          <h2>Painel admin</h2>
          <div className="grid two">
            <div>
              <h3>Criar evento</h3>
              <label>
                Data e hora
                <input
                  type="datetime-local"
                  value={createEventoForm.data_evento}
                  onChange={(event) => setCreateEventoForm((prev) => ({ ...prev, data_evento: event.target.value }))}
                />
              </label>
              <label>
                Prioridade ate (opcional)
                <input
                  type="datetime-local"
                  value={createEventoForm.prioridade_ate}
                  onChange={(event) => setCreateEventoForm((prev) => ({ ...prev, prioridade_ate: event.target.value }))}
                />
              </label>
              <div className="actions" style={{ marginTop: 12 }}>
                <button onClick={createEvento} disabled={loading || !createEventoForm.data_evento}>
                  Abrir confirmacoes
                </button>
              </div>
            </div>
            <div>
              <h3>Eventos</h3>
              {(eventos || []).map((evento) => (
                <div key={evento.id} className="actions" style={{ marginBottom: 8 }}>
                  <span>{new Date(evento.data_evento).toLocaleString()}</span>
                  <button
                    className="secondary"
                    onClick={() => toggleEventoStatus(evento.id, evento.status === 'aberto' ? 'fechado' : 'aberto')}
                  >
                    {evento.status === 'aberto' ? 'Fechar' : 'Abrir'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid two" style={{ marginTop: 20 }}>
            <div>
              <h3>Fila e confirmacoes</h3>
              {activeEvento ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th>Status</th>
                      <th>Fila</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fila.map((item) => (
                      <tr key={item.id}>
                        <td>{item.users?.name || item.users?.email || item.user_id}</td>
                        <td>
                          <span className={`status-pill status-${item.status}`}>
                            {statusLabel[item.status]}
                          </span>
                        </td>
                        <td>{item.ordem_fila || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Nenhum evento selecionado.</p>
              )}
            </div>
            <div>
              <h3>Forcar status</h3>
              <label>
                Jogador
                <select
                  value={forceStatusForm.user_id}
                  onChange={(event) => setForceStatusForm((prev) => ({ ...prev, user_id: event.target.value }))}
                >
                  <option value="">Selecione</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.users?.name || member.users?.email || member.user_id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={forceStatusForm.status}
                  onChange={(event) => setForceStatusForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="confirmado">Confirmado</option>
                  <option value="espera">Espera</option>
                  <option value="fora">Fora</option>
                </select>
              </label>
              <div className="actions" style={{ marginTop: 12 }}>
                <button onClick={adminForceStatus} disabled={loading || !activeEvento}>
                  Aplicar
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>Participantes</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.users?.name || '-'}</td>
                    <td>{member.users?.email || '-'}</td>
                    <td>
                      <select
                        value={member.tipo}
                        onChange={(event) => updateMemberTipo(member.id, event.target.value)}
                      >
                        <option value="mensalista">Mensalista</option>
                        <option value="diarista">Diarista</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
