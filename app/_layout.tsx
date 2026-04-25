import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Head from 'expo-router/head'
import { PetProvider } from '../src/context/PetContext'
import { DiaryProvider } from '../src/context/DiaryContext'
import { ThemeProvider, useTheme } from '../src/context/ThemeContext'

function AppShell() {
  const { isDark } = useTheme()
  return (
    <>
      <Head><title>TwinTuna_Paws</title></Head>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PetProvider>
        <DiaryProvider>
          <AppShell />
        </DiaryProvider>
      </PetProvider>
    </ThemeProvider>
  )
}
