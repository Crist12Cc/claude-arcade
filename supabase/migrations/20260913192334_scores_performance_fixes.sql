create index scores_game_id_idx on public.scores(game_id);
create index scores_user_id_idx on public.scores(user_id);

drop policy "scores_insert_own" on public.scores;
create policy "scores_insert_own" on public.scores for insert with check ((select auth.uid()) = user_id);
