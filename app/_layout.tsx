import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Head from 'expo-router/head'
import { PetProvider } from '../src/context/PetContext'
import { DiaryProvider } from '../src/context/DiaryContext'

export default function RootLayout() {
  return (
    <PetProvider>
      <DiaryProvider>
        <Head>
          <title>참참헬스</title>
        </Head>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </DiaryProvider>
    </PetProvider>
  )
}
