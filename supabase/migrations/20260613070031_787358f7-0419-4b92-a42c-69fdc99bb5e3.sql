
CREATE TABLE public.vocab_practice_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocab_set_id uuid REFERENCES public.vocab_sets(id) ON DELETE SET NULL,
  card_id uuid,
  word text NOT NULL,
  definition text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'match',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vocab_errors_user_set ON public.vocab_practice_errors (user_id, vocab_set_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.vocab_practice_errors TO authenticated;
GRANT ALL ON public.vocab_practice_errors TO service_role;

ALTER TABLE public.vocab_practice_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vocab errors"
  ON public.vocab_practice_errors
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
