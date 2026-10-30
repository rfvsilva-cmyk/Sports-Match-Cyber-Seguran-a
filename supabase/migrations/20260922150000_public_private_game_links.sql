-- Public games remain the default. Private games are discoverable only with a
-- non-enumerable invitation token.
alter table public.partida
  add column if not exists visibilidade text not null default 'PUBLICA',
  add column if not exists convite_token text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partida_visibilidade_valida') then
    alter table public.partida add constraint partida_visibilidade_valida
      check (visibilidade in ('PUBLICA', 'PRIVADA_LINK'));
  end if;
end $$;

create unique index if not exists partida_convite_token_uidx
  on public.partida (convite_token)
  where convite_token is not null;
