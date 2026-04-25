import { useMemo, useState } from 'react'
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KNOWLEDGE_DATA } from '../../src/constants/knowledge'
import { KnowledgeArticle, Species, ColorItem } from '../../src/types'
import { usePet } from '../../src/context/PetContext'
import { useTheme, Colors } from '../../src/context/ThemeContext'

const FILTERS: { label: string; value: Species }[] = [
  { label: '전체', value: 'all' },
  { label: '🐱 고양이', value: 'cat' },
  { label: '🐶 강아지', value: 'dog' },
]

const URGENCY_COLORS: Record<ColorItem['urgency'], string> = {
  normal: '#D1FAE5', watch: '#FEF3C7', emergency: '#FEE2E2',
}
const URGENCY_LABELS: Record<ColorItem['urgency'], string> = {
  normal: '관찰', watch: '주의', emergency: '긴급',
}

export default function KnowledgeScreen() {
  const [filter,     setFilter]     = useState<Species>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  const filtered = KNOWLEDGE_DATA.filter(
    (a) => filter === 'all' || a.species === filter || a.species === 'all'
  )
  const selected = KNOWLEDGE_DATA.find((a) => a.id === selectedId)

  if (selected) {
    return <ArticleDetail article={selected} onBack={() => setSelectedId(null)} />
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.filter((a) => a.isEmergency).map((a) => (
          <ArticleCard key={a.id} article={a} onPress={() => setSelectedId(a.id)} />
        ))}
        {filtered.filter((a) => !a.isEmergency).map((a) => (
          <ArticleCard key={a.id} article={a} onPress={() => setSelectedId(a.id)} />
        ))}

      </ScrollView>
    </SafeAreaView>
  )
}

function ArticleCard({ article, onPress }: { article: KnowledgeArticle; onPress: () => void }) {
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{article.title}</Text>
        {article.isEmergency && (
          <View style={styles.emergencyBadge}><Text style={styles.emergencyText}>긴급</Text></View>
        )}
      </View>
      <Text style={styles.cardSummary} numberOfLines={2}>{article.summary}</Text>
      <View style={styles.tagRow}>
        {article.tags.map((tag) => (
          <View key={tag} style={styles.tag}><Text style={styles.tagText}>#{tag}</Text></View>
        ))}
      </View>
    </TouchableOpacity>
  )
}

