'use client'

import { useEffect } from 'react'

/**
 * Applies the saved brand aesthetic (playground / studio / command) to <html>
 * as data-brand. Reads localStorage first for an instant paint, then syncs
 * with the server-side setting.
 */
export function BrandThemeProvider() {
  useEffect(() => {
    const cached = localStorage.getItem('brand_theme')
    if (cached) document.documentElement.dataset.brand = cached

    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const theme = data?.brand_theme
        if (theme && ['playground', 'studio', 'command'].includes(theme)) {
          document.documentElement.dataset.brand = theme
          localStorage.setItem('brand_theme', theme)
        }
      })
      .catch(() => {})
  }, [])

  return null
}
