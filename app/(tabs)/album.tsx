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
const COL = 4
const THUMB = (SCREEN_W - 6) / COL

type GridItem =
  | { kind: 'album';  id: string; petId: string; date: string; photo_uri: string; caption?: string }
  | { kind: 'record'; id: string; petId: string; date: string; photo_uri: string; note?: string; type: RecordType }

function todayStr() { return new Date().toISOString().split('T')[0] }

/* ── Web image compress (max 800px, quality 0.5) ─────────── */
async function compressForWeb(base64Uri: string): Promise<string> {
  const MAX = 800
  return new Promise((resolve) => {
    const img = new (window as any).Image() as HTMLImageElement
    img.onload = () => {
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else                { width  = Math.round((width  * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.5))
    }
    img.onerror = () => resolve(base64Uri) // fallback: use original
    img.src = base64Uri
  })
}

/* ── Web download helpers ─────────────────────────────────── */
async function downloadOnWeb(items: GridItem[]) {
  for (const item of items) {
    try {
      const caption = item.kind === 'album' ? (item.caption ?? '') : (item.note ?? '')
      const footerText = `${item.date}${caption ? '  |  ' + caption : ''}`

      // Load image as HTMLImageElement
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new (window as any).Image() as HTMLImageElement
        el.crossOrigin = 'anonymous'
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = item.photo_uri
      })

      const FOOTER_H = 36
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth  || img.width
      canvas.height = (img.naturalHeight || img.height) + FOOTER_H
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      // Footer bar
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(0, canvas.height - FOOTER_H, canvas.width, FOOTER_H)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold ${Math.max(12, Math.round(canvas.width * 0.028))}px sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(footerText, 12, canvas.height - FOOTER_H / 2)

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(); return }
          const url = URL.createObjectURL(blob)
          const a   = document.createElement('a')
          a.href     = url
          a.download = `twintuna_${item.date}_${item.id}.jpg`
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 3000)
          resolve()
        }, 'image/jpeg', 0.92)
      })

      // Small gap between sequential downloads
      if (items.length > 1) await new Promise((r) => setTimeout(r, 200))
    } catch {
      // Skip failed image silently
    }
  }
}

