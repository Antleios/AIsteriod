import { useCallback, useEffect, useRef, useState } from 'react'
import DoctorHeader from '../components/DoctorHeader.jsx'
import {
  assignDoctorPatient,
  fetchDoctorPatients,
  updateDoctorPatientProfile,
} from '../api/doctor.js'

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-[#1E3A5F] outline-none transition-all placeholder:text-gray-400 focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20'

const statusDefinitions = {
  TRAINING_IN_PROGRESS: {
    label: '训练中',
    className: 'bg-[#EAF4FF] text-[#3B82F6]',
  },
  RECENTLY_ACTIVE: {
    label: '近期活跃',
    className: 'bg-emerald-50 text-emerald-600',
  },
  INACTIVE: {
    label: '超过 7 天未训练',
    className: 'bg-orange-50 text-orange-500',
  },
  NO_TRAINING_RECORD: {
    label: '暂无训练',
    className: 'bg-gray-100 text-gray-500',
  },
}

const genderLabels = {
  MALE: '男',
  FEMALE: '女',
  OTHER: '其他',
  UNDISCLOSED: '未说明',
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#1E3A5F]">{label}</span>
      {children}
    </label>
  )
}

function formatLastTraining(training) {
  if (!training) return '暂无记录'
  const accuracy = training.accuracy == null ? '--' : `${training.accuracy}%`
  return `${training.gameTitle} · ${accuracy}`
}

