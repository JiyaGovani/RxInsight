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
        if (viewName === 'logout') { window.location.href = '/login'; return; }

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
