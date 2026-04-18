-- Add is_archived column to boards table
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for faster filtering on archived status
CREATE INDEX IF NOT EXISTS idx_boards_archived ON boards(is_archived);

-- Update RLS policy to allow users to update their own boards' archive status
-- (existing policies should already cover this since we're just adding a column)
