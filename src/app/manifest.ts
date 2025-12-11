import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mon Chat App', // Le nom complet de ton appli
    short_name: 'Chat', // Le nom sous l'icône sur le téléphone
    description: 'Une application de chat assistée par IA',
    start_url: '/',
    display: 'standalone', // C'est CA qui enlève la barre d'URL du navigateur
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon-192.png', // Tu devras ajouter cette image dans le dossier public
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png', // Tu devras ajouter cette image dans le dossier public
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}