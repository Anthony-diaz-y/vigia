import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Vigia · soporte de decisión en dengue',
  description:
    'Ingesta, análisis y pronóstico de vigilancia epidemiológica de dengue. Herramienta de apoyo a la decisión, no un dispositivo médico.',
}

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('vigia-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(error){}})();`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
