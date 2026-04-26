import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { RecordType } from '../types'

export type MealType = '건식' | '습식' | '혼합' | '물'

export interface DiaryRecord {
  id: string
  petId: string
  date: string
  type: RecordType
  value?: number
  note?: string
  vet_name?: string
  meal_type?: MealType
  photo_uri?: string
  extra_fields?: { label: string; value: string }[]
}

export interface VaccineItem {
  id: string
  petId: string
  name: string
  last_date: string
  next_date: string
}

export interface HospitalItem {
  id: string
  name: string
  phone?: string
  vet_name?: string
  address?: string
  memo?: string
}

export interface AlbumPhoto {
  id: string
  petId: string
  date: string
  photo_uri: string
  caption?: string
}

export type MedTime = 'morning' | 'evening' | 'anytime'

export interface MedSchedule {
  id: string
  petId: string
  name: string
  time: MedTime
  alarm_time?: string      // HH:MM 형식, morning/evening일 때만 사용
  checkedDates: string[]   // YYYY-MM-DD 형식으로 완료한 날짜
}

interface DiaryContextValue {
  records: DiaryRecord[]
  addRecord:    (r: Omit<DiaryRecord, 'id'>) => void
  updateRecord: (r: DiaryRecord) => void
  deleteRecord: (id: string) => void
  vaccines: VaccineItem[]
  addVaccine:    (v: Omit<VaccineItem, 'id'>) => void
  updateVaccine: (v: VaccineItem) => void
  deleteVaccine: (id: string) => void
  hospitals: HospitalItem[]
  addHospital:    (h: Omit<HospitalItem, 'id'>) => void
  updateHospital: (h: HospitalItem) => void
  deleteHospital: (id: string) => void
  albumPhotos: AlbumPhoto[]
  addAlbumPhoto:    (p: Omit<AlbumPhoto, 'id'>) => void
  deleteAlbumPhoto: (id: string) => void
  medSchedules: MedSchedule[]
  addMedSchedule:    (s: Omit<MedSchedule, 'id' | 'checkedDates'>) => void
  deleteMedSchedule: (id: string) => void
  toggleMedCheck:    (scheduleId: string, date: string) => void
}

const STORAGE_RECORDS_KEY   = '@twintuna:records'
const STORAGE_VACCINES_KEY  = '@twintuna:vaccines'
const STORAGE_HOSPITALS_KEY = '@twintuna:hospitals'
const STORAGE_ALBUM_KEY     = '@twintuna:album'
const STORAGE_MED_KEY       = '@twintuna:medSchedules'

const INIT_RECORDS: DiaryRecord[] = [
  { id: '1', petId: '1', date: '2026-04-13', type: 'weight', value: 4.2 },
  { id: '2', petId: '1', date: '2026-04-13', type: 'meal', value: 50, note: '로얄캐닌 어덜트', meal_type: '건식' },
  { id: '3', petId: '1', date: '2026-04-12', type: 'symptom', note: '구토 1회 (노란색)' },
]

const INIT_VACCINES: VaccineItem[] = [
  { id: 'v1', petId: '1', name: '종합백신 (FVRCP)', last_date: '2025-10-13', next_date: '2026-10-13' },
  { id: 'v2', petId: '1', name: '광견병',            last_date: '2025-10-13', next_date: '2026-10-13' },
  { id: 'v3', petId: '1', name: '심장사상충 예방',   last_date: '2026-03-01', next_date: '2026-04-27' },
]

const DiaryContext = createContext<DiaryContextValue | null>(null)

