import { createContext, useContext, useState, ReactNode } from 'react'
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

const DiaryContext = createContext<DiaryContextValue | null>(null)

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

export function DiaryProvider({ children }: { children: ReactNode }) {
  const [records,  setRecords]  = useState<DiaryRecord[]>(INIT_RECORDS)
  const [vaccines, setVaccines] = useState<VaccineItem[]>(INIT_VACCINES)

  const addRecord    = (r: Omit<DiaryRecord, 'id'>) => setRecords((p) => [{ id: Date.now().toString(), ...r }, ...p])
  const updateRecord = (r: DiaryRecord)              => setRecords((p) => p.map((x) => (x.id === r.id ? r : x)))
  const deleteRecord = (id: string)                  => setRecords((p) => p.filter((x) => x.id !== id))

  const addVaccine    = (v: Omit<VaccineItem, 'id'>) => setVaccines((p) => [...p, { id: Date.now().toString(), ...v }])
  const updateVaccine = (v: VaccineItem)              => setVaccines((p) => p.map((x) => (x.id === v.id ? v : x)))
  const deleteVaccine = (id: string)                  => setVaccines((p) => p.filter((x) => x.id !== id))

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
