import type { Metadata } from 'next'
import { Public_Sans } from 'next/font/google'

import './globals.css'

export const metadata: Metadata = {
  title: 'Vigia, vigilancia de dengue',
  description:
    'Ingesta, análisis y pronóstico de vigilancia epidemiológica de dengue. Herramienta de apoyo a la decisión, no un dispositivo médico.',
}

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
})

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('vigia-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(error){}})();`

// Estructura HTML raíz con fuente, tema inicial y contenido de la app
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" className={publicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
