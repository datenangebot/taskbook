import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		emptyOutDir: false,
		outDir: '.',
		rollupOptions: {
			input: resolve('src/pwa/service-worker.ts'),
			output: {
				entryFileNames: 'js/taskbook-pwa-service-worker.mjs',
				inlineDynamicImports: true,
			},
		},
		sourcemap: true,
		target: 'es2022',
	},
})
