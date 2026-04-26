import { useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  FlatList, Modal, Dimensions, TextInput, Alert, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useDiary, AlbumPhoto } from '../../src/context/DiaryContext'
import { usePet, PetProfile } from '../../src/context/PetContext'
import { useTheme, Colors } from '../../src/context/ThemeContext'
import { RECORD_TYPES } from '../../src/constants/recordTypes'
import { RecordType } from '../../src/types'

const SCREEN_W = Dimensions.get('window').width
const COL = 3
const THUMB = (SCREEN_W - 4) / COL

type GridItem =
  | { kind: 'album';  id: string; petId: string; date: string; photo_uri: string; caption?: string }
  | { kind: 'record'; id: string; petId: string; date: string; photo_uri: string; note?: string; type: RecordType }

function todayStr() { return new Date().toISOString().split('T')[0] }

export default function AlbumScreen() {
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  const { pets, activePetId, setActivePetId, activePet } = usePet()
  const { records, albumPhotos, addAlbumPhoto, deleteAlbumPhoto } = useDiary()

  const [selected,    setSelected]    = useState<GridItem | null>(null)
  const [addCaption,  setAddCaption]  = useState('')
  const [pendingUri,  setPendingUri]  = useState('')
  const [showCaption, setShowCaption] = useState(false)

  const allItems = useMemo<GridItem[]>(() => {
    const fromAlbum: GridItem[] = albumPhotos
      .filter((p) => p.petId === activePetId)
      .map((p) => ({ kind: 'album', ...p }))

    const fromRecords: GridItem[] = records
      .filter((r) => r.petId === activePetId && r.photo_uri)
      .map((r) => ({ kind: 'record', id: r.id, petId: r.petId, date: r.date, photo_uri: r.photo_uri!, note: r.note, type: r.type }))

    return [...fromAlbum, ...fromRecords].sort((a, b) => b.date.localeCompare(a.date))
  }, [albumPhotos, records, activePetId])

  async function pickPhoto() {
    if (Platform.OS === 'web') {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, quality: 0.6, base64: true,
      })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri
      setPendingUri(uri)
      setAddCaption('')
      setShowCaption(true)
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') { Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.'); return }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, quality: 0.6,
      })
      if (result.canceled || !result.assets[0]) return
      setPendingUri(result.assets[0].uri)
      setAddCaption('')
      setShowCaption(true)
    }
  }

  function confirmAdd() {
    if (!pendingUri) return
    addAlbumPhoto({ petId: activePetId, date: todayStr(), photo_uri: pendingUri, caption: addCaption.trim() || undefined })
    setPendingUri('')
    setAddCaption('')
    setShowCaption(false)
  }

  function handleDelete() {
    if (!selected || selected.kind !== 'album') return
    if (Platform.OS === 'web') {
      if (!window.confirm('이 사진을 삭제할까요?')) return
      deleteAlbumPhoto(selected.id)
      setSelected(null)
    } else {
      Alert.alert('삭제', '이 사진을 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => { deleteAlbumPhoto(selected.id); setSelected(null) } },
      ])
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* 펫 스위처 */}
      {pets.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}>
          <View style={styles.switcherRow}>
            {pets.map((p: PetProfile) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.switcherChip, p.id === activePetId && styles.switcherChipActive]}
                onPress={() => setActivePetId(p.id)}
              >
                <Text style={styles.switcherEmoji}>{p.species === '고양이' ? '🐱' : '🐶'}</Text>
                <Text style={[styles.switcherName, p.id === activePetId && styles.switcherNameActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.toolbar}>
        <Text style={styles.countLabel}>{allItems.length}장 · {activePet.name}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={pickPhoto}>
          <Text style={styles.addBtnText}>+ 사진 추가</Text>
        </TouchableOpacity>
      </View>

      {allItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyTitle}>사진이 없어요</Text>
          <Text style={styles.emptyDesc}>+ 사진 추가 버튼으로 올리거나{'\n'}증상 기록에 사진을 첨부하면 여기에 모여요</Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          numColumns={COL}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.thumb} onPress={() => setSelected(item)} activeOpacity={0.85}>
              <Image source={{ uri: item.photo_uri }} style={styles.thumbImg} />
              <View style={styles.thumbOverlay}>
                <Text style={styles.thumbDate}>{item.date.slice(5)}</Text>
              </View>
              {item.kind === 'album' && (
                <View style={styles.albumBadge}><Text style={styles.albumBadgeText}>📸</Text></View>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.grid}
        />
      )}

      {/* 뷰어 */}
      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setSelected(null)}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>

          {selected && (
            <View style={styles.viewerContent}>
              <Image source={{ uri: selected.photo_uri }} style={styles.viewerImg} resizeMode="contain" />
              <View style={styles.viewerMeta}>
                <Text style={styles.viewerDate}>{selected.date}</Text>
                {selected.kind === 'album' ? (
                  <>
                    <View style={styles.viewerTypeBadge}>
                      <Text style={styles.viewerTypeText}>📸 앨범</Text>
                    </View>
                    {selected.caption ? <Text style={styles.viewerNote}>{selected.caption}</Text> : null}
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                      <Text style={styles.deleteBtnText}>🗑️ 삭제</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={[styles.viewerTypeBadge,
                      { backgroundColor: RECORD_TYPES.find(t => t.type === selected.type)?.color ?? '#F3F4F6' }
                    ]}>
                      <Text style={[styles.viewerTypeText, { color: '#374151' }]}>
                        {RECORD_TYPES.find(t => t.type === selected.type)?.emoji}{' '}
                        {RECORD_TYPES.find(t => t.type === selected.type)?.label}
                      </Text>
                    </View>
                    {selected.note ? <Text style={styles.viewerNote}>{selected.note}</Text> : null}
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* 캡션 입력 모달 */}
      <Modal visible={showCaption} transparent animationType="slide" onRequestClose={() => setShowCaption(false)}>
        <TouchableOpacity style={styles.captionOverlay} activeOpacity={1} onPress={() => setShowCaption(false)} />
        <View style={styles.captionSheet}>
          {pendingUri ? <Image source={{ uri: pendingUri }} style={styles.captionPreview} resizeMode="cover" /> : null}
          <Text style={styles.captionLabel}>한 마디 남기기 (선택)</Text>
          <TextInput
            style={styles.captionInput}
            value={addCaption}
            onChangeText={setAddCaption}
            placeholder="예: 첫 미용 날 🐱"
            placeholderTextColor={c.textFaint}
            autoFocus
          />
          <View style={styles.captionBtns}>
            <TouchableOpacity style={styles.captionCancel} onPress={() => setShowCaption(false)}>
              <Text style={styles.captionCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captionSave} onPress={confirmAdd}>
              <Text style={styles.captionSaveText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function getStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    switcherScroll: { paddingHorizontal: 12, paddingTop: 8 },
    switcherRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    switcherChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: c.chip, borderWidth: 1.5, borderColor: 'transparent',
      minWidth: 110, justifyContent: 'center',
    },
    switcherChipActive: { backgroundColor: '#EFF6FF', borderColor: '#1A73E8' },
    switcherEmoji: { fontSize: 15 },
    switcherName: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    switcherNameActive: { color: '#1A73E8' },
    toolbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 8,
    },
    countLabel: { fontSize: 12, color: c.textFaint, fontWeight: '600' },
    addBtn: { backgroundColor: '#1A73E8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
    addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
    grid: { gap: 2 },
    thumb: { width: THUMB, height: THUMB, position: 'relative' },
    thumbImg: { width: THUMB, height: THUMB },
    thumbOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 3, alignItems: 'center',
    },
    thumbDate: { fontSize: 10, color: '#FFF', fontWeight: '600' },
    albumBadge: { position: 'absolute', top: 4, right: 4 },
    albumBadgeText: { fontSize: 12 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
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
    viewerContent: { alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 60 },
    viewerImg: { width: SCREEN_W, height: SCREEN_W },
    viewerMeta: { alignItems: 'center', gap: 10 },
    viewerDate: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    viewerTypeBadge: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.15)' },
    viewerTypeText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
    viewerNote: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, maxWidth: SCREEN_W - 48 },
    deleteBtn: { backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
    deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    captionOverlay: { flex: 1 },
    captionSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 12,
    },
    captionPreview: { width: '100%', height: 160, borderRadius: 14 },
    captionLabel: { fontSize: 13, fontWeight: '600', color: c.textSub },
    captionInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, fontSize: 15, color: c.text, backgroundColor: c.inputBg,
    },
    captionBtns: { flexDirection: 'row', gap: 10 },
    captionCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.chip, alignItems: 'center' },
    captionCancelText: { fontSize: 15, fontWeight: '600', color: c.textMuted },
    captionSave: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1A73E8', alignItems: 'center' },
    captionSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  })
}
