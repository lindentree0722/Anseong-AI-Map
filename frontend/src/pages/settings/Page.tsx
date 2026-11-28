import { Moon, Sun } from 'lucide-react'
import './settings.css'

type Theme = 'light' | 'dark'

type SettingsPageProps = {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export default function SettingsPage({ theme, onThemeChange }: SettingsPageProps) {
  return <main className="settings-page">
    <header className="settings-header">
      <p className="settings-eyebrow">PREFERENCES</p>
      <h1>설정</h1>
    </header>
    <section className="settings-section" aria-labelledby="theme-heading">
      <h2 id="theme-heading">화면 테마</h2>
      <p>선택한 테마는 다음에 방문해도 유지됩니다.</p>
      <div className="theme-options">
        <button type="button" className={`theme-option${theme === 'light' ? ' selected' : ''}`} aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}>
          <Sun size={22} aria-hidden="true" />
          <span><strong>라이트 모드</strong><small>밝은 화면 · 흰색 배경</small></span>
          <span className="theme-preview theme-preview-light" aria-hidden="true" />
        </button>
        <button type="button" className={`theme-option${theme === 'dark' ? ' selected' : ''}`} aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}>
          <Moon size={22} aria-hidden="true" />
          <span><strong>나이트 모드</strong><small>어두운 화면 · 검은색 배경</small></span>
          <span className="theme-preview theme-preview-dark" aria-hidden="true" />
        </button>
      </div>
    </section>
  </main>
}
