import { useMemo, useState } from 'react'
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, Image, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { usePet, PetProfile } from '../../src/context/PetContext'
import { useDiary, VaccineItem } from '../../src/context/DiaryContext'
import { useTheme, Colors } from '../../src/context/ThemeContext'

function confirmAlert(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm()
  } else {
    Alert.alert('확인', message, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: onConfirm },
    ])
  }
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

function getAge(birthDate: string) {
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return '날짜 오류'
  const now    = new Date()
  const years  = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  return months < 0 ? `${years - 1}살 ${12 + months}개월` : `${years}살 ${months}개월`
}

interface VaccineModalProps {
  visible: boolean
  initial?: VaccineItem | null
  onSave: (data: { name: string; last_date: string; next_date: string }) => void
  onClose: () => void
}

function VaccineModal({ visible, initial, onSave, onClose }: VaccineModalProps) {
  const [name,      setName]      = useState(initial?.name      ?? '')
  const [lastDate,  setLastDate]  = useState(initial?.last_date ?? '')
  const [nextDate,  setNextDate]  = useState(initial?.next_date ?? '')
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  function sync() {
    setName(initial?.name      ?? '')
    setLastDate(initial?.last_date ?? '')
    setNextDate(initial?.next_date ?? '')
  }

  function handleSave() {
    if (!name.trim())     { Alert.alert('백신 이름을 입력해주세요.'); return }
    if (!nextDate.trim()) { Alert.alert('다음 접종 예정일을 입력해주세요.'); return }
    onSave({ name: name.trim(), last_date: lastDate.trim(), next_date: nextDate.trim() })
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={sync}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial ? '접종 편집' : '접종 일정 추가'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>백신 / 예방약 이름</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: 종합백신 (FVRCP)" placeholderTextColor={c.textFaint} autoFocus />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>마지막 접종일 (선택)</Text>
            <TextInput style={styles.input} value={lastDate} onChangeText={(v) => setLastDate(formatDateInput(v))} placeholder="YYYY-MM-DD" placeholderTextColor={c.textFaint} keyboardType="number-pad" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>다음 접종 예정일</Text>
            <TextInput style={styles.input} value={nextDate} onChangeText={(v) => setNextDate(formatDateInput(v))} placeholder="YYYY-MM-DD" placeholderTextColor={c.textFaint} keyboardType="number-pad" />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>{initial ? '수정 완료' : '저장'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

interface AddPetModalProps {
  visible: boolean
  onSave: (data: Omit<PetProfile, 'id'>) => void
  onClose: () => void
}

function AddPetModal({ visible, onSave, onClose }: AddPetModalProps) {
  const [draft, setDraft] = useState<Omit<PetProfile, 'id'>>({
    name: '', species: '고양이', breed: '', birth_date: '', weight: '',
  })
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  function reset() {
    setDraft({ name: '', species: '고양이', breed: '', birth_date: '', weight: '' })
  }

  function handleSave() {
    if (!draft.name.trim()) { Alert.alert('이름을 입력해주세요.'); return }
    const w = parseFloat(draft.weight)
    if (isNaN(w) || w <= 0) { Alert.alert('체중을 올바르게 입력해주세요. (예: 4.2)'); return }
    onSave({ ...draft, weight: String(w) })
    reset()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={reset}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>반려동물 추가</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>종</Text>
            <View style={styles.speciesRow}>
              {(['고양이', '강아지'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.speciesBtn, draft.species === s && styles.speciesBtnActive]}
                  onPress={() => setDraft((d) => ({ ...d, species: s }))}
                >
                  <Text style={[styles.speciesBtnText, draft.species === s && styles.speciesBtnTextActive]}>
                    {s === '고양이' ? '🐱 고양이' : '🐶 강아지'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>이름</Text>
            <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="반려동물 이름" placeholderTextColor={c.textFaint} autoFocus />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>품종</Text>
            <TextInput style={styles.input} value={draft.breed} onChangeText={(v) => setDraft((d) => ({ ...d, breed: v }))} placeholder="예: 코리안 숏헤어" placeholderTextColor={c.textFaint} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>생년월일</Text>
            <TextInput style={styles.input} value={draft.birth_date} onChangeText={(v) => setDraft((d) => ({ ...d, birth_date: formatDateInput(v) }))} placeholder="YYYY-MM-DD" placeholderTextColor={c.textFaint} keyboardType="number-pad" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>체중 (kg)</Text>
            <TextInput style={styles.input} value={draft.weight} onChangeText={(v) => setDraft((d) => ({ ...d, weight: v }))} placeholder="예: 4.2" placeholderTextColor={c.textFaint} keyboardType="decimal-pad" />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>추가</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function ProfileScreen() {
  const { pets, activePetId, activePet, setActivePetId, addPet, updateActivePet, deletePet } = usePet()
  const { vaccines, addVaccine, deleteVaccine } = useDiary()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  const [editing, setEditing]         = useState(false)
  const [draft, setDraft]             = useState<PetProfile>(activePet)
  const [showAddPet, setShowAddPet]   = useState(false)
  const [showAddVax, setShowAddVax]   = useState(false)
  const [editVax, setEditVax]         = useState<VaccineItem | null>(null)

  const petVaccines = vaccines.filter((v) => v.petId === activePetId)
  const today = new Date().toISOString().split('T')[0]

  async function pickAvatar() {
    if (!editing) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.4,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri
      setDraft((d) => ({ ...d, avatar_uri: uri }))
    }
  }

  function startEdit() { setDraft({ ...activePet }); setEditing(true) }

  function saveEdit() {
    if (!draft.name.trim()) { Alert.alert('이름을 입력해주세요.'); return }
    const w = parseFloat(draft.weight)
    if (isNaN(w) || w <= 0) { Alert.alert('체중을 올바르게 입력해주세요. (예: 4.2)'); return }
    updateActivePet({ ...draft, weight: String(w) })
    setEditing(false)
  }

  const displayPet = editing ? draft : activePet

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

          {/* 반려동물 전환 바 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petSwitcherScroll}>
            <View style={styles.petSwitcherRow}>
              {pets.map((p) => {
                const isActive = p.id === activePetId
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.petChip, isActive && styles.petChipActive]}
                    onPress={() => { if (!editing) setActivePetId(p.id) }}
                  >
                    <View style={[styles.petChipAvatar, isActive && styles.petChipAvatarActive]}>
                      {p.avatar_uri
                        ? <Image source={{ uri: p.avatar_uri }} style={styles.petChipImage} />
                        : <Image
                            source={p.species === '고양이'
                              ? require('../../assets/default-cat.png')
                              : require('../../assets/default-dog.png')}
                            style={styles.petChipDefault}
                          />
                      }
                    </View>
                    <Text style={[styles.petChipName, isActive && styles.petChipNameActive]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              {!editing && (
                <TouchableOpacity style={styles.addPetBtn} onPress={() => setShowAddPet(true)}>
                  <Text style={styles.addPetBtnText}>＋</Text>
                  <Text style={styles.addPetBtnLabel}>추가</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* 프로필 카드 */}
          <View style={styles.profileCard}>
            {editing ? (
              <TouchableOpacity style={styles.avatarWrapper} onPress={pickAvatar}>
                {displayPet.avatar_uri
                  ? <Image source={{ uri: displayPet.avatar_uri }} style={styles.avatarImage} />
                  : <Image
                      source={displayPet.species === '고양이'
                        ? require('../../assets/default-cat.png')
                        : require('../../assets/default-dog.png')}
                      style={styles.avatarDefault}
                    />
                }
                <View style={styles.cameraIcon}><Text style={{ fontSize: 14 }}>📷</Text></View>
              </TouchableOpacity>
            ) : (
              <View style={styles.avatarWrapper}>
                {displayPet.avatar_uri
                  ? <Image source={{ uri: displayPet.avatar_uri }} style={styles.avatarImage} />
                  : <Image
                      source={displayPet.species === '고양이'
                        ? require('../../assets/default-cat.png')
                        : require('../../assets/default-dog.png')}
                      style={styles.avatarDefault}
                    />
                }
              </View>
            )}

            {editing ? (
              <View style={styles.editForm}>
                <Field label="이름" styles={styles}>
                  <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="반려동물 이름" placeholderTextColor={c.textFaint} />
                </Field>
                <Field label="종" styles={styles}>
                  <View style={styles.speciesRow}>
                    {(['고양이', '강아지'] as const).map((s) => (
                      <TouchableOpacity key={s} style={[styles.speciesBtn, draft.species === s && styles.speciesBtnActive]} onPress={() => setDraft((d) => ({ ...d, species: s }))}>
                        <Text style={[styles.speciesBtnText, draft.species === s && styles.speciesBtnTextActive]}>{s === '고양이' ? '🐱 고양이' : '🐶 강아지'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>
                <Field label="품종" styles={styles}>
                  <TextInput style={styles.input} value={draft.breed} onChangeText={(v) => setDraft((d) => ({ ...d, breed: v }))} placeholder="예: 코리안 숏헤어" placeholderTextColor={c.textFaint} />
                </Field>
                <Field label="생년월일" styles={styles}>
                  <TextInput style={styles.input} value={draft.birth_date} onChangeText={(v) => setDraft((d) => ({ ...d, birth_date: formatDateInput(v) }))} placeholder="YYYY-MM-DD" placeholderTextColor={c.textFaint} keyboardType="number-pad" />
                </Field>
                <Field label="체중 (kg)" styles={styles}>
                  <TextInput style={styles.input} value={draft.weight} onChangeText={(v) => setDraft((d) => ({ ...d, weight: v }))} placeholder="예: 4.2" placeholderTextColor={c.textFaint} keyboardType="decimal-pad" />
                </Field>
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}><Text style={styles.cancelBtnText}>취소</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}><Text style={styles.saveBtnText}>저장</Text></TouchableOpacity>
                </View>
                {pets.length > 1 && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() =>
                      confirmAlert(
                        `"${activePet.name}"을(를) 삭제할까요?`,
                        () => { deletePet(activePet.id); setEditing(false) }
                      )
                    }
                  >
                    <Text style={styles.deleteBtnText}>🗑️ 이 반려동물 삭제</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.petName}>{activePet.name}</Text>
                <Text style={styles.petSub}>{activePet.breed}</Text>
                <View style={styles.statsRow}>
                  <StatItem label="나이"  value={getAge(activePet.birth_date)} styles={styles} />
                  <View style={styles.statDivider} />
                  <StatItem label="체중"  value={`${activePet.weight} kg`} styles={styles} />
                  <View style={styles.statDivider} />
                  <StatItem label="종"    value={activePet.species} styles={styles} />
                </View>
              </>
            )}
          </View>

          {/* 접종 스케줄 */}
          {!editing && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>접종 / 예방 스케줄</Text>
                <TouchableOpacity style={styles.sectionAddBtn} onPress={() => setShowAddVax(true)}>
                  <Text style={styles.sectionAddText}>＋ 추가</Text>
                </TouchableOpacity>
              </View>

              {petVaccines.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>아직 접종 일정이 없어요. ＋ 추가 버튼으로 등록하세요.</Text>
                </View>
              )}

              {petVaccines.map((v) => {
                const daysUntil = Math.ceil(
                  (new Date(v.next_date).getTime() - new Date(today).getTime()) / 86400000
                )
                const urgent = daysUntil <= 14
                return (
                  <View key={v.id} style={styles.vaccineRow}>
                    <View style={styles.vaccineInfo}>
                      <Text style={styles.vaccineName}>{v.name}</Text>
                      {v.last_date ? <Text style={styles.vaccineDate}>마지막: {v.last_date}</Text> : null}
                    </View>
                    <View style={[styles.nextBadge, urgent && styles.nextBadgeUrgent]}>
                      <Text style={styles.nextLabel}>다음</Text>
                      <Text style={[styles.nextDate, urgent && styles.nextDateUrgent]}>{v.next_date}</Text>
                    </View>
                    <TouchableOpacity style={styles.vaccineDelete} onPress={() =>
                      confirmAlert(`"${v.name}" 일정을 삭제할까요?`, () => deleteVaccine(v.id))
                    }>
                      <Text style={styles.vaccineDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </>
          )}

          {!editing && (
            <TouchableOpacity style={styles.editButton} onPress={startEdit}>
              <Text style={styles.editButtonText}>✏️  프로필 편집</Text>
            </TouchableOpacity>
          )}


        </ScrollView>
      </KeyboardAvoidingView>

      <AddPetModal
        visible={showAddPet}
        onSave={(data) => { addPet(data); setShowAddPet(false) }}
        onClose={() => setShowAddPet(false)}
      />

      <VaccineModal
        visible={showAddVax || editVax !== null}
        initial={editVax}
        onSave={({ name, last_date, next_date }) => {
          addVaccine({ petId: activePetId, name, last_date, next_date })
          setShowAddVax(false)
          setEditVax(null)
        }}
        onClose={() => { setShowAddVax(false); setEditVax(null) }}
      />
    </SafeAreaView>
  )
}

function StatItem({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 10 },
    petSwitcherScroll: { marginBottom: 4 },
    petSwitcherRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    petChip: { alignItems: 'center', gap: 4, opacity: 0.6 },
    petChipActive: { opacity: 1 },
    petChipAvatar: {
      width: 54, height: 54, borderRadius: 27,
      backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      borderWidth: 2, borderColor: 'transparent',
    },
    petChipAvatarActive: { borderColor: '#1A73E8' },
    petChipImage: { width: 40, height: 40, borderRadius: 20, resizeMode: 'cover' },
    petChipDefault: { width: 34, height: 34, resizeMode: 'contain' },
    petChipName: { fontSize: 11, color: c.textFaint, maxWidth: 60 },
    petChipNameActive: { color: '#1A73E8', fontWeight: '700' },
    addPetBtn: { alignItems: 'center', gap: 4, width: 54 },
    addPetBtnText: { fontSize: 22, color: '#1A73E8', lineHeight: 28 },
    addPetBtnLabel: { fontSize: 11, color: '#1A73E8', fontWeight: '600' },
    profileCard: {
      backgroundColor: c.card, borderRadius: 20, padding: 24,
      alignItems: 'center', gap: 6, marginBottom: 4,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },
    avatarWrapper: {
      marginBottom: 4, position: 'relative',
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    avatarImage: { width: 74, height: 74, borderRadius: 37, resizeMode: 'cover' },
    avatarDefault: { width: 68, height: 68, resizeMode: 'contain' },
    cameraIcon: {
      position: 'absolute', bottom: 0, right: 0,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
    },
    petName: { fontSize: 24, fontWeight: '800', color: c.text },
    petSub: { fontSize: 14, color: c.textMuted },
    statsRow: {
      flexDirection: 'row', marginTop: 12,
      backgroundColor: c.bg, borderRadius: 14, padding: 14,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: { fontSize: 15, fontWeight: '700', color: c.text },
    statLabel: { fontSize: 11, color: c.textFaint },
    statDivider: { width: 1, backgroundColor: c.border, marginVertical: 4 },
    editForm: { width: '100%', gap: 12, marginTop: 8 },
    field: { gap: 4 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    input: {
      borderWidth: 1, borderColor: c.borderSub, borderRadius: 10,
      padding: 12, fontSize: 14, color: c.text, backgroundColor: c.inputBg,
    },
    speciesRow: { flexDirection: 'row', gap: 10 },
    speciesBtn: {
      flex: 1, padding: 12, borderRadius: 10,
      borderWidth: 1, borderColor: c.borderSub, alignItems: 'center', backgroundColor: c.inputBg,
    },
    speciesBtnActive: { borderColor: '#1A73E8', backgroundColor: '#EFF6FF' },
    speciesBtnText: { fontSize: 14, color: c.textMuted, fontWeight: '500' },
    speciesBtnTextActive: { color: '#1A73E8', fontWeight: '700' },
    editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1, padding: 14, borderRadius: 12,
      borderWidth: 1, borderColor: c.borderSub, alignItems: 'center',
    },
    cancelBtnText: { fontSize: 15, fontWeight: '600', color: c.textMuted },
    saveBtn: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: '#1A73E8', alignItems: 'center' },
    saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.textSub },
    sectionAddBtn: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    sectionAddText: { fontSize: 13, fontWeight: '700', color: '#1A73E8' },
    vaccineRow: {
      backgroundColor: c.card, borderRadius: 12, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    vaccineInfo: { flex: 1 },
    vaccineName: { fontSize: 14, fontWeight: '600', color: c.text },
    vaccineDate: { fontSize: 12, color: c.textFaint, marginTop: 2 },
    nextBadge: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 8, alignItems: 'center' },
    nextBadgeUrgent: { backgroundColor: '#FEF3C7' },
    nextLabel: { fontSize: 10, color: c.textFaint },
    nextDate: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
    nextDateUrgent: { color: '#D97706' },
    vaccineDelete: { padding: 8, marginLeft: 4 },
    vaccineDeleteText: { fontSize: 14, color: c.border, fontWeight: '700' },
    emptyBox: { backgroundColor: c.chip, borderRadius: 12, padding: 18, alignItems: 'center' },
    emptyText: { color: c.textFaint, fontSize: 13, textAlign: 'center' },
    editButton: { backgroundColor: c.chip, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
    editButtonText: { fontSize: 15, fontWeight: '700', color: c.textSub },
    deleteBtn: { padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', marginTop: 4 },
    deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 14,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: c.text },
    modalClose: { fontSize: 18, color: c.textFaint, padding: 4 },
    inputGroup: { gap: 6 },
    inputLabel: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  })
}