export default function AlbumScreen() {
  const { colors: c } = useTheme()
  const styles = useMemo(() => getStyles(c), [c])
  const { pets, activePetId, setActivePetId, activePet } = usePet()
  const { records, albumPhotos, addAlbumPhoto, deleteAlbumPhoto } = useDiary()

  const [selected,    setSelected]    = useState<GridItem | null>(null)
  const [addCaption,  setAddCaption]  = useState('')
  const [pendingUri,  setPendingUri]  = useState('')
  const [showCaption, setShowCaption] = useState(false)

  // Multi-select state
  const [selectMode,   setSelectMode]   = useState(false)
  const [selectedIds,  setSelectedIds]  = useState<string[]>([])

  const allItems = useMemo<GridItem[]>(() => {
    const fromAlbum: GridItem[] = albumPhotos
      .filter((p) => p.petId === activePetId)
      .map((p) => ({ kind: 'album', ...p }))

    const fromRecords: GridItem[] = records
      .filter((r) => r.petId === activePetId && r.photo_uri)
      .map((r) => ({ kind: 'record', id: r.id, petId: r.petId, date: r.date, photo_uri: r.photo_uri!, note: r.note, type: r.type }))

    return [...fromAlbum, ...fromRecords].sort((a, b) => b.date.localeCompare(a.date))
  }, [albumPhotos, records, activePetId])

  /* ── Select-mode helpers ──────────────────────────────────── */
  function enterSelectMode(id: string) {
    setSelectMode(true)
    setSelectedIds([id])
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function cancelSelect() {
    setSelectMode(false)
    setSelectedIds([])
  }

  function handleDownload() {
    const toDownload = allItems.filter((i) => selectedIds.includes(i.id))
    if (toDownload.length === 0) return

    if (Platform.OS === 'web') {
      downloadOnWeb(toDownload)
      cancelSelect()
    } else {
      Alert.alert(
        '다운로드',
        `${toDownload.length}장을 저장하려면 각 사진을 길게 눌러 "이미지 저장"을 선택하세요.\n\n(모바일 일괄 다운로드는 준비 중이에요 🐾)`,
        [{ text: '확인' }]
      )
      cancelSelect()
    }
  }

  /* ── Photo pick ───────────────────────────────────────────── */
  async function pickPhoto() {
    if (Platform.OS === 'web') {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, quality: 0.6, base64: true,
      })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]
      const raw = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri
      const uri = await compressForWeb(raw)
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
                style={styles.switcherChip}
                onPress={() => setActivePetId(p.id)}
              >
                <View style={[styles.switcherEmojiCircle, p.id === activePetId && styles.switcherEmojiCircleActive]}>
                  <Text style={styles.switcherEmoji}>{p.species === '고양이' ? '🐱' : '🐶'}</Text>
                </View>
                <Text style={[styles.switcherName, p.id === activePetId && styles.switcherNameActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* 툴바 */}
      {selectMode ? (
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={cancelSelect} style={styles.selectCancelBtn}>
            <Text style={styles.selectCancelText}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.countLabel}>{selectedIds.length}장 선택됨</Text>
          <TouchableOpacity
            style={[styles.downloadBtn, selectedIds.length === 0 && styles.downloadBtnDisabled]}
            onPress={handleDownload}
            disabled={selectedIds.length === 0}
          >
            <Text style={styles.downloadBtnText}>⬇ 다운로드 ({selectedIds.length})</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.toolbar}>
          <Text style={styles.countLabel}>{allItems.length}장 · {activePet.name}</Text>
          <View style={styles.toolbarBtns}>
            {allItems.length > 0 && (
              <TouchableOpacity style={styles.selectBtn} onPress={() => setSelectMode(true)}>
                <Text style={styles.selectBtnText}>선택</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.addBtn} onPress={pickPhoto}>
              <Text style={styles.addBtnText}>+ 사진 추가</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id)
            return (
              <TouchableOpacity
                style={styles.thumb}
                activeOpacity={0.85}
                onPress={() => {
                  if (selectMode) {
                    toggleSelect(item.id)
                  } else {
                    setSelected(item)
                  }
                }}
                onLongPress={() => {
                  if (!selectMode) enterSelectMode(item.id)
                }}
                delayLongPress={350}
              >
                <Image source={{ uri: item.photo_uri }} style={styles.thumbImg} />
                <View style={styles.thumbOverlay}>
                  <Text style={styles.thumbDate}>{item.date.slice(5)}</Text>
                  {(() => {
                    const text = item.kind === 'album' ? item.caption : item.note
                    return text ? (
                      <Text style={styles.thumbCaption} numberOfLines={1}>{text}</Text>
                    ) : null
                  })()}
                </View>
                {/* Selection overlay */}
                {selectMode && (
                  <View style={[styles.selectOverlay, isSelected && styles.selectOverlayActive]}>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Text style={styles.checkMark}>✓</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )
          }}
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
                    <View style={styles.viewerActions}>
                      <TouchableOpacity
                        style={styles.viewerDownloadBtn}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            downloadOnWeb([selected])
                          } else {
                            Alert.alert('다운로드', '모바일에서는 사진을 길게 눌러 저장하세요.')
                          }
                        }}
                      >
                        <Text style={styles.viewerDownloadText}>⬇ 저장</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                        <Text style={styles.deleteBtnText}>🗑️ 삭제</Text>
                      </TouchableOpacity>
                    </View>
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
                    <TouchableOpacity
                      style={styles.viewerDownloadBtn}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          downloadOnWeb([selected])
                        } else {
                          Alert.alert('다운로드', '모바일에서는 사진을 길게 눌러 저장하세요.')
                        }
                      }}
                    >
                      <Text style={styles.viewerDownloadText}>⬇ 저장</Text>
                    </TouchableOpacity>
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
          {pendingUri ? (
            <View style={styles.captionPreviewRow}>
              <Image source={{ uri: pendingUri }} style={styles.captionPreview} resizeMode="cover" />
              <Text style={styles.captionPreviewHint}>사진이 추가됩니다 📷</Text>
            </View>
          ) : null}
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
    switcherRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
    switcherChip: { width: 72, alignItems: 'center', gap: 5 },
    switcherEmojiCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.chip,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    switcherEmojiCircleActive: { backgroundColor: '#EFF6FF', borderColor: '#1A73E8' },
    switcherEmoji: { fontSize: 22 },
    switcherName: { fontSize: 11, fontWeight: '700', color: c.textMuted, textAlign: 'center' },
    switcherNameActive: { color: '#1A73E8' },
    toolbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 8,
    },
    countLabel: { fontSize: 12, color: c.textFaint, fontWeight: '600' },
    addBtn: { backgroundColor: '#1A73E8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
    addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
    toolbarBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    selectBtn: {
      borderWidth: 1.5, borderColor: '#1A73E8', borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    selectBtnText: { fontSize: 13, fontWeight: '700', color: '#1A73E8' },
    selectCancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: c.chip },
    selectCancelText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    downloadBtn: {
      backgroundColor: '#1A73E8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    },
    downloadBtnDisabled: { backgroundColor: '#93C5FD' },
    downloadBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
    grid: { gap: 2 },
    thumb: { width: THUMB, height: THUMB, position: 'relative' },
    thumbImg: { width: THUMB, height: THUMB },
    thumbOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 3, alignItems: 'center',
    },
    thumbDate: { fontSize: 10, color: '#FFF', fontWeight: '600' },
    thumbCaption: { fontSize: 9, color: 'rgba(255,255,255,0.85)', paddingHorizontal: 4, textAlign: 'center' },
    // Selection overlays
    selectOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(26,115,232,0.18)',
      borderWidth: 2, borderColor: 'transparent',
    },
    selectOverlayActive: {
      backgroundColor: 'rgba(26,115,232,0.35)',
      borderColor: '#1A73E8',
    },
    checkCircle: {
      position: 'absolute', top: 5, right: 5,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: '#1A73E8', alignItems: 'center', justifyContent: 'center',
    },
    checkMark: { color: '#FFF', fontSize: 13, fontWeight: '800', lineHeight: 16 },
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
    viewerImg: { width: Math.min(SCREEN_W * 0.65, 280), height: Math.min(SCREEN_W * 0.65, 280), borderRadius: 12 },
    viewerMeta: { alignItems: 'center', gap: 10 },
    viewerDate: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    viewerTypeBadge: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.15)' },
    viewerTypeText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
    viewerNote: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, maxWidth: SCREEN_W - 48 },
    viewerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    viewerDownloadBtn: { backgroundColor: 'rgba(26,115,232,0.85)', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
    viewerDownloadText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    deleteBtn: { backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
    deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    captionOverlay: { flex: 1 },
    captionSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, gap: 12,
    },
    captionPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    captionPreview: { width: 72, height: 72, borderRadius: 10 },
    captionPreviewHint: { fontSize: 13, color: c.textMuted, flex: 1 },
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
