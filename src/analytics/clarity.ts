const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim()
const clarityRuntimeUrl = 'https://scripts.clarity.ms/0.8.72-beta/clarity.js'

type ClarityQueue = {
  (...arguments_: unknown[]): void
  q?: unknown[][]
}

function createClarityQueue(): ClarityQueue {
  const clarity = ((...arguments_: unknown[]) => {
    clarity.q?.push(arguments_)
  }) as ClarityQueue
  clarity.q = []
  return clarity
}

export function initializeClarity(): void {
  if (!projectId) return

  const clarityWindow = window as Window & { clarity?: ClarityQueue }
  const clarity = clarityWindow.clarity ?? createClarityQueue()
  clarityWindow.clarity = clarity

  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = clarityRuntimeUrl
  script.addEventListener('error', () => {
    console.error('Microsoft Clarity failed to load.')
  })
  document.head.append(script)

  clarity(
    'start',
    {
      projectId,
      upload: 'https://u.clarity.ms/collect',
      expire: 365,
      cookies: ['_uetmsclkid', '_uetvid', '_clck'],
      track: false,
      content: true,
      dob: 2475,
    },
  )
}