export function DiaryProvider({ children }: { children: ReactNode }) {
  const [records,      setRecordsState]   = useState<DiaryRecord[]>(INIT_RECORDS)
  const [vaccines,     setVaccinesState]  = useState<VaccineItem[]>(INIT_VACCINES)
  const [hospitals,    setHospitalsState] = useState<HospitalItem[]>([])
  const [albumPhotos,  setAlbumState]     = useState<AlbumPhoto[]>([])
  const [medSchedules, setMedSchedules]   = useState<MedSchedule[]>([])
  const [loaded, setLoaded]               = useState(false)

  useEffect(() => {
    async function load() {
      const [recJson, vacJson, hospJson, albumJson, medJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_RECORDS_KEY),
        AsyncStorage.getItem(STORAGE_VACCINES_KEY),
        AsyncStorage.getItem(STORAGE_HOSPITALS_KEY),
        AsyncStorage.getItem(STORAGE_ALBUM_KEY),
        AsyncStorage.getItem(STORAGE_MED_KEY),
      ])
      if (recJson)   setRecordsState(JSON.parse(recJson))
      if (vacJson)   setVaccinesState(JSON.parse(vacJson))
      if (hospJson)  setHospitalsState(JSON.parse(hospJson))
      if (albumJson) setAlbumState(JSON.parse(albumJson))
      if (medJson)   setMedSchedules(JSON.parse(medJson))
      setLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records))
  }, [records, loaded])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_VACCINES_KEY, JSON.stringify(vaccines))
  }, [vaccines, loaded])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_HOSPITALS_KEY, JSON.stringify(hospitals))
  }, [hospitals, loaded])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_ALBUM_KEY, JSON.stringify(albumPhotos))
  }, [albumPhotos, loaded])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_MED_KEY, JSON.stringify(medSchedules))
  }, [medSchedules, loaded])

  const addRecord    = (r: Omit<DiaryRecord, 'id'>) => setRecordsState((p) => [{ id: Date.now().toString(), ...r }, ...p])
  const updateRecord = (r: DiaryRecord)              => setRecordsState((p) => p.map((x) => (x.id === r.id ? r : x)))
  const deleteRecord = (id: string)                  => setRecordsState((p) => p.filter((x) => x.id !== id))

  const addVaccine    = (v: Omit<VaccineItem, 'id'>) => setVaccinesState((p) => [...p, { id: Date.now().toString(), ...v }])
  const updateVaccine = (v: VaccineItem)              => setVaccinesState((p) => p.map((x) => (x.id === v.id ? v : x)))
  const deleteVaccine = (id: string)                  => setVaccinesState((p) => p.filter((x) => x.id !== id))

  const addHospital    = (h: Omit<HospitalItem, 'id'>) => setHospitalsState((p) => [...p, { id: Date.now().toString(), ...h }])
  const updateHospital = (h: HospitalItem)              => setHospitalsState((p) => p.map((x) => (x.id === h.id ? h : x)))
  const deleteHospital = (id: string)                   => setHospitalsState((p) => p.filter((x) => x.id !== id))

  const addAlbumPhoto    = (p: Omit<AlbumPhoto, 'id'>) => setAlbumState((prev) => [{ id: Date.now().toString(), ...p }, ...prev])
  const deleteAlbumPhoto = (id: string)                 => setAlbumState((prev) => prev.filter((x) => x.id !== id))

  const addMedSchedule = (s: Omit<MedSchedule, 'id' | 'checkedDates'>) =>
    setMedSchedules((prev) => [...prev, { id: Date.now().toString(), checkedDates: [], ...s }])
  const deleteMedSchedule = (id: string) =>
    setMedSchedules((prev) => prev.filter((x) => x.id !== id))
  const toggleMedCheck = (scheduleId: string, date: string) =>
    setMedSchedules((prev) => prev.map((s) => {
      if (s.id !== scheduleId) return s
      const has = s.checkedDates.includes(date)
      return { ...s, checkedDates: has ? s.checkedDates.filter((d) => d !== date) : [...s.checkedDates, date] }
    }))

  if (!loaded) return null

  return (
    <DiaryContext.Provider value={{
      records, addRecord, updateRecord, deleteRecord,
      vaccines, addVaccine, updateVaccine, deleteVaccine,
      hospitals, addHospital, updateHospital, deleteHospital,
      albumPhotos, addAlbumPhoto, deleteAlbumPhoto,
      medSchedules, addMedSchedule, deleteMedSchedule, toggleMedCheck,
    }}>
      {children}
    </DiaryContext.Provider>
  )
}

export function useDiary() {
  const ctx = useContext(DiaryContext)
  if (!ctx) throw new Error('useDiary must be used inside DiaryProvider')
  return ctx
}
