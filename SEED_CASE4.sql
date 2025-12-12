-- ============================================
-- SEED DATA FOR CASE 4 TESTING
-- Team Meeting Scheduling with Smart Slot + Room Selection
-- ============================================
-- Run this AFTER schema.sql
-- Date de référence: Semaine du 16-20 décembre 2025 (Lundi-Vendredi)
-- ============================================

-- NETTOYAGE (optionnel - décommenter si besoin de reset)
-- DELETE FROM public.meetings;
-- DELETE FROM public.users;

-- ============================================
-- 1. UTILISATEURS - Équipe "GoodBarber" (12 personnes)
-- ============================================

INSERT INTO public.users (id, full_name, email, password_hash, society, pmr_needed) VALUES
-- Équipe principale "GoodBarber" - 12 membres pour tester Case 4
('a0000001-0000-0000-0000-000000000001', 'Alice Martin', 'alice.martin@goodbarber.com', '$2b$10$hash1', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000002', 'Bob Dupont', 'bob.dupont@goodbarber.com', '$2b$10$hash2', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000003', 'Claire Bernard', 'claire.bernard@goodbarber.com', '$2b$10$hash3', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000004', 'David Leroy', 'david.leroy@goodbarber.com', '$2b$10$hash4', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000005', 'Emma Petit', 'emma.petit@goodbarber.com', '$2b$10$hash5', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000006', 'François Moreau', 'francois.moreau@goodbarber.com', '$2b$10$hash6', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000007', 'Gabrielle Roux', 'gabrielle.roux@goodbarber.com', '$2b$10$hash7', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000008', 'Hugo Simon', 'hugo.simon@goodbarber.com', '$2b$10$hash8', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000009', 'Isabelle Michel', 'isabelle.michel@goodbarber.com', '$2b$10$hash9', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000010', 'Julien Garcia', 'julien.garcia@goodbarber.com', '$2b$10$hash10', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000011', 'Karine Thomas', 'karine.thomas@goodbarber.com', '$2b$10$hash11', 'GoodBarber', FALSE),
('a0000001-0000-0000-0000-000000000012', 'Lucas Robert', 'lucas.robert@goodbarber.com', '$2b$10$hash12', 'GoodBarber', TRUE), -- PMR

-- Équipe secondaire "Marketing" - 6 membres (pour créer des conflits)
('b0000001-0000-0000-0000-000000000001', 'Marie Lefebvre', 'marie.lefebvre@goodbarber.com', '$2b$10$hash13', 'Marketing', FALSE),
('b0000001-0000-0000-0000-000000000002', 'Nicolas Girard', 'nicolas.girard@goodbarber.com', '$2b$10$hash14', 'Marketing', FALSE),
('b0000001-0000-0000-0000-000000000003', 'Olivia André', 'olivia.andre@goodbarber.com', '$2b$10$hash15', 'Marketing', FALSE),
('b0000001-0000-0000-0000-000000000004', 'Pierre Blanc', 'pierre.blanc@goodbarber.com', '$2b$10$hash16', 'Marketing', FALSE),
('b0000001-0000-0000-0000-000000000005', 'Quentin Faure', 'quentin.faure@goodbarber.com', '$2b$10$hash17', 'Marketing', FALSE),
('b0000001-0000-0000-0000-000000000006', 'Rachel Henry', 'rachel.henry@goodbarber.com', '$2b$10$hash18', 'Marketing', FALSE);

-- ============================================
-- 2. SALLES - Variété de capacités et équipements
-- ============================================
-- Note: Les IDs sont auto-générés (IDENTITY), on les référence par nom plus tard

