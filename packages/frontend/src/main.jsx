import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

try {
  const theme = localStorage.getItem('agy-theme');
  if (theme && theme !== 'default') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  const mode = localStorage.getItem('agy-mode');
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-mode', 'dark');
  }
} catch (e) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
