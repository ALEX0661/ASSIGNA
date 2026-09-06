import { useState, useEffect } from 'react'
import { useTour } from '../../hooks/useTour.jsx'

export default function CoordSettingsPage() {
  const { TourElement, startTour } = useTour('coordSettings', [
    {
      target: '#tour-stg-theme',
      title: 'Color Theme & Dark Mode',
      content: 'Personalize your experience by selecting a custom accent color and toggling between light and dark modes. Your preference is saved locally.',
      placement: 'bottom',
    }
  ])

  const [activeTheme, setActiveTheme] = useState('default')
  const [isDarkMode, setIsDarkMode] = useState(false)

  const availableThemes = [
    { id: 'default', name: 'Meadow Green', color: '#15803D' },
    { id: 'blue', name: 'Ocean Blue', color: '#60A5FA' },
    { id: 'purple', name: 'Royal Purple', color: '#9333EA' },
    { id: 'rose', name: 'Rose Red', color: '#E11D48' },
    { id: 'amber', name: 'Sunset Amber', color: '#F59E0B' },
    { id: 'slate', name: 'Slate Gray', color: '#475569' },
    { id: 'teal', name: 'Teal', color: '#0D9488' },
    { id: 'indigo', name: 'Indigo', color: '#4F46E5' },
    { id: 'crimson', name: 'Crimson', color: '#EF4444' }
  ]

  useEffect(() => {
    const root = document.documentElement
    const theme = root.getAttribute('data-theme') || 'default'
    setActiveTheme(theme)
    setIsDarkMode(root.getAttribute('data-mode') === 'dark')
  }, [])

  const handleModeChange = (dark) => {
    setIsDarkMode(dark)
    const root = document.documentElement
    if (dark) {
      root.setAttribute('data-mode', 'dark')
      localStorage.setItem('agy-mode', 'dark')
    } else {
      root.removeAttribute('data-mode')
      localStorage.setItem('agy-mode', 'light')
    }
  }

  const handleThemeChange = (id) => {
    setActiveTheme(id)
    const root = document.documentElement
    root.setAttribute('data-theme', id)
    localStorage.setItem('agy-theme', id)
  }

  return (
    <div className="page">
      {TourElement}
      <div style={{ padding: '22px 28px 40px', fontFamily: "'Inter',sans-serif", display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', fontFamily: "'Sora',sans-serif", margin: '0 0 6px' }}>
            Settings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, fontWeight: 500 }}>
            Personalize your workspace experience
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="stg-card" style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div id="tour-stg-theme" className="stg-card-head" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div className="stg-icon-box" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--meadow-soft)', border: '1px solid var(--meadow-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Color Theme</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Personalize the appearance of the application</div>
            </div>
          </div>
          <div className="stg-card-body">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {availableThemes.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                    borderRadius: 10, background: activeTheme === t.id ? 'var(--hover)' : 'var(--surface)',
                    border: activeTheme === t.id ? '1px solid var(--meadow-border)' : '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: activeTheme === t.id ? `0 2px 8px ${t.color}33` : 'none'
                  }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: t.color, border: '2px solid var(--surface)', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }} />
                  <span style={{ fontSize: 13, fontWeight: activeTheme === t.id ? 700 : 500, color: activeTheme === t.id ? 'var(--meadow)' : 'var(--muted)' }}>
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--meadow-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isDarkMode ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--meadow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Dark Mode</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Switch to a darker appearance</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleModeChange(!isDarkMode)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isDarkMode ? 'var(--meadow)' : '#CBD5E1', position: 'relative',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--surface, #fff)',
                  position: 'absolute', top: 2, left: isDarkMode ? 22 : 2,
                  transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }} />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}