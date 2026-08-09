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
const profileAvatarBtn = document.getElementById('profile-avatar-btn');
const profileAvatarInner = document.getElementById('profile-avatar-inner');
const profileMenu = document.getElementById('profile-menu');
const profileMenuList = document.getElementById('profile-menu-list');
const profileDialogBackdrop = document.getElementById('profile-dialog-backdrop');
const profileDialogCancel = document.getElementById('profile-dialog-cancel');
const profileDialogSave = document.getElementById('profile-dialog-save');
const profileAvatarEditBtn = document.getElementById('profile-avatar-edit-btn');
const profileAvatarInput = document.getElementById('profile-avatar-input');
const profileNameInput = document.getElementById('profile-name-input');
const activeProfileName = document.getElementById('active-profile-name');

const PROFILE_STORAGE_KEY = 'weight-tracker-profiles-v2';
const ACTIVE_PROFILE_STORAGE_KEY = 'weight-tracker-active-profile-v2';
const STORAGE_KEY = 'weight-tracker-entries-v1';
const GOAL_STORAGE_KEY = 'weight-tracker-goal-v1';
const DEFAULT_LABELS = ['01/01', '01/02', '01/03'];
const DEFAULT_DATA = [65, 64.5, 64.2];
const DEFAULT_GOAL = 55;
const DEFAULT_UNIT = 'kg';
let entries = [];
let goal = DEFAULT_GOAL;
let profiles = [];
let activeProfileId = null;
let pendingAvatarImage = '';
let pendingAvatarPreviewUrl = '';
let pendingAvatarFiles = [];
let profileDialogMode = 'create';
let profileDialogTargetId = null;

function createProfileId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultAvatarSvg() {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="72" height="72" rx="36" fill="#F3F4F6"/>
  <path d="M25.0531 36.4469C22.0177 33.4115 20.5 29.7625 20.5 25.5C20.5 21.2375 22.0177 17.5885 25.0531 14.5531C28.0885 11.5177 31.7375 10 36 10C40.2625 10 43.9115 11.5177 46.9469 14.5531C49.9823 17.5885 51.5 21.2375 51.5 25.5C51.5 29.7625 49.9823 33.4115 46.9469 36.4469C43.9115 39.4823 40.2625 41 36 41C31.7375 41 28.0885 39.4823 25.0531 36.4469ZM5 64.25V61.15C5 58.9542 5.5651 56.9359 6.69531 55.0953C7.82552 53.2547 9.32708 51.85 11.2 50.8813C15.2042 48.8792 19.2729 47.3776 23.4063 46.3766C27.5396 45.3755 31.7375 44.875 36 44.875C40.2625 44.875 44.4604 45.3755 48.5938 46.3766C52.7271 47.3776 56.7958 48.8792 60.8 50.8813C62.6729 51.85 64.1745 53.2547 65.3047 55.0953C66.4349 56.9359 67 58.9542 67 61.15V64.25C67 66.3813 66.2411 68.2057 64.7234 69.7234C63.2057 71.2411 61.3813 72 59.25 72H12.75C10.6188 72 8.79427 71.2411 7.27656 69.7234C5.75885 68.2057 5 66.3813 5 64.25Z" fill="#E5E7EB"/>
</svg>`)}`;
}

function applyAvatarStyle(element, profile) {
  if (!element) return;
  const avatarImage = profile?.avatarImage;
  element.style.backgroundColor = '#d7dde9';
  element.style.backgroundImage = avatarImage ? `url(${avatarImage})` : `url(${getDefaultAvatarSvg()})`;
  element.style.backgroundSize = 'cover';
  element.style.backgroundPosition = 'center';
  element.style.backgroundRepeat = 'no-repeat';
}

function revokePendingAvatarPreview() {
  if (pendingAvatarPreviewUrl) {
    URL.revokeObjectURL(pendingAvatarPreviewUrl);
    pendingAvatarPreviewUrl = '';
  }
}

function resetPendingAvatarState() {
  revokePendingAvatarPreview();
  pendingAvatarImage = '';
  pendingAvatarFiles = [];
}

