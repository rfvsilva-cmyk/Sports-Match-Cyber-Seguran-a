-- Sports Match: migration from prototype-oriented data to the public match MVP.
-- Apply only after a Supabase backup. This migration is designed for the existing
-- usuarios, jogador, like, match, conversa, mensagem, partida and avaliacao tables.

begin;

alter table public.jogador add column if not exists cidade text;
alter table public.jogador add column if not exists bairro text;

alter table public.partida add column if not exists cidade text;
alter table public.partida add column if not exists bairro text;
alter table public.partida add column if not exists descricao text;
alter table public.partida add column if not exists capacidade integer not null default 2;

update public.partida set status = 'ABERTA' where status = 'AGENDADA';
update public.partida set capacidade = 2 where capacidade is null or capacidade < 2;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partida_capacidade_valida') then
    alter table public.partida add constraint partida_capacidade_valida check (capacidade between 2 and 100);
  end if;
end $$;

create table if not exists public.partida_participante (
  partida_id uuid not null references public.partida(id) on delete cascade,
  jogador_id uuid not null references public.jogador(id) on delete cascade,
  data_entrada timestamptz not null default now(),
  primary key (partida_id, jogador_id)
);

create index if not exists partida_participante_jogador_idx on public.partida_participante (jogador_id, data_entrada desc);
create index if not exists partida_publica_busca_idx on public.partida (status, cidade, bairro, modalidade, data_hora);

insert into public.partida_participante (partida_id, jogador_id)
select id, criador_id from public.partida where criador_id is not null
on conflict do nothing;

create unique index if not exists match_par_unico_idx
  on public.match (least(id_jogador1, id_jogador2), greatest(id_jogador1, id_jogador2));
create unique index if not exists conversa_match_unica_idx on public.conversa (match_id);
create unique index if not exists avaliacao_participante_unica_idx
  on public.avaliacao (partida_id, avaliador_id, avaliado_id);

create or replace function public.entrar_na_partida(p_partida_id uuid, p_jogador_id uuid)
returns table(partida_id uuid, status text, ocupacao integer, capacidade integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  partida_atual public.partida%rowtype;
  total_atual integer;
begin
  select * into partida_atual from public.partida where id = p_partida_id for update;
  if not found then raise exception 'partida não encontrada'; end if;
  if partida_atual.status not in ('ABERTA', 'LOTADA') then raise exception 'partida encerrada'; end if;

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
    update public.partida set status = 'LOTADA', data_atualizacao = now() where id = p_partida_id;
    partida_atual.status := 'LOTADA';
  end if;
  return query select partida_atual.id, partida_atual.status::text, total_atual, partida_atual.capacidade;
end;
$$;

create or replace function public.sair_da_partida(p_partida_id uuid, p_jogador_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare partida_atual public.partida%rowtype;
begin
  select * into partida_atual from public.partida where id = p_partida_id for update;
  if not found then raise exception 'partida não encontrada'; end if;
  if partida_atual.criador_id = p_jogador_id then raise exception 'organizador não pode sair'; end if;
  if partida_atual.status not in ('ABERTA', 'LOTADA') then raise exception 'partida encerrada'; end if;
  delete from public.partida_participante where partida_id = p_partida_id and jogador_id = p_jogador_id;
  update public.partida set status = 'ABERTA', data_atualizacao = now()
    where id = p_partida_id and status = 'LOTADA';
end;
$$;

revoke all on function public.entrar_na_partida(uuid, uuid) from public;
revoke all on function public.sair_da_partida(uuid, uuid) from public;
grant execute on function public.entrar_na_partida(uuid, uuid) to service_role;
grant execute on function public.sair_da_partida(uuid, uuid) to service_role;

-- Browser Realtime clients receive only messages from conversations they own.
alter table public.mensagem enable row level security;
drop policy if exists mensagem_participante_leitura on public.mensagem;
create policy mensagem_participante_leitura on public.mensagem
  for select to authenticated
  using (
    exists (
      select 1 from public.conversa c
      join public.match m on m.id = c.match_id
      join public.jogador j on j.usuario_id::text = auth.uid()::text
      where c.id = mensagem.conversa_id
        and (m.id_jogador1 = j.id or m.id_jogador2 = j.id)
    )
  );

commit;
