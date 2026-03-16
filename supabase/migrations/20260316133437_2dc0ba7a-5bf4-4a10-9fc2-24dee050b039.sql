
CREATE TABLE public.scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '默认规则',
  rules jsonb NOT NULL DEFAULT '{
    "board_participate": {"enabled": true, "points_per": 2, "weight": 20},
    "board_quality": {"enabled": true, "points_per_like": 1, "weight": 10},
    "task_complete": {"enabled": true, "points_per": 3, "weight": 25},
    "barrage_participate": {"enabled": true, "points_per": 1, "weight": 15},
    "quiz_participate": {"enabled": true, "points_per": 2, "weight": 15},
    "checkin": {"enabled": true, "points_per": 1, "weight": 15}
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scoring rules" ON public.scoring_rules
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
