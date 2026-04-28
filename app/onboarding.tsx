import { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Image, ImageBackground, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { usePet, PetProfile } from '../src/context/PetContext'
import { useTheme, Colors } from '../src/context/ThemeContext'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

type Step = 'welcome' | 'select' | 'species' | 'details'

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

export default function OnboardingScreen() {
  const { pets, setActivePetId, addPet, completeOnboarding } = usePet()
  const router = useRouter()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  const [step, setStep]       = useState<Step>('welcome')
  const [species, setSpecies] = useState<'고양이' | '강아지'>('고양이')
  const [name, setName]       = useState('')
  const [breed, setBreed]     = useState('')
  const [birth, setBirth]     = useState('')
  const [weight, setWeight]   = useState('')

  function selectExisting(pet: PetProfile) {
    setActivePetId(pet.id)
    completeOnboarding()
    router.replace('/(tabs)')
  }

  function handleFinish() {
    addPet({
      species,
      name:       name.trim(),
      breed:      breed.trim(),
      birth_date: birth.trim(),
      weight:     weight.trim(),
    })
    completeOnboarding()
    router.replace('/(tabs)')
  }

  // ── 웰컴
  if (step === 'welcome') {
    return (
      <ImageBackground
        source={require('../assets/main.png')}
        style={{ flex: 1, width: SCREEN_W, height: SCREEN_H }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.0)', 'rgba(20,10,50,0.90)']}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={styles.welcomeBottom}>
            <View style={styles.welcomeLogoRow}>
              <Text style={styles.welcomeLogoEmoji}>🐾</Text>
              <Text style={styles.welcomeLogoText}>TwinTuna_Paws</Text>
            </View>
            <Text style={styles.welcomeSubtitle}>
              반려동물의 건강을 기록하고{'\n'}관리하는 스마트 다이어리
            </Text>
            <View style={styles.welcomeFeatures}>
              {['📋  건강 기록 & 일지', '💉  예방접종 스케줄', '🏥  병원 즐겨찾기', '📊  체중 & 건강 트렌드'].map((f) => (
                <View key={f} style={styles.welcomeFeatureRow}>
                  <Text style={styles.welcomeFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => setStep('select')} activeOpacity={0.85}>
              <LinearGradient
                colors={['#F9A8D4', '#818CF8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.welcomeStartBtn}
              >
                <Text style={styles.welcomeStartBtnText}>시작하기  →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    )
  }

  // ── 기존 펫 선택
  if (step === 'select') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.title}>반려동물을 선택하세요</Text>
          <Text style={styles.subtitle}>기존에 저장된 반려동물을 선택하거나{'\n'}새로 추가할 수 있어요</Text>

          <View style={styles.petList}>
            {pets.map((p) => (
              <TouchableOpacity key={p.id} style={styles.petSelectCard} onPress={() => selectExisting(p)}>
                <View style={styles.petSelectAvatar}>
                  {p.avatar_uri
                    ? <Image source={{ uri: p.avatar_uri }} style={styles.petSelectAvatarImg} />
                    : <Text style={styles.petSelectEmoji}>{p.species === '고양이' ? '🐱' : '🐶'}</Text>
                  }
                </View>
                <View style={styles.petSelectInfo}>
                  <Text style={styles.petSelectName}>{p.name}</Text>
                  <Text style={styles.petSelectSub}>{p.species}  ·  {p.breed || '품종 미입력'}</Text>
                  {p.weight ? <Text style={styles.petSelectSub}>{p.weight} kg</Text> : null}
                </View>
                <Text style={styles.petSelectArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.addNewBtn} onPress={() => setStep('species')}>
            <Text style={styles.addNewBtnText}>+ 새 반려동물 추가</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── 종 선택
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
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('select')}>
              <Text style={styles.backBtnText}>← 이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={() => setStep('details')}>
              <Text style={styles.primaryBtnText}>다음 →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // ── 펫 정보 입력
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
    // 웰컴 화면
    welcomeBottom: { padding: 32, paddingBottom: 56, gap: 16 },
    welcomeLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    welcomeLogoEmoji: { fontSize: 28 },
    welcomeLogoText: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
    welcomeSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 24 },
    welcomeFeatures: { gap: 8, marginVertical: 4 },
    welcomeFeatureRow: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    },
    welcomeFeatureText: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
    welcomeStartBtn: {
      borderRadius: 28, paddingVertical: 18, alignItems: 'center', marginTop: 8,
    },
    welcomeStartBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
    // 기존
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
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
    petList: { width: '100%', gap: 10 },
    petSelectCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.card, borderRadius: 16, padding: 16,
      borderWidth: 1.5, borderColor: c.border,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    petSelectAvatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    petSelectAvatarImg: { width: 52, height: 52, resizeMode: 'cover' },
    petSelectEmoji: { fontSize: 28 },
    petSelectInfo: { flex: 1 },
    petSelectName: { fontSize: 17, fontWeight: '700', color: c.text },
    petSelectSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    petSelectArrow: { fontSize: 18, color: c.textFaint },
    addNewBtn: {
      width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
      borderWidth: 2, borderColor: '#1A73E8', borderStyle: 'dashed',
      marginTop: 4,
    },
    addNewBtnText: { fontSize: 15, fontWeight: '700', color: '#1A73E8' },
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
