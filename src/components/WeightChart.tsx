import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme, Colors } from '../context/ThemeContext'

interface Entry { date: string; value: number }

interface Props {
  data: Entry[]   // already sorted oldest→newest, max 10
}

export function WeightChart({ data }: Props) {
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])

  if (data.length < 2) return null

  const values = data.map((d) => d.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  const BAR_MAX_H = 80

  return (
    <View style={styles.container}>
      <View style={styles.yLabels}>
        <Text style={styles.yLabel}>{maxV.toFixed(1)}</Text>
        <Text style={styles.yLabel}>{minV.toFixed(1)}</Text>
      </View>
      <View style={styles.barsArea}>
        {data.map((entry, i) => {
          const isLast = i === data.length - 1
          const heightPct = ((entry.value - minV) / range)
          const barH = Math.max(8, Math.round(heightPct * BAR_MAX_H))
          const shortDate = entry.date.slice(5) // MM-DD
          return (
            <View key={entry.date} style={styles.barCol}>
              <Text style={[styles.valueLabel, isLast && styles.valueLabelActive]}>
                {isLast ? `${entry.value}` : ''}
              </Text>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    { height: barH },
                    isLast ? styles.barActive : styles.barNormal,
                  ]}
                />
              </View>
              <Text style={[styles.dateLabel, isLast && styles.dateLabelActive]} numberOfLines={1}>
                {shortDate}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row', alignItems: 'flex-end', marginTop: 12,
    },
    yLabels: {
      width: 34, justifyContent: 'space-between', alignItems: 'flex-end',
      height: 80 + 20, paddingBottom: 20,
    },
    yLabel: { fontSize: 10, color: c.textFaint },
    barsArea: {
      flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4,
    },
    barCol: { flex: 1, alignItems: 'center', gap: 2 },
    barWrapper: { height: 80, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
    bar: { width: '70%', borderRadius: 4 },
    barNormal: { backgroundColor: c.border },
    barActive: { backgroundColor: '#1A73E8' },
    valueLabel: { fontSize: 9, color: 'transparent', fontWeight: '700' },
    valueLabelActive: { color: '#1A73E8' },
    dateLabel: { fontSize: 9, color: c.textFaint, textAlign: 'center' },
    dateLabelActive: { color: c.text, fontWeight: '700' },
  })
}
