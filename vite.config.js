import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'FRESH FOOD Export & Management System',
        short_name: 'FRESH FOOD',
        description: 'Professional Management System for FRESH FOOD Export.',
        theme_color: '#059669',
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  build: {
    // رفع حد التحذير لـ 600KB وتقسيم الـ bundle
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // مكتبات الرسوم البيانية
          'charts':  ['recharts'],
          // مكتبات PDF والاكسيل
          'export':  ['jspdf', 'jspdf-autotable', 'xlsx'],
          // مكتبة Supabase
          'supabase': ['@supabase/supabase-js'],
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    }
  }
})
