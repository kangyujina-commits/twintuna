import { Tabs } from 'expo-router'
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
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: { backgroundColor: c.card },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: c.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          headerTitle: 'TwinTuna_Paws',
          headerRight: () => <ThemeToggleBtn />,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: '일지',
          headerTitle: '건강 일지',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: '상식',
          headerTitle: '반려동물 상식',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          headerTitle: '반려동물 프로필',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🐾" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
