-- 0043_scene_check.sql
-- Reporte de la revisión AI de subtítulos (Grok visión) por video subido.
-- Shape del jsonb: ver SceneCheckReport en lib/llm/scene-check-types.ts.
alter table content_idea_videos add column if not exists scene_check jsonb;
