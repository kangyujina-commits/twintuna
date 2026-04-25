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
  pet: PetProfile
  setPet: (updater: PetProfile | ((prev: PetProfile) => PetProfile)) => void
  onboarded: boolean
  completeOnboarding: () => void
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
const STORAGE_ONBOARDED_KEY = '@twintuna:onboarded'

const PetContext = createContext<PetContextValue | null>(null)

export function PetProvider({ children }: { children: ReactNode }) {
  const [pets, setPets]               = useState<PetProfile[]>([DEFAULT_PET])
  const [activePetId, setActivePetId] = useState(DEFAULT_PET.id)
  const [onboarded, setOnboarded]     = useState(false)
  const [loaded, setLoaded]           = useState(false)

  // 불러오기
  useEffect(() => {
    async function load() {
      const [petsJson, activeId, onboardedVal] = await Promise.all([
        AsyncStorage.getItem(STORAGE_PETS_KEY),
        AsyncStorage.getItem(STORAGE_ACTIVE_KEY),
        AsyncStorage.getItem(STORAGE_ONBOARDED_KEY),
      ])
      if (petsJson) setPets(JSON.parse(petsJson))
      if (activeId) setActivePetId(activeId)
      if (onboardedVal === 'true') setOnboarded(true)
      setLoaded(true)
    }
    load()
  }, [])

  // 상태 변경 시 저장
  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_PETS_KEY, JSON.stringify(pets))
  }, [pets, loaded])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_ACTIVE_KEY, activePetId)
  }, [activePetId, loaded])

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
    const next = pets.filter((p) => p.id !== id)
    setPets(next)
    if (activePetId === id && next[0]) setActivePetId(next[0].id)
  }

  function completeOnboarding() {
    setOnboarded(true)
    AsyncStorage.setItem(STORAGE_ONBOARDED_KEY, 'true')
  }

  const pet = activePet
  function setPet(updater: PetProfile | ((prev: PetProfile) => PetProfile)) {
    const updated = typeof updater === 'function' ? updater(activePet) : updater
    updateActivePet(updated)
  }

  if (!loaded) return null

  return (
    <PetContext.Provider value={{
      pets, activePetId, activePet, setActivePetId, addPet, updateActivePet, deletePet,
      pet, setPet, onboarded, completeOnboarding,
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
