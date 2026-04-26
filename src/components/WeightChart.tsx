import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native'
import { useTheme, Colors } from '../context/ThemeContext'

interface Entry { date: string; value: number }
interface Props  { data: Entry[] }

const CHART_H = 80
const DOT_R   = 4

export function WeightChart({ data }: Props) {
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  const [chartW, setChartW] = useState(0)

  if (data.length < 2) return null

  const values = data.map((d) => d.value)
  const minV   = Math.min(...values)
  const maxV   = Math.max(...values)
  const range  = maxV - minV || 1

  const points = chartW > 0
    ? data.map((entry, i) => ({
        x: (i / (data.length - 1)) * chartW,
        y: CHART_H - ((entry.value - minV) / range) * CHART_H,
        value: entry.value,
        date:  entry.date.slice(5), // MM-DD
      }))
    : []

  // 선분: 인접 두 점을 잇는 회전된 View
  const segments = points.slice(1).map((pt, i) => {
    const prev   = points[i]
    const dx     = pt.x - prev.x
    const dy     = pt.y - prev.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle  = Math.atan2(dy, dx) * (180 / Math.PI)
    return {
      left:   (prev.x + pt.x) / 2 - length / 2,
      top:    (prev.y + pt.y) / 2 - 1,
      length,
      angle,
    }
  })

  function onLayout(e: LayoutChangeEvent) {
    setChartW(e.nativeEvent.layout.width)
  }

  return (
    <View style={styles.wrapper}>
      {/* Y축 라벨 */}
      <View style={styles.yAxis}>
        <Text style={styles.yLabel}>{maxV.toFixed(1)}</Text>
        <Text style={styles.yLabel}>{minV.toFixed(1)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        {/* 차트 영역 */}
        <View style={styles.chartArea} onLayout={onLayout}>
          {/* 선분 */}
          {segments.map((seg, i) => (
            <View
              key={i}
              style={[styles.line, {
                left:      seg.left,
                top:       seg.top,
                width:     seg.length,
                transform: [{ rotate: `${seg.angle}deg` }],
              }]}
            />
          ))}

          {/* 점 */}
          {points.map((pt, i) => {
            const isLast = i === points.length - 1
            return (
              <View key={i}>
                {/* 값 라벨 (마지막만) */}
                {isLast && (
                  <Text style={[styles.valueLabel, { left: pt.x - 20, top: pt.y - 18 }]}>
                    {pt.value} kg
                  </Text>
                )}
                <View
                  style={[styles.dot,
                    isLast ? styles.dotActive : styles.dotNormal,
                    {
                      left: pt.x - (isLast ? DOT_R + 2 : DOT_R),
                      top:  pt.y - (isLast ? DOT_R + 2 : DOT_R),
                      width:        isLast ? (DOT_R + 2) * 2 : DOT_R * 2,
                      height:       isLast ? (DOT_R + 2) * 2 : DOT_R * 2,
                      borderRadius: isLast ? DOT_R + 2 : DOT_R,
                    },
                  ]}
                />
              </View>
            )
          })}
        </View>

        {/* X축 날짜 라벨 */}
        <View style={styles.xAxis}>
          {points.map((pt, i) => {
            const isLast  = i === points.length - 1
            const isFirst = i === 0
            // 너무 촘촘하면 첫/중간/마지막만 표시
            const show = isFirst || isLast || (data.length <= 5) || (i % Math.ceil(data.length / 4) === 0)
            return (
              <Text
                key={i}
                numberOfLines={1}
                style={[styles.xLabel,
                  isLast && styles.xLabelActive,
                  { position: 'absolute', left: pt.x - 16, width: 32, opacity: show ? 1 : 0 },
                ]}
              >
                {pt.date}
              </Text>
            )
          })}
        </View>
      </View>
    </View>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    wrapper:    { flexDirection: 'row', marginTop: 16 },
    yAxis:      { width: 36, justifyContent: 'space-between', alignItems: 'flex-end', height: CHART_H, paddingRight: 4 },
    yLabel:     { fontSize: 10, color: c.textFaint },
    chartArea:  { height: CHART_H, position: 'relative' },
    line:       { position: 'absolute', height: 2, backgroundColor: '#1A73E8', borderRadius: 1 },
    dot:        { position: 'absolute', borderWidth: 2, borderColor: '#1A73E8' },
    dotNormal:  { backgroundColor: c.card },
    dotActive:  { backgroundColor: '#1A73E8' },
    valueLabel: { position: 'absolute', fontSize: 10, fontWeight: '700', color: '#1A73E8', width: 40, textAlign: 'center' },
    xAxis:      { position: 'relative', height: 18, marginTop: 4 },
    xLabel:     { position: 'absolute', fontSize: 9, color: c.textFaint, textAlign: 'center' },
    xLabelActive: { color: c.text, fontWeight: '700' },
  })
}
