import type { Metadata } from 'next'
import { Public_Sans } from 'next/font/google'

import { THEME_INIT_SCRIPT } from '@/modules/shared/constants'

import { Providers } from './providers'
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

// Estructura HTML raíz con fuente, tema inicial y contenido de la app
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" className={publicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
