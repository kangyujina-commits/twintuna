import { Tabs } from 'expo-router'
import { Text } from 'react-native'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1A73E8',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          headerTitle: '참참헬스',
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
