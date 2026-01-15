import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

const statusLabel = {
  confirmado: 'Confirmado',
  espera: 'Espera',
  fora: 'Fora',
};

const LAST_PELADA_KEY = 'gestor:lastPeladaId';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

function PeladaIndex({ peladas, selectedPeladaId, loading }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (peladas.length && selectedPeladaId) {
      navigate(`/app/peladas/${selectedPeladaId}`, { replace: true });
    }
  }, [loading, peladas, selectedPeladaId, navigate]);

  if (loading) {
    return (
      <div className="card">
        <p>Carregando peladas...</p>
      </div>
    );
  }

  if (!peladas.length) {
    return (
      <div className="card empty-state">
        <h2>Sem peladas ainda</h2>
        <p>Crie uma pelada ou entre usando um codigo/ID.</p>
        <div className="actions">
          <Link className="button-link" to="/app/criar-pelada">
            Criar pelada
          </Link>
          <Link className="button-link secondary" to="/app/entrar-pelada">
            Entrar em pelada
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <p>Selecione uma pelada no menu lateral.</p>
    </div>
  );
}

function PeladaDashboard({
  peladas,
  selectedPeladaId,
  eventos,
  activeEvento,
  confirmacao,
  fila,
  members,
  isAdmin,
  loading,
  onSelectPelada,
  loadPeladaDashboard,
  confirmarPresenca,
  marcarFora,
  createEventoForm,
  setCreateEventoForm,
  createEvento,
  toggleEventoStatus,
  forceStatusForm,
  setForceStatusForm,
  adminForceStatus,
  updateMemberTipo,
}) {
  const { peladaId } = useParams();
  const pelada = peladas.find((item) => item.id === peladaId);
  const canRespond = activeEvento && activeEvento.status === 'aberto';
  const confirmados = fila.filter((item) => item.status === 'confirmado').length;

  useEffect(() => {
    if (!peladaId) return;
    if (peladaId !== selectedPeladaId) {
      onSelectPelada(peladaId);
    }
    loadPeladaDashboard(peladaId);
  }, [peladaId, selectedPeladaId, onSelectPelada, loadPeladaDashboard]);

  if (!pelada && !loading) {
    return (
      <div className="card">
        <h2>Pelada nao encontrada</h2>
        <p>Escolha outra pelada no menu lateral.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2>Proximo evento</h2>
          {activeEvento && (
            <span className={`badge status-badge ${activeEvento.status}`}>
              {activeEvento.status === 'aberto' ? 'Aberto' : 'Fechado'}
            </span>
          )}
        </div>
        {activeEvento ? (
          <div className="grid two">
            <div>
              <p>
                <strong>Data:</strong> {formatDateTime(activeEvento.data_evento)}
              </p>
              <p>
                <strong>Prioridade ate:</strong>{' '}
                {activeEvento.prioridade_ate
                  ? formatDateTime(activeEvento.prioridade_ate)
                  : 'Sem janela'}
              </p>
            </div>
            <div>
              <p>
                <strong>Status:</strong> {activeEvento.status}
              </p>
            </div>
          </div>
        ) : (
          <p>Nenhum evento cadastrado ainda.</p>
        )}
      </div>

      <div className="card">
        <h2>Minha situacao</h2>
        <p>
          <strong>Estado:</strong> {confirmacao ? statusLabel[confirmacao.status] : 'Nao respondeu'}
        </p>
        {confirmacao?.status === 'espera' && (
          <p>
            <strong>Posicao na fila:</strong> {confirmacao.ordem_fila}
          </p>
        )}
        {!canRespond && activeEvento && (
          <p>
            <small>Confirmacoes fechadas para este evento.</small>
          </p>
        )}
        <div className="actions">
          <button onClick={confirmarPresenca} disabled={loading || !canRespond}>
            Confirmar presenca
          </button>
          <button
            className="secondary"
            onClick={marcarFora}
            disabled={loading || !confirmacao || !canRespond}
          >
            Marcar fora
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Fila e confirmacoes</h2>
        {activeEvento ? (
          <div className="grid two">
            <div>
              <p>
                <strong>Confirmados:</strong> {confirmados}
                {pelada?.max_players ? ` / Maximo: ${pelada.max_players}` : ''}
              </p>
              {confirmacao?.status === 'espera' && (
                <p>
                  <strong>Voce esta em:</strong> #{confirmacao.ordem_fila}
                </p>
              )}
            </div>
            <div>
              {fila.length > 0 && (
                <details className="details">
                  <summary>Ver lista completa</summary>
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
                </details>
              )}
            </div>
          </div>
        ) : (
          <p>Nenhum evento aberto ainda.</p>
        )}
      </div>

      {pelada && (
        <div className="card">
          <h2>Detalhes da pelada</h2>
          <div className="actions">
            <div>
              <small>ID da pelada</small>
              <div className="code-box">{pelada.id}</div>
            </div>
            <button className="secondary" onClick={() => navigator.clipboard.writeText(pelada.id)}>
              Copiar ID
            </button>
          </div>
        </div>
      )}

      {isAdmin && pelada && (
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
                  onChange={(event) =>
                    setCreateEventoForm((prev) => ({
                      ...prev,
                      data_evento: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Prioridade ate (opcional)
                <input
                  type="datetime-local"
                  value={createEventoForm.prioridade_ate}
                  onChange={(event) =>
                    setCreateEventoForm((prev) => ({
                      ...prev,
                      prioridade_ate: event.target.value,
                    }))
                  }
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
                  <span>{formatDateTime(evento.data_evento)}</span>
                  <button
                    className="secondary"
                    onClick={() =>
                      toggleEventoStatus(
                        evento.id,
                        evento.status === 'aberto' ? 'fechado' : 'aberto'
                      )
                    }
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
                  onChange={(event) =>
                    setForceStatusForm((prev) => ({
                      ...prev,
                      user_id: event.target.value,
                    }))
                  }
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
                  onChange={(event) =>
                    setForceStatusForm((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
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

function CreatePeladaPage({ createPeladaForm, setCreatePeladaForm, loading, onCreatePelada }) {
  const navigate = useNavigate();

  const handleCreate = async () => {
    const result = await onCreatePelada();
    if (result?.id) {
      navigate(`/app/peladas/${result.id}`);
    }
  };

  return (
    <div className="card">
      <h2>Criar pelada</h2>
      <p>Defina o nome e o numero maximo de jogadores.</p>
      <div className="stack">
        <label>
          Nome
          <input
            value={createPeladaForm.name}
            onChange={(event) =>
              setCreatePeladaForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Pelada de quinta"
          />
        </label>
        <label>
          Maximo de jogadores
          <input
            type="number"
            min="1"
            value={createPeladaForm.max_players}
            onChange={(event) =>
              setCreatePeladaForm((prev) => ({ ...prev, max_players: event.target.value }))
            }
          />
        </label>
        <div className="actions" style={{ marginTop: 12 }}>
          <button onClick={handleCreate} disabled={loading || !createPeladaForm.name}>
            {loading ? 'Criando...' : 'Criar pelada'}
          </button>
        </div>
      </div>
    </div>
  );
}

function JoinPeladaPage({ joinPeladaId, setJoinPeladaId, loading, onJoinPelada }) {
  const navigate = useNavigate();

  const handleJoin = async () => {
    const result = await onJoinPelada();
    if (result?.peladaId) {
      navigate(`/app/peladas/${result.peladaId}`);
    }
  };

  return (
    <div className="card">
      <h2>Entrar em pelada</h2>
      <p>Digite o codigo/ID informado pelo admin.</p>
      <div className="actions">
        <input
          value={joinPeladaId}
          onChange={(event) => setJoinPeladaId(event.target.value)}
          placeholder="ID da pelada"
          style={{ minWidth: 240 }}
        />
        <button className="secondary" onClick={handleJoin} disabled={loading || !joinPeladaId}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}

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
    localStorage.setItem(LAST_PELADA_KEY, selectedPeladaId);
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
      const list = (data || []).map((row) => row.peladas).filter(Boolean);
      setPeladas(list);
      if (list.length) {
        const storedId = localStorage.getItem(LAST_PELADA_KEY);
        const currentMatch = list.find((pelada) => pelada.id === selectedPeladaId);
        const storedMatch = list.find((pelada) => pelada.id === storedId);
        const nextId = currentMatch?.id || storedMatch?.id || list[0]?.id || '';
        if (nextId && nextId !== selectedPeladaId) {
          setSelectedPeladaId(nextId);
        }
      }
    }
    setLoading(false);
  };

  const loadEventoInfo = useCallback(
    async (eventoId) => {
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
    },
    [userId]
  );

  const loadPeladaDashboard = useCallback(
    async (peladaId) => {
      if (!peladaId) return;
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
        await loadEventoInfo(eventoAtual.id);
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
      } else {
        setMembers([]);
      }

      setLoading(false);
    },
    [peladas, userId, loadEventoInfo]
  );

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
      return null;
    }

    await supabase.from('pelada_users').insert({
      pelada_id: data.id,
      user_id: userId,
      tipo: 'mensalista',
      ativo: true,
    });

    setCreatePeladaForm({ name: '', max_players: 16 });
    setNotice('Pelada criada.');
    await loadPeladas();
    setSelectedPeladaId(data.id);
    setLoading(false);
    return { id: data.id };
  };

  const joinPelada = async () => {
    if (!joinPeladaId) return null;
    setNotice('');
    setLoading(true);
    const { error } = await supabase.from('pelada_users').insert({
      pelada_id: joinPeladaId,
      user_id: userId,
      tipo: 'diarista',
      ativo: true,
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('duplicate') || message.includes('unique')) {
        setNotice('Voce ja participa dessa pelada.');
      } else if (message.includes('foreign key') || message.includes('pelada')) {
        setNotice('Pelada nao encontrada.');
      } else {
        setNotice(error.message);
      }
      setLoading(false);
      return null;
    }

    setJoinPeladaId('');
    setNotice('Entrou com sucesso.');
    await loadPeladas();
    setSelectedPeladaId(joinPeladaId);
    setLoading(false);
    return { peladaId: joinPeladaId };
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
    const { error } = await supabase.from('pelada_users').update({ tipo }).eq('id', memberId);
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
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, email: event.target.value }))
                    }
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
                      onChange={(event) =>
                        setAuthForm((prev) => ({ ...prev, password: event.target.value }))
                      }
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
                  disabled={loading || !emailValid || (loginMode === 'password' && !authForm.password)}
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
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Seu nome"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="voce@email.com"
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, password: event.target.value }))
                    }
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
                onChange={(event) =>
                  setResetForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Minimo 6 caracteres"
              />
            </label>
            <label>
              Confirmar senha
              <input
                type="password"
                value={resetForm.confirm}
                onChange={(event) =>
                  setResetForm((prev) => ({ ...prev, confirm: event.target.value }))
                }
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Gestor</div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-title">Peladas</div>
            {peladas.length === 0 ? (
              <p className="sidebar-empty">Nenhuma pelada.</p>
            ) : (
              <div className="sidebar-list">
                {peladas.map((pelada) => (
                  <NavLink
                    key={pelada.id}
                    to={`/app/peladas/${pelada.id}`}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  >
                    {pelada.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
          <div className="sidebar-section">
            <NavLink
              to="/app/criar-pelada"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              Criar pelada
            </NavLink>
            <NavLink
              to="/app/entrar-pelada"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              Entrar em pelada
            </NavLink>
          </div>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>Gestor de Pelada</h1>
            <div className="badge">{profile?.name || session.user.email}</div>
          </div>
          <button className="ghost" onClick={signOut}>
            Sair
          </button>
        </div>

        {notice && (
          <div className="card">
            <small>{notice}</small>
          </div>
        )}

        <Routes>
          <Route
            path="/app"
            element={
              <PeladaIndex
                peladas={peladas}
                selectedPeladaId={selectedPeladaId}
                loading={loading}
              />
            }
          />
          <Route
            path="/app/peladas/:peladaId"
            element={
              <PeladaDashboard
                peladas={peladas}
                selectedPeladaId={selectedPeladaId}
                eventos={eventos}
                activeEvento={activeEvento}
                confirmacao={confirmacao}
                fila={fila}
                members={members}
                isAdmin={isAdmin}
                loading={loading}
                onSelectPelada={setSelectedPeladaId}
                loadPeladaDashboard={loadPeladaDashboard}
                confirmarPresenca={confirmarPresenca}
                marcarFora={marcarFora}
                createEventoForm={createEventoForm}
                setCreateEventoForm={setCreateEventoForm}
                createEvento={createEvento}
                toggleEventoStatus={toggleEventoStatus}
                forceStatusForm={forceStatusForm}
                setForceStatusForm={setForceStatusForm}
                adminForceStatus={adminForceStatus}
                updateMemberTipo={updateMemberTipo}
              />
            }
          />
          <Route
            path="/app/criar-pelada"
            element={
              <CreatePeladaPage
                createPeladaForm={createPeladaForm}
                setCreatePeladaForm={setCreatePeladaForm}
                loading={loading}
                onCreatePelada={createPelada}
              />
            }
          />
          <Route
            path="/app/entrar-pelada"
            element={
              <JoinPeladaPage
                joinPeladaId={joinPeladaId}
                setJoinPeladaId={setJoinPeladaId}
                loading={loading}
                onJoinPelada={joinPelada}
              />
            }
          />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}
