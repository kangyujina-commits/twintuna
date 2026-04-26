import { Tabs, useRouter } from 'expo-router'
import { Text, TouchableOpacity } from 'react-native'
import { useTheme } from '../../src/context/ThemeContext'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  )
}

function ThemeToggleBtn() {
  const { isDark, toggle } = useTheme()
  return (
    <TouchableOpacity onPress={toggle} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
      <Text style={{ fontSize: 20 }}>{isDark ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  )
}

function HomeTitle() {
  const router = useRouter()
  const { colors: c } = useTheme()
  return (
    <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.7}>
      <Text style={{ fontWeight: '700', fontSize: 18, color: c.text }}>TwinTuna_Paws</Text>
    </TouchableOpacity>
  )
}

export default function TabLayout() {
  const { colors: c } = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1A73E8',
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopColor: c.tabBorder,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: c.card },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: c.text },
        headerTitle: () => <HomeTitle />,
        headerRight: () => <ThemeToggleBtn />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home/홈',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Diary/일지',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: 'Tips/상식',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="album"
        options={{
          title: 'Album/앨범',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📸" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile/프로필',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🐾" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
