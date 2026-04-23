import { useState } from 'react'
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { RecordType } from '../../src/types'
import { useDiary, DiaryRecord, MealType } from '../../src/context/DiaryContext'
import { usePet, PetProfile } from '../../src/context/PetContext'
import { analyzeSymptomPhoto } from '../../src/lib/anthropic'

const RECORD_TYPES: { type: RecordType; emoji: string; label: string; color: string }[] = [
  { type: 'weight',   emoji: '⚖️',  label: '체중',   color: '#DBEAFE' },
  { type: 'meal',     emoji: '🍽️',  label: '식사',   color: '#D1FAE5' },
  { type: 'symptom',  emoji: '🌡️',  label: '증상',   color: '#FEE2E2' },
  { type: 'vaccine',  emoji: '💉',  label: '접종',   color: '#E0E7FF' },
  { type: 'hospital', emoji: '🏥',  label: '병원',   color: '#FEF3C7' },
  { type: 'medicine', emoji: '💊',  label: '투약',   color: '#FCE7F3' },
  { type: 'other',    emoji: '📝',  label: '기타',   color: '#F3F4F6' },
]

const TYPE_CONFIG: Record<RecordType, {
  showValue: boolean; valuePlaceholder: string; valueUnit: string
  notePlaceholder: string; showVet: boolean; showMealType: boolean; showPhoto: boolean
}> = {
  weight:   { showValue: true,  valuePlaceholder: '예: 4.2', valueUnit: 'kg', notePlaceholder: '특이사항 (선택)',          showVet: false, showMealType: false, showPhoto: false },
  meal:     { showValue: true,  valuePlaceholder: '급여량',  valueUnit: 'g',  notePlaceholder: '사료 이름 또는 메모',      showVet: false, showMealType: true,  showPhoto: false },
  symptom:  { showValue: false, valuePlaceholder: '',        valueUnit: '',   notePlaceholder: '증상을 자세히 적어주세요', showVet: false, showMealType: false, showPhoto: true  },
  vaccine:  { showValue: false, valuePlaceholder: '',        valueUnit: '',   notePlaceholder: '백신 이름 및 메모',        showVet: true,  showMealType: false, showPhoto: false },
  hospital: { showValue: false, valuePlaceholder: '',        valueUnit: '',   notePlaceholder: '진료 내용 및 처방',        showVet: true,  showMealType: false, showPhoto: false },
  medicine: { showValue: false, valuePlaceholder: '',        valueUnit: '',   notePlaceholder: '약 이름, 용량, 횟수',      showVet: false, showMealType: false, showPhoto: false },
  other:    { showValue: false, valuePlaceholder: '',        valueUnit: '',   notePlaceholder: '자유롭게 기록해보세요',     showVet: false, showMealType: false, showPhoto: false },
}

function todayStr() { return new Date().toISOString().split('T')[0] }

// ── 캘린더 컴포넌트
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DAY_NAMES   = ['일','월','화','수','목','금','토']

