import Clarity from '@microsoft/clarity'

const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim()

export function initializeClarity(): void {
  if (!projectId) return
  Clarity.init(projectId)
}
