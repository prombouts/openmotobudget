import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  createInitialRecordDraft,
  type Record as MotorcycleRecord,
  type RecordDraft,
  type RecordKind,
  type WorkType,
} from './domain/record'
import {
  expenseCategories,
  expenseChartState,
  expenseCurrencies,
  monthlyExpenses,
  type ExpenseCategory,
  type MonthlyExpense,
} from './domain/monthlyExpenses'
import { validateRecord } from './domain/validateRecord'
import {
  LocalStorageRecordRepository,
  RECORDS_STORAGE_KEY,
  SqliteOpfsRecordRepository,
} from './persistence/recordRepository'
import {
  createRecordBackup,
  parseRecordBackup,
  type RecordBackup,
} from './persistence/recordBackup'
import {
  formatCurrency,
  formatDate,
  formatMonth,
  formatNumber,
} from './formatters'
import './App.css'

type FormValues = {
  kind: RecordKind
  occurredOn: string
  odometerKm: string
  costAmount: string
  currency: string
  notes: string
  liters: string
  pricePerLiter: string
  partName: string
  quantity: string
  workType: WorkType | ''
  description: string
}

type FieldErrors = { [field: string]: string }

const recordKinds: readonly RecordKind[] = ['fuel', 'part', 'work']
const OPFS_IMPORT_COMPLETE_KEY = `${RECORDS_STORAGE_KEY}:opfs-imported`

function sortRecords(records: readonly MotorcycleRecord[]): MotorcycleRecord[] {
  return [...records].sort(
    (left, right) =>
      right.occurredOn.localeCompare(left.occurredOn) ||
      right.id.localeCompare(left.id),
  )
}

function initialValues(): FormValues {
  const draft = createInitialRecordDraft()
  return {
    kind: 'fuel',
    occurredOn: draft.occurredOn ?? '',
    odometerKm: '',
    costAmount: '',
    currency: draft.currency ?? '',
    notes: '',
    liters: '',
    pricePerLiter: '',
    partName: '',
    quantity: '',
    workType: '',
    description: '',
  }
}

function valuesFromRecord(record: MotorcycleRecord): FormValues {
  const common = {
    ...initialValues(),
    kind: record.kind,
    occurredOn: record.occurredOn,
    odometerKm: record.odometerKm === undefined ? '' : String(record.odometerKm),
    costAmount: record.costAmount === undefined ? '' : String(record.costAmount),
    currency: record.currency ?? '',
    notes: record.notes ?? '',
  }

  switch (record.kind) {
    case 'fuel':
      return {
        ...common,
        liters: String(record.liters),
        pricePerLiter:
          record.pricePerLiter === undefined ? '' : String(record.pricePerLiter),
      }
    case 'part':
      return { ...common, partName: record.partName, quantity: String(record.quantity) }
    case 'work':
      return { ...common, workType: record.workType, description: record.description }
  }
}

function asNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value)
}

