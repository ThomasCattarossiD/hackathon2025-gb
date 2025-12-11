-- ⚠️ ATTENTION : Ceci supprime les tables existantes pour les recréer proprement
DROP TABLE IF EXISTS public.meetings;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Création de la table UTILISATEURS (Ref: Ton code)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- J'ai ajouté un générateur d'ID par défaut
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  society TEXT,
  pmr_needed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 2. Création de la table SALLES (Ref: Ton code)
CREATE TABLE public.rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL, -- ex: "Réunion", "Formation", "Call-box"
  capacity INTEGER NOT NULL,
  floor INTEGER, 
  location TEXT,
  description TEXT, 
  equipment TEXT[], 
  opening_time TIME DEFAULT '08:00',
  closing_time TIME DEFAULT '18:00',
  pmr_accessible BOOLEAN DEFAULT TRUE,
  -- J'ai retiré 'occupied' car c'est calculé dynamiquement via la table meetings
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3. Création de la table RÉUNIONS (Le lien entre les deux)
CREATE TABLE public.meetings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  
  -- Clés étrangères (Liens)
  room_id BIGINT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  title TEXT DEFAULT 'Réunion',
  attendees_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  -- Empêche une réunion de finir avant de commencer
  CONSTRAINT check_dates CHECK (end_time > start_time)
);

-- 4. Index (Pour que l'IA soit rapide lors de la recherche)
CREATE INDEX idx_meetings_dates ON public.meetings (room_id, start_time, end_time);