function buildAvatarFormData(files = pendingAvatarFiles) {
  const formData = new FormData();
  files.forEach((file) => {
    if (file instanceof File) {
      formData.append('images', file);
    }
  });
  return formData;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read avatar file'));
    reader.readAsDataURL(file);
  });
}

function handleAvatarSelection(files) {
  const selectedFiles = Array.from(files || []).filter((file) => file instanceof File && file.type?.startsWith('image/'));
  if (!selectedFiles.length) return null;

  revokePendingAvatarPreview();
  pendingAvatarFiles = selectedFiles;
  const primaryFile = selectedFiles[0];
  pendingAvatarPreviewUrl = URL.createObjectURL(primaryFile);

  readFileAsDataURL(primaryFile).then((dataUrl) => {
    pendingAvatarImage = dataUrl;
    updateDialogAvatar();
  }).catch((error) => {
    console.warn('Could not load selected avatar image', error);
  });

  return {
    files: selectedFiles,
    previewUrl: pendingAvatarPreviewUrl,
    formData: buildAvatarFormData(selectedFiles)
  };
}

async function ensurePendingAvatarImageLoaded() {
  if (pendingAvatarImage || !pendingAvatarFiles.length) return;
  try {
    const firstFile = pendingAvatarFiles[0];
    if (firstFile) {
      pendingAvatarImage = await readFileAsDataURL(firstFile);
      updateDialogAvatar();
    }
  } catch (error) {
    console.warn('Avatar image save was attempted before the file finished loading', error);
  }
}

function warnIfHybridWebView() {
  const isAndroidWebView = /android/i.test(navigator.userAgent) && /(wv|webview)/i.test(navigator.userAgent);
  if (isAndroidWebView) {
    console.info('This app is running inside an Android WebView. If file picking is still failing, ensure WebChromeClient.onShowFileChooser is implemented natively.');
  }
}

warnIfHybridWebView();

function loadLegacyEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse stored entries', e);
  }
  return labelsToEntries(DEFAULT_LABELS, DEFAULT_DATA);
}

function loadLegacyGoal() {
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_KEY);
    if (raw) return parseFloat(raw);
  } catch (e) {
    console.warn('Failed to parse stored goal', e);
  }
  return DEFAULT_GOAL;
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse stored profiles', e);
  }

  return [{
    id: createProfileId(),
    name: 'Profile 1',
    avatarImage: '',
    entries: loadLegacyEntries(),
    goal: loadLegacyGoal(),
    unit: DEFAULT_UNIT
  }];
}

function loadActiveProfileId() {
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (raw) return raw;
  } catch (e) {
    console.warn('Failed to parse active profile id', e);
  }
  return null;
}

function getActiveProfile() {
  if (!profiles.length) {
    profiles = [{
      id: createProfileId(),
      name: 'Profile 1',
      avatarImage: '',
      entries: [],
      goal: DEFAULT_GOAL
    }];
  }
  if (!activeProfileId) {
    activeProfileId = profiles[0].id;
  }
  const p = profiles.find(profile => profile.id === activeProfileId) || profiles[0];
  if (!p.unit) p.unit = DEFAULT_UNIT;
  return p;
}

// Unit helpers: profiles store weights in kilograms. The profile `unit` controls
// how values are displayed/entered (either 'kg' or 'g'). Conversion helpers below
function getActiveUnit() {
  return (getActiveProfile()?.unit) || DEFAULT_UNIT;
}

function isUnitGram() {
  return getActiveUnit() === 'g';
}

function displayMultiplier() {
  return isUnitGram() ? 1000 : 1;
}

function convertToDisplay(weightKg) {
  return (weightKg == null || isNaN(weightKg)) ? weightKg : weightKg * displayMultiplier();
}

function convertFromInput(value) {
  return (value == null || value === '') ? null : (parseFloat(value) / displayMultiplier());
}

function formatDisplayNumber(value) {
  if (isUnitGram()) return `${Math.round(value)}g`;
  return `${(+value).toFixed(1)}kg`;
}


function persistProfiles() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId || '');
  } catch (e) {
    console.warn('Failed to save profiles', e);
  }
}

function syncStateFromActiveProfile() {
  const profile = getActiveProfile();
  if (!profile) return;
  entries = Array.isArray(profile.entries) ? profile.entries : [];
  goal = typeof profile.goal === 'number' ? profile.goal : DEFAULT_GOAL;
}

