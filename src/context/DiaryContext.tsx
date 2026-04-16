import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { RecordType } from '../types'

export type MealType = '건식' | '습식' | '혼합'

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
}

export interface VaccineItem {
  id: string
  petId: string
  name: string
  last_date: string
  next_date: string
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
}

const STORAGE_RECORDS_KEY  = '@twintuna:records'
const STORAGE_VACCINES_KEY = '@twintuna:vaccines'

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
  const [records,  setRecordsState]  = useState<DiaryRecord[]>(INIT_RECORDS)
  const [vaccines, setVaccinesState] = useState<VaccineItem[]>(INIT_VACCINES)
  const [loaded, setLoaded]          = useState(false)

  // 앱 시작 시 저장된 데이터 불러오기
  useEffect(() => {
    async function load() {
      const [recJson, vacJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_RECORDS_KEY),
        AsyncStorage.getItem(STORAGE_VACCINES_KEY),
      ])
      if (recJson) setRecordsState(JSON.parse(recJson))
      if (vacJson) setVaccinesState(JSON.parse(vacJson))
      setLoaded(true)
    }
    load()
  }, [])

  function setRecords(updater: DiaryRecord[] | ((prev: DiaryRecord[]) => DiaryRecord[])) {
    setRecordsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      AsyncStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(next))
      return next
    })
  }

  function setVaccines(updater: VaccineItem[] | ((prev: VaccineItem[]) => VaccineItem[])) {
    setVaccinesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      AsyncStorage.setItem(STORAGE_VACCINES_KEY, JSON.stringify(next))
      return next
    })
  }

  const addRecord    = (r: Omit<DiaryRecord, 'id'>) => setRecords((p) => [{ id: Date.now().toString(), ...r }, ...p])
  const updateRecord = (r: DiaryRecord)              => setRecords((p) => p.map((x) => (x.id === r.id ? r : x)))
  const deleteRecord = (id: string)                  => setRecords((p) => p.filter((x) => x.id !== id))

  const addVaccine    = (v: Omit<VaccineItem, 'id'>) => setVaccines((p) => [...p, { id: Date.now().toString(), ...v }])
  const updateVaccine = (v: VaccineItem)              => setVaccines((p) => p.map((x) => (x.id === v.id ? v : x)))
  const deleteVaccine = (id: string)                  => setVaccines((p) => p.filter((x) => x.id !== id))

  if (!loaded) return null

  return (
    <DiaryContext.Provider value={{
      records, addRecord, updateRecord, deleteRecord,
      vaccines, addVaccine, updateVaccine, deleteVaccine,
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
