-- Allow anonymous users to view public boards and their content

-- Update boards policy to properly check public access
DROP POLICY IF EXISTS "Users can view accessible boards" ON boards;
CREATE POLICY "Users can view accessible boards"
ON boards FOR SELECT
USING (
  -- Owner always has access
  user_id = auth.uid()
  -- Or user is a collaborator
  OR id IN (
    SELECT board_id FROM board_collaborators
    WHERE user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  -- Or board is public (anyone can view)
  OR (sharing_settings->>'public_access') IN ('view', 'edit')
);

-- Allow anon users to view public boards
DROP POLICY IF EXISTS "Anyone can view public boards" ON boards;
CREATE POLICY "Anyone can view public boards"
ON boards FOR SELECT
TO anon
USING (
  (sharing_settings->>'public_access') IN ('view', 'edit')
);

-- Allow anon users to view frames on public boards
DROP POLICY IF EXISTS "Anyone can view frames on public boards" ON frames;
CREATE POLICY "Anyone can view frames on public boards"
ON frames FOR SELECT
TO anon
USING (
  board_id IN (
    SELECT id FROM boards
    WHERE (sharing_settings->>'public_access') IN ('view', 'edit')
  )
);

-- Allow anon users to view connections on public boards
DROP POLICY IF EXISTS "Anyone can view connections on public boards" ON connections;
CREATE POLICY "Anyone can view connections on public boards"
ON connections FOR SELECT
TO anon
USING (
  board_id IN (
    SELECT id FROM boards
    WHERE (sharing_settings->>'public_access') IN ('view', 'edit')
  )
);

-- Allow authenticated users to view frames on public boards (not just their own)
DROP POLICY IF EXISTS "Users can view frames on accessible boards" ON frames;
CREATE POLICY "Users can view frames on accessible boards"
ON frames FOR SELECT
USING (
  -- User owns the board
  board_id IN (SELECT id FROM boards WHERE user_id = auth.uid())
  -- Or user is a collaborator
  OR board_id IN (
    SELECT board_id FROM board_collaborators
    WHERE user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  -- Or board is public
  OR board_id IN (
    SELECT id FROM boards
    WHERE (sharing_settings->>'public_access') IN ('view', 'edit')
  )
);

-- Allow authenticated users to view connections on public boards (not just their own)
DROP POLICY IF EXISTS "Users can view connections on accessible boards" ON connections;
CREATE POLICY "Users can view connections on accessible boards"
ON connections FOR SELECT
USING (
  -- User owns the board
  board_id IN (SELECT id FROM boards WHERE user_id = auth.uid())
  -- Or user is a collaborator
  OR board_id IN (
    SELECT board_id FROM board_collaborators
    WHERE user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  -- Or board is public
  OR board_id IN (
    SELECT id FROM boards
    WHERE (sharing_settings->>'public_access') IN ('view', 'edit')
  )
);

-- Allow editors on public boards to modify frames
DROP POLICY IF EXISTS "Editors can modify frames on public boards" ON frames;
CREATE POLICY "Editors can modify frames on public boards"
ON frames FOR ALL
USING (
  -- User owns the board
  board_id IN (SELECT id FROM boards WHERE user_id = auth.uid())
  -- Or user is an editor collaborator
  OR board_id IN (
    SELECT board_id FROM board_collaborators
    WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND role IN ('owner', 'editor')
  )
  -- Or board allows public editing
  OR board_id IN (
    SELECT id FROM boards
    WHERE (sharing_settings->>'public_access') = 'edit'
  )
);

-- Allow editors on public boards to modify connections
DROP POLICY IF EXISTS "Editors can modify connections on public boards" ON connections;
CREATE POLICY "Editors can modify connections on public boards"
ON connections FOR ALL
USING (
  -- User owns the board
  board_id IN (SELECT id FROM boards WHERE user_id = auth.uid())
  -- Or user is an editor collaborator
  OR board_id IN (
    SELECT board_id FROM board_collaborators
    WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND role IN ('owner', 'editor')
  )
  -- Or board allows public editing
  OR board_id IN (
    SELECT id FROM boards
    WHERE (sharing_settings->>'public_access') = 'edit'
  )
);
