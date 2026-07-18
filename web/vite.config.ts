import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// build.outDir dist is the ui_build publish contract (publish_react_vite_build copies
// dist/ verbatim); --base is passed on the CLI by the pipeline — do not hardcode base here.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
});
