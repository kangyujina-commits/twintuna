// ── 공통 타입
export type Species = 'cat' | 'dog' | 'all'
export type RecordType = 'weight' | 'meal' | 'symptom' | 'vaccine' | 'hospital' | 'medicine' | 'other'
export type KnowledgeCategory = 'weight' | 'symptom' | 'nutrition' | 'equipment' | 'behavior' | 'safety'
export type Urgency = 'normal' | 'watch' | 'emergency'

// ── 반려동물
export interface Pet {
  id: string
  owner_id: string
  name: string
  species: 'cat' | 'dog'
  breed?: string
  birth_date?: string
  weight?: number
  avatar_url?: string
  microchip_id?: string
  created_at: string
}

// ── 건강 기록
export interface HealthRecord {
  id: string
  pet_id: string
  date: string
  type: RecordType
  value?: number       // 체중(kg), 식사량(g) 등 수치
  note?: string
  photo_urls?: string[]
  vet_name?: string
  created_at: string
}

// ── 예방접종 스케줄
export interface VaccineSchedule {
  id: string
  pet_id: string
  vaccine_name: string
  last_date?: string
  next_due_date: string
  reminder_enabled: boolean
}

// ── 상식 탭 콘텐츠
export interface ColorItem {
  color: string       // hex (#FCD34D 등)
  label: string       // '노란색'
  meaning: string     // '소화액 포함, 공복 구토 가능성'
  urgency: Urgency
}

export type ContentBlock =
  | { type: 'text'; body: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'color_guide'; items: ColorItem[] }
  | { type: 'image'; src: string; caption?: string }

export interface KnowledgeArticle {
  id: string
  species: Species
  category: KnowledgeCategory
  title: string
  summary: string
  content: ContentBlock[]
  tags: string[]
  isEmergency?: boolean
}
