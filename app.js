// Database
let db = {
    clients: [],
    services: [],
    appointments: []
};

// Firebase config
let firebaseConfig = null;
let firebaseApp = null;
let firebaseDB = null;
let isFirebaseEnabled = false;

// Calendar state
let currentCalendarDate = new Date();
let selectedDate = new Date();

// PWA Install
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installPrompt').classList.add('show');
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('App installed');
            }
            deferredPrompt = null;
            document.getElementById('installPrompt').classList.remove('show');
        });
    }
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed'));
    });
}

// Online/Offline status
function updateOnlineStatus() {
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    
    if (navigator.onLine) {
        statusBadge.className = 'status-badge status-online';
        statusText.textContent = 'Онлайн';
        
        // Sync data if Firebase is enabled
        if (isFirebaseEnabled) {
            syncToFirebase();
        }
    } else {
        statusBadge.className = 'status-badge status-offline';
        statusText.textContent = 'Оффлайн';
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Local Storage functions
function loadData() {
    try {
        const clientsData = localStorage.getItem('crm_clients');
        const servicesData = localStorage.getItem('crm_services');
        const appointmentsData = localStorage.getItem('crm_appointments');
        
        db.clients = clientsData ? JSON.parse(clientsData) : [];
        db.services = servicesData ? JSON.parse(servicesData) : [];
        db.appointments = appointmentsData ? JSON.parse(appointmentsData) : [];
        
        console.log('Data loaded from localStorage:', db);
    } catch (error) {
        console.error('Error loading data:', error);
        db = { clients: [], services: [], appointments: [] };
    }
}

function saveData() {
    try {
        localStorage.setItem('crm_clients', JSON.stringify(db.clients));
        localStorage.setItem('crm_services', JSON.stringify(db.services));
        localStorage.setItem('crm_appointments', JSON.stringify(db.appointments));
        localStorage.setItem('crm_last_save', new Date().toISOString());
        
        console.log('Data saved to localStorage');
        
        // Sync to Firebase if enabled and online
        if (isFirebaseEnabled && navigator.onLine) {
            syncToFirebase();
        }
        
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Ошибка при сохранении данных. Проверьте настройки браузера.');
        return false;
    }
}

// Firebase functions
function loadFirebaseConfig() {
    const configStr = localStorage.getItem('firebase_config');
    if (configStr) {
        firebaseConfig = JSON.parse(configStr);
        initFirebase();
    }
}

function initFirebase() {
    if (!firebaseConfig) return;
    
    try {
        // Check if Firebase is already loaded
        if (typeof firebase !== 'undefined') {
            if (!firebaseApp) {
                firebaseApp = firebase.initializeApp(firebaseConfig);
                firebaseDB = firebase.firestore();
            }
            isFirebaseEnabled = true;
            updateFirebaseStatus(true);
            
            // Load data from Firebase
            loadFromFirebase();
        } else {
            // Load Firebase SDK
            loadFirebaseSDK();
        }
    } catch (error) {
        console.error('Firebase init error:', error);
        isFirebaseEnabled = false;
        updateFirebaseStatus(false);
    }
}

function loadFirebaseSDK() {
    // Load Firebase scripts dynamically
    const scripts = [
        'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js'
    ];
    
    let loaded = 0;
    scripts.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            loaded++;
            if (loaded === scripts.length) {
                initFirebase();
            }
        };
        document.head.appendChild(script);
    });
}

async function syncToFirebase() {
    if (!isFirebaseEnabled || !firebaseDB) return;
    
    try {
        const userId = 'user_' + (localStorage.getItem('user_id') || Date.now());
        localStorage.setItem('user_id', userId.replace('user_', ''));
        
        // Save to Firestore
        await firebaseDB.collection('crm_data').doc(userId).set({
            clients: db.clients,
            services: db.services,
            appointments: db.appointments,
            lastSync: new Date().toISOString()
        });
        
        document.getElementById('syncBadge').style.display = 'flex';
        document.getElementById('syncText').textContent = 'Синхронизировано';
        
        setTimeout(() => {
            document.getElementById('syncBadge').style.display = 'none';
        }, 3000);
        
        console.log('Data synced to Firebase');
    } catch (error) {
        console.error('Firebase sync error:', error);
    }
}