function DoctorUsers() {
  const [keyword, setKeyword] = useState('')
  const [patients, setPatients] = useState([])
  const [page, setPage] = useState({ total: 0, nextCursor: null })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [form, setForm] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const requestRef = useRef(0)

  const loadFirstPage = useCallback(async (query, quiet = false) => {
    const requestId = ++requestRef.current
    if (!quiet) setLoading(true)
    try {
      const data = await fetchDoctorPatients({ q: query || undefined })
      if (requestId !== requestRef.current) return
      setPatients(data.patients)
      setPage(data.page)
      setError('')
    } catch (requestError) {
      if (requestId === requestRef.current) {
        setError(requestError.message || '患者列表读取失败')
      }
    } finally {
      if (requestId === requestRef.current && !quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => loadFirstPage(keyword.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [keyword, loadFirstPage])

  useEffect(() => {
    const timer = window.setInterval(() => loadFirstPage(keyword.trim(), true), 15_000)
    return () => window.clearInterval(timer)
  }, [keyword, loadFirstPage])

  const openAdd = () => {
    setEditor({ mode: 'add' })
    setForm({ username: '' })
    setFormError('')
  }

  const openProfile = (patient) => {
    setEditor({ mode: 'profile', patient })
    setForm({
      age: patient.profile.age ?? '',
      gender: patient.profile.gender ?? '',
      diagnosis: patient.profile.diagnosis ?? '',
      caseNotes: patient.profile.caseNotes ?? '',
    })
    setFormError('')
  }

  const save = async () => {
    setFormError('')
    setSaving(true)
    try {
      if (editor.mode === 'add') {
        if (!form.username?.trim()) {
          setFormError('请输入已注册患者的用户名')
          return
        }
        await assignDoctorPatient(form.username.trim())
      } else {
        const age = form.age === '' ? null : Number(form.age)
        if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
          setFormError('年龄必须是 0 到 120 之间的整数')
          return
        }
        await updateDoctorPatientProfile(editor.patient.id, {
          age,
          gender: form.gender || null,
          diagnosis: form.diagnosis,
          caseNotes: form.caseNotes,
        })
      }
      setEditor(null)
      await loadFirstPage(keyword.trim())
    } catch (requestError) {
      setFormError(requestError.message || '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const loadMore = async () => {
    if (!page.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchDoctorPatients({
        cursor: page.nextCursor,
        q: keyword.trim() || undefined,
      })
      setPatients((current) => [...current, ...data.patients])
      setPage(data.page)
    } catch (requestError) {
      setError(requestError.message || '更多患者读取失败')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">患者病历管理</h1>
            <p className="mt-1 text-sm text-gray-400">
              共 {page.total} 名已关联患者，档案修改后立即保存
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#5EA2FF] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#3B82F6]/30"
          >
            + 关联患者
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/80 px-4 py-2.5 shadow-sm">
          <span className="text-gray-400">⌕</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索患者姓名或用户名…"
            className="flex-1 bg-transparent text-sm text-[#1E3A5F] outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-100 bg-white/80 shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F7FAFF] text-xs text-gray-400">
                <th className="px-5 py-3 font-medium">患者</th>
                <th className="px-5 py-3 font-medium">年龄</th>
                <th className="px-5 py-3 font-medium">性别</th>
                <th className="px-5 py-3 font-medium">训练状态</th>
                <th className="px-5 py-3 font-medium">诊断说明</th>
                <th className="px-5 py-3 font-medium">最近训练</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => {
                const status =
                  statusDefinitions[patient.trainingStatus.code] ??
                  statusDefinitions.NO_TRAINING_RECORD
                return (
                  <tr key={patient.id} className="border-b border-gray-50 last:border-0 hover:bg-[#F7FAFF]/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#1E3A5F]">{patient.displayName}</p>
                      <p className="text-xs text-gray-400">{patient.username}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{patient.profile.age ?? '--'}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {genderLabels[patient.profile.gender] ?? '--'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-3 text-gray-500" title={patient.profile.diagnosis ?? ''}>
                      {patient.profile.diagnosis || '未填写'}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatLastTraining(patient.lastTraining)}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => openProfile(patient)} className="rounded-full bg-[#EAF4FF] px-3 py-1 text-xs font-medium text-[#3B82F6] hover:bg-[#dbeafe]">
                        编辑档案
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && patients.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">暂无已关联患者</td></tr>
              )}
              {loading && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">正在读取患者列表…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {page.nextCursor && (
          <button type="button" onClick={loadMore} disabled={loadingMore} className="mx-auto mt-5 rounded-full bg-white px-5 py-2 text-sm text-[#3B82F6] shadow-sm disabled:opacity-50">
            {loadingMore ? '读取中…' : '加载更多'}
          </button>
        )}
      </main>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button type="button" aria-label="关闭" className="absolute inset-0 bg-[#1E3A5F]/40 backdrop-blur-sm" onClick={() => setEditor(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-[#1E3A5F]">
              {editor.mode === 'add' ? '关联已注册患者' : `编辑 ${editor.patient.displayName} 的档案`}
            </h2>
            <div className="mt-5 flex flex-col gap-4">
              {editor.mode === 'add' ? (
                <>
                  <p className="text-sm text-gray-500">患者账号必须已经注册且处于正常状态。</p>
                  <Field label="患者用户名">
                    <input value={form.username ?? ''} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="例如 patient.one" className={inputClass} />
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="年龄">
                      <input type="number" min="0" max="120" value={form.age ?? ''} onChange={(event) => setForm({ ...form, age: event.target.value })} placeholder="未填写" className={inputClass} />
                    </Field>
                    <Field label="性别">
                      <select value={form.gender ?? ''} onChange={(event) => setForm({ ...form, gender: event.target.value })} className={inputClass}>
                        <option value="">未填写</option><option value="MALE">男</option><option value="FEMALE">女</option><option value="OTHER">其他</option><option value="UNDISCLOSED">未说明</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="诊断说明">
                    <textarea value={form.diagnosis ?? ''} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} maxLength={500} rows={3} placeholder="填写已确认的诊断或评估说明" className={inputClass} />
                  </Field>
                  <Field label="病例备注">
                    <textarea value={form.caseNotes ?? ''} onChange={(event) => setForm({ ...form, caseNotes: event.target.value })} maxLength={2000} rows={5} placeholder="填写病史、照护注意事项等病例信息" className={inputClass} />
                  </Field>
                </>
              )}

              {formError && <p className="text-sm text-red-500">{formError}</p>}
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={() => setEditor(null)} disabled={saving} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 disabled:opacity-50">取消</button>
                <button type="button" onClick={save} disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#5EA2FF] py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorUsers
