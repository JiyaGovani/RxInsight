// user_dashboard.js - All JS for user dashboard

// --- Image Fallback, Nav Toggle, View Switching ---
(function () {
    function replaceImageWithAlt(img) {
        if (!img || img.dataset.fallbackApplied === 'true') return;
        const altText = (img.getAttribute('alt') || 'Image').trim();
        const size = img.getAttribute('data-fallback-size') || 'sm';

        const fallback = document.createElement('span');
        fallback.className = 'rx-img-fallback rx-img-fallback-' + size;
        fallback.textContent = altText;

        img.dataset.fallbackApplied = 'true';
        img.replaceWith(fallback);
    }

    document.querySelectorAll('img.rx-fallback-img').forEach((img) => {
        img.addEventListener('error', () => replaceImageWithAlt(img));
        if (img.complete && img.naturalWidth === 0) {
            replaceImageWithAlt(img);
        }
    });

    const navToggle = document.getElementById('rxNavToggle');
    const navMenu = document.getElementById('rxNavMenu');
    const actionList = document.getElementById('rxActionList');

    function setNavOpen(isOpen) {
        if (!navToggle || !navMenu) return;
        navToggle.setAttribute('aria-expanded', String(isOpen));
        navMenu.classList.toggle('rx-nav-open', isOpen);
    }

    function switchView(viewName) {
        if (viewName === 'logout') { window.location.href = '/logout'; return; }

        document.querySelectorAll('.dashboard-content-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === 'view-' + viewName);
        });

        document.querySelectorAll('.dashboard-sidebar-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-view') === viewName);
        });

        // Load active medications when active-prescription view is selected
        if (viewName === 'active-prescription') {
            loadActiveMedications();
        }
        
        // Load prescription history when history view is selected
        if (viewName === 'history') {
            loadPrescriptionHistory();
        }

        if (viewName === 'profile' && typeof window.loadUserProfile === 'function') {
            window.loadUserProfile();
        }
    }

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
            setNavOpen(!isOpen);
        });
    }

    if (actionList) {
        actionList.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-view]');
            if (!button) return;
            switchView(button.getAttribute('data-view'));
        });
    }

    // Hook topbar shortcuts
    const topbarActiveMeds = document.getElementById('rxTopbarActiveMeds');
    if (topbarActiveMeds) topbarActiveMeds.addEventListener('click', (e) => { e.preventDefault(); switchView('active-prescription'); });
    const topbarReminders = document.getElementById('rxTopbarReminders');
    if (topbarReminders) topbarReminders.addEventListener('click', (e) => { e.preventDefault(); switchView('set-reminder'); });
    const topbarProfile = document.getElementById('rxTopbarProfile');
    if (topbarProfile) topbarProfile.addEventListener('click', (e) => { e.preventDefault(); switchView('profile'); });

    const initialView = new URLSearchParams(window.location.search).get('view');
    if (initialView) {
        switchView(initialView);
    }

    // Close mobile menu on resize up
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) setNavOpen(false);
    });

    // Load active medications when view is activated
    async function loadActiveMedications() {
        const alert = document.getElementById('activeMedicationsAlert');
        const list = document.getElementById('activeMedicationsList');
        if (!alert || !list) return;

        try {
            const response = await fetch('/reminders');
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load medications');

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const activeReminders = (data.reminders || []).filter(r => {
                if (r.status !== 'pending') return false;
                
                const endDate = new Date(r.end_date);
                endDate.setHours(0, 0, 0, 0);
                
                return endDate >= today;
            });

            if (activeReminders.length === 0) {
                alert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>No active medications at this time.';
                list.innerHTML = '';
                return;
            }

            alert.innerHTML = `<i class="fa-solid fa-circle-info me-2"></i>You have ${activeReminders.length} active medication${activeReminders.length > 1 ? 's' : ''}.`;

            list.innerHTML = activeReminders.map(med => {
                const frequencies = (med.frequency || []).join(', ');
                const times = (med.time_setters || []).map(t => window.formatTime12Hour(t)).join(', ');
                return `
                    <div class="card border-0 shadow-sm mb-3" style="background: rgba(255,255,255,0.7);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h5 class="card-title fw-bold" style="color: var(--secondary-color);">
                                        <i class="fa-solid fa-capsules me-2" style="color: var(--primary-color);"></i>${med.medicine_name}
                                    </h5>
                                    <p class="card-text text-muted small">
                                        <i class="fa-regular fa-calendar me-1"></i>Started: ${med.start_date}
                                    </p>
                                </div>
                                <span class="badge bg-success">Active</span>
                            </div>
                            <hr>
                            <div class="row">
                                <div class="col-md-6 mb-2">
                                    <strong>Time Slots:</strong> ${frequencies}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Time:</strong> ${times}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>End Date:</strong> ${med.end_date}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Duration:</strong> ${med.number_of_days} days
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            alert.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i>Error loading medications: ${err.message}`;
            alert.className = 'alert alert-danger';
            list.innerHTML = '';
        }
    }

    // Load for default view on page load
    loadActiveMedications();
    updateKPIs();
    
    // Helper function to convert 24-hour time to 12-hour format
    function formatTime12Hour(time24) {
        if (!time24 || time24 === '--:--') return '--:--';
        
        const [hours24, minutes] = time24.split(':').map(Number);
        const period = hours24 >= 12 ? 'PM' : 'AM';
        const hours12 = hours24 % 12 || 12;
        
        return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    }
    
    // Update KPI values dynamically
    async function updateKPIs() {
        try {
            // Fetch reminders to count active medications
            const remindersResponse = await fetch('/reminders');
            const remindersData = await remindersResponse.json();
            
            if (remindersResponse.ok && remindersData.success) {
                const now = new Date();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const currentHours = now.getHours();
                const currentMinutes = now.getMinutes();
                const currentTimeInMinutes = currentHours * 60 + currentMinutes;
                
                const activeReminders = (remindersData.reminders || []).filter(r => {
                    if (r.status !== 'pending') return false;
                    const endDate = new Date(r.end_date);
                    endDate.setHours(0, 0, 0, 0);
                    return endDate >= today;
                });
                
                const activeCount = activeReminders.length;
                
                // Find next dose time
                let nextDoseTime = null;
                let minDiff = Infinity;
                
                activeReminders.forEach(reminder => {
                    const times = reminder.time_setters || [];
                    times.forEach(timeStr => {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        const timeInMinutes = hours * 60 + minutes;
                        const diff = timeInMinutes - currentTimeInMinutes;
                        
                        if (diff > 0 && diff < minDiff) {
                            minDiff = diff;
                            nextDoseTime = timeStr.substring(0, 5); // HH:MM format
                        }
                    });
                });
                
                // Update Active Meds KPI
                const kpiLabels = document.querySelectorAll('.rx-kpi-label');
                kpiLabels.forEach(label => {
                    if (label.textContent.trim() === 'Active Meds') {
                        const kpiValue = label.parentElement.querySelector('.rx-kpi-value');
                        if (kpiValue) kpiValue.textContent = activeCount;
                    }
                    if (label.textContent.trim() === 'Next Dose') {
                        const kpiValue = label.parentElement.querySelector('.rx-kpi-value');
                        if (kpiValue) kpiValue.textContent = formatTime12Hour(nextDoseTime) || '--:--';
                    }
                });
                
                // Calculate adherence percentage
                const allReminders = remindersData.reminders || [];
                const takenCount = allReminders.filter(r => r.status === 'taken').length;
                const missedCount = allReminders.filter(r => r.status === 'missed').length;
                const totalDoses = takenCount + missedCount;
                
                const adherencePercent = totalDoses > 0 
                    ? Math.round((takenCount / totalDoses) * 100) 
                    : 0;
                
                // Update Adherence KPI
                kpiLabels.forEach(label => {
                    if (label.textContent.trim() === 'Adherence') {
                        const kpiValue = label.parentElement.querySelector('.rx-kpi-value');
                        if (kpiValue) kpiValue.textContent = adherencePercent + '%';
                    }
                });
            }
            
            // Fetch prescriptions to count total
            const prescriptionsResponse = await fetch('/prescriptions/history');
            const prescriptionsData = await prescriptionsResponse.json();
            
            if (prescriptionsResponse.ok && prescriptionsData.success) {
                const totalCount = (prescriptionsData.prescriptions || []).length;
                
                // Update Total Prescriptions KPI
                const kpiLabels = document.querySelectorAll('.rx-kpi-label');
                kpiLabels.forEach(label => {
                    if (label.textContent.trim() === 'Total Prescriptions') {
                        const kpiValue = label.parentElement.querySelector('.rx-kpi-value');
                        if (kpiValue) kpiValue.textContent = totalCount;
                    }
                });
            }
        } catch (err) {
            console.error('Error updating KPIs:', err);
        }
    }
    
    // Make updateKPIs and formatTime12Hour globally accessible
    window.updateDashboardKPIs = updateKPIs;
    window.formatTime12Hour = formatTime12Hour;
    
    // Load prescription history function
    async function loadPrescriptionHistory() {
        const alert = document.getElementById('historyAlert');
        const list = document.getElementById('historyList');
        if (!alert || !list) return;

        try {
            const response = await fetch('/prescriptions/history');
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load history');

            const prescriptions = data.prescriptions || [];

            if (prescriptions.length === 0) {
                alert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>No prescription history found.';
                list.innerHTML = '';
                return;
            }

            alert.innerHTML = `<i class="fa-solid fa-circle-info me-2"></i>You have ${prescriptions.length} prescription${prescriptions.length > 1 ? 's' : ''} in your history.`;

            list.innerHTML = prescriptions.map(prescription => {
                const uploadDate = new Date(prescription.upload_date);
                const formattedDate = uploadDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });

                const medicinesList = prescription.medicines.map(med => `
                    <div class="row mb-2">
                        <div class="col-md-6">
                            <strong><i class="fa-solid fa-capsules me-2" style="color: var(--primary-color);"></i>${med.medicine_name}</strong>
                        </div>
                        <div class="col-md-6">
                            <span class="text-muted small">Dosage: ${med.dosage || 'N/A'}</span>
                        </div>
                        <div class="col-md-6">
                            <span class="text-muted small">Time Slots: ${med.frequency || 'N/A'}</span>
                        </div>
                        <div class="col-md-6">
                            <span class="text-muted small">Duration: ${med.duration || 'N/A'}</span>
                        </div>
                    </div>
                `).join('');

                return `
                    <div class="card border-0 shadow-sm mb-3" style="background: rgba(255,255,255,0.7);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h5 class="card-title fw-bold" style="color: var(--secondary-color);">
                                        <i class="fa-solid fa-file-medical me-2" style="color: var(--primary-color);"></i>Prescription #${prescription.prescription_id}
                                    </h5>
                                    <p class="card-text text-muted small">
                                        <i class="fa-regular fa-calendar me-1"></i>Uploaded on: ${formattedDate}
                                    </p>
                                </div>
                            </div>
                            <hr>
                            <h6 class="mb-3" style="color: var(--secondary-color);">Medicines:</h6>
                            ${medicinesList}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            alert.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i>Error loading history: ${err.message}`;
            alert.className = 'alert alert-danger';
            list.innerHTML = '';
        }
    }
})();

