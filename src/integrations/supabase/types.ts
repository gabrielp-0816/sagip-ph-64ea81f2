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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      disaster_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      disasters: {
        Row: {
          affected_families: number
          affected_individuals: number
          barangay: string | null
          category_id: string
          city: string
          closed_at: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string
          name: string
          occurred_at: string
          raised_amount: number
          required_funding: number
          severity: Database["public"]["Enums"]["disaster_severity"]
          status: Database["public"]["Enums"]["disaster_status"]
          updated_at: string
        }
        Insert: {
          affected_families?: number
          affected_individuals?: number
          barangay?: string | null
          category_id: string
          city: string
          closed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location: string
          name: string
          occurred_at?: string
          raised_amount?: number
          required_funding?: number
          severity?: Database["public"]["Enums"]["disaster_severity"]
          status?: Database["public"]["Enums"]["disaster_status"]
          updated_at?: string
        }
        Update: {
          affected_families?: number
          affected_individuals?: number
          barangay?: string | null
          category_id?: string
          city?: string
          closed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string
          name?: string
          occurred_at?: string
          raised_amount?: number
          required_funding?: number
          severity?: Database["public"]["Enums"]["disaster_severity"]
          status?: Database["public"]["Enums"]["disaster_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disasters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "disaster_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          disaster_id: string | null
          donor_email: string | null
          donor_id: string | null
          donor_name: string
          id: string
          is_anonymous: boolean
          message: string | null
          payment_method: string
          proof_url: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          disaster_id?: string | null
          donor_email?: string | null
          donor_id?: string | null
          donor_name: string
          id?: string
          is_anonymous?: boolean
          message?: string | null
          payment_method?: string
          proof_url?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          disaster_id?: string | null
          donor_email?: string | null
          donor_id?: string | null
          donor_name?: string
          id?: string
          is_anonymous?: boolean
          message?: string | null
          payment_method?: string
          proof_url?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_disaster_id_fkey"
            columns: ["disaster_id"]
            isOneToOne: false
            referencedRelation: "disasters"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_allocations: {
        Row: {
          allocated_amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          disaster_id: string | null
          id: string
          label: string
          notes: string | null
          released_amount: number
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          disaster_id?: string | null
          id?: string
          label: string
          notes?: string | null
          released_amount?: number
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          disaster_id?: string | null
          id?: string
          label?: string
          notes?: string | null
          released_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_allocations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "disaster_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_allocations_disaster_id_fkey"
            columns: ["disaster_id"]
            isOneToOne: false
            referencedRelation: "disasters"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_releases: {
        Row: {
          allocation_id: string | null
          amount: number
          id: string
          notes: string | null
          proof_url: string | null
          reference_number: string | null
          released_at: string
          released_by: string | null
          request_id: string
        }
        Insert: {
          allocation_id?: string | null
          amount: number
          id?: string
          notes?: string | null
          proof_url?: string | null
          reference_number?: string | null
          released_at?: string
          released_by?: string | null
          request_id: string
        }
        Update: {
          allocation_id?: string | null
          amount?: number
          id?: string
          notes?: string | null
          proof_url?: string | null
          reference_number?: string | null
          released_at?: string
          released_by?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_releases_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "fund_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_releases_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "fund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_requests: {
        Row: {
          affected_individuals: number
          barangay: string
          category_id: string | null
          city: string
          created_at: string
          disaster_description: string
          disaster_id: string | null
          estimated_damage_cost: number
          exact_location: string
          id: string
          requested_amount: number
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          affected_individuals: number
          barangay: string
          category_id?: string | null
          city: string
          created_at?: string
          disaster_description: string
          disaster_id?: string | null
          estimated_damage_cost: number
          exact_location: string
          id?: string
          requested_amount: number
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          affected_individuals?: number
          barangay?: string
          category_id?: string | null
          city?: string
          created_at?: string
          disaster_description?: string
          disaster_id?: string | null
          estimated_damage_cost?: number
          exact_location?: string
          id?: string
          requested_amount?: number
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "disaster_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_requests_disaster_id_fkey"
            columns: ["disaster_id"]
            isOneToOne: false
            referencedRelation: "disasters"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          priority: Database["public"]["Enums"]["notification_priority"]
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          email: string
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          id_document_path: string
          id_number: string | null
          id_type: Database["public"]["Enums"]["id_type"] | null
          is_suspended: boolean
          is_verified: boolean
          last_name: string
          middle_name: string | null
          mobile_number: string | null
          must_change_password: boolean
          province: string | null
          residential_address: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          email: string
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          id_document_path: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_type"] | null
          is_suspended?: boolean
          is_verified?: boolean
          last_name: string
          middle_name?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          province?: string | null
          residential_address?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          email?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          id_document_path?: string
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["id_type"] | null
          is_suspended?: boolean
          is_verified?: boolean
          last_name?: string
          middle_name?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          province?: string | null
          residential_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uploaded_documents: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          owner_id: string
          related_id: string | null
          related_type: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          owner_id: string
          related_id?: string | null
          related_type: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          related_id?: string | null
          related_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      transactions: {
        Row: {
          amount: number | null
          category: string | null
          direction: string | null
          id: string | null
          occurred_at: string | null
          party: string | null
          proof_url: string | null
          reference: string | null
          reference_number: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_disaster_raised: {
        Args: { _disaster_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "official" | "ngo" | "citizen" | "super_admin"
      disaster_severity: "low" | "moderate" | "high" | "critical"
      disaster_status: "active" | "monitoring" | "closed"
      gender_type: "male" | "female" | "other" | "prefer_not_to_say"
      id_type:
        | "national_id"
        | "drivers_license"
        | "passport"
        | "umid"
        | "postal_id"
        | "voters_id"
      notification_priority: "low" | "normal" | "high" | "critical"
      request_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "released"
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
      app_role: ["admin", "official", "ngo", "citizen", "super_admin"],
      disaster_severity: ["low", "moderate", "high", "critical"],
      disaster_status: ["active", "monitoring", "closed"],
      gender_type: ["male", "female", "other", "prefer_not_to_say"],
      id_type: [
        "national_id",
        "drivers_license",
        "passport",
        "umid",
        "postal_id",
        "voters_id",
      ],
      notification_priority: ["low", "normal", "high", "critical"],
      request_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "released",
      ],
    },
  },
} as const
