// --- Initialize Socket.io ---
const socket = io();

// --- User Selection & Theme Logic ---
// We ask for user immediately to set the theme
const user = prompt("Are you Uday or Priya? (Type 'Uday' or 'Priya')");
const userName = user && user.toLowerCase() === 'uday' ? 'uday' : 'priya';
const themeColor = userName === 'uday' ? 'blue' : 'pink';

// Apply theme to the whole page immediately
document.documentElement.style.setProperty('--main-color', themeColor);
// Add a subtle border to indicate the user
document.body.style.borderTop = `10px solid ${themeColor}`;


// --- Get Current Date in YYYY-MM-DD format ---
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Data Structure will now come from the server
let dateStore = {}; 
// Sets initial date to the real, current date
let selectedDate = getTodayDateString(); 

// --- Socket Listeners (Real-time updates) ---
socket.on('dataUpdated', (newData) => {
    dateStore = newData;
    renderApp();
});

// --- API Calls to Backend ---
async function fetchData() {
    try {
        const response = await fetch('/api/data');
        dateStore = await response.json();
        renderApp();
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

async function addBackendTask(taskData) {
    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, task: taskData })
    });
}

async function toggleBackendTask(taskId) {
    await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
    });
}

async function deleteBackendTask(taskId) {
    await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
    });
}

async function toggleBackendImportant() {
    await fetch('/api/day-important', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
    });
}

// --- Time and Date ---
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateTimeEl = document.getElementById('datetime');
    if (dateTimeEl) {
        dateTimeEl.innerText = now.toLocaleTimeString() + "\n" + now.toLocaleDateString(undefined, options);
    }
}
setInterval(updateDateTime, 1000);
updateDateTime();

// --- Date Selection ---
function changeDate(date) {
    selectedDate = date;
    const displayEl = document.getElementById('selectedDateDisplay');
    if (displayEl) displayEl.innerText = date;
    renderApp();
}

function jumpToToday() {
    changeDate(getTodayDateString());
}

// --- Popup Modal Logic ---
function openModal() { 
    document.getElementById('taskModal').style.display = 'flex'; 
}
function closeModal() { 
    document.getElementById('taskModal').style.display = 'none'; 
}

function submitModalTask() {
    const name = document.getElementById('modalName').value;
    const emoji = document.getElementById('modalEmoji').value;
    const owner = document.getElementById('modalOwner').value;
    
    if (!name || !emoji || !owner) return alert("Fill all fields!");

    addBackendTask({
        id: Date.now(),
        name: name,
        emoji: emoji,
        owner: owner,
        completed: false
    });

    document.getElementById('modalName').value = '';
    document.getElementById('modalEmoji').value = '';
    closeModal();
}

// --- Rendering ---
function renderApp() {
    renderHabits();
    updateScoreboard();
    renderChart();
    renderCalendar();
    calculateTodaysWinner();
}

function renderHabits() {
    const list = document.getElementById('habitList');
    const addBtn = document.getElementById('addTaskBtn');
    if (!list) return;

    list.innerHTML = '';
    const dayData = dateStore[selectedDate];
    const today = getTodayDateString();

    if (addBtn) addBtn.disabled = (selectedDate < today);

    if (dayData && dayData.tasks) {
        dayData.tasks.forEach(h => {
            list.innerHTML += `
                <div class="habit-item ${h.owner === '1' ? 'p1-border' : 'p2-border'}">
                    <div class="habit-info">
                        <div class="habit-icon">${h.emoji}</div>
                        <div class="habit-name">${h.completed ? '<s>' + h.name + '</s>' : h.name}</div>
                    </div>
                    <div class="actions">
                        <button class="check-btn ${h.completed ? 'completed' : ''}" onclick="toggleBackendTask(${h.id})">
                            ${h.completed ? 'Done' : 'Check'}
                        </button>
                        <button class="delete-btn" onclick="deleteBackendTask(${h.id})">Del</button>
                    </div>
                </div>
            `;
        });
    }
}

