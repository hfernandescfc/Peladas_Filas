-- Schema and business logic for Gestor de Pelada

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key,
  name text,
  email text unique,
  created_at timestamp with time zone default now()
);

create table if not exists public.peladas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  admin_id uuid not null references public.users(id),
  max_players integer not null check (max_players > 0),
  created_at timestamp with time zone default now()
);

create table if not exists public.pelada_users (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  tipo text not null check (tipo in ('mensalista', 'diarista')),
  ativo boolean default true,
  created_at timestamp with time zone default now(),
  unique (pelada_id, user_id)
);

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas(id) on delete cascade,
  data_evento timestamp with time zone not null,
  status text not null check (status in ('aberto', 'fechado')),
  prioridade_ate timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.confirmacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('confirmado', 'espera', 'fora')),
  ordem_fila integer,
  created_at timestamp with time zone default now(),
  unique (evento_id, user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email)
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_pelada_admin(p_pelada_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_exists boolean;
begin
  select exists(
    select 1 from public.peladas
    where id = p_pelada_id and admin_id = auth.uid()
  ) into v_exists;
  return v_exists;
end;
$$;

create or replace function public.normalize_confirmacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'espera' then
    new.ordem_fila := null;
  end if;
  return new;
end;
$$;

create or replace trigger normalize_confirmacao_before
before insert or update on public.confirmacoes
for each row execute function public.normalize_confirmacao();

create or replace function public.promote_waitlist(p_evento_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_pelada_id uuid;
  v_max integer;
  v_confirmados integer;
  v_next record;
begin
  select e.pelada_id into v_pelada_id from public.eventos e where e.id = p_evento_id;
  if v_pelada_id is null then
    return;
  end if;

  select p.max_players into v_max from public.peladas p where p.id = v_pelada_id;
  select count(*) into v_confirmados from public.confirmacoes c
    where c.evento_id = p_evento_id and c.status = 'confirmado';

  while v_confirmados < v_max loop
    select * into v_next from public.confirmacoes c
      where c.evento_id = p_evento_id and c.status = 'espera'
      order by c.ordem_fila asc
      limit 1;

    exit when v_next is null;

    update public.confirmacoes
      set status = 'confirmado', ordem_fila = null
      where id = v_next.id;

    v_confirmados := v_confirmados + 1;
  end loop;
end;
$$;

create or replace function public.confirm_presence(p_evento_id uuid)
returns public.confirmacoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pelada_id uuid;
  v_tipo text;
  v_max integer;
  v_prioridade_ate timestamp with time zone;
  v_confirmados integer;
  v_status text;
  v_ordem integer;
  v_confirmacao public.confirmacoes%rowtype;
begin
  select e.pelada_id, e.prioridade_ate
    into v_pelada_id, v_prioridade_ate
    from public.eventos e
    where e.id = p_evento_id and e.status = 'aberto';

  if v_pelada_id is null then
    raise exception 'Evento nao encontrado ou fechado.';
  end if;

  select pu.tipo into v_tipo
    from public.pelada_users pu
    where pu.pelada_id = v_pelada_id
      and pu.user_id = v_user_id
      and pu.ativo = true;

  if v_tipo is null then
    raise exception 'Usuario nao vinculado a pelada.';
  end if;

  select p.max_players into v_max from public.peladas p where p.id = v_pelada_id;

  select count(*) into v_confirmados
    from public.confirmacoes c
    where c.evento_id = p_evento_id and c.status = 'confirmado';

  if v_tipo = 'mensalista' then
    if v_confirmados < v_max then
      v_status := 'confirmado';
    else
      v_status := 'espera';
    end if;
  else
    if (v_prioridade_ate is null or now() > v_prioridade_ate) and v_confirmados < v_max then
      v_status := 'confirmado';
    else
      v_status := 'espera';
    end if;
  end if;

  if v_status = 'espera' then
    select coalesce(max(ordem_fila), 0) + 1 into v_ordem
      from public.confirmacoes
      where evento_id = p_evento_id and status = 'espera';
  else
    v_ordem := null;
  end if;

  insert into public.confirmacoes (evento_id, user_id, status, ordem_fila)
  values (p_evento_id, v_user_id, v_status, v_ordem)
  on conflict (evento_id, user_id) do update
    set status = excluded.status,
        ordem_fila = excluded.ordem_fila;

  select * into v_confirmacao
    from public.confirmacoes
    where evento_id = p_evento_id and user_id = v_user_id;

  return v_confirmacao;
end;
$$;

create or replace function public.admin_force_status(
  p_evento_id uuid,
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pelada_id uuid;
  v_admin_id uuid;
  v_ordem integer;
begin
  if p_status not in ('confirmado', 'espera', 'fora') then
    raise exception 'Status invalido.';
  end if;

  select e.pelada_id into v_pelada_id from public.eventos e where e.id = p_evento_id;
  if v_pelada_id is null then
    raise exception 'Evento nao encontrado.';
  end if;

  select p.admin_id into v_admin_id from public.peladas p where p.id = v_pelada_id;
  if v_admin_id <> auth.uid() then
    raise exception 'Somente admin pode alterar.';
  end if;

  if p_status = 'espera' then
    select coalesce(max(ordem_fila), 0) + 1 into v_ordem
      from public.confirmacoes
      where evento_id = p_evento_id and status = 'espera';
  else
    v_ordem := null;
  end if;

  insert into public.confirmacoes (evento_id, user_id, status, ordem_fila)
  values (p_evento_id, p_user_id, p_status, v_ordem)
  on conflict (evento_id, user_id) do update
    set status = excluded.status,
        ordem_fila = excluded.ordem_fila;

  if p_status = 'fora' then
    perform public.promote_waitlist(p_evento_id);
  end if;
end;
$$;

create or replace function public.on_confirmacao_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'fora') then
    perform public.promote_waitlist(new.evento_id);
  elsif (tg_op = 'DELETE') then
    perform public.promote_waitlist(old.evento_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace trigger confirmacao_status_change
after update on public.confirmacoes
for each row
execute function public.on_confirmacao_change();

create or replace trigger confirmacao_delete
after delete on public.confirmacoes
for each row
execute function public.on_confirmacao_change();

alter table public.users enable row level security;
alter table public.peladas enable row level security;
alter table public.pelada_users enable row level security;
alter table public.eventos enable row level security;
alter table public.confirmacoes enable row level security;

create policy "Users can view self" on public.users
for select using (id = auth.uid());

create policy "Users can view pelada members" on public.users
for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.pelada_users pu_self
    join public.pelada_users pu_other on pu_other.pelada_id = pu_self.pelada_id
    where pu_self.user_id = auth.uid()
      and pu_other.user_id = users.id
      and pu_self.ativo = true
      and pu_other.ativo = true
  )
);

create policy "Users can update self" on public.users
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Peladas select for members" on public.peladas
for select using (
  admin_id = auth.uid()
  or id in (
    select pelada_id from public.pelada_users
    where user_id = auth.uid() and ativo = true
  )
);

create policy "Peladas insert by owner" on public.peladas
for insert with check (admin_id = auth.uid());

create policy "Peladas update by owner" on public.peladas
for update using (admin_id = auth.uid()) with check (admin_id = auth.uid());

create policy "Peladas delete by owner" on public.peladas
for delete using (admin_id = auth.uid());

create policy "Pelada users select" on public.pelada_users
for select using (
  user_id = auth.uid()
  or public.is_pelada_admin(pelada_id)
);

create policy "Pelada users insert self" on public.pelada_users
for insert with check (user_id = auth.uid());

create policy "Pelada users update by admin" on public.pelada_users
for update using (
  public.is_pelada_admin(pelada_id)
) with check (
  public.is_pelada_admin(pelada_id)
);

create policy "Eventos select" on public.eventos
for select using (
  pelada_id in (
    select pelada_id from public.pelada_users where user_id = auth.uid() and ativo = true
  )
  or public.is_pelada_admin(pelada_id)
);

create policy "Eventos insert by admin" on public.eventos
for insert with check (
  public.is_pelada_admin(pelada_id)
);

create policy "Eventos update by admin" on public.eventos
for update using (
  public.is_pelada_admin(pelada_id)
) with check (
  public.is_pelada_admin(pelada_id)
);

create policy "Confirmacoes select" on public.confirmacoes
for select using (
  user_id = auth.uid()
  or evento_id in (
    select e.id from public.eventos e
      join public.peladas p on p.id = e.pelada_id
      where p.admin_id = auth.uid()
  )
  or evento_id in (
    select e.id from public.eventos e
      join public.pelada_users pu on pu.pelada_id = e.pelada_id
      where pu.user_id = auth.uid() and pu.ativo = true
  )
);

create policy "Confirmacoes insert self" on public.confirmacoes
for insert with check (
  user_id = auth.uid()
  and evento_id in (
    select e.id from public.eventos e
      join public.pelada_users pu on pu.pelada_id = e.pelada_id
      where pu.user_id = auth.uid() and pu.ativo = true
  )
);

create policy "Confirmacoes update self to fora" on public.confirmacoes
for update using (user_id = auth.uid())
with check (user_id = auth.uid() and status = 'fora');

create policy "Confirmacoes update by admin" on public.confirmacoes
for update using (
  evento_id in (
    select e.id from public.eventos e
      where public.is_pelada_admin(e.pelada_id)
  )
) with check (
  evento_id in (
    select e.id from public.eventos e
      where public.is_pelada_admin(e.pelada_id)
  )
);

grant execute on function public.confirm_presence(uuid) to authenticated;
grant execute on function public.admin_force_status(uuid, uuid, text) to authenticated;