async function loadFromFirebase() {
    if (!isFirebaseEnabled || !firebaseDB) return;
    
    try {
        const userId = 'user_' + (localStorage.getItem('user_id') || '');
        if (!userId || userId === 'user_') return;
        
        const doc = await firebaseDB.collection('crm_data').doc(userId).get();
        
        if (doc.exists) {
            const data = doc.data();
            
            // Check if cloud data is newer
            const localLastSave = localStorage.getItem('crm_last_save');
            if (!localLastSave || new Date(data.lastSync) > new Date(localLastSave)) {
                db.clients = data.clients || [];
                db.services = data.services || [];
                db.appointments = data.appointments || [];
                
                saveData();
                renderAll();
                
                showSuccess('✓ Данные загружены из облака');
            }
        }
    } catch (error) {
        console.error('Firebase load error:', error);
    }
}

function updateFirebaseStatus(enabled) {
    const statusEl = document.getElementById('firebaseStatus');
    if (enabled) {
        statusEl.textContent = 'Подключено ✓';
        statusEl.style.color = '#10b981';
        document.getElementById('syncBadge').style.display = 'flex';
    } else {
        statusEl.textContent = 'Не настроено';
        statusEl.style.color = '#666';
    }
}

function openFirebaseConfig() {
    document.getElementById('firebaseConfigModal').classList.add('active');
}

function closeFirebaseNotice() {
    document.getElementById('firebaseNotice').style.display = 'none';
    localStorage.setItem('firebase_notice_closed', 'true');
}

function saveFirebaseConfig(event) {
    event.preventDefault();
    
    firebaseConfig = {
        apiKey: document.getElementById('firebaseApiKey').value.trim(),
        authDomain: document.getElementById('firebaseAuthDomain').value.trim(),
        projectId: document.getElementById('firebaseProjectId').value.trim(),
        storageBucket: document.getElementById('firebaseStorageBucket').value.trim(),
        messagingSenderId: document.getElementById('firebaseMessagingSenderId').value.trim(),
        appId: document.getElementById('firebaseAppId').value.trim()
    };
    
    localStorage.setItem('firebase_config', JSON.stringify(firebaseConfig));
    
    closeModal('firebaseConfigModal');
    closeFirebaseNotice();
    
    // Initialize Firebase
    loadFirebaseSDK();
    
    showSuccess('✓ Firebase настроен. Загрузка библиотек...');
}

// Success message
function showSuccess(message) {
    const el = document.getElementById('successMessage');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => {
        el.classList.remove('show');
    }, 3000);
}

// Initialize app
function init() {
    loadData();
    updateOnlineStatus();
    loadFirebaseConfig();
    
    // Check if should show Firebase notice
    const noticeClosed = localStorage.getItem('firebase_notice_closed');
    if (noticeClosed || firebaseConfig) {
        document.getElementById('firebaseNotice').style.display = 'none';
    }
    
    // Add demo data if empty
    if (db.clients.length === 0 && db.services.length === 0) {
        addDemoData();
    }
    
    renderAll();
    renderCalendar();
}

