import { useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  FlatList, Modal, Dimensions, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useDiary } from '../src/context/DiaryContext'
import { usePet } from '../src/context/PetContext'
import { useTheme, Colors } from '../src/context/ThemeContext'
import { RECORD_TYPES } from '../src/constants/recordTypes'

const SCREEN_W = Dimensions.get('window').width
const COL = 3
const THUMB = (SCREEN_W - 4) / COL   // gap 2 between cols

export default function AlbumScreen() {
  const router = useRouter()
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  const { activePet } = usePet()
  const { records } = useDiary()

  const photoRecords = useMemo(() =>
    records
      .filter((r) => r.petId === activePet.id && r.photo_uri)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [records, activePet.id]
  )

  const [selected, setSelected] = useState<typeof photoRecords[0] | null>(null)

  if (photoRecords.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📸 성장 앨범</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyTitle}>사진이 없어요</Text>
          <Text style={styles.emptyDesc}>증상 기록에 사진을 첨부하면{'\n'}여기에 모여요</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📸 성장 앨범</Text>
        <Text style={styles.headerCount}>{photoRecords.length}장</Text>
      </View>

      <FlatList
        data={photoRecords}
        keyExtractor={(r) => r.id}
        numColumns={COL}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.thumb}
            onPress={() => setSelected(item)}
            activeOpacity={0.85}
          >
            <Image source={{ uri: item.photo_uri! }} style={styles.thumbImg} />
            <View style={styles.thumbOverlay}>
              <Text style={styles.thumbDate}>{item.date.slice(5)}</Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.grid}
      />

      {/* 전체화면 뷰어 */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setSelected(null)}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>

          {selected && (
            <ScrollView contentContainerStyle={styles.viewerContent} scrollEnabled={false}>
              <Image
                source={{ uri: selected.photo_uri! }}
                style={styles.viewerImg}
                resizeMode="contain"
              />
              <View style={styles.viewerMeta}>
                <Text style={styles.viewerDate}>{selected.date}</Text>
                <View style={[styles.viewerTypeBadge,
                  { backgroundColor: RECORD_TYPES.find(t => t.type === selected.type)?.color ?? '#F3F4F6' }
                ]}>
                  <Text style={styles.viewerTypeText}>
                    {RECORD_TYPES.find(t => t.type === selected.type)?.emoji}{' '}
                    {RECORD_TYPES.find(t => t.type === selected.type)?.label}
                  </Text>
                </View>
                {selected.note ? (
                  <Text style={styles.viewerNote}>{selected.note}</Text>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: { paddingVertical: 4, paddingRight: 12 },
    backBtnText: { fontSize: 15, color: '#1A73E8', fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: c.text },
    headerCount: { fontSize: 13, color: c.textFaint, fontWeight: '600', width: 60, textAlign: 'right' },
    grid: { gap: 2 },
    thumb: { width: THUMB, height: THUMB, position: 'relative' },
    thumbImg: { width: THUMB, height: THUMB },
    thumbOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 3, alignItems: 'center',
    },
    thumbDate: { fontSize: 10, color: '#FFF', fontWeight: '600' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyIcon: { fontSize: 56 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    emptyDesc: { fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 22 },
    viewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
    viewerClose: {
      position: 'absolute', top: 52, right: 20, zIndex: 10,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    },
    viewerCloseText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    viewerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 16 },
    viewerImg: { width: SCREEN_W, height: SCREEN_W },
    viewerMeta: { alignItems: 'center', gap: 8 },
    viewerDate: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    viewerTypeBadge: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5 },
    viewerTypeText: { fontSize: 13, fontWeight: '700', color: '#374151' },
    viewerNote: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, maxWidth: SCREEN_W - 48 },
  })
}
