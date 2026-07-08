const inputWeight = document.getElementById("input-weight")
const saveBtn = document.getElementById("save-btn")
const todayWeight = document.getElementById("today-weight");
const todayWeightChange = document.getElementById("today-weight-change");
const thisWeekWeightChange = document.getElementById("this-week-weight-change");
const thisMonthWeightChange = document.getElementById("this-month-weight-change");
const bottomSheetTitle = document.getElementById("bottom-sheet-title");
const editDeleteContainer = document.getElementById("edit-delete-container");
const editBtn = document.getElementById("edit-btn");
const deleteBtn = document.getElementById("delete-btn");
const weatherIconEl = document.getElementById('weather-icon');

const WEATHER_CODE_EMOJI = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌧️',
  57: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '🌨️',
  77: '🌨️',
  80: '🌧️',
  81: '🌧️',
  82: '⛈️',
  85: '❄️',
  86: '❄️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️'
};

const WEATHER_CODE_LABEL = {
  0: 'Clear',
  1: 'Sunny',
  2: 'Mostly sunny',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Light rain',
  55: 'Rain',
  56: 'Freezing drizzle',
  57: 'Freezing rain',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Snow',
  77: 'Snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Thunderstorm',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm'
};

function mapWeatherCodeToEmoji(code) {
  return WEATHER_CODE_EMOJI[code] || '🌈';
}

function mapWeatherCodeToLabel(code) {
  return WEATHER_CODE_LABEL[code] || 'Weather';
}

async function getLocationFromIp() {
  const response = await fetch('https://ipapi.co/json/');
  if (!response.ok) throw new Error('IP location lookup failed');
  const data = await response.json();
  return { lat: Number(data.latitude), lon: Number(data.longitude) };
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      getLocationFromIp().then(resolve).catch(reject);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      async () => {
        try {
          const location = await getLocationFromIp();
          resolve(location);
        } catch (error) {
          reject(error);
        }
      },
      { timeout: 10000 }
    );
  });
}

async function fetchWeather(lat, lon) {
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
  if (!response.ok) throw new Error('Weather API request failed');
  return response.json();
}

async function initWeather() {
  if (!weatherIconEl) return;

  try {
    const { lat, lon } = await getGeolocation();
    const weatherData = await fetchWeather(lat, lon);
    const current = weatherData.current_weather;
    const code = current?.weathercode;

    weatherIconEl.textContent = mapWeatherCodeToEmoji(code);
  } catch (error) {
    weatherIconEl.textContent = '☁️';
    console.warn('Weather init failed', error);
  }
}


// Initialize bottom-sheet handlers early so UI still works even if chart setup fails
(function initBottomSheetHandlers(){
  try {
    const openBtn = document.getElementById('open-bottom-sheet')
    const goalEditBtn = document.getElementById('goal-weight-edit-btn')
    const overlayEl = document.getElementById('overlay')
    const actionBar = document.querySelector('.action-bar')
    if (!openBtn || !overlayEl) return
    
    openBtn.addEventListener('click', () => {
      // Add mode - clear selection state
      activeDot = null;
      bottomSheetMode = 'add'
      bottomSheetTitle.textContent = 'Add a record';
      inputWeight.value = '';
      datePicker.value = toLocalISO(new Date());
      dateBtn.textContent = 'Today';
      if (actionBar) actionBar.classList.remove('goal-mode')
      if (datePicker) datePicker.style.display = 'none';
      if (dateBtn) dateBtn.style.display = 'block';
      overlayEl.style.display = 'flex'
      openBtn.style.display = 'none'
    })
    
    // Goal weight edit button handler
    if (goalEditBtn) {
      goalEditBtn.addEventListener('click', () => {
        bottomSheetMode = 'edit-goal'
        bottomSheetTitle.textContent = 'Edit goal weight';
        inputWeight.value = goal.toString();
        if (datePicker) datePicker.style.display = 'none'; // Hide date picker for goal weight
        if (dateBtn) dateBtn.style.display = 'none';
        if (actionBar) actionBar.classList.add('goal-mode')
        overlayEl.style.display = 'flex'
        // Focus the input for better UX
        setTimeout(() => inputWeight.focus(), 100)
      })
    }
    
    overlayEl.addEventListener('click', (event) => {
      if (event.target === overlayEl) {
        overlayEl.style.display = 'none'
        // Reset date picker visibility
        if (datePicker) datePicker.style.display = 'none';
        if (dateBtn) dateBtn.style.display = 'block';
        if (actionBar) actionBar.classList.remove('goal-mode')
        if (activeDot === null) {
          openBtn.style.display = 'block'
        }
        // Don't re-show edit/delete buttons - they're already visible if entry is selected
      }
    })
  } catch (e) {
    console.warn('Bottom sheet init failed', e)
  }
})()

