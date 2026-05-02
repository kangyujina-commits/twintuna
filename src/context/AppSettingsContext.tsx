import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@twintuna:appSettings'

export interface AppSettings {
  heroUri:       string | null   // null = 기본 main.png
  bannerHeight:  number          // px (기본 220)
  accentColor:   string          // 포인트 컬러 (기본 #1A73E8)
}

const DEFAULTS: AppSettings = {
  heroUri:      null,
  bannerHeight: 160,
  accentColor:  '#1A73E8',
}

interface AppSettingsContextValue {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  resetSettings:  () => void
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings:       DEFAULTS,
  updateSettings: () => {},
  resetSettings:  () => {},
})

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loaded,   setLoaded]   = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (json) {
        const saved = JSON.parse(json)
        // 구버전 기본값(220) 마이그레이션 → 160으로 낮춤
        if (saved.bannerHeight === 220) saved.bannerHeight = 160
        setSettings({ ...DEFAULTS, ...saved })
      }
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings, loaded])

  function updateSettings(partial: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }))
  }

  function resetSettings() {
    setSettings(DEFAULTS)
  }

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() { return useContext(AppSettingsContext) }

export const ACCENT_COLORS = [
  { label: '블루',   value: '#1A73E8' },
  { label: '그린',   value: '#10B981' },
  { label: '퍼플',   value: '#8B5CF6' },
  { label: '핑크',   value: '#EC4899' },
  { label: '오렌지', value: '#F59E0B' },
  { label: '레드',   value: '#EF4444' },
  { label: '다크',   value: '#374151' },
]

export const BANNER_HEIGHTS = [
  { label: '작게',  value: 120 },
  { label: '보통',  value: 160 },
  { label: '크게',  value: 220 },
]
