create table if not exists leads (
  id              serial primary key,
  created_at      timestamptz not null default now(),
  name            text not null,
  contact         text,
  source          text not null check (source in ('bot', 'manual')),
  tg_user_id      bigint,
  niche           text,
  budget          text,
  wants           text,
  verdict         text check (verdict in ('подходит', 'не подходит', 'уточнить')),
  reason          text,
  questions_asked int not null default 0,
  awaiting        text
);

-- один человек = одна заявка в своём источнике
create unique index if not exists leads_tg_user on leads (source, tg_user_id) where tg_user_id is not null;

create table if not exists messages (
  id         serial primary key,
  lead_id    int not null references leads (id) on delete cascade,
  author     text not null check (author in ('client', 'bot')),
  text       text not null,
  created_at timestamptz not null default now()
);

create table if not exists tags (
  id   serial primary key,
  name text not null unique
);

-- auto = тег поставлен ИИ (ниша/оценка), пересчитывается при новой оценке
create table if not exists lead_tags (
  lead_id int not null references leads (id) on delete cascade,
  tag_id  int not null references tags (id) on delete cascade,
  auto    boolean not null default false,
  primary key (lead_id, tag_id)
);

-- защита от повторной доставки одного апдейта Telegram
create table if not exists tg_updates (
  update_id  bigint primary key,
  created_at timestamptz not null default now()
);
