import { useMemo, useState, useEffect } from 'react'
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { RecordType } from '../../src/types'
import { useDiary, DiaryRecord, MealType } from '../../src/context/DiaryContext'
import { usePet, PetProfile } from '../../src/context/PetContext'
import { analyzeSymptomPhoto, analyzeSymptomText, analyzeSymptomBoth } from '../../src/lib/anthropic'
import { useTheme, Colors } from '../../src/context/ThemeContext'
import { exportReport, getDateRange, filterRecords, Period } from '../../src/lib/export'

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

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DAY_NAMES   = ['일','월','화','수','목','금','토']

function CalendarView({ records, selectedDate, onSelectDate }: {
  records: DiaryRecord[]; selectedDate: string; onSelectDate: (d: string) => void
}) {
  const initDate = selectedDate || todayStr()
  const [year,  setYear]  = useState(() => parseInt(initDate.split('-')[0]))
  const [month, setMonth] = useState(() => parseInt(initDate.split('-')[1]) - 1)
  const { colors: c } = useTheme()
  const calStyles = useMemo(() => getCalStyles(c), [c])

  const firstDOW  = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()

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

interface RecordModalProps {
  visible: boolean; type: RecordType | null
  initialValue?: string; initialNote?: string; initialVet?: string
  initialMealType?: MealType; initialPhotoUri?: string
  initialExtraFields?: { label: string; value: string }[]
  isEdit: boolean
  onSave: (d: { value: string; note: string; vet: string; mealType: MealType; photoUri: string; extraFields: { label: string; value: string }[] }) => void
  onClose: () => void
}

function RecordModal({
  visible, type,
  initialValue = '', initialNote = '', initialVet = '',
  initialMealType = '건식', initialPhotoUri = '',
  initialExtraFields = [],
  isEdit, onSave, onClose,
}: RecordModalProps) {
  const [value,    setValue]    = useState(initialValue)
  const [note,     setNote]     = useState(initialNote)
  const [vet,      setVet]      = useState(initialVet)
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [photoUri, setPhotoUri] = useState(initialPhotoUri)
  const [extraFields, setExtraFields] = useState<{ label: string; value: string }[]>(initialExtraFields)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  function sync() {
    setValue(initialValue); setNote(initialNote); setVet(initialVet)
    setMealType(initialMealType); setPhotoUri(initialPhotoUri)
    setExtraFields(initialExtraFields); setNewFieldLabel(''); setNewFieldValue('')
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
                {(['건식', '습식', '혼합', '물'] as MealType[]).map((t) => (
                  <TouchableOpacity key={t} style={[styles.segmentBtn, mealType === t && (t === '물' ? styles.segmentBtnWater : styles.segmentBtnActive)]} onPress={() => setMealType(t)}>
                    <Text style={[styles.segmentText, mealType === t && (t === '물' ? styles.segmentTextWater : styles.segmentTextActive)]}>{t === '물' ? '💧 물' : t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {cfg.showValue && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{meta.label} ({mealType === '물' ? 'ml' : cfg.valueUnit})</Text>
              <View style={styles.inputWithUnit}>
                <TextInput style={[styles.input, { flex: 1 }]} value={value} onChangeText={setValue} placeholder={mealType === '물' ? '마신 양' : cfg.valuePlaceholder} placeholderTextColor={c.textFaint} keyboardType="decimal-pad" autoFocus />
                <Text style={styles.unitText}>{mealType === '물' ? 'ml' : cfg.valueUnit}</Text>
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>메모{cfg.showValue ? ' (선택)' : ''}</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={note} onChangeText={setNote} placeholder={cfg.notePlaceholder} placeholderTextColor={c.textFaint} multiline numberOfLines={3} autoFocus={!cfg.showValue && !cfg.showMealType} />
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
              <TextInput style={styles.input} value={vet} onChangeText={setVet} placeholder="예: 행복동물병원 김수의" placeholderTextColor={c.textFaint} />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>추가 항목</Text>
            {extraFields.map((field, fi) => (
              <View key={fi} style={styles.extraFieldRow}>
                <Text style={styles.extraFieldLabel}>{field.label}</Text>
                <Text style={{ color: c.textMuted }}>: </Text>
                <Text style={styles.extraFieldValue}>{field.value}</Text>
                <TouchableOpacity onPress={() => setExtraFields(extraFields.filter((_, i) => i !== fi))}>
                  <Text style={styles.extraFieldRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.extraFieldInputRow}>
              <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} value={newFieldLabel} onChangeText={setNewFieldLabel} placeholder="항목명" placeholderTextColor={c.textFaint} />
              <TextInput style={[styles.input, { flex: 2, marginRight: 6 }]} value={newFieldValue} onChangeText={setNewFieldValue} placeholder="내용" placeholderTextColor={c.textFaint} />
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

function OptionsModal({ visible, onEdit, onDelete, onClose }: {
  visible: boolean; onEdit: () => void; onDelete: () => void; onClose: () => void
}) {
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
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

export default function DiaryScreen() {
  const { records: allRecords, addRecord, updateRecord, deleteRecord } = useDiary()
  const { activePet, pets, activePetId, setActivePetId } = usePet()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  const { typeFilter: paramTypeFilter } = useLocalSearchParams<{ typeFilter?: string }>()

  const records = allRecords.filter((r) => r.petId === activePet.id)

  const [addType,        setAddType]       = useState<RecordType | null>(null)
  const [addDate,        setAddDate]       = useState('')
  const [showCalPicker,  setShowCalPicker] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<DiaryRecord | null>(null)
  const [showOptions,    setShowOptions]   = useState(false)
  const [editRecord,     setEditRecord]    = useState<DiaryRecord | null>(null)
  const [viewMode,       setViewMode]      = useState<'list' | 'calendar'>('list')
  const [selectedDate,   setSelectedDate]  = useState('')
  const [showAiModal,     setShowAiModal]    = useState(false)
  const [aiPhoto,         setAiPhoto]        = useState('')
  const [aiText,          setAiText]         = useState('')
  const [aiResult,        setAiResult]       = useState('')
  const [aiLoading,       setAiLoading]      = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportPeriod,    setExportPeriod]   = useState<Period>('1개월')
  const [exporting,       setExporting]      = useState(false)
  const [searchQuery,     setSearchQuery]    = useState('')
  const [typeFilter,      setTypeFilter]     = useState<RecordType | 'all'>('all')
  const [dateFilter,      setDateFilter]     = useState<Period | '전체'>('전체')

  useEffect(() => {
    if (!paramTypeFilter) return
    if (paramTypeFilter === 'all') {
      setTypeFilter('all')
    } else if (RECORD_TYPES.some((t) => t.type === paramTypeFilter)) {
      setTypeFilter(paramTypeFilter as RecordType)
    }
    setViewMode('list')
  }, [paramTypeFilter])

  const displayRecords = useMemo(() => {
    let result = viewMode === 'calendar' && selectedDate
      ? records.filter((r) => r.date === selectedDate)
      : records

    if (viewMode === 'list') {
      if (typeFilter !== 'all')
        result = result.filter((r) => r.type === typeFilter)
      if (dateFilter !== '전체') {
        const { from, to } = getDateRange(dateFilter as Period)
        result = result.filter((r) => r.date >= from && r.date <= to)
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        result = result.filter((r) =>
          RECORD_TYPES.find((t) => t.type === r.type)!.label.includes(q) ||
          r.note?.toLowerCase().includes(q) ||
          r.vet_name?.toLowerCase().includes(q) ||
          r.extra_fields?.some((f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q))
        )
      }
    }
    return result
  }, [records, viewMode, selectedDate, typeFilter, dateFilter, searchQuery])

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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.1 })
    if (!result.canceled && result.assets[0]) setAiPhoto(result.assets[0].uri)
  }

  async function runAiAnalysis() {
    if (!aiPhoto && !aiText.trim()) return
    setAiLoading(true)
    setAiResult('')
    try {
      let result: string
      if (aiPhoto && aiText.trim())       result = await analyzeSymptomBoth(aiPhoto, aiText.trim())
      else if (aiPhoto)                   result = await analyzeSymptomPhoto(aiPhoto)
      else                               result = await analyzeSymptomText(aiText.trim())
      setAiResult(result)
    } catch (e: any) {
      setAiResult(`❌ 오류: ${e.message ?? '알 수 없는 오류가 발생했습니다.'}`)
    } finally {
      setAiLoading(false)
    }
  }

  function saveAiResultToDiary() {
    const note = aiText.trim() || 'AI 증상 분석'
    addRecord({
      petId:     activePet.id,
      date:      todayStr(),
      type:      'symptom',
      note:      `${note}\n\n--- AI 분석 ---\n${aiResult}`,
      photo_uri: aiPhoto || undefined,
    })
    setShowAiModal(false)
    Alert.alert('저장 완료', '증상 기록이 일지에 저장되었어요.')
  }

  async function runExport() {
    setExporting(true)
    try {
      await exportReport(activePet, records, exportPeriod)
      setShowExportModal(false)
    } catch (e: any) {
      Alert.alert('내보내기 실패', e.message ?? '오류가 발생했습니다.')
    } finally {
      setExporting(false)
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

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EDE9FE' }]} onPress={() => { setAiPhoto(''); setAiText(''); setAiResult(''); setShowAiModal(true) }}>
            <Text style={styles.actionBtnEmoji}>🤖</Text>
            <Text style={[styles.actionBtnText, { color: '#5B21B6' }]}>AI 증상 분석</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => setShowExportModal(true)}>
            <Text style={styles.actionBtnEmoji}>📤</Text>
            <Text style={[styles.actionBtnText, { color: '#166534' }]}>내보내기</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>기록 추가</Text>
        <View style={styles.typeGrid}>
          {RECORD_TYPES.map((t) => (
            <TouchableOpacity key={t.type} style={[styles.typeCard, { backgroundColor: t.color }]} onPress={() => { setAddDate(todayStr()); setAddType(t.type) }}>
              <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
              <Text style={styles.typeLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.viewToggle}>
          <TouchableOpacity style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]} onPress={() => setViewMode('list')}>
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>📋 목록</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]} onPress={() => { setViewMode('calendar'); if (!selectedDate) setSelectedDate(todayStr()) }}>
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>📅 캘린더</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'calendar' && (
          <CalendarView
            records={records}
            selectedDate={selectedDate}
            onSelectDate={(date) => { setSelectedDate(date); if (date) setShowCalPicker(true) }}
          />
        )}

        {viewMode === 'list' && (
          <>
            {/* 검색바 */}
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="증상, 메모, 병원명 검색..."
                placeholderTextColor={c.textFaint}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
                  <Text style={styles.searchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 타입 필터 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.typeFilterRow}>
                <TouchableOpacity
                  style={[styles.typeFilterChip, typeFilter === 'all' && styles.typeFilterChipActive]}
                  onPress={() => setTypeFilter('all')}
                >
                  <Text style={[styles.typeFilterText, typeFilter === 'all' && styles.typeFilterTextActive]}>전체</Text>
                </TouchableOpacity>
                {RECORD_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.type}
                    style={[styles.typeFilterChip, typeFilter === t.type && styles.typeFilterChipActive]}
                    onPress={() => setTypeFilter(typeFilter === t.type ? 'all' : t.type)}
                  >
                    <Text style={styles.typeFilterEmoji}>{t.emoji}</Text>
                    <Text style={[styles.typeFilterText, typeFilter === t.type && styles.typeFilterTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* 날짜 범위 필터 */}
            <View style={styles.dateFilterRow}>
              {(['전체', '1주', '1개월', '3개월'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dateFilterBtn, dateFilter === d && styles.dateFilterBtnActive]}
                  onPress={() => setDateFilter(d)}
                >
                  <Text style={[styles.dateFilterText, dateFilter === d && styles.dateFilterTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {viewMode === 'calendar' && !selectedDate ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>날짜를 선택하면 해당 날의 기록을 볼 수 있어요.</Text>
          </View>
        ) : (
          <>
            {viewMode === 'calendar' && selectedDate && (
              <View style={styles.calDateBlock}>
                <Text style={styles.calDateTitle}>{selectedDate} 기록</Text>
                <TouchableOpacity style={styles.calAddBtn} onPress={() => setShowCalPicker(true)}>
                  <Text style={styles.calAddText}>+ 이 날 기록 추가</Text>
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
                            {r.value !== undefined && <Text style={styles.recordValue}>{r.value} {r.meal_type === '물' ? 'ml' : cfg.valueUnit}</Text>}
                            {r.note      && <Text style={styles.recordNote}>{r.note}</Text>}
                            {r.vet_name  && <Text style={styles.recordNote}>담당: {r.vet_name}</Text>}
                            {r.extra_fields?.map((f, i) => (
                              <Text key={i} style={styles.recordNote}>{f.label}: {f.value}</Text>
                            ))}
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

      <Modal visible={showAiModal} transparent animationType="slide" onRequestClose={() => setShowAiModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { setShowAiModal(false); setAiText('') }} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#EDE9FE' }]}><Text style={{ fontSize: 22 }}>🤖</Text></View>
              <Text style={styles.modalTitle}>AI 증상 분석</Text>
              <TouchableOpacity onPress={() => { setShowAiModal(false); setAiText('') }}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>사진 첨부 (선택)</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>증상 직접 입력 (선택)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={aiText}
                onChangeText={(v) => { setAiText(v); setAiResult('') }}
                placeholder={'예: 이틀째 밥을 잘 안 먹고 기운이 없어요. 가끔 구토도 해요.'}
                placeholderTextColor={c.textFaint}
                multiline
                numberOfLines={3}
              />
            </View>

            {aiResult ? (
              <View style={[styles.aiResultBox, { maxHeight: 220 }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                  <Text style={styles.aiResultText}>{aiResult}</Text>
                </ScrollView>
              </View>
            ) : null}

            {aiResult ? (
              <TouchableOpacity style={styles.aiSaveBtn} onPress={saveAiResultToDiary}>
                <Text style={styles.aiSaveBtnText}>📝 증상 일지에 저장</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, (!aiPhoto && !aiText.trim() || aiLoading) && styles.saveBtnDisabled]}
              onPress={runAiAnalysis}
              disabled={(!aiPhoto && !aiText.trim()) || aiLoading}
            >
              <Text style={styles.saveBtnText}>
                {aiLoading ? '분석 중...' : aiResult ? '다시 분석' : '분석 시작'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 내보내기 모달 */}
      <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowExportModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#DCFCE7' }]}><Text style={{ fontSize: 22 }}>📤</Text></View>
              <Text style={styles.modalTitle}>기록 내보내기</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>기간 선택</Text>
              <View style={styles.segmentRow}>
                {(['1주', '1개월', '3개월', '전체'] as Period[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.segmentBtn, exportPeriod === p && styles.segmentBtnActive]}
                    onPress={() => setExportPeriod(p)}
                  >
                    <Text style={[styles.segmentText, exportPeriod === p && styles.segmentTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(() => {
              const { from, to } = getDateRange(exportPeriod)
              const count = filterRecords(records, from, to).length
              return (
                <View style={styles.exportPreview}>
                  <Text style={styles.exportPreviewText}>📅 {from} ~ {to}</Text>
                  <Text style={styles.exportPreviewCount}>총 {count}건의 기록</Text>
                </View>
              )
            })()}

            <TouchableOpacity
              style={[styles.saveBtn, exporting && styles.saveBtnDisabled]}
              onPress={runExport}
              disabled={exporting}
            >
              <Text style={styles.saveBtnText}>
                {exporting ? '준비 중...' : Platform.OS === 'web' ? '📄 새 창에서 PDF 저장' : '📤 공유하기'}
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
        initialExtraFields={editRecord?.extra_fields ?? []}
        isEdit onSave={handleEditSave} onClose={() => setEditRecord(null)}
      />
      <OptionsModal visible={showOptions} onEdit={startEdit} onDelete={confirmDelete} onClose={() => setShowOptions(false)} />
    </SafeAreaView>
  )
}

function getCalStyles(c: Colors) {
  return StyleSheet.create({
    container: { backgroundColor: c.card, borderRadius: 16, padding: 12, marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    arrow: { fontSize: 26, color: '#1A73E8', paddingHorizontal: 8 },
    monthTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    dayRow: { flexDirection: 'row', marginBottom: 4 },
    dayName: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.textMuted },
    sun: { color: '#EF4444' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, minHeight: 60, alignItems: 'center', paddingTop: 5, paddingBottom: 4, paddingHorizontal: 1, gap: 2 },
    cellSelected: { backgroundColor: '#1A73E8', borderRadius: 10 },
    dayNum: { fontSize: 13, color: c.textSub },
    dayNumSelected: { color: '#FFFFFF', fontWeight: '700' },
    cellTag: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, width: '95%' },
    cellTagText: { fontSize: 8, color: '#374151', fontWeight: '500' },
    cellTagTextSel: { color: '#FFFFFF' },
    cellMore: { fontSize: 8, color: c.textFaint, fontWeight: '600' },
    cellMoreSel: { color: 'rgba(255,255,255,0.7)' },
  })
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    extraFieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' },
    extraFieldLabel: { fontWeight: '600', color: c.textSub, marginRight: 2 },
    extraFieldValue: { flex: 1, color: c.textMuted },
    extraFieldRemove: { color: '#EF4444', fontSize: 14, paddingHorizontal: 8, paddingVertical: 2 },
    extraFieldInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    extraFieldAddBtn: { backgroundColor: '#3B82F6', borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    extraFieldAddText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 8 },
    switcherScroll: { marginBottom: 4 },
    switcherRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    switcherChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: c.chip, borderWidth: 1.5, borderColor: 'transparent',
    },
    switcherChipActive: { backgroundColor: '#EFF6FF', borderColor: '#1A73E8' },
    switcherEmoji: { fontSize: 16 },
    switcherName: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    switcherNameActive: { color: '#1A73E8' },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.textSub, marginTop: 4, marginBottom: 6 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeCard: { width: '30%', borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 4 },
    typeLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
    viewToggle: { flexDirection: 'row', gap: 8, marginTop: 4 },
    toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: c.chip, alignItems: 'center' },
    toggleBtnActive: { backgroundColor: '#1A73E8' },
    toggleText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    toggleTextActive: { color: '#FFFFFF' },
    dateHeader: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginTop: 10, marginBottom: 4 },
    recordCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 12,
      flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    recordIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    recordBody: { flex: 1, gap: 2 },
    recordTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    recordType: { fontSize: 13, fontWeight: '600', color: c.textSub },
    mealBadge: { backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
    mealBadgeText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
    recordValue: { fontSize: 14, color: c.text },
    recordNote: { fontSize: 12, color: c.textMuted },
    recordThumb: { width: 72, height: 72, borderRadius: 8, marginTop: 6 },
    tapHint: { fontSize: 14, color: c.border, letterSpacing: 1 },
    emptyBox: { backgroundColor: c.chip, borderRadius: 12, padding: 18, alignItems: 'center' },
    emptyText: { color: c.textFaint, fontSize: 13, textAlign: 'center' },
    calDateBlock: { gap: 8, marginTop: 4, marginBottom: 4 },
    calDateTitle: { fontSize: 15, fontWeight: '700', color: c.textSub },
    calAddBtn: {
      backgroundColor: '#1A73E8', borderRadius: 12,
      paddingVertical: 12, alignItems: 'center',
    },
    calAddText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    calPickerSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingTop: 20, gap: 14,
    },
    calPickerTitle: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 4 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { flex: 1 },
    modalSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 14,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    modalIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: c.text },
    modalClose: { fontSize: 18, color: c.textFaint, padding: 4 },
    inputGroup: { gap: 6 },
    inputLabel: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, fontSize: 14, color: c.text, backgroundColor: c.inputBg,
    },
    inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
    unitText: { fontSize: 14, fontWeight: '600', color: c.textMuted, width: 28 },
    segmentRow: { flexDirection: 'row', gap: 8 },
    segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center', backgroundColor: c.inputBg },
    segmentBtnActive: { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
    segmentBtnWater: { borderColor: '#3B82F6', backgroundColor: '#DBEAFE' },
    segmentText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
    segmentTextActive: { color: '#065F46', fontWeight: '700' },
    segmentTextWater: { color: '#1D4ED8', fontWeight: '700' },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    photoPickerBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg },
    photoPickerText: { fontSize: 13, color: c.textSub, fontWeight: '500' },
    photoPreviewWrapper: { position: 'relative' },
    photoPreview: { width: 64, height: 64, borderRadius: 10 },
    photoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
    photoRemoveText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.inputBg, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, height: 42,
    },
    searchIcon: { fontSize: 14 },
    searchInput: { flex: 1, fontSize: 14, color: c.text },
    searchClear: { padding: 4 },
    searchClearText: { fontSize: 13, color: c.textFaint, fontWeight: '700' },
    typeFilterRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    typeFilterChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
      backgroundColor: c.chip, borderWidth: 1.5, borderColor: 'transparent',
    },
    typeFilterChipActive: { backgroundColor: '#EFF6FF', borderColor: '#1A73E8' },
    typeFilterEmoji: { fontSize: 12 },
    typeFilterText: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    typeFilterTextActive: { color: '#1A73E8' },
    dateFilterRow: { flexDirection: 'row', gap: 8 },
    dateFilterBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: c.chip, alignItems: 'center' },
    dateFilterBtnActive: { backgroundColor: '#1A73E8' },
    dateFilterText: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    dateFilterTextActive: { color: '#FFFFFF' },
    actionRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 4 },
    actionBtnEmoji: { fontSize: 22 },
    actionBtnText: { fontSize: 13, fontWeight: '700' },
    exportPreview: {
      backgroundColor: c.chip, borderRadius: 12, padding: 14, gap: 4, alignItems: 'center',
    },
    exportPreviewText: { fontSize: 13, color: c.textMuted },
    exportPreviewCount: { fontSize: 16, fontWeight: '700', color: c.text },
    aiResultBox: {
      backgroundColor: '#F5F3FF', borderRadius: 12, padding: 14,
      borderLeftWidth: 3, borderLeftColor: '#7C3AED',
    },
    aiResultText: { fontSize: 13, color: '#374151', lineHeight: 20 },
    aiSaveBtn: {
      backgroundColor: '#D1FAE5', borderRadius: 12, padding: 13,
      alignItems: 'center', borderWidth: 1, borderColor: '#6EE7B7',
    },
    aiSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#065F46' },
    saveBtn: { backgroundColor: '#1A73E8', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 2 },
    saveBtnDisabled: { backgroundColor: '#9CA3AF' },
    saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
    optionsSheet: { backgroundColor: c.card, borderRadius: 18, width: 220, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
    optionBtn: { padding: 18, alignItems: 'center' },
    optionEdit: { fontSize: 16, color: '#1A73E8', fontWeight: '600' },
    optionDelete: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
    optionDivider: { height: 1, backgroundColor: c.chip },
  })
}
