import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    // 1. On essaie de récupérer la liste des tables ou juste une info simple
    // On tente de lire la table "rooms" qu'on est censé avoir créée
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .limit(1);

    // 2. Gestion des cas
    if (error) {
      return NextResponse.json({ 
        status: '❌ ÉCHEC', 
        message: error.message, 
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      status: '✅ SUCCÈS', 
      message: 'Connexion à Supabase établie !', 
      data_sample: data 
    }, { status: 200 });

  } catch (e: any) {
    return NextResponse.json({ 
      status: '💀 CRASH', 
      message: e.message 
    }, { status: 500 });
  }
}