function saveCurrentProfileData() {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.entries = entries;
  profile.goal = goal;
  persistProfiles();
}

function updateProfileUI() {
  const profile = getActiveProfile();
  if (!profile) return;

  if (profileAvatarInner) {
    profileAvatarInner.textContent = '';
  }
  if (profileAvatarBtn) {
    applyAvatarStyle(profileAvatarBtn, profile);
  }
  if (activeProfileName) {
    activeProfileName.textContent = profile.name;
  }
  if (profileNameInput) {
    profileNameInput.value = profile.name;
  }
  renderProfileMenu();
}

function renderProfileMenu() {
  if (!profileMenuList) return;
  profileMenuList.innerHTML = '';

  profiles.forEach(profile => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-menu-item';
    if (profile.id === activeProfileId) button.classList.add('active');

    const content = document.createElement('span');
    content.className = 'profile-menu-item-content';

    const avatar = document.createElement('span');
    avatar.className = 'profile-menu-avatar';
    avatar.textContent = '';
    applyAvatarStyle(avatar, profile);

    const label = document.createElement('span');
    label.textContent = profile.name;

    content.appendChild(avatar);
    content.appendChild(label);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'profile-menu-edit-btn';
    editButton.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    editButton.addEventListener('click', (event) => {
      event.stopPropagation();
      activeProfileId = profile.id;
      syncStateFromActiveProfile();
      saveCurrentProfileData();
      closeProfileMenu();
      openProfileDialog('edit', profile);
    });

    button.appendChild(content);
    button.appendChild(editButton);
    button.addEventListener('click', () => {
      activeProfileId = profile.id;
      syncStateFromActiveProfile();
      saveCurrentProfileData();
      renderChartFromEntries(entries);
      updateSummaryStats(entries);
      updateProfileUI();
      closeProfileMenu();
    });

    profileMenuList.appendChild(button);
  });

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'profile-menu-item profile-menu-add';
  addButton.innerHTML = '<span class="material-symbols-outlined">add_circle</span><span>Add</span>';
  addButton.addEventListener('click', () => {
    openProfileDialog('create');
  });
  profileMenuList.appendChild(addButton);
}

function openProfileMenu() {
  if (!profileMenu) return;
  profileMenu.hidden = false;
  profileAvatarBtn?.setAttribute('aria-expanded', 'true');
}

function closeProfileMenu() {
  if (!profileMenu) return;
  profileMenu.hidden = true;
  profileAvatarBtn?.setAttribute('aria-expanded', 'false');
}

function updateDialogAvatar() {
  if (!profileAvatarEditBtn) return;
  const avatarSource = pendingAvatarPreviewUrl || pendingAvatarImage || '';
  applyAvatarStyle(profileAvatarEditBtn, { avatarImage: avatarSource });
}

function openProfileDialog(mode = 'create', profileToEdit = null) {
  closeProfileMenu();
  profileDialogMode = mode;
  profileDialogTargetId = mode === 'edit' ? (profileToEdit?.id || null) : null;
  resetPendingAvatarState();
  pendingAvatarImage = profileToEdit?.avatarImage || '';
  if (profileNameInput) profileNameInput.value = profileToEdit?.name || '';
  const titleText = mode === 'edit' ? 'Edit profile' : 'Add profile';
  const dialogTitle = document.getElementById('profile-dialog-title');
  if (dialogTitle) dialogTitle.textContent = titleText;

  try {
    const toggle = document.getElementById('profile-unit-toggle');
    if (toggle) {
      const selectedUnit = profileToEdit?.unit || DEFAULT_UNIT;
      toggle.dataset.active = selectedUnit;
      const buttons = Array.from(toggle.querySelectorAll('.unit-btn'));
      buttons.forEach(b => {
        b.classList.toggle('selected', b.dataset.unit === selectedUnit);
      });
    }
  } catch (e) {
    // ignore
  }
  updateDialogAvatar();
  profileDialogBackdrop.hidden = false;
  profileNameInput?.focus();
}

function closeProfileDialog() {
  if (profileDialogBackdrop) profileDialogBackdrop.hidden = true;
}

