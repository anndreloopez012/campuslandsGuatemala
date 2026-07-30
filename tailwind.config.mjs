/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");


export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: ['class', '[data-theme="dark"]'],
	theme: {
		extend: {
			colors: {
				primary: "var(--color-primary)",
				primary_action: "var(--color-primary-action)",
				secondary: "var(--color-secondary)",
				brand: {
					charcoal: "#111111",
					petroleum: "#07102B",
					deep: "#1B00BF",
					blue: "#2C67BA",
					"cyan-dark": "#0076B7",
					cyan: "#2CAAFF",
					sky: "#57BBFF",
					aqua: "#00AA80",
					"gradient-start": "#000051",
					"gradient-end": "#000087",
				},
			},
			screens: {
			'semilg': '1200px'
		}
		},
		
	},
	plugins: [],
}