// Edit and Delete button handlers
editBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (activeDot >= 0 && activeDot < entries.length) {
    const entry = entries[activeDot];
    bottomSheetTitle.textContent = 'Edit a record';
    inputWeight.value = entry.weight;
    datePicker.value = entry.iso;
    dateBtn.textContent = formatSelectedDate(entry.iso);
    const overlayEl = document.getElementById('overlay');
    overlayEl.style.display = 'flex';
    editDeleteContainer.style.display = 'none';
    editDeleteContainer.classList.remove('show');
  }
});

deleteBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (activeDot >= 0 && activeDot < entries.length) {
    entries.splice(activeDot, 1);
    saveEntries(entries);
    renderChartFromEntries(entries);
    updateSummaryStats(entries);
    deselectEntry();
  }
});

// CASE B: Tap Outside Touch Area
// Dismiss buttons when clicking outside any dot
document.addEventListener('click', (event) => {
  // Don't dismiss if we're clicking on a chart data point
  if (isClickingChart) {
    return;
  }
  
  // Don't dismiss if clicking on edit/delete buttons
  if (editDeleteContainer && editDeleteContainer.contains(event.target)) {
    return;
  }
  
  // Handle outside tap (state machine)
  handleOutsideTap();
});

// Storage keys for persisted entries and goal weight
const STORAGE_KEY = 'weight-tracker-entries-v1'
const GOAL_STORAGE_KEY = 'weight-tracker-goal-v1'

// Defaults (MM/DD labels and values) — converted to ISO when used
const DEFAULT_LABELS = ['01/01', '01/02', '01/03']
const DEFAULT_DATA = [65, 64.5, 64.2]
const DEFAULT_GOAL = 55

// Get chart context
const ctx = document.getElementById('weight-chart').getContext('2d')

// Load goal early so it's available for the chart plugin
let goal = loadGoal()

