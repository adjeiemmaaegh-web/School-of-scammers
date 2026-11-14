import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Match tsconfig's existing ES2022 language baseline. This avoids
// redundant downlevel output and reduces total compressed JavaScript.
export default defineConfig({ plugins: [react()], build: { target: 'es2022' } });