INSERT INTO public.rooms (name, room_type, capacity, floor, location, description, equipment, pmr_accessible) VALUES
-- Grandes salles (>=12 personnes) - Pour réunions d'équipe complète
('Aquarium', 'Réunion', 12, 1, 'Bâtiment A - 1er étage', 'Grande salle vitrée avec vue panoramique', ARRAY['Vidéo-projecteur', 'Tableau blanc', 'Webcam HD', 'WiFi', 'Climatisation'], TRUE),
('Neptune', 'Réunion', 14, 2, 'Bâtiment A - 2ème étage', 'Salle de conférence principale', ARRAY['Vidéo-projecteur', 'Tableau blanc', 'Système audio', 'WiFi', 'Écran interactif'], TRUE),
('Orion', 'Formation', 20, 0, 'Bâtiment B - RDC', 'Salle de formation modulable', ARRAY['Vidéo-projecteur', 'Tableau blanc', 'Webcam', 'WiFi', 'Micros'], TRUE),

-- Salles moyennes (8-10 personnes) - Pour petites équipes
('Zen', 'Réunion', 8, 1, 'Bâtiment A - 1er étage', 'Salle calme et lumineuse', ARRAY['Écran TV', 'Tableau blanc', 'WiFi'], TRUE),
('Creative', 'Brainstorm', 10, 1, 'Bâtiment A - 1er étage', 'Espace créatif avec post-its', ARRAY['Tableau blanc', 'Post-its', 'WiFi', 'Feutres'], FALSE),
('Focus', 'Réunion', 8, 2, 'Bâtiment A - 2ème étage', 'Salle intimiste', ARRAY['Écran TV', 'WiFi', 'Webcam'], TRUE),

-- Petites salles (4-6 personnes) - Pour 1:1 ou petits groupes
('Phone Box 1', 'Call-box', 4, 0, 'Bâtiment A - RDC', 'Box pour appels confidentiels', ARRAY['Écran', 'Webcam HD', 'Isolation phonique'], FALSE),
('Phone Box 2', 'Call-box', 4, 0, 'Bâtiment A - RDC', 'Box pour appels confidentiels', ARRAY['Écran', 'Webcam HD', 'Isolation phonique'], FALSE),
('Cocoon', 'Réunion', 6, -1, 'Bâtiment B - Sous-sol', 'Petit espace cosy', ARRAY['Écran TV', 'WiFi'], TRUE);

-- ============================================
-- 3. RÉUNIONS EXISTANTES - Créent des patterns de disponibilité
-- ============================================
-- Semaine du 16-20 décembre 2025
-- Objectif: Créer des slots avec différents % de disponibilité

-- Mapping des IDs de salles:
-- Aquarium=58, Neptune=59, Orion=60, Zen=61, Creative=62, Focus=63, Phone Box 1=64, Phone Box 2=65, Cocoon=66

-- ========== LUNDI 16 DÉCEMBRE 2025 ==========

-- 9h-10h: Réunion Marketing dans Aquarium (bloque la grande salle)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(58, 'b0000001-0000-0000-0000-000000000001', '2025-12-16 09:00:00+01', '2025-12-16 10:00:00+01', 'Weekly Marketing', 6);

-- 10h-11h: 3 membres GoodBarber ont des réunions (75% dispo = 9/12)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(61, 'a0000001-0000-0000-0000-000000000001', '2025-12-16 10:00:00+01', '2025-12-16 11:00:00+01', '1:1 Alice', 2),
(62, 'a0000001-0000-0000-0000-000000000002', '2025-12-16 10:00:00+01', '2025-12-16 11:00:00+01', '1:1 Bob', 2),
(63, 'a0000001-0000-0000-0000-000000000003', '2025-12-16 10:00:00+01', '2025-12-16 11:00:00+01', '1:1 Claire', 2);

-- 14h-15h: CRÉNEAU IDÉAL - Aucun conflit pour GoodBarber (100% dispo = 12/12)
-- Mais Neptune occupée par Marketing
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(59, 'b0000001-0000-0000-0000-000000000002', '2025-12-16 14:00:00+01', '2025-12-16 15:00:00+01', 'Client Call', 4);

-- 16h-17h: 2 membres GoodBarber occupés (83% dispo = 10/12)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(64, 'a0000001-0000-0000-0000-000000000004', '2025-12-16 16:00:00+01', '2025-12-16 17:00:00+01', 'Call David', 1),
(65, 'a0000001-0000-0000-0000-000000000005', '2025-12-16 16:00:00+01', '2025-12-16 17:00:00+01', 'Call Emma', 1);

