import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.svg', '192.png', '512.png'],
            manifest: {
                name: '2026 Year Heatmap',
                short_name: '2026',
                description: 'Track your daily habits and events in 2026',
                theme_color: '#09090b',
                background_color: '#09090b',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: '/192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: '/512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: '/512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ]
})
