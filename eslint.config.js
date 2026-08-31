import { recommended } from '@nextcloud/eslint-config'

export default [
	...recommended,
	{
		name: 'taskbook/rules',
		files: ['**/*.{js,mjs,ts,vue}'],
		rules: {
			'jsdoc/require-jsdoc': 'off',
			'@stylistic/max-statements-per-line': 'off',
		},
	},
	{
		name: 'taskbook/vue',
		files: ['**/*.vue'],
		rules: {
			'vue/attribute-hyphenation': 'off',
			'vue/first-attribute-linebreak': 'off',
		},
	},
]
