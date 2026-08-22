alter table content_ideas
  add column if not exists virality_score smallint;

alter table content_ideas
  drop constraint if exists content_ideas_virality_score_check;

alter table content_ideas
  add constraint content_ideas_virality_score_check
  check (virality_score is null or (virality_score >= 1 and virality_score <= 10));
