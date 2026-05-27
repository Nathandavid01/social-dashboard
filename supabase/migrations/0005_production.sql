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

-- Helper: insert schedule row by client name
DO $$
DECLARE
  cid uuid;

  PROCEDURE add_schedule(p_name text, p_day int, p_type text) AS $$
  BEGIN
    SELECT id INTO cid FROM public.clients WHERE lower(name) = lower(p_name) LIMIT 1;
    IF cid IS NOT NULL THEN
      INSERT INTO public.production_schedules (client_id, day_of_week, content_type)
      VALUES (cid, p_day, p_type)
      ON CONFLICT (client_id, day_of_week, content_type) DO NOTHING;
    END IF;
  END;

BEGIN
  -- COMIDA
  -- 612 Cigar Lounge: Martes R, Jueves R, Sábado R
  CALL add_schedule('612 Cigar Lounge', 2, 'R');
  CALL add_schedule('612 Cigar Lounge', 4, 'R');
  CALL add_schedule('612 Cigar Lounge', 6, 'R');

  -- Casita Vieja: Lunes R, Martes P, Miércoles R, Jueves P, Viernes R
  CALL add_schedule('Casita Vieja', 1, 'R');
  CALL add_schedule('Casita Vieja', 2, 'P');
  CALL add_schedule('Casita Vieja', 3, 'R');
  CALL add_schedule('Casita Vieja', 4, 'P');
  CALL add_schedule('Casita Vieja', 5, 'R');

  -- Kseros: Lunes R, Martes P, Miércoles R, Jueves P, Viernes R, Sábado P
  CALL add_schedule('Kseros', 1, 'R');
  CALL add_schedule('Kseros', 2, 'P');
  CALL add_schedule('Kseros', 3, 'R');
  CALL add_schedule('Kseros', 4, 'P');
  CALL add_schedule('Kseros', 5, 'R');
  CALL add_schedule('Kseros', 6, 'P');

  -- Mondays: Lunes R, Martes P, Miércoles R, Jueves R, Viernes R, Sábado R
  CALL add_schedule('Mondays', 1, 'R');
  CALL add_schedule('Mondays', 2, 'P');
  CALL add_schedule('Mondays', 3, 'R');
  CALL add_schedule('Mondays', 4, 'R');
  CALL add_schedule('Mondays', 5, 'R');
  CALL add_schedule('Mondays', 6, 'R');

  -- El Cuarto Bate: Lunes R, Martes P, Miércoles R, Jueves P, Viernes R
  CALL add_schedule('El Cuarto Bate', 1, 'R');
  CALL add_schedule('El Cuarto Bate', 2, 'P');
  CALL add_schedule('El Cuarto Bate', 3, 'R');
  CALL add_schedule('El Cuarto Bate', 4, 'P');
  CALL add_schedule('El Cuarto Bate', 5, 'R');

  -- La Guarapera: Martes R, Jueves R, Domingo R
  CALL add_schedule('La Guarapera', 2, 'R');
  CALL add_schedule('La Guarapera', 4, 'R');
  CALL add_schedule('La Guarapera', 7, 'R');

  -- Familia Pelaez: Lunes R, Jueves R, Sábado R
  CALL add_schedule('Familia Pelaez', 1, 'R');
  CALL add_schedule('Familia Pelaez', 4, 'R');
  CALL add_schedule('Familia Pelaez', 6, 'R');

  -- La Rotonda: Martes R, Miércoles P, Jueves R, Viernes P, Sábado R
  CALL add_schedule('La Rotonda', 2, 'R');
  CALL add_schedule('La Rotonda', 3, 'P');
  CALL add_schedule('La Rotonda', 4, 'R');
  CALL add_schedule('La Rotonda', 5, 'P');
  CALL add_schedule('La Rotonda', 6, 'R');

  -- El Capi: Martes R, Jueves R, Sábado R
  CALL add_schedule('El Capi', 2, 'R');
  CALL add_schedule('El Capi', 4, 'R');
  CALL add_schedule('El Capi', 6, 'R');

  -- Restauco: Lunes R, Martes R, Jueves R, Viernes R
  CALL add_schedule('Restauco', 1, 'R');
  CALL add_schedule('Restauco', 2, 'R');
  CALL add_schedule('Restauco', 4, 'R');
  CALL add_schedule('Restauco', 5, 'R');

  -- La Güira: Lunes R, Miércoles R, Viernes R
  CALL add_schedule('La Güira', 1, 'R');
  CALL add_schedule('La Güira', 3, 'R');
  CALL add_schedule('La Güira', 5, 'R');

  -- Arasibo Steakhouse: Martes R, Jueves R, Sábado R
  CALL add_schedule('Arasibo Steakhouse', 2, 'R');
  CALL add_schedule('Arasibo Steakhouse', 4, 'R');
  CALL add_schedule('Arasibo Steakhouse', 6, 'R');

  -- Dorta's Pizza: Martes R, Viernes R, Sábado P
  CALL add_schedule('Dorta''s Pizza', 2, 'R');
  CALL add_schedule('Dorta''s Pizza', 5, 'R');
  CALL add_schedule('Dorta''s Pizza', 6, 'P');

  -- La Mia Pizzeria: Lunes R, Martes P, Miércoles R, Jueves P, Viernes R
  CALL add_schedule('La Mia Pizzeria', 1, 'R');
  CALL add_schedule('La Mia Pizzeria', 2, 'P');
  CALL add_schedule('La Mia Pizzeria', 3, 'R');
  CALL add_schedule('La Mia Pizzeria', 4, 'P');
  CALL add_schedule('La Mia Pizzeria', 5, 'R');

  -- Nana's: Lunes P, Miércoles R, Sábado R
  CALL add_schedule('Nana''s', 1, 'P');
  CALL add_schedule('Nana''s', 3, 'R');
  CALL add_schedule('Nana''s', 6, 'R');

  -- FARMACIA
  -- Tierra Nueva: Jueves R
  CALL add_schedule('Tierra Nueva', 4, 'R');

  -- Buena Vida: Lunes R, Miércoles R, Viernes R
  CALL add_schedule('Buena Vida', 1, 'R');
  CALL add_schedule('Buena Vida', 3, 'R');
  CALL add_schedule('Buena Vida', 5, 'R');

  -- DEPORTE
  -- RP Sport: Lunes R, Miércoles R, Viernes R
  CALL add_schedule('RP Sport', 1, 'R');
  CALL add_schedule('RP Sport', 3, 'R');
  CALL add_schedule('RP Sport', 5, 'R');

  -- Dabel: Martes R, Jueves P
  CALL add_schedule('Dabel', 2, 'R');
  CALL add_schedule('Dabel', 4, 'P');

  -- Shooters: Martes R, Jueves R
  CALL add_schedule('Shooters', 2, 'R');
  CALL add_schedule('Shooters', 4, 'R');

  -- AUTO
  -- Centro Inspección: Miércoles R, Viernes R
  CALL add_schedule('Centro Inspección', 3, 'R');
  CALL add_schedule('Centro Inspección', 5, 'R');

  -- PERSONAL
  -- Truco: Lunes R, Miércoles R, Viernes R
  CALL add_schedule('Truco', 1, 'R');
  CALL add_schedule('Truco', 3, 'R');
  CALL add_schedule('Truco', 5, 'R');

  -- Geovanni: Martes R, Miércoles R, Viernes R
  CALL add_schedule('Geovanni', 2, 'R');
  CALL add_schedule('Geovanni', 3, 'R');
  CALL add_schedule('Geovanni', 5, 'R');

  -- SALUD
  -- Dr. Rodriguez: Lunes R, Miércoles P, Viernes R
  CALL add_schedule('Dr. Rodriguez', 1, 'R');
  CALL add_schedule('Dr. Rodriguez', 3, 'P');
  CALL add_schedule('Dr. Rodriguez', 5, 'R');

  -- Pro Familia: Lunes R, Martes P, Miércoles R, Jueves P, Viernes R
  CALL add_schedule('Pro Familia', 1, 'R');
  CALL add_schedule('Pro Familia', 2, 'P');
  CALL add_schedule('Pro Familia', 3, 'R');
  CALL add_schedule('Pro Familia', 4, 'P');
  CALL add_schedule('Pro Familia', 5, 'R');

  -- BIENES RAICES
  -- VSS Properties: Martes R, Sábado R
  CALL add_schedule('VSS Properties', 2, 'R');
  CALL add_schedule('VSS Properties', 6, 'R');

  -- Lumavi: Lunes R, Martes R, Miércoles R, Jueves R, Viernes R
  CALL add_schedule('Lumavi', 1, 'R');
  CALL add_schedule('Lumavi', 2, 'R');
  CALL add_schedule('Lumavi', 3, 'R');
  CALL add_schedule('Lumavi', 4, 'R');
  CALL add_schedule('Lumavi', 5, 'R');

  -- SERVICIOS
  -- Beyond PVC: Martes R, Miércoles P, Viernes R
  CALL add_schedule('Beyond PVC', 2, 'R');
  CALL add_schedule('Beyond PVC', 3, 'P');
  CALL add_schedule('Beyond PVC', 5, 'R');

  -- Cerrajero: Martes R, Jueves R, Sábado R
  CALL add_schedule('Cerrajero', 2, 'R');
  CALL add_schedule('Cerrajero', 4, 'R');
  CALL add_schedule('Cerrajero', 6, 'R');

  -- David Bonilla Seguros: Martes R, Miércoles P, Jueves R
  CALL add_schedule('David Bonilla Seguros', 2, 'R');
  CALL add_schedule('David Bonilla Seguros', 3, 'P');
  CALL add_schedule('David Bonilla Seguros', 4, 'R');

  -- David Bonilla Windmar: Lunes R, Miércoles R, Viernes R
  CALL add_schedule('David Bonilla Windmar', 1, 'R');
  CALL add_schedule('David Bonilla Windmar', 3, 'R');
  CALL add_schedule('David Bonilla Windmar', 5, 'R');

  -- Quantika: Martes R, Jueves P, Sábado R
  CALL add_schedule('Quantika', 2, 'R');
  CALL add_schedule('Quantika', 4, 'P');
  CALL add_schedule('Quantika', 6, 'R');

  -- RETAIL/OTROS
  -- Codepola: Lunes R, Miércoles R, Viernes R
  CALL add_schedule('Codepola', 1, 'R');
  CALL add_schedule('Codepola', 3, 'R');
  CALL add_schedule('Codepola', 5, 'R');

  -- Tito Rios: Lunes R, Miércoles R, Jueves R
  CALL add_schedule('Tito Rios', 1, 'R');
  CALL add_schedule('Tito Rios', 3, 'R');
  CALL add_schedule('Tito Rios', 4, 'R');

  -- Arte Digital: Lunes P, Martes R, Miércoles P, Jueves R, Viernes P, Sábado R
  CALL add_schedule('Arte Digital', 1, 'P');
  CALL add_schedule('Arte Digital', 2, 'R');
  CALL add_schedule('Arte Digital', 3, 'P');
  CALL add_schedule('Arte Digital', 4, 'R');
  CALL add_schedule('Arte Digital', 5, 'P');
  CALL add_schedule('Arte Digital', 6, 'R');

  -- Lucky Pet: Lunes R, Martes P, Miércoles R, Jueves P, Viernes R
  CALL add_schedule('Lucky Pet', 1, 'R');
  CALL add_schedule('Lucky Pet', 2, 'P');
  CALL add_schedule('Lucky Pet', 3, 'R');
  CALL add_schedule('Lucky Pet', 4, 'P');
  CALL add_schedule('Lucky Pet', 5, 'R');

  -- Sanguit: Martes R, Jueves R, Sábado P
  CALL add_schedule('Sanguit', 2, 'R');
  CALL add_schedule('Sanguit', 4, 'R');
  CALL add_schedule('Sanguit', 6, 'P');

END;
$$;