// --- Profile Load/Update Logic ---
(function () {
    const profileForm = document.getElementById('profileForm');
    const profileMsg = document.getElementById('profileMsg');
    const profileUsername = document.getElementById('profileUsername');
    const profileEmail = document.getElementById('profileEmail');
    const profileContactNumber = document.getElementById('profileContactNumber');
    const profileEmergencyContact = document.getElementById('profileEmergencyContact');
    const profileDateOfBirth = document.getElementById('profileDateOfBirth');
    const profileWeight = document.getElementById('profileWeight');
    const profileHeight = document.getElementById('profileHeight');
    const navbarUsername = document.getElementById('rxNavbarUsername');
    const welcomeUsername = document.getElementById('rxWelcomeUsername');

    if (!profileForm) return;

    let profileLoadedOnce = false;

    function setProfileMessage(text, color) {
        if (!profileMsg) return;
        profileMsg.textContent = text || '';
        profileMsg.style.color = color || '';
    }

    function mapRole(role) {
        return Number(role) === 1 ? 'Admin' : 'User';
    }

    function fillProfileForm(user) {
        if (!user) return;
        if (profileUsername) profileUsername.value = user.username ?? '';
        if (profileEmail) profileEmail.value = user.email ?? '';
        if (profileContactNumber) profileContactNumber.value = user.contact_number ?? '';
        if (profileEmergencyContact) profileEmergencyContact.value = user.emergency_contact ?? '';
        if (profileDateOfBirth) profileDateOfBirth.value = user.date_of_birth ?? '';
        if (profileWeight) profileWeight.value = user.weight ?? '';
        if (profileHeight) profileHeight.value = user.height ?? '';

        const liveUsername = user.username ?? '';
        if (navbarUsername) navbarUsername.textContent = liveUsername;
        if (welcomeUsername) welcomeUsername.textContent = liveUsername;
    }

    async function loadUserProfile(force = false) {
        if (profileLoadedOnce && !force) return;

        try {
            setProfileMessage('Loading profile...', '#6c757d');
            const response = await fetch('/auth/profile');
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to load profile');
            }

            fillProfileForm(data.user);
            profileLoadedOnce = true;
            setProfileMessage('');
        } catch (err) {
            setProfileMessage(`Error: ${err.message}`, '#dc3545');
        }
    }

    window.loadUserProfile = loadUserProfile;

    profileForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!profileForm.checkValidity()) {
            profileForm.reportValidity();
            return;
        }

        const payload = {
            username: profileUsername ? profileUsername.value.trim() : '',
            email: profileEmail ? profileEmail.value.trim() : '',
            contact_number: profileContactNumber ? profileContactNumber.value.trim() : '',
            emergency_contact: profileEmergencyContact ? profileEmergencyContact.value.trim() : '',
            date_of_birth: profileDateOfBirth ? profileDateOfBirth.value : '',
            weight: profileWeight ? Number(profileWeight.value) : '',
            height: profileHeight ? Number(profileHeight.value) : '',
        };

        try {
            setProfileMessage('Saving changes...', '#6c757d');
            const response = await fetch('/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to update profile');
            }

            fillProfileForm(data.user);
            profileLoadedOnce = true;
            setProfileMessage('Profile updated successfully.', '#198754');
        } catch (err) {
            setProfileMessage(`Error: ${err.message}`, '#dc3545');
        }
    });
})();

