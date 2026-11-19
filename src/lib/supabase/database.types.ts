
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"org_id": string | null,"row_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"org_id"?: string | null,"row_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"org_id"?: string | null,"row_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"booking_menu_items": {
                  Row: {
                    "booking_id": string,"choices": (string)[],"created_at": string,"extra_unit_price_cents": number | null,"id": string,"item_id": string,"org_id": string,"price_cents": number,"price_unit": Database["public"]['Enums']["menu_price_unit"],"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"choices"?: (string)[],"created_at"?: string,"extra_unit_price_cents"?: number | null,"id"?: string,"item_id": string,"org_id": string,"price_cents": number,"price_unit": Database["public"]['Enums']["menu_price_unit"],"quantity"?: number
                  }
                  Update: {
                    "booking_id"?: string,"choices"?: (string)[],"created_at"?: string,"extra_unit_price_cents"?: number | null,"id"?: string,"item_id"?: string,"org_id"?: string,"price_cents"?: number,"price_unit"?: Database["public"]['Enums']["menu_price_unit"],"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_menu_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_menu_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "kitchen_schedule"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_menu_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_menu_items_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_notes": {
                  Row: {
                    "author_id": string,"body": string,"booking_id": string,"created_at": string,"id": string,"org_id": string,"read_at": string | null,"read_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"booking_id": string,"created_at"?: string,"id"?: string,"org_id": string,"read_at"?: string | null,"read_by"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"booking_id"?: string,"created_at"?: string,"id"?: string,"org_id"?: string,"read_at"?: string | null,"read_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_notes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_notes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "kitchen_schedule"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_notes_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_notes_read_by_fkey"
      columns: ["read_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "blocks_slot": boolean,"cancel_reason": string | null,"cancelled_at": string | null,"client_after_msg_at": string | null,"client_before_msg_at": string | null,"client_email": string | null,"client_first_name": string,"client_last_name": string,"client_phone": string,"client_phone_digits": string | null,"client_token": string | null,"client_token_created_at": string | null,"contract_file_path": string | null,"contract_sent_on": string | null,"contract_signed_on": string | null,"created_at": string,"created_by": string | null,"deposit_amount_cents": number | null,"deposit_method": Database["public"]['Enums']["payment_method"] | null,"deposit_paid": boolean,"deposit_received_on": string | null,"duration_minutes": number,"event_date": string,"final_confirmed": boolean,"final_paid": boolean,"final_paid_amount_cents": number | null,"final_paid_method": Database["public"]['Enums']["payment_method"] | null,"final_paid_on": string | null,"guests_children": number,"guests_men": number,"guests_total": number | null,"guests_women": number,"head_table": boolean,"hold_expires_at": string | null,"id": string,"import_ref": string | null,"mechitza": boolean,"menu_notes": string | null,"menu_updated_at": string | null,"notes": string | null,"occasion": Database["public"]['Enums']["party_occasion"] | null,"occasion_other": string | null,"org_id": string,"other_venue_name": string | null,"party_style": Database["public"]['Enums']["party_style"],"slot_id": string,"start_minute": number,"status": Database["public"]['Enums']["booking_status"],"updated_at": string,"updated_by": string | null,"venue_address": string | null,"venue_fee_cents": number | null,"venue_id": string,"waiters": number,"whatsapp_posted_at": string | null,"whatsapp_posted_by": string | null,"whatsapp_posted_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks_slot"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"client_after_msg_at"?: string | null,"client_before_msg_at"?: string | null,"client_email"?: string | null,"client_first_name": string,"client_last_name": string,"client_phone": string,"client_phone_digits"?: never,"client_token"?: string | null,"client_token_created_at"?: string | null,"contract_file_path"?: string | null,"contract_sent_on"?: string | null,"contract_signed_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"deposit_amount_cents"?: number | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"deposit_paid"?: boolean,"deposit_received_on"?: string | null,"duration_minutes": number,"event_date": string,"final_confirmed"?: boolean,"final_paid"?: boolean,"final_paid_amount_cents"?: number | null,"final_paid_method"?: Database["public"]['Enums']["payment_method"] | null,"final_paid_on"?: string | null,"guests_children"?: number,"guests_men"?: number,"guests_total"?: never,"guests_women"?: number,"head_table"?: boolean,"hold_expires_at"?: string | null,"id"?: string,"import_ref"?: string | null,"mechitza"?: boolean,"menu_notes"?: string | null,"menu_updated_at"?: string | null,"notes"?: string | null,"occasion"?: Database["public"]['Enums']["party_occasion"] | null,"occasion_other"?: string | null,"org_id": string,"other_venue_name"?: string | null,"party_style"?: Database["public"]['Enums']["party_style"],"slot_id": string,"start_minute": number,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string,"updated_by"?: string | null,"venue_address"?: string | null,"venue_fee_cents"?: number | null,"venue_id": string,"waiters"?: number,"whatsapp_posted_at"?: string | null,"whatsapp_posted_by"?: string | null,"whatsapp_posted_text"?: string | null
                  }
                  Update: {
                    "blocks_slot"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"client_after_msg_at"?: string | null,"client_before_msg_at"?: string | null,"client_email"?: string | null,"client_first_name"?: string,"client_last_name"?: string,"client_phone"?: string,"client_phone_digits"?: never,"client_token"?: string | null,"client_token_created_at"?: string | null,"contract_file_path"?: string | null,"contract_sent_on"?: string | null,"contract_signed_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"deposit_amount_cents"?: number | null,"deposit_method"?: Database["public"]['Enums']["payment_method"] | null,"deposit_paid"?: boolean,"deposit_received_on"?: string | null,"duration_minutes"?: number,"event_date"?: string,"final_confirmed"?: boolean,"final_paid"?: boolean,"final_paid_amount_cents"?: number | null,"final_paid_method"?: Database["public"]['Enums']["payment_method"] | null,"final_paid_on"?: string | null,"guests_children"?: number,"guests_men"?: number,"guests_total"?: never,"guests_women"?: number,"head_table"?: boolean,"hold_expires_at"?: string | null,"id"?: string,"import_ref"?: string | null,"mechitza"?: boolean,"menu_notes"?: string | null,"menu_updated_at"?: string | null,"notes"?: string | null,"occasion"?: Database["public"]['Enums']["party_occasion"] | null,"occasion_other"?: string | null,"org_id"?: string,"other_venue_name"?: string | null,"party_style"?: Database["public"]['Enums']["party_style"],"slot_id"?: string,"start_minute"?: number,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string,"updated_by"?: string | null,"venue_address"?: string | null,"venue_fee_cents"?: number | null,"venue_id"?: string,"waiters"?: number,"whatsapp_posted_at"?: string | null,"whatsapp_posted_by"?: string | null,"whatsapp_posted_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_whatsapp_posted_by_fkey"
      columns: ["whatsapp_posted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"client_submissions": {
                  Row: {
                    "booking_id": string,"guests_children": number,"guests_men": number,"guests_women": number,"handled_at": string | null,"handled_by": string | null,"id": string,"menu_items": NonNullable<Json>,"message": string | null,"org_id": string,"status": Database["public"]['Enums']["submission_status"],"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"guests_children": number,"guests_men": number,"guests_women": number,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"menu_items"?: NonNullable<Json>,"message"?: string | null,"org_id": string,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"guests_children"?: number,"guests_men"?: number,"guests_women"?: number,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"menu_items"?: NonNullable<Json>,"message"?: string | null,"org_id"?: string,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_submissions_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_submissions_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "kitchen_schedule"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_submissions_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_submissions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"closed_days": {
                  Row: {
                    "day": string,"evening_only": boolean,"org_id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"evening_only"?: boolean,"org_id": string,"reason": string
                  }
                  Update: {
                    "day"?: string,"evening_only"?: boolean,"org_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "closed_days_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"date_requests": {
                  Row: {
                    "client_email": string | null,"client_name": string,"client_phone": string,"created_at": string,"created_by": string | null,"event_date": string,"guests": number | null,"id": string,"notes": string | null,"org_id": string,"party_style": Database["public"]['Enums']["party_style"] | null,"slot_id": string,"status": Database["public"]['Enums']["request_status"],"updated_at": string,"venue_id": string | null,"was_full": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "client_email"?: string | null,"client_name": string,"client_phone"?: string,"created_at"?: string,"created_by"?: string | null,"event_date": string,"guests"?: number | null,"id"?: string,"notes"?: string | null,"org_id": string,"party_style"?: Database["public"]['Enums']["party_style"] | null,"slot_id": string,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string,"venue_id"?: string | null,"was_full": boolean
                  }
                  Update: {
                    "client_email"?: string | null,"client_name"?: string,"client_phone"?: string,"created_at"?: string,"created_by"?: string | null,"event_date"?: string,"guests"?: number | null,"id"?: string,"notes"?: string | null,"org_id"?: string,"party_style"?: Database["public"]['Enums']["party_style"] | null,"slot_id"?: string,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string,"venue_id"?: string | null,"was_full"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "date_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "date_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "date_requests_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "date_requests_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "active": boolean,"choice_count": number | null,"choice_from_section": boolean,"choice_options": (string)[] | null,"created_at": string,"extra_unit_label": string | null,"extra_unit_price_cents": number | null,"id": string,"included": boolean,"name": string,"org_id": string,"price_cents": number,"price_unit": Database["public"]['Enums']["menu_price_unit"],"section_id": string,"sort_order": number,"unit_label": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"choice_count"?: number | null,"choice_from_section"?: boolean,"choice_options"?: (string)[] | null,"created_at"?: string,"extra_unit_label"?: string | null,"extra_unit_price_cents"?: number | null,"id"?: string,"included"?: boolean,"name": string,"org_id": string,"price_cents"?: number,"price_unit"?: Database["public"]['Enums']["menu_price_unit"],"section_id": string,"sort_order"?: number,"unit_label"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"choice_count"?: number | null,"choice_from_section"?: boolean,"choice_options"?: (string)[] | null,"created_at"?: string,"extra_unit_label"?: string | null,"extra_unit_price_cents"?: number | null,"id"?: string,"included"?: boolean,"name"?: string,"org_id"?: string,"price_cents"?: number,"price_unit"?: Database["public"]['Enums']["menu_price_unit"],"section_id"?: string,"sort_order"?: number,"unit_label"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_items_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "menu_items_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "menu_sections"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_sections": {
                  Row: {
                    "created_at": string,"extra_choice_price_cents": number | null,"group_label": string | null,"id": string,"included_choices": number | null,"max_choices": number | null,"menu_id": string,"min_choices": number,"name": string,"note": string | null,"org_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"extra_choice_price_cents"?: number | null,"group_label"?: string | null,"id"?: string,"included_choices"?: number | null,"max_choices"?: number | null,"menu_id": string,"min_choices"?: number,"name": string,"note"?: string | null,"org_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"extra_choice_price_cents"?: number | null,"group_label"?: string | null,"id"?: string,"included_choices"?: number | null,"max_choices"?: number | null,"menu_id"?: string,"min_choices"?: number,"name"?: string,"note"?: string | null,"org_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_sections_menu_id_fkey"
      columns: ["menu_id"]
isOneToOne: false
      referencedRelation: "menus"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "menu_sections_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"menus": {
                  Row: {
                    "active": boolean,"base_price_cents": number,"child_price_cents": number | null,"child_price_percent": number,"created_at": string,"gratuity_percent": number,"guests_per_table": number,"id": string,"included_note": string | null,"min_children": number,"min_guests": number,"name": string,"occasions": (string)[] | null,"org_id": string,"pricing": Database["public"]['Enums']["menu_pricing"],"saturday_min_guests": number | null,"saturday_price_cents": number | null,"sort_order": number,"styles": (Database["public"]['Enums']["party_style"])[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"base_price_cents": number,"child_price_cents"?: number | null,"child_price_percent"?: number,"created_at"?: string,"gratuity_percent"?: number,"guests_per_table"?: number,"id"?: string,"included_note"?: string | null,"min_children"?: number,"min_guests"?: number,"name": string,"occasions"?: (string)[] | null,"org_id": string,"pricing"?: Database["public"]['Enums']["menu_pricing"],"saturday_min_guests"?: number | null,"saturday_price_cents"?: number | null,"sort_order"?: number,"styles": (Database["public"]['Enums']["party_style"])[],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"base_price_cents"?: number,"child_price_cents"?: number | null,"child_price_percent"?: number,"created_at"?: string,"gratuity_percent"?: number,"guests_per_table"?: number,"id"?: string,"included_note"?: string | null,"min_children"?: number,"min_guests"?: number,"name"?: string,"occasions"?: (string)[] | null,"org_id"?: string,"pricing"?: Database["public"]['Enums']["menu_pricing"],"saturday_min_guests"?: number | null,"saturday_price_cents"?: number | null,"sort_order"?: number,"styles"?: (Database["public"]['Enums']["party_style"])[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menus_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "address": string | null,"brand_color": string,"chanukah_prices": NonNullable<Json>,"client_after_enabled": boolean,"client_after_text": string,"client_before_days": number,"client_before_enabled": boolean,"client_before_text": string,"client_msg_hour": number,"client_msgs_confirmed_number": string | null,"client_msgs_enabled": boolean,"contract_days": number,"contract_terms": string | null,"created_at": string,"deposit_cents": number,"email": string | null,"final_days": number,"hold_hours": number,"holiday_gratuity_days": (string)[],"holiday_gratuity_percent": number,"id": string,"last_reminder_on": string | null,"name": string,"occasions": (string)[],"phone": string | null,"reminder_emails": (string)[],"reminder_enabled": boolean,"reminder_hour": number,"reminder_whatsapp": string | null,"sales_tax_percent": number,"slug": string,"tagline": string | null,"timezone": string,"updated_at": string,"waiter_extra_hour_cents": number | null,"waiter_hours_included": number,"waiter_min": number,"waiter_rate_cents": number,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"brand_color"?: string,"chanukah_prices"?: NonNullable<Json>,"client_after_enabled"?: boolean,"client_after_text"?: string,"client_before_days"?: number,"client_before_enabled"?: boolean,"client_before_text"?: string,"client_msg_hour"?: number,"client_msgs_confirmed_number"?: string | null,"client_msgs_enabled"?: boolean,"contract_days"?: number,"contract_terms"?: string | null,"created_at"?: string,"deposit_cents"?: number,"email"?: string | null,"final_days"?: number,"hold_hours"?: number,"holiday_gratuity_days"?: (string)[],"holiday_gratuity_percent"?: number,"id"?: string,"last_reminder_on"?: string | null,"name": string,"occasions"?: (string)[],"phone"?: string | null,"reminder_emails"?: (string)[],"reminder_enabled"?: boolean,"reminder_hour"?: number,"reminder_whatsapp"?: string | null,"sales_tax_percent"?: number,"slug": string,"tagline"?: string | null,"timezone"?: string,"updated_at"?: string,"waiter_extra_hour_cents"?: number | null,"waiter_hours_included"?: number,"waiter_min"?: number,"waiter_rate_cents"?: number,"website"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"brand_color"?: string,"chanukah_prices"?: NonNullable<Json>,"client_after_enabled"?: boolean,"client_after_text"?: string,"client_before_days"?: number,"client_before_enabled"?: boolean,"client_before_text"?: string,"client_msg_hour"?: number,"client_msgs_confirmed_number"?: string | null,"client_msgs_enabled"?: boolean,"contract_days"?: number,"contract_terms"?: string | null,"created_at"?: string,"deposit_cents"?: number,"email"?: string | null,"final_days"?: number,"hold_hours"?: number,"holiday_gratuity_days"?: (string)[],"holiday_gratuity_percent"?: number,"id"?: string,"last_reminder_on"?: string | null,"name"?: string,"occasions"?: (string)[],"phone"?: string | null,"reminder_emails"?: (string)[],"reminder_enabled"?: boolean,"reminder_hour"?: number,"reminder_whatsapp"?: string | null,"sales_tax_percent"?: number,"slug"?: string,"tagline"?: string | null,"timezone"?: string,"updated_at"?: string,"waiter_extra_hour_cents"?: number | null,"waiter_hours_included"?: number,"waiter_min"?: number,"waiter_rate_cents"?: number,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"display_name": string,"id": string,"org_id": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"display_name": string,"id": string,"org_id": string,"role": Database["public"]['Enums']["member_role"],"updated_at"?: string,"username": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"display_name"?: string,"id"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"slots": {
                  Row: {
                    "active": boolean,"allowed_styles": (Database["public"]['Enums']["party_style"])[] | null,"created_at": string,"end_latest": number | null,"id": string,"key": string,"label": string,"max_guests": number | null,"max_minutes": number,"org_id": string,"sort_order": number,"standard_time_only_weekdays": (number)[],"start_earliest": number,"start_latest": number,"updated_at": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"allowed_styles"?: (Database["public"]['Enums']["party_style"])[] | null,"created_at"?: string,"end_latest"?: number | null,"id"?: string,"key": string,"label": string,"max_guests"?: number | null,"max_minutes"?: number,"org_id": string,"sort_order"?: number,"standard_time_only_weekdays"?: (number)[],"start_earliest": number,"start_latest": number,"updated_at"?: string,"weekdays"?: (number)[]
                  }
                  Update: {
                    "active"?: boolean,"allowed_styles"?: (Database["public"]['Enums']["party_style"])[] | null,"created_at"?: string,"end_latest"?: number | null,"id"?: string,"key"?: string,"label"?: string,"max_guests"?: number | null,"max_minutes"?: number,"org_id"?: string,"sort_order"?: number,"standard_time_only_weekdays"?: (number)[],"start_earliest"?: number,"start_latest"?: number,"updated_at"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "slots_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"venues": {
                  Row: {
                    "active": boolean,"code": string,"color": string,"created_at": string,"exclusive": boolean,"extra_fee_cents": number,"id": string,"kind": Database["public"]['Enums']["venue_kind"],"name": string,"org_id": string,"slot_keys": (string)[] | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"color": string,"created_at"?: string,"exclusive"?: boolean,"extra_fee_cents"?: number,"id"?: string,"kind"?: Database["public"]['Enums']["venue_kind"],"name": string,"org_id": string,"slot_keys"?: (string)[] | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"color"?: string,"created_at"?: string,"exclusive"?: boolean,"extra_fee_cents"?: number,"id"?: string,"kind"?: Database["public"]['Enums']["venue_kind"],"name"?: string,"org_id"?: string,"slot_keys"?: (string)[] | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venues_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "kitchen_menu": {
                  Row: {
                    "booking_id": string,"choices": (string)[],"extra_unit_label": string | null,"item_name": string,"item_order": number,"price_unit": Database["public"]['Enums']["menu_price_unit"],"quantity": number,"section_name": string,"section_order": number,"unit_label": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "booking_menu_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_menu_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "kitchen_schedule"
      referencedColumns: ["id"]
    }
                  ]
                },"kitchen_schedule": {
                  Row: {
                    "duration_minutes": number,"event_date": string,"final_confirmed": boolean,"guests_children": number,"guests_men": number,"guests_total": number | null,"guests_women": number,"head_table": boolean,"id": string,"mechitza": boolean,"menu_notes": string | null,"occasion": Database["public"]['Enums']["party_occasion"] | null,"occasion_other": string | null,"org_id": string,"other_venue_name": string | null,"party_style": Database["public"]['Enums']["party_style"],"slot_id": string,"start_minute": number,"venue_address": string | null,"venue_id": string,"waiters": number
                  }
                  ComputedFields: never
                  Insert: {
                           "duration_minutes"?: number | null,"event_date"?: string | null,"final_confirmed"?: boolean | null,"guests_children"?: number | null,"guests_men"?: number | null,"guests_total"?: number | null,"guests_women"?: number | null,"head_table"?: boolean | null,"id"?: string | null,"mechitza"?: boolean | null,"menu_notes"?: string | null,"occasion"?: Database["public"]['Enums']["party_occasion"] | null,"occasion_other"?: string | null,"org_id"?: string | null,"other_venue_name"?: string | null,"party_style"?: Database["public"]['Enums']["party_style"] | null,"slot_id"?: string | null,"start_minute"?: number | null,"venue_address"?: string | null,"venue_id"?: string | null,"waiters"?: number | null
                         }
                        Update: {
                           "duration_minutes"?: number | null,"event_date"?: string | null,"final_confirmed"?: boolean | null,"guests_children"?: number | null,"guests_men"?: number | null,"guests_total"?: number | null,"guests_women"?: number | null,"head_table"?: boolean | null,"id"?: string | null,"mechitza"?: boolean | null,"menu_notes"?: string | null,"occasion"?: Database["public"]['Enums']["party_occasion"] | null,"occasion_other"?: string | null,"org_id"?: string | null,"other_venue_name"?: string | null,"party_style"?: Database["public"]['Enums']["party_style"] | null,"slot_id"?: string | null,"start_minute"?: number | null,"venue_address"?: string | null,"venue_id"?: string | null,"waiters"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "bookings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_add_member":
{ Args: { "p_display_name": string,"p_role": Database["public"]['Enums']["member_role"],"p_user_id": string,"p_username": string }; Returns: {
              "active": boolean,
"created_at": string,
"display_name": string,
"id": string,
"org_id": string,
"role": Database["public"]['Enums']["member_role"],
"updated_at": string,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_import_booking":
{ Args: { "p": Json }; Returns: string
                           },
"admin_update_member":
{ Args: { "p_active": boolean,"p_display_name": string,"p_role": Database["public"]['Enums']["member_role"],"p_user_id": string }; Returns: {
              "active": boolean,
"created_at": string,
"display_name": string,
"id": string,
"org_id": string,
"role": Database["public"]['Enums']["member_role"],
"updated_at": string,
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_booking_menu":
{ Args: { "p_booking_id": string,"p_items": Json,"p_notes": string }; Returns: undefined
                           }
          }
          Enums: {
            "booking_status": "hold"|"booked"|"cancelled"|"expired","member_role": "admin"|"editor"|"kitchen","menu_price_unit": "per_person"|"flat"|"per_unit"|"per_table","menu_pricing": "per_person"|"package","party_occasion": "sheva_brachos"|"bris"|"bat_mitzvah"|"corporate"|"upsherin"|"other"|"melava_malka"|"shalosh_seudos"|"kiddush"|"vort","party_style": "plated"|"family"|"buffet"|"bris","payment_method": "cash"|"check"|"zelle"|"credit_card","request_status": "waiting"|"contacted"|"booked"|"not_interested","submission_status": "pending"|"applied"|"dismissed","venue_kind": "event_space"|"catering"|"other"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "booking_status": ["hold", "booked", "cancelled", "expired"],"member_role": ["admin", "editor", "kitchen"],"menu_price_unit": ["per_person", "flat", "per_unit", "per_table"],"menu_pricing": ["per_person", "package"],"party_occasion": ["sheva_brachos", "bris", "bat_mitzvah", "corporate", "upsherin", "other", "melava_malka", "shalosh_seudos", "kiddush", "vort"],"party_style": ["plated", "family", "buffet", "bris"],"payment_method": ["cash", "check", "zelle", "credit_card"],"request_status": ["waiting", "contacted", "booked", "not_interested"],"submission_status": ["pending", "applied", "dismissed"],"venue_kind": ["event_space", "catering", "other"]
          }
        }
} as const
