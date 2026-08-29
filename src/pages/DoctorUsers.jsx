import { useState } from 'react'
import DoctorHeader from '../components/DoctorHeader.jsx'

// 患者与用户管理 —— 当前为前端 mock 数据 + 本地增删改，后端接入后替换为真实接口
const initialPatients = [
  { id: 1, name: '张小明', age: 6, gender: '男', status: '训练中', doctor: '李医生', lastTraining: '物品命名 · 85%' },
  { id: 2, name: '王小雅', age: 8, gender: '女', status: '待评估', doctor: '李医生', lastTraining: '颜色连线 · 92%' },
  { id: 3, name: '李浩浩', age: 7, gender: '男', status: '休息中', doctor: '陈医生', lastTraining: '表情匹配 · 78%' },
  { id: 4, name: '陈一诺', age: 5, gender: '女', status: '训练中', doctor: '李医生', lastTraining: '物品命名 · 71%' },
  { id: 5, name: '刘子涵', age: 9, gender: '女', status: '训练中', doctor: '陈医生', lastTraining: '表情匹配 · 88%' },
  { id: 6, name: '赵天佑', age: 6, gender: '男', status: '待评估', doctor: '李医生', lastTraining: '颜色连线 · 64%' },
]

const initialUsers = [
  { id: 1, username: 'patient.one', displayName: '患者一', role: '患者', status: '正常', createdAt: '2026-08-01' },
  { id: 2, username: 'dr.li', displayName: '李医生', role: '医生', status: '正常', createdAt: '2026-08-05' },
  { id: 3, username: 'admin', displayName: '管理员', role: '管理员', status: '正常', createdAt: '2026-08-10' },
  { id: 4, username: 'patient.two', displayName: '患者二', role: '患者', status: '正常', createdAt: '2026-08-15' },
  { id: 5, username: 'dr.chen', displayName: '陈医生', role: '医生', status: '正常', createdAt: '2026-08-18' },
]

const patientStatusStyle = {
  训练中: 'bg-[#EAF4FF] text-[#3B82F6]',
  待评估: 'bg-orange-50 text-orange-500',
  休息中: 'bg-gray-100 text-gray-500',
}

const userRoleStyle = {
  患者: 'bg-[#EAF4FF] text-[#3B82F6]',
  医生: 'bg-purple-50 text-purple-500',
  管理员: 'bg-gray-100 text-gray-600',
}

