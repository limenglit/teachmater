CREATE POLICY "Anyone can update collaborative image strokes"
ON public.board_strokes
FOR UPDATE
TO public
USING (
  tool = 'image'
  AND EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_strokes.board_id
      AND b.is_collaborative = true
  )
)
WITH CHECK (
  tool = 'image'
  AND EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_strokes.board_id
      AND b.is_collaborative = true
  )
);