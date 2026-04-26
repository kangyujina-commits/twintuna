import { useMemo, useState } from 'react'
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { usePet } from '../../src/context/PetContext'
import { useDiary, MedTime } from '../../src/context/DiaryContext'
import { RecordType } from '../../src/types'
import { PetProfile } from '../../src/context/PetContext'
import { useTheme, Colors } from '../../src/context/ThemeContext'
import { WeightChart } from '../../src/components/WeightChart'
import { RECORD_TYPES } from '../../src/constants/recordTypes'

const TYPE_LABELS: Record<RecordType, string> = {
  weight: '체중', meal: '식사', symptom: '증상',
  vaccine: '접종', hospital: '병원', medicine: '투약',
}
const TYPE_UNITS: Partial<Record<RecordType, string>> = { weight: 'kg', meal: 'g' }

function todayStr() { return new Date().toISOString().split('T')[0] }

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

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
  const { records, vaccines, addVaccine, medSchedules, addMedSchedule, deleteMedSchedule, toggleMedCheck } = useDiary()
  const router      = useRouter()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  const [showAddVax,   setShowAddVax]   = useState(false)
  const [showAnnual,   setShowAnnual]   = useState(false)
  const [annualYear,   setAnnualYear]   = useState(() => new Date().getFullYear())
  const [showChart,    setShowChart]    = useState(false)
  const [showFab,      setShowFab]      = useState(false)
  const [showMedMgmt,  setShowMedMgmt]  = useState(false)
  const [newMedName, setNewMedName] = useState('')
  const [newMedTime, setNewMedTime] = useState<MedTime>('anytime')
  const [newMedHour, setNewMedHour] = useState('')
  const [newMedMin,  setNewMedMin]  = useState('')

  const today     = todayStr()
  const todayRecs = records.filter((r) => r.petId === pet.id && r.date === today)

  // 체중 트렌드
  const weightRecs = records
    .filter((r) => r.petId === pet.id && r.type === 'weight' && r.value !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))
  const latestW = weightRecs[0]
  const prevW   = weightRecs[1]
  const wDiff   = latestW && prevW ? +(latestW.value! - prevW.value!).toFixed(2) : null

  // 오늘 할 일: 기한 초과 + D-3 이내
  const todoItems = vaccines
    .filter((v) => v.petId === pet.id)
    .map((v) => {
      const daysUntil = Math.ceil((new Date(v.next_date).getTime() - new Date(today).getTime()) / 86400000)
      return { ...v, daysUntil }
    })
    .filter((v) => v.daysUntil <= 3)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  // 생일 여부
  const isBirthday = pet.birth_date ? pet.birth_date.slice(5) === today.slice(5) : false
  const petAge     = pet.birth_date ? Math.floor(
    (new Date(today).getTime() - new Date(pet.birth_date).getTime()) / (365.25 * 86400000)
  ) : null

  // 연간 리포트 데이터
  const annualStats = useMemo(() => {
    const ys = String(annualYear)
    const yr = records.filter((r) => r.petId === pet.id && r.date.startsWith(ys))
    const monthlyCounts = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      return yr.filter((r) => r.date.startsWith(`${ys}-${m}`)).length
    })
    const maxMonthly = Math.max(...monthlyCounts, 1)
    const wRecs = yr.filter((r) => r.type === 'weight' && r.value !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date))
    const wChange = wRecs.length >= 2 ? +(wRecs[wRecs.length - 1].value! - wRecs[0].value!).toFixed(2) : null
    const typeCounts = RECORD_TYPES.map((t) => ({ ...t, count: yr.filter((r) => r.type === t.type).length }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
    return {
      total:     yr.length,
      monthlyCounts,
      maxMonthly,
      wChange,
      hospital:  yr.filter((r) => r.type === 'hospital').length,
      symptom:   yr.filter((r) => r.type === 'symptom').length,
      topTypes:  typeCounts.slice(0, 3),
    }
  }, [records, pet.id, annualYear])

  // 오늘 투약 일정
  const todayMeds = medSchedules.filter((s) => s.petId === pet.id)
  const MED_TIME_LABELS: Record<MedTime, string> = { morning: '아침', evening: '저녁', anytime: '수시' }

  // 체중 차트 데이터 (최근 10개, 오래된 순)
  const chartData = weightRecs
    .slice(0, 10)
    .reverse()
    .map((r) => ({ date: r.date, value: r.value! }))

  // 이번 달 건강 리포트
  const thisMonth = today.slice(0, 7) // YYYY-MM
  const monthRecs = records.filter((r) => r.petId === pet.id && r.date.startsWith(thisMonth))
  const monthReport = {
    total:    monthRecs.length,
    hospital: monthRecs.filter((r) => r.type === 'hospital').length,
    symptom:  monthRecs.filter((r) => r.type === 'symptom').length,
    wChange:  (() => {
      const mw = monthRecs.filter((r) => r.type === 'weight' && r.value !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date))
      if (mw.length < 2) return null
      return +(mw[mw.length - 1].value! - mw[0].value!).toFixed(2)
    })(),
  }

  // 다가오는 일정 (D-4 이후)
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

        {/* 생일 배너 */}
        {isBirthday && (
          <View style={styles.birthdayBanner}>
            <Text style={styles.birthdayEmoji}>🎂🎉</Text>
            <View style={styles.birthdayInfo}>
              <Text style={styles.birthdayTitle}>Happy Birthday, {pet.name}!</Text>
              <Text style={styles.birthdaySub}>
                오늘은 {pet.name}의 생일이에요{petAge !== null ? ` · 만 ${petAge}살` : ''}! 🥳
              </Text>
            </View>
          </View>
        )}

        <View style={styles.petCard}>
          <View style={styles.petAvatar}>
            {pet.avatar_uri
              ? <Image source={{ uri: pet.avatar_uri }} style={styles.petAvatarImage} />
              : <Image
                  source={pet.species === '고양이'
                    ? require('../../assets/default-cat.png')
                    : require('../../assets/default-dog.png')}
                  style={styles.petAvatarDefault}
                />
            }
          </View>
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{pet.name}</Text>
            <Text style={styles.petSub}>{pet.breed}  ·  {pet.weight} kg</Text>
            {pet.birth_date ? <Text style={styles.petBirth}>🎂 {pet.birth_date}</Text> : null}
          </View>
        </View>

        {/* 체중 트렌드 */}
        {latestW && (
          <View style={styles.weightCard}>
            <View style={styles.weightCardTop}>
              <Text style={styles.weightIcon}>⚖️</Text>
              <View style={styles.weightInfo}>
                <Text style={styles.weightLabel}>최근 체중</Text>
                <Text style={styles.weightValue}>{latestW.value} kg</Text>
                <Text style={styles.weightDate}>{latestW.date}</Text>
              </View>
              {wDiff !== null && wDiff !== 0 && (
                <View style={[styles.wDiffBadge, wDiff > 0 ? styles.wDiffUp : styles.wDiffDown]}>
                  <Text style={[styles.wDiffText, wDiff > 0 ? styles.wDiffTextUp : styles.wDiffTextDown]}>
                    {wDiff > 0 ? '▲' : '▼'} {Math.abs(wDiff)} kg
                  </Text>
                </View>
              )}
              {wDiff === 0 && (
                <View style={styles.wDiffStable}>
                  <Text style={styles.wDiffTextStable}>— 유지</Text>
                </View>
              )}
              {chartData.length >= 2 && (
                <TouchableOpacity style={styles.chartToggleBtn} onPress={() => setShowChart((v) => !v)}>
                  <Text style={styles.chartToggleText}>{showChart ? '접기' : '📈 차트'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {showChart && chartData.length >= 2 && (
              <WeightChart data={chartData} />
            )}
          </View>
        )}

        {/* 오늘 투약 체크리스트 */}
        {todayMeds.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>💊 오늘 투약</Text>
              <TouchableOpacity style={styles.sectionAddBtn} onPress={() => setShowMedMgmt(true)}>
                <Text style={styles.sectionAddText}>관리</Text>
              </TouchableOpacity>
            </View>
            {todayMeds.map((s) => {
              const done = s.checkedDates.includes(today)
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.medRow, done && styles.medRowDone]}
                  onPress={() => toggleMedCheck(s.id, today)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.medCheck, done && styles.medCheckDone]}>
                    {done && <Text style={styles.medCheckTick}>✓</Text>}
                  </View>
                  <Text style={[styles.medName, done && styles.medNameDone]}>{s.name}</Text>
                  <View style={styles.medTimeBadge}>
                    <Text style={styles.medTimeText}>
                      {MED_TIME_LABELS[s.time]}{s.alarm_time && s.time !== 'anytime' ? ` ${s.alarm_time}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </>
        )}

        {todayMeds.length === 0 && (
          <TouchableOpacity style={styles.medAddHint} onPress={() => setShowMedMgmt(true)}>
            <Text style={styles.medAddHintText}>💊 투약 일정 추가하기</Text>
          </TouchableOpacity>
        )}

        {/* 오늘 할 일 */}
        {todoItems.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>🚨 오늘 할 일</Text>
            </View>
            {todoItems.map((v) => (
              <View key={v.id} style={styles.todoRow}>
                <Text style={styles.todoLabel}>{v.name}</Text>
                <View style={[styles.todoBadge, v.daysUntil < 0 ? styles.todoBadgeOverdue : styles.todoBadgeUrgent]}>
                  <Text style={styles.todoBadgeText}>
                    {v.daysUntil < 0 ? `D+${Math.abs(v.daysUntil)} 초과` : v.daysUntil === 0 ? 'D-Day' : `D-${v.daysUntil}`}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* 이번 달 건강 리포트 */}
        {monthReport.total > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>📊 {thisMonth} 건강 리포트</Text>
              <TouchableOpacity style={styles.sectionAddBtn} onPress={() => setShowAnnual(true)}>
                <Text style={styles.sectionAddText}>연간 리포트</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.reportGrid}>
              {([
                { num: monthReport.total,    label: '총 기록',   filter: 'all'      },
                { num: monthReport.hospital, label: '병원 방문', filter: 'hospital' },
                { num: monthReport.symptom,  label: '증상 기록', filter: 'symptom'  },
                { num: null,                 label: '체중 변화', filter: 'weight'   },
              ] as const).map(({ num, label, filter }) => {
                const isWeight = filter === 'weight'
                const displayNum = isWeight
                  ? (monthReport.wChange === null
                      ? '—'
                      : `${monthReport.wChange > 0 ? '+' : ''}${monthReport.wChange} kg`)
                  : String(num)
                const numStyle = isWeight && monthReport.wChange !== null
                  ? (monthReport.wChange > 0 ? styles.wDiffTextUp : styles.wDiffTextDown)
                  : undefined
                return (
                  <TouchableOpacity
                    key={label}
                    style={styles.reportCell}
                    onPress={() => router.push({ pathname: '/(tabs)/diary', params: { typeFilter: filter } })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.reportNum, numStyle]}>{displayNum}</Text>
                    <Text style={styles.reportLabel}>{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>오늘의 기록</Text>
          <TouchableOpacity style={styles.sectionAddBtn} onPress={() => router.push('/(tabs)/diary')}>
            <Text style={styles.sectionAddText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
        {todayRecs.length === 0 ? (
          <EmptyCard message="오늘 기록이 없어요. + 버튼으로 추가해보세요." styles={styles} />
        ) : (
          todayRecs.map((r) => (
            <RecordRow key={r.id} label={TYPE_LABELS[r.type]} value={formatRecord(r)} styles={styles} />
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>다가오는 일정</Text>
          <TouchableOpacity style={styles.sectionAddBtn} onPress={() => setShowAddVax(true)}>
            <Text style={styles.sectionAddText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
        {upcomingVaccines.length === 0 ? (
          <EmptyCard message="예정된 접종 일정이 없어요." styles={styles} />
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

      {/* FAB 빠른 기록 버튼 */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowFab(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* FAB 기록 유형 선택 모달 */}
      <Modal visible={showFab} transparent animationType="slide" onRequestClose={() => setShowFab(false)}>
        <View style={styles.fabModalWrap}>
          <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={() => setShowFab(false)} />
          <View style={styles.fabSheet}>
            <Text style={styles.fabSheetTitle}>Quick Add / 빠른 기록</Text>
            <View style={styles.fabTypeGrid}>
              {RECORD_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.type}
                  style={[styles.fabTypeCard, { backgroundColor: t.color }]}
                  onPress={() => {
                    setShowFab(false)
                    router.push({ pathname: '/(tabs)/diary', params: { openAddType: t.type } })
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{t.emoji}</Text>
                  <Text style={styles.fabTypeLabel}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 투약 일정 관리 모달 */}
      <Modal visible={showMedMgmt} transparent animationType="slide" onRequestClose={() => setShowMedMgmt(false)}>
        <KeyboardAvoidingView style={styles.medModalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMedMgmt(false)} />
          <View style={styles.medModalSheet}>
            <View style={styles.medModalHeader}>
              <Text style={styles.medModalTitle}>💊 Med/투약 일정 관리</Text>
              <TouchableOpacity onPress={() => setShowMedMgmt(false)}>
                <Text style={styles.medModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 기존 일정 목록 */}
            {todayMeds.map((s) => (
              <View key={s.id} style={styles.medMgmtRow}>
                <Text style={styles.medMgmtName}>{s.name}</Text>
                <View style={styles.medMgmtBadges}>
                  <View style={styles.medTimeBadge}>
                    <Text style={styles.medTimeText}>{MED_TIME_LABELS[s.time]}</Text>
                  </View>
                  {s.alarm_time && s.time !== 'anytime' && (
                    <View style={styles.medAlarmBadge}>
                      <Text style={styles.medAlarmBadgeText}>🕐 {s.alarm_time}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => deleteMedSchedule(s.id)} style={styles.medMgmtDel}>
                  <Text style={styles.medMgmtDelText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* 새 일정 추가 */}
            <View style={styles.medAddRow}>
              {/* 약 이름 */}
              <TextInput
                style={styles.medAddInput}
                value={newMedName}
                onChangeText={setNewMedName}
                placeholder="약 이름 입력"
                placeholderTextColor="#9CA3AF"
              />

              {/* 시간대 선택 */}
              <View style={styles.medTimeRow}>
                {(['morning', 'evening', 'anytime'] as MedTime[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.medTimeBtn, newMedTime === t && styles.medTimeBtnActive]}
                    onPress={() => {
                      setNewMedTime(t)
                      if (t === 'morning') { setNewMedHour('08'); setNewMedMin('00') }
                      if (t === 'evening') { setNewMedHour('21'); setNewMedMin('00') }
                      if (t === 'anytime') { setNewMedHour('');   setNewMedMin('')   }
                    }}
                  >
                    <Text style={[styles.medTimeBtnText, newMedTime === t && styles.medTimeBtnTextActive]}>
                      {MED_TIME_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 시간 입력 — HH · MM 두 칸으로 분리 */}
              {newMedTime !== 'anytime' && (
                <View style={styles.medTimeInputRow}>
                  <Text style={styles.medTimeInputLabel}>⏰</Text>
                  <TextInput
                    style={styles.medTimeHMInput}
                    value={newMedHour}
                    onChangeText={(v) => setNewMedHour(v.replace(/\D/g, '').slice(0, 2))}
                    placeholder="08"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.medTimeSep}>:</Text>
                  <TextInput
                    style={styles.medTimeHMInput}
                    value={newMedMin}
                    onChangeText={(v) => setNewMedMin(v.replace(/\D/g, '').slice(0, 2))}
                    placeholder="00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.medAddBtn}
                onPress={() => {
                  if (!newMedName.trim()) return
                  const alarmTime = newMedTime !== 'anytime' && newMedHour.length === 2 && newMedMin.length === 2
                    ? `${newMedHour}:${newMedMin}` : undefined
                  addMedSchedule({ petId: pet.id, name: newMedName.trim(), time: newMedTime, alarm_time: alarmTime })
                  setNewMedName('')
                  setNewMedHour('')
                  setNewMedMin('')
                  setNewMedTime('anytime')
                }}
              >
                <Text style={styles.medAddBtnText}>+ 추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 연간 리포트 모달 */}
      <Modal visible={showAnnual} transparent animationType="slide" onRequestClose={() => setShowAnnual(false)}>
        <View style={styles.annualWrap}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAnnual(false)} />
          <View style={styles.annualSheet}>
            {/* 헤더 */}
            <View style={styles.annualHeader}>
              <TouchableOpacity onPress={() => setAnnualYear(y => y - 1)}>
                <Text style={styles.annualArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.annualTitle}>📊 {annualYear}년 연간 리포트</Text>
              <TouchableOpacity onPress={() => setAnnualYear(y => y + 1)}>
                <Text style={styles.annualArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {annualStats.total === 0 ? (
                <View style={styles.annualEmpty}>
                  <Text style={styles.annualEmptyText}>{annualYear}년 기록이 없어요.</Text>
                </View>
              ) : (
                <>
                  {/* 요약 그리드 */}
                  <View style={styles.annualGrid}>
                    {[
                      { label: '총 기록',   value: `${annualStats.total}건`,  emoji: '📋' },
                      { label: '병원 방문', value: `${annualStats.hospital}회`, emoji: '🏥' },
                      { label: '증상 기록', value: `${annualStats.symptom}건`,  emoji: '🌡️' },
                      { label: '체중 변화', emoji: '⚖️',
                        value: annualStats.wChange === null ? '—'
                          : `${annualStats.wChange > 0 ? '+' : ''}${annualStats.wChange} kg`,
                        color: annualStats.wChange === null ? undefined
                          : annualStats.wChange > 0 ? '#DC2626' : '#059669',
                      },
                    ].map(({ label, value, emoji, color }) => (
                      <View key={label} style={styles.annualStatCard}>
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                        <Text style={[styles.annualStatValue, color ? { color } : null]}>{value}</Text>
                        <Text style={styles.annualStatLabel}>{label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* 월별 바 차트 */}
                  <Text style={styles.annualSubTitle}>월별 기록 현황</Text>
                  <View style={styles.barChartWrap}>
                    {annualStats.monthlyCounts.map((count, i) => {
                      const barH = annualStats.maxMonthly > 0
                        ? Math.max((count / annualStats.maxMonthly) * 80, count > 0 ? 6 : 0)
                        : 0
                      return (
                        <View key={i} style={styles.barCol}>
                          {count > 0 && <Text style={styles.barCount}>{count}</Text>}
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { height: barH }]} />
                          </View>
                          <Text style={styles.barMonth}>{i + 1}월</Text>
                        </View>
                      )
                    })}
                  </View>

                  {/* 많이 기록한 유형 */}
                  {annualStats.topTypes.length > 0 && (
                    <>
                      <Text style={styles.annualSubTitle}>가장 많이 기록한 항목</Text>
                      <View style={styles.topTypesRow}>
                        {annualStats.topTypes.map((t, i) => (
                          <View key={t.type} style={[styles.topTypeCard, { backgroundColor: t.color }]}>
                            <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
                            <Text style={styles.topTypeLabel}>{t.label}</Text>
                            <Text style={styles.topTypeCount}>{t.count}건</Text>
                            {i === 0 && <View style={styles.topTypeCrown}><Text>👑</Text></View>}
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.annualClose} onPress={() => setShowAnnual(false)}>
              <Text style={styles.annualCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

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
          <TextInput style={styles.modalInput} value={name} onChangeText={setName} placeholder="예: 광견병, 종합백신" placeholderTextColor={c.textFaint} />
          <Text style={styles.modalLabel}>최근 접종일</Text>
          <TextInput style={styles.modalInput} value={lastDate} onChangeText={(v) => setLastDate(formatDateInput(v))} placeholder="YYYY-MM-DD" placeholderTextColor={c.textFaint} keyboardType="number-pad" />
          <Text style={styles.modalLabel}>다음 예정일 *</Text>
          <TextInput style={styles.modalInput} value={nextDate} onChangeText={(v) => setNextDate(formatDateInput(v))} placeholder="YYYY-MM-DD" placeholderTextColor={c.textFaint} keyboardType="number-pad" />
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

function RecordRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.recordRow}>
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  )
}

function EmptyCard({ message, styles }: { message: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 8 },
    petCard: {
      backgroundColor: c.card, borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    petAvatar: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    petAvatarImage: { width: 64, height: 64, resizeMode: 'cover' },
    petAvatarDefault: { width: 44, height: 44, resizeMode: 'contain' },
    petInfo: { flex: 1 },
    petName: { fontSize: 20, fontWeight: '700', color: c.text },
    petSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    petBirth: { fontSize: 12, color: c.textFaint, marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: c.textSub, marginTop: 12, marginBottom: 6 },
    recordRow: {
      backgroundColor: c.card, borderRadius: 12, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    recordLabel: { fontSize: 13, fontWeight: '600', color: c.textSub, width: 48 },
    recordValue: { flex: 1, fontSize: 14, color: c.text },
    scheduleRow: {
      backgroundColor: c.card, borderRadius: 12, padding: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    scheduleLabel: { fontSize: 14, color: c.textSub, flex: 1 },
    ddayBadge: { backgroundColor: '#E0E7FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
    ddayUrgent: { backgroundColor: '#FEE2E2' },
    ddayText: { fontSize: 12, fontWeight: '700', color: '#4338CA' },
    ddayTextUrgent: { color: '#DC2626' },
    emptyCard: { backgroundColor: c.chip, borderRadius: 12, padding: 18, alignItems: 'center' },
    emptyText: { color: c.textFaint, fontSize: 13 },
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
    sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 6 },
    sectionAddBtn: { marginLeft: 'auto', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    sectionAddText: { fontSize: 12, fontWeight: '700', color: '#1A73E8' },
    weightCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 14,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    weightCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    weightIcon: { fontSize: 26 },
    weightInfo: { flex: 1 },
    weightLabel: { fontSize: 11, color: c.textFaint, fontWeight: '600' },
    weightValue: { fontSize: 20, fontWeight: '800', color: c.text, marginTop: 1 },
    weightDate: { fontSize: 11, color: c.textFaint, marginTop: 1 },
    wDiffBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
    wDiffUp: { backgroundColor: '#FEE2E2' },
    wDiffDown: { backgroundColor: '#D1FAE5' },
    wDiffText: { fontSize: 13, fontWeight: '700' },
    wDiffTextUp: { color: '#DC2626' },
    wDiffTextDown: { color: '#059669' },
    wDiffStable: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
    wDiffTextStable: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
    chartToggleBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    chartToggleText: { fontSize: 12, fontWeight: '700', color: '#1A73E8' },
    reportGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    },
    reportCell: {
      flex: 1, minWidth: '45%', backgroundColor: c.card, borderRadius: 14, padding: 16,
      alignItems: 'center', gap: 4,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    reportNum: { fontSize: 22, fontWeight: '800', color: c.text },
    reportLabel: { fontSize: 11, color: c.textFaint, fontWeight: '600' },
    todoRow: {
      backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderLeftWidth: 3, borderLeftColor: '#F97316',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    todoLabel: { fontSize: 14, color: '#92400E', fontWeight: '600', flex: 1 },
    todoBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
    todoBadgeUrgent: { backgroundColor: '#FED7AA' },
    todoBadgeOverdue: { backgroundColor: '#FEE2E2' },
    todoBadgeText: { fontSize: 12, fontWeight: '800', color: '#C2410C' },
    // FAB
    fab: {
      position: 'absolute', bottom: 24, right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: '#1A73E8', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#1A73E8', shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
    },
    fabText: { fontSize: 28, color: '#FFFFFF', lineHeight: 34, fontWeight: '300' },
    fabModalWrap: { flex: 1, justifyContent: 'flex-end' },
    fabOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    fabSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 32, gap: 16,
    },
    fabSheetTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', textAlign: 'center' },
    fabTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    fabTypeCard: { width: '30%', borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 5 },
    fabTypeLabel: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
    // 투약 체크리스트
    medRow: {
      backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: 1, borderColor: '#D1FAE5',
    },
    medRowDone: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.75 },
    medCheck: {
      width: 24, height: 24, borderRadius: 12,
      borderWidth: 2, borderColor: '#10B981',
      alignItems: 'center', justifyContent: 'center',
    },
    medCheckDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
    medCheckTick: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
    medName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#065F46' },
    medNameDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
    medTimeBadge: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    medTimeText: { fontSize: 11, fontWeight: '700', color: '#065F46' },
    medAddHint: {
      borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#A7F3D0',
      borderRadius: 12, padding: 14, alignItems: 'center',
    },
    medAddHintText: { fontSize: 13, color: '#10B981', fontWeight: '600' },
    // 투약 관리 모달
    medModalOverlay: { flex: 1, justifyContent: 'flex-end' },
    medModalSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 12,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    },
    medModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    medModalTitle: { fontSize: 17, fontWeight: '800', color: c.text },
    medModalClose: { fontSize: 18, color: c.textFaint, padding: 4 },
    medMgmtRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12,
    },
    medMgmtName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
    medMgmtBadges: { flexDirection: 'row', gap: 4, alignItems: 'center' },
    medAlarmBadge: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
    medAlarmBadgeText: { fontSize: 11, fontWeight: '600', color: '#1D4ED8' },
    medMgmtDel: { padding: 6 },
    medMgmtDelText: { fontSize: 14, color: '#EF4444', fontWeight: '700' },
    medAddRow: { gap: 10 },
    medAddInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 12, fontSize: 14, color: c.text, backgroundColor: c.inputBg,
    },
    medTimeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    medTimeInputLabel: { fontSize: 16 },
    medTimeHMInput: {
      width: 52, borderWidth: 1.5, borderColor: '#1A73E8', borderRadius: 10,
      paddingVertical: 10, fontSize: 18, color: '#1E40AF', backgroundColor: '#EFF6FF',
      fontWeight: '700', textAlign: 'center',
    },
    medTimeSep: { fontSize: 20, fontWeight: '800', color: '#1A73E8' },
    medTimeRow: { flexDirection: 'row', gap: 8 },
    medTimeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
    medTimeBtnActive: { backgroundColor: '#D1FAE5' },
    medTimeBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    medTimeBtnTextActive: { color: '#065F46', fontWeight: '700' },
    medAddBtn: { backgroundColor: '#10B981', borderRadius: 12, padding: 14, alignItems: 'center' },
    medAddBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    // 생일 배너
    birthdayBanner: {
      borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#FEF3C7',
      borderWidth: 1.5, borderColor: '#FCD34D',
      shadowColor: '#F59E0B', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
    },
    birthdayEmoji: { fontSize: 32 },
    birthdayInfo:  { flex: 1 },
    birthdayTitle: { fontSize: 16, fontWeight: '800', color: '#92400E' },
    birthdaySub:   { fontSize: 13, color: '#B45309', marginTop: 2 },
    // 연간 리포트
    annualWrap:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    annualSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: 24, paddingBottom: 32, gap: 16,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
    },
    annualHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    annualArrow:  { fontSize: 26, color: '#1A73E8', paddingHorizontal: 8 },
    annualTitle:  { fontSize: 16, fontWeight: '800', color: c.text, textAlign: 'center', flex: 1 },
    annualGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    annualStatCard: {
      flex: 1, minWidth: '45%', backgroundColor: c.bg, borderRadius: 14,
      paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 4,
    },
    annualStatValue: { fontSize: 18, fontWeight: '800', color: c.text },
    annualStatLabel: { fontSize: 11, color: c.textFaint, fontWeight: '600' },
    annualSubTitle:  { fontSize: 13, fontWeight: '700', color: c.textSub, marginTop: 4 },
    barChartWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 2 },
    barCol:       { flex: 1, alignItems: 'center', gap: 2 },
    barCount:     { fontSize: 8, color: '#1A73E8', fontWeight: '700' },
    barTrack:     { flex: 1, width: '80%', justifyContent: 'flex-end' },
    barFill:      { backgroundColor: '#1A73E8', borderRadius: 3, width: '100%' },
    barMonth:     { fontSize: 8, color: c.textFaint, fontWeight: '600' },
    topTypesRow:  { flexDirection: 'row', gap: 8 },
    topTypeCard:  { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, position: 'relative' },
    topTypeLabel: { fontSize: 10, fontWeight: '700', color: '#374151', textAlign: 'center' },
    topTypeCount: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
    topTypeCrown: { position: 'absolute', top: -8, right: 4 },
    annualEmpty:  { alignItems: 'center', paddingVertical: 32 },
    annualEmptyText: { fontSize: 14, color: c.textFaint },
    annualClose:  { backgroundColor: c.chip, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
    annualCloseText: { fontSize: 15, fontWeight: '700', color: c.textMuted },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 8 },
    modalTitle: { fontSize: 17, fontWeight: '800', color: c.text, marginBottom: 8, textAlign: 'center' },
    modalLabel: { fontSize: 13, fontWeight: '600', color: c.textSub },
    modalInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 12, fontSize: 14, color: c.text, backgroundColor: c.inputBg,
    },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.chip, alignItems: 'center' },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: c.textMuted },
    modalSave: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1A73E8', alignItems: 'center' },
    modalSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  })
}
