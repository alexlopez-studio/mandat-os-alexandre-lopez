/**
 * Seed script — Insère toutes les données mock actuelles dans Supabase
 *
 * Usage :
 *   node scripts/seed-db.mjs
 *
 * Prérequis :
 *   - .env.local avec les variables Supabase
 *   - Les migrations SQL déjà appliquées (tables existantes)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Charger les variables d'environnement depuis .env.local
config({ path: resolve(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

// ── UUIDs prédéfinis pour les références croisées ───────────────

const UUID = {
    // Prospects
    prospectJean: '00000000-0000-0000-0000-000000000001',
    prospectMarie: '00000000-0000-0000-0000-000000000002',
    prospectPierre: '00000000-0000-0000-0000-000000000003',
    prospectSophie: '00000000-0000-0000-0000-000000000004',

    // Leads
    leadVendre1: '00000000-0000-0000-0000-000000000011',
    leadAcheter1: '00000000-0000-0000-0000-000000000012',
    leadVendre2: '00000000-0000-0000-0000-000000000013',
    leadAudit1: '00000000-0000-0000-0000-000000000014',

    // Buyers (buyer_criteria lead_id = lead id)
    buyerLead1: '00000000-0000-0000-0000-000000000021',
    buyerLead2: '00000000-0000-0000-0000-000000000022',

    // Seller properties
    seller1: '00000000-0000-0000-0000-000000000031',
    seller2: '00000000-0000-0000-0000-000000000032',

    // Market properties
    market1: '00000000-0000-0000-0000-000000000041',
    market2: '00000000-0000-0000-0000-000000000042',
    market3: '00000000-0000-0000-0000-000000000043',
    market4: '00000000-0000-0000-0000-000000000044',
    market5: '00000000-0000-0000-0000-000000000045',
    market6: '00000000-0000-0000-0000-000000000046',
    market7: '00000000-0000-0000-0000-000000000047',
    market8: '00000000-0000-0000-0000-000000000048',

    // Match results
    match1: '00000000-0000-0000-0000-000000000051',
    match2: '00000000-0000-0000-0000-000000000052',

    // Notifications
    notif1: '00000000-0000-0000-0000-000000000061',
    notif2: '00000000-0000-0000-0000-000000000062',
    notif3: '00000000-0000-0000-0000-000000000063',
    notif4: '00000000-0000-0000-0000-000000000064',
    notif5: '00000000-0000-0000-0000-000000000065',

    // Opportunities
    opp1: '00000000-0000-0000-0000-000000000071',
    opp2: '00000000-0000-0000-0000-000000000072',
    opp3: '00000000-0000-0000-0000-000000000073',
    opp4: '00000000-0000-0000-0000-000000000074',
    opp5: '00000000-0000-0000-0000-000000000075',
    opp6: '00000000-0000-0000-0000-000000000076',
    opp7: '00000000-0000-0000-0000-000000000077',
    opp8: '00000000-0000-0000-0000-000000000078',

    // Monitored zones
    zone1: '00000000-0000-0000-0000-000000000081',
    zone2: '00000000-0000-0000-0000-000000000082',
    zone3: '00000000-0000-0000-0000-000000000083',
    zone4: '00000000-0000-0000-0000-000000000084',
};

// ── Helper dates ──────────────────────────────────────────────
function ago(days = 0, hours = 0, minutes = 0) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(d.getHours() - hours);
    d.setMinutes(d.getMinutes() - minutes);
    return d.toISOString();
}

function fromNow(days = 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

// ── Seed data ──────────────────────────────────────────────────

const prospects = [
    {
        id: UUID.prospectJean,
        email: 'jean.dupont@email.fr',
        first_name: 'Jean',
        last_name: 'Dupont',
        phone: '0612345678',
        rgpd_consent_at: ago(30),
        created_at: ago(30),
        updated_at: ago(1),
    },
    {
        id: UUID.prospectMarie,
        email: 'marie.martin@email.fr',
        first_name: 'Marie',
        last_name: 'Martin',
        phone: '0623456789',
        rgpd_consent_at: ago(15),
        created_at: ago(15),
        updated_at: ago(2),
    },
    {
        id: UUID.prospectPierre,
        email: 'pierre.bernard@email.fr',
        first_name: 'Pierre',
        last_name: 'Bernard',
        phone: null,
        rgpd_consent_at: ago(7),
        created_at: ago(7),
        updated_at: ago(0, 6),
    },
    {
        id: UUID.prospectSophie,
        email: 'sophie.petit@email.fr',
        first_name: 'Sophie',
        last_name: 'Petit',
        phone: '0645678901',
        rgpd_consent_at: ago(3),
        created_at: ago(3),
        updated_at: ago(0, 1),
    },
];

const leads = [
    {
        id: UUID.leadVendre1,
        prospect_id: UUID.prospectJean,
        tool: 'vendre',
        status: 'nouveau',
        form_data: {
            adresse: '15 Rue des Oliviers, Brignoles',
            type_bien: 'maison',
            surface: 120,
            nb_pieces: 5,
            terrain: 500,
            etat: 'bon',
        },
        results: {
            estimation_basse: 320000,
            estimation_haute: 380000,
            prix_m2: 2917,
        },
        commune: 'Brignoles',
        magic_link_expires_at: fromNow(30),
        created_at: ago(1),
        updated_at: ago(0, 3),
    },
    {
        id: UUID.leadAcheter1,
        prospect_id: UUID.prospectMarie,
        tool: 'acheter',
        status: 'contacte',
        form_data: {
            communes: ['Cotignac', 'Carcès'],
            type_bien: 'maison',
            budget_max: 350000,
            surface_min: 80,
        },
        results: {},
        commune: 'Cotignac',
        magic_link_sent_at: ago(0, 12),
        magic_link_expires_at: fromNow(30),
        created_at: ago(2),
        updated_at: ago(0, 12),
    },
    {
        id: UUID.leadVendre2,
        prospect_id: UUID.prospectPierre,
        tool: 'vendre',
        status: 'r1',
        form_data: {
            adresse: 'Chemin des Pins, Cotignac',
            type_bien: 'villa',
            surface: 200,
            nb_pieces: 6,
            terrain: 1500,
            piscine: true,
        },
        results: {
            estimation_basse: 650000,
            estimation_haute: 750000,
            prix_m2: 3500,
        },
        commune: 'Cotignac',
        magic_link_sent_at: ago(0, 6),
        magic_link_expires_at: fromNow(30),
        created_at: ago(3),
        updated_at: ago(0, 6),
    },
    {
        id: UUID.leadAudit1,
        prospect_id: UUID.prospectSophie,
        tool: 'audit',
        status: 'nouveau',
        form_data: {
            type_bien: 'appartement',
            surface: 55,
            adresse: '12 Rue du Centre, Saint-Maximin',
            annee_construction: 1985,
        },
        results: {
            dpe_estime: 'D',
            travaux_estimes: 15000,
        },
        commune: 'Saint-Maximin',
        magic_link_expires_at: fromNow(30),
        created_at: ago(0, 2),
        updated_at: ago(0, 2),
    },
];

const leadEvents = [
    {
        lead_id: UUID.leadAcheter1,
        kind: 'status_change',
        payload: { status: 'contacte' },
        created_by: 'Alexandre Lopez',
        created_at: ago(0, 12),
    },
    {
        lead_id: UUID.leadVendre2,
        kind: 'status_change',
        payload: { status: 'r1' },
        created_by: 'Alexandre Lopez',
        created_at: ago(0, 6),
    },
    {
        lead_id: UUID.leadVendre2,
        kind: 'note',
        payload: { text: 'Client intéressant, belle villa avec piscine. À recontacter pour visite.' },
        created_by: 'Alexandre Lopez',
        created_at: ago(0, 5),
    },
];

const adminUsers = [
    { email: 'alexlopez.studio@gmail.com', is_active: true },
];

// ── Market properties ──────────────────────────────────────────

const marketProperties = [
    {
        id: UUID.market1,
        external_id: 'ext-cotignac-1',
        source: 'leboncoin',
        title: 'Maison de village 4 pièces',
        description: 'Charmante maison de village à Cotignac',
        city: 'Cotignac',
        zipcode: '83570',
        lat: 43.5283,
        lon: 6.1525,
        property_type: 'Maison',
        price: 295000,
        surface: 110,
        price_per_m2: 2682,
        rooms: 4,
        bedrooms: 3,
        dpe: 'D',
        status: 'actif',
        first_seen_at: ago(15),
        last_seen_at: ago(0),
        published_at: ago(15),
        raw_json: {},
    },
    {
        id: UUID.market2,
        external_id: 'ext-brignoles-1',
        source: 'leboncoin',
        title: 'Villa contemporaine 5 pièces',
        description: 'Villa contemporaine avec piscine à Brignoles',
        city: 'Brignoles',
        zipcode: '83170',
        lat: 43.4067,
        lon: 6.0617,
        property_type: 'Villa',
        price: 459000,
        surface: 160,
        price_per_m2: 2869,
        rooms: 5,
        bedrooms: 4,
        dpe: 'B',
        status: 'prix_en_baisse',
        first_seen_at: ago(45),
        last_seen_at: ago(0),
        published_at: ago(45),
        raw_json: {},
    },
    {
        id: UUID.market3,
        external_id: 'ext-stmaximin-1',
        source: 'seloger',
        title: 'Appartement T3 centre historique',
        description: 'Bel appartement T3 au coeur de Saint-Maximin',
        city: 'Saint-Maximin',
        zipcode: '83470',
        lat: 43.4533,
        lon: 5.8667,
        property_type: 'Appartement',
        price: 189000,
        surface: 72,
        price_per_m2: 2625,
        rooms: 3,
        bedrooms: 2,
        dpe: 'C',
        status: 'nouveau',
        first_seen_at: ago(2),
        last_seen_at: ago(0),
        published_at: ago(2),
        raw_json: {},
    },
    {
        id: UUID.market4,
        external_id: 'ext-barjols-1',
        source: 'leboncoin',
        title: 'Bastide provençale 6 pièces',
        description: 'Superbe bastide provençale à Barjols',
        city: 'Barjols',
        zipcode: '83670',
        lat: 43.5583,
        lon: 6.0075,
        property_type: 'Bastide',
        price: 625000,
        surface: 200,
        price_per_m2: 3125,
        rooms: 6,
        bedrooms: 4,
        dpe: 'E',
        status: 'stagne',
        first_seen_at: ago(120),
        last_seen_at: ago(0),
        published_at: ago(120),
        raw_json: {},
    },
    {
        id: UUID.market5,
        external_id: 'ext-carces-1',
        source: 'seloger',
        title: 'Terrain constructible 800m²',
        description: 'Terrain constructible viabilisé à Carcès',
        city: 'Carcès',
        zipcode: '83570',
        lat: 43.475,
        lon: 6.1833,
        property_type: 'Terrain',
        price: 85000,
        surface: 800,
        price_per_m2: 106,
        rooms: 0,
        bedrooms: 0,
        dpe: null,
        status: 'opportunite',
        first_seen_at: ago(30),
        last_seen_at: ago(0),
        published_at: ago(30),
        raw_json: {},
    },
    {
        id: UUID.market6,
        external_id: 'ext-carces-2',
        source: 'leboncoin',
        title: 'Villa 4 pièces avec piscine',
        description: 'Belle villa avec piscine à Carcès',
        city: 'Carcès',
        zipcode: '83570',
        lat: 43.48,
        lon: 6.19,
        property_type: 'Villa',
        price: 385000,
        surface: 130,
        price_per_m2: 2962,
        rooms: 4,
        bedrooms: 3,
        dpe: 'C',
        status: 'actif',
        first_seen_at: ago(8),
        last_seen_at: ago(0),
        published_at: ago(8),
        raw_json: {},
    },
    {
        id: UUID.market7,
        external_id: 'ext-cotignac-2',
        source: 'seloger',
        title: 'Maison de maître 7 pièces',
        description: 'Maison de maître avec jardin à Cotignac',
        city: 'Cotignac',
        zipcode: '83570',
        lat: 43.535,
        lon: 6.16,
        property_type: 'Maison',
        price: 720000,
        surface: 250,
        price_per_m2: 2880,
        rooms: 7,
        bedrooms: 5,
        dpe: 'F',
        status: 'prix_en_baisse',
        first_seen_at: ago(90),
        last_seen_at: ago(0),
        published_at: ago(90),
        raw_json: {},
    },
    {
        id: UUID.market8,
        external_id: 'ext-brignoles-2',
        source: 'leboncoin',
        title: 'Appartement T2 centre ville',
        description: 'Appartement T2 en centre ville de Brignoles',
        city: 'Brignoles',
        zipcode: '83170',
        lat: 43.41,
        lon: 6.065,
        property_type: 'Appartement',
        price: 135000,
        surface: 52,
        price_per_m2: 2596,
        rooms: 2,
        bedrooms: 1,
        dpe: 'D',
        status: 'nouveau',
        first_seen_at: ago(1),
        last_seen_at: ago(0),
        published_at: ago(1),
        raw_json: {},
    },
];

// Tags for market properties
const propertyTags = [
    { market_property_id: UUID.market1, tag: 'Jardin', source: 'manual' },
    { market_property_id: UUID.market1, tag: 'Vue', source: 'manual' },
    { market_property_id: UUID.market2, tag: 'Piscine', source: 'manual' },
    { market_property_id: UUID.market2, tag: 'Garage', source: 'manual' },
    { market_property_id: UUID.market2, tag: 'Terrasse', source: 'manual' },
    { market_property_id: UUID.market3, tag: 'Balcon', source: 'manual' },
    { market_property_id: UUID.market3, tag: 'Ascenseur', source: 'manual' },
    { market_property_id: UUID.market4, tag: 'Piscine', source: 'manual' },
    { market_property_id: UUID.market4, tag: 'Puits', source: 'manual' },
    { market_property_id: UUID.market5, tag: 'Viabilisé', source: 'manual' },
    { market_property_id: UUID.market6, tag: 'Piscine', source: 'manual' },
    { market_property_id: UUID.market6, tag: 'Climatisation', source: 'manual' },
    { market_property_id: UUID.market7, tag: 'Jardin', source: 'manual' },
    { market_property_id: UUID.market7, tag: 'Cave', source: 'manual' },
    { market_property_id: UUID.market7, tag: 'Grenier', source: 'manual' },
    { market_property_id: UUID.market8, tag: 'Centre', source: 'manual' },
    { market_property_id: UUID.market8, tag: 'Commerces', source: 'manual' },
];

// Price history for properties with price drops
const priceHistory = [
    {
        market_property_id: UUID.market2,
        old_price: 505000,
        new_price: 459000,
        variation_amount: -46000,
        variation_percent: -9.1,
        detected_at: ago(2),
    },
    {
        market_property_id: UUID.market7,
        old_price: 750000,
        new_price: 720000,
        variation_amount: -30000,
        variation_percent: -4.0,
        detected_at: ago(5),
    },
];

// ── Buyer criteria ─────────────────────────────────────────────

const buyerCriteria = [
    {
        lead_id: UUID.buyerLead1,
        type_bien: 'maison',
        communes: ['Cotignac', 'Carcès', 'Brignoles'],
        budget_max: 400000,
        surface_min: 90,
        pieces_min: 4,
        criteres: ['jardin', 'calme'],
        active: true,
        created_at: ago(7),
        updated_at: ago(2),
    },
    {
        lead_id: UUID.buyerLead2,
        type_bien: 'appartement',
        communes: ['Saint-Maximin', 'Brignoles'],
        budget_max: 200000,
        surface_min: 60,
        pieces_min: 3,
        criteres: ['balcon', 'ascenseur'],
        active: true,
        created_at: ago(3),
        updated_at: ago(0, 12),
    },
];

// ── Seller properties ──────────────────────────────────────────

const sellerProperties = [
    {
        id: UUID.seller1,
        lead_id: UUID.leadVendre1,
        adresse: '15 Rue des Oliviers, Brignoles',
        type_bien: 'maison',
        surface: 120,
        surface_terrain: 500,
        nb_pieces: 5,
        etat: 'bon',
        prix_estime: 350000,
        actif: true,
        created_at: ago(1),
        updated_at: ago(0, 3),
    },
    {
        id: UUID.seller2,
        lead_id: UUID.leadVendre2,
        adresse: 'Chemin des Pins, Cotignac',
        type_bien: 'villa',
        surface: 200,
        surface_terrain: 1500,
        nb_pieces: 6,
        etat: 'tres_bon',
        dpe: 'C',
        equipements: ['piscine', 'garage'],
        prix_estime: 700000,
        actif: true,
        created_at: ago(3),
        updated_at: ago(0, 6),
    },
];

// ── Match results ──────────────────────────────────────────────

const matchResults = [
    {
        id: UUID.match1,
        buyer_lead_id: UUID.buyerLead1,
        property_id: UUID.market1,
        seller_lead_id: null,
        property_type: 'market',
        score: 82,
        score_details: { commune: 25, type: 20, budget: 20, surface: 10, pieces: 7 },
        matched_commune: true,
        matched_type: true,
        matched_budget: true,
        matched_surface: true,
        matched_pieces: true,
        created_at: ago(1),
    },
    {
        id: UUID.match2,
        buyer_lead_id: UUID.buyerLead2,
        property_id: UUID.market3,
        seller_lead_id: null,
        property_type: 'market',
        score: 75,
        score_details: { commune: 20, type: 20, budget: 20, surface: 10, pieces: 5 },
        matched_commune: true,
        matched_type: true,
        matched_budget: true,
        matched_surface: true,
        matched_pieces: true,
        created_at: ago(0, 6),
    },
];

// ── Monitored zones ──────────────────────────────────────────

const monitoredZones = [
    {
        id: UUID.zone1,
        name: 'Provence Verte Centre',
        zipcode: '83170',
        city: 'Brignoles',
        radius_km: 15,
        active: true,
        sync_frequency: 'daily',
        last_synced_at: ago(0, 0, 30),
        created_at: ago(30),
        updated_at: ago(0, 0, 30),
    },
    {
        id: UUID.zone2,
        name: 'Barjols et environs',
        zipcode: '83670',
        city: 'Barjols',
        radius_km: 10,
        active: true,
        sync_frequency: 'daily',
        last_synced_at: ago(0, 0, 45),
        created_at: ago(30),
        updated_at: ago(0, 0, 45),
    },
    {
        id: UUID.zone3,
        name: 'Cotignac / Lorgues',
        zipcode: '83510',
        city: 'Cotignac',
        radius_km: 12,
        active: true,
        sync_frequency: 'daily',
        last_synced_at: ago(0, 0, 20),
        created_at: ago(30),
        updated_at: ago(0, 0, 20),
    },
    {
        id: UUID.zone4,
        name: 'Saint-Maximin',
        zipcode: '83470',
        city: 'Saint-Maximin-la-Sainte-Baume',
        radius_km: 10,
        active: false,
        sync_frequency: 'weekly',
        last_synced_at: ago(3),
        created_at: ago(30),
        updated_at: ago(3),
    },
];

// ── Notifications ──────────────────────────────────────────────

const notifications = [
    {
        id: UUID.notif1,
        type: 'price_drop',
        title: 'Baisse de prix détectée',
        message: 'Villa contemporaine 5 pièces à Brignoles — 505 000 € → 459 000 € (-9.1%)',
        market_property_id: UUID.market2,
        priority: 'high',
        status: 'unread',
        action_label: 'Voir le bien',
        created_at: ago(0, 0, 15),
    },
    {
        id: UUID.notif2,
        type: 'new_listing',
        title: 'Nouveau bien sur le marché',
        message: 'Appartement T2 à Brignoles — 135 000 €',
        market_property_id: UUID.market8,
        priority: 'medium',
        status: 'unread',
        action_label: 'Analyser',
        created_at: ago(0, 1),
    },
    {
        id: UUID.notif3,
        type: 'expired',
        title: 'Bien expiré',
        message: 'Appartement T3 à Saint-Maximin — 189 000 €, en ligne depuis 90 jours',
        market_property_id: UUID.market3,
        priority: 'medium',
        status: 'read',
        created_at: ago(0, 3),
    },
    {
        id: UUID.notif4,
        type: 'match',
        title: 'Nouveau matching',
        message: 'Acheteur potentiel pour bastide Barjols (625 000 €)',
        market_property_id: UUID.market4,
        priority: 'high',
        status: 'unread',
        action_label: 'Voir le match',
        opportunity_id: UUID.opp1,
        created_at: ago(0, 5),
    },
    {
        id: UUID.notif5,
        type: 'system',
        title: 'Synchronisation terminée',
        message: 'Les données marché ont été mises à jour pour toutes les zones.',
        priority: 'low',
        status: 'processed',
        created_at: ago(1),
    },
];

// ── Opportunities ──────────────────────────────────────────────

const opportunities = [
    {
        id: UUID.opp1,
        market_property_id: UUID.market2,
        title: 'Villa contemporaine — baisse de 9.1%',
        description: 'Bien passé de 505k€ à 459k€. Bonne opportunité de mandat.',
        stage: 'a_contacter',
        priority: 'high',
        signal_type: 'price_drop',
        next_action: 'Appeler le vendeur',
        due_date: fromNow(2),
        created_from: 'system',
        created_at: ago(1),
        updated_at: ago(0, 2),
    },
    {
        id: UUID.opp2,
        market_property_id: UUID.market3,
        title: 'Nouveau bien à Saint-Maximin',
        description: 'Appartement T3 à 189k€. Premier sur le marché.',
        stage: 'a_analyser',
        priority: 'medium',
        signal_type: 'new_listing',
        next_action: 'Analyser le DPE',
        created_from: 'system',
        created_at: ago(2),
        updated_at: ago(1),
    },
    {
        id: UUID.opp3,
        market_property_id: UUID.market4,
        title: 'Bastide Barjols — sous-évaluée',
        description: 'Prix/m² à 3125€ vs 3450€ moyenne. Vendeur potentiellement pressé.',
        stage: 'a_qualifier',
        priority: 'critical',
        signal_type: 'undervalued',
        next_action: 'Estimation rapide',
        due_date: fromNow(1),
        created_from: 'system',
        created_at: ago(0, 12),
        updated_at: ago(0, 6),
    },
    {
        id: UUID.opp4,
        market_property_id: UUID.market5,
        title: 'Terrain Carcès — viabilisé',
        description: 'Terrain 800m² à 85k€. Forte demande dans ce secteur.',
        stage: 'en_suivi',
        priority: 'low',
        signal_type: 'manual',
        next_action: 'Contacter mairie pour PLU',
        due_date: fromNow(7),
        created_from: 'manual',
        created_at: ago(5),
        updated_at: ago(1),
    },
    {
        id: UUID.opp5,
        market_property_id: UUID.market7,
        title: 'Maison Cotignac — 120 jours en ligne',
        description: 'Bien qui stagne depuis 4 mois. Vendeur probablement ouvert à discussion.',
        stage: 'a_contacter',
        priority: 'medium',
        signal_type: 'expired',
        next_action: 'Proposition de mandat',
        due_date: fromNow(3),
        created_from: 'system',
        created_at: ago(3),
        updated_at: ago(1),
    },
    {
        id: UUID.opp6,
        market_property_id: UUID.market6,
        title: 'Villa Carcès avec piscine',
        description: 'Bien récent (8j), bien valorisé. Surveiller évolution.',
        stage: 'a_analyser',
        priority: 'medium',
        signal_type: 'new_listing',
        next_action: 'Comparer avec estimation',
        created_from: 'system',
        created_at: ago(1),
        updated_at: ago(0, 6),
    },
    {
        id: UUID.opp7,
        market_property_id: UUID.market8,
        title: 'Appartement Brignoles — bon plan',
        description: 'T2 à 135k€ en centre-ville. Excellent rapport qualité-prix.',
        stage: 'rendez_vous',
        priority: 'high',
        signal_type: 'undervalued',
        next_action: 'Préparer visite',
        due_date: fromNow(5),
        created_from: 'system',
        created_at: ago(4),
        updated_at: ago(1),
    },
    {
        id: UUID.opp8,
        market_property_id: UUID.market1,
        title: 'Maison Cotignac — suivi client',
        description: 'Client intéressé. Envoyer sélection de biens similaires.',
        stage: 'en_suivi',
        priority: 'high',
        signal_type: 'manual',
        next_action: 'Envoyer sélection',
        due_date: fromNow(1),
        created_from: 'manual',
        created_at: ago(7),
        updated_at: ago(1),
    },
];

// ── Management rules (migration 003) ────────────────────────────

const managementRules = [
    {
        name: 'Baisse significative > 5%',
        description: 'Détecte les biens dont le prix a baissé de plus de 5% et crée une opportunité haute priorité.',
        active: true,
        trigger_type: 'big_price_drop',
        conditions_json: { all: [] },
        actions_json: {
            actions: [
                { type: 'create_notification', value: 'Baisse significative détectée', priority: 'high' },
                { type: 'create_opportunity', value: 'Baisse > 5%', stage: 'À qualifier', priority: 'high' },
                { type: 'add_tag', value: 'Baisse significative' },
            ],
        },
        priority: 'high',
    },
    {
        name: 'Nouveaux biens à surveiller',
        description: 'Notifie dès qu\'un nouveau bien correspondant aux critères de mandat apparaît sur le marché.',
        active: true,
        trigger_type: 'new_listing',
        conditions_json: { all: [] },
        actions_json: {
            actions: [
                { type: 'create_notification', value: 'Nouveau bien sur le marché', priority: 'medium' },
                { type: 'add_tag', value: 'Nouvelle annonce' },
            ],
        },
        priority: 'medium',
    },
    {
        name: 'Biens sous-évalués',
        description: 'Identifie les biens dont le prix/m² est inférieur de 15% à la moyenne de la zone.',
        active: true,
        trigger_type: 'price_per_m2_below',
        conditions_json: { all: [] },
        actions_json: {
            actions: [
                { type: 'create_notification', value: 'Bien potentiellement sous-évalué', priority: 'high' },
                { type: 'create_opportunity', value: 'Sous-évalué', stage: 'À analyser', priority: 'high' },
                { type: 'add_tag', value: 'Sous-évalué' },
            ],
        },
        priority: 'high',
    },
    {
        name: 'Biens stagnants > 90 jours',
        description: 'Surveille les biens en ligne depuis plus de 90 jours sans baisse de prix.',
        active: false,
        trigger_type: 'days_online_exceeded',
        conditions_json: { all: [{ field: 'days_online', operator: 'gt', value: 90 }] },
        actions_json: {
            actions: [
                { type: 'create_notification', value: 'Bien stagne depuis plus de 90 jours', priority: 'medium' },
                { type: 'create_opportunity', value: 'Bien stagnant', stage: 'À contacter', priority: 'medium' },
                { type: 'add_tag', value: 'Stagnant' },
            ],
        },
        priority: 'medium',
    },
    {
        name: 'Baisse modérée 2-5%',
        description: 'Détecte les baisses de prix modérées pour suivi commercial.',
        active: false,
        trigger_type: 'price_drop',
        conditions_json: { all: [] },
        actions_json: {
            actions: [
                { type: 'create_notification', value: 'Baisse modérée détectée', priority: 'low' },
                { type: 'add_tag', value: 'Baisse modérée' },
            ],
        },
        priority: 'low',
    },
    {
        name: 'Annonces expirées',
        description: 'Repère les annonces qui expirent et pourraient être reprises en mandat.',
        active: true,
        trigger_type: 'expired',
        conditions_json: { all: [] },
        actions_json: {
            actions: [
                { type: 'create_notification', value: 'Annonce expirée détectée', priority: 'medium' },
                { type: 'create_opportunity', value: 'Annonce expirée', stage: 'À contacter', priority: 'medium' },
                { type: 'add_tag', value: 'Expiré' },
            ],
        },
        priority: 'medium',
    },
];

// ── Execute seed ────────────────────────────────────────────────

async function seed() {
    let errors = 0;

    async function insert(table, data) {
        if (data.length === 0) return;
        const { error } = await supabase.from(table).upsert(data, { onConflict: 'id', ignoreDuplicates: false });
        if (error) {
            console.error(`❌ ${table}: ${error.message}`);
            errors++;
        } else {
            console.log(`✅ ${table}: ${data.length} ligne(s) insérée(s)`);
        }
    }

    console.log('🚀 Seeding Supabase...\n');

    // Clear existing data in reverse dependency order
    const tables = [
        'match_results', 'property_tags', 'property_price_history',
        'notifications', 'opportunities', 'property_notes',
        'seller_properties', 'buyer_criteria', 'lead_events',
        'leads', 'prospects', 'market_properties',
        'monitored_zones', 'management_rules', 'admin_users',
    ];

    for (const table of tables) {
        await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    console.log('🗑️  Anciennes données supprimées\n');

    // Insert in dependency order (parents before children)
    await insert('admin_users', adminUsers);
    await insert('prospects', prospects);
    await insert('leads', leads);
    await insert('lead_events', leadEvents);
    await insert('market_properties', marketProperties);
    await insert('property_price_history', priceHistory);  // depends on market_properties
    await insert('property_tags', propertyTags);           // depends on market_properties
    await insert('opportunities', opportunities);          // depends on market_properties
    await insert('monitored_zones', monitoredZones);
    await insert('management_rules', managementRules);

    // Try tables that might not exist yet (migration 004)
    for (const [table, data] of Object.entries({ buyer_criteria: buyerCriteria, seller_properties: sellerProperties, match_results: matchResults })) {
        if (data.length === 0) continue;
        const { error } = await supabase.from(table).upsert(data, { onConflict: 'id', ignoreDuplicates: false });
        if (error) {
            console.log(`ℹ️  ${table}: schéma non trouvé (migration 004 à appliquer ?)`);
        } else {
            console.log(`✅ ${table}: ${data.length} ligne(s) insérée(s)`);
        }
    }

    // Insert notifications AFTER opportunities (FK dependency)
    await insert('notifications', notifications);

    console.log('\n' + (errors === 0 ? '✅ Seed terminé avec succès !' : `⚠️  ${errors} erreur(s)`));
    process.exit(errors > 0 ? 1 : 0);
}

seed();