function addDemoData() {
    db.services = [
        { id: 1, name: 'Верхняя губа', duration: 15, color: 'face', active: true },
        { id: 2, name: 'Подбородок', duration: 20, color: 'face', active: true },
        { id: 3, name: 'Виски', duration: 15, color: 'face', active: true },
        { id: 4, name: 'Подмышки', duration: 30, color: 'body', active: true },
        { id: 5, name: 'Бикини классика', duration: 40, color: 'bikini', active: true },
        { id: 6, name: 'Бикини глубокое', duration: 50, color: 'bikini', active: true },
        { id: 7, name: 'Половые губы', duration: 30, color: 'bikini', active: true },
        { id: 8, name: 'Ягодицы', duration: 45, color: 'body', active: true },
        { id: 9, name: 'Руки', duration: 60, color: 'body', active: true },
        { id: 10, name: 'Ноги', duration: 90, color: 'body', active: true },
        { id: 11, name: 'Пальцы ног', duration: 15, color: 'body', active: true },
        { id: 12, name: 'Пальцы рук', duration: 15, color: 'body', active: true },
        { id: 13, name: 'Живот', duration: 30, color: 'body', active: true },
        { id: 14, name: 'Ареолы', duration: 20, color: 'special', active: true }
    ];

    // db.clients = [
    //     { id: 1, name: 'Анна Петрова', phone: '+375 (29) 123-45-67', instagram: '@anna_p', notes: 'Чувствительная кожа', createdAt: Date.now() },
    //     { id: 2, name: 'Мария Иванова', phone: '+375 (33) 234-56-78', instagram: '', notes: '', createdAt: Date.now() }
    // ];

    // const today = new Date();
    // db.appointments = [
    //     {
    //         id: 1,
    //         clientId: 1,
    //         date: today.toISOString(),
    //         serviceIds: [1, 2],
    //         notes: 'Все прошло отлично',
    //         total: 50,
    //         duration: 35
    //     }
    // ];

    saveData();
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'calendar') {
        renderCalendar();
    }
    
    renderAll();
}

// Modal functions
function openAddClientModal() {
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientInstagram').value = '';
    document.getElementById('clientNotes').value = '';
    document.getElementById('addClientModal').classList.add('active');
}

function openAddServiceModal() {
    document.getElementById('serviceName').value = '';
    document.getElementById('serviceDuration').value = '';
    document.getElementById('serviceColor').value = 'face';
    document.getElementById('addServiceModal').classList.add('active');
}