// --- Set Reminder Dynamic Time Setters (Vanilla JS) ---
(function () {
    const reminderForm = document.getElementById('setReminderForm');
    const medicineNameInput = reminderForm ? reminderForm.querySelector('input[type="text"]') : null;
    const reminderDaysInput = document.getElementById('reminderDays');
    const frequencyCheckboxes = document.querySelectorAll('.reminder-frequency');
    const missedDoseCheckbox = document.getElementById('missedDoseReminder');
    const reminderMsg = document.getElementById('setReminderMsg');
    const reminderFilterGroup = document.getElementById('reminderFilterGroup');
    const reminderFilterButtons = document.querySelectorAll('.reminder-filter');
    const remindersList = document.getElementById('remindersList');
    const timeSettersContainer = document.getElementById('timeSettersContainer');
    const timeSettersList = document.getElementById('timeSettersList');
    const reminderAlertModalEl = document.getElementById('reminderAlertModal');
    const reminderAlertMedicine = document.getElementById('reminderAlertMedicine');
    const reminderAlertTime = document.getElementById('reminderAlertTime');
    const reminderAlertTakenBtn = document.getElementById('reminderAlertTakenBtn');

    if (!reminderForm || !medicineNameInput || !reminderDaysInput || !frequencyCheckboxes.length || !timeSettersContainer || !timeSettersList) return;

    let currentReminderFilter = 'all';
    let allReminders = [];
    let popupQueue = [];
    let activePopup = null;
    let reminderBeepTimer = null;

    const shownPopupKeys = new Set(
        JSON.parse(sessionStorage.getItem('shownReminderPopupKeys') || '[]')
    );

    const reminderAlertModal = reminderAlertModalEl && window.bootstrap
        ? new window.bootstrap.Modal(reminderAlertModalEl)
        : null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const reminderAudioContext = AudioContextClass ? new AudioContextClass() : null;

    function unlockReminderAudio() {
        if (reminderAudioContext && reminderAudioContext.state === 'suspended') {
            reminderAudioContext.resume().catch(() => { });
        }
    }

    ['click', 'keydown', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, unlockReminderAudio, { once: true, passive: true });
    });

    async function playReminderSound() {
        if (!reminderAudioContext) return;

        if (reminderAudioContext.state === 'suspended') {
            try {
                await reminderAudioContext.resume();
            } catch {
                return;
            }
        }

        const gainNode = reminderAudioContext.createGain();
        const osc1 = reminderAudioContext.createOscillator();
        const osc2 = reminderAudioContext.createOscillator();
        const startAt = reminderAudioContext.currentTime + 0.01;

        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(0.45, startAt + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
        gainNode.gain.setValueAtTime(0.0001, startAt + 0.32);
        gainNode.gain.exponentialRampToValueAtTime(0.45, startAt + 0.35);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.62);

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1046.5, startAt);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, startAt + 0.32);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(reminderAudioContext.destination);

        osc1.start(startAt);
        osc1.stop(startAt + 0.29);
        osc2.start(startAt + 0.32);
        osc2.stop(startAt + 0.63);
    }

    function stopReminderBeepLoop() {
        if (reminderBeepTimer) {
            clearInterval(reminderBeepTimer);
            reminderBeepTimer = null;
        }
    }

    function startReminderBeepLoop() {
        stopReminderBeepLoop();
        playReminderSound().catch(() => { });
        reminderBeepTimer = setInterval(() => {
            playReminderSound().catch(() => { });
        }, 900);
    }

    function saveShownPopupKeys() {
        sessionStorage.setItem('shownReminderPopupKeys', JSON.stringify(Array.from(shownPopupKeys)));
    }

    function getTodayKey() {
        return new Date().toISOString().slice(0, 10);
    }

    function formatNowHHMM() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    function normalizeTime(value) {
        return String(value || '').slice(0, 5);
    }

    async function updateReminderStatus(reminderId, status) {
        const response = await fetch(`/reminders/${reminderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update status');
        }
    }

    function showNextReminderPopup() {
        if (!reminderAlertModal || activePopup || popupQueue.length === 0) return;

        activePopup = popupQueue.shift();
        if (reminderAlertMedicine) reminderAlertMedicine.textContent = activePopup.medicine_name || '-';
        if (reminderAlertTime) reminderAlertTime.textContent = window.formatTime12Hour(activePopup.matchedTime) || '-';
        reminderAlertModal.show();
    }

    function enqueueDueReminderPopups() {
        const nowHHMM = formatNowHHMM();
        const todayKey = getTodayKey();

        allReminders
            .filter((item) => item.status === 'pending')
            .forEach((item) => {
                const times = Array.isArray(item.time_setters) ? item.time_setters : [];
                times.forEach((timeValue) => {
                    const hhmm = normalizeTime(timeValue);
                    const popupKey = `${todayKey}:${item.reminder_id}:${hhmm}`;
                    
                    if (hhmm === nowHHMM && !shownPopupKeys.has(popupKey)) {
                        shownPopupKeys.add(popupKey);
                        saveShownPopupKeys();
                        popupQueue.push({ ...item, matchedTime: hhmm });
                    }
                });
            });

        showNextReminderPopup();
    }

    function getStatusBadgeClass(status) {
        if (status === 'taken') return 'bg-success';
        if (status === 'missed') return 'bg-danger';
        return 'bg-warning text-dark';
    }

    function renderReminders(items) {
        if (!remindersList) return;

        remindersList.innerHTML = '';

        const filteredItems = Array.isArray(items)
            ? items.filter((item) => currentReminderFilter === 'all' || item.status === currentReminderFilter)
            : [];

        if (!filteredItems.length) {
            remindersList.innerHTML = '<div class="text-muted small">No reminders yet.</div>';
            return;
        }

        filteredItems.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'card border-0 shadow-sm';
            card.style.background = 'rgba(255,255,255,0.75)';

            const frequencies = (item.frequency || []).join(', ');
            const times = (item.time_setters || []).join(', ');

            let actions = '';
            if (item.status === 'pending') {
                actions = `
                    <div class="d-flex gap-2 mt-2">
                        <button class="btn btn-sm btn-success reminder-action" data-id="${item.reminder_id}" data-status="taken">Taken</button>
                        <button class="btn btn-sm btn-outline-danger reminder-action" data-id="${item.reminder_id}" data-status="missed">✕</button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="card-body py-2 px-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <strong style="color: var(--secondary-color);">${item.medicine_name}</strong>
                        <span class="badge ${getStatusBadgeClass(item.status)}">${item.status}</span>
                    </div>
                    <div class="small text-muted">Days: ${item.number_of_days} | ${item.start_date} to ${item.end_date}</div>
                    <div class="small text-muted">Time Slots: ${frequencies}</div>
                    <div class="small text-muted">Time: ${times}</div>
                    ${actions}
                </div>
            `;

            remindersList.appendChild(card);
        });
    }

    function setActiveFilterButton() {
        reminderFilterButtons.forEach((button) => {
            const isActive = button.getAttribute('data-filter') === currentReminderFilter;
            button.classList.toggle('active', isActive);
        });
    }

    async function loadReminders() {
        if (!remindersList) return;
        try {
            const response = await fetch('/reminders');
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load reminders');
            allReminders = data.reminders || [];
            renderReminders(allReminders);
            enqueueDueReminderPopups();
            // Update KPIs after reminders are loaded
            if (window.updateDashboardKPIs) window.updateDashboardKPIs();
        } catch (err) {
            remindersList.innerHTML = `<div class="text-danger small">${err.message}</div>`;
        }
    }

    if (remindersList) {
        remindersList.addEventListener('click', async function (event) {
            const button = event.target.closest('.reminder-action');
            if (!button) return;

            const reminderId = button.getAttribute('data-id');
            const status = button.getAttribute('data-status');

            try {
                await updateReminderStatus(reminderId, status);
                await loadReminders();
            } catch (err) {
                if (reminderMsg) {
                    reminderMsg.textContent = `Error: ${err.message}`;
                    reminderMsg.style.color = '#dc3545';
                }
            }
        });
    }

    if (reminderFilterGroup) {
        reminderFilterGroup.addEventListener('click', async function (event) {
            const button = event.target.closest('.reminder-filter');
            if (!button) return;
            currentReminderFilter = button.getAttribute('data-filter') || 'all';
            setActiveFilterButton();
            await loadReminders();
        });
    }

    function renderTimeSetters() {
        const selected = Array.from(frequencyCheckboxes)
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.value);

        timeSettersContainer.style.display = selected.length > 0 ? '' : 'none';

        timeSettersList.innerHTML = '';

        selected.forEach((label) => {
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center gap-2 mb-2';
            row.innerHTML = `
                <span style="min-width: 90px; color: var(--secondary-color); font-weight: 600;">${label}</span>
                <div class="d-flex gap-1">
                    <select class="form-select form-select-sm reminder-hour-${label.toLowerCase()}" style="width: 70px;" required>
                        <option value="">HH</option>
                        ${Array.from({length: 12}, (_, i) => i + 1).map(h => `<option value="${h}">${String(h).padStart(2, '0')}</option>`).join('')}
                    </select>
                    <span class="align-self-center">:</span>
                    <select class="form-select form-select-sm reminder-minute-${label.toLowerCase()}" style="width: 70px;" required>
                        <option value="">MM</option>
                        ${Array.from({length: 60}, (_, i) => i).map(m => `<option value="${m}">${String(m).padStart(2, '0')}</option>`).join('')}
                    </select>
                    <select class="form-select form-select-sm reminder-period-${label.toLowerCase()}" style="width: 70px;" required>
                        <option value="">--</option>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                </div>
            `;
            timeSettersList.appendChild(row);
        });
    }

    frequencyCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', renderTimeSetters);
    });

    reminderForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!reminderForm.checkValidity()) {
            reminderForm.reportValidity();
            return;
        }

        const selectedFrequencies = Array.from(frequencyCheckboxes)
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.value);

        if (selectedFrequencies.length === 0) {
            if (reminderMsg) {
                reminderMsg.textContent = 'Please select at least one time slot.';
                reminderMsg.style.color = '#dc3545';
            }
            return;
        }

        const timeSetters = selectedFrequencies.map((label) => {
            const hourSelect = reminderForm.querySelector(`.reminder-hour-${label.toLowerCase()}`);
            const minuteSelect = reminderForm.querySelector(`.reminder-minute-${label.toLowerCase()}`);
            const periodSelect = reminderForm.querySelector(`.reminder-period-${label.toLowerCase()}`);
            
            if (!hourSelect || !minuteSelect || !periodSelect) return '';
            
            const hour = parseInt(hourSelect.value);
            const minute = parseInt(minuteSelect.value);
            const period = periodSelect.value;
            
            if (!hour || isNaN(minute) || !period) return '';
            
            // Convert 12-hour to 24-hour format
            let hour24 = hour;
            if (period === 'PM' && hour !== 12) {
                hour24 = hour + 12;
            } else if (period === 'AM' && hour === 12) {
                hour24 = 0;
            }
            
            return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        });

        if (timeSetters.some((value) => !value)) {
            if (reminderMsg) {
                reminderMsg.textContent = 'Please set time for each selected time slot.';
                reminderMsg.style.color = '#dc3545';
            }
            return;
        }

        const payload = {
            medicine_name: medicineNameInput.value.trim(),
            number_of_days: Number(reminderDaysInput.value),
            frequency: selectedFrequencies,
            time_setters: timeSetters,
            missed_dose_reminder: missedDoseCheckbox ? missedDoseCheckbox.checked : false,
        };

        try {
            const response = await fetch('/set-reminder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Failed (status ${response.status})`);
            }

            if (reminderMsg) {
                reminderMsg.textContent = 'Reminder set successfully.';
                reminderMsg.style.color = '#198754';
            }

            reminderForm.reset();
            renderTimeSetters();
            await loadReminders();
        } catch (err) {
            if (reminderMsg) {
                reminderMsg.textContent = `Error: ${err.message}`;
                reminderMsg.style.color = '#dc3545';
            }
        }
    });

    if (reminderAlertModalEl) {
        reminderAlertModalEl.addEventListener('shown.bs.modal', function () {
            startReminderBeepLoop();
        });
    }

    if (reminderAlertTakenBtn && reminderAlertModalEl) {
        reminderAlertTakenBtn.addEventListener('click', async function () {
            stopReminderBeepLoop();
            if (!activePopup) return;
            try {
                await updateReminderStatus(activePopup.reminder_id, 'taken');
                activePopup = null;
                reminderAlertModal.hide();
                await loadReminders();
            } catch (err) {
                if (reminderMsg) {
                    reminderMsg.textContent = `Error: ${err.message}`;
                    reminderMsg.style.color = '#dc3545';
                }
            }
        });

        reminderAlertModalEl.addEventListener('hidden.bs.modal', async function () {
            stopReminderBeepLoop();
            if (activePopup) {
                try {
                    await updateReminderStatus(activePopup.reminder_id, 'missed');
                } catch (err) {
                    if (reminderMsg) {
                        reminderMsg.textContent = `Error: ${err.message}`;
                        reminderMsg.style.color = '#dc3545';
                    }
                }
                activePopup = null;
                await loadReminders();
            }

            showNextReminderPopup();
        });
    }

    renderTimeSetters();
    setActiveFilterButton();
    loadReminders();
    
    // Check for due reminders every 15 seconds
    setInterval(enqueueDueReminderPopups, 15000);
})();

