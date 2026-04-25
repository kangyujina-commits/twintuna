import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface PetProfile {
  id: string
  name: string
  species: '고양이' | '강아지'
  breed: string
  birth_date: string
  weight: string
  avatar_uri?: string
}

interface PetContextValue {
  pets: PetProfile[]
  activePetId: string
  activePet: PetProfile
  setActivePetId: (id: string) => void
  addPet: (pet: Omit<PetProfile, 'id'>) => void
  updateActivePet: (pet: PetProfile) => void
  deletePet: (id: string) => void
  // backward compat
  pet: PetProfile
  setPet: (updater: PetProfile | ((prev: PetProfile) => PetProfile)) => void
}

const DEFAULT_PET: PetProfile = {
  id: '1',
  name: '나비',
  species: '고양이',
  breed: '코리안 숏헤어',
  birth_date: '2022-03-15',
  weight: '4.2',
}

const STORAGE_PETS_KEY      = '@twintuna:pets'
const STORAGE_ACTIVE_KEY    = '@twintuna:activePetId'

const PetContext = createContext<PetContextValue | null>(null)

export function PetProvider({ children }: { children: ReactNode }) {
  const [pets, setPetsState]               = useState<PetProfile[]>([DEFAULT_PET])
  const [activePetId, setActivePetIdState] = useState(DEFAULT_PET.id)
  const [loaded, setLoaded]                = useState(false)

  // 앱 시작 시 저장된 데이터 불러오기
  useEffect(() => {
    async function load() {
      const [petsJson, activeId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_PETS_KEY),
        AsyncStorage.getItem(STORAGE_ACTIVE_KEY),
      ])
      if (petsJson) setPetsState(JSON.parse(petsJson))
      if (activeId)  setActivePetIdState(activeId)
      setLoaded(true)
    }
    load()
  }, [])

  // pets 변경 시 저장
  function setPets(updater: PetProfile[] | ((prev: PetProfile[]) => PetProfile[])) {
    setPetsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      AsyncStorage.setItem(STORAGE_PETS_KEY, JSON.stringify(next))
      return next
    })
  }

  function setActivePetId(id: string) {
    setActivePetIdState(id)
    AsyncStorage.setItem(STORAGE_ACTIVE_KEY, id)
  }

  const activePet = pets.find((p) => p.id === activePetId) ?? pets[0]

  function addPet(data: Omit<PetProfile, 'id'>) {
    const id = Date.now().toString()
    setPets((prev) => [...prev, { id, ...data }])
    setActivePetId(id)
  }

  function updateActivePet(pet: PetProfile) {
    setPets((prev) => prev.map((p) => (p.id === pet.id ? pet : p)))
  }

  function deletePet(id: string) {
    setPets((prev) => {
      const next = prev.filter((p) => p.id !== id)
      if (activePetId === id) {
        const fallback = next[0]
        if (fallback) setActivePetId(fallback.id)
      }
      return next
    })
  }

  // backward compat
  const pet = activePet
  function setPet(updater: PetProfile | ((prev: PetProfile) => PetProfile)) {
    const updated = typeof updater === 'function' ? updater(activePet) : updater
    updateActivePet(updated)
  }

  if (!loaded) return null

  return (
    <PetContext.Provider value={{
      pets, activePetId, activePet, setActivePetId, addPet, updateActivePet, deletePet,
      pet, setPet,
    }}>
      {children}
    </PetContext.Provider>
  )
}

export function usePet() {
  const ctx = useContext(PetContext)
  if (!ctx) throw new Error('usePet must be used inside PetProvider')
  return ctx
}
