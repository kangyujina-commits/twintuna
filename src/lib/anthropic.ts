const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? ''
const API_URL = 'https://api.anthropic.com/v1/messages'

const PROMPT = `이 사진은 반려동물의 증상 또는 신체 사진입니다. 다음 항목을 간결하게 한국어로 답해주세요:

1. 관찰된 증상 또는 이상
2. 가능한 원인 (1~3가지)
3. 즉시 병원 방문 필요 여부 (예/아니오 + 간단한 이유)
4. 집에서 할 수 있는 조치

⚠️ 이 결과는 AI 참고용이며 수의사 진단을 대체하지 않습니다.`

async function imageUriToBase64(uri: string): Promise<{ base64: string; mediaType: string }> {
  // Step 1: blob → dataURL via FileReader
  const response = await fetch(uri)
  const blob = await response.blob()
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

  // Step 2: resize via canvas (max 1024px)
  return new Promise((resolve, reject) => {
    const img = new (globalThis as any).Image()
    img.onload = () => {
      const MAX = 1024
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = (globalThis as any).document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const [, base64] = canvas.toDataURL('image/jpeg', 0.8).split(',')
      resolve({ base64, mediaType: 'image/jpeg' })
    }
    img.onerror = () => reject(new Error('이미지 로드 실패'))
    img.src = dataUrl
  })
}

export async function analyzeSymptomPhoto(imageUri: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('API 키가 설정되지 않았습니다.')

  const { base64, mediaType } = await imageUriToBase64(imageUri)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.error?.message ?? `API 오류 (${res.status})`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? '분석 결과를 가져올 수 없습니다.'
}
