import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types matching our schema
export interface DbBoard {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DbFrame {
  id: string;
  board_id: string;
  title: string;
  position_x: number;
  position_y: number;
  status: 'sketch' | 'polished';
  sketch_url: string | null;
  polished_url: string | null;
  thumbnail_url: string | null;
  motion_notes: string | null;
  animation_style: string;
  duration_ms: number;
  sort_order: number;
  created_at: string;
}

export interface DbConnection {
  id: string;
  board_id: string;
  from_frame_id: string;
  to_frame_id: string;
  transition_type: string;
  created_at: string;
}
