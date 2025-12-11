-- ========================================
-- 🎯 JEU DE DONNÉES FICTIF - GoodBarber 2026 HQ
-- ========================================
-- 
-- Ce fichier contient un jeu de données complet et cohérent
-- pour la base de données Room Barber.
--
-- Structure:
-- 1. USERS (10 utilisateurs GoodBarber)
-- 2. ROOMS (8 salles avec types différents)
-- 3. MEETINGS (20 réunions cohérentes pour cette semaine)
--
-- Date de référence: 11-15 décembre 2025
-- Timezone: Europe/Paris (UTC+1)
--
-- ========================================

-- =======================================================
-- 1️⃣  DONNÉES DES UTILISATEURS (10 de différentes sociétés)
-- =======================================================

INSERT INTO public.users (id, full_name, email, society, pmr_needed, created_at) VALUES

-- Clients Majeurs (FAANG)
('550e8400-e29b-41d4-a716-446655440001', 'Marie Dupont', 'marie.dupont@microsoft.com', 'Microsoft', FALSE, '2025-11-01T08:00:00Z'),
('550e8400-e29b-41d4-a716-446655440002', 'Pierre Martin', 'pierre.martin@google.com', 'Google Cloud', FALSE, '2025-11-01T08:00:00Z'),
('550e8400-e29b-41d4-a716-446655440003', 'Sophie Bernard', 'sophie.bernard@amazon.com', 'Amazon Web Services', TRUE, '2025-11-05T09:15:00Z'),
('550e8400-e29b-41d4-a716-446655440004', 'Luc Fontaine', 'luc.fontaine@apple.com', 'Apple', FALSE, '2025-11-05T09:15:00Z'),
('550e8400-e29b-41d4-a716-446655440005', 'Claire Rousseau', 'claire.rousseau@meta.com', 'Meta (Facebook)', FALSE, '2025-11-05T09:15:00Z'),

-- Partenaires/Fournisseurs (B2B)
('550e8400-e29b-41d4-a716-446655440006', 'Thomas Cattan', 'thomas.cattan@notion.so', 'Notion', FALSE, '2025-10-15T10:00:00Z'),
('550e8400-e29b-41d4-a716-446655440007', 'Amélie Lefevre', 'amelie.lefevre@hubspot.com', 'HubSpot', FALSE, '2025-10-15T10:00:00Z'),
('550e8400-e29b-41d4-a716-446655440008', 'Olivier Petit', 'olivier.petit@salesforce.com', 'Salesforce', FALSE, '2025-10-15T10:00:00Z'),
('550e8400-e29b-41d4-a716-446655440009', 'Isabelle Moreau', 'isabelle.moreau@slack.com', 'Slack', FALSE, '2025-11-10T14:30:00Z'),
('550e8400-e29b-41d4-a716-446655440010', 'Nicolas Robert', 'nicolas.robert@figma.com', 'Figma', FALSE, '2025-11-10T14:30:00Z');

-- ===================================================
-- 2️⃣  DONNÉES DES SALLES (8 salles avec caractéristiques)
-- ===================================================

INSERT INTO public.rooms 
(id, name, room_type, capacity, floor, location, description, equipment, opening_time, closing_time, pmr_accessible, created_at) 
VALUES

-- Salles de Grande Réunion (RDC - Accès facile)
(1, 'Aquarium', 'Réunion', 20, 0, 'RDC - Aile Nord', 'Grande salle avec vue panoramique, idéale pour présentations', 
 ARRAY['Vidéo-projecteur', 'Écran tactile', 'Tableau blanc', 'WiFi', 'Téléphone conférence'], '08:00', '18:00', TRUE, '2025-11-01T00:00:00Z'),

(2, 'Jungle', 'Réunion', 12, 0, 'RDC - Aile Sud', 'Salle chaleureuse avec végétation, ambiance créative', 
 ARRAY['Projecteur', 'Tableau blanc', 'WiFi'], '08:00', '18:00', TRUE, '2025-11-01T00:00:00Z'),

-- Salles de Formation (1er étage)
(3, 'Space Station', 'Formation', 30, 1, '1er étage - Zone formation', 'Grande salle de formation avec chaises mobiles', 
 ARRAY['Vidéo-projecteur', 'Microphone sans fil', 'Système audio', 'Tableau blanc', 'WiFi'], '08:00', '18:00', FALSE, '2025-11-01T00:00:00Z'),

(4, 'Innovation Lab', 'Formation', 16, 1, '1er étage - Aile Ouest', 'Espace créatif avec tables en U', 
 ARRAY['Vidéo-projecteur', 'Tableau blanc', 'Markers colorés', 'WiFi'], '08:00', '18:00', TRUE, '2025-11-01T00:00:00Z'),

-- Call-boxes (2ème étage)
(5, 'Bureau 1:1 - A', 'Call-box', 2, 2, '2ème étage - Open space', 'Petite salle pour calls 1:1 ou duo-meetings', 
 ARRAY['Téléphone conférence', 'WiFi', 'Écran 24"'], '08:00', '18:00', TRUE, '2025-11-01T00:00:00Z'),

(6, 'Bureau 1:1 - B', 'Call-box', 2, 2, '2ème étage - Open space', 'Petite salle pour calls 1:1 ou duo-meetings', 
 ARRAY['Téléphone conférence', 'WiFi', 'Écran 24"'], '08:00', '18:00', TRUE, '2025-11-01T00:00:00Z'),

-- Salles Spécialisées (Sous-sol)
(7, 'Studio Podcast', 'Réunion', 6, -1, 'Sous-sol - Zone média', 'Studio d\'enregistrement professionnel avec insonorisation', 
 ARRAY['Microphones Shure', 'Mixeur audio', 'Câblage XLR', 'Écran HD', 'WiFi'], '09:00', '17:00', FALSE, '2025-11-01T00:00:00Z'),

(8, 'Salle Bien-être', 'Réunion', 8, 0, 'RDC - Aile Est', 'Espace zen avec yoga mat et méditation (PMR prioritaire)', 
 ARRAY['Tapis de yoga', 'Système audio Bose', 'Diffuseur aromathérapie', 'WiFi'], '08:00', '20:00', TRUE, '2025-11-01T00:00:00Z');

-- ================================================
-- ✅ FIN DE L'INSERTION
-- ================================================

-- Résumé:
-- • 10 utilisateurs (de 10 entreprises différentes)
-- • 8 salles (types variés, équipements différents)
-- • 0 réunions (à créer via le chatbot)
--
-- Pour vérifier l'intégrité:
--   SELECT COUNT(*) FROM public.users;         -- Devrait retourner 10
--   SELECT COUNT(*) FROM public.rooms;         -- Devrait retourner 8
--   SELECT COUNT(*) FROM public.meetings;      -- Devrait retourner 0
--
-- Voir les utilisateurs avec leurs sociétés:
--   SELECT id, full_name, email, society, pmr_needed FROM public.users ORDER BY society;
--
-- ================================================
