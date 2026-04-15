import { useState } from 'react'
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { usePet } from '../../src/context/PetContext'
import { useDiary } from '../../src/context/DiaryContext'
import { RecordType } from '../../src/types'
import { PetProfile } from '../../src/context/PetContext'

const TYPE_LABELS: Record<RecordType, string> = {
  weight: '체중', meal: '식사', symptom: '증상',
  vaccine: '접종', hospital: '병원', medicine: '투약',
}
const TYPE_UNITS: Partial<Record<RecordType, string>> = { weight: 'kg', meal: 'g' }

function todayStr() { return new Date().toISOString().split('T')[0] }

function formatRecord(r: { type: RecordType; value?: number; note?: string; meal_type?: string }): string {
  const unit = TYPE_UNITS[r.type] ?? ''
  if (r.value !== undefined) {
    const base = `${r.value} ${unit}`
    return r.meal_type ? `${base} (${r.meal_type})` : base
  }
  return r.note ?? ''
}

export default function HomeScreen() {
  const { pet, pets, activePetId, setActivePetId } = usePet()
  const { records, vaccines, addVaccine } = useDiary()
  const router      = useRouter()
  const [showAddVax, setShowAddVax] = useState(false)

  const today      = todayStr()
  const todayRecs  = records.filter((r) => r.petId === pet.id && r.date === today)

  const upcomingVaccines = vaccines
    .filter((v) => v.petId === pet.id && v.next_date >= today)
    .sort((a, b) => a.next_date.localeCompare(b.next_date))
    .slice(0, 3)
    .map((v) => {
      const daysUntil = Math.ceil((new Date(v.next_date).getTime() - new Date(today).getTime()) / 86400000)
      return { label: v.name, dday: `D-${daysUntil}`, urgent: daysUntil <= 7 }
    })

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* 반려동물 선택기 */}
        {pets.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}>
            <View style={styles.switcherRow}>
              {pets.map((p: PetProfile) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.switcherChip, p.id === activePetId && styles.switcherChipActive]}
                  onPress={() => setActivePetId(p.id)}
                >
                  <Text style={styles.switcherEmoji}>{p.species === '고양이' ? '🐱' : '🐶'}</Text>
                  <Text style={[styles.switcherName, p.id === activePetId && styles.switcherNameActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* 반려동물 카드 */}
        <View style={styles.petCard}>
          <View style={styles.petAvatar}>
            {pet.avatar_uri
              ? <Image source={{ uri: pet.avatar_uri }} style={styles.petAvatarImage} />
              : <Image
                  source={pet.species === '고양이'
                    ? require('../../assets/default-cat.png')
                    : require('../../assets/default-dog.png')}
                  style={styles.petAvatarImage}
                />
            }
          </View>
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{pet.name}</Text>
            <Text style={styles.petSub}>{pet.breed}  ·  {pet.weight} kg</Text>
          </View>
        </View>

        {/* 오늘의 기록 */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>오늘의 기록</Text>
          <TouchableOpacity style={styles.sectionAddBtn} onPress={() => router.push('/(tabs)/diary')}>
            <Text style={styles.sectionAddText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
        {todayRecs.length === 0 ? (
          <EmptyCard message="오늘 기록이 없어요. + 버튼으로 추가해보세요." />
        ) : (
          todayRecs.map((r) => (
            <RecordRow
              key={r.id}
              label={TYPE_LABELS[r.type]}
              value={formatRecord(r)}
            />
          ))
        )}

        {/* 다가오는 접종 일정 */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>다가오는 일정</Text>
          <TouchableOpacity style={styles.sectionAddBtn} onPress={() => setShowAddVax(true)}>
            <Text style={styles.sectionAddText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
        {upcomingVaccines.length === 0 ? (
          <EmptyCard message="예정된 접종 일정이 없어요." />
        ) : (
          upcomingVaccines.map((u, i) => (
            <View key={i} style={styles.scheduleRow}>
              <Text style={styles.scheduleLabel}>{u.label}</Text>
              <View style={[styles.ddayBadge, u.urgent && styles.ddayUrgent]}>
                <Text style={[styles.ddayText, u.urgent && styles.ddayTextUrgent]}>{u.dday}</Text>
              </View>
            </View>
          ))
        )}

      </ScrollView>

      <VaccineModal
        visible={showAddVax}
        petId={pet.id}
        onSave={({ name, last_date, next_date }) => {
          addVaccine({ petId: pet.id, name, last_date, next_date })
          setShowAddVax(false)
        }}
        onClose={() => setShowAddVax(false)}
      />
    </SafeAreaView>
  )
}

function VaccineModal({ visible, petId, onSave, onClose }: {
  visible: boolean
  petId: string
  onSave: (data: { name: string; last_date: string; next_date: string }) => void
  onClose: () => void
}) {
  const [name,     setName]     = useState('')
  const [lastDate, setLastDate] = useState('')
  const [nextDate, setNextDate] = useState('')

  function handleSave() {
    if (!name.trim() || !nextDate.trim()) return
    onSave({ name: name.trim(), last_date: lastDate.trim(), next_date: nextDate.trim() })
    setName(''); setLastDate(''); setNextDate('')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>접종/예방 일정 추가</Text>
          <Text style={styles.modalLabel}>접종명 *</Text>
          <TextInput style={styles.modalInput} value={name} onChangeText={setName} placeholder="예: 광견병, 종합백신" />
          <Text style={styles.modalLabel}>최근 접종일</Text>
          <TextInput style={styles.modalInput} value={lastDate} onChangeText={setLastDate} placeholder="YYYY-MM-DD" />
          <Text style={styles.modalLabel}>다음 예정일 *</Text>
          <TextInput style={styles.modalInput} value={nextDate} onChangeText={setNextDate} placeholder="YYYY-MM-DD" />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={handleSave}>
              <Text style={styles.modalSaveText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recordRow}>
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },
  petCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  petAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  petAvatarImage: { width: 48, height: 48, borderRadius: 24, resizeMode: 'cover' },
  petInfo: { flex: 1 },
  petName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  petSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 6 },
  recordRow: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  recordLabel: { fontSize: 13, fontWeight: '600', color: '#374151', width: 48 },
  recordValue: { flex: 1, fontSize: 14, color: '#111827' },
  scheduleRow: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  scheduleLabel: { fontSize: 14, color: '#374151', flex: 1 },
  ddayBadge: { backgroundColor: '#E0E7FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  ddayUrgent: { backgroundColor: '#FEE2E2' },
  ddayText: { fontSize: 12, fontWeight: '700', color: '#4338CA' },
  ddayTextUrgent: { color: '#DC2626' },
  emptyCard: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 18, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 13 },
  switcherScroll: { marginBottom: 4 },
  switcherRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  switcherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent',
  },
  switcherChipActive: { backgroundColor: '#EFF6FF', borderColor: '#1A73E8' },
  switcherEmoji: { fontSize: 16 },
  switcherName: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  switcherNameActive: { color: '#1A73E8' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  sectionAddBtn: { marginLeft: 'auto', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sectionAddText: { fontSize: 12, fontWeight: '700', color: '#1A73E8' },
  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalSave: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1A73E8', alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
})
