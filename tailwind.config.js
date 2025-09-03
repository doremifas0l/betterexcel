/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		fontFamily: {
			sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
			mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Courier New', 'monospace'],
		},
			extend: {
				colors: {
					// Surface Colors
					'app-bg': 'var(--app-bg)',
					'panel-bg': 'var(--panel-bg)',
					'surface-1': 'var(--surface-1)',
					'surface-2': 'var(--surface-2)',
					
					// Text Colors
					'text-primary': 'var(--text-primary)',
					text: {
						DEFAULT: 'var(--text-primary)',
						2: 'var(--text-2)',
						muted: 'var(--muted)',
					},
					
					// Borders
					border: {
						DEFAULT: 'var(--border)',
						subtle: 'var(--border-subtle)',
					},
					'grid-line': 'var(--grid-line)',
					
					// Brand Colors
					accent: {
						DEFAULT: 'var(--accent)',
						strong: 'var(--accent-strong)',
						light: 'var(--accent-light)',
						ring: 'var(--accent-ring)',
						foreground: '#FFFFFF',
					},
					
					// State Colors
					success: 'var(--success)',
					warning: 'var(--warning)',
					danger: 'var(--danger)',
					info: 'var(--info)',
					
					ring: 'var(--accent-ring)',
					
					// Shadcn/UI compatibility mapping
					background: 'var(--background)',
					foreground: 'var(--foreground)',
					input: 'var(--border)',
					primary: {
						DEFAULT: 'var(--primary)',
						foreground: 'var(--primary-foreground)',
					},
					secondary: {
						DEFAULT: 'var(--secondary)',
						foreground: 'var(--secondary-foreground)',
					},
					destructive: {
						DEFAULT: 'var(--destructive)',
						foreground: 'var(--destructive-foreground)',
					},
					muted: {
						DEFAULT: 'var(--surface-1)',
						foreground: 'var(--muted)',
					},
					popover: {
						DEFAULT: 'var(--panel-bg)',
						foreground: 'var(--text-primary)',
					},
					card: {
						DEFAULT: 'var(--panel-bg)',
						foreground: 'var(--text-primary)',
					},
				},
			fontSize: {
				// Typography Scale Implementation
				'h1': ['2rem', { lineHeight: '1.125', fontWeight: '700', letterSpacing: '-0.01em' }],
				'h2': ['1.5rem', { lineHeight: '1.167', fontWeight: '600', letterSpacing: '-0.01em' }],
				'h3': ['1.25rem', { lineHeight: '1.2', fontWeight: '600' }],
				'h4': ['1rem', { lineHeight: '1.25', fontWeight: '600' }],
				'body': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
				'body-sm': ['0.875rem', { lineHeight: '1.429', fontWeight: '400' }],
				'label': ['0.875rem', { lineHeight: '1.286', fontWeight: '500' }],
				'label-sm': ['0.75rem', { lineHeight: '1.167', fontWeight: '500' }],
				'small': ['0.75rem', { lineHeight: '1.333', fontWeight: '400' }],
				'caption': ['0.6875rem', { lineHeight: '1.273', fontWeight: '400', letterSpacing: '0.05em' }],
				'overline': ['0.6875rem', { lineHeight: '1.273', fontWeight: '500', letterSpacing: '0.15em' }],
				'code': ['0.8125rem', { lineHeight: '1.385', fontWeight: '500' }],
			},
			borderRadius: {
				DEFAULT: 'var(--radius)',
				lg: 'var(--radius-lg)',
				md: 'var(--radius)',
				sm: 'var(--radius-sm)',
			},
			boxShadow: {
				elevated: 'var(--shadow-1)',
				2: 'var(--shadow-2)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}