function openAddAppointmentModal() {
    populateClientSelect();
    populateServicesCheckboxes();
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('appointmentDate').value = now.toISOString().slice(0, 16);
    document.getElementById('appointmentNotes').value = '';
    document.getElementById('appointmentTotal').value = '';
    
    document.querySelectorAll('#servicesCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    updateAppointmentDuration();
    
    document.getElementById('addAppointmentModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// CRUD operations
function addClient(event) {
    event.preventDefault();
    
    const client = {
        id: Date.now(),
        name: document.getElementById('clientName').value.trim(),
        phone: document.getElementById('clientPhone').value.trim(),
        instagram: document.getElementById('clientInstagram').value.trim(),
        notes: document.getElementById('clientNotes').value.trim(),
        createdAt: Date.now()
    };
    
    db.clients.push(client);
    
    if (saveData()) {
        showSuccess('✓ Клиент добавлен');
        closeModal('addClientModal');
        renderAll();
    }
}

function addService(event) {
    event.preventDefault();
    
    const service = {
        id: Date.now(),
        name: document.getElementById('serviceName').value.trim(),
        duration: parseInt(document.getElementById('serviceDuration').value),
        color: document.getElementById('serviceColor').value,
        active: true
    };
    
    db.services.push(service);
    
    if (saveData()) {
        showSuccess('✓ Услуга добавлена');
        closeModal('addServiceModal');
        renderAll();
    }
}

function addAppointment(event) {
    event.preventDefault();
    
    const selectedServices = Array.from(document.querySelectorAll('#servicesCheckboxes input:checked'))
        .map(cb => parseInt(cb.value));
    
    if (selectedServices.length === 0) {
        alert('Выберите хотя бы одну услугу');
        return;
    }
    
    const total = parseInt(document.getElementById('appointmentTotal').value) || 0;
    
    if (total === 0) {
        alert('Введите общую сумму');
        return;
    }
    
    const duration = selectedServices.reduce((sum, serviceId) => {
        const service = db.services.find(s => s.id === serviceId);
        return sum + (service ? service.duration : 0);
    }, 0);
    
    const appointment = {
        id: Date.now(),
        clientId: parseInt(document.getElementById('appointmentClient').value),
        date: document.getElementById('appointmentDate').value,
        serviceIds: selectedServices,
        notes: document.getElementById('appointmentNotes').value.trim(),
        total: total,
        duration: duration
    };
    
    db.appointments.push(appointment);
    
    if (saveData()) {
        showSuccess('✓ Процедура добавлена');
        closeModal('addAppointmentModal');
        renderAll();
        renderCalendar();
    }
}

function populateClientSelect() {
    const select = document.getElementById('appointmentClient');
    select.innerHTML = '<option value="">Выберите клиента</option>';
    
    db.clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        select.appendChild(option);
    });
}

function populateServicesCheckboxes() {
    const container = document.getElementById('servicesCheckboxes');
    container.innerHTML = '';
    
    const activeServices = db.services.filter(s => s.active);
    
    if (activeServices.length === 0) {
        container.innerHTML = '<p style="color: #999;">Добавьте услуги в раздел "Услуги"</p>';
        return;
    }
    
    activeServices.forEach(service => {
        const div = document.createElement('div');
        div.className = 'service-checkbox';
        div.innerHTML = `
            <input type="checkbox" value="${service.id}" id="service_${service.id}" onchange="updateAppointmentDuration()">
            <label class="service-checkbox-label" for="service_${service.id}">
                <span class="color-indicator color-${service.color}"></span>
                ${service.name} (${service.duration} мин)
            </label>
        `;
        container.appendChild(div);
    });
}

function updateAppointmentDuration() {
    const selectedServices = Array.from(document.querySelectorAll('#servicesCheckboxes input:checked'))
        .map(cb => parseInt(cb.value));
    
    const duration = selectedServices.reduce((sum, serviceId) => {
        const service = db.services.find(s => s.id === serviceId);
        return sum + (service ? service.duration : 0);
    }, 0);
    
    document.getElementById('appointmentDuration').textContent = `${duration} мин`;
}

// Calendar functions
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update header
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday = 0
    
    // Calendar grid
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    // Day headers
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        grid.appendChild(emptyDay);
    }
    
    // Days of month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        
        // Check if today
        if (dayDate.toDateString() === today.toDateString()) {
            dayEl.classList.add('today');
        }
        
        // Count appointments for this day
        const dayAppointments = db.appointments.filter(apt => {
            const aptDate = new Date(apt.date);
            return aptDate.getFullYear() === year &&
                   aptDate.getMonth() === month &&
                   aptDate.getDate() === day;
        });
        
        if (dayAppointments.length > 0) {
            dayEl.classList.add('has-appointments');
        }
        
        dayEl.innerHTML = `
            <div class="calendar-day-number">${day}</div>
            ${dayAppointments.length > 0 ? `<div class="calendar-day-count">${dayAppointments.length}</div>` : ''}
        `;
        
        dayEl.onclick = () => selectDay(dayDate);
        
        grid.appendChild(dayEl);
    }
    
    // Render selected day appointments
    renderSelectedDayAppointments();
}

function selectDay(date) {
    selectedDate = date;
    renderSelectedDayAppointments();
}