profiles = loadProfiles();
activeProfileId = loadActiveProfileId();
syncStateFromActiveProfile();
updateProfileUI();

profileAvatarBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  if (profileMenu?.hidden) {
    openProfileMenu();
  } else {
    closeProfileMenu();
  }
});

profileDialogCancel?.addEventListener('click', closeProfileDialog);
profileDialogBackdrop?.addEventListener('click', (event) => {
  if (event.target === profileDialogBackdrop) closeProfileDialog();
});

profileAvatarEditBtn?.addEventListener('click', () => {
  profileAvatarInput?.click();
});

profileAvatarInput?.addEventListener('change', (event) => {
  const files = event.target.files;
  if (!files?.length) return;

  handleAvatarSelection(files);
  event.target.value = '';
});

// small handler for unit toggle buttons if user clicks them directly
const _profileUnitToggleEl = document.getElementById('profile-unit-toggle');
if (_profileUnitToggleEl) {
  _profileUnitToggleEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest && ev.target.closest('.unit-btn');
    if (!btn) return;
    const selectedUnit = btn.dataset.unit;
    if (!selectedUnit) return;

    const siblings = Array.from(_profileUnitToggleEl.querySelectorAll('.unit-btn'));
    siblings.forEach(s => s.classList.toggle('selected', s === btn));
    _profileUnitToggleEl.dataset.active = selectedUnit;
  });
}

profileDialogSave?.addEventListener('click', async () => {
  const profileName = (profileNameInput?.value || '').trim() || `Profile ${profiles.length + 1}`;
  const selectedUnitBtn = document.querySelector('#profile-unit-toggle .unit-btn.selected');
  const selectedUnit = selectedUnitBtn?.dataset?.unit || DEFAULT_UNIT;

  await ensurePendingAvatarImageLoaded();

  if (profileDialogMode === 'edit' && profileDialogTargetId) {
    const profileToEdit = profiles.find(profile => profile.id === profileDialogTargetId);
    if (profileToEdit) {
      profileToEdit.name = profileName;
      profileToEdit.avatarImage = pendingAvatarImage;
      profileToEdit.unit = selectedUnit;
      activeProfileId = profileToEdit.id;
      syncStateFromActiveProfile();
      saveCurrentProfileData();
    }
  } else {
    const newProfile = {
      id: createProfileId(),
      name: profileName,
      avatarImage: pendingAvatarImage,
      entries: [],
      goal: DEFAULT_GOAL,
      unit: selectedUnit
    };
    profiles.push(newProfile);
    activeProfileId = newProfile.id;
    persistProfiles();
    syncStateFromActiveProfile();
  }

  renderChartFromEntries(entries);
  updateSummaryStats(entries);
  updateProfileUI();
  closeProfileDialog();
});

document.addEventListener('click', (event) => {
  if (!profileMenu || profileMenu.hidden) return;
  if (profileMenu.contains(event.target) || profileAvatarBtn?.contains(event.target)) return;
  closeProfileMenu();
});

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
      bottomSheetMode = 'add';
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
        inputWeight.value = convertToDisplay(goal);
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
    inputWeight.value = convertToDisplay(entry.weight);
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

// Get chart context
const ctx = document.getElementById('weight-chart').getContext('2d')

// Load goal early so it's available for the chart plugin
goal = loadGoal()

// Register chartjs-plugin-zoom when the CDN script is available
const zoomPlugin = window.ChartZoom || window.chartZoom || window.ChartZoomPlugin
if (zoomPlugin && typeof Chart?.register === 'function') {
  Chart.register(zoomPlugin)
}