// Custom plugin to draw goal line with label
const goalLinePlugin = {
  id: 'goalLine',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const yAxis = chart.scales.y;
    const xAxis = chart.scales.x;

    if (!yAxis || !xAxis || typeof goal === 'undefined') return;

    const goalPixelY = yAxis.getPixelForValue(goal);

    // 1. 准备文本和图标数据
    const labelColor = 'hsl(243,75%,59%)';
    const textStr = `Goal: ${goal}kg`;
    const iconStr = '\ue153'; // Material "flag" 图标的 Unicode 编码
    const spacing = 2;        // 图标与文字的间距

    // 2. 测量尺寸
    ctx.font = 'bold 8px "Poppins", sans-serif';
    const textWidth = ctx.measureText(textStr).width;
    const textHeight = 8;

    // 测量图标宽度（图标字号通常与文本对齐或略大，这里设为 10px 保证视觉比例）
    const iconFontSize = 12;
    ctx.font = `${iconFontSize}px "Material Symbols Outlined"`;
    const iconWidth = ctx.measureText(iconStr).width;

    // 计算右侧组件的总宽度 (图标 + 间距 + 文字)
    const totalWidth = iconWidth + spacing + textWidth;

    // 3. 绘制虚线（让虚线刚好连接到图标的左侧）
    ctx.strokeStyle = 'hsl(224, 16%, 72%)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(xAxis.left, goalPixelY);
    ctx.lineTo(xAxis.right - totalWidth, goalPixelY); // 虚线终点完美对齐图标左侧
    ctx.stroke();
    ctx.setLineDash([]); // 恢复实线

    // 4. 坐标定位（从虚线终点向右依次排列）
    const iconX = xAxis.right - totalWidth;
    const textX = iconX + iconWidth + spacing;

    // 垂直居中计算
    const iconY = goalPixelY + (iconFontSize / 2) - 2; // 修正图标基线
    const textY = goalPixelY + (textHeight / 2) - 1;   // 修正文字基线

    // 5. 绘制 "flag" 图标
    ctx.fillStyle = labelColor;
    ctx.font = `${iconFontSize}px "Material Symbols Outlined", "Material Icons"`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle'; // 使用居中基线简化对齐
    ctx.fillText(iconStr, iconX, iconY);

    // 6. 绘制文字
    ctx.font = 'bold 8px "Poppins", sans-serif';
    ctx.fillText(textStr, textX, textY);

    // 良好习惯：重置 Canvas 基线状态
    ctx.textBaseline = 'alphabetic';
  }
};

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
      tension: 0.1,
      pointRadius: 3,
      pointHoverRadius: 4,
      pointHitRadius: 24,
      hoverRadius: 24
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
    interaction: {
      mode: 'nearest',
      intersect: true
    },
    scales: {
      x: {
        title: { display: false, text: 'Date'},
        ticks: { autoSkip: true, maxRotation: 45, maxTicksLimit: 10 },
        grid: {display:false}
      },
      y: {
        beginAtZero: false,
        title: { display: false, text: 'Weight (kg)'},
        grid: {display:false},
        min: Math.max(goal - 5, 50), // Ensure goal line is visible with 5kg padding below
        max: goal + 11
      }
    },
    onClick: (event, elements) => {
      if (suppressNextChartClick) {
        suppressNextChartClick = false;
        return;
      }
      // Mark that we're clicking on chart data (prevents document listener from dismissing)
      isClickingChart = true;

      if (elements.length > 0) {
        const dataIndex = elements[0].index;
        handleDotTap(visibleRangeStart + dataIndex); // Use state machine with the actual entry index
      }

      // Reset flag after handler completes
      setTimeout(() => {
        isClickingChart = false;
      }, 0);
    }
  },
  plugins: [goalLinePlugin]
})

const MAX_VISIBLE_POINTS = 10;
let visibleRangeStart = 0;
let isDraggingChart = false;
let dragStartX = 0;
let dragStartIndex = 0;
let suppressNextChartClick = false;

function clampVisibleRangeStart(entriesCount, startIndex) {
  const maxStart = Math.max(0, entriesCount - MAX_VISIBLE_POINTS);
  return Math.min(Math.max(startIndex, 0), maxStart);
}

function updateChartViewport(entriesArr = entries) {
  const sortedEntries = [...entriesArr].sort((a, b) => a.iso.localeCompare(b.iso));
  const count = sortedEntries.length;

  if (count <= MAX_VISIBLE_POINTS) {
    visibleRangeStart = 0;
  } else {
    visibleRangeStart = clampVisibleRangeStart(count, visibleRangeStart);
  }

  const visibleEntries = sortedEntries.slice(visibleRangeStart, visibleRangeStart + MAX_VISIBLE_POINTS);
  myChart.data.labels = visibleEntries.map(e => formatChartLabel(e.iso));
  myChart.data.datasets[0].data = visibleEntries.map(e => e.weight);
  myChart.options.scales.x.ticks.maxTicksLimit = MAX_VISIBLE_POINTS;

  if (activeDot !== null && (activeDot < visibleRangeStart || activeDot >= visibleRangeStart + visibleEntries.length)) {
    activeDot = null;
    const openBtn = document.getElementById('open-bottom-sheet');
    const actionBar = document.querySelector('.action-bar');
    if (openBtn) {
      openBtn.style.display = 'block';
      openBtn.classList.remove('scale-down');
    }
    if (editDeleteContainer) {
      editDeleteContainer.classList.remove('show');
      editDeleteContainer.style.display = 'none';
    }
    if (actionBar) actionBar.classList.remove('goal-mode');
  }

  myChart.update();
  return visibleEntries;
}