function today(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function newId(): string {
  return crypto.randomUUID()
}

function toDraft(values: FormValues, id: string): RecordDraft {
  const costAmount = asNumber(values.costAmount)
  return {
    id,
    kind: values.kind,
    occurredOn: values.occurredOn,
    odometerKm: asNumber(values.odometerKm),
    costAmount,
    currency: costAmount === undefined ? undefined : values.currency.trim().toUpperCase(),
    notes: values.notes,
    liters: asNumber(values.liters),
    pricePerLiter: asNumber(values.pricePerLiter),
    partName: values.partName,
    quantity: asNumber(values.quantity),
    workType: values.workType || undefined,
    description: values.description,
  }
}

function labelForKind(kind: RecordKind): string {
  return kind === 'fuel' ? 'Fuel' : kind === 'part' ? 'Part' : 'Maintenance or repair'
}

function shortLabelForKind(kind: RecordKind): string {
  return kind === 'work' ? 'Workshop' : labelForKind(kind)
}

function recordDetails(record: MotorcycleRecord): string {
  switch (record.kind) {
    case 'fuel':
      return `${formatNumber(record.liters)} l${record.pricePerLiter ? ` · ${formatNumber(record.pricePerLiter)}/l` : ''}`
    case 'part':
      return `${record.partName} · quantity ${formatNumber(record.quantity)}`
    case 'work':
      return `${record.workType === 'maintenance' ? 'Maintenance' : 'Repair'} · ${record.description}`
  }
}

function formatCost(record: MotorcycleRecord): string | undefined {
  if (record.costAmount === undefined || !record.currency) return undefined
  return formatCurrency(record.costAmount, record.currency)
}

const categoryLabels: Record<ExpenseCategory, string> = {
  fuel: 'Fuel',
  part: 'Parts',
  work: 'Work',
}

function formatAmount(amount: number, currency: string): string {
  return formatCurrency(amount, currency)
}

function ExpenseChart({
  expenses,
  currency,
}: {
  expenses: readonly MonthlyExpense[]
  currency: string
}) {
  const maximum = Math.max(1, ...expenses.map((expense) => expense.total))
  const width = Math.max(620, expenses.length * 96 + 86)
  const baseline = 224
  const chartHeight = 172
  const colors: Record<ExpenseCategory, string> = {
    fuel: '#0f766e',
    part: '#3569b5',
    work: '#b9650a',
  }

  return (
    <>
      <ul className="chart-legend" aria-label="Expense categories">
        {expenseCategories.map((category) => (
          <li key={category}>
            <span className={`legend-swatch legend-${category}`} aria-hidden="true" />
            {categoryLabels[category]}
          </li>
        ))}
      </ul>
      <div className="chart-scroll">
        <svg
          className="expense-chart"
          viewBox={`0 0 ${width} 270`}
          role="img"
          aria-labelledby="expense-chart-title expense-chart-description"
        >
          <title id="expense-chart-title">Monthly {currency} expenses by category</title>
          <desc id="expense-chart-description">
            Stacked bars show fuel, part, and work costs. Each bar label gives that month’s total.
          </desc>
          <line className="chart-axis" x1="44" x2={width - 18} y1={baseline} y2={baseline} />
          {expenses.map((expense, index) => {
            const x = 60 + index * 96
            let stackedHeight = 0
            return (
              <g key={expense.month}>
                {expenseCategories.map((category) => {
                  const amount = expense[category]
                  const height = (amount / maximum) * chartHeight
                  const y = baseline - stackedHeight - height
                  stackedHeight += height
                  return amount > 0 ? (
                    <rect
                      key={category}
                      className="chart-bar"
                      fill={colors[category]}
                      height={height}
                      rx="2"
                      width="48"
                      x={x}
                      y={y}
                    >
                      <title>{`${formatMonth(expense.month)}: ${categoryLabels[category]} ${formatAmount(amount, currency)}`}</title>
                    </rect>
                  ) : null
                })}
                <text className="chart-total" textAnchor="middle" x={x + 24} y={baseline - stackedHeight - 8}>
                  {formatAmount(expense.total, currency)}
                </text>
                <text className="chart-month" textAnchor="middle" x={x + 24} y={baseline + 22}>
                  {formatMonth(expense.month)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <details className="chart-data">
        <summary>View monthly data as a table</summary>
        <div className="table-scroll">
          <table>
            <caption>Monthly {currency} expenses by category</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {expenseCategories.map((category) => <th key={category} scope="col">{categoryLabels[category]}</th>)}
                <th scope="col">Total</th>
                {expenseCategories.map((category) => <th key={`${category}-unpriced`} scope="col">{categoryLabels[category]} unpriced</th>)}
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.month}>
                  <th scope="row">{formatMonth(expense.month)}</th>
                  {expenseCategories.map((category) => <td key={category}>{formatAmount(expense[category], currency)}</td>)}
                  <td><strong>{formatAmount(expense.total, currency)}</strong></td>
                  {expenseCategories.map((category) => <td key={`${category}-unpriced`}>{formatNumber(expense.unpriced[category])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}

function App() {
  const repository = useMemo(() => new SqliteOpfsRecordRepository(), [])
  const [records, setRecords] = useState<MotorcycleRecord[]>([])
  const [storageError, setStorageError] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [editingId, setEditingId] = useState<string>()
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string>()
  const [activeTab, setActiveTab] = useState<'records' | 'expenses' | 'about'>('records')
  const [selectedCurrency, setSelectedCurrency] = useState('')
  const [pendingBackup, setPendingBackup] = useState<RecordBackup>()
  const [backupMessage, setBackupMessage] = useState<string>()
  const [isBackupBusy, setIsBackupBusy] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const currencies = useMemo(() => expenseCurrencies(records), [records])
  const activeCurrency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : currencies.includes('EUR') ? 'EUR' : currencies[0]
  const expenses = useMemo(
    () => activeCurrency ? monthlyExpenses(records, activeCurrency) : [],
    [activeCurrency, records],
  )
  const chartState = useMemo(
    () => expenseChartState(records, activeCurrency),
    [activeCurrency, records],
  )

  const refreshRecords = useCallback(async () => {
    const loadedRecords = await repository.list()
    setRecords(sortRecords(loadedRecords))
  }, [repository])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        if (!window.localStorage.getItem(OPFS_IMPORT_COMPLETE_KEY)) {
          const legacyRecords = new LocalStorageRecordRepository(window.localStorage).list()
          await repository.importLegacy(legacyRecords)
          window.localStorage.setItem(OPFS_IMPORT_COMPLETE_KEY, 'true')
        }
        if (!cancelled) await refreshRecords()
      } catch (error) {
        if (!cancelled) {
          setStorageError(error instanceof Error ? error.message : 'Browser SQLite is unavailable.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [refreshRecords, repository])

  const handleStorageError = (error: unknown) => {
    setStorageError(error instanceof Error ? error.message : 'Browser SQLite is unavailable.')
  }

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      const { [key]: _, ...remaining } = current
      return remaining
    })
  }

  const resetForm = () => {
    setValues(initialValues())
    setErrors({})
    setEditingId(undefined)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading || storageError) return
    const validation = validateRecord(toDraft(values, editingId ?? newId()))
    if (!validation.valid) {
      setErrors(validation.errors)
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }

    try {
      await repository.save(validation.value)
      await refreshRecords()
      setStorageError(undefined)
      resetForm()
    } catch (error) {
      handleStorageError(error)
    }
  }

  const beginEdit = (record: MotorcycleRecord) => {
    setValues(valuesFromRecord(record))
    setErrors({})
    setEditingId(record.id)
    setConfirmingDeleteId(undefined)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (id: string) => {
    try {
      await repository.remove(id)
      await refreshRecords()
      setStorageError(undefined)
      if (editingId === id) resetForm()
      setConfirmingDeleteId(undefined)
    } catch (error) {
      handleStorageError(error)
    }
  }

  const exportBackup = async () => {
    try {
      setIsBackupBusy(true)
      const backup = createRecordBackup(await repository.list())
      const download = URL.createObjectURL(new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: 'application/json' },
      ))
      const link = document.createElement('a')
      link.href = download
      link.download = `openmotobudget-backup-${backup.exportedAt.slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(download)
      setBackupMessage(`Exported ${backup.records.length} ${backup.records.length === 1 ? 'record' : 'records'}.`)
    } catch (error) {
      handleStorageError(error)
    } finally {
      setIsBackupBusy(false)
    }
  }

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const backup = parseRecordBackup(await file.text())
      setPendingBackup(backup)
      setBackupMessage(undefined)
    } catch (error) {
      setPendingBackup(undefined)
      setBackupMessage(error instanceof Error ? error.message : 'Unable to read this backup file.')
    }
  }

  const importBackup = async () => {
    if (!pendingBackup) return
    try {
      setIsBackupBusy(true)
      await repository.replaceAll(pendingBackup.records)
      await refreshRecords()
      setStorageError(undefined)
      setBackupMessage(`Imported ${pendingBackup.records.length} ${pendingBackup.records.length === 1 ? 'record' : 'records'}.`)
      setPendingBackup(undefined)
    } catch (error) {
      handleStorageError(error)
    } finally {
      setIsBackupBusy(false)
    }
  }

  const error = (name: string) =>
    errors[name] && <p className="field-error" id={`${name}-error`}>{errors[name]}</p>

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <div className="brand-lockup" aria-label="openmotobudget">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span className="brand-name">open<span>moto</span>budget</span>
          </div>
          <p className="eyebrow">Your garage ledger</p>
          <h1>Every mile, accounted for.</h1>
          <p className="intro">Log fuel, parts, and workshop work in one clear place. Your records stay private on this device.</p>
        </div>
        <p className="storage-note"><span aria-hidden="true">✓</span> Private on-device log</p>
      </header>
      {storageError && (
        <div className="error-summary" role="alert">
          <strong>Browser SQLite is unavailable.</strong>
          <span> {storageError}</span>
        </div>
      )}

      <nav className="app-nav" aria-label="Expense tracker views">
        <button
          aria-controls="records-panel"
          aria-current={activeTab === 'records' ? 'page' : undefined}
          className="nav-tab"
          onClick={() => setActiveTab('records')}
          type="button"
        >
          Records
        </button>
        <button
          aria-controls="expenses-panel"
          aria-current={activeTab === 'expenses' ? 'page' : undefined}
          className="nav-tab"
          onClick={() => setActiveTab('expenses')}
          type="button"
        >
          Monthly expenses
        </button>
        <button
          aria-controls="about-panel"
          aria-current={activeTab === 'about' ? 'page' : undefined}
          className="nav-tab"
          onClick={() => setActiveTab('about')}
          type="button"
        >
          About
        </button>
      </nav>

      <div hidden={activeTab !== 'records'} id="records-panel">
      <section className="card" aria-labelledby="entry-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{editingId ? 'Updating history' : 'New entry'}</p>
            <h2 id="entry-heading">{editingId ? 'Edit record' : 'Log an expense'}</h2>
          </div>
          {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel editing</button>}
        </div>
        {Object.keys(errors).length > 0 && (
          <div className="error-summary" role="alert" tabIndex={-1}>
            <strong>We couldn’t save this record.</strong>
            <span> Check the highlighted fields and try again.</span>
          </div>
        )}
        <form aria-busy={isLoading} onSubmit={submit} noValidate>
          <fieldset className="record-type-fieldset">
            <legend>What are you logging?</legend>
            <div className="record-type-options">
              {recordKinds.map((kind) => (
                <label className={`record-type-option ${values.kind === kind ? 'is-selected' : ''}`} key={kind}>
                  <input
                    type="radio"
                    name="record-kind"
                    value={kind}
                    checked={values.kind === kind}
                    onChange={() => update('kind', kind)}
                  />
                  <span className="record-type-name">{shortLabelForKind(kind)}</span>
                  <span className="record-type-description">
                    {kind === 'fuel' ? 'Fill-up details' : kind === 'part' ? 'Parts and supplies' : 'Maintenance or repairs'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field-grid">
            <label className="field-label">
              Date <span className="required-mark">Required</span>
              <input type="date" lang="nl-NL" required value={values.occurredOn} max={today()} onChange={(event) => update('occurredOn', event.target.value)} aria-invalid={Boolean(errors.occurredOn)} aria-describedby={errors.occurredOn ? 'occurredOn-error' : undefined} />
              {error('occurredOn')}
            </label>
            <label className="field-label">
              Odometer (km) <span className="optional">(optional)</span>
              <input type="number" lang="nl-NL" min="0" step="1" inputMode="numeric" placeholder="e.g. 24.500" value={values.odometerKm} onChange={(event) => update('odometerKm', event.target.value)} aria-invalid={Boolean(errors.odometerKm)} aria-describedby={errors.odometerKm ? 'odometerKm-error' : undefined} />
              {error('odometerKm')}
            </label>
          </div>

          {values.kind === 'fuel' && (
            <fieldset>
              <legend>Fuel details</legend>
              <div className="field-grid">
                <label className="field-label">
                  Liters <span className="required-mark">Required</span>
                  <input type="number" lang="nl-NL" required min="0" step="any" inputMode="decimal" placeholder="e.g. 14,2" value={values.liters} onChange={(event) => update('liters', event.target.value)} aria-invalid={Boolean(errors.liters)} aria-describedby={errors.liters ? 'liters-error' : undefined} />
                  {error('liters')}
                </label>
                <label className="field-label">
                  Price per liter <span className="optional">(optional)</span>
                  <input type="number" lang="nl-NL" min="0" step="any" inputMode="decimal" value={values.pricePerLiter} onChange={(event) => update('pricePerLiter', event.target.value)} aria-invalid={Boolean(errors.pricePerLiter)} aria-describedby={errors.pricePerLiter ? 'pricePerLiter-error' : undefined} />
                  {error('pricePerLiter')}
                </label>
              </div>
            </fieldset>
          )}
          {values.kind === 'part' && (
            <fieldset>
              <legend>Part details</legend>
              <div className="field-grid">
                <label className="field-label">
                  Part name <span className="required-mark">Required</span>
                  <input required placeholder="e.g. Front brake pads" value={values.partName} onChange={(event) => update('partName', event.target.value)} aria-invalid={Boolean(errors.partName)} aria-describedby={errors.partName ? 'partName-error' : undefined} />
                  {error('partName')}
                </label>
                <label className="field-label">
                  Quantity <span className="required-mark">Required</span>
                  <input type="number" lang="nl-NL" required min="0" step="any" inputMode="decimal" placeholder="e.g. 2" value={values.quantity} onChange={(event) => update('quantity', event.target.value)} aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? 'quantity-error' : undefined} />
                  {error('quantity')}
                </label>
              </div>
            </fieldset>
          )}
          {values.kind === 'work' && (
            <fieldset>
              <legend>Work details</legend>
              <div className="field-grid">
                <label className="field-label">
                  Work type <span className="required-mark">Required</span>
                  <select value={values.workType} onChange={(event) => update('workType', event.target.value as WorkType | '')} aria-invalid={Boolean(errors.workType)} aria-describedby={errors.workType ? 'workType-error' : undefined}>
                    <option value="">Select work type</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="repair">Repair</option>
                  </select>
                  {error('workType')}
                </label>
                <label className="field-label">
                  Description <span className="required-mark">Required</span>
                  <input required placeholder="e.g. Annual service" value={values.description} onChange={(event) => update('description', event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error' : undefined} />
                  {error('description')}
                </label>
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend>Cost <span className="optional">(optional)</span></legend>
            <div className="field-grid">
              <label className="field-label">
                Amount
                <input type="number" lang="nl-NL" min="0" step="any" inputMode="decimal" placeholder="e.g. 48,50" value={values.costAmount} onChange={(event) => update('costAmount', event.target.value)} aria-invalid={Boolean(errors.costAmount)} aria-describedby={errors.costAmount ? 'costAmount-error' : undefined} />
                {error('costAmount')}
              </label>
              <label className="field-label">
                Currency
                <input value={values.currency} maxLength={3} placeholder="EUR" aria-label="Currency code, defaults to EUR" onChange={(event) => update('currency', event.target.value.toUpperCase())} aria-invalid={Boolean(errors.currency)} aria-describedby={errors.currency ? 'currency-error' : undefined} />
                {error('currency')}
              </label>
            </div>
          </fieldset>
          <label className="field-label notes-field">
            Notes <span className="optional">(optional)</span>
            <textarea rows={3} placeholder="Add a useful reminder or detail" value={values.notes} onChange={(event) => update('notes', event.target.value)} />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={isLoading || Boolean(storageError)} type="submit">{editingId ? 'Save changes' : 'Save record'}</button>
            <span className="form-help">Fields marked “Required” need a value before saving.</span>
          </div>
        </form>
      </section>

      <section className="history" aria-labelledby="history-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Newest first</p>
            <h2 id="history-heading">Record history</h2>
          </div>
          <span className="record-count">{isLoading ? 'Loading records…' : `${formatNumber(records.length)} ${records.length === 1 ? 'record' : 'records'}`}</span>
        </div>
        {isLoading ? (
          <div className="empty-state" role="status">
            <span className="empty-state-icon" aria-hidden="true">⌁</span>
            <div>
              <h3>Initializing browser SQLite</h3>
              <p>Opening your private on-device database. Records will appear when it is ready.</p>
            </div>
          </div>
        ) : storageError ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">!</span>
            <div>
              <h3>Records are unavailable</h3>
              <p>Browser SQLite must initialize successfully before records can be viewed or changed.</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">⌁</span>
            <div>
              <h3>Your riding history starts here</h3>
              <p>Log your first fill-up, part, or workshop visit to build a clear record of your motorcycle’s costs.</p>
            </div>
          </div>
        ) : (
          <ul className="record-list">
            {records.map((record) => (
              <li key={record.id} className="record-item">
                <div className="record-content">
                  <div className="record-heading">
                    <span className={`record-kind kind-${record.kind}`}>{shortLabelForKind(record.kind)}</span>
                    <p className="record-meta">
                      <time dateTime={record.occurredOn}>{formatDate(record.occurredOn)}</time>
                      {record.odometerKm !== undefined && (
                        <><span aria-hidden="true"> · </span>{formatNumber(record.odometerKm)} km</>
                      )}
                    </p>
                  </div>
                  <h3>{recordDetails(record)}</h3>
                  {record.notes && <p className="record-notes">{record.notes}</p>}
                </div>
                <div className="record-side">
                  {formatCost(record) ? <p className="record-cost">{formatCost(record)}</p> : <p className="record-no-cost">No cost added</p>}
                <div className="record-actions">
                  <button className="text-button" type="button" onClick={() => beginEdit(record)}>Edit</button>
                  {confirmingDeleteId === record.id ? (
                    <span className="delete-confirmation" role="group" aria-label={`Delete ${labelForKind(record.kind)} record`}>
                      <span>Delete?</span>
                      <button className="danger-button" type="button" onClick={() => remove(record.id)}>Yes, delete</button>
                      <button className="text-button" type="button" onClick={() => setConfirmingDeleteId(undefined)}>Cancel</button>
                    </span>
                  ) : (
                    <button className="danger-button" type="button" onClick={() => setConfirmingDeleteId(record.id)}>Delete</button>
                  )}
                </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      <section aria-labelledby="expenses-heading" className="history expenses-panel" hidden={activeTab !== 'expenses'} id="expenses-panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Spending over time</p>
            <h2 id="expenses-heading">Monthly expenses</h2>
          </div>
          {currencies.length > 1 && (
            <label className="currency-filter">
              Currency
              <select aria-label="Chart currency" value={activeCurrency} onChange={(event) => setSelectedCurrency(event.target.value)}>
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
          )}
        </div>
        {records.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">⌁</span>
            <div>
              <h3>No records to chart yet</h3>
              <p>Once you log expenses, their monthly breakdown will appear here.</p>
            </div>
          </div>
        ) : chartState === 'no-priced-records' ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">€</span>
            <div>
              <h3>No priced records yet</h3>
              <p>Add a cost to a record to see fuel, parts, and work spending over time.</p>
            </div>
          </div>
        ) : chartState === 'no-priced-records-for-currency' ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">€</span>
            <div>
              <h3>No priced records in {activeCurrency}</h3>
              <p>Choose another currency or add a price to a {activeCurrency} record to chart its spending.</p>
            </div>
          </div>
        ) : (
          <ExpenseChart currency={activeCurrency} expenses={expenses} />
        )}
      </section>

      <section aria-labelledby="about-heading" className="about-panel" hidden={activeTab !== 'about'} id="about-panel">
        <div className="about-hero">
          <div>
            <p className="section-kicker">About this page</p>
            <h2 id="about-heading">A quiet ledger for the road ahead.</h2>
            <p className="about-lead">
              openmotobudget is a local-only motorcycle garage ledger. It helps you
              keep a useful record of fuel, parts, maintenance, and repairs without
              sending your garage history anywhere.
            </p>
          </div>
          <div className="about-badge" aria-hidden="true">
            <span>LOCAL</span>
            <strong>ONLY</strong>
          </div>
        </div>

        <div className="about-grid">
          <article className="about-card">
            <span className="about-card-mark" aria-hidden="true">01</span>
            <h3>Your garage, on your device</h3>
            <p>
              Records are stored in this browser on this device. There is no
              account, shared dashboard, or remote garage database behind this app.
            </p>
          </article>
          <article className="about-card">
            <span className="about-card-mark" aria-hidden="true">02</span>
            <h3>Built for real upkeep</h3>
            <p>
              Capture the small facts that matter later: what you bought, when you
              worked on the bike, how far it had ridden, and what it cost.
            </p>
          </article>
          <article className="about-card">
            <span className="about-card-mark" aria-hidden="true">03</span>
            <h3>Simple by design</h3>
            <p>
              No social feed or sales funnel. Just a private history and a monthly
              view that makes the cost of keeping a motorcycle moving easier to see.
            </p>
          </article>
        </div>

        <div className="about-boundary">
          <span className="about-boundary-icon" aria-hidden="true">✓</span>
          <p><strong>Local storage is the boundary.</strong> Clearing this browser’s site data can remove your records, so keep a separate copy if the history is important to you.</p>
        </div>

        <section className="backup-tools" aria-labelledby="backup-heading">
          <div>
            <h3 id="backup-heading">Back up your garage ledger</h3>
            <p>Save all records to a JSON file, or restore a backup made by this app.</p>
          </div>
          <div className="backup-actions">
            <button className="text-button" disabled={isBackupBusy || Boolean(storageError)} onClick={() => void exportBackup()} type="button">
              Export records
            </button>
            <input accept="application/json,.json" className="sr-only" onChange={(event) => void selectBackup(event)} ref={importInputRef} type="file" />
            <button className="text-button" disabled={isBackupBusy || Boolean(storageError)} onClick={() => importInputRef.current?.click()} type="button">
              Import backup
            </button>
          </div>
          {backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}
          {pendingBackup && (
            <div className="backup-confirmation" role="alert">
              <p><strong>{pendingBackup.records.length} {pendingBackup.records.length === 1 ? 'record is' : 'records are'} ready to import.</strong> This replaces the {records.length} {records.length === 1 ? 'record' : 'records'} currently stored on this device.</p>
              <div className="backup-actions">
                <button className="primary-button" disabled={isBackupBusy} onClick={() => void importBackup()} type="button">Replace and import</button>
                <button className="text-button" disabled={isBackupBusy} onClick={() => setPendingBackup(undefined)} type="button">Cancel</button>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
