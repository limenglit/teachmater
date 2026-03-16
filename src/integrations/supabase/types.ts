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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          condition_type: string
          condition_value: number
          created_at: string
          creator_token: string
          description: string
          emoji: string
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          condition_type?: string
          condition_value?: number
          created_at?: string
          creator_token?: string
          description?: string
          emoji?: string
          id?: string
          is_system?: boolean
          name?: string
        }
        Update: {
          condition_type?: string
          condition_value?: number
          created_at?: string
          creator_token?: string
          description?: string
          emoji?: string
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      barrage_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          nickname: string
          topic_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          nickname?: string
          topic_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          nickname?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barrage_messages_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "discussion_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      board_cards: {
        Row: {
          author_nickname: string
          board_id: string
          card_type: string
          color: string
          column_id: string
          content: string
          created_at: string
          id: string
          is_approved: boolean
          is_pinned: boolean
          likes_count: number
          media_url: string
          position_x: number
          position_y: number
          sort_order: number
          url: string
        }
        Insert: {
          author_nickname?: string
          board_id: string
          card_type?: string
          color?: string
          column_id?: string
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_pinned?: boolean
          likes_count?: number
          media_url?: string
          position_x?: number
          position_y?: number
          sort_order?: number
          url?: string
        }
        Update: {
          author_nickname?: string
          board_id?: string
          card_type?: string
          color?: string
          column_id?: string
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_pinned?: boolean
          likes_count?: number
          media_url?: string
          position_x?: number
          position_y?: number
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_comments: {
        Row: {
          author_nickname: string
          card_id: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_nickname?: string
          card_id: string
          content?: string
          created_at?: string
          id?: string
        }
        Update: {
          author_nickname?: string
          card_id?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "board_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_likes: {
        Row: {
          card_id: string
          created_at: string
          id: string
          liker_token: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          liker_token?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          liker_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_likes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "board_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          background_color: string
          banned_words: string
          columns: Json
          created_at: string
          creator_token: string
          description: string
          id: string
          is_locked: boolean
          moderation_enabled: boolean
          student_names: Json | null
          title: string
          user_id: string | null
          view_mode: string
        }
        Insert: {
          background_color?: string
          banned_words?: string
          columns?: Json
          created_at?: string
          creator_token?: string
          description?: string
          id?: string
          is_locked?: boolean
          moderation_enabled?: boolean
          student_names?: Json | null
          title?: string
          user_id?: string | null
          view_mode?: string
        }
        Update: {
          background_color?: string
          banned_words?: string
          columns?: Json
          created_at?: string
          creator_token?: string
          description?: string
          id?: string
          is_locked?: boolean
          moderation_enabled?: boolean
          student_names?: Json | null
          title?: string
          user_id?: string | null
          view_mode?: string
        }
        Relationships: []
      }
      checkin_records: {
        Row: {
          checked_in_at: string
          id: string
          session_id: string
          status: string
          student_name: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          session_id: string
          status?: string
          student_name: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          session_id?: string
          status?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checkin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_sessions: {
        Row: {
          created_at: string
          creator_token: string
          duration_minutes: number
          ended_at: string | null
          id: string
          status: string
          student_names: Json | null
        }
        Insert: {
          created_at?: string
          creator_token?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          status?: string
          student_names?: Json | null
        }
        Update: {
          created_at?: string
          creator_token?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          status?: string
          student_names?: Json | null
        }
        Relationships: []
      }
      class_students: {
        Row: {
          class_id: string
          created_at: string
          id: string
          name: string
          student_number: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          name: string
          student_number?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          name?: string
          student_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          college_id: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          college_id: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          college_id?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      discussion_topics: {
        Row: {
          created_at: string
          creator_token: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          creator_token?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          creator_token?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          selected_options: Json
          voter_name: string
          voter_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          selected_options?: Json
          voter_name?: string
          voter_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          selected_options?: Json
          voter_name?: string
          voter_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          creator_token: string
          ended_at: string | null
          id: string
          options: Json
          poll_type: string
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          creator_token?: string
          ended_at?: string | null
          id?: string
          options?: Json
          poll_type?: string
          status?: string
          title?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          creator_token?: string
          ended_at?: string | null
          id?: string
          options?: Json
          poll_type?: string
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nickname: string | null
          status: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nickname?: string | null
          status?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nickname?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          answer: Json
          created_at: string
          id: string
          is_correct: boolean | null
          question_index: number
          session_id: string
          student_name: string
        }
        Insert: {
          answer?: Json
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_index?: number
          session_id: string
          student_name?: string
        }
        Update: {
          answer?: Json
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_index?: number
          session_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_categories_parent_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "quiz_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_papers: {
        Row: {
          created_at: string
          description: string
          id: string
          is_template: boolean
          questions: Json
          template: Json | null
          title: string
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_template?: boolean
          questions?: Json
          template?: Json | null
          title?: string
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_template?: boolean
          questions?: Json
          template?: Json | null
          title?: string
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          category_id: string | null
          content: string
          correct_answer: Json
          created_at: string
          id: string
          is_starred: boolean
          options: Json
          tags: string
          type: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          content?: string
          correct_answer?: Json
          created_at?: string
          id?: string
          is_starred?: boolean
          options?: Json
          tags?: string
          type?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          content?: string
          correct_answer?: Json
          created_at?: string
          id?: string
          is_starred?: boolean
          options?: Json
          tags?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_category_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "quiz_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          created_at: string
          creator_token: string
          ended_at: string | null
          id: string
          questions: Json
          status: string
          student_names: Json | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          creator_token?: string
          ended_at?: string | null
          id?: string
          questions?: Json
          status?: string
          student_names?: Json | null
          title?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          creator_token?: string
          ended_at?: string | null
          id?: string
          questions?: Json
          status?: string
          student_names?: Json | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          created_at: string
          id: string
          name: string
          rules: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          rules?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rules?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seat_checkin_records: {
        Row: {
          checked_in_at: string
          id: string
          session_id: string
          student_name: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          session_id: string
          student_name: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          session_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_checkin_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "seat_checkin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_checkin_sessions: {
        Row: {
          created_at: string
          id: string
          scene_config: Json
          scene_type: string
          seat_data: Json
          status: string
          student_names: Json
        }
        Insert: {
          created_at?: string
          id?: string
          scene_config?: Json
          scene_type?: string
          seat_data?: Json
          status?: string
          student_names?: Json
        }
        Update: {
          created_at?: string
          id?: string
          scene_config?: Json
          scene_type?: string
          seat_data?: Json
          status?: string
          student_names?: Json
        }
        Relationships: []
      }
      student_badges: {
        Row: {
          badge_id: string
          creator_token: string
          earned_at: string
          id: string
          student_name: string
        }
        Insert: {
          badge_id: string
          creator_token?: string
          earned_at?: string
          id?: string
          student_name: string
        }
        Update: {
          badge_id?: string
          creator_token?: string
          earned_at?: string
          id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      student_points: {
        Row: {
          created_at: string
          creator_token: string
          description: string
          id: string
          points: number
          source: string
          student_name: string
        }
        Insert: {
          created_at?: string
          creator_token?: string
          description?: string
          id?: string
          points?: number
          source?: string
          student_name: string
        }
        Update: {
          created_at?: string
          creator_token?: string
          description?: string
          id?: string
          points?: number
          source?: string
          student_name?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          config: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed_at: string
          id: string
          session_id: string
          student_name: string
          task_index: number
        }
        Insert: {
          completed_at?: string
          id?: string
          session_id: string
          student_name: string
          task_index?: number
        }
        Update: {
          completed_at?: string
          id?: string
          session_id?: string
          student_name?: string
          task_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "task_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sessions: {
        Row: {
          created_at: string
          creator_token: string
          id: string
          status: string
          student_names: Json | null
          tasks: Json
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          creator_token?: string
          id?: string
          status?: string
          student_names?: Json | null
          tasks?: Json
          title?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          creator_token?: string
          id?: string
          status?: string
          student_names?: Json | null
          tasks?: Json
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      teamwork_history: {
        Row: {
          created_at: string
          data: Json
          id: string
          student_count: number
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          student_count?: number
          title?: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          student_count?: number
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_user: { Args: { p_user_id: string }; Returns: undefined }
      delete_badge: {
        Args: { p_badge_id: string; p_token: string }
        Returns: undefined
      }
      delete_board: {
        Args: { p_board_id: string; p_token: string }
        Returns: undefined
      }
      delete_poll: {
        Args: { p_poll_id: string; p_token: string }
        Returns: undefined
      }
      delete_quiz_session: {
        Args: { p_session_id: string; p_token: string }
        Returns: undefined
      }
      delete_student_points: {
        Args: { p_point_id: string; p_token: string }
        Returns: undefined
      }
      delete_task_session: {
        Args: { p_session_id: string; p_token: string }
        Returns: undefined
      }
      delete_topic: {
        Args: { p_token: string; p_topic_id: string }
        Returns: undefined
      }
      get_my_status: { Args: never; Returns: string }
      get_pending_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          nickname: string
          status: string
          user_id: string
        }[]
      }
      get_quiz_session_for_student: {
        Args: { p_session_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      manage_board_card: {
        Args: {
          p_action: string
          p_board_id: string
          p_card_id: string
          p_token: string
        }
        Returns: undefined
      }
      reject_user: { Args: { p_user_id: string }; Returns: undefined }
      submit_quiz_answers: {
        Args: { p_answers: Json; p_session_id: string; p_student_name: string }
        Returns: undefined
      }
      update_board:
        | {
            Args: {
              p_background_color?: string
              p_banned_words?: string
              p_board_id: string
              p_columns?: Json
              p_description?: string
              p_is_locked?: boolean
              p_moderation_enabled?: boolean
              p_title?: string
              p_token: string
              p_view_mode?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_background_color?: string
              p_banned_words?: string
              p_board_id: string
              p_columns?: Json
              p_description?: string
              p_is_locked?: boolean
              p_moderation_enabled?: boolean
              p_student_names?: Json
              p_title?: string
              p_token: string
              p_view_mode?: string
            }
            Returns: undefined
          }
      update_checkin_session: {
        Args: { p_session_id: string; p_status?: string; p_token: string }
        Returns: undefined
      }
      update_poll: {
        Args: {
          p_poll_id: string
          p_status?: string
          p_title?: string
          p_token: string
        }
        Returns: undefined
      }
      update_quiz_session: {
        Args: {
          p_session_id: string
          p_status?: string
          p_title?: string
          p_token: string
        }
        Returns: undefined
      }
      update_seat_checkin_session: {
        Args: { p_session_id: string; p_status?: string }
        Returns: undefined
      }
      update_task_session: {
        Args: { p_session_id: string; p_status?: string; p_token: string }
        Returns: undefined
      }
      update_topic: {
        Args: { p_title: string; p_token: string; p_topic_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