-- ========== MARDI 17 DÉCEMBRE 2025 ==========

-- 9h-10h: Daily standup dans Zen (ne bloque pas grandes salles)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(61, 'a0000001-0000-0000-0000-000000000001', '2025-12-17 09:00:00+01', '2025-12-17 09:30:00+01', 'Daily Standup', 8);

-- 10h-12h: Formation dans Orion (bloque la plus grande salle)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(60, 'b0000001-0000-0000-0000-000000000003', '2025-12-17 10:00:00+01', '2025-12-17 12:00:00+01', 'Formation Nouveaux', 15);

-- 11h-12h: 4 membres GoodBarber occupés (67% dispo = 8/12)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(62, 'a0000001-0000-0000-0000-000000000006', '2025-12-17 11:00:00+01', '2025-12-17 12:00:00+01', 'Review François', 2),
(63, 'a0000001-0000-0000-0000-000000000007', '2025-12-17 11:00:00+01', '2025-12-17 12:00:00+01', 'Review Gabrielle', 2),
(64, 'a0000001-0000-0000-0000-000000000008', '2025-12-17 11:00:00+01', '2025-12-17 12:00:00+01', 'Call Hugo', 1),
(65, 'a0000001-0000-0000-0000-000000000009', '2025-12-17 11:00:00+01', '2025-12-17 12:00:00+01', 'Call Isabelle', 1);

-- 14h-15h: 1 seul conflit (92% dispo = 11/12) - BON CRÉNEAU
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(66, 'a0000001-0000-0000-0000-000000000010', '2025-12-17 14:00:00+01', '2025-12-17 15:00:00+01', '1:1 Julien', 2);

-- 15h-16h: CRÉNEAU PARFAIT - 0 conflit (100% dispo = 12/12)
-- Toutes les grandes salles libres

-- ========== MERCREDI 18 DÉCEMBRE 2025 ==========

-- 9h-12h: Conférence externe dans Neptune
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(59, 'b0000001-0000-0000-0000-000000000004', '2025-12-18 09:00:00+01', '2025-12-18 12:00:00+01', 'Conf Externe', 12);

-- 10h-11h: 5 membres GoodBarber occupés (58% dispo = 7/12) - MAUVAIS CRÉNEAU
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(61, 'a0000001-0000-0000-0000-000000000001', '2025-12-18 10:00:00+01', '2025-12-18 11:00:00+01', 'Projet Alpha', 3),
(62, 'a0000001-0000-0000-0000-000000000003', '2025-12-18 10:00:00+01', '2025-12-18 11:00:00+01', 'Projet Beta', 2),
(63, 'a0000001-0000-0000-0000-000000000005', '2025-12-18 10:00:00+01', '2025-12-18 11:00:00+01', 'Projet Gamma', 2),
(64, 'a0000001-0000-0000-0000-000000000007', '2025-12-18 10:00:00+01', '2025-12-18 11:00:00+01', 'Call Gabrielle', 1),
(65, 'a0000001-0000-0000-0000-000000000009', '2025-12-18 10:00:00+01', '2025-12-18 11:00:00+01', 'Call Isabelle', 1);

-- 14h-15h: Aquarium occupé mais team 100% dispo
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(58, 'b0000001-0000-0000-0000-000000000005', '2025-12-18 14:00:00+01', '2025-12-18 15:00:00+01', 'Marketing Review', 5);

-- ========== JEUDI 19 DÉCEMBRE 2025 ==========

-- Journée chargée - simuler une journée difficile

-- 9h-10h: Plusieurs réunions (75% dispo = 9/12)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(58, 'a0000001-0000-0000-0000-000000000002', '2025-12-19 09:00:00+01', '2025-12-19 10:00:00+01', 'Planning Sprint', 8),
(61, 'a0000001-0000-0000-0000-000000000011', '2025-12-19 09:00:00+01', '2025-12-19 10:00:00+01', '1:1 Karine', 2),
(62, 'a0000001-0000-0000-0000-000000000012', '2025-12-19 09:00:00+01', '2025-12-19 10:00:00+01', '1:1 Lucas', 2);

