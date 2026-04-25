import { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { usePet } from '../src/context/PetContext'
import { useTheme, Colors } from '../src/context/ThemeContext'

type Step = 'welcome' | 'species' | 'details'

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

export default function OnboardingScreen() {
  const { pet, setPet, completeOnboarding } = usePet()
  const router = useRouter()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  const [step, setStep]       = useState<Step>('welcome')
  const [species, setSpecies] = useState<'고양이' | '강아지'>('고양이')
  const [name, setName]       = useState('')
  const [breed, setBreed]     = useState('')
  const [birth, setBirth]     = useState('')
  const [weight, setWeight]   = useState('')

  function handleFinish() {
    setPet((prev) => ({
      ...prev,
      species,
      name:       name.trim()   || prev.name,
      breed:      breed.trim()  || prev.breed,
      birth_date: birth.trim()  || prev.birth_date,
      weight:     weight.trim() || prev.weight,
    }))
    completeOnboarding()
    router.replace('/(tabs)')
  }

  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.logo}>🐾</Text>
          <Text style={styles.title}>TwinTuna_Paws</Text>
          <Text style={styles.subtitle}>
            반려동물의 건강을 기록하고{'\n'}관리하는 스마트 다이어리
          </Text>
          <View style={styles.featureList}>
            {['📋 건강 기록 & 일지', '💉 예방접종 스케줄', '🏥 병원 즐겨찾기', '📊 체중 & 건강 트렌드'].map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('species')}>
            <Text style={styles.primaryBtnText}>시작하기 →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (step === 'species') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.stepIndicator}>1 / 2</Text>
          <Text style={styles.title}>어떤 반려동물인가요?</Text>
          <View style={styles.speciesRow}>
            <TouchableOpacity
              style={[styles.speciesCard, species === '고양이' && styles.speciesCardActive]}
              onPress={() => setSpecies('고양이')}
            >
              <Text style={styles.speciesEmoji}>🐱</Text>
              <Text style={[styles.speciesLabel, species === '고양이' && styles.speciesLabelActive]}>고양이</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.speciesCard, species === '강아지' && styles.speciesCardActive]}
              onPress={() => setSpecies('강아지')}
            >
              <Text style={styles.speciesEmoji}>🐶</Text>
              <Text style={[styles.speciesLabel, species === '강아지' && styles.speciesLabelActive]}>강아지</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('details')}>
            <Text style={styles.primaryBtnText}>다음 →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.stepIndicator}>2 / 2</Text>
          <Text style={styles.title}>반려동물 정보를 입력해주세요</Text>
          <Text style={styles.fieldLabel}>이름 *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="예: 나비, 코코"
            placeholderTextColor={c.textFaint}
          />
          <Text style={styles.fieldLabel}>품종</Text>
          <TextInput
            style={styles.input}
            value={breed}
            onChangeText={setBreed}
            placeholder={species === '고양이' ? '예: 코리안 숏헤어' : '예: 말티즈'}
            placeholderTextColor={c.textFaint}
          />
          <Text style={styles.fieldLabel}>생년월일</Text>
          <TextInput
            style={styles.input}
            value={birth}
            onChangeText={(v) => setBirth(formatDateInput(v))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={c.textFaint}
            keyboardType="number-pad"
          />
          <Text style={styles.fieldLabel}>현재 체중 (kg)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="예: 4.2"
            placeholderTextColor={c.textFaint}
            keyboardType="decimal-pad"
          />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('species')}>
              <Text style={styles.backBtnText}>← 이전</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, !name.trim() && styles.primaryBtnDisabled]}
              onPress={handleFinish}
              disabled={!name.trim()}
            >
              <Text style={styles.primaryBtnText}>완료 🎉</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
    formContent: { padding: 32, gap: 8 },
    logo: { fontSize: 64 },
    title: { fontSize: 24, fontWeight: '800', color: c.text, textAlign: 'center' },
    subtitle: { fontSize: 15, color: c.textMuted, textAlign: 'center', lineHeight: 22 },
    stepIndicator: { fontSize: 13, color: c.textFaint, fontWeight: '600', textAlign: 'center' },
    featureList: { gap: 8, width: '100%', marginVertical: 8 },
    featureRow: { backgroundColor: c.card, borderRadius: 12, padding: 14 },
    featureText: { fontSize: 14, color: c.textSub, fontWeight: '600' },
    primaryBtn: {
      backgroundColor: '#1A73E8', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 16,
      width: '100%', alignItems: 'center', marginTop: 8,
    },
    primaryBtnDisabled: { backgroundColor: c.border },
    primaryBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
    speciesRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
    speciesCard: {
      flex: 1, backgroundColor: c.card, borderRadius: 20, padding: 24,
      alignItems: 'center', gap: 8, borderWidth: 2, borderColor: 'transparent',
    },
    speciesCardActive: { borderColor: '#1A73E8', backgroundColor: '#EFF6FF' },
    speciesEmoji: { fontSize: 48 },
    speciesLabel: { fontSize: 16, fontWeight: '700', color: c.textMuted },
    speciesLabelActive: { color: '#1A73E8' },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: c.textSub, marginTop: 8 },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 14, fontSize: 15, color: c.text, backgroundColor: c.inputBg,
    },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' },
    backBtn: {
      backgroundColor: c.chip, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16,
      alignItems: 'center',
    },
    backBtnText: { fontSize: 15, fontWeight: '600', color: c.textMuted },
  })
}
