import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isCapacitor = process.env.BUILD_TARGET === 'capacitor'

export default defineConfig({
  plugins: [react()],
  // En la APK los archivos se sirven desde file:// : rutas relativas
  base: isCapacitor ? './' : '/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
})