function ArticleDetail({ article, onBack }: { article: KnowledgeArticle; onBack: () => void }) {
  const { pet } = usePet()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  const [selectedBreed, setSelectedBreed] = useState<string | null>(() => {
    if (article.category !== 'weight') return null
    for (const block of article.content) {
      if (block.type === 'table') {
        const match = block.rows.find((r) => r[0].startsWith(pet.breed))
        return match ? match[0] : null
      }
    }
    return null
  })

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>← 목록으로</Text>
      </TouchableOpacity>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{article.title}</Text>
          {article.isEmergency && (
            <View style={styles.emergencyBadge}><Text style={styles.emergencyText}>긴급</Text></View>
          )}
        </View>
        <Text style={styles.detailSummary}>{article.summary}</Text>

        {article.content.map((block, i) => {
          if (block.type === 'text') {
            return <Text key={i} style={styles.bodyText}>{block.body}</Text>
          }

          if (block.type === 'color_guide') {
            return (
              <View key={i} style={styles.colorGuide}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.colorRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: item.color }]} />
                    <View style={styles.colorInfo}>
                      <Text style={styles.colorLabel}>{item.label}</Text>
                      <Text style={styles.colorMeaning}>{item.meaning}</Text>
                    </View>
                    <View style={[styles.urgencyBadge, { backgroundColor: URGENCY_COLORS[item.urgency] }]}>
                      <Text style={styles.urgencyText}>{URGENCY_LABELS[item.urgency]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          }

          if (block.type === 'table') {
            const isWeightTable = article.category === 'weight'
            const breeds        = isWeightTable ? block.rows.map((r) => r[0]) : []
            const selectedRow   = selectedBreed ? block.rows.find((r) => r[0] === selectedBreed) : null

            return (
              <View key={i}>
                {isWeightTable && (
                  <View style={styles.breedPickerSection}>
                    <Text style={styles.breedPickerLabel}>품종 선택</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.breedChipRow}>
                        {breeds.map((breed, j) => {
                          const shortName = breed.split(' (')[0]
                          const isActive  = selectedBreed === breed
                          return (
                            <TouchableOpacity
                              key={j}
                              style={[styles.breedChip, isActive && styles.breedChipActive]}
                              onPress={() => setSelectedBreed(isActive ? null : breed)}
                            >
                              <Text style={[styles.breedChipText, isActive && styles.breedChipTextActive]}>
                                {shortName}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </ScrollView>

                    {selectedRow && (
                      <View style={styles.breedSummary}>
                        <Text style={styles.breedSummaryTitle}>{selectedRow[0].split(' (')[0]}</Text>
                        <View style={styles.breedSummaryRow}>
                          <View style={styles.breedSummaryItem}>
                            <Text style={styles.breedSummaryLabel}>수컷</Text>
                            <Text style={styles.breedSummaryValue}>{selectedRow[1]}</Text>
                          </View>
                          <View style={styles.breedSummaryDivider} />
                          <View style={styles.breedSummaryItem}>
                            <Text style={styles.breedSummaryLabel}>암컷</Text>
                            <Text style={styles.breedSummaryValue}>{selectedRow[2]}</Text>
                          </View>
                        </View>
                        {selectedRow[3] ? <Text style={styles.breedSummaryNote}>{selectedRow[3]}</Text> : null}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    {block.headers.map((h, j) => (
                      <Text key={j} style={styles.tableHeaderCell}>{h}</Text>
                    ))}
                  </View>
                  {block.rows.map((row, j) => {
                    const isHighlighted = isWeightTable && selectedBreed === row[0]
                    return (
                      <TouchableOpacity
                        key={j}
                        activeOpacity={isWeightTable ? 0.7 : 1}
                        onPress={() => isWeightTable && setSelectedBreed(selectedBreed === row[0] ? null : row[0])}
                        style={[
                          styles.tableRow,
                          j % 2 === 0 && styles.tableRowEven,
                          isHighlighted && styles.tableRowHighlighted,
                        ]}
                      >
                        {row.map((cell, k) => (
                          <Text key={k} style={[
                            styles.tableCell,
                            isHighlighted && k === 0 && styles.tableCellBreedSelected,
                          ]}>
                            {cell}
                          </Text>
                        ))}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )
          }

          return null
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12 },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: c.chip },
    filterBtnActive: { backgroundColor: '#1A73E8' },
    filterText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
    filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
    card: {
      backgroundColor: c.card, borderRadius: 14, padding: 16, gap: 8,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: c.text, flex: 1 },
    emergencyBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    emergencyText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
    cardSummary: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    tagText: { fontSize: 11, color: '#3B82F6' },
    backBtn: { padding: 16, paddingBottom: 4 },
    backText: { fontSize: 14, color: '#1A73E8', fontWeight: '600' },
    detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
    detailTitle: { fontSize: 20, fontWeight: '800', color: c.text, flex: 1 },
    detailSummary: { fontSize: 14, color: c.textMuted, lineHeight: 20, marginBottom: 8 },
    bodyText: { fontSize: 14, color: c.textSub, lineHeight: 22 },
    colorGuide: { gap: 10 },
    colorRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderRadius: 12, padding: 12,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    colorSwatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    colorInfo: { flex: 1 },
    colorLabel: { fontSize: 14, fontWeight: '700', color: c.text },
    colorMeaning: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    urgencyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    urgencyText: { fontSize: 11, fontWeight: '700', color: '#374151' },
    breedPickerSection: { marginBottom: 12, gap: 10 },
    breedPickerLabel: { fontSize: 13, fontWeight: '700', color: c.textSub },
    breedChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    breedChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: c.chip, borderWidth: 1, borderColor: c.border,
    },
    breedChipActive: { backgroundColor: '#EFF6FF', borderColor: '#1A73E8' },
    breedChipText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
    breedChipTextActive: { color: '#1A73E8', fontWeight: '700' },
    breedSummary: {
      backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, gap: 10,
      borderWidth: 1, borderColor: '#BFDBFE',
    },
    breedSummaryTitle: { fontSize: 15, fontWeight: '800', color: '#1E40AF', textAlign: 'center' },
    breedSummaryRow: { flexDirection: 'row', alignItems: 'center' },
    breedSummaryItem: { flex: 1, alignItems: 'center', gap: 2 },
    breedSummaryLabel: { fontSize: 11, color: '#6B7280' },
    breedSummaryValue: { fontSize: 16, fontWeight: '700', color: '#1D4ED8' },
    breedSummaryDivider: { width: 1, height: 36, backgroundColor: '#BFDBFE' },
    breedSummaryNote: { fontSize: 12, color: '#4B5563', textAlign: 'center' },
    table: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
    tableRow: { flexDirection: 'row' },
    tableHeaderRow: { backgroundColor: '#1E3A5F' },
    tableRowEven: { backgroundColor: c.inputBg },
    tableRowHighlighted: { backgroundColor: '#EFF6FF', borderLeftWidth: 3, borderLeftColor: '#1A73E8' },
    tableCellBreedSelected: { color: '#1E40AF', fontWeight: '700' },
    tableHeaderCell: {
      flex: 1, fontSize: 12, fontWeight: '700', color: '#FFFFFF',
      padding: 10, borderRightWidth: 1, borderRightColor: '#2D4E7E',
    },
    tableCell: {
      flex: 1, fontSize: 12, color: c.textSub,
      padding: 10, borderRightWidth: 1, borderRightColor: c.border,
    },
  })
}
