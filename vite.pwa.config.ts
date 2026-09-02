import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		assetsDir: 'js',
		cssCodeSplit: false,
		emptyOutDir: false,
		outDir: '.',
		rollupOptions: {
			input: resolve('src/pwa/app.ts'),
			output: {
				assetFileNames: (asset) => asset.name?.endsWith('.css') === true ? 'css/taskbook-pwa.css' : 'js/taskbook-pwa-[name][extname]',
				entryFileNames: 'js/taskbook-pwa.mjs',
				inlineDynamicImports: true,
			},
		},
		sourcemap: true,
		target: 'es2022',
	},
})