function CalendarView({ records, selectedDate, onSelectDate }: {
  records: DiaryRecord[]; selectedDate: string; onSelectDate: (d: string) => void
}) {
  const initDate = selectedDate || todayStr()
  const [year,  setYear]  = useState(() => parseInt(initDate.split('-')[0]))
  const [month, setMonth] = useState(() => parseInt(initDate.split('-')[1]) - 1)

  const firstDOW  = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()

  // date → records for this month
  const recordsByDate = records.reduce<Record<string, DiaryRecord[]>>((acc, r) => {
    const [y, m] = r.date.split('-').map(Number)
    if (y === year && m === month + 1) {
      if (!acc[r.date]) acc[r.date] = []
      acc[r.date].push(r)
    }
    return acc
  }, {})

  function pad(n: number) { return String(n).padStart(2, '0') }
  function ds(day: number) { return `${year}-${pad(month + 1)}-${pad(day)}` }

  function prev() { if (month === 0) { setYear((y) => y - 1); setMonth(11) } else setMonth((m) => m - 1) }
  function next() { if (month === 11) { setYear((y) => y + 1); setMonth(0) } else setMonth((m) => m + 1) }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDOW; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  return (
    <View style={calStyles.container}>
      <View style={calStyles.header}>
        <TouchableOpacity onPress={prev}><Text style={calStyles.arrow}>‹</Text></TouchableOpacity>
        <Text style={calStyles.monthTitle}>{year}년 {MONTH_NAMES[month]}</Text>
        <TouchableOpacity onPress={next}><Text style={calStyles.arrow}>›</Text></TouchableOpacity>
      </View>
      <View style={calStyles.dayRow}>
        {DAY_NAMES.map((d, i) => (
          <Text key={d} style={[calStyles.dayName, i === 0 && calStyles.sun]}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={calStyles.cell} />
          const dateStr  = ds(day)
          const dayRecs  = recordsByDate[dateStr] ?? []
          const isSel    = selectedDate === dateStr
          const isSun    = i % 7 === 0
          return (
            <TouchableOpacity
              key={dateStr}
              style={[calStyles.cell, isSel && calStyles.cellSelected]}
              onPress={() => onSelectDate(isSel ? '' : dateStr)}
            >
              <Text style={[calStyles.dayNum, isSun && calStyles.sun, isSel && calStyles.dayNumSelected]}>{day}</Text>
              {dayRecs.slice(0, 2).map((r, idx) => {
                const meta = RECORD_TYPES.find((t) => t.type === r.type)!
                const label = r.value !== undefined
                  ? `${meta.label} ${r.value}`
                  : r.note
                  ? `${meta.label} ${r.note.slice(0, 4)}`
                  : meta.label
                return (
                  <View key={idx} style={[calStyles.cellTag, { backgroundColor: isSel ? 'rgba(255,255,255,0.25)' : meta.color }]}>
                    <Text style={[calStyles.cellTagText, isSel && calStyles.cellTagTextSel]} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                )
              })}
              {dayRecs.length > 2 && (
                <Text style={[calStyles.cellMore, isSel && calStyles.cellMoreSel]}>+{dayRecs.length - 2}</Text>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ── 입력 모달
interface RecordModalProps {
  visible: boolean; type: RecordType | null
  initialValue?: string; initialNote?: string; initialVet?: string
  initialMealType?: MealType; initialPhotoUri?: string
  isEdit: boolean
  onSave: (d: { value: string; note: string; vet: string; mealType: MealType; photoUri: string; extraFields: { label: string; value: string }[] }) => void
  onClose: () => void
}

function RecordModal({
  visible, type,
  initialValue = '', initialNote = '', initialVet = '',
  initialMealType = '건식', initialPhotoUri = '',
  isEdit, onSave, onClose,
}: RecordModalProps) {
  const [value,    setValue]    = useState(initialValue)
  const [note,     setNote]     = useState(initialNote)
  const [vet,      setVet]      = useState(initialVet)
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [photoUri, setPhotoUri] = useState(initialPhotoUri)
  const [extraFields, setExtraFields] = useState<{ label: string; value: string }[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')

  function sync() {
    setValue(initialValue); setNote(initialNote); setVet(initialVet)
    setMealType(initialMealType); setPhotoUri(initialPhotoUri)
    setExtraFields([]); setNewFieldLabel(''); setNewFieldValue('')
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 })
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri)
  }

  if (!type) return null
  const meta = RECORD_TYPES.find((t) => t.type === type)!
  const cfg  = TYPE_CONFIG[type]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={sync}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalIcon, { backgroundColor: meta.color }]}><Text style={{ fontSize: 22 }}>{meta.emoji}</Text></View>
            <Text style={styles.modalTitle}>{isEdit ? `${meta.label} 편집` : `${meta.label} 기록`}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>

          {cfg.showMealType && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>식사 종류</Text>
              <View style={styles.segmentRow}>
                {(['건식', '습식', '혼합'] as MealType[]).map((t) => (
                  <TouchableOpacity key={t} style={[styles.segmentBtn, mealType === t && styles.segmentBtnActive]} onPress={() => setMealType(t)}>
                    <Text style={[styles.segmentText, mealType === t && styles.segmentTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {cfg.showValue && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{meta.label} ({cfg.valueUnit})</Text>
              <View style={styles.inputWithUnit}>
                <TextInput style={[styles.input, { flex: 1 }]} value={value} onChangeText={setValue} placeholder={cfg.valuePlaceholder} keyboardType="decimal-pad" autoFocus />
                <Text style={styles.unitText}>{cfg.valueUnit}</Text>
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>메모{cfg.showValue ? ' (선택)' : ''}</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={note} onChangeText={setNote} placeholder={cfg.notePlaceholder} multiline numberOfLines={3} autoFocus={!cfg.showValue && !cfg.showMealType} />
          </View>

          {cfg.showPhoto && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>사진 첨부 (선택)</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={pickPhoto}>
                  <Text style={styles.photoPickerText}>📷 사진 선택</Text>
                </TouchableOpacity>
                {photoUri ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotoUri('')}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {cfg.showVet && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>담당 수의사 / 병원 (선택)</Text>
              <TextInput style={styles.input} value={vet} onChangeText={setVet} placeholder="예: 행복동물병원 김수의" />
            </View>
          )}

          {/* 추가 항목 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>추가 항목</Text>
            {extraFields.map((field, fi) => (
              <View key={fi} style={styles.extraFieldRow}>
                <Text style={styles.extraFieldLabel}>{field.label}</Text>
                <Text style={{ color: '#888' }}>: </Text>
                <Text style={styles.extraFieldValue}>{field.value}</Text>
                <TouchableOpacity onPress={() => setExtraFields(extraFields.filter((_, i) => i !== fi))}>
                  <Text style={styles.extraFieldRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.extraFieldInputRow}>
              <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} value={newFieldLabel} onChangeText={setNewFieldLabel} placeholder="항목명" />
              <TextInput style={[styles.input, { flex: 2, marginRight: 6 }]} value={newFieldValue} onChangeText={setNewFieldValue} placeholder="내용" />
              <TouchableOpacity style={styles.extraFieldAddBtn} onPress={() => { if (!newFieldLabel.trim()) return; setExtraFields([...extraFields, { label: newFieldLabel.trim(), value: newFieldValue.trim() }]); setNewFieldLabel(''); setNewFieldValue('') }}>
                <Text style={styles.extraFieldAddText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={() => onSave({ value, note, vet, mealType, photoUri, extraFields })}>
            <Text style={styles.saveBtnText}>{isEdit ? '수정 완료' : '저장'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── 옵션 팝업
function OptionsModal({ visible, onEdit, onDelete, onClose }: {
  visible: boolean; onEdit: () => void; onDelete: () => void; onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.optionsSheet}>
          <TouchableOpacity style={styles.optionBtn} onPress={onEdit}><Text style={styles.optionEdit}>✏️  편집</Text></TouchableOpacity>
          <View style={styles.optionDivider} />
          <TouchableOpacity style={styles.optionBtn} onPress={onDelete}><Text style={styles.optionDelete}>🗑️  삭제</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

// ── 메인 화면
export default function DiaryScreen() {
  const { records: allRecords, addRecord, updateRecord, deleteRecord } = useDiary()
  const { activePet, pets, activePetId, setActivePetId } = usePet()

  const records = allRecords.filter((r) => r.petId === activePet.id)

  const [addType,        setAddType]       = useState<RecordType | null>(null)
  const [addDate,        setAddDate]       = useState('')
  const [showCalPicker,  setShowCalPicker] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<DiaryRecord | null>(null)
  const [showOptions,    setShowOptions]   = useState(false)
  const [editRecord,     setEditRecord]    = useState<DiaryRecord | null>(null)
  const [viewMode,       setViewMode]      = useState<'list' | 'calendar'>('list')
  const [selectedDate,   setSelectedDate]  = useState('')
  const [showAiModal,    setShowAiModal]   = useState(false)
  const [aiPhoto,        setAiPhoto]       = useState('')
  const [aiResult,       setAiResult]      = useState('')
  const [aiLoading,      setAiLoading]     = useState(false)

  const displayRecords = viewMode === 'calendar' && selectedDate
    ? records.filter((r) => r.date === selectedDate)
    : records

  function buildRecord(type: RecordType, data: { value: string; note: string; vet: string; mealType: MealType; photoUri: string; extraFields: { label: string; value: string }[] }): Omit<DiaryRecord, 'id'> | null {
    const cfg = TYPE_CONFIG[type]
    if (cfg.showValue && (!data.value.trim() || isNaN(parseFloat(data.value)) || parseFloat(data.value) <= 0)) return null
    if (!cfg.showValue && !data.note.trim()) return null
    return {
      petId:     activePet.id,
      date:      addDate || todayStr(),
      type,
      value:     cfg.showValue ? parseFloat(data.value) : undefined,
      note:      data.note.trim() || undefined,
      vet_name:  data.vet.trim()  || undefined,
      meal_type: cfg.showMealType ? data.mealType : undefined,
      photo_uri: cfg.showPhoto && data.photoUri ? data.photoUri : undefined,
      extra_fields: data.extraFields.length > 0 ? data.extraFields : undefined,
    }
  }

  function handleAdd(data: { value: string; note: string; vet: string; mealType: MealType; photoUri: string; extraFields: { label: string; value: string }[] }) {
    if (!addType) return
    const r = buildRecord(addType, data)
    if (!r) return
    addRecord(r)
    setAddType(null)
  }

  function handleEditSave(data: { value: string; note: string; vet: string; mealType: MealType; photoUri: string; extraFields: { label: string; value: string }[] }) {
    if (!editRecord) return
    const r = buildRecord(editRecord.type, data)
    if (!r) return
    updateRecord({ id: editRecord.id, ...r, date: editRecord.date })
    setEditRecord(null)
  }

  async function pickAiPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.3 })
    if (!result.canceled && result.assets[0]) setAiPhoto(result.assets[0].uri)
  }

  async function runAiAnalysis() {
    if (!aiPhoto) return
    setAiLoading(true)
    setAiResult('')
    try {
      const text = await analyzeSymptomPhoto(aiPhoto)
      setAiResult(text)
    } catch (e: any) {
      setAiResult(`❌ 오류: ${e.message ?? '알 수 없는 오류가 발생했습니다.'}`)
    } finally {
      setAiLoading(false)
    }
  }

  function handleRecordPress(r: DiaryRecord) { setSelectedRecord(r); setShowOptions(true) }
  function startEdit() { setShowOptions(false); setEditRecord(selectedRecord) }
  function confirmDelete() { setShowOptions(false); deleteRecord(selectedRecord!.id); setSelectedRecord(null) }

  const grouped = displayRecords.reduce<Record<string, DiaryRecord[]>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = []
    acc[r.date].push(r)
    return acc
  }, {})

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

        {/* 기록 추가 그리드 */}
        <Text style={styles.sectionTitle}>기록 추가</Text>
        <View style={styles.typeGrid}>
          {RECORD_TYPES.map((t) => (
            <TouchableOpacity key={t.type} style={[styles.typeCard, { backgroundColor: t.color }]} onPress={() => { setAddDate(todayStr()); setAddType(t.type) }}>
              <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
              <Text style={styles.typeLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* AI 증상 분석 버튼 */}
        <TouchableOpacity style={styles.aiBtn} onPress={() => { setAiPhoto(''); setAiResult(''); setShowAiModal(true) }}>
          <Text style={styles.aiBtnText}>🤖 AI 증상 분석</Text>
          <Text style={styles.aiBtnSub}>사진으로 1차 체크</Text>
        </TouchableOpacity>

        {/* 뷰 모드 전환 */}
        <View style={styles.viewToggle}>
          <TouchableOpacity style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]} onPress={() => setViewMode('list')}>
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>📋 목록</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]} onPress={() => { setViewMode('calendar'); if (!selectedDate) setSelectedDate(todayStr()) }}>
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>📅 캘린더</Text>
          </TouchableOpacity>
        </View>

        {/* 캘린더 */}
        {viewMode === 'calendar' && (
          <CalendarView records={records} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        )}

        {/* 기록 목록 */}
        {viewMode === 'calendar' && !selectedDate ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>날짜를 선택하면 해당 날의 기록을 볼 수 있어요.</Text>
          </View>
        ) : (
          <>
            {viewMode === 'calendar' && selectedDate && (
              <View style={styles.calDateRow}>
                <Text style={styles.sectionTitle}>{selectedDate} 기록</Text>
                <TouchableOpacity style={styles.calAddBtn} onPress={() => setShowCalPicker(true)}>
                  <Text style={styles.calAddText}>+ 추가</Text>
                </TouchableOpacity>
              </View>
            )}
            {viewMode === 'list' && <Text style={styles.sectionTitle}>기록 내역</Text>}

            {displayRecords.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {viewMode === 'calendar' ? '이 날에 기록이 없어요.' : '아직 기록이 없어요. 위에서 추가해보세요.'}
                </Text>
              </View>
            ) : (
              Object.entries(grouped)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, dateRecords]) => (
                  <View key={date}>
                    {viewMode === 'list' && <Text style={styles.dateHeader}>{date}</Text>}
                    {dateRecords.map((r) => {
                      const meta = RECORD_TYPES.find((t) => t.type === r.type)!
                      const cfg  = TYPE_CONFIG[r.type]
                      return (
                        <TouchableOpacity key={r.id} style={styles.recordCard} onPress={() => handleRecordPress(r)}>
                          <View style={[styles.recordIcon, { backgroundColor: meta.color }]}>
                            <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                          </View>
                          <View style={styles.recordBody}>
                            <View style={styles.recordTitleRow}>
                              <Text style={styles.recordType}>{meta.label}</Text>
                              {r.meal_type && <View style={styles.mealBadge}><Text style={styles.mealBadgeText}>{r.meal_type}</Text></View>}
                            </View>
                            {r.value !== undefined && <Text style={styles.recordValue}>{r.value} {cfg.valueUnit}</Text>}
                            {r.note      && <Text style={styles.recordNote}>{r.note}</Text>}
                            {r.vet_name  && <Text style={styles.recordNote}>담당: {r.vet_name}</Text>}
                            {r.photo_uri && <Image source={{ uri: r.photo_uri }} style={styles.recordThumb} />}
                          </View>
                          <Text style={styles.tapHint}>•••</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                ))
            )}
          </>
        )}

      </ScrollView>

      {/* 캘린더 날짜 기록 추가 - 타입 선택 */}
      <Modal visible={showCalPicker} transparent animationType="slide" onRequestClose={() => setShowCalPicker(false)}>
        <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]} activeOpacity={1} onPress={() => setShowCalPicker(false)}>
          <View style={styles.calPickerSheet}>
            <Text style={styles.calPickerTitle}>{selectedDate} 기록 추가</Text>
            <View style={styles.typeGrid}>
              {RECORD_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.type}
                  style={[styles.typeCard, { backgroundColor: t.color }]}
                  onPress={() => { setShowCalPicker(false); setAddDate(selectedDate); setAddType(t.type) }}
                >
                  <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
                  <Text style={styles.typeLabel}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* AI 증상 분석 모달 */}
      <Modal visible={showAiModal} transparent animationType="slide" onRequestClose={() => setShowAiModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAiModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#EDE9FE' }]}><Text style={{ fontSize: 22 }}>🤖</Text></View>
              <Text style={styles.modalTitle}>AI 증상 분석</Text>
              <TouchableOpacity onPress={() => setShowAiModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>반려동물 사진 선택</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={pickAiPhoto}>
                  <Text style={styles.photoPickerText}>📷 사진 선택</Text>
                </TouchableOpacity>
                {aiPhoto ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image source={{ uri: aiPhoto }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => { setAiPhoto(''); setAiResult('') }}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>

            {aiResult ? (
              <View style={styles.aiResultBox}>
                <Text style={styles.aiResultText}>{aiResult}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, (!aiPhoto || aiLoading) && styles.saveBtnDisabled]}
              onPress={runAiAnalysis}
              disabled={!aiPhoto || aiLoading}
            >
              <Text style={styles.saveBtnText}>
                {aiLoading ? '분석 중...' : aiResult ? '다시 분석' : '분석 시작'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <RecordModal visible={addType !== null} type={addType} isEdit={false} onSave={handleAdd} onClose={() => setAddType(null)} />
      <RecordModal
        visible={editRecord !== null} type={editRecord?.type ?? null}
        initialValue={editRecord?.value !== undefined ? String(editRecord.value) : ''}
        initialNote={editRecord?.note ?? ''} initialVet={editRecord?.vet_name ?? ''}
        initialMealType={editRecord?.meal_type ?? '건식'} initialPhotoUri={editRecord?.photo_uri ?? ''}
        isEdit onSave={handleEditSave} onClose={() => setEditRecord(null)}
      />
      <OptionsModal visible={showOptions} onEdit={startEdit} onDelete={confirmDelete} onClose={() => setShowOptions(false)} />
    </SafeAreaView>
  )
}

// ── 캘린더 스타일
const calStyles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  arrow: { fontSize: 26, color: '#1A73E8', paddingHorizontal: 8 },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dayRow: { flexDirection: 'row', marginBottom: 4 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#6B7280' },
  sun: { color: '#EF4444' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, minHeight: 60, alignItems: 'center', paddingTop: 5, paddingBottom: 4, paddingHorizontal: 1, gap: 2 },
  cellSelected: { backgroundColor: '#1A73E8', borderRadius: 10 },
  dayNum: { fontSize: 13, color: '#374151' },
  dayNumSelected: { color: '#FFFFFF', fontWeight: '700' },
  cellTag: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, width: '95%' },
  cellTagText: { fontSize: 8, color: '#374151', fontWeight: '500' },
  cellTagTextSel: { color: '#FFFFFF' },
  cellMore: { fontSize: 8, color: '#9CA3AF', fontWeight: '600' },
  cellMoreSel: { color: 'rgba(255,255,255,0.7)' },
})

const styles = StyleSheet.create({
  extraFieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' },
  extraFieldLabel: { fontWeight: '600', color: '#374151', marginRight: 2 },
  extraFieldValue: { flex: 1, color: '#4B5563' },
  extraFieldRemove: { color: '#EF4444', fontSize: 14, paddingHorizontal: 8, paddingVertical: 2 },
  extraFieldInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  extraFieldAddBtn: { backgroundColor: '#3B82F6', borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  extraFieldAddText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 4, marginBottom: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: '30%', borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 4 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },

  // 뷰 토글
  viewToggle: { flexDirection: 'row', gap: 8, marginTop: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#1A73E8' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#FFFFFF' },

  // 기록 카드
  dateHeader: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginTop: 10, marginBottom: 4 },
  recordCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  recordIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recordBody: { flex: 1, gap: 2 },
  recordTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordType: { fontSize: 13, fontWeight: '600', color: '#374151' },
  mealBadge: { backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
  mealBadgeText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
  recordValue: { fontSize: 14, color: '#111827' },
  recordNote: { fontSize: 12, color: '#6B7280' },
  recordThumb: { width: 72, height: 72, borderRadius: 8, marginTop: 6 },
  tapHint: { fontSize: 14, color: '#D1D5DB', letterSpacing: 1 },
  emptyBox: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 18, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },

  // 캘린더 날짜 헤더
  calDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 },
  calAddBtn: { marginLeft: 'auto', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  calAddText: { fontSize: 12, fontWeight: '700', color: '#1A73E8' },
  calPickerSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingTop: 20, gap: 14,
  },
  calPickerTitle: { fontSize: 15, fontWeight: '700', color: '#374151', textAlign: 'center', marginBottom: 4 },
  // 모달
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1 },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },
  modalClose: { fontSize: 18, color: '#9CA3AF', padding: 4 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
  },
  inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  unitText: { fontSize: 14, fontWeight: '600', color: '#6B7280', width: 28 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB' },
  segmentBtnActive: { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
  segmentText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  segmentTextActive: { color: '#065F46', fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoPickerBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  photoPickerText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  photoPreviewWrapper: { position: 'relative' },
  photoPreview: { width: 64, height: 64, borderRadius: 10 },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EDE9FE', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
  },
  aiBtnText: { fontSize: 15, fontWeight: '700', color: '#5B21B6' },
  aiBtnSub: { fontSize: 11, color: '#7C3AED', fontWeight: '500' },
  aiResultBox: {
    backgroundColor: '#F5F3FF', borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#7C3AED',
  },
  aiResultText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  saveBtn: { backgroundColor: '#1A73E8', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 2 },
  saveBtnDisabled: { backgroundColor: '#9CA3AF' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  optionsSheet: { backgroundColor: '#FFFFFF', borderRadius: 18, width: 220, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  optionBtn: { padding: 18, alignItems: 'center' },
  optionEdit: { fontSize: 16, color: '#1A73E8', fontWeight: '600' },
  optionDelete: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
  optionDivider: { height: 1, backgroundColor: '#F3F4F6' },
})