function renderSelectedDayAppointments() {
    const container = document.getElementById('selectedDayAppointments');
    
    const dayAppointments = db.appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate.toDateString() === selectedDate.toDateString();
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (dayAppointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Нет записей на ${selectedDate.toLocaleDateString('ru-RU')}</p>
                <button class="btn" onclick="openAddAppointmentModal()" style="margin-top: 20px;">Добавить запись</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = dayAppointments.map(appointment => {
        const client = db.clients.find(c => c.id === appointment.clientId);
        const services = appointment.serviceIds.map(id => db.services.find(s => s.id === id)).filter(s => s);
        const date = new Date(appointment.date);
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3>${client ? client.name : 'Неизвестный клиент'}</h3>
                    <span class="badge">${date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div style="margin: 10px 0;">
                    ${services.map(s => `<span class="service-tag"><span class="color-indicator color-${s.color}"></span>${s.name}</span>`).join('')}
                </div>
                <p>💰 ${appointment.total} ₽ • ⏱ ${appointment.duration} минут</p>
                ${appointment.notes ? `<p style="margin-top: 10px; font-style: italic; color: #999;">💬 ${appointment.notes}</p>` : ''}
            </div>
        `;
    }).join('');
}

function previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
}

function todayMonth() {
    currentCalendarDate = new Date();
    selectedDate = new Date();
    renderCalendar();
}

// Render functions
function renderAll() {
    renderDashboard();
    renderClients();
    renderAppointments();
    renderServices();
}

function renderDashboard() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthAppointments = db.appointments.filter(a => new Date(a.date) >= firstDayOfMonth);
    const monthRevenue = monthAppointments.reduce((sum, a) => sum + a.total, 0);
    
    document.getElementById('monthRevenue').textContent = `${monthRevenue.toLocaleString()} BYN`;
    document.getElementById('monthAppointments').textContent = monthAppointments.length;
    document.getElementById('totalClients').textContent = db.clients.length;
    
    const recent = db.appointments
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    const container = document.getElementById('recentAppointments');
    
    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Процедур пока нет</p>
                <button class="btn" onclick="openAddAppointmentModal()" style="margin-top: 20px;">Добавить первую процедуру</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recent.map(appointment => {
        const client = db.clients.find(c => c.id === appointment.clientId);
        const services = appointment.serviceIds.map(id => db.services.find(s => s.id === id)).filter(s => s);
        const date = new Date(appointment.date);
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3>${client ? client.name : 'Неизвестный клиент'}</h3>
                    <span class="badge">${appointment.total} ₽</span>
                </div>
                <p>📅 ${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</p>
                <p>✨ ${services.map(s => s.name).join(', ')}</p>
                <p>⏱ ${appointment.duration} минут</p>
            </div>
        `;
    }).join('');
}

function renderClients() {
    const container = document.getElementById('clientsList');
    
    if (db.clients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Клиентов пока нет</p>
            </div>
        `;
        return;
    }
    
    const clientsWithStats = db.clients.map(client => {
        const appointments = db.appointments.filter(a => a.clientId === client.id);
        const totalSpent = appointments.reduce((sum, a) => sum + a.total, 0);
        const lastVisit = appointments.length > 0 
            ? new Date(Math.max(...appointments.map(a => new Date(a.date))))
            : null;
        
        return {
            ...client,
            totalVisits: appointments.length,
            totalSpent,
            lastVisit
        };
    }).sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));
    
    container.innerHTML = clientsWithStats.map(client => `
        <div class="card" onclick="showClientDetails(${client.id})">
            <div class="card-header">
                <h3>${client.name}</h3>
                ${client.totalVisits > 5 ? '<span class="badge badge-success">VIP</span>' : ''}
            </div>
            <p>📱 ${client.phone}</p>
            ${client.instagram ? `<p>📸 ${client.instagram}</p>` : ''}
            <p>💰 Потрачено: ${client.totalSpent.toLocaleString()} BYN</p>
            <p>📊 Визитов: ${client.totalVisits}</p>
            ${client.lastVisit ? `<p>📅 Последний визит: ${client.lastVisit.toLocaleDateString('ru-RU')}</p>` : '<p>📅 Еще не было визитов</p>'}
            ${client.notes ? `<p style="margin-top: 10px; font-style: italic; color: #999;">💬 ${client.notes}</p>` : ''}
        </div>
    `).join('');
}

function searchClients() {
    const query = document.getElementById('clientSearch').value.toLowerCase();
    const cards = document.querySelectorAll('#clientsList .card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
    });
}

function showClientDetails(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return;
    
    const appointments = db.appointments
        .filter(a => a.clientId === clientId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const totalSpent = appointments.reduce((sum, a) => sum + a.total, 0);
    
    document.getElementById('clientDetailsName').textContent = client.name;
    
    const content = `
        <div style="margin-bottom: 20px;">
            <p><strong>Телефон:</strong> ${client.phone}</p>
            ${client.instagram ? `<p><strong>Instagram:</strong> ${client.instagram}</p>` : ''}
            ${client.notes ? `<p><strong>Заметки:</strong> ${client.notes}</p>` : ''}
            <p><strong>Всего визитов:</strong> ${appointments.length}</p>
            <p><strong>Всего потрачено:</strong> ${totalSpent.toLocaleString()} BYN</p>
        </div>
        
        <h3 style="margin-bottom: 15px; color: #333;">История процедур</h3>
        ${appointments.length === 0 ? '<p style="color: #999;">Процедур пока нет</p>' : appointments.map(appointment => {
            const services = appointment.serviceIds.map(id => db.services.find(s => s.id === id)).filter(s => s);
            const date = new Date(appointment.date);
            
            return `
                <div class="history-item">
                    <div class="history-date">${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</div>
                    <div style="margin: 8px 0;">
                        ${services.map(s => `<span class="service-tag">${s.name}</span>`).join('')}
                    </div>
                    ${appointment.notes ? `<p style="margin: 8px 0; color: #666;">${appointment.notes}</p>` : ''}
                    <div style="font-weight: 600; color: #333;">Итого: ${appointment.total} BYN • ${appointment.duration} мин</div>
                </div>
            `;
        }).join('')}
    `;
    
    document.getElementById('clientDetailsContent').innerHTML = content;
    document.getElementById('clientDetailsModal').classList.add('active');
}

function renderAppointments() {
    const container = document.getElementById('appointmentsList');
    
    if (db.appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Процедур пока нет</p>
            </div>
        `;
        return;
    }
    
    const appointments = db.appointments
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = appointments.map(appointment => {
        const client = db.clients.find(c => c.id === appointment.clientId);
        const services = appointment.serviceIds.map(id => db.services.find(s => s.id === id)).filter(s => s);
        const date = new Date(appointment.date);
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3>${client ? client.name : 'Неизвестный клиент'}</h3>
                    <span class="badge">${appointment.total} ₽</span>
                </div>
                <p>📅 ${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</p>
                <div style="margin: 10px 0;">
                    ${services.map(s => `<span class="service-tag"><span class="color-indicator color-${s.color}"></span>${s.name}</span>`).join('')}
                </div>
                <p>⏱ ${appointment.duration} минут</p>
                ${appointment.notes ? `<p style="margin-top: 10px; font-style: italic; color: #999;">💬 ${appointment.notes}</p>` : ''}
            </div>
        `;
    }).join('');
}

function renderServices() {
    const container = document.getElementById('servicesList');
    
    if (db.services.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Услуг пока нет</p>
            </div>
        `;
        return;
    }
    
    const grouped = {
        face: [],
        body: [],
        bikini: [],
        special: []
    };
    
    db.services.forEach(service => {
        if (grouped[service.color]) {
            grouped[service.color].push(service);
        }
    });
    
    const colorNames = {
        face: '🟣 Лицо',
        body: '🟢 Тело',
        bikini: '🟠 Бикини',
        special: '🔵 Спецзоны'
    };
    
    let html = '';
    
    Object.keys(grouped).forEach(color => {
        if (grouped[color].length > 0) {
            html += `<h3 style="margin: 20px 0 15px 0; color: #333;">${colorNames[color]}</h3>`;
            html += grouped[color].map(service => `
                <div class="card">
                    <div class="card-header">
                        <h3>${service.name}</h3>
                        <span class="badge">${service.price} ₽</span>
                    </div>
                    <p>⏱ ${service.duration} минут</p>
                </div>
            `).join('');
        }
    });
    
    container.innerHTML = html;
}

// Export/Import
function exportData() {
    const data = {
        clients: db.clients,
        services: db.services,
        appointments: db.appointments,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    showSuccess('✓ Данные экспортированы');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (confirm('Импорт заменит все текущие данные. Продолжить?')) {
                db.clients = data.clients || [];
                db.services = data.services || [];
                db.appointments = data.appointments || [];
                
                saveData();
                renderAll();
                renderCalendar();
                
                showSuccess('✓ Данные импортированы');
            }
        } catch (error) {
            alert('Ошибка при импорте данных. Проверьте файл.');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('Вы уверены? Все данные будут удалены безвозвратно!')) {
        if (confirm('Это действие необратимо! Продолжить?')) {
            db = { clients: [], services: [], appointments: [] };
            saveData();
            renderAll();
            renderCalendar();
            showSuccess('✓ Все данные удалены');
        }
    }
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
