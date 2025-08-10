export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_cache: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key: string
          model: string | null
          request_fingerprint: string | null
          result: Json
          tokens_estimated: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key: string
          model?: string | null
          request_fingerprint?: string | null
          result: Json
          tokens_estimated?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key?: string
          model?: string | null
          request_fingerprint?: string | null
          result?: Json
          tokens_estimated?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_logs: {
        Row: {
          cache_hit: boolean
          cost_usd: number | null
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          operation: string
          prompt_chars: number | null
          request_fingerprint: string | null
          request_tokens: number | null
          response_tokens: number | null
          user_id: string
        }
        Insert: {
          cache_hit?: boolean
          cost_usd?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          operation: string
          prompt_chars?: number | null
          request_fingerprint?: string | null
          request_tokens?: number | null
          response_tokens?: number | null
          user_id: string
        }
        Update: {
          cache_hit?: boolean
          cost_usd?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          operation?: string
          prompt_chars?: number | null
          request_fingerprint?: string | null
          request_tokens?: number | null
          response_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      llm_budgets: {
        Row: {
          created_at: string
          daily_limit_usd: number
          date: string
          id: string
          spent_tokens_in: number
          spent_tokens_out: number
          spent_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_limit_usd?: number
          date?: string
          id?: string
          spent_tokens_in?: number
          spent_tokens_out?: number
          spent_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_limit_usd?: number
          date?: string
          id?: string
          spent_tokens_in?: number
          spent_tokens_out?: number
          spent_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          audio_url: string | null
          created_at: string | null
          emotion: string | null
          id: string
          summary: string | null
          tags: string[] | null
          title: string | null
          transcript: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          emotion?: string | null
          id?: string
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          transcript?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          emotion?: string | null
          id?: string
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          transcript?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      memory_chunks: {
        Row: {
          content: string
          content_hash: string | null
          created_at: string
          embedding: string
          id: string
          memory_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          content_hash?: string | null
          created_at?: string
          embedding: string
          id?: string
          memory_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          content_hash?: string | null
          created_at?: string
          embedding?: string
          id?: string
          memory_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_chunks_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_archived: boolean
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          vault_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          vault_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          vault_id?: string | null
        }
        Relationships: []
      }
      proactive_events: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
          rule_id: string
          status: Database["public"]["Enums"]["proactive_event_status"]
          user_id: string
          vault_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
          rule_id: string
          status?: Database["public"]["Enums"]["proactive_event_status"]
          user_id: string
          vault_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
          rule_id?: string
          status?: Database["public"]["Enums"]["proactive_event_status"]
          user_id?: string
          vault_id?: string | null
        }
        Relationships: []
      }
      proactive_rules: {
        Row: {
          action: Json | null
          conditions: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
          vault_id: string | null
        }
        Insert: {
          action?: Json | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
          vault_id?: string | null
        }
        Update: {
          action?: Json | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          vault_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          memories_count: number | null
          subscription_tier: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          memories_count?: number | null
          subscription_tier?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          memories_count?: number | null
          subscription_tier?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vault_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["vault_member_role"]
          user_id: string
          vault_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["vault_member_role"]
          user_id: string
          vault_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["vault_member_role"]
          user_id?: string
          vault_id?: string
        }
        Relationships: []
      }
      vaults: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_current_user_vault_role: {
        Args: {
          _vault_id: string
          _role: Database["public"]["Enums"]["vault_member_role"]
        }
        Returns: boolean
      }
      has_vault_role: {
        Args: {
          _user_id: string
          _vault_id: string
          _role: Database["public"]["Enums"]["vault_member_role"]
        }
        Returns: boolean
      }
      is_current_user_vault_member: {
        Args: { _vault_id: string }
        Returns: boolean
      }
      is_vault_member: {
        Args: { _user_id: string; _vault_id: string }
        Returns: boolean
      }
      match_memory_chunks: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          memory_id: string
          content: string
          distance: number
        }[]
      }
    }
    Enums: {
      proactive_event_status: "triggered" | "executed" | "failed"
      vault_member_role: "owner" | "editor" | "viewer"
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
    Enums: {
      proactive_event_status: ["triggered", "executed", "failed"],
      vault_member_role: ["owner", "editor", "viewer"],
    },
  },
} as const
