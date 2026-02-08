import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// StrictMode double-invokes lifecycle flows in development and can interfere
// with gesture-gated media playback logic.
if (import.meta.env.DEV) {
  root.render(<App />)
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
