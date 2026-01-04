    const ctx = document.getElementById('weight-chart').getContext('2d')

    // Storage key for persisted entries
    const STORAGE_KEY = 'weight-tracker-entries-v1'

    // Defaults (MM/DD labels and values) — converted to ISO when used
    const DEFAULT_LABELS = [
      '07/01', '07/02', '07/03', '07/04', '07/05', '07/06', '07/07', '07/08'
    ]
    const DEFAULT_DATA = [65, 64.5, 64.2, 64.0, 63.5, 63.9, 63.7, 63.3]

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
      myChart.data.labels = entries.map(e => formatSelectedDate(e.iso))
      myChart.data.datasets[0].data = entries.map(e => e.weight)
      myChart.update()
    }

    // Initialize
    let entries = loadEntries()
    renderChartFromEntries(entries)


    const dateBtn = document.getElementById("date-btn");
    const datePicker = document.getElementById("date-picker");

    dateBtn.addEventListener('click', ()=> {
      if ('showPicker' in HTMLInputElement.prototype) {
        datePicker.showPicker();
      } else {
        datePicker.click();
      }
    })

    // Format an ISO date string (YYYY-MM-DD) for display.
    // Shows month/day for current-year dates, includes year otherwise.
    function formatSelectedDate(isoDate) {
      if (!isoDate) return '';
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

// TODO: change the format of the date to match the chart (maybe also update the chart's format to "MM/DD")    
// TODO: Compare date (if it's not in this year, show year number, otherwise, skip it)


    function updateMyChart(value, isoDate) {
      const dateISO = isoDate || new Date().toISOString().slice(0, 10);
      const entry = { iso: dateISO, weight: value };
      entries.push(entry);
      saveEntries(entries);
      renderChartFromEntries(entries);
    }

    const inputWeight = document.getElementById("input-weight")
    const saveBtn = document.getElementById("save-btn")

    saveBtn.addEventListener('click', function(){
      const newWeight = parseFloat(inputWeight.value);

      if (isNaN(newWeight)){
        alert("Please enter valid number!")
        return;
      }
      // pass the selected date (ISO) so the chart label matches the picker
      const selectedISO = datePicker.value || new Date().toISOString().slice(0,10);
      updateMyChart(newWeight, selectedISO);
      inputWeight.value='';
    })