// Custom plugin to draw goal line with label
const goalLinePlugin = {
  id: 'goalLine',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const yAxis = chart.scales.y;
    const xAxis = chart.scales.x;

    if (!yAxis || !xAxis || typeof goal === 'undefined') return;
    // Determine the goal value in display units (kg->g if needed)
    const displayGoal = goal * displayMultiplier();
    const yMin = yAxis.min;
    const yMax = yAxis.max;

    // Prepare text/icon data
    const labelColor = 'hsl(243,75%,59%)';
    const iconStr = '\ue153'; // Material flag
    const spacing = 4;

    // Text to show (include unit)
    const textStr = isUnitGram() ? `Goal: ${Math.round(displayGoal)}g` : `Goal: ${(+goal).toFixed(1)}kg`;

    ctx.font = 'bold 8px "Poppins", sans-serif';
    const textWidth = ctx.measureText(textStr).width;
    const textHeight = 8;

    // If goal is outside visible Y range, draw only the label above the x-axis
    if (displayGoal < yMin || displayGoal > yMax) {
      // Goal is out of the visible range; hide the label entirely.
      return;
    }

    // Otherwise draw dashed line across and icon + label on the right
    const goalPixelY = yAxis.getPixelForValue(displayGoal);

    // measure icon width
    const iconFontSize = 12;
    ctx.font = `${iconFontSize}px "Material Symbols Outlined"`;
    const iconWidth = ctx.measureText(iconStr).width;
    const totalWidth = iconWidth + spacing + textWidth;

    // draw dashed line ending before the label
    ctx.strokeStyle = 'hsl(224, 16%, 72%)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(xAxis.left, goalPixelY);
    ctx.lineTo(xAxis.right - totalWidth, goalPixelY);
    ctx.stroke();
    ctx.setLineDash([]);

    // positions
    const iconX = xAxis.right - totalWidth;
    const textX = iconX + iconWidth + spacing;
    const iconY = goalPixelY + (iconFontSize / 2) - 2;
    const textY = goalPixelY + (textHeight / 2) - 1;

    // draw icon
    ctx.fillStyle = labelColor;
    ctx.font = `${iconFontSize}px "Material Symbols Outlined", "Material Icons"`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconStr, iconX, iconY);

    // draw text
    ctx.font = 'bold 8px "Poppins", sans-serif';
    ctx.fillText(textStr, textX, textY);

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
          label: context => formatDisplayNumber(context.parsed.y)
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          scaleMode: 'x',
          threshold: 10
        },
        zoom: {
          wheel: {
            enabled: true
          },
          pinch: {
            enabled: true
          },
          mode: 'x'
        }
      },
    },
    interaction: {
      mode: 'nearest',
      intersect: true
    },
    scales: {
      x: {
        title: { display: false, text: 'Date'},
        ticks: { autoSkip: true, maxRotation: 45},
        grid: {display:false}
      },
      y: {
        beginAtZero: false,
        title: { display: false, text: 'Weight'},
        grid: {display:false},
        // min/max will be computed dynamically per-profile when rendering
      }
    },
    onClick: (event, elements) => {
      // Mark that we're clicking on chart data (prevents document listener from dismissing)
      isClickingChart = true;
      
      if (elements.length > 0) {
        const dataIndex = elements[0].index;
        handleDotTap(dataIndex); // Use state machine
      }
      
      // Reset flag after handler completes
      setTimeout(() => {
        isClickingChart = false;
      }, 0);
    },

  },
  plugins: [goalLinePlugin]
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
  const profile = getActiveProfile()
  if (profile?.entries && Array.isArray(profile.entries)) return profile.entries
  return labelsToEntries(DEFAULT_LABELS, DEFAULT_DATA)
}

function saveEntries(entriesArr) {
  const profile = getActiveProfile()
  if (!profile) return
  profile.entries = entriesArr
  persistProfiles()
}

function loadGoal() {
  const profile = getActiveProfile()
  if (profile && typeof profile.goal === 'number') return profile.goal
  return DEFAULT_GOAL
}

function saveGoal(goalValue) {
  const profile = getActiveProfile()
  if (!profile) return
  profile.goal = goalValue
  persistProfiles()
}

function syncChartViewport(entries) {
  const count = entries?.length || 0
  const startIndex = Math.max(count - 10, 0)
  const endIndex = Math.max(count - 1, 0)

  if (!myChart?.options?.scales?.x) return

  myChart.options.scales.x.min = count <= 10 ? -0.5 : startIndex - 0.5
  myChart.options.scales.x.max = count <= 10 ? count - 0.5 : endIndex + 0.5
}

