import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getFaculty, addFaculty, updateFaculty } from '../../services/api'

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const RANKS = [
  'Instructor I','Instructor II','Instructor III',
  'Assistant Professor I','Assistant Professor II',
  'Associate Professor I','Associate Professor II','Professor I',
]

const empty = {
  name: '', email: '', status: 'full-time', AcademicRank: '',
  Department: 'CCS', max_units: 21, units: 0,
  specializations: [], preferredDays: [],
  preferredTimeStart: 7, preferredTimeEnd: 21, maxConsecutiveHours: 4,
}

export default function FacultyDetailPage() {
  const { id }   = useParams()
  const isNew    = id === 'new'
  const navigate = useNavigate()

  const [form,         setForm]         = useState(empty)
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const [createdPassword, setCreatedPassword] = useState('')
  const [passwordCopied,  setPasswordCopied]  = useState(false)

  useEffect(() => {
    if (isNew) return
    getFaculty().then(list => {
      const found = list.find(f => f.id === id)
      if (found) {
        setForm({ ...found, specializations: found.specializations || [] })
      }
    })
  }, [id])

  function addSpecialization() {
    setForm(f => ({
      ...f,
      specializations: [...f.specializations, { courseCode: '', rating: 3 }]
    }))
  }

  function updateSpecialization(index, field, value) {
    setForm(f => {
      const updatedSpecs = [...f.specializations]
      updatedSpecs[index] = { ...updatedSpecs[index], [field]: value }
      return { ...f, specializations: updatedSpecs }
    })
  }

  function removeSpecialization(index) {
    setForm(f => ({
      ...f,
      specializations: f.specializations.filter((_, i) => i !== index)
    }))
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      preferredDays: f.preferredDays.includes(day)
        ? f.preferredDays.filter(d => d !== day)
        : [...f.preferredDays, day],
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const cleanedSpecs = form.specializations.filter(s => s.courseCode.trim() !== '')
      const data  = { ...form, specializations: cleanedSpecs }

      if (isNew) {
        if (!data.email) { setError('Email is required to create a faculty account.'); setSaving(false); return }
        const result = await addFaculty({ ...data, initial_password: password || undefined })
        setCreatedPassword(result.temp_password || password || '')
      } else {
        await updateFaculty(id, data)
        navigate('/dashboard/faculty')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  function handleCopyPassword() {
    navigator.clipboard.writeText(createdPassword)
    setPasswordCopied(true)
    setTimeout(() => setPasswordCopied(false), 2000)
  }

  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 }
  const labelStyle = { fontSize: 12, fontWeight: 600 }

  if (createdPassword) {
    return (
      <div className="page" style={{ maxWidth: 540 }}>
        <p className="page-title">Faculty added</p>

        <div className="card" style={{ borderLeft: '4px solid #1a6b2c' }}>
          <p style={{ fontWeight: 700, color: '#1a6b2c', marginBottom: 8 }}>
            ✓ Account created successfully
          </p>
          <p style={{ fontSize: 13, color: '#444', marginBottom: 16 }}>
            Share the temporary password below with <strong>{form.name || form.email}</strong>.
            They can change it after their first login.
          </p>

          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Temporary password
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
            <code style={{
              flex: 1, padding: '10px 14px', background: '#f4f4f4',
              border: '1px solid #ddd', borderRadius: 6,
              fontSize: 15, fontFamily: 'monospace', letterSpacing: 1,
            }}>
              {createdPassword}
            </code>
            <button onClick={handleCopyPassword} style={{ whiteSpace: 'nowrap' }}>
              {passwordCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
            The faculty member must log out and back in if they are already signed in
            to pick up the new role claim.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="primary" onClick={() => navigate('/dashboard/faculty')}>
              Back to faculty list
            </button>
            <button onClick={() => {
              setCreatedPassword('')
              setForm(empty)
              setPassword('')
            }}>
              Add another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <p className="page-title">{isNew ? 'Add faculty' : 'Edit faculty'}</p>

      {isNew && (
        <div className="card" style={{ marginBottom: 16, background: '#f0f7ff', border: '1px solid #b3d4f5' }}>
          <p style={{ fontSize: 13, color: '#1a4a7c' }}>
            <strong>Note:</strong> Adding a faculty member here automatically creates their
            Firebase login account and assigns the <code>faculty</code> role.
            You no longer need to run <code>set_role.py</code> manually.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          <div style={fieldStyle}>
            <label style={labelStyle}>Full name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({...f, name: e.target.value}))}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Email {isNew && '*'}</label>
            <input
              type="email"
              value={form.email || ''}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
              required={isNew}
              placeholder={isNew ? 'Used as login credential' : ''}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Academic rank</label>
            <select
              value={form.AcademicRank || ''}
              onChange={e => setForm(f => ({...f, AcademicRank: e.target.value}))}
            >
              <option value="">— select —</option>
              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({...f, status: e.target.value}))}
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Max units</label>
            <input
              type="number" value={form.max_units} min={0} max={30}
              onChange={e => setForm(f => ({...f, max_units: Number(e.target.value)}))}
            />
          </div>
        </div>

        {isNew && (
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Temporary password
              <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>
                (leave blank to auto-generate)
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Auto-generated if left blank"
                style={{ flex: 1 }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              Minimum 6 characters. You'll see the final password after saving.
            </p>
          </div>
        )}

        <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee', marginTop: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#000', marginBottom: 8, display: 'block' }}>Specializations & Course Proficiency</label>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Add courses this faculty can teach and rate their proficiency from 1 (Beginner) to 5 (Expert).</p>
          
          {form.specializations.map((spec, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <input
                style={{ flex: 1, padding: '6px 10px' }}
                placeholder="Course Code (e.g. IT101)"
                value={spec.courseCode}
                onChange={e => updateSpecialization(i, 'courseCode', e.target.value.toUpperCase())}
              />
              <select 
                style={{ width: '180px', padding: '6px 10px' }}
                value={spec.rating} 
                onChange={e => updateSpecialization(i, 'rating', Number(e.target.value))}
              >
                <option value={5}>5 - Expert</option>
                <option value={4}>4 - Highly Proficient</option>
                <option value={3}>3 - Competent</option>
                <option value={2}>2 - Novice</option>
                <option value={1}>1 - Beginner</option>
              </select>
              <button type="button" onClick={() => removeSpecialization(i)} style={{ padding: '6px 12px', background: '#ffe6e6', color: '#c00', border: '1px solid #ffcccc', borderRadius: 4, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ))}
          
          <button 
            type="button" 
            onClick={addSpecialization} 
            style={{ marginTop: 8, padding: '6px 12px', background: '#fff', border: '1px dashed #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
          >
            + Add Course Specialization
          </button>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Preferred teaching days</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {DAYS.map(day => (
              <button
                type="button" key={day}
                onClick={() => toggleDay(day)}
                style={{
                  padding: '5px 12px', fontSize: 12, borderRadius: 20,
                  background: form.preferredDays.includes(day) ? '#000' : '#fff',
                  color:      form.preferredDays.includes(day) ? '#fff' : '#000',
                  border: '1px solid #000',
                }}
              >
                {day.slice(0,3)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Preferred start (hour)</label>
            <input
              type="number" min={6} max={20} step={0.5}
              value={form.preferredTimeStart}
              onChange={e => setForm(f => ({...f, preferredTimeStart: Number(e.target.value)}))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Preferred end (hour)</label>
            <input
              type="number" min={7} max={21} step={0.5}
              value={form.preferredTimeEnd}
              onChange={e => setForm(f => ({...f, preferredTimeEnd: Number(e.target.value)}))}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Max consecutive hours</label>
            <input
              type="number" min={1} max={8} step={0.5}
              value={form.maxConsecutiveHours}
              onChange={e => setForm(f => ({...f, maxConsecutiveHours: Number(e.target.value)}))}
            />
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard/faculty')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}