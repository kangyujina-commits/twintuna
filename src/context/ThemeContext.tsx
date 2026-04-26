import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@twintuna_theme'

export const PALETTE = {
  light: {
    bg:        '#F9FAFB',
    card:      '#FFFFFF',
    text:      '#111827',
    textSub:   '#374151',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
    border:    '#E5E7EB',
    borderSub: '#D1D5DB',
    chip:      '#F3F4F6',
    inputBg:   '#F9FAFB',
    tabBar:    '#FFFFFF',
    tabBorder: '#D1D5DB',
  },
  dark: {
    bg:        '#0F172A',
    card:      '#1E293B',
    text:      '#F1F5F9',
    textSub:   '#CBD5E1',
    textMuted: '#94A3B8',
    textFaint: '#64748B',
    border:    '#334155',
    borderSub: '#334155',
    chip:      '#1E293B',
    inputBg:   '#162032',
    tabBar:    '#1E293B',
    tabBorder: '#334155',
  },
}

export type Colors = typeof PALETTE.light

type Theme = { isDark: boolean; colors: Colors; toggle: () => void }

const ThemeContext = createContext<Theme>({ isDark: false, colors: PALETTE.light, toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => { if (v === 'dark') setIsDark(true) })
  }, [])

  function toggle() {
    setIsDark((prev) => {
      const next = !prev
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? PALETTE.dark : PALETTE.light, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
