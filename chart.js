    const ctx = document.getElementById('weight-chart').getContext('2d')


    const myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [
          '07-01', '07-02', '07-03', 
          '07-04', '07-05', '07-06',
          '07-07', '07-08'
        ],
        datasets: [{
          label: 'Weight',
          data: [65, 64.5, 64.2, 64.0, 63.5, 63.9, 63.7, 63.3],
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


    const dateBtn = document.getElementById("date-btn");
    const datePicker = document.getElementById("date-picker");

    dateBtn.addEventListener('click', ()=> {
      if ('showPicker' in HTMLInputElement.prototype) {
        datePicker.showPicker();
      } else {
        datePicker.click();
      }
    })

    datePicker.addEventListener('change', (e) =>{
      const selectedDate = e.target.value;

      if (selectedDate) {
        dateBtn.textContent = selectedDate;
      }
    })

// TODO: change the format of the date to match the chart (maybe also update the chart's format to "MM/DD")    
// TODO: Compare date (if it's not in this year, show year number, otherwise, skip it)


    function updateMyChart(value) {
      myChart.data.datasets[0].data.push(value);
      myChart.data.labels.push("07-09");
      // !! Update this later with real dates
      myChart.update();
    } 

    const inputWeight = document.getElementById("input-weight")
    const saveBtn = document.getElementById("save-btn")

    saveBtn.addEventListener('click', function(){
      const newWeight = parseFloat(inputWeight.value);

      if (isNaN(newWeight)){
        alert("Please enter valid number!")
        return;
      }
      updateMyChart(newWeight);
      inputWeight.value='';
    }
    )

