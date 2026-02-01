import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'LLMViz',
      fileName: 'llm-viz',
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  publicDir: 'public'
})
