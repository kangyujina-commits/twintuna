import { createContext, useContext, useState, ReactNode } from 'react'

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

const PetContext = createContext<PetContextValue | null>(null)

export function PetProvider({ children }: { children: ReactNode }) {
  const [pets, setPets]               = useState<PetProfile[]>([DEFAULT_PET])
  const [activePetId, setActivePetId] = useState(DEFAULT_PET.id)

  const activePet = pets.find((p) => p.id === activePetId) ?? pets[0]

  function addPet(data: Omit<PetProfile, 'id'>) {
    const id = Date.now().toString()
    setPets((prev) => [...prev, { id, ...data }])
    setActivePetId(id)
  }

  function updateActivePet(pet: PetProfile) {
    setPets((prev) => prev.map((p) => (p.id === pet.id ? pet : p)))
  }

  // backward compat
  const pet = activePet
  function setPet(updater: PetProfile | ((prev: PetProfile) => PetProfile)) {
    const updated = typeof updater === 'function' ? updater(activePet) : updater
    updateActivePet(updated)
  }

  return (
    <PetContext.Provider value={{
      pets, activePetId, activePet, setActivePetId, addPet, updateActivePet,
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