function computeYRange(entriesArr) {
  const multiplier = displayMultiplier();
  if (!entriesArr || entriesArr.length === 0) {
    // No entries: base on goal with previous paddings (scaled to display unit)
    const dGoal = goal * multiplier;
    const padLow = isUnitGram() ? 50000 : 5; // roughly 50kg -> 50000g
    const padHigh = isUnitGram() ? 110000 : 11;
    return { min: Math.max(dGoal - padLow, isUnitGram() ? 0 : 0), max: dGoal + padHigh };
  }

  const values = entriesArr.map(e => (e.weight || 0) * multiplier);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV;

  // Choose padding proportional to span, fallback to a small absolute pad
  const basePad = isUnitGram() ? Math.max(50, Math.round(minV * 0.05)) : Math.max(0.5, minV * 0.05);
  const padding = span > 0 ? Math.max(span * 0.15, basePad) : basePad;

  let minOut = minV - padding;
  let maxOut = maxV + padding;

  if (isUnitGram()) {
    minOut = Math.max(0, Math.floor(minOut));
    maxOut = Math.ceil(maxOut);
  } else {
    minOut = Math.max(0, Math.floor(minOut * 10) / 10);
    maxOut = Math.ceil(maxOut * 10) / 10;
  }

  return { min: minOut, max: maxOut };
}

function renderChartFromEntries(entries) {
  // Chart labels should always show the date (MM/DD or MM/DD/YYYY),
  // while the bottom-sheet button can show 'Today'. Use a separate formatter.
  myChart.data.labels = entries.map(e => formatChartLabel(e.iso));
  // convert stored kg to display units per-profile
  myChart.data.datasets[0].data = entries.map(e => convertToDisplay(e.weight));
  // compute dynamic Y range and apply
  const yRange = computeYRange(entries);
  if (!myChart.options) myChart.options = {};
  if (!myChart.options.scales) myChart.options.scales = {};
  if (!myChart.options.scales.y) myChart.options.scales.y = {};
  myChart.options.scales.y.min = yRange.min;
  myChart.options.scales.y.max = yRange.max;
  syncChartViewport(entries);
  myChart.update();
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
entries = loadEntries()
goal = loadGoal()
let bottomSheetMode = 'add' // 'add', 'edit', or 'edit-goal'
// Ensure entries are sorted by date ascending
function sortEntries() {
  entries.sort((a, b) => a.iso.localeCompare(b.iso))
}
sortEntries()
renderChartFromEntries(entries)
updateSummaryStats(entries)



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
    }, 5); 
  }, 60); 
  
  scheduleAnimationStep(() => {
    editDeleteContainer.style.display = 'none';
    isAnimating = false;
    pendingAnimationTimers = [];
  }, 220);
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
  const inputVal = inputWeight.value;
  const newWeight = convertFromInput(inputVal);

  if (newWeight == null || isNaN(newWeight)){
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
    animateTextChange(goalWeightEl, formatDisplayNumber(convertToDisplay(goal)));
  }
  // Update the chart to reflect the new goal weight
  if (myChart) {
    const yr = computeYRange(entries);
    myChart.options.scales.y.min = yr.min;
    myChart.options.scales.y.max = yr.max;
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
  const mul = displayMultiplier();
  const val = delta * mul;
  if (isUnitGram()) {
    const absV = Math.round(Math.abs(val));
    if (delta > 0) return `+${absV}g`;
    if (delta === 0) return `0g`;
    return `-${absV}g`;
  }
  const rounded = Math.abs(val).toFixed(1);
  if (delta > 0) return `+${rounded}kg`;
  return `${(delta === 0 ? '0.0' : '-'+rounded)}kg`;
}

function updateSummaryStats(entriesArr) {
  if (!entriesArr || entriesArr.length === 0) {
    // No entries: animate summary fields to a zero/empty state so cleared
    // state persists visually after page reloads.
    const STAGGER_MS = 40;
      const zeroText = formatDisplayNumber(0);
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
  const multiplier = displayMultiplier();
  const staggerOrder = [
    { el: todayWeight, text: formatDisplayNumber(convertToDisplay(todayEntry.weight)) },
    { el: document.getElementById('total-weight-change'), text: formatDisplayNumber(convertToDisplay(latest.weight - first.weight)) },
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
  const zeroText = formatDisplayNumber(0);
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