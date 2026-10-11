-- MemoryShift pilot schema
-- A parent signs up (Supabase Auth), gives consent, and adds one or more learners.
-- Only memory-check results are stored. No diagnosis, no study material text,
-- no learner surnames. Each parent can only ever see their own family's rows.

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now()
);

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  age_band text not null check (age_band in ('under-9', '9-11', '12-14', '15-17', '18+')),
  pilot_mode boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recall_checks (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners (id) on delete cascade,
  set_id text not null,
  subject text not null,
  arm text not null check (arm in ('aids', 'plain')),
  formats text[] not null default '{}',
  questions jsonb not null,
  created_at timestamptz not null default now(),
  unique (learner_id, set_id)
);

create table public.recall_attempts (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.recall_checks (id) on delete cascade,
  stage text not null check (stage in ('before', 'now', 'nextDay')),
  answers int[] not null,
  correct int not null,
  total int not null,
  at timestamptz not null default now(),
  unique (check_id, stage)
);

alter table public.consents enable row level security;
alter table public.learners enable row level security;
alter table public.recall_checks enable row level security;
alter table public.recall_attempts enable row level security;

create policy "own consents" on public.consents
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

create policy "own learners" on public.learners
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

create policy "own checks" on public.recall_checks
  for all using (
    exists (select 1 from public.learners l where l.id = learner_id and l.parent_id = auth.uid())
  ) with check (
    exists (select 1 from public.learners l where l.id = learner_id and l.parent_id = auth.uid())
  );

create policy "own attempts" on public.recall_attempts
  for all using (
    exists (
      select 1 from public.recall_checks c
      join public.learners l on l.id = c.learner_id
      where c.id = check_id and l.parent_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.recall_checks c
      join public.learners l on l.id = c.learner_id
      where c.id = check_id and l.parent_id = auth.uid()
    )
  );

-- Pilot results for the Solve application: one row per topic with before, now and next-day scores.
-- Not exposed to the app; read only by the project owner through the database console.
create view public.pilot_results with (security_invoker = true) as
select
  l.id as learner_id,
  l.age_band,
  c.subject,
  c.arm,
  c.created_at,
  max(case when a.stage = 'before' then round(100.0 * a.correct / nullif(a.total, 0)) end) as before_pct,
  max(case when a.stage = 'now' then round(100.0 * a.correct / nullif(a.total, 0)) end) as now_pct,
  max(case when a.stage = 'nextDay' then round(100.0 * a.correct / nullif(a.total, 0)) end) as next_day_pct
from public.recall_checks c
join public.learners l on l.id = c.learner_id
left join public.recall_attempts a on a.check_id = c.id
group by l.id, l.age_band, c.subject, c.arm, c.created_at;