function updateScoreboard() {
    let p1Total = 0, p2Total = 0;
    Object.values(dateStore).forEach(day => {
        day.tasks.forEach(task => {
            if (task.completed) {
                task.owner === '1' ? p1Total += 10 : p2Total += 10;
            }
        });
    });
    
    const p1El = document.getElementById('scorePriya');
    const p2El = document.getElementById('scoreUday');
    if (p1El) p1El.innerText = p1Total;
    if (p2El) p2El.innerText = p2Total;
}

function calculateTodaysWinner() {
    const today = getTodayDateString();
    const dayData = dateStore[today];
    const winnerEl = document.getElementById('todaysWinner');
    if (!winnerEl) return;

    if (!dayData || dayData.tasks.length === 0) {
        winnerEl.innerText = "No tasks yet!";
        return;
    }

    let p1Score = 0, p2Score = 0;
    dayData.tasks.forEach(t => {
        if (t.completed) {
            t.owner === '1' ? p1Score += 10 : p2Score += 10;
        }
    });

    if (p1Score > p2Score) winnerEl.innerText = "🏆 Priya is winning today!";
    else if (p2Score > p1Score) winnerEl.innerText = "🏆 Uday is winning today!";
    else winnerEl.innerText = "🤝 It's a tie today!";
}

// --- Chart.js Plotting (Updated for Accuracy) ---
let habitChart;
function renderChart() {
    const chartCanvas = document.getElementById('scoreChart');
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    
    // Get all dates and sort them
    const dates = Object.keys(dateStore).sort();
    
    let cumulativeP1 = 0;
    let cumulativeP2 = 0;
    const p1Data = dates.map(date => {
        let dayScore = 0;
        if(dateStore[date] && dateStore[date].tasks) {
            dateStore[date].tasks.forEach(t => {
                if(t.completed && t.owner === '1') dayScore += 10;
            });
        }
        cumulativeP1 += dayScore;
        return cumulativeP1;
    });
    const p2Data = dates.map(date => {
        let dayScore = 0;
        if(dateStore[date] && dateStore[date].tasks) {
            dateStore[date].tasks.forEach(t => {
                if(t.completed && t.owner === '2') dayScore += 10;
            });
        }
        cumulativeP2 += dayScore;
        return cumulativeP2;
    });

    if (habitChart) habitChart.destroy();
    habitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                { 
                    label: 'Priya', 
                    data: p1Data, 
                    borderColor: '#ff85a2', 
                    tension: 0.2, // Straighter lines for accuracy
                    backgroundColor: 'rgba(255,133,162,0.2)', 
                    fill: true 
                },
                { 
                    label: 'Uday', 
                    data: p2Data, 
                    borderColor: '#4dadff', 
                    tension: 0.2, // Straighter lines for accuracy
                    backgroundColor: 'rgba(77,173,255,0.2)', 
                    fill: true 
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { beginAtZero: true, grid: { color: '#333' } }, 
                x: { grid: { color: '#333' } } 
            },
            plugins: {
                legend: {
                    labels: { color: 'white' }
                }
            }
        }
    });
}

// --- Dynamic Calendar ---
function renderCalendar() {
    const calendar = document.getElementById('calendar-container');
    if (!calendar) return;
    calendar.innerHTML = '';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayData = dateStore[dateStr];
        let className = 'calendar-day';
        
        if (dayData) {
            let p1Score = 0, p2Score = 0;
            dayData.tasks.forEach(t => t.completed && t.owner === '1' ? p1Score += 10 : 0);
            dayData.tasks.forEach(t => t.completed && t.owner === '2' ? p2Score += 10 : 0);
            
            if (p1Score > p2Score) className += ' winner-p1';
            else if (p2Score > p1Score) className += ' winner-p2';
        }

        if (dateStr === selectedDate) className += ' selected-day';

        calendar.innerHTML += `<div class="${className}" onclick="changeDate('${dateStr}')">${i}</div>`;
    }
}

// Initial fetch
fetchData();
