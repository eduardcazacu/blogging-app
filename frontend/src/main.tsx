import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import App from './App.tsx'
import './index.css'
import { APP_NAME } from './config'

document.title = APP_NAME;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </React.StrictMode>,
)
