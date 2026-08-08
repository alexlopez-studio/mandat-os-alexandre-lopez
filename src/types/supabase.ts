/**
 * Types Supabase — Phase B MVP v1 + Mandat OS
 *
 * Aligné sur supabase/migrations/002_phase_b_schema.sql
 * + tables Mandat OS (market_properties, management_rules, etc.)
 * Format compatible avec @supabase/supabase-js 2.49+.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type LeadTool = 'vendre' | 'acheter' | 'audit'

export type LeadStatus =
  | 'nouveau'
  | 'contacte'
  | 'r1'
  | 'mandat'
  | 'sous_compromis'
  | 'vendu'
  | 'perdu'

export type AdminRole = 'super_admin' | 'admin'

export type LeadEventKind =
  | 'note'
  | 'status_change'
  | 'magic_link_resent'
  | 'rgpd_delete'
  | 'system'

// ── Mandat OS types ────────────────────────────────────────

export type PropertyStatus = 
  | 'nouveau' | 'actif' | 'prix_en_baisse' | 'a_surveiller'
  | 'opportunite' | 'stagne' | 'expire' | 'ignore'

export type RuleTriggerType =
  | 'new_listing' | 'price_changed' | 'price_drop' | 'big_price_drop'
  | 'expired' | 'updated' | 'days_online_exceeded' | 'dpe_detected'
  | 'price_per_m2_below' | 'price_per_m2_above' | 'land_surface_above'

export type NotificationStatus = 'unread' | 'read' | 'processed' | 'ignored'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'

export type OpportunityStage =
  | 'Nouveau contact' | 'Pré-estimation' | "Visite d'estimation"
  | "Remise de l'estimation" | 'Décision vendeur' | 'Suivi moyen terme'
  | 'Mandat signé' | 'Vendu' | 'Perdu / Écarté'

export type OpportunityPriority = 'low' | 'medium' | 'high' | 'critical'

export type OpportunityEventType =
  | 'note' | 'task' | 'call' | 'meeting'
  | 'email' | 'stage_change' | 'estimation' | 'system'

export type ActivityType =
  | 'note' | 'task' | 'call' | 'meeting'
  | 'email' | 'stage_change' | 'estimation' | 'system'

export type SyncStatus = 'running' | 'success' | 'error'

export type ClientDocumentStatus =
  | 'missing' | 'requested' | 'uploaded' | 'validated' | 'rejected'

export type ClientDossierEventType =
  | 'milestone' | 'visit' | 'offer' | 'note' | 'document' | 'system'

// ── Liste Chaude (réseau / bouche-à-oreille) ───────────────

export type WarmContactStatus =
  | 'a_contacter' | 'contacte' | 'relance' | 'termine'

export type WarmEventType =
  | 'call' | 'email' | 'message' | 'meeting'
  | 'note' | 'status_change' | 'referral' | 'import'

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      // ── Tables existantes Phase B ──────────────────────────
      contacts: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          company: string | null
          relation: string | null
          source: string
          types: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          company?: string | null
          relation?: string | null
          source?: string
          types?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          company?: string | null
          relation?: string | null
          source?: string
          types?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_contacts: {
        Row: {
          id: string
          contact_id: string
          opportunity_id: string | null
          buyer_criteria_id: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          opportunity_id?: string | null
          buyer_criteria_id?: string | null
          role: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          opportunity_id?: string | null
          buyer_criteria_id?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_contacts_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_contacts_opportunity_id_fkey'
            columns: ['opportunity_id']
            isOneToOne: false
            referencedRelation: 'opportunities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_contacts_buyer_criteria_id_fkey'
            columns: ['buyer_criteria_id']
            isOneToOne: false
            referencedRelation: 'buyer_criteria'
            referencedColumns: ['id']
          }
        ]
      }
      prospects: {
        Row: {
          id: string
          email: string | null
          first_name: string
          last_name: string
          phone: string | null
          rgpd_consent_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          first_name?: string
          last_name?: string
          phone?: string | null
          rgpd_consent_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          first_name?: string
          last_name?: string
          phone?: string | null
          rgpd_consent_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          prospect_id: string
          tool: LeadTool
          status: LeadStatus
          form_data: Json
          results: Json
          commune: string | null
          source_channel: string | null
          priority: string
          next_action: string | null
          due_date: string | null
          follow_up_at: string | null
          magic_link_expires_at: string
          magic_link_sent_at: string | null
          deleted_at: string | null
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          prospect_id: string
          tool: LeadTool
          status?: LeadStatus
          form_data?: Json
          results?: Json
          commune?: string | null
          source_channel?: string | null
          priority?: string
          next_action?: string | null
          due_date?: string | null
          follow_up_at?: string | null
          magic_link_expires_at?: string
          magic_link_sent_at?: string | null
          deleted_at?: string | null
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prospect_id?: string
          tool?: LeadTool
          status?: LeadStatus
          form_data?: Json
          results?: Json
          commune?: string | null
          source_channel?: string | null
          priority?: string
          next_action?: string | null
          due_date?: string | null
          follow_up_at?: string | null
          magic_link_expires_at?: string
          magic_link_sent_at?: string | null
          deleted_at?: string | null
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leads_prospect_id_fkey'
            columns: ['prospect_id']
            isOneToOne: false
            referencedRelation: 'prospects'
            referencedColumns: ['id']
          },
        ]
      }
      lead_events: {
        Row: {
          id: string
          lead_id: string
          kind: LeadEventKind
          payload: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          kind: LeadEventKind
          payload?: Json
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          kind?: LeadEventKind
          payload?: Json
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_events_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      admin_users: {
        Row: {
          id: string
          email: string
          is_active: boolean
          user_id: string | null
          role: AdminRole
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          is_active?: boolean
          user_id?: string | null
          role?: AdminRole
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          is_active?: boolean
          user_id?: string | null
          role?: AdminRole
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          id: string
          user_id: string | null
          email: string
          first_name: string
          last_name: string
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          first_name?: string
          last_name?: string
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_dossiers: {
        Row: {
          id: string
          client_profile_id: string
          lead_id: string | null
          seller_property_id: string | null
          opportunity_id: string | null
          client_type: string
          buyer_lead_id: string | null
          public_token: string
          status: string
          title: string
          property_snapshot: Json
          advisor_note: string | null
          professional_opinion: Json
          personalization: Json
          client_welcome_seen_at: string | null
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_profile_id: string
          lead_id?: string | null
          seller_property_id?: string | null
          opportunity_id?: string | null
          client_type?: string
          buyer_lead_id?: string | null
          public_token?: string
          status?: string
          title?: string
          property_snapshot?: Json
          advisor_note?: string | null
          professional_opinion?: Json
          personalization?: Json
          client_welcome_seen_at?: string | null
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_profile_id?: string
          lead_id?: string | null
          seller_property_id?: string | null
          opportunity_id?: string | null
          client_type?: string
          buyer_lead_id?: string | null
          public_token?: string
          status?: string
          title?: string
          property_snapshot?: Json
          advisor_note?: string | null
          professional_opinion?: Json
          personalization?: Json
          client_welcome_seen_at?: string | null
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_dossiers_client_profile_id_fkey'
            columns: ['client_profile_id']
            isOneToOne: false
            referencedRelation: 'client_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_dossiers_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_dossiers_seller_property_id_fkey'
            columns: ['seller_property_id']
            isOneToOne: false
            referencedRelation: 'seller_properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'client_dossiers_opportunity_id_fkey'
            columns: ['opportunity_id']
            isOneToOne: false
            referencedRelation: 'opportunities'
            referencedColumns: ['id']
          },
        ]
      }
      client_documents: {
        Row: {
          id: string
          dossier_id: string
          label: string
          category: string
          status: ClientDocumentStatus
          storage_path: string | null
          file_name: string | null
          mime_type: string | null
          file_size: number | null
          uploaded_by_user_id: string | null
          uploaded_at: string | null
          validated_at: string | null
          validated_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dossier_id: string
          label: string
          category?: string
          status?: ClientDocumentStatus
          storage_path?: string | null
          file_name?: string | null
          mime_type?: string | null
          file_size?: number | null
          uploaded_by_user_id?: string | null
          uploaded_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dossier_id?: string
          label?: string
          category?: string
          status?: ClientDocumentStatus
          storage_path?: string | null
          file_name?: string | null
          mime_type?: string | null
          file_size?: number | null
          uploaded_by_user_id?: string | null
          uploaded_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_documents_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'client_dossiers'
            referencedColumns: ['id']
          },
        ]
      }
      client_dossier_events: {
        Row: {
          id: string
          dossier_id: string
          type: ClientDossierEventType
          title: string
          description: string | null
          status: string
          event_date: string | null
          payload: Json
          visible_to_client: boolean
          created_by: string | null
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dossier_id: string
          type?: ClientDossierEventType
          title: string
          description?: string | null
          status?: string
          event_date?: string | null
          payload?: Json
          visible_to_client?: boolean
          created_by?: string | null
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dossier_id?: string
          type?: ClientDossierEventType
          title?: string
          description?: string | null
          status?: string
          event_date?: string | null
          payload?: Json
          visible_to_client?: boolean
          created_by?: string | null
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'client_dossier_events_dossier_id_fkey'
            columns: ['dossier_id']
            isOneToOne: false
            referencedRelation: 'client_dossiers'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Tables Mandat OS ──────────────────────────────────
      app_settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      monitored_zones: {
        Row: {
          id: string
          name: string
          zipcode: string
          city: string | null
          insee_code: string | null
          active: boolean
          sync_frequency: string
          last_synced_at: string | null
          stream_estate_search_id: string | null
          last_reconciled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          zipcode: string
          city?: string | null
          insee_code?: string | null
          active?: boolean
          sync_frequency?: string
          last_synced_at?: string | null
          stream_estate_search_id?: string | null
          last_reconciled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          zipcode?: string
          city?: string | null
          insee_code?: string | null
          active?: boolean
          sync_frequency?: string
          last_synced_at?: string | null
          stream_estate_search_id?: string | null
          last_reconciled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_properties: {
        Row: {
          id: string
          external_id: string
          source: string
          title: string | null
          description: string | null
          city: string | null
          zipcode: string | null
          insee_code: string | null
          lat: number | null
          lon: number | null
          property_type: string | null
          price: number | null
          surface: number | null
          price_per_m2: number | null
          land_surface: number | null
          rooms: number | null
          bedrooms: number | null
          dpe: string | null
          ges: string | null
          url: string | null
          status: string
          first_seen_at: string
          last_seen_at: string
          published_at: string | null
          expired_at: string | null
          raw_json: Json
          mandate_score: number | null
          mandate_phase: string | null
          scored_at: string | null
          seller_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          external_id: string
          source?: string
          title?: string | null
          description?: string | null
          city?: string | null
          zipcode?: string | null
          insee_code?: string | null
          lat?: number | null
          lon?: number | null
          property_type?: string | null
          price?: number | null
          surface?: number | null
          price_per_m2?: number | null
          land_surface?: number | null
          rooms?: number | null
          bedrooms?: number | null
          dpe?: string | null
          ges?: string | null
          url?: string | null
          status?: string
          first_seen_at?: string
          last_seen_at?: string
          published_at?: string | null
          expired_at?: string | null
          raw_json?: Json
          mandate_score?: number | null
          mandate_phase?: string | null
          scored_at?: string | null
          seller_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          external_id?: string
          source?: string
          title?: string | null
          description?: string | null
          city?: string | null
          zipcode?: string | null
          insee_code?: string | null
          lat?: number | null
          lon?: number | null
          property_type?: string | null
          price?: number | null
          surface?: number | null
          price_per_m2?: number | null
          land_surface?: number | null
          rooms?: number | null
          bedrooms?: number | null
          dpe?: string | null
          ges?: string | null
          url?: string | null
          status?: string
          first_seen_at?: string
          last_seen_at?: string
          published_at?: string | null
          expired_at?: string | null
          raw_json?: Json
          mandate_score?: number | null
          mandate_phase?: string | null
          scored_at?: string | null
          seller_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_property_sources: {
        Row: {
          id: string
          market_property_id: string
          source: string
          portal: string | null
          external_id: string | null
          url: string | null
          title: string | null
          price: number | null
          status: string
          published_at: string | null
          first_seen_at: string
          last_seen_at: string
          raw_json: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          market_property_id: string
          source?: string
          portal?: string | null
          external_id?: string | null
          url?: string | null
          title?: string | null
          price?: number | null
          status?: string
          published_at?: string | null
          first_seen_at?: string
          last_seen_at?: string
          raw_json?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          market_property_id?: string
          source?: string
          portal?: string | null
          external_id?: string | null
          url?: string | null
          title?: string | null
          price?: number | null
          status?: string
          published_at?: string | null
          first_seen_at?: string
          last_seen_at?: string
          raw_json?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'market_property_sources_market_property_id_fkey'
            columns: ['market_property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
        ]
      }
      market_property_duplicate_candidates: {
        Row: {
          id: string
          property_id: string
          candidate_property_id: string
          status: string
          score: number
          reasons: Json
          resolved_at: string | null
          resolved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          candidate_property_id: string
          status?: string
          score?: number
          reasons?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          candidate_property_id?: string
          status?: string
          score?: number
          reasons?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'market_property_duplicate_candidates_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'market_property_duplicate_candidates_candidate_property_id_fkey'
            columns: ['candidate_property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
        ]
      }
      property_price_history: {
        Row: {
          id: string
          market_property_id: string
          old_price: number | null
          new_price: number | null
          variation_amount: number | null
          variation_percent: number | null
          detected_at: string
          created_at: string
        }
        Insert: {
          id?: string
          market_property_id: string
          old_price?: number | null
          new_price?: number | null
          variation_amount?: number | null
          variation_percent?: number | null
          detected_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          market_property_id?: string
          old_price?: number | null
          new_price?: number | null
          variation_amount?: number | null
          variation_percent?: number | null
          detected_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'property_price_history_market_property_id_fkey'
            columns: ['market_property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
        ]
      }
      property_tags: {
        Row: {
          id: string
          market_property_id: string
          tag: string
          source: string
          rule_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          market_property_id: string
          tag: string
          source?: string
          rule_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          market_property_id?: string
          tag?: string
          source?: string
          rule_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'property_tags_market_property_id_fkey'
            columns: ['market_property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
        ]
      }
      management_rules: {
        Row: {
          id: string
          name: string
          description: string
          active: boolean
          trigger_type: string
          conditions_json: Json
          actions_json: Json
          priority: string
          last_run_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          active?: boolean
          trigger_type: string
          conditions_json?: Json
          actions_json?: Json
          priority?: string
          last_run_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          active?: boolean
          trigger_type?: string
          conditions_json?: Json
          actions_json?: Json
          priority?: string
          last_run_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          type: string
          title: string
          message: string
          priority: string
          market_property_id: string | null
          rule_id: string | null
          opportunity_id: string | null
          status: string
          action_label: string | null
          created_at: string
          read_at: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          type: string
          title: string
          message?: string
          priority?: string
          market_property_id?: string | null
          rule_id?: string | null
          opportunity_id?: string | null
          status?: string
          action_label?: string | null
          created_at?: string
          read_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          type?: string
          title?: string
          message?: string
          priority?: string
          market_property_id?: string | null
          rule_id?: string | null
          opportunity_id?: string | null
          status?: string
          action_label?: string | null
          created_at?: string
          read_at?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_market_property_id_fkey'
            columns: ['market_property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_rule_id_fkey'
            columns: ['rule_id']
            isOneToOne: false
            referencedRelation: 'management_rules'
            referencedColumns: ['id']
          },
        ]
      }
      // Table reelle du modele unifie (migration 036). Les tables `opportunities`
      // et `buyer_criteria` ci-dessous en sont des vues de compatibilite.
      projects: {
        Row: {
          id: string
          kind: 'vente' | 'achat'
          title: string
          stage: string
          priority: string
          next_action: string | null
          due_date: string | null
          lead_id: string | null
          follow_up_at: string | null
          is_test: boolean
          market_property_id: string | null
          description: string | null
          signal_type: string | null
          note: string | null
          seller_name: string | null
          seller_phone: string | null
          seller_email: string | null
          source_channel: string | null
          property_address: string | null
          property_city: string | null
          property_zipcode: string | null
          property_type: string | null
          property_surface: number | null
          property_land_surface: number | null
          property_rooms: number | null
          estimated_price_min: number | null
          estimated_price_max: number | null
          selling_timeline: string | null
          pre_estimation_done_at: string | null
          visit_at: string | null
          report_delivered_at: string | null
          property_snapshot: Record<string, unknown>
          professional_opinion: Record<string, unknown>
          internal_intel: Record<string, unknown>
          created_from: string | null
          prospect_id: string | null
          type_bien: string | null
          communes: string[] | null
          budget_max: number | null
          surface_min: number | null
          pieces_min: number | null
          criteres: string[] | null
          active: boolean | null
          matched_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kind: 'vente' | 'achat'
          title: string
          stage: string
          priority?: string
          next_action?: string | null
          due_date?: string | null
          lead_id?: string | null
          follow_up_at?: string | null
          is_test?: boolean
          market_property_id?: string | null
          description?: string | null
          signal_type?: string | null
          note?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          seller_email?: string | null
          source_channel?: string | null
          property_address?: string | null
          property_city?: string | null
          property_zipcode?: string | null
          property_type?: string | null
          property_surface?: number | null
          property_land_surface?: number | null
          property_rooms?: number | null
          estimated_price_min?: number | null
          estimated_price_max?: number | null
          selling_timeline?: string | null
          pre_estimation_done_at?: string | null
          visit_at?: string | null
          report_delivered_at?: string | null
          property_snapshot?: Record<string, unknown>
          professional_opinion?: Record<string, unknown>
          internal_intel?: Record<string, unknown>
          created_from?: string | null
          prospect_id?: string | null
          type_bien?: string | null
          communes?: string[] | null
          budget_max?: number | null
          surface_min?: number | null
          pieces_min?: number | null
          criteres?: string[] | null
          active?: boolean | null
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kind?: 'vente' | 'achat'
          title?: string
          stage?: string
          priority?: string
          next_action?: string | null
          due_date?: string | null
          lead_id?: string | null
          follow_up_at?: string | null
          is_test?: boolean
          market_property_id?: string | null
          description?: string | null
          signal_type?: string | null
          note?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          seller_email?: string | null
          source_channel?: string | null
          property_address?: string | null
          property_city?: string | null
          property_zipcode?: string | null
          property_type?: string | null
          property_surface?: number | null
          property_land_surface?: number | null
          property_rooms?: number | null
          estimated_price_min?: number | null
          estimated_price_max?: number | null
          selling_timeline?: string | null
          pre_estimation_done_at?: string | null
          visit_at?: string | null
          report_delivered_at?: string | null
          property_snapshot?: Record<string, unknown>
          professional_opinion?: Record<string, unknown>
          internal_intel?: Record<string, unknown>
          created_from?: string | null
          prospect_id?: string | null
          type_bien?: string | null
          communes?: string[] | null
          budget_max?: number | null
          surface_min?: number | null
          pieces_min?: number | null
          criteres?: string[] | null
          active?: boolean | null
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          id: string
          market_property_id: string | null
          lead_id: string | null
          title: string
          description: string
          stage: string
          priority: string
          signal_type: string | null
          next_action: string | null
          due_date: string | null
          note: string | null
          seller_name: string | null
          seller_phone: string | null
          seller_email: string | null
          source_channel: string | null
          property_address: string | null
          property_city: string | null
          property_zipcode: string | null
          property_type: string | null
          property_surface: number | null
          property_land_surface: number | null
          property_rooms: number | null
          estimated_price_min: number | null
          estimated_price_max: number | null
          selling_timeline: string | null
          pre_estimation_done_at: string | null
          visit_at: string | null
          report_delivered_at: string | null
          follow_up_at: string | null
          property_snapshot: Json
          professional_opinion: Json
          internal_intel: Json
          created_from: string
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          market_property_id?: string | null
          lead_id?: string | null
          title: string
          description?: string
          stage?: string
          priority?: string
          signal_type?: string | null
          next_action?: string | null
          due_date?: string | null
          note?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          seller_email?: string | null
          source_channel?: string | null
          property_address?: string | null
          property_city?: string | null
          property_zipcode?: string | null
          property_type?: string | null
          property_surface?: number | null
          property_land_surface?: number | null
          property_rooms?: number | null
          estimated_price_min?: number | null
          estimated_price_max?: number | null
          selling_timeline?: string | null
          pre_estimation_done_at?: string | null
          visit_at?: string | null
          report_delivered_at?: string | null
          follow_up_at?: string | null
          property_snapshot?: Json
          professional_opinion?: Json
          internal_intel?: Json
          created_from?: string
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          market_property_id?: string | null
          lead_id?: string | null
          title?: string
          description?: string
          stage?: string
          priority?: string
          signal_type?: string | null
          next_action?: string | null
          due_date?: string | null
          note?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          seller_email?: string | null
          source_channel?: string | null
          property_address?: string | null
          property_city?: string | null
          property_zipcode?: string | null
          property_type?: string | null
          property_surface?: number | null
          property_land_surface?: number | null
          property_rooms?: number | null
          estimated_price_min?: number | null
          estimated_price_max?: number | null
          selling_timeline?: string | null
          pre_estimation_done_at?: string | null
          visit_at?: string | null
          report_delivered_at?: string | null
          follow_up_at?: string | null
          property_snapshot?: Json
          professional_opinion?: Json
          internal_intel?: Json
          created_from?: string
          is_test?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'opportunities_market_property_id_fkey'
            columns: ['market_property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'opportunities_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      estimation_imports: {
        Row: {
          id: string
          opportunity_id: string | null
          kind: string
          source: string
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          property_address: string | null
          property_city: string | null
          property_type: string | null
          property_surface: number | null
          price_low: number | null
          price_high: number | null
          price_m2: number | null
          confidence: number | null
          summary: string | null
          payload: Json
          raw_filename: string | null
          raw_format: string | null
          status: string
          applied_at: string | null
          applied_by: string | null
          reviewed_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id?: string | null
          kind: string
          source?: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          property_address?: string | null
          property_city?: string | null
          property_type?: string | null
          property_surface?: number | null
          price_low?: number | null
          price_high?: number | null
          price_m2?: number | null
          confidence?: number | null
          summary?: string | null
          payload: Json
          raw_filename?: string | null
          raw_format?: string | null
          status?: string
          applied_at?: string | null
          applied_by?: string | null
          reviewed_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string | null
          kind?: string
          source?: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          property_address?: string | null
          property_city?: string | null
          property_type?: string | null
          property_surface?: number | null
          price_low?: number | null
          price_high?: number | null
          price_m2?: number | null
          confidence?: number | null
          summary?: string | null
          payload?: Json
          raw_filename?: string | null
          raw_format?: string | null
          status?: string
          applied_at?: string | null
          applied_by?: string | null
          reviewed_note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'estimation_imports_opportunity_id_fkey'
            columns: ['opportunity_id']
            isOneToOne: false
            referencedRelation: 'opportunities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'estimation_imports_applied_by_fkey'
            columns: ['applied_by']
            isOneToOne: false
            referencedRelation: 'admin_users'
            referencedColumns: ['id']
          },
        ]
      }
      activities: {
        Row: {
          id: string
          contact_id: string | null
          opportunity_id: string | null
          lead_id: string | null
          type: ActivityType
          title: string | null
          content: string | null
          due_at: string | null
          occurred_at: string
          completed_at: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contact_id?: string | null
          opportunity_id?: string | null
          lead_id?: string | null
          type?: ActivityType
          title?: string | null
          content?: string | null
          due_at?: string | null
          occurred_at?: string
          completed_at?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contact_id?: string | null
          opportunity_id?: string | null
          lead_id?: string | null
          type?: ActivityType
          title?: string | null
          content?: string | null
          due_at?: string | null
          occurred_at?: string
          completed_at?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activities_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_opportunity_id_fkey'
            columns: ['opportunity_id']
            isOneToOne: false
            referencedRelation: 'opportunities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          }
        ]
      }
      opportunity_audience_snapshots: {
        Row: {
          id: string
          opportunity_id: string
          portal: string
          captured_on: string
          views: number
          contacts: number
          favorites: number
          visits: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          portal: string
          captured_on?: string
          views?: number
          contacts?: number
          favorites?: number
          visits?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          portal?: string
          captured_on?: string
          views?: number
          contacts?: number
          favorites?: number
          visits?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'opportunity_audience_snapshots_opportunity_id_fkey'
            columns: ['opportunity_id']
            isOneToOne: false
            referencedRelation: 'opportunities'
            referencedColumns: ['id']
          },
        ]
      }
      property_notes: {
        Row: {
          id: string
          market_property_id: string | null
          opportunity_id: string | null
          note: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          market_property_id?: string | null
          opportunity_id?: string | null
          note: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          market_property_id?: string | null
          opportunity_id?: string | null
          note?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'property_notes_market_property_id_fkey'
            columns: ['market_property_id']
            isOneToOne: false
            referencedRelation: 'market_properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'property_notes_opportunity_id_fkey'
            columns: ['opportunity_id']
            isOneToOne: false
            referencedRelation: 'opportunities'
            referencedColumns: ['id']
          },
        ]
      }
      buyer_criteria: {
        Row: {
          id: string
          // `buyer_criteria` est une vue sur `projects` (migration 038), où
          // `lead_id` est nullable : un projet d'achat peut être créé sans lead.
          lead_id: string | null
          prospect_id: string | null
          type_bien: string | null
          communes: string[] | null
          budget_max: number | null
          surface_min: number | null
          pieces_min: number | null
          criteres: string[] | null
          active: boolean
          stage: string
          next_action: string | null
          due_date: string | null
          matched_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          prospect_id?: string | null
          type_bien?: string | null
          communes?: string[] | null
          budget_max?: number | null
          surface_min?: number | null
          pieces_min?: number | null
          criteres?: string[] | null
          active?: boolean
          stage?: string
          next_action?: string | null
          due_date?: string | null
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          prospect_id?: string | null
          type_bien?: string | null
          communes?: string[] | null
          budget_max?: number | null
          surface_min?: number | null
          pieces_min?: number | null
          criteres?: string[] | null
          active?: boolean
          stage?: string
          next_action?: string | null
          due_date?: string | null
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_properties: {
        Row: {
          id: string
          lead_id: string
          prospect_id: string | null
          adresse: string | null
          lat: number | null
          lon: number | null
          type_bien: string | null
          sous_type: string | null
          surface: number | null
          surface_terrain: number | null
          nb_pieces: number | null
          etat: string | null
          dpe: string | null
          annee_construction: number | null
          equipements: string[] | null
          delai: string | null
          prix_estime: number | null
          actif: boolean
          matched_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          prospect_id?: string | null
          adresse?: string | null
          lat?: number | null
          lon?: number | null
          type_bien?: string | null
          sous_type?: string | null
          surface?: number | null
          surface_terrain?: number | null
          nb_pieces?: number | null
          etat?: string | null
          dpe?: string | null
          annee_construction?: number | null
          equipements?: string[] | null
          delai?: string | null
          prix_estime?: number | null
          actif?: boolean
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          prospect_id?: string | null
          adresse?: string | null
          lat?: number | null
          lon?: number | null
          type_bien?: string | null
          sous_type?: string | null
          surface?: number | null
          surface_terrain?: number | null
          nb_pieces?: number | null
          etat?: string | null
          dpe?: string | null
          annee_construction?: number | null
          equipements?: string[] | null
          delai?: string | null
          prix_estime?: number | null
          actif?: boolean
          matched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_results: {
        Row: {
          id: string
          buyer_lead_id: string
          property_id: string | null
          seller_lead_id: string | null
          property_type: string
          score: number
          score_details: Json
          matched_commune: boolean
          matched_type: boolean
          matched_budget: boolean
          matched_surface: boolean
          matched_pieces: boolean
          notified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          buyer_lead_id: string
          property_id?: string | null
          seller_lead_id?: string | null
          property_type?: string
          score?: number
          score_details?: Json
          matched_commune?: boolean
          matched_type?: boolean
          matched_budget?: boolean
          matched_surface?: boolean
          matched_pieces?: boolean
          notified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          buyer_lead_id?: string
          property_id?: string | null
          seller_lead_id?: string | null
          property_type?: string
          score?: number
          score_details?: Json
          matched_commune?: boolean
          matched_type?: boolean
          matched_budget?: boolean
          matched_surface?: boolean
          matched_pieces?: boolean
          notified_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          id: string
          zone_id: string | null
          provider: string
          status: string
          started_at: string
          finished_at: string | null
          fetched_count: number
          created_count: number
          updated_count: number
          error_message: string | null
          external_request_count: number
          external_item_count: number
          estimated_cost_eur: number
          blocked_reason: string | null
          source: string
        }
        Insert: {
          id?: string
          zone_id?: string | null
          provider?: string
          status: string
          started_at?: string
          finished_at?: string | null
          fetched_count?: number
          created_count?: number
          updated_count?: number
          error_message?: string | null
          external_request_count?: number
          external_item_count?: number
          estimated_cost_eur?: number
          blocked_reason?: string | null
          source?: string
        }
        Update: {
          id?: string
          zone_id?: string | null
          provider?: string
          status?: string
          started_at?: string
          finished_at?: string | null
          fetched_count?: number
          created_count?: number
          updated_count?: number
          error_message?: string | null
          external_request_count?: number
          external_item_count?: number
          estimated_cost_eur?: number
          blocked_reason?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sync_runs_zone_id_fkey'
            columns: ['zone_id']
            isOneToOne: false
            referencedRelation: 'monitored_zones'
            referencedColumns: ['id']
          },
        ]
      }
      stream_estate_usage_events: {
        Row: {
          id: string
          sync_run_id: string | null
          zipcode: string
          endpoint: string
          page: number
          request_status: string
          item_count: number
          estimated_cost_eur: number
          started_at: string
          finished_at: string | null
          error_message: string | null
          created_at: string
          source: string
          event_type: string | null
        }
        Insert: {
          id?: string
          sync_run_id?: string | null
          zipcode: string
          endpoint: string
          page: number
          request_status: string
          item_count?: number
          estimated_cost_eur?: number
          started_at: string
          finished_at?: string | null
          error_message?: string | null
          created_at?: string
          source?: string
          event_type?: string | null
        }
        Update: {
          id?: string
          sync_run_id?: string | null
          zipcode?: string
          endpoint?: string
          page?: number
          request_status?: string
          item_count?: number
          estimated_cost_eur?: number
          started_at?: string
          finished_at?: string | null
          error_message?: string | null
          created_at?: string
          source?: string
          event_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'stream_estate_usage_events_sync_run_id_fkey'
            columns: ['sync_run_id']
            isOneToOne: false
            referencedRelation: 'sync_runs'
            referencedColumns: ['id']
          },
        ]
      }
      warm_contacts: {
        Row: {
          id: string
          full_name: string
          relation: string | null
          phone: string | null
          email: string | null
          status: WarmContactStatus
          referrals: Json
          follow_up_date: string | null
          notes: string | null
          source: string
          last_contacted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          relation?: string | null
          phone?: string | null
          email?: string | null
          status?: WarmContactStatus
          referrals?: Json
          follow_up_date?: string | null
          notes?: string | null
          source?: string
          last_contacted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          relation?: string | null
          phone?: string | null
          email?: string | null
          status?: WarmContactStatus
          referrals?: Json
          follow_up_date?: string | null
          notes?: string | null
          source?: string
          last_contacted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      warm_contact_events: {
        Row: {
          id: string
          contact_id: string
          type: WarmEventType
          content: string | null
          metadata: Json
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          type?: WarmEventType
          content?: string | null
          metadata?: Json
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          type?: WarmEventType
          content?: string | null
          metadata?: Json
          occurred_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'warm_contact_events_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'warm_contacts'
            referencedColumns: ['id']
          },
        ]
      }
      dvf_communes: {
        Row: {
          id: string
          insee_code: string
          name: string
          zipcode: string | null
          department_code: string | null
          active: boolean
          last_imported_at: string | null
          last_import_year: number | null
          last_import_status: string | null
          last_import_error: string | null
          housing_stock_houses: number | null
          housing_stock_flats: number | null
          price_m2_floor: number | null
          price_m2_ceiling: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          insee_code: string
          name: string
          zipcode?: string | null
          department_code?: string | null
          active?: boolean
          last_imported_at?: string | null
          last_import_year?: number | null
          last_import_status?: string | null
          last_import_error?: string | null
          housing_stock_houses?: number | null
          housing_stock_flats?: number | null
          price_m2_floor?: number | null
          price_m2_ceiling?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          insee_code?: string
          name?: string
          zipcode?: string | null
          department_code?: string | null
          active?: boolean
          last_imported_at?: string | null
          last_import_year?: number | null
          last_import_status?: string | null
          last_import_error?: string | null
          housing_stock_houses?: number | null
          housing_stock_flats?: number | null
          price_m2_floor?: number | null
          price_m2_ceiling?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dvf_transactions: {
        Row: {
          id: string
          source_row_id: string
          mutation_id: string
          disposition_number: number | null
          mutation_date: string | null
          mutation_year: number | null
          nature_mutation: string | null
          value: number | null
          address_number: string | null
          address_suffix: string | null
          street_name: string | null
          postal_code: string | null
          insee_code: string
          city_name: string | null
          department_code: string | null
          parcel_id: string | null
          lot_count: number | null
          local_type_code: string | null
          local_type: string | null
          built_surface: number | null
          rooms: number | null
          land_nature: string | null
          land_surface: number | null
          longitude: number | null
          latitude: number | null
          price_per_m2: number | null
          source_file_year: number
          raw_json: Json
          imported_at: string
          created_at: string
        }
        Insert: {
          id?: string
          source_row_id: string
          mutation_id: string
          disposition_number?: number | null
          mutation_date?: string | null
          mutation_year?: number | null
          nature_mutation?: string | null
          value?: number | null
          address_number?: string | null
          address_suffix?: string | null
          street_name?: string | null
          postal_code?: string | null
          insee_code: string
          city_name?: string | null
          department_code?: string | null
          parcel_id?: string | null
          lot_count?: number | null
          local_type_code?: string | null
          local_type?: string | null
          built_surface?: number | null
          rooms?: number | null
          land_nature?: string | null
          land_surface?: number | null
          longitude?: number | null
          latitude?: number | null
          price_per_m2?: number | null
          source_file_year: number
          raw_json?: Json
          imported_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          source_row_id?: string
          mutation_id?: string
          disposition_number?: number | null
          mutation_date?: string | null
          mutation_year?: number | null
          nature_mutation?: string | null
          value?: number | null
          address_number?: string | null
          address_suffix?: string | null
          street_name?: string | null
          postal_code?: string | null
          insee_code?: string
          city_name?: string | null
          department_code?: string | null
          parcel_id?: string | null
          lot_count?: number | null
          local_type_code?: string | null
          local_type?: string | null
          built_surface?: number | null
          rooms?: number | null
          land_nature?: string | null
          land_surface?: number | null
          longitude?: number | null
          latitude?: number | null
          price_per_m2?: number | null
          source_file_year?: number
          raw_json?: Json
          imported_at?: string
          created_at?: string
        }
        Relationships: []
      }
      buyer_lead_candidates: {
        Row: {
          id: string
          gmail_message_id: string
          gmail_thread_id: string | null
          received_at: string | null
          subject: string | null
          from_address: string | null
          portal: string | null
          body_excerpt: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          phone: string | null
          property_type: string | null
          budget_max: number | null
          communes: string[] | null
          confidence: number | null
          extraction: Json | null
          extracted_by: string
          matched_project_id: string | null
          match_reason: string | null
          status: 'pending' | 'approved' | 'rejected'
          reviewed_at: string | null
          review_note: string | null
          created_project_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gmail_message_id: string
          gmail_thread_id?: string | null
          received_at?: string | null
          subject?: string | null
          from_address?: string | null
          portal?: string | null
          body_excerpt?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          property_type?: string | null
          budget_max?: number | null
          communes?: string[] | null
          confidence?: number | null
          extraction?: Json | null
          extracted_by?: string
          matched_project_id?: string | null
          match_reason?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_at?: string | null
          review_note?: string | null
          created_project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gmail_message_id?: string
          gmail_thread_id?: string | null
          received_at?: string | null
          subject?: string | null
          from_address?: string | null
          portal?: string | null
          body_excerpt?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          property_type?: string | null
          budget_max?: number | null
          communes?: string[] | null
          confidence?: number | null
          extraction?: Json | null
          extracted_by?: string
          matched_project_id?: string | null
          match_reason?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_at?: string | null
          review_note?: string | null
          created_project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      dvf_import_runs: {
        Row: {
          id: string
          insee_code: string
          commune_name: string | null
          department_code: string | null
          source_file_year: number
          source_url: string
          status: string
          scanned_rows: number
          imported_rows: number
          skipped_rows: number
          error: string | null
          started_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          insee_code: string
          commune_name?: string | null
          department_code?: string | null
          source_file_year: number
          source_url: string
          status?: string
          scanned_rows?: number
          imported_rows?: number
          skipped_rows?: number
          error?: string | null
          started_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          insee_code?: string
          commune_name?: string | null
          department_code?: string | null
          source_file_year?: number
          source_url?: string
          status?: string
          scanned_rows?: number
          imported_rows?: number
          skipped_rows?: number
          error?: string | null
          started_at?: string
          finished_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      contacts_directory: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string | null
          company: string | null
          relation: string | null
          source: string
          types: string[]
          created_at: string
          updated_at: string
          /** Typologies saisies + typologies deduites des projets rattaches. */
          all_types: string[]
          projects_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      dvf_serie_annuelle: {
        Args: { p_insee: string; p_type?: string; p_years?: number }
        Returns: Array<{
          annee: number
          ventes: number
          prix_median: number | null
          m2_median: number | null
        }>
      }
      dvf_comparables: {
        Args: {
          p_insee: string
          p_surface: number
          p_type?: string
          p_tolerance?: number
          p_min_terrain?: number
          p_max_terrain?: number
          p_since?: string
          p_limit?: number
        }
        Returns: Array<{
          mutation_id: string
          mutation_date: string | null
          adresse: string | null
          surface: number
          pieces: number | null
          terrain: number | null
          prix: number
          prix_m2: number
          lat: number | null
          lon: number | null
        }>
      }
      dvf_distribution_m2: {
        Args: { p_insee: string; p_type?: string; p_since?: string }
        Returns: Array<{
          prix_m2: number
          mutation_date: string | null
          surface: number | null
          terrain: number | null
        }>
      }
    }
    Enums: {
      lead_tool: LeadTool
      lead_status: LeadStatus
      lead_event_kind: LeadEventKind
      warm_contact_status: WarmContactStatus
      warm_event_type: WarmEventType
      opportunity_stage: OpportunityStage
      opportunity_event_type: OpportunityEventType
      activity_type: ActivityType
      admin_role: AdminRole
      client_document_status: ClientDocumentStatus
      client_dossier_event_type: ClientDossierEventType
      notification_priority: NotificationPriority
      notification_status: NotificationStatus
      property_status: PropertyStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
