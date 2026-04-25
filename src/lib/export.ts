import { Platform, Share } from 'react-native'
import { DiaryRecord } from '../context/DiaryContext'
import { PetProfile } from '../context/PetContext'

const TYPE_LABELS: Record<string, string> = {
  weight: '체중', meal: '식사', symptom: '증상',
  vaccine: '접종', hospital: '병원', medicine: '투약', other: '기타',
}
const TYPE_UNITS: Record<string, string> = { weight: 'kg', meal: 'g' }

export type Period = '1주' | '1개월' | '3개월' | '전체'

export function getDateRange(period: Period): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (period === '1주')   from.setDate(to.getDate() - 7)
  if (period === '1개월') from.setMonth(to.getMonth() - 1)
  if (period === '3개월') from.setMonth(to.getMonth() - 3)
  if (period === '전체')  from.setFullYear(2000)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

export function filterRecords(records: DiaryRecord[], from: string, to: string) {
  return records.filter((r) => r.date >= from && r.date <= to)
}

function formatValue(r: DiaryRecord): string {
  const unit = r.meal_type === '물' ? 'ml' : (TYPE_UNITS[r.type] ?? '')
  if (r.value !== undefined) return `${r.value}${unit ? ' ' + unit : ''}`
  return r.note ?? ''
}

function buildHtml(pet: PetProfile, records: DiaryRecord[], from: string, to: string): string {
  const grouped = records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .reduce<Record<string, DiaryRecord[]>>((acc, r) => {
      if (!acc[r.date]) acc[r.date] = []
      acc[r.date].push(r)
      return acc
    }, {})

  const rows = Object.entries(grouped).map(([date, recs]) => {
    const recRows = recs.map((r) => {
      const label = TYPE_LABELS[r.type] ?? r.type
      const val   = formatValue(r)
      const meal  = r.meal_type ? ` <span class="badge">${r.meal_type}</span>` : ''
      const vet   = r.vet_name ? `<div class="sub">담당: ${r.vet_name}</div>` : ''
      return `
        <tr>
          <td class="type-cell"><span class="type-badge">${label}</span>${meal}</td>
          <td>${val}${vet}</td>
        </tr>`
    }).join('')
    return `
      <tr class="date-row"><td colspan="2">📅 ${date}</td></tr>
      ${recRows}`
  }).join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pet.name} 건강 기록</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; padding: 24px; color: #111827; background: #fff; }
  .header { border-bottom: 3px solid #1A73E8; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; color: #1A73E8; }
  .header p  { font-size: 13px; color: #6B7280; margin-top: 4px; }
  .print-btn {
    display: inline-block; margin-bottom: 16px; padding: 8px 20px;
    background: #1A73E8; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; cursor: pointer;
  }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
  .date-row td { background: #F9FAFB; font-weight: 700; color: #374151; padding: 10px; }
  .type-cell { width: 130px; }
  .type-badge {
    display: inline-block; background: #EFF6FF; color: #1D4ED8;
    border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 600;
  }
  .badge {
    display: inline-block; background: #D1FAE5; color: #065F46;
    border-radius: 6px; padding: 2px 6px; font-size: 11px; margin-left: 4px;
  }
  .sub { font-size: 12px; color: #9CA3AF; margin-top: 2px; }
  .footer { margin-top: 24px; font-size: 12px; color: #9CA3AF; text-align: center; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ 인쇄 / PDF 저장</button>
  <div class="header">
    <h1>🐾 TwinTuna_Paws</h1>
    <p>${pet.name} · ${pet.species} · ${pet.breed}</p>
    <p>기간: ${from} ~ ${to} · 총 ${records.length}건</p>
  </div>
  <table>
    ${rows || '<tr><td colspan="2" style="text-align:center;color:#9CA3AF;padding:24px;">기록이 없습니다.</td></tr>'}
  </table>
  <div class="footer">TwinTuna_Paws · 이 문서는 AI 참고용이며 수의사 진단을 대체하지 않습니다.</div>
</body>
</html>`
}

function buildText(pet: PetProfile, records: DiaryRecord[], from: string, to: string): string {
  const grouped = records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .reduce<Record<string, DiaryRecord[]>>((acc, r) => {
      if (!acc[r.date]) acc[r.date] = []
      acc[r.date].push(r)
      return acc
    }, {})

  const lines = [`🐾 ${pet.name} 건강 기록 (${from} ~ ${to})`, '']
  Object.entries(grouped).forEach(([date, recs]) => {
    lines.push(`📅 ${date}`)
    recs.forEach((r) => {
      const label = TYPE_LABELS[r.type] ?? r.type
      const val   = formatValue(r)
      const meal  = r.meal_type ? ` [${r.meal_type}]` : ''
      lines.push(`  · ${label}${meal}: ${val}`)
    })
    lines.push('')
  })
  lines.push('— TwinTuna_Paws')
  return lines.join('\n')
}

export async function exportReport(pet: PetProfile, records: DiaryRecord[], period: Period) {
  const { from, to } = getDateRange(period)
  const filtered = filterRecords(records, from, to)

  if (Platform.OS === 'web') {
    const html = buildHtml(pet, filtered, from, to)
    const win = window.open('', '_blank')
    if (!win) throw new Error('팝업이 차단됐어요. 팝업 허용 후 다시 시도해주세요.')
    win.document.write(html)
    win.document.close()
  } else {
    const text = buildText(pet, filtered, from, to)
    await Share.share({ message: text, title: `${pet.name} 건강 기록` })
  }
}
