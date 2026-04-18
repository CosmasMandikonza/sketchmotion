-- Create videos table for generated video versions
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  prompt TEXT,
  style TEXT,
  duration_seconds INTEGER,
  resolution TEXT DEFAULT '1080p',
  status TEXT DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  version_number INTEGER NOT NULL DEFAULT 1,
  version_label TEXT,
  thumbnail_url TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for fast board lookups
CREATE INDEX idx_videos_board ON videos(board_id);
CREATE INDEX idx_videos_created ON videos(board_id, created_at DESC);

-- RLS policies
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view videos on accessible boards"
ON videos FOR SELECT
USING (
  board_id IN (
    SELECT id FROM boards WHERE user_id = auth.uid()
  )
  OR board_id IN (
    SELECT board_id FROM board_collaborators
    WHERE user_id = auth.uid()
  )
  OR board_id IN (
    SELECT id FROM boards
    WHERE (sharing_settings->>'public_access') IN ('view', 'edit')
  )
);

CREATE POLICY "Users can insert videos on their boards"
ON videos FOR INSERT
WITH CHECK (
  board_id IN (SELECT id FROM boards WHERE user_id = auth.uid())
  OR board_id IN (
    SELECT board_id FROM board_collaborators
    WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  )
);

CREATE POLICY "Users can delete videos on their boards"
ON videos FOR DELETE
USING (
  board_id IN (SELECT id FROM boards WHERE user_id = auth.uid())
);