const chartCanvas = myChart.canvas;
chartCanvas.style.touchAction = 'none';
chartCanvas.style.cursor = 'grab';
chartCanvas.style.userSelect = 'none';

chartCanvas.addEventListener('pointerdown', (event) => {
  isDraggingChart = true;
  isClickingChart = true;
  dragStartX = event.clientX;
  dragStartIndex = visibleRangeStart;
  chartCanvas.setPointerCapture(event.pointerId);
  chartCanvas.style.cursor = 'grabbing';
});

chartCanvas.addEventListener('pointermove', (event) => {
  if (!isDraggingChart) return;

  const deltaX = event.clientX - dragStartX;
  const pixelPerPoint = Math.max(24, chartCanvas.clientWidth / Math.max(1, MAX_VISIBLE_POINTS - 1));
  const stepDelta = Math.round(deltaX / pixelPerPoint);

  if (stepDelta === 0) return;

  const maxStart = Math.max(0, entries.length - MAX_VISIBLE_POINTS);
  const nextStart = Math.min(Math.max(dragStartIndex + stepDelta, 0), maxStart);

  if (nextStart !== visibleRangeStart) {
    visibleRangeStart = nextStart;
    updateChartViewport(entries);
    suppressNextChartClick = true;
  }

  dragStartX = event.clientX;
  dragStartIndex = visibleRangeStart;
});

function stopChartDrag(event) {
  if (!isDraggingChart) return;

  isDraggingChart = false;
  chartCanvas.style.cursor = 'grab';
  setTimeout(() => {
    isClickingChart = false;
  }, 0);

  if (event?.pointerId != null) {
    try {
      chartCanvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Ignore release errors when the pointer is no longer captured
    }
  }
}

chartCanvas.addEventListener('pointerup', stopChartDrag);
chartCanvas.addEventListener('pointerleave', stopChartDrag);
chartCanvas.addEventListener('pointercancel', stopChartDrag);

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

function loadGoal() {
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_KEY)
    if (raw) return parseFloat(raw)
  } catch (e) { console.warn('Failed to parse stored goal', e) }
  return DEFAULT_GOAL
}

function saveGoal(goal) {
  try { localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal)) } catch (e) { console.warn('Failed to save goal', e) }
}

