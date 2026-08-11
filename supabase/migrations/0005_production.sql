-- ============================================================
-- MIGRATION 0005: Production Calendar + Assignment System
-- - production_schedules: weekly R/P schedule per client
-- - production_tasks: auto-generated + manual production tasks
-- ============================================================

-- ============================================================
-- PRODUCTION SCHEDULES TABLE
-- Stores recurring weekly posting schedule per client
-- day_of_week: 1=Monday ... 7=Sunday (ISO week day)
-- content_type: R=Reel/Video, P=Post/Static graphic
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production_schedules (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day_of_week           integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  content_type          text NOT NULL CHECK (content_type IN ('R', 'P')),
  assigned_editor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_designer_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, day_of_week, content_type)
);

-- ============================================================
-- PRODUCTION TASKS TABLE
-- Auto-generated per week or created manually
-- ============================================================
CREATE TABLE IF NOT EXISTS public.production_tasks (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  schedule_id       uuid REFERENCES public.production_schedules(id) ON DELETE SET NULL,
  content_type      text NOT NULL CHECK (content_type IN ('R', 'P')),
  publish_date      date NOT NULL,
  deadline          timestamptz,
  assigned_to_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'pendiente'
                      CHECK (status IN ('pendiente', 'en_edicion', 'en_revision', 'revisiones', 'aprobado', 'publicado')),
  notes             text,
  review_notes      text,
  is_special_request boolean NOT NULL DEFAULT false,
  priority          text NOT NULL DEFAULT 'media'
                      CHECK (priority IN ('alta', 'media', 'baja')),
  week_start        date,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_production_schedules_client ON public.production_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_client ON public.production_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_assigned ON public.production_tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_publish_date ON public.production_tasks(publish_date);
CREATE INDEX IF NOT EXISTS idx_production_tasks_status ON public.production_tasks(status);
CREATE INDEX IF NOT EXISTS idx_production_tasks_week ON public.production_tasks(week_start);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_production_schedules_updated_at ON public.production_schedules;
CREATE TRIGGER set_production_schedules_updated_at
  BEFORE UPDATE ON public.production_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_production_tasks_updated_at ON public.production_tasks;
CREATE TRIGGER set_production_tasks_updated_at
  BEFORE UPDATE ON public.production_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.production_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "production_schedules_select" ON public.production_schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_tasks_select" ON public.production_tasks
  FOR SELECT TO authenticated USING (true);

-- All authenticated users can insert/update/delete (team dashboard, all members can manage)
CREATE POLICY "production_schedules_insert" ON public.production_schedules
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "production_schedules_update" ON public.production_schedules
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "production_schedules_delete" ON public.production_schedules
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "production_tasks_insert" ON public.production_tasks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "production_tasks_update" ON public.production_tasks
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "production_tasks_delete" ON public.production_tasks
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SEED: Pre-load client production schedules
-- Only inserts schedules for clients that already exist in the
-- clients table (matched by name, case-insensitive).
-- Re-run safe (ON CONFLICT DO NOTHING).
-- ============================================================

-- Seed de horarios por nombre de cliente. Una sola sentencia: el bloque
-- anterior declaraba un PROCEDURE dentro de un DO $$ ... $$ con el MISMO tag de
-- dollar-quoting, que es SQL invalido — la migracion reventaba y ningun entorno
-- nuevo podia levantarse desde cero. Mismos datos, sentencia valida.
insert into public.production_schedules (client_id, day_of_week, content_type)
select c.id, s.day_of_week, s.content_type
from (values
    ('612 Cigar Lounge', 2, 'R'),
    ('612 Cigar Lounge', 4, 'R'),
    ('612 Cigar Lounge', 6, 'R'),
    ('Casita Vieja', 1, 'R'),
    ('Casita Vieja', 2, 'P'),
    ('Casita Vieja', 3, 'R'),
    ('Casita Vieja', 4, 'P'),
    ('Casita Vieja', 5, 'R'),
    ('Kseros', 1, 'R'),
    ('Kseros', 2, 'P'),
    ('Kseros', 3, 'R'),
    ('Kseros', 4, 'P'),
    ('Kseros', 5, 'R'),
    ('Kseros', 6, 'P'),
    ('Mondays', 1, 'R'),
    ('Mondays', 2, 'P'),
    ('Mondays', 3, 'R'),
    ('Mondays', 4, 'R'),
    ('Mondays', 5, 'R'),
    ('Mondays', 6, 'R'),
    ('El Cuarto Bate', 1, 'R'),
    ('El Cuarto Bate', 2, 'P'),
    ('El Cuarto Bate', 3, 'R'),
    ('El Cuarto Bate', 4, 'P'),
    ('El Cuarto Bate', 5, 'R'),
    ('La Guarapera', 2, 'R'),
    ('La Guarapera', 4, 'R'),
    ('La Guarapera', 7, 'R'),
    ('Familia Pelaez', 1, 'R'),
    ('Familia Pelaez', 4, 'R'),
    ('Familia Pelaez', 6, 'R'),
    ('La Rotonda', 2, 'R'),
    ('La Rotonda', 3, 'P'),
    ('La Rotonda', 4, 'R'),
    ('La Rotonda', 5, 'P'),
    ('La Rotonda', 6, 'R'),
    ('El Capi', 2, 'R'),
    ('El Capi', 4, 'R'),
    ('El Capi', 6, 'R'),
    ('Restauco', 1, 'R'),
    ('Restauco', 2, 'R'),
    ('Restauco', 4, 'R'),
    ('Restauco', 5, 'R'),
    ('La Güira', 1, 'R'),
    ('La Güira', 3, 'R'),
    ('La Güira', 5, 'R'),
    ('Arasibo Steakhouse', 2, 'R'),
    ('Arasibo Steakhouse', 4, 'R'),
    ('Arasibo Steakhouse', 6, 'R'),
    ('Dorta''s Pizza', 2, 'R'),
    ('Dorta''s Pizza', 5, 'R'),
    ('Dorta''s Pizza', 6, 'P'),
    ('La Mia Pizzeria', 1, 'R'),
    ('La Mia Pizzeria', 2, 'P'),
    ('La Mia Pizzeria', 3, 'R'),
    ('La Mia Pizzeria', 4, 'P'),
    ('La Mia Pizzeria', 5, 'R'),
    ('Nana''s', 1, 'P'),
    ('Nana''s', 3, 'R'),
    ('Nana''s', 6, 'R'),
    ('Tierra Nueva', 4, 'R'),
    ('Buena Vida', 1, 'R'),
    ('Buena Vida', 3, 'R'),
    ('Buena Vida', 5, 'R'),
    ('RP Sport', 1, 'R'),
    ('RP Sport', 3, 'R'),
    ('RP Sport', 5, 'R'),
    ('Dabel', 2, 'R'),
    ('Dabel', 4, 'P'),
    ('Shooters', 2, 'R'),
    ('Shooters', 4, 'R'),
    ('Centro Inspección', 3, 'R'),
    ('Centro Inspección', 5, 'R'),
    ('Truco', 1, 'R'),
    ('Truco', 3, 'R'),
    ('Truco', 5, 'R'),
    ('Geovanni', 2, 'R'),
    ('Geovanni', 3, 'R'),
    ('Geovanni', 5, 'R'),
    ('Dr. Rodriguez', 1, 'R'),
    ('Dr. Rodriguez', 3, 'P'),
    ('Dr. Rodriguez', 5, 'R'),
    ('Pro Familia', 1, 'R'),
    ('Pro Familia', 2, 'P'),
    ('Pro Familia', 3, 'R'),
    ('Pro Familia', 4, 'P'),
    ('Pro Familia', 5, 'R'),
    ('VSS Properties', 2, 'R'),
    ('VSS Properties', 6, 'R'),
    ('Lumavi', 1, 'R'),
    ('Lumavi', 2, 'R'),
    ('Lumavi', 3, 'R'),
    ('Lumavi', 4, 'R'),
    ('Lumavi', 5, 'R'),
    ('Beyond PVC', 2, 'R'),
    ('Beyond PVC', 3, 'P'),
    ('Beyond PVC', 5, 'R'),
    ('Cerrajero', 2, 'R'),
    ('Cerrajero', 4, 'R'),
    ('Cerrajero', 6, 'R'),
    ('David Bonilla Seguros', 2, 'R'),
    ('David Bonilla Seguros', 3, 'P'),
    ('David Bonilla Seguros', 4, 'R'),
    ('David Bonilla Windmar', 1, 'R'),
    ('David Bonilla Windmar', 3, 'R'),
    ('David Bonilla Windmar', 5, 'R'),
    ('Quantika', 2, 'R'),
    ('Quantika', 4, 'P'),
    ('Quantika', 6, 'R'),
    ('Codepola', 1, 'R'),
    ('Codepola', 3, 'R'),
    ('Codepola', 5, 'R'),
    ('Tito Rios', 1, 'R'),
    ('Tito Rios', 3, 'R'),
    ('Tito Rios', 4, 'R'),
    ('Arte Digital', 1, 'P'),
    ('Arte Digital', 2, 'R'),
    ('Arte Digital', 3, 'P'),
    ('Arte Digital', 4, 'R'),
    ('Arte Digital', 5, 'P'),
    ('Arte Digital', 6, 'R'),
    ('Lucky Pet', 1, 'R'),
    ('Lucky Pet', 2, 'P'),
    ('Lucky Pet', 3, 'R'),
    ('Lucky Pet', 4, 'P'),
    ('Lucky Pet', 5, 'R'),
    ('Sanguit', 2, 'R'),
    ('Sanguit', 4, 'R'),
    ('Sanguit', 6, 'P')
) as s(client_name, day_of_week, content_type)
join public.clients c on lower(c.name) = lower(s.client_name)
on conflict (client_id, day_of_week, content_type) do nothing;