const tabCls = (active) =>
  `rounded-full px-6 py-2 text-sm font-medium transition-all ${
    active ? 'bg-white text-[#3B82F6] shadow' : 'text-gray-400 hover:text-[#3B82F6]/70'
  }`

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-[#1E3A5F] outline-none transition-all placeholder:text-gray-400 focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20'

const thCls = 'px-5 py-3 font-medium'
const tdCls = 'px-5 py-3 text-gray-500'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = (type) =>
  type === 'users'
    ? { username: '', displayName: '', role: '患者', status: '正常' }
    : { name: '', age: '', gender: '男', status: '训练中', doctor: '' }

function SearchIcon() {
  return (
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#1E3A5F]">{label}</span>
      {children}
    </label>
  )
}

function DoctorUsers() {
  const [tab, setTab] = useState('patients') // 'patients' | 'users'
  const [keyword, setKeyword] = useState('')
  const [patients, setPatients] = useState(initialPatients)
  const [users, setUsers] = useState(initialUsers)

  // 新增/编辑弹窗：null 表示关闭；{ type, mode, record } 表示打开
  const [editor, setEditor] = useState(null)
  const [form, setForm] = useState({})
  const [formError, setFormError] = useState('')

  const isPatients = tab === 'patients'
  const list = isPatients ? patients : users

  const filtered = list.filter((row) => {
    const q = keyword.trim()
    if (!q) return true
    if (isPatients) return row.name.includes(q) || row.doctor.includes(q)
    return row.username.includes(q) || row.displayName.includes(q) || row.role.includes(q)
  })

  const openAdd = () => {
    setEditor({ type: tab, mode: 'add', record: null })
    setForm(emptyForm(tab))
    setFormError('')
  }

  const openEdit = (row) => {
    setEditor({ type: tab, mode: 'edit', record: row })
    setForm({ ...row })
    setFormError('')
  }

  const handleDelete = (row) => {
    const label = isPatients ? row.name : row.displayName
    if (!window.confirm(`确定删除「${label}」吗？`)) return
    if (isPatients) setPatients(patients.filter((p) => p.id !== row.id))
    else setUsers(users.filter((u) => u.id !== row.id))
  }

  const handleSave = () => {
    if (editor.type === 'users') {
      if (!form.username?.trim()) return setFormError('请填写用户名')
      if (!form.displayName?.trim()) return setFormError('请填写昵称')
    } else if (!form.name?.trim()) {
      return setFormError('请填写姓名')
    }

    if (editor.mode === 'add') {
      if (editor.type === 'users') {
        setUsers([...users, { id: Date.now(), ...form, createdAt: today() }])
      } else {
        setPatients([...patients, { id: Date.now(), ...form, lastTraining: '-' }])
      }
    } else if (editor.type === 'users') {
      setUsers(users.map((u) => (u.id === editor.record.id ? { ...u, ...form } : u)))
    } else {
      setPatients(patients.map((p) => (p.id === editor.record.id ? { ...p, ...form } : p)))
    }
    setEditor(null)
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">患者与用户管理</h1>
        <p className="mt-1 text-sm text-gray-400">
          共 {list.length} 条{isPatients ? '患者' : '账号'}（前端 mock 数据，后端待接入）
        </p>

        {/* 切换 + 新增 */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="inline-flex gap-1 rounded-full bg-[#EAF4FF] p-1">
            <button type="button" className={tabCls(isPatients)} onClick={() => setTab('patients')}>
              患者信息
            </button>
            <button type="button" className={tabCls(!isPatients)} onClick={() => setTab('users')}>
              用户账号
            </button>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#5EA2FF] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#3B82F6]/30 transition-all hover:brightness-105"
          >
            + 新增{isPatients ? '患者' : '账号'}
          </button>
        </div>

        {/* 搜索 */}
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/80 px-4 py-2.5 shadow-sm focus-within:border-[#3B82F6]/40 focus-within:ring-2 focus-within:ring-[#3B82F6]/15">
          <SearchIcon />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={isPatients ? '搜索患者姓名或主治医生…' : '搜索用户名、昵称或角色…'}
            className="flex-1 bg-transparent text-sm text-[#1E3A5F] outline-none placeholder:text-gray-400"
          />
        </div>

        {/* 表格 */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white/80 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F7FAFF] text-xs text-gray-400">
                {isPatients ? (
                  <>
                    <th className={thCls}>姓名</th>
                    <th className={thCls}>年龄</th>
                    <th className={thCls}>性别</th>
                    <th className={thCls}>状态</th>
                    <th className={thCls}>主治医生</th>
                    <th className={thCls}>最近训练</th>
                  </>
                ) : (
                  <>
                    <th className={thCls}>用户名</th>
                    <th className={thCls}>昵称</th>
                    <th className={thCls}>角色</th>
                    <th className={thCls}>状态</th>
                    <th className={thCls}>创建时间</th>
                  </>
                )}
                <th className={`${thCls} text-right`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-50 transition-colors last:border-0 hover:bg-[#F7FAFF]/70"
                >
                  {isPatients ? (
                    <>
                      <td className="px-5 py-3 font-medium text-[#1E3A5F]">{row.name}</td>
                      <td className={tdCls}>{row.age}</td>
                      <td className={tdCls}>{row.gender}</td>
                      <td className={tdCls}>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${patientStatusStyle[row.status]}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className={tdCls}>{row.doctor}</td>
                      <td className={tdCls}>{row.lastTraining}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3 font-medium text-[#1E3A5F]">{row.username}</td>
                      <td className={tdCls}>{row.displayName}</td>
                      <td className={tdCls}>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${userRoleStyle[row.role]}`}>
                          {row.role}
                        </span>
                      </td>
                      <td className={tdCls}>{row.status}</td>
                      <td className={tdCls}>{row.createdAt}</td>
                    </>
                  )}
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-full bg-[#EAF4FF] px-3 py-1 text-xs font-medium text-[#3B82F6] transition-colors hover:bg-[#dbeafe]"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                    没有找到匹配的记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* 新增 / 编辑弹窗 */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 animate-fade-in bg-[#1E3A5F]/40 backdrop-blur-sm"
            onClick={() => setEditor(null)}
          />
          <div className="relative w-full max-w-md animate-modal-pop rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-[#1E3A5F]">
              {editor.mode === 'add' ? '新增' : '编辑'}
              {editor.type === 'users' ? '账号' : '患者'}
            </h2>

            <div className="mt-5 flex flex-col gap-4">
              {editor.type === 'users' ? (
                <>
                  <Field label="用户名">
                    <input
                      value={form.username ?? ''}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="用户名（3-32 位字母数字._-）"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="昵称">
                    <input
                      value={form.displayName ?? ''}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      placeholder="昵称"
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="角色">
                      <select
                        value={form.role ?? '患者'}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        className={inputCls}
                      >
                        <option>患者</option>
                        <option>医生</option>
                        <option>管理员</option>
                      </select>
                    </Field>
                    <Field label="状态">
                      <select
                        value={form.status ?? '正常'}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className={inputCls}
                      >
                        <option>正常</option>
                        <option>禁用</option>
                      </select>
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Field label="姓名">
                    <input
                      value={form.name ?? ''}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="患者姓名"
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="年龄">
                      <input
                        type="number"
                        value={form.age ?? ''}
                        onChange={(e) => setForm({ ...form, age: e.target.value })}
                        placeholder="年龄"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="性别">
                      <select
                        value={form.gender ?? '男'}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className={inputCls}
                      >
                        <option>男</option>
                        <option>女</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="状态">
                      <select
                        value={form.status ?? '训练中'}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className={inputCls}
                      >
                        <option>训练中</option>
                        <option>待评估</option>
                        <option>休息中</option>
                      </select>
                    </Field>
                    <Field label="主治医生">
                      <input
                        value={form.doctor ?? ''}
                        onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                        placeholder="主治医生"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </>
              )}

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#5EA2FF] py-3 text-sm font-semibold text-white shadow-lg shadow-[#3B82F6]/30 transition-all hover:brightness-105"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorUsers
