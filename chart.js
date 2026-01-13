const inputWeight = document.getElementById("input-weight")
const saveBtn = document.getElementById("save-btn")
const todayWeight = document.getElementById("today-weight");
const weightToGoal = document.getElementById("weight-to-goal");
const todayWeightChange = document.getElementById("today-weight-change");
const thisWeekWeightChange = document.getElementById("this-week-weight-change");
const thisMonthWeightChange = document.getElementById("this-month-weight-change");


// Initialize bottom-sheet handlers early so UI still works even if chart setup fails
(function initBottomSheetHandlers(){
  try {
    const openBtn = document.getElementById('open-bottom-sheet')
    const overlayEl = document.getElementById('overlay')
    if (!openBtn || !overlayEl) return
    openBtn.addEventListener('click', () => {
      overlayEl.style.display = 'flex'
      openBtn.style.display = 'none'
    })
    overlayEl.addEventListener('click', (event) => {
      if (event.target === overlayEl) {
        overlayEl.style.display = 'none'
        openBtn.style.display = 'block'
      }
    })
  } catch (e) {
    console.warn('Bottom sheet init failed', e)
  }
})()

const ctx = document.getElementById('weight-chart').getContext('2d')

// Storage key for persisted entries
const STORAGE_KEY = 'weight-tracker-entries-v1'

// Defaults (MM/DD labels and values) — converted to ISO when used
const DEFAULT_LABELS = ['01/01', '01/02', '01/03']
const DEFAULT_DATA = [65, 64.5, 64.2]

// Create the chart with empty data; we'll populate from storage (or defaults)
const myChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Weight',
      data: [],
      borderColor: '#666',
      borderWidth:1,
      showLine:true,
      borderDash: [4, 4],
      backgroundColor: '#666',
      pointBackgroundColor: '#666',
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context => `${context.parsed.y}kg`
        }
      }
    },
    scales: {
      x: {
        title: { display: false, text: 'Date'},
        ticks: { autoSkip: true, maxRotation: 45},
        grid: {display:false}
      },
      y: {
        beginAtZero: false,
        title: { display: false, text: 'Weight (kg)'},
        grid: {display:false},
        suggestedMin: 55,
        suggestedMax: 66
      }
    }
  }
})

// Helpers to persist entries as [{iso: 'YYYY-MM-DD', weight: number}, ...]
function labelsToEntries(labels, data) {
  const year = new Date().getFullYear();
  return labels.map((lbl, i) => {
    const [m, d] = lbl.split('/');
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    return { iso: `${year}-${mm}-${dd}`, weight: data[i] }
  })
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { console.warn('Failed to parse stored entries', e) }
  return labelsToEntries(DEFAULT_LABELS, DEFAULT_DATA)
}

function saveEntries(entries) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch (e) { console.warn('Failed to save entries', e) }
}

function renderChartFromEntries(entries) {
  // Chart labels should always show the date (MM/DD or MM/DD/YYYY),
  // while the bottom-sheet button can show 'Today'. Use a separate formatter.
  myChart.data.labels = entries.map(e => formatChartLabel(e.iso))
  myChart.data.datasets[0].data = entries.map(e => e.weight)
  myChart.update()
}

// Always format date for chart labels (never return 'Today')
function formatChartLabel(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const nowYear = new Date().getFullYear();
  const optsNoYear = { month: '2-digit', day: '2-digit' };
  const optsWithYear = { month: '2-digit', day: '2-digit', year: 'numeric' };
  const fmt = new Intl.DateTimeFormat(undefined, Number(y) === nowYear ? optsNoYear : optsWithYear);
  return fmt.format(dateObj);
}

// Initialize
let entries = loadEntries()
// Ensure entries are sorted by date ascending
function sortEntries() {
  entries.sort((a, b) => a.iso.localeCompare(b.iso))
}
sortEntries()
renderChartFromEntries(entries)
updateSummaryStats(entries)


const dateBtn = document.getElementById("date-btn");
const datePicker = document.getElementById("date-picker");

dateBtn.addEventListener('click', ()=> {
  if ('showPicker' in HTMLInputElement.prototype) {
    datePicker.showPicker();
  } else {
    datePicker.click();
  }

  console.log('Date picker opened');
})

// Helper: return local YYYY-MM-DD for a Date
function toLocalISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Set date picker limits and default to today (local)
const todayLocalISO = toLocalISO(new Date())
if (datePicker) {
  datePicker.max = todayLocalISO
  if (!datePicker.value) datePicker.value = todayLocalISO
  dateBtn.textContent = formatSelectedDate(datePicker.value)
}