-- 10h-11h: TOUTES grandes salles occupées
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(58, 'b0000001-0000-0000-0000-000000000001', '2025-12-19 10:00:00+01', '2025-12-19 11:00:00+01', 'Board Meeting', 10),
(59, 'b0000001-0000-0000-0000-000000000002', '2025-12-19 10:00:00+01', '2025-12-19 11:00:00+01', 'Investor Call', 8),
(60, 'b0000001-0000-0000-0000-000000000003', '2025-12-19 10:00:00+01', '2025-12-19 11:00:00+01', 'Training Session', 15);

-- 11h-12h: 2 conflits (83% dispo = 10/12)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(63, 'a0000001-0000-0000-0000-000000000004', '2025-12-19 11:00:00+01', '2025-12-19 12:00:00+01', 'Code Review David', 3),
(64, 'a0000001-0000-0000-0000-000000000006', '2025-12-19 11:00:00+01', '2025-12-19 12:00:00+01', 'Call François', 1);

-- 14h-15h: Neptune occupée mais team dispo
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(59, 'b0000001-0000-0000-0000-000000000004', '2025-12-19 14:00:00+01', '2025-12-19 15:00:00+01', 'Partner Meeting', 6);

-- 16h-17h: Aquarium et Orion libres, 1 conflit (92% dispo)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(61, 'a0000001-0000-0000-0000-000000000008', '2025-12-19 16:00:00+01', '2025-12-19 17:00:00+01', 'Retrospective', 6);

-- ========== VENDREDI 20 DÉCEMBRE 2025 ==========

-- Vendredi plus calme - bon pour réunions d'équipe

-- 9h-10h: Daily rapide
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(61, 'a0000001-0000-0000-0000-000000000001', '2025-12-20 09:00:00+01', '2025-12-20 09:30:00+01', 'Friday Sync', 6);

-- 10h-11h: 100% dispo, TOUTES salles libres - CRÉNEAU PARFAIT

-- 11h-12h: 2 conflits (83% dispo)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(62, 'a0000001-0000-0000-0000-000000000002', '2025-12-20 11:00:00+01', '2025-12-20 12:00:00+01', 'Demo Prep', 4),
(63, 'a0000001-0000-0000-0000-000000000010', '2025-12-20 11:00:00+01', '2025-12-20 12:00:00+01', 'Client Demo Julien', 3);

-- 14h-15h: Demo client dans Orion (grande salle occupée)
INSERT INTO public.meetings (room_id, user_id, start_time, end_time, title, attendees_count) VALUES
(60, 'a0000001-0000-0000-0000-000000000001', '2025-12-20 14:00:00+01', '2025-12-20 15:00:00+01', 'Client Demo', 10);

-- 15h-16h: Fin de semaine tranquille - 100% dispo, Aquarium et Neptune libres

-- ============================================
-- RÉSUMÉ DES CRÉNEAUX ATTENDUS (pour vérifier le test)
-- ============================================
-- 
-- TOP 3 créneaux pour équipe GoodBarber (12 pers) cette semaine:
--
-- 1. Lundi 16/12 14h-15h: 100% dispo (12/12), Aquarium libre ⭐ RECOMMANDÉ
-- 2. Mardi 17/12 15h-16h: 100% dispo (12/12), Toutes salles libres
-- 3. Vendredi 20/12 10h-11h: 100% dispo (12/12), Toutes salles libres
--
-- Autres bons créneaux:
-- - Mardi 17/12 14h-15h: 92% dispo (11/12)
-- - Jeudi 19/12 16h-17h: 92% dispo (11/12)
-- - Lundi 16/12 16h-17h: 83% dispo (10/12)
-- - Vendredi 20/12 11h-12h: 83% dispo (10/12)
--
-- Mauvais créneaux (< 70%):
-- - Mercredi 18/12 10h-11h: 58% dispo (7/12) - À éviter
-- - Mardi 17/12 11h-12h: 67% dispo (8/12) - À éviter
--
-- ============================================
