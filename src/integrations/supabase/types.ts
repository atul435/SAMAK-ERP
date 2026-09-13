export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string;
          body: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          employee_id: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          is_done: boolean;
          subject: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          activity_type?: string;
          body?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          employee_id?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          is_done?: boolean;
          subject: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          activity_type?: string;
          body?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          employee_id?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          is_done?: boolean;
          subject?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_interactions: {
        Row: {
          action_taken: string | null;
          answer: string | null;
          company_id: string | null;
          confidence: number | null;
          context: Json | null;
          created_at: string;
          id: string;
          question: string;
          user_id: string | null;
        };
        Insert: {
          action_taken?: string | null;
          answer?: string | null;
          company_id?: string | null;
          confidence?: number | null;
          context?: Json | null;
          created_at?: string;
          id?: string;
          question: string;
          user_id?: string | null;
        };
        Update: {
          action_taken?: string | null;
          answer?: string | null;
          company_id?: string | null;
          confidence?: number | null;
          context?: Json | null;
          created_at?: string;
          id?: string;
          question?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      approval_actions: {
        Row: {
          actor_name: string | null;
          actor_user_id: string | null;
          approval_request_id: string;
          created_at: string;
          from_state: Database["public"]["Enums"]["approval_state"] | null;
          id: string;
          note: string | null;
          to_state: Database["public"]["Enums"]["approval_state"];
        };
        Insert: {
          actor_name?: string | null;
          actor_user_id?: string | null;
          approval_request_id: string;
          created_at?: string;
          from_state?: Database["public"]["Enums"]["approval_state"] | null;
          id?: string;
          note?: string | null;
          to_state: Database["public"]["Enums"]["approval_state"];
        };
        Update: {
          actor_name?: string | null;
          actor_user_id?: string | null;
          approval_request_id?: string;
          created_at?: string;
          from_state?: Database["public"]["Enums"]["approval_state"] | null;
          id?: string;
          note?: string | null;
          to_state?: Database["public"]["Enums"]["approval_state"];
        };
        Relationships: [
          {
            foreignKeyName: "approval_actions_approval_request_id_fkey";
            columns: ["approval_request_id"];
            isOneToOne: false;
            referencedRelation: "approval_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_requests: {
        Row: {
          ai_assisted: boolean;
          amount: number | null;
          approver_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decision_note: string | null;
          entity_id: string | null;
          entity_label: string;
          entity_type: string;
          id: string;
          project_id: string | null;
          request_code: string;
          requested_by: string | null;
          state: Database["public"]["Enums"]["approval_state"];
          summary: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          ai_assisted?: boolean;
          amount?: number | null;
          approver_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          entity_id?: string | null;
          entity_label: string;
          entity_type: string;
          id?: string;
          project_id?: string | null;
          request_code: string;
          requested_by?: string | null;
          state?: Database["public"]["Enums"]["approval_state"];
          summary?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ai_assisted?: boolean;
          amount?: number | null;
          approver_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          entity_id?: string | null;
          entity_label?: string;
          entity_type?: string;
          id?: string;
          project_id?: string | null;
          request_code?: string;
          requested_by?: string | null;
          state?: Database["public"]["Enums"]["approval_state"];
          summary?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "approval_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_user_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          company_id: string | null;
          created_at: string;
          id: string;
          record_id: string | null;
          table_name: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          company_id?: string | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          company_id?: string | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      boq_items: {
        Row: {
          boq_id: string;
          created_at: string;
          created_by: string | null;
          description: string;
          gst_percent: number | null;
          id: string;
          item_kind: string;
          material_id: string | null;
          quantity: number;
          remarks: string | null;
          section_id: string | null;
          sort_order: number;
          specification: string | null;
          species_id: string | null;
          unit_rate: number;
          uom: string;
          updated_at: string;
          updated_by: string | null;
          wastage_percent: number;
        };
        Insert: {
          boq_id: string;
          created_at?: string;
          created_by?: string | null;
          description: string;
          gst_percent?: number | null;
          id?: string;
          item_kind?: string;
          material_id?: string | null;
          quantity?: number;
          remarks?: string | null;
          section_id?: string | null;
          sort_order?: number;
          specification?: string | null;
          species_id?: string | null;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
          wastage_percent?: number;
        };
        Update: {
          boq_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          gst_percent?: number | null;
          id?: string;
          item_kind?: string;
          material_id?: string | null;
          quantity?: number;
          remarks?: string | null;
          section_id?: string | null;
          sort_order?: number;
          specification?: string | null;
          species_id?: string | null;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
          wastage_percent?: number;
        };
        Relationships: [
          {
            foreignKeyName: "boq_items_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boq_items_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boq_items_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "boq_sections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boq_items_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
        ];
      };
      boq_sections: {
        Row: {
          boq_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          boq_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          boq_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "boq_sections_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
        ];
      };
      boqs: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"];
          boq_code: string;
          client_id: string | null;
          company_id: string;
          contingency_percent: number;
          created_at: string;
          created_by: string | null;
          design_id: string | null;
          id: string;
          is_archived: boolean;
          notes: string | null;
          overhead_percent: number;
          prepared_by: string | null;
          profit_percent: number;
          project_id: string | null;
          status: Database["public"]["Enums"]["record_status"];
          tax_percent: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          boq_code: string;
          client_id?: string | null;
          company_id: string;
          contingency_percent?: number;
          created_at?: string;
          created_by?: string | null;
          design_id?: string | null;
          id?: string;
          is_archived?: boolean;
          notes?: string | null;
          overhead_percent?: number;
          prepared_by?: string | null;
          profit_percent?: number;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          tax_percent?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          boq_code?: string;
          client_id?: string | null;
          company_id?: string;
          contingency_percent?: number;
          created_at?: string;
          created_by?: string | null;
          design_id?: string | null;
          id?: string;
          is_archived?: boolean;
          notes?: string | null;
          overhead_percent?: number;
          prepared_by?: string | null;
          profit_percent?: number;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          tax_percent?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "boqs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_design_id_fkey";
            columns: ["design_id"];
            isOneToOne: false;
            referencedRelation: "designs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_prepared_by_fkey";
            columns: ["prepared_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      client_contacts: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          designation: string | null;
          email: string | null;
          id: string;
          is_primary: boolean;
          name: string;
          phone: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          designation?: string | null;
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name: string;
          phone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          designation?: string | null;
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name?: string;
          phone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          city: string | null;
          client_code: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          gstin: string | null;
          id: string;
          is_archived: boolean;
          name: string;
          owner_employee_id: string | null;
          sector: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          client_code: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          gstin?: string | null;
          id?: string;
          is_archived?: boolean;
          name: string;
          owner_employee_id?: string | null;
          sector?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          client_code?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          gstin?: string | null;
          id?: string;
          is_archived?: boolean;
          name?: string;
          owner_employee_id?: string | null;
          sector?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_owner_employee_id_fkey";
            columns: ["owner_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          cin: string | null;
          city: string | null;
          code: string;
          country: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          gstin: string | null;
          id: string;
          is_active: boolean;
          legal_name: string | null;
          name: string;
          pan: string | null;
          state: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          cin?: string | null;
          city?: string | null;
          code: string;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          gstin?: string | null;
          id?: string;
          is_active?: boolean;
          legal_name?: string | null;
          name: string;
          pan?: string | null;
          state?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cin?: string | null;
          city?: string | null;
          code?: string;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          gstin?: string | null;
          id?: string;
          is_active?: boolean;
          legal_name?: string | null;
          name?: string;
          pan?: string | null;
          state?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          code: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          head_employee_id: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          code: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          head_employee_id?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          head_employee_id?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departments_head_fk";
            columns: ["head_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      design_plant_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          design_id: string;
          id: string;
          plant_size: string | null;
          quantity: number;
          remarks: string | null;
          spacing_mm: number | null;
          species_id: string;
          unit_rate: number;
          updated_at: string;
          updated_by: string | null;
          zone: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          design_id: string;
          id?: string;
          plant_size?: string | null;
          quantity?: number;
          remarks?: string | null;
          spacing_mm?: number | null;
          species_id: string;
          unit_rate?: number;
          updated_at?: string;
          updated_by?: string | null;
          zone?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          design_id?: string;
          id?: string;
          plant_size?: string | null;
          quantity?: number;
          remarks?: string | null;
          spacing_mm?: number | null;
          species_id?: string;
          unit_rate?: number;
          updated_at?: string;
          updated_by?: string | null;
          zone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "design_plant_items_design_id_fkey";
            columns: ["design_id"];
            isOneToOne: false;
            referencedRelation: "designs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "design_plant_items_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
        ];
      };
      design_revisions: {
        Row: {
          change_summary: string;
          created_at: string;
          created_by: string | null;
          design_id: string;
          drawing_url: string | null;
          id: string;
          issued_at: string;
          issued_by: string | null;
          revision_number: number;
        };
        Insert: {
          change_summary: string;
          created_at?: string;
          created_by?: string | null;
          design_id: string;
          drawing_url?: string | null;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          revision_number: number;
        };
        Update: {
          change_summary?: string;
          created_at?: string;
          created_by?: string | null;
          design_id?: string;
          drawing_url?: string | null;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          revision_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "design_revisions_design_id_fkey";
            columns: ["design_id"];
            isOneToOne: false;
            referencedRelation: "designs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "design_revisions_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      designs: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"];
          brief: string | null;
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          current_revision: number;
          design_code: string;
          design_type: string;
          designer_id: string | null;
          elevation_notes: string | null;
          elevation_url: string | null;
          id: string;
          is_archived: boolean;
          project_id: string | null;
          scale: string | null;
          site_plan_notes: string | null;
          site_plan_url: string | null;
          stage: string;
          status: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          brief?: string | null;
          client_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          current_revision?: number;
          design_code: string;
          design_type?: string;
          designer_id?: string | null;
          elevation_notes?: string | null;
          elevation_url?: string | null;
          id?: string;
          is_archived?: boolean;
          project_id?: string | null;
          scale?: string | null;
          site_plan_notes?: string | null;
          site_plan_url?: string | null;
          stage?: string;
          status?: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          brief?: string | null;
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          current_revision?: number;
          design_code?: string;
          design_type?: string;
          designer_id?: string | null;
          elevation_notes?: string | null;
          elevation_url?: string | null;
          id?: string;
          is_archived?: boolean;
          project_id?: string | null;
          scale?: string | null;
          site_plan_notes?: string | null;
          site_plan_url?: string | null;
          stage?: string;
          status?: Database["public"]["Enums"]["record_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "designs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "designs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "designs_designer_id_fkey";
            columns: ["designer_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "designs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          doc_type: string;
          entity_id: string | null;
          entity_type: string | null;
          file_name: string | null;
          file_url: string | null;
          id: string;
          is_archived: boolean;
          mime_type: string | null;
          project_id: string | null;
          size_bytes: number | null;
          status: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          doc_type?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          file_name?: string | null;
          file_url?: string | null;
          id?: string;
          is_archived?: boolean;
          mime_type?: string | null;
          project_id?: string | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          doc_type?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          file_name?: string | null;
          file_url?: string | null;
          id?: string;
          is_archived?: boolean;
          mime_type?: string | null;
          project_id?: string | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["record_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      employee_compensation: {
        Row: {
          allowances: number;
          bank_account_last4: string | null;
          basic: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          employee_id: string;
          esi_applicable: boolean;
          hra: number;
          id: string;
          monthly_gross: number;
          pf_applicable: boolean;
          remarks: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allowances?: number;
          bank_account_last4?: string | null;
          basic?: number;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          employee_id: string;
          esi_applicable?: boolean;
          hra?: number;
          id?: string;
          monthly_gross?: number;
          pf_applicable?: boolean;
          remarks?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allowances?: number;
          bank_account_last4?: string | null;
          basic?: number;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          employee_id?: string;
          esi_applicable?: boolean;
          hra?: number;
          id?: string;
          monthly_gross?: number;
          pf_applicable?: boolean;
          remarks?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employee_compensation_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_compensation_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          date_of_joining: string | null;
          department_id: string | null;
          designation: string | null;
          email: string;
          employee_code: string;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          primary_role: Database["public"]["Enums"]["app_role"];
          reports_to: string | null;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          date_of_joining?: string | null;
          department_id?: string | null;
          designation?: string | null;
          email: string;
          employee_code: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          primary_role?: Database["public"]["Enums"]["app_role"];
          reports_to?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          date_of_joining?: string | null;
          department_id?: string | null;
          designation?: string | null;
          email?: string;
          employee_code?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          primary_role?: Database["public"]["Enums"]["app_role"];
          reports_to?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_reports_to_fkey";
            columns: ["reports_to"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          approval_state: Database["public"]["Enums"]["approval_state"];
          bill_reference: string | null;
          category: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          employee_id: string | null;
          expense_code: string;
          expense_date: string;
          id: string;
          is_reimbursable: boolean;
          is_reimbursed: boolean;
          payment_mode: string;
          project_id: string | null;
          remarks: string | null;
          status: Database["public"]["Enums"]["record_status"];
          tax_amount: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string | null;
        };
        Insert: {
          amount?: number;
          approval_state?: Database["public"]["Enums"]["approval_state"];
          bill_reference?: string | null;
          category?: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string | null;
          expense_code: string;
          expense_date?: string;
          id?: string;
          is_reimbursable?: boolean;
          is_reimbursed?: boolean;
          payment_mode?: string;
          project_id?: string | null;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          tax_amount?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          amount?: number;
          approval_state?: Database["public"]["Enums"]["approval_state"];
          bill_reference?: string | null;
          category?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string | null;
          expense_code?: string;
          expense_date?: string;
          id?: string;
          is_reimbursable?: boolean;
          is_reimbursed?: boolean;
          payment_mode?: string;
          project_id?: string | null;
          remarks?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          tax_amount?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      goods_receipt_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          goods_receipt_id: string;
          id: string;
          purchase_order_item_id: string;
          quality_status: string;
          quantity_received: number;
          remarks: string | null;
          stock_movement_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          goods_receipt_id: string;
          id?: string;
          purchase_order_item_id: string;
          quality_status?: string;
          quantity_received?: number;
          remarks?: string | null;
          stock_movement_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          goods_receipt_id?: string;
          id?: string;
          purchase_order_item_id?: string;
          quality_status?: string;
          quantity_received?: number;
          remarks?: string | null;
          stock_movement_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey";
            columns: ["goods_receipt_id"];
            isOneToOne: false;
            referencedRelation: "goods_receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_purchase_order_item_id_fkey";
            columns: ["purchase_order_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipt_items_stock_movement_id_fkey";
            columns: ["stock_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
        ];
      };
      goods_receipts: {
        Row: {
          challan_reference: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          grn_code: string;
          id: string;
          purchase_order_id: string;
          received_by: string | null;
          received_date: string;
          remarks: string | null;
          store_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          challan_reference?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          grn_code: string;
          id?: string;
          purchase_order_id: string;
          received_by?: string | null;
          received_date?: string;
          remarks?: string | null;
          store_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          challan_reference?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          grn_code?: string;
          id?: string;
          purchase_order_id?: string;
          received_by?: string | null;
          received_date?: string;
          remarks?: string | null;
          store_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receipts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          boq_item_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          invoice_id: string;
          quantity: number;
          sort_order: number;
          unit_rate: number;
          uom: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          boq_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          invoice_id: string;
          quantity?: number;
          sort_order?: number;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          boq_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          invoice_id?: string;
          quantity?: number;
          sort_order?: number;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_item_execution";
            referencedColumns: ["boq_item_id"];
          },
          {
            foreignKeyName: "invoice_items_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          advance_adjusted: number;
          approval_state: Database["public"]["Enums"]["approval_state"];
          boq_id: string | null;
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          invoice_code: string;
          invoice_date: string;
          invoice_type: string;
          is_archived: boolean;
          notes: string | null;
          project_id: string | null;
          raised_by: string | null;
          retention_percent: number;
          status: Database["public"]["Enums"]["record_status"];
          tax_percent: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          advance_adjusted?: number;
          approval_state?: Database["public"]["Enums"]["approval_state"];
          boq_id?: string | null;
          client_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_code: string;
          invoice_date?: string;
          invoice_type?: string;
          is_archived?: boolean;
          notes?: string | null;
          project_id?: string | null;
          raised_by?: string | null;
          retention_percent?: number;
          status?: Database["public"]["Enums"]["record_status"];
          tax_percent?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          advance_adjusted?: number;
          approval_state?: Database["public"]["Enums"]["approval_state"];
          boq_id?: string | null;
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_code?: string;
          invoice_date?: string;
          invoice_type?: string;
          is_archived?: boolean;
          notes?: string | null;
          project_id?: string | null;
          raised_by?: string | null;
          retention_percent?: number;
          status?: Database["public"]["Enums"]["record_status"];
          tax_percent?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_raised_by_fkey";
            columns: ["raised_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      labour_attendance: {
        Row: {
          attendance_date: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          day_rate: number;
          headcount_planned: number;
          headcount_present: number;
          hours_worked: number;
          id: string;
          project_id: string;
          remarks: string | null;
          site_report_id: string | null;
          trade: string;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string | null;
        };
        Insert: {
          attendance_date?: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          day_rate?: number;
          headcount_planned?: number;
          headcount_present?: number;
          hours_worked?: number;
          id?: string;
          project_id: string;
          remarks?: string | null;
          site_report_id?: string | null;
          trade: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          attendance_date?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          day_rate?: number;
          headcount_planned?: number;
          headcount_present?: number;
          hours_worked?: number;
          id?: string;
          project_id?: string;
          remarks?: string | null;
          site_report_id?: string | null;
          trade?: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "labour_attendance_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "labour_attendance_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "labour_attendance_site_report_id_fkey";
            columns: ["site_report_id"];
            isOneToOne: false;
            referencedRelation: "site_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "labour_attendance_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          city: string | null;
          client_id: string | null;
          company_id: string;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string | null;
          estimated_value: number;
          id: string;
          is_archived: boolean;
          lead_code: string;
          next_action: string | null;
          next_action_date: string | null;
          owner_employee_id: string | null;
          score: number;
          source: string;
          stage: string;
          status: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          city?: string | null;
          client_id?: string | null;
          company_id: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          estimated_value?: number;
          id?: string;
          is_archived?: boolean;
          lead_code: string;
          next_action?: string | null;
          next_action_date?: string | null;
          owner_employee_id?: string | null;
          score?: number;
          source?: string;
          stage?: string;
          status?: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          city?: string | null;
          client_id?: string | null;
          company_id?: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          estimated_value?: number;
          id?: string;
          is_archived?: boolean;
          lead_code?: string;
          next_action?: string | null;
          next_action_date?: string | null;
          owner_employee_id?: string | null;
          score?: number;
          source?: string;
          stage?: string;
          status?: Database["public"]["Enums"]["record_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_owner_employee_id_fkey";
            columns: ["owner_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"];
          approver_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          days: number;
          decided_at: string | null;
          decision_note: string | null;
          employee_id: string;
          from_date: string;
          id: string;
          leave_type: string;
          reason: string | null;
          to_date: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          approver_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          days?: number;
          decided_at?: string | null;
          decision_note?: string | null;
          employee_id: string;
          from_date: string;
          id?: string;
          leave_type?: string;
          reason?: string | null;
          to_date: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          approver_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          days?: number;
          decided_at?: string | null;
          decision_note?: string | null;
          employee_id?: string;
          from_date?: string;
          id?: string;
          leave_type?: string;
          reason?: string | null;
          to_date?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      labour_productivity_norms: {
        Row: {
          activity_code: string;
          basis_notes: string | null;
          confidence: string | null;
          created_at: string;
          direct_mh_per_unit: number;
          id: string;
          internal_shift_mh: number | null;
          loading_mh: number | null;
          machine_hr_per_unit: number | null;
          machine_type: string | null;
          pit_bed: string | null;
          pit_bed_prep_mh: number | null;
          plant_backfill_mh: number | null;
          size_spec: string | null;
          stake_tie_mh: number | null;
          suggested_vehicle: string | null;
          supervisor_mh_per_unit: number;
          typical_weight_kg: number | null;
          units_per_day_2person_crew: number | null;
          unloading_mh: number | null;
          uom: string;
          updated_at: string;
          water_cleanup_mh: number | null;
          work_type: string;
        };
        Insert: {
          activity_code: string;
          basis_notes?: string | null;
          confidence?: string | null;
          created_at?: string;
          direct_mh_per_unit: number;
          id?: string;
          internal_shift_mh?: number | null;
          loading_mh?: number | null;
          machine_hr_per_unit?: number | null;
          machine_type?: string | null;
          pit_bed?: string | null;
          pit_bed_prep_mh?: number | null;
          plant_backfill_mh?: number | null;
          size_spec?: string | null;
          stake_tie_mh?: number | null;
          suggested_vehicle?: string | null;
          supervisor_mh_per_unit: number;
          typical_weight_kg?: number | null;
          units_per_day_2person_crew?: number | null;
          unloading_mh?: number | null;
          uom: string;
          updated_at?: string;
          water_cleanup_mh?: number | null;
          work_type: string;
        };
        Update: {
          activity_code?: string;
          basis_notes?: string | null;
          confidence?: string | null;
          created_at?: string;
          direct_mh_per_unit?: number;
          id?: string;
          internal_shift_mh?: number | null;
          loading_mh?: number | null;
          machine_hr_per_unit?: number | null;
          machine_type?: string | null;
          pit_bed?: string | null;
          pit_bed_prep_mh?: number | null;
          plant_backfill_mh?: number | null;
          size_spec?: string | null;
          stake_tie_mh?: number | null;
          suggested_vehicle?: string | null;
          supervisor_mh_per_unit?: number;
          typical_weight_kg?: number | null;
          units_per_day_2person_crew?: number | null;
          unloading_mh?: number | null;
          uom?: string;
          updated_at?: string;
          water_cleanup_mh?: number | null;
          work_type?: string;
        };
        Relationships: [];
      };
      pit_bed_norms: {
        Row: {
          application: string;
          code: string;
          created_at: string;
          dimension: string | null;
          excavation_m3: number | null;
          id: string;
          machine_hr: number | null;
          reference: string | null;
          starter_mh: number | null;
          updated_at: string;
        };
        Insert: {
          application: string;
          code: string;
          created_at?: string;
          dimension?: string | null;
          excavation_m3?: number | null;
          id?: string;
          machine_hr?: number | null;
          reference?: string | null;
          starter_mh?: number | null;
          updated_at?: string;
        };
        Update: {
          application?: string;
          code?: string;
          created_at?: string;
          dimension?: string | null;
          excavation_m3?: number | null;
          id?: string;
          machine_hr?: number | null;
          reference?: string | null;
          starter_mh?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_rates: {
        Row: {
          base_rate_per_trip: number;
          created_at: string;
          id: string;
          minimum_rate: number;
          payload_kg: number;
          rate_per_km: number;
          updated_at: string;
          use_case: string | null;
          vehicle: string;
          volume_m3: number | null;
        };
        Insert: {
          base_rate_per_trip: number;
          created_at?: string;
          id?: string;
          minimum_rate: number;
          payload_kg: number;
          rate_per_km: number;
          updated_at?: string;
          use_case?: string | null;
          vehicle: string;
          volume_m3?: number | null;
        };
        Update: {
          base_rate_per_trip?: number;
          created_at?: string;
          id?: string;
          minimum_rate?: number;
          payload_kg?: number;
          rate_per_km?: number;
          updated_at?: string;
          use_case?: string | null;
          vehicle?: string;
          volume_m3?: number | null;
        };
        Relationships: [];
      };
      cost_input_rates: {
        Row: {
          company_id: string;
          id: string;
          key: string;
          label: string;
          notes: string | null;
          unit: string | null;
          updated_at: string;
          value: number;
        };
        Insert: {
          company_id: string;
          id?: string;
          key: string;
          label: string;
          notes?: string | null;
          unit?: string | null;
          updated_at?: string;
          value: number;
        };
        Update: {
          company_id?: string;
          id?: string;
          key?: string;
          label?: string;
          notes?: string | null;
          unit?: string | null;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cost_input_rates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      materials: {
        Row: {
          category: string;
          code: string;
          created_at: string;
          created_by: string | null;
          gst_percent: number | null;
          hsn_code: string | null;
          id: string;
          is_active: boolean;
          name: string;
          standard_rate: number;
          uom: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          category: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          gst_percent?: number | null;
          hsn_code?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          standard_rate?: number;
          uom: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          category?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          gst_percent?: number | null;
          hsn_code?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          standard_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          category: string;
          company_id: string | null;
          created_at: string;
          employee_id: string | null;
          id: string;
          is_read: boolean;
          link: string | null;
          severity: string;
          title: string;
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          category?: string;
          company_id?: string | null;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          severity?: string;
          title: string;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          category?: string;
          company_id?: string | null;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          severity?: string;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      nursery_batches: {
        Row: {
          batch_code: string;
          boq_item_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          health_grade: string;
          id: string;
          is_archived: boolean;
          location: string | null;
          plant_size: string | null;
          pot_size: string | null;
          project_id: string | null;
          purchase_order_item_id: string | null;
          quantity_mortality: number;
          quantity_received: number;
          ready_date: string | null;
          received_date: string;
          remarks: string | null;
          species_id: string;
          store_id: string | null;
          unit_cost: number;
          uom: string;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string | null;
        };
        Insert: {
          batch_code: string;
          boq_item_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          health_grade?: string;
          id?: string;
          is_archived?: boolean;
          location?: string | null;
          plant_size?: string | null;
          pot_size?: string | null;
          project_id?: string | null;
          purchase_order_item_id?: string | null;
          quantity_mortality?: number;
          quantity_received?: number;
          ready_date?: string | null;
          received_date?: string;
          remarks?: string | null;
          species_id: string;
          store_id?: string | null;
          unit_cost?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          batch_code?: string;
          boq_item_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          health_grade?: string;
          id?: string;
          is_archived?: boolean;
          location?: string | null;
          plant_size?: string | null;
          pot_size?: string | null;
          project_id?: string | null;
          purchase_order_item_id?: string | null;
          quantity_mortality?: number;
          quantity_received?: number;
          ready_date?: string | null;
          received_date?: string;
          remarks?: string | null;
          species_id?: string;
          store_id?: string | null;
          unit_cost?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nursery_batches_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_item_execution";
            referencedColumns: ["boq_item_id"];
          },
          {
            foreignKeyName: "nursery_batches_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nursery_batches_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nursery_batches_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nursery_batches_purchase_order_item_id_fkey";
            columns: ["purchase_order_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nursery_batches_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nursery_batches_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nursery_batches_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          client_id: string | null;
          company_id: string;
          competitor: string | null;
          created_at: string;
          created_by: string | null;
          expected_close_date: string | null;
          id: string;
          is_archived: boolean;
          lead_id: string | null;
          opportunity_code: string;
          owner_employee_id: string | null;
          probability: number;
          stage: string;
          status: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at: string;
          updated_by: string | null;
          value: number;
        };
        Insert: {
          client_id?: string | null;
          company_id: string;
          competitor?: string | null;
          created_at?: string;
          created_by?: string | null;
          expected_close_date?: string | null;
          id?: string;
          is_archived?: boolean;
          lead_id?: string | null;
          opportunity_code: string;
          owner_employee_id?: string | null;
          probability?: number;
          stage?: string;
          status?: Database["public"]["Enums"]["record_status"];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: number;
        };
        Update: {
          client_id?: string | null;
          company_id?: string;
          competitor?: string | null;
          created_at?: string;
          created_by?: string | null;
          expected_close_date?: string | null;
          id?: string;
          is_archived?: boolean;
          lead_id?: string | null;
          opportunity_code?: string;
          owner_employee_id?: string | null;
          probability?: number;
          stage?: string;
          status?: Database["public"]["Enums"]["record_status"];
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_owner_employee_id_fkey";
            columns: ["owner_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          direction: string;
          id: string;
          invoice_id: string | null;
          mode: string;
          paid_on: string;
          payment_code: string;
          project_id: string | null;
          purchase_order_id: string | null;
          reference: string | null;
          remarks: string | null;
          tds_amount: number;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string | null;
        };
        Insert: {
          amount?: number;
          client_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          direction?: string;
          id?: string;
          invoice_id?: string | null;
          mode?: string;
          paid_on?: string;
          payment_code: string;
          project_id?: string | null;
          purchase_order_id?: string | null;
          reference?: string | null;
          remarks?: string | null;
          tds_amount?: number;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          amount?: number;
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          direction?: string;
          id?: string;
          invoice_id?: string | null;
          mode?: string;
          paid_on?: string;
          payment_code?: string;
          project_id?: string | null;
          purchase_order_id?: string | null;
          reference?: string | null;
          remarks?: string | null;
          tds_amount?: number;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_items: {
        Row: {
          allowances: number;
          basic: number;
          created_at: string;
          created_by: string | null;
          days_present: number;
          employee_id: string;
          esi_deduction: number;
          hra: number;
          id: string;
          other_deduction: number;
          overtime: number;
          payroll_run_id: string;
          pf_deduction: number;
          project_id: string | null;
          remarks: string | null;
          tds_deduction: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allowances?: number;
          basic?: number;
          created_at?: string;
          created_by?: string | null;
          days_present?: number;
          employee_id: string;
          esi_deduction?: number;
          hra?: number;
          id?: string;
          other_deduction?: number;
          overtime?: number;
          payroll_run_id: string;
          pf_deduction?: number;
          project_id?: string | null;
          remarks?: string | null;
          tds_deduction?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allowances?: number;
          basic?: number;
          created_at?: string;
          created_by?: string | null;
          days_present?: number;
          employee_id?: string;
          esi_deduction?: number;
          hra?: number;
          id?: string;
          other_deduction?: number;
          overtime?: number;
          payroll_run_id?: string;
          pf_deduction?: number;
          project_id?: string | null;
          remarks?: string | null;
          tds_deduction?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey";
            columns: ["payroll_run_id"];
            isOneToOne: false;
            referencedRelation: "payroll_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_runs: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"];
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          period_month: string;
          prepared_by: string | null;
          run_code: string;
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
          updated_by: string | null;
          working_days: number;
        };
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          period_month: string;
          prepared_by?: string | null;
          run_code: string;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
          working_days?: number;
        };
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          period_month?: string;
          prepared_by?: string | null;
          run_code?: string;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
          working_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_runs_prepared_by_fkey";
            columns: ["prepared_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      plant_care_schedules: {
        Row: {
          created_at: string;
          created_by: string | null;
          frequency_days: number;
          id: string;
          instruction: string;
          season: string;
          species_id: string;
          task_type: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          frequency_days?: number;
          id?: string;
          instruction: string;
          season?: string;
          species_id: string;
          task_type: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          frequency_days?: number;
          id?: string;
          instruction?: string;
          season?: string;
          species_id?: string;
          task_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plant_care_schedules_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
        ];
      };
      plant_health_checks: {
        Row: {
          action_taken: string | null;
          batch_id: string | null;
          check_date: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          healthy_count: number;
          id: string;
          inspected_by: string | null;
          issue: string | null;
          project_id: string | null;
          sample_size: number;
          severity: string;
          species_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          action_taken?: string | null;
          batch_id?: string | null;
          check_date?: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          healthy_count?: number;
          id?: string;
          inspected_by?: string | null;
          issue?: string | null;
          project_id?: string | null;
          sample_size?: number;
          severity?: string;
          species_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          action_taken?: string | null;
          batch_id?: string | null;
          check_date?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          healthy_count?: number;
          id?: string;
          inspected_by?: string | null;
          issue?: string | null;
          project_id?: string | null;
          sample_size?: number;
          severity?: string;
          species_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plant_health_checks_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "nursery_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plant_health_checks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plant_health_checks_inspected_by_fkey";
            columns: ["inspected_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plant_health_checks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plant_health_checks_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
        ];
      };
      plant_species: {
        Row: {
          ai_design_tags: string[] | null;
          arid_nw_fit: number | null;
          botanical_name: string;
          canopy_form: string | null;
          category: string;
          climate_type: string | null;
          coastal_south_fit: number | null;
          common_name: string;
          created_at: string;
          created_by: string | null;
          data_confidence: string | null;
          deccan_plateau_fit: number | null;
          delhi_ncr_fit: number | null;
          drought_tolerance: number | null;
          east_ne_humid_fit: number | null;
          ecological_value: string | null;
          family: string | null;
          fauna_value: string | null;
          fertilizer_requirement: string | null;
          flower_colour: string | null;
          flowering_months: string | null;
          frost_tolerance: number | null;
          growth_rate: string | null;
          habit: string | null;
          heat_tolerance: number | null;
          gst_percent: number | null;
          himalayan_foothills_fit: number | null;
          hsn_code: string | null;
          id: string;
          indicative_buy_price: number | null;
          indicative_sell_price: number | null;
          irrigation_hydrozone: string | null;
          landscape_uses: string[] | null;
          lifespan: string | null;
          local_name: string | null;
          maintenance_level: string | null;
          coverage_notes: string | null;
          default_wastage_percent: number | null;
          design_coverage_per_plant_m2: number | null;
          install_rate: number | null;
          mature_canopy_area_m2: number | null;
          mature_height_m: number | null;
          mature_spread_m: number | null;
          native_region: string | null;
          planting_method: string | null;
          plants_per_m2: number | null;
          plants_per_rm: number | null;
          selected_spacing_m: number | null;
          native_status: string | null;
          notes: string | null;
          nursery_spec: string | null;
          plant_code: string | null;
          planting_season: string | null;
          pollinator_value: string | null;
          pollution_tolerance: number | null;
          pot_bag_size: string | null;
          primary_sources: string | null;
          pruning_requirement: string | null;
          recommended_spacing: string | null;
          root_risk_notes: string | null;
          salinity_tolerance: number | null;
          samak_field_rating: number | null;
          samak_preferred: string | null;
          soil_ph: string | null;
          soil_type: string | null;
          standard_height_girth: string | null;
          subcategory: string | null;
          sunlight: string | null;
          temperate_hills_fit: number | null;
          toxicity_notes: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_status: string | null;
          water_need: string | null;
          western_coast_fit: number | null;
        };
        Insert: {
          ai_design_tags?: string[] | null;
          arid_nw_fit?: number | null;
          botanical_name: string;
          canopy_form?: string | null;
          category: string;
          climate_type?: string | null;
          coastal_south_fit?: number | null;
          common_name: string;
          created_at?: string;
          created_by?: string | null;
          data_confidence?: string | null;
          deccan_plateau_fit?: number | null;
          delhi_ncr_fit?: number | null;
          drought_tolerance?: number | null;
          east_ne_humid_fit?: number | null;
          ecological_value?: string | null;
          family?: string | null;
          fauna_value?: string | null;
          fertilizer_requirement?: string | null;
          flower_colour?: string | null;
          flowering_months?: string | null;
          frost_tolerance?: number | null;
          growth_rate?: string | null;
          habit?: string | null;
          heat_tolerance?: number | null;
          gst_percent?: number | null;
          himalayan_foothills_fit?: number | null;
          hsn_code?: string | null;
          id?: string;
          indicative_buy_price?: number | null;
          indicative_sell_price?: number | null;
          irrigation_hydrozone?: string | null;
          landscape_uses?: string[] | null;
          lifespan?: string | null;
          local_name?: string | null;
          maintenance_level?: string | null;
          coverage_notes?: string | null;
          default_wastage_percent?: number | null;
          design_coverage_per_plant_m2?: number | null;
          install_rate?: number | null;
          mature_canopy_area_m2?: number | null;
          mature_height_m?: number | null;
          mature_spread_m?: number | null;
          native_region?: string | null;
          planting_method?: string | null;
          plants_per_m2?: number | null;
          plants_per_rm?: number | null;
          selected_spacing_m?: number | null;
          native_status?: string | null;
          notes?: string | null;
          nursery_spec?: string | null;
          plant_code?: string | null;
          planting_season?: string | null;
          pollinator_value?: string | null;
          pollution_tolerance?: number | null;
          pot_bag_size?: string | null;
          primary_sources?: string | null;
          pruning_requirement?: string | null;
          recommended_spacing?: string | null;
          root_risk_notes?: string | null;
          salinity_tolerance?: number | null;
          samak_field_rating?: number | null;
          samak_preferred?: string | null;
          soil_ph?: string | null;
          soil_type?: string | null;
          standard_height_girth?: string | null;
          subcategory?: string | null;
          sunlight?: string | null;
          temperate_hills_fit?: number | null;
          toxicity_notes?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string | null;
          water_need?: string | null;
          western_coast_fit?: number | null;
        };
        Update: {
          ai_design_tags?: string[] | null;
          arid_nw_fit?: number | null;
          botanical_name?: string;
          canopy_form?: string | null;
          category?: string;
          climate_type?: string | null;
          coastal_south_fit?: number | null;
          common_name?: string;
          created_at?: string;
          created_by?: string | null;
          data_confidence?: string | null;
          deccan_plateau_fit?: number | null;
          delhi_ncr_fit?: number | null;
          drought_tolerance?: number | null;
          east_ne_humid_fit?: number | null;
          ecological_value?: string | null;
          family?: string | null;
          fauna_value?: string | null;
          fertilizer_requirement?: string | null;
          flower_colour?: string | null;
          flowering_months?: string | null;
          frost_tolerance?: number | null;
          growth_rate?: string | null;
          habit?: string | null;
          heat_tolerance?: number | null;
          gst_percent?: number | null;
          himalayan_foothills_fit?: number | null;
          hsn_code?: string | null;
          id?: string;
          indicative_buy_price?: number | null;
          indicative_sell_price?: number | null;
          irrigation_hydrozone?: string | null;
          landscape_uses?: string[] | null;
          lifespan?: string | null;
          local_name?: string | null;
          maintenance_level?: string | null;
          coverage_notes?: string | null;
          default_wastage_percent?: number | null;
          design_coverage_per_plant_m2?: number | null;
          install_rate?: number | null;
          mature_canopy_area_m2?: number | null;
          mature_height_m?: number | null;
          mature_spread_m?: number | null;
          native_region?: string | null;
          planting_method?: string | null;
          plants_per_m2?: number | null;
          plants_per_rm?: number | null;
          selected_spacing_m?: number | null;
          native_status?: string | null;
          notes?: string | null;
          nursery_spec?: string | null;
          plant_code?: string | null;
          planting_season?: string | null;
          pollinator_value?: string | null;
          pollution_tolerance?: number | null;
          pot_bag_size?: string | null;
          primary_sources?: string | null;
          pruning_requirement?: string | null;
          recommended_spacing?: string | null;
          root_risk_notes?: string | null;
          salinity_tolerance?: number | null;
          samak_field_rating?: number | null;
          samak_preferred?: string | null;
          soil_ph?: string | null;
          soil_type?: string | null;
          standard_height_girth?: string | null;
          subcategory?: string | null;
          sunlight?: string | null;
          temperate_hills_fit?: number | null;
          toxicity_notes?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_status?: string | null;
          water_need?: string | null;
          western_coast_fit?: number | null;
        };
        Relationships: [];
      };
      plantings: {
        Row: {
          batch_id: string;
          boq_item_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          planted_on: string;
          project_id: string;
          quantity: number;
          remarks: string | null;
          site_report_id: string | null;
          species_id: string;
          updated_at: string;
          updated_by: string | null;
          zone: string | null;
        };
        Insert: {
          batch_id: string;
          boq_item_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          planted_on?: string;
          project_id: string;
          quantity?: number;
          remarks?: string | null;
          site_report_id?: string | null;
          species_id: string;
          updated_at?: string;
          updated_by?: string | null;
          zone?: string | null;
        };
        Update: {
          batch_id?: string;
          boq_item_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          planted_on?: string;
          project_id?: string;
          quantity?: number;
          remarks?: string | null;
          site_report_id?: string | null;
          species_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          zone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plantings_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "nursery_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantings_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_item_execution";
            referencedColumns: ["boq_item_id"];
          },
          {
            foreignKeyName: "plantings_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantings_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantings_site_report_id_fkey";
            columns: ["site_report_id"];
            isOneToOne: false;
            referencedRelation: "site_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plantings_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_users: {
        Row: {
          client_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          designation: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          portal_type: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
          vendor_id: string | null;
        };
        Insert: {
          client_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          designation?: string | null;
          email: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          portal_type: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          client_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          designation?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          portal_type?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portal_users_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_users_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_users_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          created_at: string;
          employee_id: string;
          id: string;
          project_id: string;
          role_on_project: string;
        };
        Insert: {
          created_at?: string;
          employee_id: string;
          id?: string;
          project_id: string;
          role_on_project?: string;
        };
        Update: {
          created_at?: string;
          employee_id?: string;
          id?: string;
          project_id?: string;
          role_on_project?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          actual_cost: number;
          area_sqm: number | null;
          billed_amount: number;
          budget_cost: number;
          city: string | null;
          client_id: string | null;
          collected_amount: number;
          committed_cost: number;
          company_id: string;
          contract_value: number;
          created_at: string;
          created_by: string | null;
          end_date: string | null;
          health: string;
          id: string;
          is_archived: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          opportunity_id: string | null;
          progress_percent: number;
          project_code: string;
          project_manager_id: string | null;
          project_type: string;
          start_date: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          actual_cost?: number;
          area_sqm?: number | null;
          billed_amount?: number;
          budget_cost?: number;
          city?: string | null;
          client_id?: string | null;
          collected_amount?: number;
          committed_cost?: number;
          company_id: string;
          contract_value?: number;
          created_at?: string;
          created_by?: string | null;
          end_date?: string | null;
          health?: string;
          id?: string;
          is_archived?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          opportunity_id?: string | null;
          progress_percent?: number;
          project_code: string;
          project_manager_id?: string | null;
          project_type?: string;
          start_date?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          actual_cost?: number;
          area_sqm?: number | null;
          billed_amount?: number;
          budget_cost?: number;
          city?: string | null;
          client_id?: string | null;
          collected_amount?: number;
          committed_cost?: number;
          company_id?: string;
          contract_value?: number;
          created_at?: string;
          created_by?: string | null;
          end_date?: string | null;
          health?: string;
          id?: string;
          is_archived?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          opportunity_id?: string | null;
          progress_percent?: number;
          project_code?: string;
          project_manager_id?: string | null;
          project_type?: string;
          start_date?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_project_manager_id_fkey";
            columns: ["project_manager_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_items: {
        Row: {
          boq_item_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          material_id: string | null;
          purchase_order_id: string;
          quantity: number;
          received_quantity: number;
          remarks: string | null;
          sort_order: number;
          species_id: string | null;
          unit_rate: number;
          uom: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          boq_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          material_id?: string | null;
          purchase_order_id: string;
          quantity?: number;
          received_quantity?: number;
          remarks?: string | null;
          sort_order?: number;
          species_id?: string | null;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          boq_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          material_id?: string | null;
          purchase_order_id?: string;
          quantity?: number;
          received_quantity?: number;
          remarks?: string | null;
          sort_order?: number;
          species_id?: string | null;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_item_execution";
            referencedColumns: ["boq_item_id"];
          },
          {
            foreignKeyName: "purchase_order_items_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"];
          approver_id: string | null;
          boq_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          delivery_address: string | null;
          expected_date: string | null;
          freight_amount: number;
          id: string;
          is_archived: boolean;
          notes: string | null;
          po_code: string;
          project_id: string | null;
          requested_by: string | null;
          status: Database["public"]["Enums"]["record_status"];
          tax_percent: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string | null;
        };
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          approver_id?: string | null;
          boq_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          delivery_address?: string | null;
          expected_date?: string | null;
          freight_amount?: number;
          id?: string;
          is_archived?: boolean;
          notes?: string | null;
          po_code: string;
          project_id?: string | null;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          tax_percent?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          approver_id?: string | null;
          boq_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          delivery_address?: string | null;
          expected_date?: string | null;
          freight_amount?: number;
          id?: string;
          is_archived?: boolean;
          notes?: string | null;
          po_code?: string;
          project_id?: string | null;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          tax_percent?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          action: string;
          id: string;
          module: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          action: string;
          id?: string;
          module: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          action?: string;
          id?: string;
          module?: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      site_photos: {
        Row: {
          caption: string | null;
          category: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          file_url: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          project_id: string;
          site_report_id: string | null;
          storage_path: string | null;
          taken_at: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          caption?: string | null;
          category?: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          file_url?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          project_id: string;
          site_report_id?: string | null;
          storage_path?: string | null;
          taken_at?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          caption?: string | null;
          category?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          file_url?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          project_id?: string;
          site_report_id?: string | null;
          storage_path?: string | null;
          taken_at?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "site_photos_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_photos_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_photos_site_report_id_fkey";
            columns: ["site_report_id"];
            isOneToOne: false;
            referencedRelation: "site_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      site_report_items: {
        Row: {
          boq_item_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          quantity_done: number;
          quantity_planned: number;
          remarks: string | null;
          site_report_id: string;
          sort_order: number;
          uom: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          boq_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          quantity_done?: number;
          quantity_planned?: number;
          remarks?: string | null;
          site_report_id: string;
          sort_order?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          boq_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          quantity_done?: number;
          quantity_planned?: number;
          remarks?: string | null;
          site_report_id?: string;
          sort_order?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "site_report_items_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_item_execution";
            referencedColumns: ["boq_item_id"];
          },
          {
            foreignKeyName: "site_report_items_boq_item_id_fkey";
            columns: ["boq_item_id"];
            isOneToOne: false;
            referencedRelation: "boq_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_report_items_site_report_id_fkey";
            columns: ["site_report_id"];
            isOneToOne: false;
            referencedRelation: "site_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      site_reports: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"];
          blockers: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_archived: boolean;
          latitude: number | null;
          location_accuracy_m: number | null;
          longitude: number | null;
          planned_next: string | null;
          progress_percent: number;
          project_id: string;
          report_date: string;
          reported_by: string | null;
          status: Database["public"]["Enums"]["record_status"];
          temperature_c: number | null;
          updated_at: string;
          updated_by: string | null;
          weather: string;
          work_done: string;
        };
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          blockers?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_archived?: boolean;
          latitude?: number | null;
          location_accuracy_m?: number | null;
          longitude?: number | null;
          planned_next?: string | null;
          progress_percent?: number;
          project_id: string;
          report_date?: string;
          reported_by?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          temperature_c?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          weather?: string;
          work_done?: string;
        };
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state"];
          blockers?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_archived?: boolean;
          latitude?: number | null;
          location_accuracy_m?: number | null;
          longitude?: number | null;
          planned_next?: string | null;
          progress_percent?: number;
          project_id?: string;
          report_date?: string;
          reported_by?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          temperature_c?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          weather?: string;
          work_done?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_reports_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_reports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_reports_reported_by_fkey";
            columns: ["reported_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          material_id: string | null;
          moved_at: string;
          movement_type: string;
          project_id: string | null;
          purchase_order_item_id: string | null;
          quantity: number;
          reference: string | null;
          remarks: string | null;
          species_id: string | null;
          store_id: string;
          unit_rate: number;
          uom: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          material_id?: string | null;
          moved_at?: string;
          movement_type?: string;
          project_id?: string | null;
          purchase_order_item_id?: string | null;
          quantity?: number;
          reference?: string | null;
          remarks?: string | null;
          species_id?: string | null;
          store_id: string;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          material_id?: string | null;
          moved_at?: string;
          movement_type?: string;
          project_id?: string | null;
          purchase_order_item_id?: string | null;
          quantity?: number;
          reference?: string | null;
          remarks?: string | null;
          species_id?: string | null;
          store_id?: string;
          unit_rate?: number;
          uom?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_purchase_order_item_id_fkey";
            columns: ["purchase_order_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "plant_species";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          code: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          location: string | null;
          name: string;
          project_id: string | null;
          store_type: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          code: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          name: string;
          project_id?: string | null;
          store_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          name?: string;
          project_id?: string | null;
          store_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stores_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stores_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      tenders: {
        Row: {
          closing_on: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          estimated_value: number | null;
          id: string;
          is_archived: boolean;
          is_starred: boolean;
          keyword_matched: string | null;
          location: string | null;
          notes: string | null;
          organisation: string;
          project_id: string | null;
          published_on: string | null;
          reviewed_by: string | null;
          source_name: string | null;
          source_url: string | null;
          state: string | null;
          status: string;
          tender_ref: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          closing_on?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          estimated_value?: number | null;
          id?: string;
          is_archived?: boolean;
          is_starred?: boolean;
          keyword_matched?: string | null;
          location?: string | null;
          notes?: string | null;
          organisation: string;
          project_id?: string | null;
          published_on?: string | null;
          reviewed_by?: string | null;
          source_name?: string | null;
          source_url?: string | null;
          state?: string | null;
          status?: string;
          tender_ref: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          closing_on?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          estimated_value?: number | null;
          id?: string;
          is_archived?: boolean;
          is_starred?: boolean;
          keyword_matched?: string | null;
          location?: string | null;
          notes?: string | null;
          organisation?: string;
          project_id?: string | null;
          published_on?: string | null;
          reviewed_by?: string | null;
          source_name?: string | null;
          source_url?: string | null;
          state?: string | null;
          status?: string;
          tender_ref?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenders_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenders_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          company_id: string | null;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_bills: {
        Row: {
          attachment_url: string | null;
          bill_date: string;
          bill_number: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          notes: string | null;
          project_id: string | null;
          purchase_order_id: string | null;
          review_notes: string | null;
          review_state: Database["public"]["Enums"]["approval_state"];
          reviewed_by: string | null;
          tax_percent: number;
          taxable_amount: number;
          total_amount: number;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string;
        };
        Insert: {
          attachment_url?: string | null;
          bill_date?: string;
          bill_number: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          project_id?: string | null;
          purchase_order_id?: string | null;
          review_notes?: string | null;
          review_state?: Database["public"]["Enums"]["approval_state"];
          reviewed_by?: string | null;
          tax_percent?: number;
          taxable_amount?: number;
          total_amount?: number;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id: string;
        };
        Update: {
          attachment_url?: string | null;
          bill_date?: string;
          bill_number?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          project_id?: string | null;
          purchase_order_id?: string | null;
          review_notes?: string | null;
          review_state?: Database["public"]["Enums"]["approval_state"];
          reviewed_by?: string | null;
          tax_percent?: number;
          taxable_amount?: number;
          total_amount?: number;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_bills_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_bills_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_bills_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_bills_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_bills_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_receipts: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          mode: string;
          notes: string | null;
          payment_id: string | null;
          receipt_date: string;
          receipt_number: string | null;
          reference: string | null;
          updated_at: string;
          updated_by: string | null;
          vendor_bill_id: string | null;
          vendor_id: string;
        };
        Insert: {
          amount?: number;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mode?: string;
          notes?: string | null;
          payment_id?: string | null;
          receipt_date?: string;
          receipt_number?: string | null;
          reference?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vendor_bill_id?: string | null;
          vendor_id: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mode?: string;
          notes?: string | null;
          payment_id?: string | null;
          receipt_date?: string;
          receipt_number?: string | null;
          reference?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vendor_bill_id?: string | null;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_receipts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_receipts_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_receipts_vendor_bill_id_fkey";
            columns: ["vendor_bill_id"];
            isOneToOne: false;
            referencedRelation: "vendor_bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_receipts_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_bank_details: {
        Row: {
          account_number: string | null;
          bank_name: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          ifsc: string | null;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string;
        };
        Insert: {
          account_number?: string | null;
          bank_name?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          ifsc?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id: string;
        };
        Update: {
          account_number?: string | null;
          bank_name?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          ifsc?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_bank_details_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_bank_details_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: true;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_registrations: {
        Row: {
          account_number: string | null;
          address: string | null;
          bank_name: string | null;
          business_name: string;
          category: string;
          city: string | null;
          company_id: string;
          contact_name: string;
          created_at: string;
          email: string;
          gstin: string | null;
          id: string;
          ifsc: string | null;
          notes: string | null;
          pan: string | null;
          payment_terms: string | null;
          phone: string;
          review_notes: string | null;
          review_state: Database["public"]["Enums"]["approval_state"];
          reviewed_by: string | null;
          state: string | null;
          supplies: string | null;
          updated_at: string;
          vendor_id: string | null;
        };
        Insert: {
          account_number?: string | null;
          address?: string | null;
          bank_name?: string | null;
          business_name: string;
          category?: string;
          city?: string | null;
          company_id: string;
          contact_name: string;
          created_at?: string;
          email: string;
          gstin?: string | null;
          id?: string;
          ifsc?: string | null;
          notes?: string | null;
          pan?: string | null;
          payment_terms?: string | null;
          phone: string;
          review_notes?: string | null;
          review_state?: Database["public"]["Enums"]["approval_state"];
          reviewed_by?: string | null;
          state?: string | null;
          supplies?: string | null;
          updated_at?: string;
          vendor_id?: string | null;
        };
        Update: {
          account_number?: string | null;
          address?: string | null;
          bank_name?: string | null;
          business_name?: string;
          category?: string;
          city?: string | null;
          company_id?: string;
          contact_name?: string;
          created_at?: string;
          email?: string;
          gstin?: string | null;
          id?: string;
          ifsc?: string | null;
          notes?: string | null;
          pan?: string | null;
          payment_terms?: string | null;
          phone?: string;
          review_notes?: string | null;
          review_state?: Database["public"]["Enums"]["approval_state"];
          reviewed_by?: string | null;
          state?: string | null;
          supplies?: string | null;
          updated_at?: string;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_registrations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_registrations_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_registrations_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          address: string | null;
          category: string;
          city: string | null;
          company_id: string;
          contact_name: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          gstin: string | null;
          id: string;
          is_approved: boolean;
          is_archived: boolean;
          name: string;
          pan: string | null;
          payment_terms: string | null;
          phone: string | null;
          rating: number;
          state: string | null;
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
          updated_by: string | null;
          vendor_code: string;
        };
        Insert: {
          address?: string | null;
          category?: string;
          city?: string | null;
          company_id: string;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          is_approved?: boolean;
          is_archived?: boolean;
          name: string;
          pan?: string | null;
          payment_terms?: string | null;
          phone?: string | null;
          rating?: number;
          state?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
          vendor_code: string;
        };
        Update: {
          address?: string | null;
          category?: string;
          city?: string | null;
          company_id?: string;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          is_approved?: boolean;
          is_archived?: boolean;
          name?: string;
          pan?: string | null;
          payment_terms?: string | null;
          phone?: string | null;
          rating?: number;
          state?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          updated_by?: string | null;
          vendor_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      boq_item_execution: {
        Row: {
          boq_approval_state: Database["public"]["Enums"]["approval_state"] | null;
          boq_id: string | null;
          boq_item_id: string | null;
          company_id: string | null;
          description: string | null;
          executed_amount: number | null;
          item_kind: string | null;
          last_reported_on: string | null;
          percent_done: number | null;
          planned_amount: number | null;
          project_id: string | null;
          quantity_done: number | null;
          quantity_planned: number | null;
          unit_rate: number | null;
          uom: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "boq_items_boq_id_fkey";
            columns: ["boq_id"];
            isOneToOne: false;
            referencedRelation: "boqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boqs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      po_three_way_match: {
        Row: {
          billed_amount: number | null;
          company_id: string | null;
          match_status: string | null;
          ordered_amount: number | null;
          po_code: string | null;
          purchase_order_id: string | null;
          received_amount: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      project_boq_progress: {
        Row: {
          executed_amount: number | null;
          planned_amount: number | null;
          progress_percent: number | null;
          project_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "boqs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      can: { Args: { _action: string; _module: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      my_company_id: { Args: never; Returns: string };
      my_employee_id: { Args: never; Returns: string };
      my_portal_client_id: { Args: never; Returns: string };
      my_portal_vendor_id: { Args: never; Returns: string };
      recalc_project_progress: {
        Args: { _project_id: string };
        Returns: undefined;
      };
      vendor_estimate_coverage: {
        Args: never;
        Returns: {
          description: string;
          ordered_quantity: number;
          po_approval_state: Database["public"]["Enums"]["approval_state"];
          po_code: string;
          po_item_id: string;
          project_code: string;
          project_id: string;
          project_name: string;
          purchase_order_id: string;
          received_quantity: number;
          required_quantity: number;
          uom: string;
          wastage_percent: number;
        }[];
      };
    };
    Enums: {
      app_role:
        | "md"
        | "ceo"
        | "cto"
        | "sales_director"
        | "bd_manager"
        | "design_head"
        | "designer"
        | "project_manager"
        | "site_engineer"
        | "site_supervisor"
        | "horticulture_head"
        | "procurement_manager"
        | "store_manager"
        | "finance"
        | "hr"
        | "client";
      approval_state:
        | "draft"
        | "submitted"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "executed"
        | "cancelled";
      record_status:
        | "draft"
        | "submitted"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
        | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "md",
        "ceo",
        "cto",
        "sales_director",
        "bd_manager",
        "design_head",
        "designer",
        "project_manager",
        "site_engineer",
        "site_supervisor",
        "horticulture_head",
        "procurement_manager",
        "store_manager",
        "finance",
        "hr",
        "client",
      ],
      approval_state: [
        "draft",
        "submitted",
        "pending_approval",
        "approved",
        "rejected",
        "executed",
        "cancelled",
      ],
      record_status: [
        "draft",
        "submitted",
        "pending_approval",
        "approved",
        "rejected",
        "in_progress",
        "blocked",
        "completed",
        "cancelled",
        "archived",
      ],
    },
  },
} as const;
