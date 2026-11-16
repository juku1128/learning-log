-- ============================================================================
-- W11 我的學習紀錄 ＆ 高級版班級求援投票系統：資料表＋門禁（RLS）
-- 用法：到 Supabase 左側 SQL Editor → 整份貼上 → 按右上角 Run。
-- （可重複執行：已經有的資料表會保留，舊規則會先清除再重建）
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 第一部分：個人私密學習紀錄表（learning_logs）
-- ----------------------------------------------------------------------------

-- 1. 建立 learning_logs 資料表：一列＝一筆學習紀錄，user_id 自動填入目前登入者
create table if not exists public.learning_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null default current_date,
  topic      text not null check (char_length(topic) between 1 and 200),
  minutes    integer check (minutes between 0 and 1440),
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

-- 2. 打開 learning_logs 的資料列門禁（RLS）
alter table public.learning_logs enable row level security;

-- 3. 先清除 learning_logs 上可能存在的舊規則，避免舊規則太寬鬆
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'learning_logs' loop
    execute format('drop policy %I on public.learning_logs', p.policyname);
  end loop;
end $$;

-- 4. 建立四條門禁規則（Policy）：每條都用 auth.uid() 比對 user_id，確保只有本人能讀寫改刪
create policy "本人可以看自己的紀錄" on public.learning_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "本人只能新增自己的紀錄" on public.learning_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "本人只能修改自己的紀錄" on public.learning_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "本人只能刪自己的紀錄" on public.learning_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. 設定資料表讀寫權限：只開放給已登入的使用者（authenticated），未登入訪客（anon）全撤銷
grant select, insert, update, delete on table public.learning_logs to authenticated;
revoke all on table public.learning_logs from anon;


-- ----------------------------------------------------------------------------
-- 第二部分：高級版班級即時求援投票表（student_votes）
-- ----------------------------------------------------------------------------

-- 1. 建立 student_votes 資料表：記錄每位登入同學在各場次投給哪個求援關卡與附註
create table if not exists public.student_votes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  round_id     text not null check (char_length(round_id) between 1 and 50),
  option_id    text not null check (char_length(option_id) between 1 and 80),
  option_label text not null check (char_length(option_label) between 1 and 200),
  comment      text check (char_length(comment) <= 500),
  created_at   timestamptz not null default now(),
  unique (user_id, round_id)
);

-- 2. 打開 student_votes 的資料列門禁（RLS）
alter table public.student_votes enable row level security;

-- 3. 先清除 student_votes 舊規則
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'student_votes' loop
    execute format('drop policy %I on public.student_votes', p.policyname);
  end loop;
end $$;

-- 4. 建立四條門禁規則（Policy）：同樣每條都嚴格拿 auth.uid() 比對 user_id（保護個人投票隱私）
create policy "本人可以看自己的選票" on public.student_votes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "本人只能投自己的選票" on public.student_votes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "本人只能改投自己的選票" on public.student_votes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "本人只能撤回自己的選票" on public.student_votes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. 設定 student_votes 讀寫權限：只開放給已登入使用者（authenticated）
grant select, insert, update, delete on table public.student_votes to authenticated;
revoke all on table public.student_votes from anon;

-- 6. 匿名統計函式：只回傳「各選項總得票數」與「不具名求援留言」，絕不洩漏是誰投的（保護隱私同時支援全班看板）
create or replace function public.get_round_vote_summary(p_round_id text)
returns table (
  option_id text,
  option_label text,
  vote_count bigint,
  recent_comments text[]
)
language sql
security definer
set search_path = public
as $$
  select
    v.option_id,
    max(v.option_label) as option_label,
    count(*)::bigint as vote_count,
     coalesce(
      array_agg(v.comment order by v.created_at desc)
      filter (where v.comment is not null and btrim(v.comment) <> ''),
      array[]::text[]
    ) as recent_comments
  from public.student_votes v
  where v.round_id = p_round_id
  group by v.option_id;
$$;

grant execute on function public.get_round_vote_summary(text) to authenticated;
revoke all on function public.get_round_vote_summary(text) from anon;
