-- Board collaborators table
CREATE TABLE IF NOT EXISTS board_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  CONSTRAINT unique_board_user UNIQUE(board_id, user_id),
  CONSTRAINT unique_board_email UNIQUE(board_id, email),
  CONSTRAINT must_have_user_or_email CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

-- Add sharing settings to boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS sharing_settings JSONB DEFAULT '{"public_access": "none", "allow_copy": false}'::jsonb;

-- Enable RLS
ALTER TABLE board_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators policies
CREATE POLICY "Users can view collaborators of boards they access"
ON board_collaborators FOR SELECT
USING (
  board_id IN (
    SELECT id FROM boards WHERE user_id = auth.uid()
  )
  OR user_id = auth.uid()
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Board owners can manage collaborators"
ON board_collaborators FOR ALL
USING (
  board_id IN (SELECT id FROM boards WHERE user_id = auth.uid())
);

-- Update boards policy to include collaborators
DROP POLICY IF EXISTS "Users can view their own boards" ON boards;
CREATE POLICY "Users can view accessible boards"
ON boards FOR SELECT
USING (
  user_id = auth.uid()
  OR id IN (
    SELECT board_id FROM board_collaborators
    WHERE user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  OR (sharing_settings->>'public_access') != 'none'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collaborators_board ON board_collaborators(board_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON board_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_email ON board_collaborators(email);
