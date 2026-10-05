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
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
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
      orders: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          delivered_at: string | null
          email: string
          full_name: string
          id: string
          order_status: Database["public"]["Enums"]["order_status"]
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string | null
          product_title: string
          screenshot_path: string | null
          transaction_id: string | null
          user_id: string
          verified_at: string | null
          whatsapp: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          delivered_at?: string | null
          email: string
          full_name: string
          id?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id?: string | null
          product_title: string
          screenshot_path?: string | null
          transaction_id?: string | null
          user_id: string
          verified_at?: string | null
          whatsapp: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          delivered_at?: string | null
          email?: string
          full_name?: string
          id?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id?: string | null
          product_title?: string
          screenshot_path?: string | null
          transaction_id?: string | null
          user_id?: string
          verified_at?: string | null
          whatsapp?: string
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
          category_id: string | null
          course_id: string | null
          course_label: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
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
          page_count: number | null
          pdf_file: string | null
          preview_file: string | null
          price: number
          slug: string
          subject_id: string | null
          subject_label: string | null
          title: string
          updated_at: string
          whats_included: string | null
        }
        Insert: {
          category_id?: string | null
          course_id?: string | null
          course_label?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
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
          page_count?: number | null
          pdf_file?: string | null
          preview_file?: string | null
          price?: number
          slug: string
          subject_id?: string | null
          subject_label?: string | null
          title: string
          updated_at?: string
          whats_included?: string | null
        }
        Update: {
          category_id?: string | null
          course_id?: string | null
          course_label?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
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
          page_count?: number | null
          pdf_file?: string | null
          preview_file?: string | null
          price?: number
          slug?: string
          subject_id?: string | null
          subject_label?: string | null
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
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          whatsapp?: string | null
        }
        Relationships: []
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
    }
    Functions: {
      admin_upsert_product: {
        Args: { _payload: Json; _product_id: string }
        Returns: string
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
      is_admin_staff: { Args: never; Returns: boolean }
      strip_html_tags: { Args: { input: string }; Returns: string }
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
