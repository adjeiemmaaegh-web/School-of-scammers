import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Match tsconfig's existing ES2022 language baseline. This avoids
// redundant downlevel output and reduces total compressed JavaScript.
export default defineConfig({
  // ES workers can split lazily loaded code (the assessment scenes) from the simulation worker and share the engine with it.
  worker: { format: 'es' }, plugins: [react()], build: { target: 'es2022' } });
