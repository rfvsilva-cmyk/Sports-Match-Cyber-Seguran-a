-- Evolves the legacy remote snapshot to the schema required by the API.
-- Apply this migration to production before deploying the matching application code.

alter type public."StatusPartida" add value if not exists 'ABERTA';
alter type public."StatusPartida" add value if not exists 'LOTADA';

alter table public.jogador
  add column if not exists cidade text,
  add column if not exists bairro text;

alter table public."like"
  alter column id set default (gen_random_uuid())::text;

alter table public.match
  alter column id set default (gen_random_uuid())::text;

alter table public.conversa
  alter column id set default (gen_random_uuid())::text;

alter table public.mensagem
  alter column id set default (gen_random_uuid())::text;

alter table public.partida
  alter column id set default (gen_random_uuid())::text,
  alter column conversa_id drop not null,
  alter column oponente_id drop not null,
  alter column data_atualizacao set default current_timestamp,
  add column if not exists cidade text,
  add column if not exists bairro text,
  add column if not exists descricao text,
  add column if not exists capacidade integer not null default 2;

alter table public.avaliacao
  alter column id set default (gen_random_uuid())::text;

update public.partida
set capacidade = 2
where capacidade is null or capacidade < 2;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partida_capacidade_valida') then
    alter table public.partida
      add constraint partida_capacidade_valida check (capacidade between 2 and 100);
  end if;
end $$;

create table if not exists public.partida_participante (
  partida_id text not null references public.partida(id) on delete cascade,
  jogador_id text not null references public.jogador(id) on delete cascade,
  data_entrada timestamp(3) without time zone not null default current_timestamp,
  primary key (partida_id, jogador_id)
);

create index if not exists partida_participante_jogador_idx
  on public.partida_participante (jogador_id, data_entrada desc);

create index if not exists partida_publica_busca_idx
  on public.partida (status, cidade, bairro, modalidade, data_hora);

-- The API accesses Supabase with the server service role. Keep direct-table RLS
-- disabled, matching the existing production access model.
alter table public.usuarios disable row level security;
alter table public.jogador disable row level security;
alter table public."like" disable row level security;
alter table public.match disable row level security;
alter table public.conversa disable row level security;
alter table public.mensagem disable row level security;
alter table public.partida disable row level security;
alter table public.avaliacao disable row level security;
alter table public.partida_participante disable row level security;

insert into public.partida_participante (partida_id, jogador_id)
select id, criador_id
from public.partida
where criador_id is not null
on conflict do nothing;

create or replace function public.entrar_na_partida(p_partida_id text, p_jogador_id text)
returns table(partida_id text, status text, ocupacao integer, capacidade integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  partida_atual public.partida%rowtype;
  total_atual integer;
begin
  select * into partida_atual from public.partida where id = p_partida_id for update;
  if not found then raise exception 'partida nao encontrada'; end if;
  if partida_atual.status not in ('AGENDADA', 'ABERTA', 'LOTADA') then raise exception 'partida encerrada'; end if;

  if exists (
    select 1 from public.partida_participante
    where partida_id = p_partida_id and jogador_id = p_jogador_id
  ) then
    select count(*) into total_atual from public.partida_participante where partida_id = p_partida_id;
    return query select partida_atual.id, partida_atual.status::text, total_atual, partida_atual.capacidade;
    return;
  end if;

  select count(*) into total_atual from public.partida_participante where partida_id = p_partida_id;
  if total_atual >= partida_atual.capacidade then raise exception 'partida lotada'; end if;

  insert into public.partida_participante (partida_id, jogador_id) values (p_partida_id, p_jogador_id);
  total_atual := total_atual + 1;
  if total_atual >= partida_atual.capacidade then
    update public.partida set status = 'LOTADA', data_atualizacao = current_timestamp where id = p_partida_id;
    partida_atual.status := 'LOTADA';
  end if;
  return query select partida_atual.id, partida_atual.status::text, total_atual, partida_atual.capacidade;
end;
$$;

create or replace function public.sair_da_partida(p_partida_id text, p_jogador_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  partida_atual public.partida%rowtype;
begin
  select * into partida_atual from public.partida where id = p_partida_id for update;
  if not found then raise exception 'partida nao encontrada'; end if;
  if partida_atual.criador_id = p_jogador_id then raise exception 'organizador nao pode sair'; end if;
  if partida_atual.status not in ('AGENDADA', 'ABERTA', 'LOTADA') then raise exception 'partida encerrada'; end if;
  delete from public.partida_participante where partida_id = p_partida_id and jogador_id = p_jogador_id;
  update public.partida set status = 'ABERTA', data_atualizacao = current_timestamp
    where id = p_partida_id and status in ('AGENDADA', 'LOTADA');
end;
$$;

revoke all on function public.entrar_na_partida(text, text) from public;
revoke all on function public.sair_da_partida(text, text) from public;
grant execute on function public.entrar_na_partida(text, text) to service_role;
grant execute on function public.sair_da_partida(text, text) to service_role;