function renderChartFromEntries(entries) {
  return updateChartViewport(entries)
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
let bottomSheetMode = 'add' // 'add', 'edit', or 'edit-goal'
// Ensure entries are sorted by date ascending
function sortEntries() {
  entries.sort((a, b) => a.iso.localeCompare(b.iso))
}
sortEntries()
renderChartFromEntries(entries)
updateSummaryStats(entries)

/**
 * STATE MACHINE: Interactive Dot Selection
 * 
 * States:
 * - activeDot = null (no dot selected, "Add" button visible)
 * - activeDot = index (dot selected, "Edit/Delete" buttons visible)
 */
let activeDot = null; // null | index
let lastStateChangeTime = 0; // Timestamp of last state transition
let isAnimating = false; // Prevent overlapping animations
let isClickingChart = false; // Flag for chart click detection
let pendingAnimationTimers = []; // Track animation timers for cancellation
const DISMISS_DELAY_MS = 50; // Reduced from 300ms for snappier interaction (<100ms)

/**
 * Cancel any pending animation timers
 * Allows new taps to immediately interrupt previous animations
 */
function cancelPendingAnimations() {
  pendingAnimationTimers.forEach(timerId => clearTimeout(timerId));
  pendingAnimationTimers = [];
  isAnimating = false;
}

/**
 * Helper to schedule and track animation timers
 * Allows cancellation of animations mid-flight
 */
function scheduleAnimationStep(callback, delay) {
  const timerId = setTimeout(callback, delay);
  pendingAnimationTimers.push(timerId);
  return timerId;
}

/**
 * CASE A: Tap on a Dot
 * Input: dataIndex from chart click
 * State transitions:
 *   - activeDot === dataIndex: IDEMPOTENT - do nothing
 *   - activeDot === null: TRANSITION_SHOW - add→edit/delete animation
 *   - activeDot !== dataIndex: TRANSITION_SWITCH - scale down/up animation
 */
function handleDotTap(dataIndex) {
  // IDEMPOTENT CHECK: Same dot tapped again
  if (activeDot === dataIndex) {
    return; // Exit immediately, no action
  }
  
  // If switching during animation, cancel previous animation immediately
  if (isAnimating) {
    cancelPendingAnimations();
  }
  
  // TRANSITION: Activating first dot (null → dataIndex)
  if (activeDot === null) {
    activeDot = dataIndex; // State reset happens immediately
    lastStateChangeTime = Date.now();
    animateShowButtons();
    return;
  }
  
  // TRANSITION: Switching to different dot (oldIndex → newIndex)
  if (activeDot !== null && activeDot !== dataIndex) {
    activeDot = dataIndex; // State reset happens immediately
    lastStateChangeTime = Date.now();
    animateSwitchButtons();
    return;
  }
}

/**
 * CASE B: Tap Outside Touch Area
 * Input: click event outside any dot
 * State transitions:
 *   - activeDot !== null: TRANSITION_HIDE - edit/delete→add animation
 *   - activeDot === null: do nothing
 */
function handleOutsideTap() {
  if (activeDot === null) {
    return; // Already in idle state, nothing to do
  }
  
  // Only allow dismiss if enough time has passed (reduce to 50ms for snappier feel)
  const timeSinceStateChange = Date.now() - lastStateChangeTime;
  if (timeSinceStateChange >= DISMISS_DELAY_MS) {
    activeDot = null; // State reset happens immediately
    lastStateChangeTime = Date.now();
    animateHideButtons();
  }
}

/**
 * Animation 1: Show Buttons (Add → Edit/Delete)
 * Triggered when: activeDot transitions from null to an index
 * Duration: ~200ms (snappy)
 */
function animateShowButtons() {
  if (isAnimating) return;
  isAnimating = true;
  
  const openBtn = document.getElementById('open-bottom-sheet');
  openBtn.classList.add('scale-down');
  
  scheduleAnimationStep(() => {
    editDeleteContainer.style.display = 'flex';
    scheduleAnimationStep(() => {
      editDeleteContainer.classList.add('show');
    }, 5); // Reduced from 10ms
    scheduleAnimationStep(() => {
      openBtn.style.display = 'none';
      isAnimating = false;
      pendingAnimationTimers = [];
    }, 200); // Reduced from 250ms for faster response
  }, 60); // Reduced from 100ms
}

/**
 * Animation 2: Hide Buttons (Edit/Delete → Add)
 * Triggered when: activeDot transitions from an index to null
 * Duration: ~200ms (snappy)
 */
function animateHideButtons() {
  if (isAnimating) return;
  isAnimating = true;
  
  const openBtn = document.getElementById('open-bottom-sheet');
  editDeleteContainer.classList.remove('show');
  
  scheduleAnimationStep(() => {
    openBtn.style.display = 'block';
    scheduleAnimationStep(() => {
      openBtn.classList.remove('scale-down');
    }, 5); // Reduced from 10ms
  }, 60); // Reduced from 100ms
  
  scheduleAnimationStep(() => {
    editDeleteContainer.style.display = 'none';
    isAnimating = false;
    pendingAnimationTimers = [];
  }, 220); // Reduced from 300ms
}

/**
 * Animation 3: Switch Buttons (Index A → Index B)
 * Triggered when: activeDot transitions from one index to another
 * Behavior: Scale down/up animation (snappy scale)
 * Duration: ~160ms (fastest, allows immediate next tap)
 */
function animateSwitchButtons() {
  if (isAnimating) return;
  isAnimating = true;
  
  editDeleteContainer.classList.remove('show');
  
  scheduleAnimationStep(() => {
    editDeleteContainer.classList.add('show');
    scheduleAnimationStep(() => {
      isAnimating = false;
      pendingAnimationTimers = [];
    }, 160); // Reduced from 250ms
  }, 5); // Reduced from 10ms
}

/**
 * Legacy selector mapping for edit/delete functions
 * (Used by edit and delete button handlers)
 */
function getSelectedEntryIndex() {
  return activeDot;
}

function setSelectedEntryIndex(index) {
  activeDot = index;
}

function deselectEntry() {
  if (activeDot === null) return;
  handleOutsideTap(); // Use the state machine instead
}


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
  
  // Handle different bottom sheet modes
  if (bottomSheetMode === 'edit-goal') {
    // Edit goal weight mode
    goal = newWeight
    saveGoal(goal)
    updateGoalWeightDisplay()
    updateSummaryStats(entries)
  } else if (activeDot !== null && activeDot >= 0) {
    // Edit mode: update the selected entry
    const selectedISO = datePicker.value || new Date().toISOString().slice(0,10);
    const oldISO = entries[activeDot].iso;
    entries[activeDot].weight = newWeight;
    entries[activeDot].iso = selectedISO;
    sortEntries();
    saveEntries(entries);
    renderChartFromEntries(entries);
    updateSummaryStats(entries);
    // Find the new index after sorting
    const newIndex = entries.findIndex(e => e.iso === selectedISO && e.weight === newWeight);
    if (newIndex >= 0) {
      activeDot = newIndex;
    } else {
      // If not found (shouldn't happen), deselect
      activeDot = null;
    }
  } else {
    // Add mode: use existing logic
    const selectedISO = datePicker.value || new Date().toISOString().slice(0,10);
    updateMyChart(newWeight, selectedISO);
  }
  
  inputWeight.value='';

  // Close the bottom sheet
  const overlayEl = document.getElementById('overlay');
  overlayEl.style.display = 'none';
  bottomSheetMode = 'add'
  const openBtn = document.getElementById('open-bottom-sheet');
  if (activeDot === null) {
    openBtn.style.display = 'block';
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

function updateGoalWeightDisplay() {
  const goalWeightEl = document.getElementById('goal-weight-value');
  if (goalWeightEl) {
    animateTextChange(goalWeightEl, `${goal}kg`);
  }
  // Update the chart to reflect the new goal weight
  if (myChart) {
    myChart.options.scales.y.min = Math.max(goal - 5, 50);
    myChart.options.scales.y.max = goal + 11;
    myChart.update();
  }
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
      { el: document.getElementById('total-weight-change'), text: zeroText },
      { el: todayWeightChange, text: zeroText },
      { el: thisWeekWeightChange, text: zeroText },
      { el: thisMonthWeightChange, text: zeroText }
    ]
    staggerOrder.forEach((item, idx) => {
      if (!item.el) return
      animateTextChange(item.el, item.text, idx * STAGGER_MS)
    })
    updateGoalWeightDisplay()
    return
  }
  // ensure sorted
  entriesArr.sort((a,b) => a.iso.localeCompare(b.iso))
  const first = entriesArr[0]
  const latest = entriesArr[entriesArr.length - 1]

  // Today's weight
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
    { el: document.getElementById('total-weight-change'), text: `${(latest.weight - first.weight).toFixed(1)}kg` },
    { el: todayWeightChange, text: formatDelta(todayDelta) },
    { el: thisWeekWeightChange, text: formatDelta(weekDelta) },
    { el: thisMonthWeightChange, text: formatDelta(monthDelta) }
  ]

  staggerOrder.forEach((item, idx) => {
    if (!item.el || typeof item.text === 'undefined') return
    animateTextChange(item.el, item.text, idx * STAGGER_MS)
  })
  
  // Update goal weight display
  updateGoalWeightDisplay()
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
window.clearAllEntries = clearAllEntries;
initWeather();