// --- Prescription Upload Logic ---
(function () {
    const browseBtn = document.getElementById('browsePrescriptionBtn');
    const fileInput = document.getElementById('prescriptionFileInput');
    const msgDiv = document.getElementById('uploadPrescriptionMsg');
    const cardsSection = document.getElementById('medicineCardsSection');
    const cardsContainer = document.getElementById('medicineCardsContainer');

    if (!browseBtn || !fileInput || !msgDiv) return;

    function safeText(value) {
        if (value === null || value === undefined || value === '') return 'N/A';
        return String(value);
    }

    function renderMedicineCards(medicines) {
        if (!cardsSection || !cardsContainer) return;

        cardsContainer.innerHTML = '';

        if (!Array.isArray(medicines) || medicines.length === 0) {
            cardsSection.style.display = 'none';
            return;
        }

        medicines.forEach((medicine) => {
            const col = document.createElement('div');
            col.className = 'col-12 col-md-6';

            const rawUrl = medicine.url && String(medicine.url).trim();
            let buyLink = '';
            if (rawUrl) {
                const links = rawUrl
                    .split(',')
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0);

                if (links.length > 0) {
                    const linksHtml = links
                        .map((entry) => `<a href="${encodeURI(entry)}" target="_blank" rel="noopener noreferrer" class="rx-medicine-link d-block">${safeText(entry)}</a>`)
                        .join('');
                    buyLink = `<p class="rx-medicine-meta mb-0"><strong>Links:</strong></p>${linksHtml}`;
                }
            }

            col.innerHTML = `
                <div class="card h-100 rx-medicine-card">
                    <div class="card-body">
                        <h6 class="card-title mb-3 rx-medicine-name">${safeText(medicine.name)}</h6>
                        <p class="rx-medicine-meta"><strong>Dose Form:</strong> ${safeText(medicine.dose_form)}</p>
                        <p class="rx-medicine-meta"><strong>Composition:</strong> ${safeText(medicine.composition)}</p>
                        <p class="rx-medicine-meta"><strong>Uses:</strong> ${safeText(medicine.uses)}</p>
                        <p class="rx-medicine-meta"><strong>Side Effects:</strong> ${safeText(medicine.side_effect)}</p>
                        <p class="rx-medicine-meta"><strong>Interactions:</strong> ${safeText(medicine.drug_interactions)}</p>
                        ${buyLink}
                    </div>
                </div>
            `;

            cardsContainer.appendChild(col);
        });

        cardsSection.style.display = 'block';
    }

    // Click "Browse Files" -> open file picker
    browseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        fileInput.value = '';
        fileInput.click();
    });

    // When a file is selected -> upload it
    fileInput.addEventListener('change', async function () {
        msgDiv.textContent = '';

        if (!fileInput.files || fileInput.files.length === 0) return;

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('image', file);

        msgDiv.textContent = 'Uploading...';
        msgDiv.style.color = 'gray';

        try {
            const response = await fetch('/upload-prescription', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed (status ' + response.status + ')');

            const data = await response.json();

            if (data.success) {
                msgDiv.textContent = 'Upload successful!';
                msgDiv.style.color = 'green';
                renderMedicineCards(data.medicines || []);
                if (window.updateDashboardKPIs) {
                    window.updateDashboardKPIs();
                }
            } else {
                msgDiv.textContent = data.error || 'Upload failed.';
                msgDiv.style.color = 'red';
                renderMedicineCards([]);
            }
        } catch (err) {
            msgDiv.textContent = 'Error: ' + err.message;
            msgDiv.style.color = 'red';
            renderMedicineCards([]);
        }
    });
})();
