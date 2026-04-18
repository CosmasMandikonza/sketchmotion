export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      board_collaborators: {
        Row: {
          accepted_at: string | null
          board_id: string
          created_at: string | null
          email: string | null
          id: string
          invited_by: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          board_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          board_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_collaborators_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string | null
          id: string
          is_archived: boolean | null
          name: string
          sharing_settings: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          sharing_settings?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          sharing_settings?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          board_id: string
          created_at: string | null
          from_frame_id: string
          id: string
          to_frame_id: string
          transition_type: string | null
        }
        Insert: {
          board_id: string
          created_at?: string | null
          from_frame_id: string
          id?: string
          to_frame_id: string
          transition_type?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string | null
          from_frame_id?: string
          id?: string
          to_frame_id?: string
          transition_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_from_frame_id_fkey"
            columns: ["from_frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_to_frame_id_fkey"
            columns: ["to_frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
        ]
      }
      frames: {
        Row: {
          animation_style: string | null
          board_id: string
          created_at: string | null
          duration_ms: number | null
          id: string
          motion_notes: string | null
          polished_url: string | null
          position_x: number
          position_y: number
          sketch_url: string | null
          sort_order: number | null
          status: string | null
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          animation_style?: string | null
          board_id: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          motion_notes?: string | null
          polished_url?: string | null
          position_x: number
          position_y: number
          sketch_url?: string | null
          sort_order?: number | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          animation_style?: string | null
          board_id?: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          motion_notes?: string | null
          polished_url?: string | null
          position_x?: number
          position_y?: number
          sketch_url?: string | null
          sort_order?: number | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "frames_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          board_id: string
          created_at: string | null
          created_by: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          prompt: string | null
          resolution: string | null
          status: string | null
          style: string | null
          thumbnail_url: string | null
          version_label: string | null
          version_number: number
          video_url: string
        }
        Insert: {
          board_id: string
          created_at?: string | null
          created_by?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          prompt?: string | null
          resolution?: string | null
          status?: string | null
          style?: string | null
          thumbnail_url?: string | null
          version_label?: string | null
          version_number?: number
          video_url: string
        }
        Update: {
          board_id?: string
          created_at?: string | null
          created_by?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          prompt?: string | null
          resolution?: string | null
          status?: string | null
          style?: string | null
          thumbnail_url?: string | null
          version_label?: string | null
          version_number?: number
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
