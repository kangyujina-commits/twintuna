import { RecordType } from '../types'

export const RECORD_TYPES: { type: RecordType; emoji: string; label: string; color: string }[] = [
  { type: 'weight',   emoji: '⚖️',  label: 'Weight/체중',   color: '#DBEAFE' },
  { type: 'meal',     emoji: '🍽️',  label: 'Meal/식사',     color: '#D1FAE5' },
  { type: 'symptom',  emoji: '🌡️',  label: 'Symptom/증상',  color: '#FEE2E2' },
  { type: 'vaccine',  emoji: '💉',  label: 'Vaccine/접종',  color: '#E0E7FF' },
  { type: 'hospital', emoji: '🏥',  label: 'Hospital/병원', color: '#FEF3C7' },
  { type: 'medicine', emoji: '💊',  label: 'Medicine/투약', color: '#FCE7F3' },
  { type: 'other',    emoji: '📝',  label: 'Other/기타',    color: '#F3F4F6' },
]