// Format an ISO date string (YYYY-MM-DD) for display.
// Shows month/day for current-year dates, includes year otherwise.
function formatSelectedDate(isoDate) {
  if (!isoDate) return '';
  // If isoDate is local today, show 'Today'
  const todayLocal = (function(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`
  })()
  if (isoDate === todayLocal) return 'Today'

  const [y, m, d] = isoDate.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const nowYear = new Date().getFullYear();
  const optsNoYear = { month: '2-digit', day: '2-digit' };
  const optsWithYear = { month: '2-digit', day: '2-digit', year: 'numeric' };
  const fmt = new Intl.DateTimeFormat(undefined, Number(y) === nowYear ? optsNoYear : optsWithYear);
  return fmt.format(dateObj);
}

datePicker.addEventListener('change', (e) => {
  const selectedDate = e.target.value; // YYYY-MM-DD
  if (selectedDate) {
    dateBtn.textContent = formatSelectedDate(selectedDate);
  }
})

// Animate text change for summary values
function animateTextChange(el, newText, delayMs = 0) {
  if (!el) return
  const oldText = el.textContent || ''
  if (oldText === newText) return
  // Cancel any prior scheduled animations on this element so they don't
  // interrupt the current run (prevents jumps when called repeatedly).
  if (el._changeAnimTimers) {
    el._changeAnimTimers.forEach(id => clearTimeout(id))
    el._changeAnimTimers = null
  }

  // run the animation after the optional delay
  const startTimer = setTimeout(() => {
    // Ensure the element uses the change-anim class
    el.classList.add('change-anim')

    // remember previous display so we can restore it later
    const prevDisplay = el.style.display || ''
    if (!el.style.display) el.style.display = 'inline-block'

    const oldSpan = document.createElement('span')
    oldSpan.className = 'change-value old'
    oldSpan.textContent = oldText

    const newSpan = document.createElement('span')
    newSpan.className = 'change-value new'
    newSpan.textContent = newText

    // Clear and append spans
    el.innerHTML = ''
    el.appendChild(oldSpan)
    el.appendChild(newSpan)

    // Use double RAF and a timed delay so the `.new` starting transform/opacity
    // is applied before we add `.enter`. This reliably triggers the transition.
    requestAnimationFrame(() => {
      // ensure initial styles are flushed
      void newSpan.offsetWidth;
      newSpan.getBoundingClientRect()
      oldSpan.classList.add('exit')

      const oldDur = parseFloat(getComputedStyle(oldSpan).transitionDuration || '0.2') * 1000
      const newDur = parseFloat(getComputedStyle(newSpan).transitionDuration || '0.2') * 1000
      const enterDelay = Math.max(20, Math.floor(oldDur / 2))

      const enterTimer = setTimeout(() => {
        requestAnimationFrame(() => {
          newSpan.classList.add('enter')
        })
      }, enterDelay)

      // cleanup after the longer of the two transitions finishes
      const cleanupAfter = Math.max(isNaN(oldDur) ? 200 : oldDur, isNaN(newDur) ? 200 : newDur) + 40
      const cleanupTimer = setTimeout(() => {
        el.classList.remove('change-anim')
        el.textContent = newText
        // restore any inline display style
        if (prevDisplay) el.style.display = prevDisplay
        else el.style.removeProperty('display')
        // clear timers record
        if (el._changeAnimTimers) {
          el._changeAnimTimers.forEach(id => clearTimeout(id))
          el._changeAnimTimers = null
        }
      }, cleanupAfter)

      // remember timers so future calls can cancel them
      el._changeAnimTimers = [enterTimer, cleanupTimer]
    })
  }, delayMs)
  // also store the start timer so it can be cancelled
  if (!el._changeAnimTimers) el._changeAnimTimers = []
  el._changeAnimTimers.push(startTimer)
}


function updateMyChart(value, isoDate) {
  const dateISO = isoDate || new Date().toISOString().slice(0, 10);
  const entry = { iso: dateISO, weight: value };
  // Replace existing entry for same date, otherwise append
  const idx = entries.findIndex(e => e.iso === dateISO)
  if (idx >= 0) {
    entries[idx].weight = value
  } else {
    entries.push(entry)
  }
  sortEntries()
  saveEntries(entries)
  renderChartFromEntries(entries)
  updateSummaryStats(entries)
}


saveBtn.addEventListener('click', function(){
  const newWeight = parseFloat(inputWeight.value);

  if (isNaN(newWeight)){
    alert("Please enter valid number :p")
    return;
  }
  // pass the selected date (ISO) so the chart label matches the picker
  const selectedISO = datePicker.value || new Date().toISOString().slice(0,10);
  updateMyChart(newWeight, selectedISO);
  inputWeight.value='';

  if (newWeight) {
    // summary will be updated by updateSummaryStats called from updateMyChart
  }
})

// Open/dismiss bottom sheet handled in initBottomSheetHandlers()

// Update changes in weight based on input weights

function findEntryOnOrBefore(dateISO) {
  // assumes entries sorted ascending
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].iso <= dateISO) return entries[i]
  }
  return null
}

function findEntryOnOrAfter(dateISO) {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].iso >= dateISO) return entries[i]
  }
  return null
}

function formatDelta(delta) {
  const rounded = Math.abs(delta).toFixed(1)
  // show sign for negative values, show + for positive change
  if (delta > 0) return `+${rounded}kg`
  return `${(delta === 0 ? '0.0' : '-'+rounded)}kg`
}

function updateSummaryStats(entriesArr) {
  if (!entriesArr || entriesArr.length === 0) {
    // No entries: animate summary fields to a zero/empty state so cleared
    // state persists visually after page reloads.
    const STAGGER_MS = 40;
    const zeroText = '0.0kg'
    const staggerOrder = [
      { el: todayWeight, text: zeroText },
      { el: weightToGoal, text: zeroText },
      { el: document.getElementById('total-weight-change'), text: zeroText },
      { el: todayWeightChange, text: zeroText },
      { el: thisWeekWeightChange, text: zeroText },
      { el: thisMonthWeightChange, text: zeroText }
    ]
    staggerOrder.forEach((item, idx) => {
      if (!item.el) return
      animateTextChange(item.el, item.text, idx * STAGGER_MS)
    })
    return
  }
  // ensure sorted
  entriesArr.sort((a,b) => a.iso.localeCompare(b.iso))
  const first = entriesArr[0]
  const latest = entriesArr[entriesArr.length - 1]

  // Today's weight and goal (values will be animated in a stagger after deltas computed)
  const goal = 55

  // Today change: compare to yesterday if available, else previous entry if any
  // Use local today as primary reference; fall back to latest if no today's entry
  const todayISO = toLocalISO(new Date())
  let todayEntry = entriesArr.find(e => e.iso === todayISO) || latest

  // Yesterday reference (local)
  const yesterdayDate = new Date(todayISO)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yISO = toLocalISO(yesterdayDate)
  let refToday = entriesArr.find(e => e.iso === yISO) || null
  if (!refToday) {
    // fallback to previous entry before 'todayEntry'
    const idxToday = entriesArr.findIndex(e => e.iso === todayEntry.iso)
    refToday = (idxToday > 0) ? entriesArr[idxToday - 1] : todayEntry
  }
  const todayDelta = +(todayEntry.weight - refToday.weight)

  // This week change: compare to Monday of the latest's week
  // This week: base on local today
  const todayDate = new Date(todayISO)
  const dayIndex = todayDate.getDay()
  const daysSinceMonday = (dayIndex + 6) % 7
  const monday = new Date(todayDate)
  monday.setDate(todayDate.getDate() - daysSinceMonday)
  const mondayISO = toLocalISO(monday)
  let refWeek = entriesArr.find(e => e.iso >= mondayISO) || entriesArr.find(e => e.iso <= mondayISO) || todayEntry
  const weekDelta = +(todayEntry.weight - refWeek.weight)

  // This month change: compare to first day of latest's month
  // This month: base on local today
  const firstOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  const firstOfMonthISO = toLocalISO(firstOfMonth)
  let refMonth = entriesArr.find(e => e.iso >= firstOfMonthISO) || entriesArr.find(e => e.iso <= firstOfMonthISO) || todayEntry
  const monthDelta = +(todayEntry.weight - refMonth.weight)

  // Now apply staggered animations from top-left -> bottom-right
  const STAGGER_MS = 40;
  const staggerOrder = [
    { el: todayWeight, text: `${todayEntry.weight}kg` },
    { el: weightToGoal, text: `${Math.abs((todayEntry.weight - goal)).toFixed(1)}kg` },
    { el: document.getElementById('total-weight-change'), text: `${(latest.weight - first.weight).toFixed(1)}kg` },
    { el: todayWeightChange, text: formatDelta(todayDelta) },
    { el: thisWeekWeightChange, text: formatDelta(weekDelta) },
    { el: thisMonthWeightChange, text: formatDelta(monthDelta) }
  ]

  staggerOrder.forEach((item, idx) => {
    if (!item.el || typeof item.text === 'undefined') return
    animateTextChange(item.el, item.text, idx * STAGGER_MS)
  })
}

// Clear all stored entries and reset chart + animated summary to empty state
function clearAllEntries() {
  entries = []
  saveEntries(entries)
  renderChartFromEntries(entries)

  // Animate summary values to an empty/zero state using same stagger
  const STAGGER_MS = 40;
  const zeroText = '0.0kg'
  const staggerOrder = [
    { el: todayWeight, text: zeroText },
    { el: weightToGoal, text: zeroText },
    { el: document.getElementById('total-weight-change'), text: zeroText },
    { el: todayWeightChange, text: zeroText },
    { el: thisWeekWeightChange, text: zeroText },
    { el: thisMonthWeightChange, text: zeroText }
  ]

  staggerOrder.forEach((item, idx) => {
    if (!item.el) return
    animateTextChange(item.el, item.text, idx * STAGGER_MS)
  })
}

// Expose to global so UI-level handlers can call it
window.clearAllEntries = clearAllEntries