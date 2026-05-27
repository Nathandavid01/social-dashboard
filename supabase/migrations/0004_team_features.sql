-- ============================================================
-- MIGRATION 0004: Team Features
-- - Add collaborators[] to tasks
-- - Add recording_sessions table for videographers
-- ============================================================

-- Add collaborators array to tasks (array of profile UUIDs)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS collaborators uuid[] NOT NULL DEFAULT '{}';

-- ============================================================
-- RECORDING SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recording_sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_date    date NOT NULL,
  client_id       uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  videographer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title           text NOT NULL,
  notes           text,
  location        text,
  start_time      time,
  end_time        time,
  status          text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read recording_sessions"
  ON public.recording_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert recording_sessions"
  ON public.recording_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can update recording_sessions"
  ON public.recording_sessions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete recording_sessions"
  ON public.recording_sessions FOR DELETE TO authenticated USING (true);

-- updated_at trigger
CREATE TRIGGER set_recording_sessions_updated_at
  BEFORE UPDATE ON public.recording_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
