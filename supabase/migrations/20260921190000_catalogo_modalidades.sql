create table if not exists public.modalidade (
  id text primary key default (gen_random_uuid())::text,
  slug text not null unique,
  nome text not null unique,
  ativa boolean not null default true,
  data_criacao timestamp(3) without time zone not null default current_timestamp
);

insert into public.modalidade (slug, nome) values
  ('futebol', 'Futebol'), ('futsal', 'Futsal'), ('volei', 'Vôlei'), ('basquete', 'Basquete'),
  ('tenis', 'Tênis'), ('beach-tennis', 'Beach Tennis'), ('padel', 'Padel'), ('handebol', 'Handebol'),
  ('corrida', 'Corrida'), ('ciclismo', 'Ciclismo'), ('natacao', 'Natação'), ('musculacao', 'Musculação')
on conflict (slug) do update set nome = excluded.nome, ativa = true;

alter table public.jogador add column if not exists modalidade_id text references public.modalidade(id);
update public.jogador j set modalidade_id = m.id, esporte_individual = m.nome
from public.modalidade m
where translate(lower(trim(coalesce(j.esporte_individual, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = m.slug;
create index if not exists jogador_modalidade_local_idx on public.jogador (modalidade_id, cidade, bairro) where perfil_completo = true;

create table if not exists public.solicitacao_modalidade (
  id text primary key default (gen_random_uuid())::text,
  jogador_id text not null references public.jogador(id) on delete cascade,
  nome_sugerido text not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'APROVADA', 'RECUSADA')),
  data_criacao timestamp(3) without time zone not null default current_timestamp
);
create unique index if not exists solicitacao_modalidade_pendente_unica on public.solicitacao_modalidade (jogador_id, lower(nome_sugerido)) where status = 'PENDENTE';
alter table public.modalidade disable row level security;
alter table public.solicitacao_modalidade disable row level security;
