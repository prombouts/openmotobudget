import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeClarity } from './analytics/clarity'
import './index.css'
import App from './App.tsx'

initializeClarity()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
