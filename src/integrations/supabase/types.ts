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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          bucket_key: string
          created_at: string
          hits: number
          id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          hits?: number
          id?: string
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          hits?: number
          id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      ats_settings: {
        Row: {
          base_url: string | null
          created_at: string
          default_board_id: string | null
          enabled: boolean
          id: string
          provider: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          default_board_id?: string | null
          enabled?: boolean
          id?: string
          provider?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          default_board_id?: string | null
          enabled?: boolean
          id?: string
          provider?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          ai_confidence: number | null
          call_end_time: string | null
          call_id: string
          call_start_time: string | null
          call_status: string
          candidate_id: string
          created_at: string
          error_message: string | null
          external_call_id: string | null
          extracted_at: string | null
          extraction_json: Json | null
          extraction_model: string | null
          job_id: string | null
          provider: string
          recording_url: string | null
          transcript_text: string | null
        }
        Insert: {
          ai_confidence?: number | null
          call_end_time?: string | null
          call_id?: string
          call_start_time?: string | null
          call_status?: string
          candidate_id: string
          created_at?: string
          error_message?: string | null
          external_call_id?: string | null
          extracted_at?: string | null
          extraction_json?: Json | null
          extraction_model?: string | null
          job_id?: string | null
          provider?: string
          recording_url?: string | null
          transcript_text?: string | null
        }
        Update: {
          ai_confidence?: number | null
          call_end_time?: string | null
          call_id?: string
          call_start_time?: string | null
          call_status?: string
          candidate_id?: string
          created_at?: string
          error_message?: string | null
          external_call_id?: string | null
          extracted_at?: string | null
          extraction_json?: Json | null
          extraction_model?: string | null
          job_id?: string | null
          provider?: string
          recording_url?: string | null
          transcript_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "call_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      candidate_responses: {
        Row: {
          call_id: string
          created_at: string
          question_code: string
          response_id: string
          response_text: string | null
          response_value: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          question_code: string
          response_id?: string
          response_text?: string | null
          response_value?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          question_code?: string
          response_id?: string
          response_text?: string | null
          response_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_responses_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["call_id"]
          },
        ]
      }
      candidates: {
        Row: {
          ats_external_id: string | null
          ats_id: string | null
          ats_synced_at: string | null
          candidate_id: string
          created_at: string
          email: string | null
          full_name: string
          job_id: string | null
          phone_number: string | null
          source: string | null
          status: string
        }
        Insert: {
          ats_external_id?: string | null
          ats_id?: string | null
          ats_synced_at?: string | null
          candidate_id?: string
          created_at?: string
          email?: string | null
          full_name: string
          job_id?: string | null
          phone_number?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          ats_external_id?: string | null
          ats_id?: string | null
          ats_synced_at?: string | null
          candidate_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          job_id?: string | null
          phone_number?: string | null
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      interview_schedules: {
        Row: {
          calendar_event_id: string | null
          calendar_event_url: string | null
          calendar_provider: string | null
          calendar_uid: string | null
          candidate_id: string
          created_at: string
          interview_date: string
          interview_time: string
          interviewer_name: string | null
          invite_sent: boolean
          job_id: string | null
          meeting_link: string | null
          schedule_id: string
          status: string
        }
        Insert: {
          calendar_event_id?: string | null
          calendar_event_url?: string | null
          calendar_provider?: string | null
          calendar_uid?: string | null
          candidate_id: string
          created_at?: string
          interview_date: string
          interview_time: string
          interviewer_name?: string | null
          invite_sent?: boolean
          job_id?: string | null
          meeting_link?: string | null
          schedule_id?: string
          status?: string
        }
        Update: {
          calendar_event_id?: string | null
          calendar_event_url?: string | null
          calendar_provider?: string | null
          calendar_uid?: string | null
          candidate_id?: string
          created_at?: string
          interview_date?: string
          interview_time?: string
          interviewer_name?: string | null
          invite_sent?: boolean
          job_id?: string | null
          meeting_link?: string | null
          schedule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_schedules_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
          {
            foreignKeyName: "interview_schedules_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      jobs: {
        Row: {
          company_name: string | null
          created_at: string
          employment_type: string | null
          jd_text: string | null
          job_id: string
          location: string | null
          salary_range: string | null
          title: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          employment_type?: string | null
          jd_text?: string | null
          job_id?: string
          location?: string | null
          salary_range?: string | null
          title: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          employment_type?: string | null
          jd_text?: string | null
          job_id?: string
          location?: string | null
          salary_range?: string | null
          title?: string
        }
        Relationships: []
      }
      recruiters: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string
          phone_number: string | null
          recruiter_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          phone_number?: string | null
          recruiter_id?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          phone_number?: string | null
          recruiter_id?: string
        }
        Relationships: []
      }
      telephony_settings: {
        Row: {
          agent_id: string | null
          agent_phone_number_id: string | null
          caller_label: string | null
          created_at: string
          enabled: boolean
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          agent_phone_number_id?: string | null
          caller_label?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          agent_phone_number_id?: string | null
          caller_label?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
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
