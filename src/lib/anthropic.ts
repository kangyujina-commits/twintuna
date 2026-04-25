const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? ''
const API_URL = 'https://api.anthropic.com/v1/messages'

const BASE_PROMPT = `다음 항목을 간결하게 한국어로 답해주세요:

1. 관찰된 증상 또는 이상
2. 가능한 원인 (1~3가지)
3. 즉시 병원 방문 필요 여부 (예/아니오 + 간단한 이유)
4. 집에서 할 수 있는 조치

⚠️ 이 결과는 AI 참고용이며 수의사 진단을 대체하지 않습니다.`

const PHOTO_PROMPT = `이 사진은 반려동물의 증상 또는 신체 사진입니다.\n${BASE_PROMPT}`

function buildTextPrompt(text: string) {
  return `다음은 반려동물의 증상 설명입니다:\n"${text}"\n\n${BASE_PROMPT}`
}

function buildBothPrompt(text: string) {
  return `다음은 반려동물의 증상 사진과 보호자의 설명입니다.\n보호자 설명: "${text}"\n\n사진과 설명을 함께 분석하여 ${BASE_PROMPT}`
}

async function imageUriToBase64(uri: string): Promise<{ base64: string; mediaType: string }> {
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator')
  const result = await manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true })
  return { base64: result.base64!, mediaType: 'image/jpeg' }
}

async function callApi(messages: object[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('API 키가 설정되지 않았습니다.')
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.error?.message ?? `API 오류 (${res.status})`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? '분석 결과를 가져올 수 없습니다.'
}

export async function analyzeSymptomPhoto(imageUri: string): Promise<string> {
  const { base64, mediaType } = await imageUriToBase64(imageUri)
  return callApi([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: PHOTO_PROMPT },
    ],
  }])
}

export async function analyzeSymptomText(text: string): Promise<string> {
  return callApi([{
    role: 'user',
    content: [{ type: 'text', text: buildTextPrompt(text) }],
  }])
}

export async function analyzeSymptomBoth(imageUri: string, text: string): Promise<string> {
  const { base64, mediaType } = await imageUriToBase64(imageUri)
  return callApi([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: buildBothPrompt(text) },
    ],
  }])
}
