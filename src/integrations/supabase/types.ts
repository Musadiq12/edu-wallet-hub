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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achiever_avatars: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_visible: boolean
          name: string | null
          photo_url: string
          sort_order: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          name?: string | null
          photo_url: string
          sort_order?: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          name?: string | null
          photo_url?: string
          sort_order?: number
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          summary: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          summary: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_reset_attempts: {
        Row: {
          actor_id: string
          attempted_at: string
          id: number
          ip_address: unknown
        }
        Insert: {
          actor_id: string
          attempted_at?: string
          id?: never
          ip_address?: unknown
        }
        Update: {
          actor_id?: string
          attempted_at?: string
          id?: never
          ip_address?: unknown
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          display_name: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcement_bar_config: {
        Row: {
          background_color: string
          direction: string
          enabled: boolean
          id: boolean
          messages: Json
          speed_seconds: number
          text_color: string
          timezone: string
          updated_at: string
        }
        Insert: {
          background_color?: string
          direction?: string
          enabled?: boolean
          id?: boolean
          messages?: Json
          speed_seconds?: number
          text_color?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          background_color?: string
          direction?: string
          enabled?: boolean
          id?: boolean
          messages?: Json
          speed_seconds?: number
          text_color?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      answer_sheet_submissions: {
        Row: {
          answer_sheet_path: string
          assigned_evaluator_id: string | null
          checked_at: string | null
          checked_copy_path: string | null
          enrollment_id: string | null
          feedback: string | null
          id: string
          marks: number | null
          status: Database["public"]["Enums"]["sheet_status"]
          student_id: string
          submitted_at: string
          test_id: string | null
        }
        Insert: {
          answer_sheet_path: string
          assigned_evaluator_id?: string | null
          checked_at?: string | null
          checked_copy_path?: string | null
          enrollment_id?: string | null
          feedback?: string | null
          id?: string
          marks?: number | null
          status?: Database["public"]["Enums"]["sheet_status"]
          student_id: string
          submitted_at?: string
          test_id?: string | null
        }
        Update: {
          answer_sheet_path?: string
          assigned_evaluator_id?: string | null
          checked_at?: string | null
          checked_copy_path?: string | null
          enrollment_id?: string | null
          feedback?: string | null
          id?: string
          marks?: number | null
          status?: Database["public"]["Enums"]["sheet_status"]
          student_id?: string
          submitted_at?: string
          test_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_sheet_submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_sheet_submissions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          category: string
          content: string
          cover_image: string
          created_at: string
          excerpt: string
          id: string
          meta_description: string
          meta_title: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          cover_image?: string
          created_at?: string
          excerpt?: string
          id?: string
          meta_description?: string
          meta_title?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          cover_image?: string
          created_at?: string
          excerpt?: string
          id?: string
          meta_description?: string
          meta_title?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_id: string
          discount_applied: number
          id: string
          order_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_id: string
          discount_applied: number
          id?: string
          order_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_id?: string
          discount_applied?: number
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "my_library"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "seller_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_targets: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["coupon_target_mode"]
          target_id: string | null
          target_type: Database["public"]["Enums"]["coupon_target_type"]
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["coupon_target_mode"]
          target_id?: string | null
          target_type: Database["public"]["Enums"]["coupon_target_type"]
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["coupon_target_mode"]
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["coupon_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "coupon_targets_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_validation_limits: {
        Row: {
          attempts: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          ends_at: string | null
          expires_at: string | null
          first_order_only: boolean
          id: string
          is_active: boolean
          max_discount_amount: number | null
          min_item_quantity: number
          min_subtotal: number
          per_customer_limit: number
          priority: number
          public_label: string | null
          stackable: boolean
          starts_at: string | null
          status: Database["public"]["Enums"]["coupon_status"]
          total_usage_limit: number | null
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          ends_at?: string | null
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_item_quantity?: number
          min_subtotal?: number
          per_customer_limit?: number
          priority?: number
          public_label?: string | null
          stackable?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["coupon_status"]
          total_usage_limit?: number | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          ends_at?: string | null
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          min_item_quantity?: number
          min_subtotal?: number
          per_customer_limit?: number
          priority?: number
          public_label?: string | null
          stackable?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["coupon_status"]
          total_usage_limit?: number | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          code: string | null
          created_at: string
          exam_id: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          code?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string | null
          series_id: string
          starts_at: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id?: string | null
          series_id: string
          starts_at?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          series_id?: string
          starts_at?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "seller_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "test_series"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_visible: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_visible?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      free_sample_config: {
        Row: {
          description: string | null
          form_fields: Json
          id: string
          is_enabled: boolean
          sample_checked_sheet_path: string | null
          sample_paper_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          form_fields?: Json
          id?: string
          is_enabled?: boolean
          sample_checked_sheet_path?: string | null
          sample_paper_path?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          form_fields?: Json
          id?: string
          is_enabled?: boolean
          sample_checked_sheet_path?: string | null
          sample_paper_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      free_sample_settings: {
        Row: {
          checked_sheet_path: string | null
          form_fields: Json
          id: boolean
          is_enabled: boolean
          sample_paper_path: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          checked_sheet_path?: string | null
          form_fields?: Json
          id?: boolean
          is_enabled?: boolean
          sample_paper_path?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          checked_sheet_path?: string | null
          form_fields?: Json
          id?: boolean
          is_enabled?: boolean
          sample_paper_path?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          content: Json
          id: string
          is_visible: boolean
          section_key: string
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          id?: string
          is_visible?: boolean
          section_key: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          is_visible?: boolean
          section_key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          id: string
          invoice_number: string
          issued_at: string
          order_id: string | null
          pdf_path: string | null
          status: string
          student_id: string | null
          tax_amount: number
          total_amount: number
        }
        Insert: {
          amount?: number
          id?: string
          invoice_number: string
          issued_at?: string
          order_id?: string | null
          pdf_path?: string | null
          status?: string
          student_id?: string | null
          tax_amount?: number
          total_amount?: number
        }
        Update: {
          amount?: number
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string | null
          pdf_path?: string | null
          status?: string
          student_id?: string | null
          tax_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "seller_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          course: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          course?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt_text: string | null
          bucket: string
          created_at: string
          created_by: string | null
          id: string
          is_private: boolean
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          bucket: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_private?: boolean
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_private?: boolean
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: []
      }
      media_library: {
        Row: {
          bucket: string
          created_at: string
          created_by: string | null
          id: string
          mime_type: string | null
          name: string
          path: string
          size_bytes: number | null
        }
        Insert: {
          bucket: string
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          name: string
          path: string
          size_bytes?: number | null
        }
        Update: {
          bucket?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          path?: string
          size_bytes?: number | null
        }
        Relationships: []
      }
      mentorship_bookings: {
        Row: {
          created_at: string
          id: string
          meeting_url: string | null
          notes: string | null
          slot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_url?: string | null
          notes?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_url?: string | null
          notes?: string | null
          slot_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "mentorship_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_slots: {
        Row: {
          capacity: number
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          meeting_url: string | null
          mentor_name: string | null
          notes: string | null
          starts_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          meeting_url?: string | null
          mentor_name?: string | null
          notes?: string | null
          starts_at: string
        }
        Update: {
          capacity?: number
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          meeting_url?: string | null
          mentor_name?: string | null
          notes?: string | null
          starts_at?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          channel: string
          event_key: string
          id: string
          is_enabled: boolean
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          event_key: string
          id?: string
          is_enabled?: boolean
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          event_key?: string
          id?: string
          is_enabled?: boolean
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      offer_banners: {
        Row: {
          cta_label: string | null
          cta_url: string | null
          description: string | null
          end_at: string | null
          id: string
          is_enabled: boolean
          title: string
          updated_at: string
        }
        Insert: {
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          is_enabled?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          is_enabled?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      offer_settings: {
        Row: {
          end_at: string | null
          id: boolean
          is_enabled: boolean
          link: string | null
          text: string | null
          updated_at: string
        }
        Insert: {
          end_at?: string | null
          id?: boolean
          is_enabled?: boolean
          link?: string | null
          text?: string | null
          updated_at?: string
        }
        Update: {
          end_at?: string | null
          id?: boolean
          is_enabled?: boolean
          link?: string | null
          text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_discount_allocations: {
        Row: {
          coupon_id: string
          created_at: string
          discount_amount: number
          id: string
          order_id: string
          product_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_amount: number
          id?: string
          order_id: string
          product_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_discount_allocations_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discount_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_discount_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discount_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "seller_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discount_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_discount_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          order_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          order_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "seller_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_note: string | null
          amount: number
          available_on: string | null
          commission_amount: number | null
          commission_rate: number | null
          checkout_idempotency_key: string | null
          coupon_code: string | null
          coupon_discount: number
          courier_name: string | null
          courier_tracking_id: string | null
          courier_tracking_url: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_postal_code: string | null
          delivery_state: string | null
          dispatched_at: string | null
          email: string
          estimated_delivery: string | null
          full_name: string
          id: string
          inventory_deducted: boolean
          inventory_released: boolean
          inventory_reserved: boolean
          order_status: Database["public"]["Enums"]["order_status"]
          payment_gateway: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_share: number | null
          product_id: string | null
          product_title: string
          product_type: string
          quantity: number
          razorpay_creation_started_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature_verified_at: string | null
          razorpay_status: string
          refunded: boolean
          screenshot_path: string | null
          seller_id: string | null
          seller_share: number | null
          series_id: string | null
          status: string
          transaction_id: string | null
          user_id: string
          verified_at: string | null
          whatsapp: string
          whatsapp_sent_at: string | null
        }
        Insert: {
          admin_note?: string | null
          amount: number
          available_on?: string | null
          checkout_idempotency_key?: string | null
          coupon_code?: string | null
          coupon_discount?: number
          courier_name?: string | null
          courier_tracking_id?: string | null
          courier_tracking_url?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_postal_code?: string | null
          delivery_state?: string | null
          dispatched_at?: string | null
          email: string
          estimated_delivery?: string | null
          full_name: string
          id?: string
          inventory_deducted?: boolean
          inventory_released?: boolean
          inventory_reserved?: boolean
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_gateway?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_share?: number | null
          product_id?: string | null
          product_title: string
          product_type?: string
          quantity?: number
          razorpay_creation_started_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature_verified_at?: string | null
          razorpay_status?: string
          refunded?: boolean
          screenshot_path?: string | null
          seller_id?: string | null
          seller_share?: number | null
          series_id?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
          verified_at?: string | null
          whatsapp: string
          whatsapp_sent_at?: string | null
        }
        Update: {
          admin_note?: string | null
          amount?: number
          available_on?: string | null
          checkout_idempotency_key?: string | null
          coupon_code?: string | null
          coupon_discount?: number
          courier_name?: string | null
          courier_tracking_id?: string | null
          courier_tracking_url?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_postal_code?: string | null
          delivery_state?: string | null
          dispatched_at?: string | null
          email?: string
          estimated_delivery?: string | null
          full_name?: string
          id?: string
          inventory_deducted?: boolean
          inventory_released?: boolean
          inventory_reserved?: boolean
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_gateway?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_share?: number | null
          product_id?: string | null
          product_title?: string
          product_type?: string
          quantity?: number
          razorpay_creation_started_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature_verified_at?: string | null
          razorpay_status?: string
          refunded?: boolean
          screenshot_path?: string | null
          seller_id?: string | null
          seller_share?: number | null
          series_id?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
          verified_at?: string | null
          whatsapp?: string
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "test_series"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          admin_notes: string | null
          category_id: string | null
          course_id: string | null
          course_label: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          discounted_price: number | null
          exam_id: string | null
          format: string
          id: string
          is_active: boolean
          is_archived: boolean
          is_demo: boolean
          is_featured: boolean
          is_free: boolean
          keywords: string | null
          low_stock_threshold: number | null
          page_count: number | null
          pdf_file: string | null
          preview_file: string | null
          price: number
          product_type: string
          published_at: string | null
          rejection_reason: string | null
          review_feedback: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision_of: string | null
          seller_id: string | null
          seller_cover_source_url: string | null
          seller_rights_confirmed_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          stock_quantity: number
          stock_status: string
          subject_id: string | null
          subject_label: string | null
          submitted_at: string | null
          title: string
          updated_at: string
          whats_included: string | null
        }
        Insert: {
          admin_notes?: string | null
          category_id?: string | null
          course_id?: string | null
          course_label?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discounted_price?: number | null
          exam_id?: string | null
          format?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_demo?: boolean
          is_featured?: boolean
          is_free?: boolean
          keywords?: string | null
          low_stock_threshold?: number | null
          page_count?: number | null
          pdf_file?: string | null
          preview_file?: string | null
          price?: number
          product_type?: string
          published_at?: string | null
          rejection_reason?: string | null
          review_feedback?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_of?: string | null
          seller_id?: string | null
          seller_cover_source_url?: string | null
          seller_rights_confirmed_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          stock_quantity?: number
          stock_status?: string
          subject_id?: string | null
          subject_label?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string
          whats_included?: string | null
        }
        Update: {
          admin_notes?: string | null
          category_id?: string | null
          course_id?: string | null
          course_label?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discounted_price?: number | null
          exam_id?: string | null
          format?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_demo?: boolean
          is_featured?: boolean
          is_free?: boolean
          keywords?: string | null
          low_stock_threshold?: number | null
          page_count?: number | null
          pdf_file?: string | null
          preview_file?: string | null
          price?: number
          product_type?: string
          published_at?: string | null
          rejection_reason?: string | null
          review_feedback?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_of?: string | null
          seller_id?: string | null
          seller_cover_source_url?: string | null
          seller_rights_confirmed_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          stock_quantity?: number
          stock_status?: string
          subject_id?: string | null
          subject_label?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string
          whats_included?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_revision_of_fkey"
            columns: ["revision_of"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "products_revision_of_fkey"
            columns: ["revision_of"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      razorpay_refunds: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          id: string
          order_id: string
          razorpay_payment_id: string
          razorpay_refund_id: string | null
          reason: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          razorpay_payment_id: string
          razorpay_refund_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          razorpay_payment_id?: string
          razorpay_refund_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "razorpay_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "razorpay_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "razorpay_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "seller_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      razorpay_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: number
          processed_at: string | null
          processing_error: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: never
          processed_at?: string | null
          processing_error?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: never
          processed_at?: string | null
          processing_error?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          received_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_sample: boolean
          product_id: string
          rating: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          product_id: string
          rating: number
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          product_id?: string
          rating?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_steps: {
        Row: {
          created_at: string
          description: string
          icon: string | null
          id: string
          is_visible: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          bank_details: Json | null
          created_at: string
          education: string
          exams: string[]
          full_name: string
          id: string
          id_card_path: string | null
          pan_number: string | null
          profession: string
          qualification_proof_path: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: string
          upi_id: string
          user_id: string
        }
        Insert: {
          bank_details?: Json | null
          created_at?: string
          education: string
          exams?: string[]
          full_name: string
          id?: string
          id_card_path?: string | null
          pan_number?: string | null
          profession: string
          qualification_proof_path?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          upi_id: string
          user_id: string
        }
        Update: {
          bank_details?: Json | null
          created_at?: string
          education?: string
          exams?: string[]
          full_name?: string
          id?: string
          id_card_path?: string | null
          pan_number?: string | null
          profession?: string
          qualification_proof_path?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          upi_id?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_notifications: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string
          product_id: string | null
          read_at: string | null
          seller_id: string
          target_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message: string
          product_id?: string | null
          read_at?: string | null
          seller_id: string
          target_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          product_id?: string | null
          read_at?: string | null
          seller_id?: string
          target_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "my_library"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "seller_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          category: string | null
          is_public: boolean
          key: string
          sort_order: number
          updated_at: string
          value: string | null
        }
        Insert: {
          category?: string | null
          is_public?: boolean
          key: string
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Update: {
          category?: string | null
          is_public?: boolean
          key?: string
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          code: string | null
          course_id: string | null
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          code?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          code?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      test_series: {
        Row: {
          course: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_price: number | null
          features: Json
          id: string
          price: number
          slug: string
          sort_order: number
          status: string
          subject: string | null
          test_type: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          course: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_price?: number | null
          features?: Json
          id?: string
          price?: number
          slug: string
          sort_order?: number
          status?: string
          subject?: string | null
          test_type: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          course?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_price?: number | null
          features?: Json
          id?: string
          price?: number
          slug?: string
          sort_order?: number
          status?: string
          subject?: string | null
          test_type?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          course: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_visible: boolean
          name: string
          photo_url: string | null
          rating: number | null
          sort_order: number
          testimonial: string
          updated_at: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_visible?: boolean
          name: string
          photo_url?: string | null
          rating?: number | null
          sort_order?: number
          testimonial: string
          updated_at?: string
        }
        Update: {
          course?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_visible?: boolean
          name?: string
          photo_url?: string | null
          rating?: number | null
          sort_order?: number
          testimonial?: string
          updated_at?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          answer_key_path: string | null
          chapter: string | null
          created_at: string
          duration_minutes: number
          id: string
          is_free_sample: boolean
          marks: number
          question_paper_path: string | null
          release_at: string | null
          series_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          answer_key_path?: string | null
          chapter?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          is_free_sample?: boolean
          marks?: number
          question_paper_path?: string | null
          release_at?: string | null
          series_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          answer_key_path?: string | null
          chapter?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          is_free_sample?: boolean
          marks?: number
          question_paper_path?: string | null
          release_at?: string | null
          series_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "test_series"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_configs: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          secret: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          secret?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      why_revivor_cards: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          is_visible: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          icon?: string
          id?: string
          is_visible?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_visible?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number; id: string; paid_at: string | null; requested_at: string;
          seller_id: string; status: string; upi_reference: string | null; upi_id: string | null;
          processing_at: string | null; rejected_at: string | null; rejection_reason: string | null; idempotency_key: string | null;
        }
        Insert: {
          amount: number; id?: string; paid_at?: string | null; requested_at?: string; seller_id: string;
          status?: string; upi_reference?: string | null; upi_id?: string | null; processing_at?: string | null;
          rejected_at?: string | null; rejection_reason?: string | null; idempotency_key?: string | null;
        }
        Update: {
          amount?: number; id?: string; paid_at?: string | null; requested_at?: string; seller_id?: string;
          status?: string; upi_reference?: string | null; upi_id?: string | null; processing_at?: string | null;
          rejected_at?: string | null; rejection_reason?: string | null; idempotency_key?: string | null;
        }
        Relationships: []
      }
      seller_ledger: {
        Row: { id: string; seller_id: string; order_id: string | null; withdrawal_id: string | null; entry_type: string; amount: number; description: string; created_at: string }
        Insert: { id?: string; seller_id: string; order_id?: string | null; withdrawal_id?: string | null; entry_type: string; amount: number; description: string; created_at?: string }
        Update: { id?: string; seller_id?: string; order_id?: string | null; withdrawal_id?: string | null; entry_type?: string; amount?: number; description?: string; created_at?: string }
        Relationships: []
      }
      withdrawal_status_history: {
        Row: { id: string; withdrawal_id: string; from_status: string | null; to_status: string; changed_by: string | null; reason: string | null; created_at: string }
        Insert: { id?: string; withdrawal_id: string; from_status?: string | null; to_status: string; changed_by?: string | null; reason?: string | null; created_at?: string }
        Update: { id?: string; withdrawal_id?: string; from_status?: string | null; to_status?: string; changed_by?: string | null; reason?: string | null; created_at?: string }
        Relationships: []
      }
      marketplace_commission_settings: {
        Row: { id: number; commission_rate: number; updated_by: string | null; updated_at: string }
        Insert: { id?: number; commission_rate?: number; updated_by?: string | null; updated_at?: string }
        Update: { id?: number; commission_rate?: number; updated_by?: string | null; updated_at?: string }
        Relationships: []
      }
    }
    Views: {
      my_library: {
        Row: {
          amount: number | null
          cover_image: string | null
          delivered_at: string | null
          description: string | null
          format: string | null
          order_id: string | null
          page_count: number | null
          pdf_file: string | null
          product_id: string | null
          slug: string | null
          title: string | null
          verified_at: string | null
        }
        Relationships: []
      }
      seller_sales: {
        Row: {
          available_on: string | null
          buyer_first_name: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string | null
          id: string | null
          product_title: string | null
          refunded: boolean | null
          seller_share: number | null
        }
        Insert: {
          available_on?: string | null
          buyer_first_name?: never
          created_at?: string | null
          id?: string | null
          product_title?: string | null
          refunded?: boolean | null
          seller_share?: number | null
        }
        Update: {
          available_on?: string | null
          buyer_first_name?: never
          created_at?: string | null
          id?: string | null
          product_title?: string | null
          refunded?: boolean | null
          seller_share?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_cancel_physical_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      admin_delete_coupon: { Args: { p_coupon_id: string }; Returns: Json }
      admin_list_coupons: { Args: never; Returns: Json }
      admin_reset_dashboard: {
        Args: {
          p_actor_id: string
          p_ip_address: unknown
          p_user_agent: string
        }
        Returns: Json
      }
      admin_reset_guard: {
        Args: { p_actor_id: string; p_ip_address: unknown }
        Returns: boolean
      }
      admin_review_seller_application: {
        Args: {
          p_application_id: string
          p_rejection_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      admin_review_seller_product: {
        Args: {
          p_product_id: string
          p_review_feedback?: string
          p_status: string
        }
        Returns: undefined
      }
      admin_sales_stats: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      admin_save_coupon: {
        Args: { p_coupon: Json; p_coupon_id?: string; p_targets: Json }
        Returns: Json
      }
      admin_set_coupon_status: {
        Args: {
          p_coupon_id: string
          p_status: Database["public"]["Enums"]["coupon_status"]
        }
        Returns: Json
      }
      admin_set_withdrawal_status: {
        Args: {
          p_request_id: string
          p_status: string
          p_upi_reference?: string
        }
        Returns: undefined
      }
      admin_seller_wallets: { Args: never; Returns: { seller_id: string; full_name: string | null; email: string | null; verification_status: string; is_suspended: boolean; total_sales: number; lifetime_earnings: number; commission_deducted: number; pending_balance: number; released_earnings: number; pending_withdrawals: number; withdrawable_balance: number }[] }
      admin_set_seller_suspension: { Args: { p_seller_id: string; p_suspended: boolean; p_reason?: string | null }; Returns: undefined }
      admin_withdrawal_queue: { Args: never; Returns: Json }
      admin_get_marketplace_commission: { Args: never; Returns: { commission_rate: number; updated_at: string }[] }
      admin_transition_withdrawal: { Args: { p_request_id: string; p_status: string; p_reason?: string | null; p_upi_reference?: string | null }; Returns: undefined }
      admin_set_marketplace_commission: { Args: { p_rate: number }; Returns: undefined }
      seller_request_withdrawal: { Args: { p_amount: number; p_idempotency_key: string }; Returns: string }
      seller_update_upi: { Args: { p_upi_id: string }; Returns: undefined }
      seller_wallet_summary: { Args: never; Returns: Json }
      seller_withdrawal_history: { Args: never; Returns: Json }
      seller_wallet_upi: { Args: never; Returns: string | null }
      admin_update_physical_order_tracking: {
        Args: {
          p_courier_name?: string
          p_estimated_delivery?: string
          p_order_id: string
          p_status: string
          p_tracking_id?: string
          p_tracking_link?: string
        }
        Returns: Json
      }
      admin_upsert_product: {
        Args: { _payload: Json; _product_id: string }
        Returns: string
      }
      can_review_product: { Args: { p_product_id: string }; Returns: boolean }
      current_user_is_seller: { Args: never; Returns: boolean }
      get_my_physical_orders: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          estimated_delivery: string
          order_id: string
          product_title: string
          status: string
        }[]
      }
      get_physical_order_tracking: {
        Args: { p_order_id: string }
        Returns: Json
      }
      has_admin_role: {
        Args: { required_role: Database["public"]["Enums"]["admin_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_verified_purchase: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      is_admin_staff: { Args: never; Returns: boolean }
      reserve_razorpay_refund: {
        Args: {
          p_amount_paise: number
          p_order_id: string
          p_reason: string
          p_requested_by: string
        }
        Returns: {
          order_amount_paise: number
          order_razorpay_status: string
          payment_id: string
          refund_id: string
        }[]
      }
      seller_archive_or_delete_product: {
        Args: { p_product_id: string }
        Returns: string
      }
      seller_balance: {
        Args: { p_seller_id: string }
        Returns: {
          available_balance: number
          pending_balance: number
        }[]
      }
      seller_create_product: {
        Args: {
          p_title: string
          p_slug: string
          p_description: string
          p_exam_label: string
          p_subject_label: string
          p_price: number
          p_pdf_path: string
          p_preview_path?: string | null
          p_whats_included: string
          p_category_id: string | null
          p_page_count: number
          p_seller_cover_source_url: string | null
          p_rights_confirmed: boolean
        }
        Returns: string
      }
      seller_update_product: {
        Args: {
          p_product_id: string
          p_title: string
          p_slug: string
          p_description: string
          p_exam_label: string
          p_subject_label: string
          p_price: number
          p_pdf_path: string
          p_preview_path?: string | null
          p_whats_included: string
          p_category_id: string | null
          p_page_count: number
          p_seller_cover_source_url: string | null
          p_rights_confirmed: boolean
        }
        Returns: boolean
      }
      server_review_seller_application: {
        Args: {
          p_application_id: string
          p_rejection_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      strip_html_tags: { Args: { input: string }; Returns: string }
      transition_seller_product: {
        Args: {
          p_action: string
          p_admin_notes?: string
          p_product_id: string
          p_reason?: string
        }
        Returns: {
          admin_notes: string | null
          category_id: string | null
          course_id: string | null
          course_label: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          discounted_price: number | null
          exam_id: string | null
          format: string
          id: string
          is_active: boolean
          is_archived: boolean
          is_demo: boolean
          is_featured: boolean
          is_free: boolean
          keywords: string | null
          low_stock_threshold: number | null
          page_count: number | null
          pdf_file: string | null
          preview_file: string | null
          price: number
          product_type: string
          published_at: string | null
          rejection_reason: string | null
          review_feedback: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision_of: string | null
          seller_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          stock_quantity: number
          stock_status: string
          subject_id: string | null
          subject_label: string | null
          submitted_at: string | null
          title: string
          updated_at: string
          whats_included: string | null
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_coupon: {
        Args: { p_code: string; p_product_id: string; p_subtotal: number }
        Returns: Json
      }
    }
    Enums: {
      admin_role: "super_admin" | "content_manager" | "evaluator" | "support"
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "content_manager"
        | "evaluator"
        | "support"
      booking_status: "booked" | "completed" | "cancelled"
      coupon_discount_type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING"
      coupon_status: "DRAFT" | "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED"
      coupon_target_mode: "INCLUDE" | "EXCLUDE"
      coupon_target_type:
        | "PRODUCT"
        | "VARIANT"
        | "CATEGORY"
        | "BRAND"
        | "ALL_PRODUCTS"
      discount_type: "percent" | "flat"
      lead_status: "new" | "contacted" | "converted"
      order_status:
        | "pending_payment"
        | "payment_submitted"
        | "payment_verified"
        | "payment_rejected"
        | "processing"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "submitted" | "verified" | "rejected"
      sheet_status: "pending" | "assigned" | "checked"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      admin_role: ["super_admin", "content_manager", "evaluator", "support"],
      app_role: [
        "admin",
        "user",
        "super_admin",
        "content_manager",
        "evaluator",
        "support",
      ],
      booking_status: ["booked", "completed", "cancelled"],
      coupon_discount_type: ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"],
      coupon_status: ["DRAFT", "ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"],
      coupon_target_mode: ["INCLUDE", "EXCLUDE"],
      coupon_target_type: [
        "PRODUCT",
        "VARIANT",
        "CATEGORY",
        "BRAND",
        "ALL_PRODUCTS",
      ],
      discount_type: ["percent", "flat"],
      lead_status: ["new", "contacted", "converted"],
      order_status: [
        "pending_payment",
        "payment_submitted",
        "payment_verified",
        "payment_rejected",
        "processing",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "submitted", "verified", "rejected"],
      sheet_status: ["pending", "assigned", "checked"],
    },
  },
} as const
