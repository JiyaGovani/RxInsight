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
    const topbarProfile = document.getElementById('rxTopbarProfile');
    if (topbarProfile) topbarProfile.addEventListener('click', (e) => { e.preventDefault(); switchView('profile'); });
    const topbarSettings = document.getElementById('rxTopbarSettings');
    if (topbarSettings) topbarSettings.addEventListener('click', (e) => { e.preventDefault(); switchView('profile'); });

    // Close mobile menu on resize up
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) setNavOpen(false);
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

    const shownPopupKeys = new Set(
        JSON.parse(sessionStorage.getItem('shownReminderPopupKeys') || '[]')
    );

    const reminderAlertModal = reminderAlertModalEl && window.bootstrap
        ? new window.bootstrap.Modal(reminderAlertModalEl)
        : null;

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
        if (reminderAlertTime) reminderAlertTime.textContent = activePopup.matchedTime || '-';
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
                    <div class="small text-muted">Frequency: ${frequencies}</div>
                    <div class="small text-muted">Times: ${times}</div>
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
            row.className = 'd-flex align-items-center gap-2';
            row.innerHTML = `
                <span style="min-width: 90px; color: var(--secondary-color); font-weight: 600;">${label}</span>
                <input type="time" class="form-control reminder-time" name="time_${label.toLowerCase()}" required />
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
                reminderMsg.textContent = 'Please select at least one frequency.';
                reminderMsg.style.color = '#dc3545';
            }
            return;
        }

        const timeSetters = selectedFrequencies.map((label) => {
            const input = reminderForm.querySelector(`input[name="time_${label.toLowerCase()}"]`);
            return input ? input.value : '';
        });

        if (timeSetters.some((value) => !value)) {
            if (reminderMsg) {
                reminderMsg.textContent = 'Please set time for each selected frequency.';
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

    if (reminderAlertTakenBtn && reminderAlertModalEl) {
        reminderAlertTakenBtn.addEventListener('click', async function () {
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
