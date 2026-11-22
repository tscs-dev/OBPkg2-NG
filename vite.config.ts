import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

const pkgJson = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, './package.json'), 'utf-8'),
) as { version?: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(), 
    tailwindcss()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkgJson.version ?? '0.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      external: ['vue', 'vue-router', 'pinia', 'vue-i18n'],
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-ui', test: /node_modules[\\/](reka-ui|@floating-ui|class-variance-authority)/, priority: 15 },
            { name: 'vendor-icons', test: /node_modules[\\/]@lucide/, priority: 15 },
            { name: 'vendor-editor', test: /node_modules[\\/](@tiptap|prosemirror)/, priority: 15 },
            { name: 'vendor', test: /node_modules/, priority: 10 },
            { name: 'shared', test: /src\/(composables|utils|queries|api|config|layouts)\//, minShareCount: 2, priority: 1 },
          ],
        },
      },
    },
    license: {
      fileName: "about/licenses-frontend.md"
    }
  }
})
