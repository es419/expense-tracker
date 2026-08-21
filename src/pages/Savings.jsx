<<<<<<< HEAD
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteSaving, fetchSavings, upsertSaving } from '../services/sheetsApi'
import { useSelectedMonth } from '../context/MonthContext'

const SAVING_TYPES = ['פנסיה', 'קרן השתלמות', 'חיסכון בנקאי', 'קופת גמל', 'השקעה', 'אחר']
=======
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  deleteSaving,
  fetchAttendanceContributionData,
  fetchSavings,
  saveAttendanceSpreadsheetLink,
  upsertSaving,
} from '../services/sheetsApi'
import { useSelectedMonth } from '../context/MonthContext'

const SAVING_TYPES = ['פנסיה', 'קרן השתלמות', 'חיסכון בנקאי', 'קופת גמל', 'השקעה', 'אחר']
const SALARY_TYPES = new Set(['פנסיה', 'קרן השתלמות'])
>>>>>>> c98eac7 (connect live salary rates to savings tracking)

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `saving-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

<<<<<<< HEAD
function projectOneYear(item) {
  const balance = Math.max(Number(item.balance) || 0, 0)
  const deposit = Math.max(Number(item.monthlyDeposit) || 0, 0)
=======
function money(value) {
  return `${(Number(value) || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`
}

function percent(value) {
  const number = Number(value) || 0
  return `${number.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`
}

function salaryRates(type, attendance) {
  if (!attendance?.available) return { employee: 0, employer: 0, severance: 0, total: 0 }

  if (type === 'פנסיה') {
    const employee = Number(attendance.pensionEmployeePercent) || 0
    const employer = Number(attendance.pensionEmployerPercent) || 0
    const severance = Number(attendance.pensionSeverancePercent) || 0
    return { employee, employer, severance, total: employee + employer + severance }
  }

  if (type === 'קרן השתלמות') {
    const employee = Number(attendance.trainingFundEmployeePercent) || 0
    const employer = Number(attendance.trainingFundEmployerPercent) || 0
    return { employee, employer, severance: 0, total: employee + employer }
  }

  return { employee: 0, employer: 0, severance: 0, total: 0 }
}

function effectiveMonthlyDeposit(item, attendance) {
  if (item.salaryLinked && SALARY_TYPES.has(item.type)) {
    const gross = Math.max(Number(attendance?.gross) || 0, 0)
    return gross * salaryRates(item.type, attendance).total / 100
  }
  return Math.max(Number(item.monthlyDeposit) || 0, 0)
}

function projectOneYear(item, attendance) {
  const balance = Math.max(Number(item.balance) || 0, 0)
  const deposit = effectiveMonthlyDeposit(item, attendance)
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  const annualReturn = Math.max(Number(item.annualReturn) || 0, -99.9)
  const fee = Math.max(Number(item.managementFee) || 0, 0)
  const netAnnual = Math.max(annualReturn - fee, -99.9)
  const monthlyRate = Math.pow(1 + netAnnual / 100, 1 / 12) - 1
  let value = balance
<<<<<<< HEAD
=======

>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  for (let month = 0; month < 12; month += 1) {
    value *= 1 + monthlyRate
    value += deposit
  }
<<<<<<< HEAD
  return value
}

function money(value) {
  return `${(Number(value) || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`
=======

  return value
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
}

function emptyForm() {
  return {
    id: createId(),
    name: '',
    type: SAVING_TYPES[0],
    balance: '',
    monthlyDeposit: '',
    annualReturn: '',
    managementFee: '',
<<<<<<< HEAD
=======
    salaryLinked: false,
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  }
}

export default function Savings() {
  const { selectedMonthKey, refreshVersion } = useSelectedMonth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
<<<<<<< HEAD
=======
  const [attendance, setAttendance] = useState(null)
  const [attendanceLoading, setAttendanceLoading] = useState(true)
  const [attendanceLink, setAttendanceLink] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

<<<<<<< HEAD
=======
  const refreshAttendance = useCallback(async () => {
    setAttendanceLoading(true)
    try {
      const result = await fetchAttendanceContributionData(selectedMonthKey)
      setAttendance(result || null)
    } catch (error) {
      console.error('Failed to load attendance contribution data:', error)
      setAttendance({ available: false, message: error.message })
    } finally {
      setAttendanceLoading(false)
    }
  }, [selectedMonthKey])

>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSavings(selectedMonthKey)
      .then(result => { if (!cancelled) setItems(result) })
      .catch(error => console.error('Failed to load savings:', error))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedMonthKey, refreshVersion])

<<<<<<< HEAD
  const totals = useMemo(() => {
    return items.reduce((acc, item) => ({
      balance: acc.balance + (Number(item.balance) || 0),
      monthlyDeposit: acc.monthlyDeposit + (Number(item.monthlyDeposit) || 0),
      projected: acc.projected + projectOneYear(item),
    }), { balance: 0, monthlyDeposit: 0, projected: 0 })
=======
  useEffect(() => {
    refreshAttendance()
  }, [refreshAttendance, refreshVersion])

  useEffect(() => {
    const onFocus = () => refreshAttendance()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshAttendance()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshAttendance])

  const totals = useMemo(() => {
    return items.reduce((acc, item) => ({
      balance: acc.balance + (Number(item.balance) || 0),
      monthlyDeposit: acc.monthlyDeposit + effectiveMonthlyDeposit(item, attendance),
      projected: acc.projected + projectOneYear(item, attendance),
    }), { balance: 0, monthlyDeposit: 0, projected: 0 })
  }, [items, attendance])

  const linkedCounts = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.salaryLinked && SALARY_TYPES.has(item.type)) acc[item.type] = (acc[item.type] || 0) + 1
      return acc
    }, {})
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  }, [items])

  function openNew() {
    setForm(emptyForm())
    setEditorOpen(true)
  }

  function openEdit(item) {
    setForm({
      id: item.id,
      name: item.name,
      type: item.type || SAVING_TYPES[0],
      balance: String(item.balance ?? ''),
      monthlyDeposit: String(item.monthlyDeposit ?? ''),
      annualReturn: String(item.annualReturn ?? ''),
      managementFee: String(item.managementFee ?? ''),
<<<<<<< HEAD
=======
      salaryLinked: Boolean(item.salaryLinked),
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
    })
    setEditorOpen(true)
  }

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

<<<<<<< HEAD
  async function saveItem(event) {
    event.preventDefault()
    if (!form.name.trim() || saving) return
=======
  function updateType(value) {
    setForm(current => ({
      ...current,
      type: value,
      salaryLinked: SALARY_TYPES.has(value) ? current.salaryLinked : false,
    }))
  }

  async function saveItem(event) {
    event.preventDefault()
    if (!form.name.trim() || saving) return

>>>>>>> c98eac7 (connect live salary rates to savings tracking)
    try {
      setSaving(true)
      const result = await upsertSaving({
        ...form,
        name: form.name.trim(),
        balance: Number(form.balance) || 0,
        monthlyDeposit: Number(form.monthlyDeposit) || 0,
        annualReturn: Number(form.annualReturn) || 0,
        managementFee: Number(form.managementFee) || 0,
<<<<<<< HEAD
=======
        salaryLinked: Boolean(form.salaryLinked && SALARY_TYPES.has(form.type)),
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
      }, selectedMonthKey)
      setItems(result)
      setEditorOpen(false)
    } catch (error) {
      alert('לא הצלחתי לשמור את החיסכון: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeItem() {
    if (saving || !items.some(item => item.id === form.id)) return
    if (!confirm(`למחוק את "${form.name}"?`)) return
<<<<<<< HEAD
=======

>>>>>>> c98eac7 (connect live salary rates to savings tracking)
    try {
      setSaving(true)
      const result = await deleteSaving(form.id, selectedMonthKey)
      setItems(result)
      setEditorOpen(false)
    } catch (error) {
      alert('לא הצלחתי למחוק: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

<<<<<<< HEAD
=======
  async function connectAttendance(event) {
    event.preventDefault()
    if (!attendanceLink.trim() || linkBusy) return
    try {
      setLinkBusy(true)
      const result = await saveAttendanceSpreadsheetLink(attendanceLink.trim(), selectedMonthKey)
      setAttendance(result)
      setAttendanceLink('')
    } catch (error) {
      alert('לא הצלחתי לחבר את גיליון הנוכחות: ' + error.message)
    } finally {
      setLinkBusy(false)
    }
  }

  const formRates = salaryRates(form.type, attendance)
  const formLinkedDeposit = effectiveMonthlyDeposit({ ...form, salaryLinked: true }, attendance)
  const missingEmployerRates = attendance?.available && (
    (form.type === 'פנסיה' && form.salaryLinked && formRates.employer + formRates.severance === 0) ||
    (form.type === 'קרן השתלמות' && form.salaryLinked && formRates.employer === 0)
  )

>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  return (
    <>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <div style={styles.heroLabel}>סה״כ חסכונות ונכסים פיננסיים</div>
          <div style={styles.heroValue}>{money(totals.balance)}</div>
          <div style={styles.heroGrid}>
<<<<<<< HEAD
            <div><span style={styles.miniLabel}>הפקדה חודשית</span><strong style={styles.miniValue}>{money(totals.monthlyDeposit)}</strong></div>
=======
            <div><span style={styles.miniLabel}>הפקדה חודשית משוערת</span><strong style={styles.miniValue}>{money(totals.monthlyDeposit)}</strong></div>
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
            <div><span style={styles.miniLabel}>תחזית לעוד שנה</span><strong style={styles.miniValue}>{money(totals.projected)}</strong></div>
          </div>
        </section>

<<<<<<< HEAD
        <div style={styles.notice}>
          היתרה הנוכחית היא הנתון האמיתי. התשואה ודמי הניהול משמשים רק לתחזית, ותשואה יכולה להיות גם שלילית.
        </div>

=======
        <AttendanceCard
          attendance={attendance}
          loading={attendanceLoading}
          attendanceLink={attendanceLink}
          setAttendanceLink={setAttendanceLink}
          linkBusy={linkBusy}
          connectAttendance={connectAttendance}
          refreshAttendance={refreshAttendance}
        />

        <div style={styles.notice}>
          היתרה שאתה מזין היא הנתון האמיתי. ״תשואה שנתית״ היא רק הנחת תחזית וניתן לשנות אותה בכל רגע — גם לערך שלילי.
        </div>

        {(linkedCounts['פנסיה'] > 1 || linkedCounts['קרן השתלמות'] > 1) && (
          <div style={styles.warning}>
            שים לב: יותר מחיסכון אחד מאותו סוג מסומן כמקבל הפקדה מהשכר. זה אפשרי, אבל כל אחד מהם יקבל כרגע את מלוא האחוז שמוגדר בנוכחות.
          </div>
        )}

>>>>>>> c98eac7 (connect live salary rates to savings tracking)
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>החסכונות שלי</h3>
          <button type="button" style={styles.addButton} onClick={openNew}>+ הוסף</button>
        </div>

        {loading ? (
          <div style={styles.empty}>טוען...</div>
        ) : items.length ? (
          <div style={styles.list}>
            {items.map(item => {
<<<<<<< HEAD
              const projected = projectOneYear(item)
              const netReturn = (Number(item.annualReturn) || 0) - (Number(item.managementFee) || 0)
=======
              const projected = projectOneYear(item, attendance)
              const netReturn = (Number(item.annualReturn) || 0) - (Number(item.managementFee) || 0)
              const deposit = effectiveMonthlyDeposit(item, attendance)
              const rates = salaryRates(item.type, attendance)
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
              return (
                <button key={item.id} type="button" style={styles.card} onClick={() => openEdit(item)}>
                  <div style={styles.cardTop}>
                    <div style={styles.cardTitleWrap}>
                      <strong style={styles.cardTitle}>{item.name}</strong>
                      <span style={styles.cardType}>{item.type}</span>
                    </div>
                    <strong style={styles.cardBalance}>{money(item.balance)}</strong>
                  </div>
                  <div style={styles.cardStats}>
<<<<<<< HEAD
                    <span>הפקדה {money(item.monthlyDeposit)} / חודש</span>
=======
                    <span>{item.salaryLinked ? `מהשכר ${percent(rates.total)} · ${money(deposit)}` : `הפקדה ${money(deposit)} / חודש`}</span>
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
                    <span>נטו משוער {netReturn.toFixed(2)}%</span>
                  </div>
                  <div style={styles.projectionLine}>
                    <span>תחזית 12 חודשים</span>
                    <strong>{money(projected)}</strong>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
<<<<<<< HEAD
          <div style={styles.empty}>אין עדיין חסכונות. הוסף פנסיה, קרן השתלמות, חיסכון בנקאי או כל נכס אחר.</div>
=======
          <div style={styles.empty}>אין עדיין חסכונות. אפשר להוסיף כמה פנסיות, קרנות השתלמות, קופות גמל וחסכונות בנקאיים שרוצים.</div>
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
        )}
      </div>

      {editorOpen && createPortal(
        <div style={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
          <form style={styles.modal} onSubmit={saveItem}>
            <div style={styles.modalHeader}>
              <strong>{items.some(item => item.id === form.id) ? 'עריכת חיסכון' : 'חיסכון חדש'}</strong>
              <button type="button" style={styles.closeButton} onClick={() => setEditorOpen(false)}>×</button>
            </div>

            <Field label="שם">
<<<<<<< HEAD
              <input style={styles.input} value={form.name} onChange={event => update('name', event.target.value)} placeholder="למשל: פנסיה מנורה" maxLength={60} />
            </Field>

            <Field label="סוג">
              <select style={styles.input} value={form.type} onChange={event => update('type', event.target.value)}>
=======
              <input style={styles.input} value={form.name} onChange={event => update('name', event.target.value)} placeholder="למשל: קרן השתלמות מנורה" maxLength={60} />
            </Field>

            <Field label="סוג">
              <select style={styles.input} value={form.type} onChange={event => updateType(event.target.value)}>
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
                {SAVING_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </Field>

<<<<<<< HEAD
            <div style={styles.twoCols}>
              <Field label="יתרה נוכחית (₪)"><NumberInput value={form.balance} onChange={value => update('balance', value)} /></Field>
              <Field label="הפקדה חודשית (₪)"><NumberInput value={form.monthlyDeposit} onChange={value => update('monthlyDeposit', value)} /></Field>
            </div>

            <div style={styles.twoCols}>
              <Field label="תשואה שנתית משוערת (%)"><NumberInput value={form.annualReturn} onChange={value => update('annualReturn', value)} allowNegative /></Field>
              <Field label="דמי ניהול שנתיים (%)"><NumberInput value={form.managementFee} onChange={value => update('managementFee', value)} /></Field>
            </div>

            <div style={styles.previewBox}>
              <span>תחזית לעוד 12 חודשים</span>
              <strong>{money(projectOneYear(form))}</strong>
=======
            <Field label="יתרה נוכחית (₪)">
              <NumberInput value={form.balance} onChange={value => update('balance', value)} />
            </Field>

            {SALARY_TYPES.has(form.type) && (
              <div style={styles.salaryLinkBox}>
                <label style={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={form.salaryLinked}
                    onChange={event => update('salaryLinked', event.target.checked)}
                    style={styles.checkbox}
                  />
                  <span>
                    <strong style={styles.toggleTitle}>מקבלת הפקדה מהשכר</strong>
                    <small style={styles.toggleText}>הברוטו והאחוזים נמשכים מחדש מאפליקציית הנוכחות.</small>
                  </span>
                </label>

                {form.salaryLinked && (
                  <div style={styles.salaryDetails}>
                    <div><span>ברוטו משוער</span><strong>{attendance?.available ? money(attendance.gross) : 'לא זמין'}</strong></div>
                    <div><span>אחוז כולל לקרן</span><strong>{percent(formRates.total)}</strong></div>
                    <div><span>הפקדה משוערת</span><strong>{money(formLinkedDeposit)}</strong></div>
                    <div style={styles.fullRow}>
                      <span>{form.type === 'פנסיה' ? 'עובד + מעסיק + פיצויים' : 'עובד + מעסיק'}</span>
                      <strong>
                        {form.type === 'פנסיה'
                          ? `${percent(formRates.employee)} + ${percent(formRates.employer)} + ${percent(formRates.severance)}`
                          : `${percent(formRates.employee)} + ${percent(formRates.employer)}`}
                      </strong>
                    </div>
                  </div>
                )}

                {missingEmployerRates && (
                  <div style={styles.inlineWarning}>
                    באפליקציית הנוכחות עדיין חסרים אחוזי מעסיק{form.type === 'פנסיה' ? '/פיצויים' : ''}. עד שתזין אותם שם, החישוב כאן יכלול רק את האחוזים שקיימים.
                  </div>
                )}
              </div>
            )}

            {(!SALARY_TYPES.has(form.type) || !form.salaryLinked) && (
              <Field label="הפקדה חודשית (₪)">
                <NumberInput value={form.monthlyDeposit} onChange={value => update('monthlyDeposit', value)} />
              </Field>
            )}

            <div style={styles.twoCols}>
              <Field label="הנחת תשואה שנתית (%)"><NumberInput value={form.annualReturn} onChange={value => update('annualReturn', value)} allowNegative /></Field>
              <Field label="דמי ניהול שנתיים (%)"><NumberInput value={form.managementFee} onChange={value => update('managementFee', value)} /></Field>
            </div>

            <div style={styles.returnHint}>
              בגמל/השקעות זה לא ״אחוז קבוע״ — זו רק הנחה לתחזית. היתרה בפועל שאתה מעדכן היא תמיד הקובעת.
            </div>

            <div style={styles.previewBox}>
              <span>תחזית לעוד 12 חודשים</span>
              <strong>{money(projectOneYear(form, attendance))}</strong>
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
            </div>

            <button style={styles.saveButton} disabled={saving || !form.name.trim()}>{saving ? 'שומר...' : 'שמור'}</button>
            {items.some(item => item.id === form.id) && (
              <button type="button" style={styles.deleteButton} onClick={removeItem} disabled={saving}>מחק חיסכון</button>
            )}
          </form>
        </div>,
        document.body
      )}
    </>
  )
}

<<<<<<< HEAD
=======
function AttendanceCard({ attendance, loading, attendanceLink, setAttendanceLink, linkBusy, connectAttendance, refreshAttendance }) {
  if (loading && !attendance) {
    return <div style={styles.attendanceCard}>טוען נתוני שכר מאפליקציית הנוכחות...</div>
  }

  if (attendance?.available) {
    const pensionTotal = salaryRates('פנסיה', attendance).total
    const trainingTotal = salaryRates('קרן השתלמות', attendance).total
    return (
      <div style={styles.attendanceCard}>
        <div style={styles.attendanceHeader}>
          <div>
            <strong>נתוני שכר מחוברים</strong>
            <span>נמשכים מחדש בכל כניסה ורענון</span>
          </div>
          <button type="button" style={styles.refreshButton} onClick={refreshAttendance} disabled={loading}>{loading ? '...' : 'רענן'}</button>
        </div>
        <div style={styles.attendanceGrid}>
          <div><span>ברוטו משוער</span><strong>{money(attendance.gross)}</strong></div>
          <div><span>פנסיה כולל</span><strong>{percent(pensionTotal)}</strong></div>
          <div><span>השתלמות כולל</span><strong>{percent(trainingTotal)}</strong></div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.attendanceCard}>
      <strong>חיבור לאפליקציית הנוכחות</strong>
      <p style={styles.connectText}>לא הצלחתי לאתר אוטומטית את גיליון הנוכחות. מדביקים כאן פעם אחת את הקישור ל-Google Sheet של השנה, ומכאן הנתונים יימשכו ממנו מחדש אוטומטית.</p>
      <form onSubmit={connectAttendance} style={styles.connectForm}>
        <input
          style={styles.input}
          value={attendanceLink}
          onChange={event => setAttendanceLink(event.target.value)}
          placeholder="קישור ל-Google Sheet של הנוכחות"
        />
        <button style={styles.connectButton} disabled={linkBusy || !attendanceLink.trim()}>{linkBusy ? 'מחבר...' : 'חבר'}</button>
      </form>
    </div>
  )
}

>>>>>>> c98eac7 (connect live salary rates to savings tracking)
function Field({ label, children }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span>{children}</label>
}

function NumberInput({ value, onChange, allowNegative = false }) {
  return (
    <input
      style={styles.input}
      type="number"
      inputMode="decimal"
      step="0.01"
      min={allowNegative ? '-99.9' : '0'}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder="0"
    />
  )
}

const styles = {
  container: { padding: '4px 16px 110px', direction: 'rtl', maxWidth: '480px', margin: '0 auto' },
  heroCard: { padding: '16px', borderRadius: '18px', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow)' },
  heroLabel: { color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 },
  heroValue: { marginTop: '3px', fontSize: '32px', fontWeight: 850, lineHeight: 1.15 },
  heroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' },
  miniLabel: { display: 'block', color: 'var(--text-muted)', fontSize: '10px', marginBottom: '3px' },
  miniValue: { fontSize: '14px' },
<<<<<<< HEAD
  notice: { marginTop: '9px', padding: '10px 11px', borderRadius: '13px', background: 'var(--surface-soft)', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.45 },
  sectionHeader: { marginTop: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  sectionTitle: { margin: 0, fontSize: '15px' },
  addButton: { minHeight: '36px', padding: '0 12px', borderRadius: '11px', border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer' },
  list: { display: 'grid', gap: '8px' },
  card: { width: '100%', padding: '13px', borderRadius: '15px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'right', cursor: 'pointer' },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
  cardTitleWrap: { minWidth: 0 },
  cardTitle: { display: 'block', fontSize: '14px' },
  cardType: { display: 'block', marginTop: '3px', color: 'var(--text-muted)', fontSize: '10px' },
  cardBalance: { fontSize: '18px', whiteSpace: 'nowrap' },
  cardStats: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px' },
  projectionLine: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '9px', paddingTop: '9px', borderTop: '1px solid var(--border)', fontSize: '11px' },
  empty: { padding: '20px 12px', border: '1px dashed var(--border)', borderRadius: '14px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px', lineHeight: 1.5 },
  modalBackdrop: { position: 'fixed', zIndex: 70, inset: 0, padding: 'max(18px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom))', background: 'rgba(0,0,0,.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { width: 'min(452px, 100%)', maxHeight: '88dvh', overflowY: 'auto', padding: '14px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', boxShadow: '0 22px 55px rgba(0,0,0,.28)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', fontSize: '16px' },
  closeButton: { width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '24px', lineHeight: 1, cursor: 'pointer' },
  field: { display: 'block', marginBottom: '9px' },
  label: { display: 'block', marginBottom: '5px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 },
  input: { width: '100%', minWidth: 0, minHeight: '44px', padding: '0 11px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontSize: '16px', textAlign: 'right' },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
=======
  attendanceCard: { marginTop: '10px', padding: '13px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)' },
  attendanceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  attendanceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginTop: '11px' },
  refreshButton: { border: '1px solid var(--border)', background: 'var(--surface-soft)', color: 'var(--text)', borderRadius: '10px', padding: '7px 10px', fontWeight: 750, cursor: 'pointer' },
  connectText: { margin: '6px 0 10px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 },
  connectForm: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '7px' },
  connectButton: { border: 0, borderRadius: '12px', padding: '0 14px', background: 'var(--button)', color: 'var(--button-text)', fontWeight: 800, cursor: 'pointer' },
  notice: { marginTop: '9px', padding: '10px 12px', borderRadius: '14px', background: 'var(--surface-soft)', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.55 },
  warning: { marginTop: '8px', padding: '10px 12px', borderRadius: '14px', border: '1px solid color-mix(in srgb, #f59e0b 45%, var(--border))', background: 'color-mix(in srgb, #f59e0b 8%, var(--surface))', fontSize: '11px', lineHeight: 1.5 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px' },
  sectionTitle: { margin: 0, fontSize: '16px' },
  addButton: { minHeight: '36px', border: 0, borderRadius: '11px', padding: '0 12px', background: 'var(--button)', color: 'var(--button-text)', fontWeight: 800, cursor: 'pointer' },
  list: { display: 'grid', gap: '8px' },
  card: { width: '100%', textAlign: 'right', padding: '13px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' },
  cardTitleWrap: { display: 'grid', gap: '3px' },
  cardTitle: { fontSize: '14px' },
  cardType: { color: 'var(--text-muted)', fontSize: '10px' },
  cardBalance: { fontSize: '17px', whiteSpace: 'nowrap' },
  cardStats: { display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px' },
  projectionLine: { display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '9px', paddingTop: '9px', borderTop: '1px solid var(--border)', fontSize: '11px' },
  empty: { padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' },
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '12px', background: 'rgba(0,0,0,.46)', direction: 'rtl' },
  modal: { width: '100%', maxWidth: '480px', maxHeight: '92dvh', overflowY: 'auto', padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', borderRadius: '22px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 18px 50px rgba(0,0,0,.25)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', fontSize: '17px' },
  closeButton: { width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-soft)', color: 'var(--text)', fontSize: '23px', lineHeight: 1, cursor: 'pointer' },
  field: { display: 'grid', gap: '6px', marginBottom: '10px' },
  label: { color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 },
  input: { width: '100%', minWidth: 0, minHeight: '44px', padding: '0 11px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontSize: '16px', textAlign: 'right' },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  salaryLinkBox: { marginBottom: '10px', padding: '11px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--surface-soft)' },
  toggleRow: { display: 'flex', alignItems: 'flex-start', gap: '9px', cursor: 'pointer' },
  checkbox: { width: '20px', height: '20px', marginTop: '1px', flex: '0 0 auto' },
  toggleTitle: { display: 'block', fontSize: '13px' },
  toggleText: { display: 'block', marginTop: '2px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4 },
  salaryDetails: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '10px' },
  fullRow: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: '8px', paddingTop: '7px', borderTop: '1px dashed var(--border)' },
  inlineWarning: { marginTop: '9px', padding: '8px', borderRadius: '10px', background: 'color-mix(in srgb, #f59e0b 8%, var(--surface))', fontSize: '10px', lineHeight: 1.45 },
  returnHint: { margin: '-2px 0 10px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.45 },
>>>>>>> c98eac7 (connect live salary rates to savings tracking)
  previewBox: { display: 'flex', justifyContent: 'space-between', gap: '10px', margin: '4px 0 11px', padding: '11px', borderRadius: '12px', background: 'var(--surface-soft)', fontSize: '12px' },
  saveButton: { width: '100%', minHeight: '50px', border: 0, borderRadius: '14px', background: 'var(--button)', color: 'var(--button-text)', fontSize: '15px', fontWeight: 800, cursor: 'pointer' },
  deleteButton: { width: '100%', minHeight: '42px', marginTop: '8px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--expense) 45%, var(--border))', background: 'transparent', color: 'var(--expense)', fontWeight: 750, cursor: 'pointer' },
}
