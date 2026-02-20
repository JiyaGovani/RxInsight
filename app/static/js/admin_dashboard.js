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

  document.querySelectorAll('img.rx-fallback-img').forEach(function (img) {
    img.addEventListener('error', function () { replaceImageWithAlt(img); });
    if (img.complete && img.naturalWidth === 0) replaceImageWithAlt(img);
  });

  var navToggle = document.getElementById('rxNavToggle');
  var navMenu = document.getElementById('rxNavMenu');
  var actionList = document.getElementById('rxActionList');

  function setNavOpen(isOpen) {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navMenu.classList.toggle('rx-nav-open', isOpen);
  }

  function switchView(viewName) {
    if (viewName === 'logout') { window.location.href = '/logout'; return; }

    document.querySelectorAll('.dashboard-content-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'view-' + viewName);
    });
    document.querySelectorAll('.dashboard-sidebar-item').forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    if (viewName === 'users' && !hasLoadedUsers) {
      loadUsers('');
      hasLoadedUsers = true;
    }

    if (viewName === 'overview') {
      loadOverviewStats();
    }

    if (viewName === 'prescriptions') {
      loadAdminPrescriptions();
    }

    if (viewName === 'reminders') {
      loadAdminReminders();
    }
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      setNavOpen(!isOpen);
    });
  }

  if (actionList) {
    actionList.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-view]');
      if (!button) return;
      switchView(button.getAttribute('data-view'));
    });
  }

  window.addEventListener('resize', function () {
    if (window.innerWidth >= 768) setNavOpen(false);
  });

  var topbarSettings = document.getElementById('rxTopbarSettings');
  if (topbarSettings) {
    topbarSettings.addEventListener('click', function (e) {
      e.preventDefault();
      switchView('overview');
    });
  }

  var addMedicineBtn = document.getElementById('btnAddMedicine');
  var addMedicineFormWrap = document.getElementById('addMedicineFormWrap');
  var addMedicineForm = document.getElementById('addMedicineForm');
  var cancelMedicineBtn = document.getElementById('btnCancelMedicine');
  var saveMedicineBtn = document.getElementById('btnSaveMedicine');
  var deleteMedicineBtn = document.getElementById('btnDeleteMedicine');
  var viewAllMedicinesBtn = document.getElementById('btnViewAllMedicines');
  var allMedicinesWrap = document.getElementById('allMedicinesWrap');
  var allMedicinesStatus = document.getElementById('allMedicinesStatus');
  var allMedicinesList = document.getElementById('allMedicinesList');
  var medicineActionAlertHost = document.getElementById('medicineActionAlertHost');
  var medicineDeleteModalEl = document.getElementById('medicineDeleteModal');
  var medicineDeleteModal = medicineDeleteModalEl ? new bootstrap.Modal(medicineDeleteModalEl) : null;
  var deleteMedicineForm = document.getElementById('deleteMedicineForm');
  var deleteMedicineNameInput = document.getElementById('deleteMedicineNameInput');
  var confirmDeleteMedicineBtn = document.getElementById('btnConfirmDeleteMedicine');
  var userSearchInput = document.getElementById('userSearchInput');
  var searchUsersBtn = document.getElementById('btnSearchUsers');
  var usersStatus = document.getElementById('usersStatus');
  var usersCardsList = document.getElementById('usersCardsList');
  var hasLoadedUsers = false;
  var kpiTotalUsers = document.getElementById('kpiTotalUsers');
  var kpiTotalPrescriptions = document.getElementById('kpiTotalPrescriptions');
  var kpiTotalMedicines = document.getElementById('kpiTotalMedicines');
  var kpiLastSync = document.getElementById('kpiLastSync');
  var overviewTotalUsers = document.getElementById('overviewTotalUsers');
  var overviewTotalPrescriptions = document.getElementById('overviewTotalPrescriptions');
  var overviewTotalMedicines = document.getElementById('overviewTotalMedicines');
  var overviewInsightUsers = document.getElementById('overviewInsightUsers');
  var overviewInsightPrescriptions = document.getElementById('overviewInsightPrescriptions');
  var overviewInsightMedicines = document.getElementById('overviewInsightMedicines');
  var overviewLastRefresh = document.getElementById('overviewLastRefresh');
  var overviewFeedStatus = document.getElementById('overviewFeedStatus');
  var overviewFeedList = document.getElementById('overviewFeedList');
  var OVERVIEW_FEED_LIMIT = 3;
  var adminPrescriptionAlert = document.getElementById('adminPrescriptionAlert');
  var adminPrescriptionList = document.getElementById('adminPrescriptionList');
  var prescriptionUserSearchInput = document.getElementById('prescriptionUserSearchInput');
  var btnSearchPrescriptions = document.getElementById('btnSearchPrescriptions');
  var adminReminderAlert = document.getElementById('adminReminderAlert');
  var adminReminderList = document.getElementById('adminReminderList');
  var reminderStatusSelect = document.getElementById('reminderStatusSelect');
  var reminderStatusDropdown = document.getElementById('reminderStatusDropdown');
  var reminderStatusToggle = document.getElementById('reminderStatusToggle');
  var reminderStatusLabel = document.getElementById('reminderStatusLabel');
  var reminderStatusMenu = document.getElementById('reminderStatusMenu');
  var btnResetReminderStatus = document.getElementById('btnResetReminderStatus');

  function updateOverviewCounts(totalUsers, totalPrescriptions, totalMedicines) {
    var usersValue = String(totalUsers == null ? 0 : totalUsers);
    var prescriptionsValue = String(totalPrescriptions == null ? 0 : totalPrescriptions);
    var medicinesValue = String(totalMedicines == null ? 0 : totalMedicines);

    if (kpiTotalUsers) kpiTotalUsers.textContent = usersValue;
    if (kpiTotalPrescriptions) kpiTotalPrescriptions.textContent = prescriptionsValue;
    if (kpiTotalMedicines) kpiTotalMedicines.textContent = medicinesValue;
    if (kpiLastSync) {
      var nowForKpi = new Date();
      kpiLastSync.textContent = nowForKpi.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (overviewTotalUsers) overviewTotalUsers.textContent = usersValue;
    if (overviewTotalPrescriptions) overviewTotalPrescriptions.textContent = prescriptionsValue;
    if (overviewTotalMedicines) overviewTotalMedicines.textContent = medicinesValue;
    if (overviewInsightUsers) overviewInsightUsers.textContent = usersValue;
    if (overviewInsightPrescriptions) overviewInsightPrescriptions.textContent = prescriptionsValue;
    if (overviewInsightMedicines) overviewInsightMedicines.textContent = medicinesValue;
    if (overviewLastRefresh) {
      var now = new Date();
      overviewLastRefresh.textContent = now.toLocaleString();
    }
  }

  async function loadOverviewStats() {
    try {
      var response = await fetch('/admin/overview-stats', {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      var result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch overview stats');
      }

      updateOverviewCounts(result.total_users, result.total_prescriptions, result.total_medicines);
      loadOverviewSmartInsights();
    } catch (error) {
      updateOverviewCounts(0, 0, 0);
      loadOverviewSmartInsights();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegExp(value) {
    return String(value == null ? '' : value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightMatch(value, searchTerm) {
    var source = String(value == null ? '' : value);
    var term = String(searchTerm == null ? '' : searchTerm).trim();
    if (!term) return escapeHtml(source);

    var matcher = new RegExp(escapeRegExp(term), 'ig');
    var match = matcher.exec(source);
    if (!match) return escapeHtml(source);

    matcher.lastIndex = 0;
    var highlighted = '';
    var lastIndex = 0;

    while ((match = matcher.exec(source)) !== null) {
      var start = match.index;
      var end = start + match[0].length;

      highlighted += escapeHtml(source.slice(lastIndex, start));
      highlighted += '<span class="fw-semibold" style="background-color: var(--primary-soft); color: var(--secondary-color); padding: 0 4px; border-radius: 4px;">' + escapeHtml(source.slice(start, end)) + '</span>';
      lastIndex = end;
    }

    highlighted += escapeHtml(source.slice(lastIndex));
    return highlighted;
  }

  function withUnit(value, unit) {
    if (value == null) return '-';
    var text = String(value).trim();
    if (!text || text === '-') return '-';
    return text + ' ' + unit;
  }

  function formatPrescriptionDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function renderOverviewFeedItems(prescriptions) {
    if (!overviewFeedList) return;

    var latestItems = prescriptions.slice(0, OVERVIEW_FEED_LIMIT);

    overviewFeedList.innerHTML = latestItems.map(function (prescription) {
      var patientName = escapeHtml(prescription.username || 'Unknown user');
      var prescriptionId = escapeHtml(prescription.prescription_id ?? '-');
      var uploadDate = escapeHtml(formatPrescriptionDate(prescription.upload_date));
      var medicines = Array.isArray(prescription.medicines) ? prescription.medicines : [];
      var medicineCount = medicines.length;
      var previewNames = medicines.slice(0, 2).map(function (med) {
        return med && med.medicine_name ? med.medicine_name : '';
      }).filter(Boolean);
      var medicinePreview = previewNames.length
        ? escapeHtml(previewNames.join(', '))
        : 'No medicine details';

      if (medicineCount > 2) {
        medicinePreview += ' +' + (medicineCount - 2) + ' more';
      }

      return '<div class="overview-feed-item" role="group" aria-label="Prescription feed item">' +
        '<div class="overview-feed-main">' +
          '<div class="overview-feed-title">Patient: ' + patientName + '</div>' +
          '<div class="overview-feed-subtitle">Prescription #' + prescriptionId + ' • ' + medicinePreview + '</div>' +
        '</div>' +
        '<div class="overview-feed-meta">' + uploadDate + '</div>' +
      '</div>';
    }).join('');
  }

  function getWeekdayLabel(value) {
    var date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  async function loadOverviewSmartInsights() {
    if (!overviewFeedStatus || !overviewFeedList) return;

    if (overviewFeedStatus) overviewFeedStatus.textContent = 'Loading recent activity...';
    if (overviewFeedList) overviewFeedList.innerHTML = '';

    try {
      var response = await fetch('/admin/prescriptions?limit=' + OVERVIEW_FEED_LIMIT, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      var result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch recent prescription activity');
      }

      var prescriptions = Array.isArray(result.prescriptions) ? result.prescriptions : [];
      if (!prescriptions.length) {
        if (overviewFeedStatus) overviewFeedStatus.textContent = 'No recent prescription activity available.';
        if (overviewFeedList) overviewFeedList.innerHTML = '';
        return;
      }

      if (overviewFeedStatus) {
        var shownCount = Math.min(OVERVIEW_FEED_LIMIT, prescriptions.length);
        overviewFeedStatus.textContent = 'Showing latest ' + shownCount + ' prescription' + (shownCount > 1 ? 's' : '') + '.';
      }
      renderOverviewFeedItems(prescriptions);
    } catch (error) {
      if (overviewFeedStatus) overviewFeedStatus.textContent = 'Unable to load recent prescription activity right now.';
      if (overviewFeedList) overviewFeedList.innerHTML = '';
    }
  }

  function renderAdminPrescriptions(prescriptions, searchTerm) {
    if (!adminPrescriptionList) return;

    adminPrescriptionList.innerHTML = prescriptions.map(function (prescription) {
      var prescriptionId = escapeHtml(prescription.prescription_id ?? '-');
      var usernameRaw = prescription.username || 'Unknown user';
      var username = highlightMatch(usernameRaw, searchTerm);
      var uploadDate = escapeHtml(formatPrescriptionDate(prescription.upload_date));
      var medicines = Array.isArray(prescription.medicines) ? prescription.medicines : [];

      var medicinesList = medicines.map(function (med) {
        var medicineName = escapeHtml(med.medicine_name || '-');
        var dosage = escapeHtml(med.dosage || 'N/A');
        var frequency = escapeHtml(med.frequency || 'N/A');
        var duration = escapeHtml(med.duration || 'N/A');

        return '<div class="row mb-2">' +
          '<div class="col-md-6">' +
            '<strong><i class="fa-solid fa-capsules me-2" style="color: var(--primary-color);"></i>' + medicineName + '</strong>' +
          '</div>' +
          '<div class="col-md-6">' +
            '<span class="text-muted small">Dosage: ' + dosage + '</span>' +
          '</div>' +
          '<div class="col-md-6">' +
            '<span class="text-muted small">Time Slots: ' + frequency + '</span>' +
          '</div>' +
          '<div class="col-md-6">' +
            '<span class="text-muted small">Duration: ' + duration + '</span>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="card border-0 shadow-sm mb-3" style="background: rgba(255,255,255,0.7);">' +
        '<div class="card-body">' +
          '<div class="d-flex justify-content-between align-items-start mb-3">' +
            '<div>' +
              '<h5 class="card-title fw-bold" style="color: var(--secondary-color);">' +
                '<i class="fa-solid fa-file-medical me-2" style="color: var(--primary-color);"></i>Prescription #' + prescriptionId +
              '</h5>' +
              '<p class="card-text text-muted small mb-1">' +
                '<i class="fa-regular fa-calendar me-1"></i>Uploaded on: ' + uploadDate +
              '</p>' +
              '<p class="card-text text-muted small mb-0">' +
                '<i class="fa-solid fa-user me-1"></i>Patient: ' + username +
              '</p>' +
            '</div>' +
          '</div>' +
          '<hr>' +
          '<h6 class="mb-3" style="color: var(--secondary-color);">Medicines:</h6>' +
          medicinesList +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderReminderStatusBadge(status) {
    var normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === 'taken') return '<span class="badge bg-success">Taken</span>';
    if (normalizedStatus === 'missed') return '<span class="badge bg-danger">Missed</span>';
    if (normalizedStatus === 'pending') return '<span class="badge bg-warning text-dark">Pending</span>';
    return '<span class="badge bg-secondary">' + escapeHtml(status || '-') + '</span>';
  }

  function renderAdminReminders(reminders) {
    if (!adminReminderList) return;

    adminReminderList.innerHTML = reminders.map(function (reminder) {
      var reminderId = escapeHtml(reminder.reminder_id ?? '-');
      var username = escapeHtml(reminder.username || 'Unknown user');
      var userId = escapeHtml(reminder.user_id ?? '-');
      var numberOfDays = escapeHtml(reminder.number_of_days ?? '-');
      var medicineName = escapeHtml(reminder.medicine_name ?? '-');
      var statusBadge = renderReminderStatusBadge(reminder.status);
      var isMsgSent = reminder.msg_sent === true || reminder.msg_sent === 1 || String(reminder.msg_sent).toLowerCase() === 'true';
      var msgSentLabel = isMsgSent ? 'Yes' : 'No';

      return '<div class="card border-0 shadow-sm mb-3" style="background: rgba(255,255,255,0.7);">' +
        '<div class="card-body">' +
          '<div class="d-flex justify-content-between align-items-start mb-3">' +
            '<div>' +
              '<h5 class="card-title fw-bold" style="color: var(--secondary-color);">' +
                '<i class="fa-solid fa-bell me-2" style="color: var(--primary-color);"></i>Reminder #' + reminderId +
              '</h5>' +
              '<p class="card-text text-muted small mb-1"><i class="fa-solid fa-user me-1"></i>Username: ' + username + '</p>' +
              '<p class="card-text text-muted small mb-0"><i class="fa-solid fa-id-badge me-1"></i>User ID: ' + userId + '</p>' +
            '</div>' +
            '<div>' + statusBadge + '</div>' +
          '</div>' +
          '<hr>' +
          '<div class="row g-2">' +
            '<div class="col-md-4"><span class="text-muted small">Number of Days:</span><div class="fw-semibold">' + numberOfDays + '</div></div>' +
            '<div class="col-md-4"><span class="text-muted small">Medicine Name:</span><div class="fw-semibold">' + medicineName + '</div></div>' +
            '<div class="col-md-4"><span class="text-muted small">Message Sent:</span><div class="fw-semibold">' + escapeHtml(msgSentLabel) + '</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function formatReminderStatusLabel(status) {
    var normalizedStatus = String(status || '').trim().toLowerCase();
    if (normalizedStatus === 'taken') return 'Taken';
    if (normalizedStatus === 'missed') return 'Missed';
    if (normalizedStatus === 'pending') return 'Pending';
    return 'All';
  }

  async function loadAdminReminders(status) {
    if (!adminReminderAlert || !adminReminderList) return;

    var selectedStatus = String(status || '').trim().toLowerCase();
    var endpoint = '/admin/reminders';
    if (selectedStatus) endpoint += '?status=' + encodeURIComponent(selectedStatus);

    adminReminderAlert.className = 'alert alert-info';
    adminReminderAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>Loading reminders...';
    adminReminderList.innerHTML = '';

    try {
      var response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      var result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch reminders');
      }

      var reminders = Array.isArray(result.reminders) ? result.reminders : [];
      if (!reminders.length) {
        if (selectedStatus) {
          adminReminderAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>No reminders found with status: ' + escapeHtml(formatReminderStatusLabel(selectedStatus)) + '.';
        } else {
          adminReminderAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>No reminders found.';
        }
        adminReminderList.innerHTML = '';
        return;
      }

      if (selectedStatus) {
        adminReminderAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>Showing ' + reminders.length + ' reminder' + (reminders.length > 1 ? 's' : '') + ' with status: ' + escapeHtml(formatReminderStatusLabel(selectedStatus)) + '.';
      } else {
        adminReminderAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>Showing ' + reminders.length + ' reminder' + (reminders.length > 1 ? 's' : '') + '.';
      }

      renderAdminReminders(reminders);
    } catch (error) {
      adminReminderAlert.className = 'alert alert-danger';
      adminReminderAlert.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-2"></i>Error loading reminders: ' + escapeHtml(error.message || 'Unknown error');
      adminReminderList.innerHTML = '';
    }
  }

  async function loadAdminPrescriptions(username) {
    if (!adminPrescriptionAlert || !adminPrescriptionList) return;

    var searchTerm = (username || '').trim();
    var endpoint = '/admin/prescriptions';
    if (searchTerm) {
      endpoint += '?username=' + encodeURIComponent(searchTerm);
    }

    adminPrescriptionAlert.className = 'alert alert-info';
    adminPrescriptionAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>Loading prescriptions...';
    adminPrescriptionList.innerHTML = '';

    try {
      var response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      var result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch prescriptions');
      }

      var prescriptions = Array.isArray(result.prescriptions) ? result.prescriptions : [];
      if (!prescriptions.length) {
        if (searchTerm) {
          adminPrescriptionAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>No prescriptions found for username: ' + escapeHtml(searchTerm) + '.';
        } else {
          adminPrescriptionAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>No prescriptions found.';
        }
        adminPrescriptionList.innerHTML = '';
        return;
      }

      if (searchTerm) {
        adminPrescriptionAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>Showing ' + prescriptions.length + ' prescription' + (prescriptions.length > 1 ? 's' : '') + ' for username: ' + escapeHtml(searchTerm) + '.';
      } else {
        adminPrescriptionAlert.innerHTML = '<i class="fa-solid fa-circle-info me-2"></i>Showing ' + prescriptions.length + ' prescription' + (prescriptions.length > 1 ? 's' : '') + '.';
      }
      renderAdminPrescriptions(prescriptions, searchTerm);
    } catch (error) {
      adminPrescriptionAlert.className = 'alert alert-danger';
      adminPrescriptionAlert.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-2"></i>Error loading prescriptions: ' + escapeHtml(error.message || 'Unknown error');
      adminPrescriptionList.innerHTML = '';
    }
  }

  function renderMedicinesList(medicines) {
    if (!allMedicinesList) return;

    if (!Array.isArray(medicines) || medicines.length === 0) {
      allMedicinesList.innerHTML = '<div class="text-center py-4 text-muted">No medicines found.</div>';
      return;
    }

    allMedicinesList.innerHTML = medicines.map(function (medicine) {
      var safeUrl = escapeHtml(medicine.url || '');
      var urlCell = safeUrl
        ? '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + safeUrl + '</a>'
        : '-';

      return '<div class="medicine-record-card">' +
        '<div class="card-body p-3">' +
          '<div class="medicine-record-head">' +
            '<h6 class="medicine-record-name">' + escapeHtml(medicine.name ?? '-') + '</h6>' +
            '<span class="badge medicine-record-id">ID: ' + escapeHtml(medicine.medicine_id ?? '-') + '</span>' +
          '</div>' +
          '<div class="medicine-record-fields">' +
            '<div class="medicine-field"><span class="medicine-field-label">URL</span><span class="medicine-field-value">' + urlCell + '</span></div>' +
            '<div class="medicine-field"><span class="medicine-field-label">Composition</span><span class="medicine-field-value">' + escapeHtml(medicine.composition ?? '-') + '</span></div>' +
            '<div class="medicine-field"><span class="medicine-field-label">Dose Form</span><span class="medicine-field-value">' + escapeHtml(medicine.dose_form ?? '-') + '</span></div>' +
            '<div class="medicine-field"><span class="medicine-field-label">Uses</span><span class="medicine-field-value">' + escapeHtml(medicine.uses ?? '-') + '</span></div>' +
            '<div class="medicine-field"><span class="medicine-field-label">Side Effect</span><span class="medicine-field-value">' + escapeHtml(medicine.side_effect ?? '-') + '</span></div>' +
            '<div class="medicine-field"><span class="medicine-field-label">Drug Interactions</span><span class="medicine-field-value">' + escapeHtml(medicine.drug_interactions ?? '-') + '</span></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderUsersCards(users) {
    if (!usersCardsList) return;

    if (!Array.isArray(users) || users.length === 0) {
      usersCardsList.innerHTML = '<div class="text-center py-4 text-muted">No users found.</div>';
      return;
    }

    usersCardsList.innerHTML = users.map(function (user) {
      var username = escapeHtml(user.username ?? '-');
      var contact = escapeHtml(user.contact_number ?? '-');
      var userId = escapeHtml(user.user_id ?? '-');
      var email = escapeHtml(user.email ?? '-');
      var emergencyContact = escapeHtml(user.emergency_contact ?? '-');
      var dateOfBirth = escapeHtml(user.date_of_birth ?? '-');
      var weight = escapeHtml(withUnit(user.weight, 'kg'));
      var height = escapeHtml(withUnit(user.height, 'cm'));

      return '<div class="user-record-card">' +
        '<div class="card-body p-3">' +
          '<div class="user-record-head">' +
            '<div class="user-identity">' +
              '<div class="user-avatar"><i class="fa-solid fa-user"></i></div>' +
              '<div>' +
                '<h6 class="user-record-name">' + username + '</h6>' +
                '<div class="user-contact-line"><i class="fa-solid fa-phone" aria-hidden="true"></i><span>' + contact + '</span></div>' +
              '</div>' +
            '</div>' +
            '<span class="user-record-toggle"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></span>' +
          '</div>' +
          '<div class="user-record-details">' +
            '<div class="user-detail-list">' +
              '<div class="user-detail-row"><span class="user-field-label"><i class="fa-solid fa-id-badge" aria-hidden="true"></i>User ID</span><span class="user-field-value">' + userId + '</span></div>' +
              '<div class="user-detail-row"><span class="user-field-label"><i class="fa-solid fa-envelope" aria-hidden="true"></i>Email</span><span class="user-field-value">' + email + '</span></div>' +
              '<div class="user-detail-row"><span class="user-field-label"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>Emergency Contact</span><span class="user-field-value">' + emergencyContact + '</span></div>' +
              '<div class="user-detail-row"><span class="user-field-label"><i class="fa-solid fa-cake-candles" aria-hidden="true"></i>Date of Birth</span><span class="user-field-value">' + dateOfBirth + '</span></div>' +
              '<div class="user-detail-row"><span class="user-field-label"><i class="fa-solid fa-weight-scale" aria-hidden="true"></i>Weight</span><span class="user-field-value">' + weight + '</span></div>' +
              '<div class="user-detail-row"><span class="user-field-label"><i class="fa-solid fa-ruler-vertical" aria-hidden="true"></i>Height</span><span class="user-field-value">' + height + '</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    usersCardsList.querySelectorAll('.user-record-card').forEach(function (card) {
      var nameText = card.querySelector('.user-record-name');
      var usernameLabel = nameText ? nameText.textContent.trim() : 'user';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-expanded', 'false');
      card.setAttribute('aria-label', 'Expand user details for ' + usernameLabel);
    });
  }

  async function loadUsers(username) {
    if (!usersCardsList || !usersStatus) return;

    var searchTerm = (username || '').trim();
    var endpoint = '/admin/users';
    if (searchTerm) {
      endpoint += '?username=' + encodeURIComponent(searchTerm);
    }

    usersStatus.textContent = 'Loading users...';
    usersCardsList.innerHTML = '<div class="text-center py-4 text-muted">Loading...</div>';

    try {
      var response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      var result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch users');
      }

      var users = result.users || [];
      renderUsersCards(users);

      if (searchTerm) {
        usersStatus.textContent = users.length
          ? 'Showing result for username: ' + searchTerm
          : 'No user found for username: ' + searchTerm;
      } else {
        usersStatus.textContent = 'Showing all users (' + users.length + ')';
      }
    } catch (error) {
      usersStatus.textContent = error.message || 'Failed to fetch users';
      usersCardsList.innerHTML = '<div class="text-center py-4 text-danger">Unable to load users.</div>';
    }
  }

  function showMedicineActionAlert(kind, message) {
    if (!medicineActionAlertHost) return;

    medicineActionAlertHost.innerHTML =
      '<div class="alert alert-' + kind + ' alert-dismissible fade show" role="alert">' +
        escapeHtml(message) +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
      '</div>';
  }

  async function loadAllMedicines() {
    if (!allMedicinesWrap || !allMedicinesStatus || !allMedicinesList) return;

    allMedicinesWrap.classList.remove('d-none');
    allMedicinesStatus.textContent = 'Loading medicines...';
    allMedicinesList.innerHTML = '<div class="text-center py-4 text-muted">Loading...</div>';

    try {
      var response = await fetch('/admin/medicines', {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      var result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch medicines');
      }

      renderMedicinesList(result.medicines || []);
      allMedicinesStatus.textContent = 'Total medicines: ' + ((result.medicines || []).length);
    } catch (error) {
      allMedicinesStatus.textContent = error.message || 'Failed to fetch medicines';
      allMedicinesList.innerHTML = '<div class="text-center py-4 text-danger">Unable to load medicines.</div>';
    }
  }

  function resetMedicineForm() {
    if (!addMedicineForm) return;
    addMedicineForm.reset();
    addMedicineForm.classList.remove('was-validated');
  }

  function setActiveMedicineFeature(feature) {
    if (addMedicineFormWrap) {
      addMedicineFormWrap.classList.toggle('d-none', feature !== 'add');
    }
    if (allMedicinesWrap) {
      allMedicinesWrap.classList.toggle('d-none', feature !== 'view');
    }
  }

  if (addMedicineBtn && addMedicineFormWrap) {
    addMedicineBtn.addEventListener('click', function () {
      setActiveMedicineFeature('add');
    });
  }

  if (viewAllMedicinesBtn) {
    viewAllMedicinesBtn.addEventListener('click', function () {
      setActiveMedicineFeature('view');
      loadAllMedicines();
    });
  }

  if (deleteMedicineBtn) {
    deleteMedicineBtn.addEventListener('click', function () {
      setActiveMedicineFeature('delete');
      if (deleteMedicineForm) {
        deleteMedicineForm.reset();
        deleteMedicineForm.classList.remove('was-validated');
      }
      if (deleteMedicineNameInput) {
        deleteMedicineNameInput.focus();
      }
      if (medicineDeleteModal) {
        medicineDeleteModal.show();
      }
    });
  }

  if (deleteMedicineForm) {
    deleteMedicineForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!deleteMedicineForm.checkValidity()) {
        deleteMedicineForm.classList.add('was-validated');
        return;
      }

      var medicineName = (deleteMedicineNameInput ? deleteMedicineNameInput.value : '').trim();
      if (!medicineName) {
        showMedicineActionAlert('warning', 'Medicine name is required for deletion.');
        return;
      }

      var originalLabel = confirmDeleteMedicineBtn ? confirmDeleteMedicineBtn.textContent : 'Delete';
      if (confirmDeleteMedicineBtn) {
        confirmDeleteMedicineBtn.disabled = true;
        confirmDeleteMedicineBtn.textContent = 'Deleting...';
      }

      try {
        var response = await fetch('/admin/medicines', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ name: medicineName })
        });

        var result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to delete medicine');
        }

        var deletedCount = Number(result.deleted_count || 0);
        var successMessage = deletedCount > 1
          ? deletedCount + ' medicines named "' + medicineName + '" were deleted successfully.'
          : 'Medicine named "' + medicineName + '" was deleted successfully.';
        showMedicineActionAlert('success', successMessage);

        if (medicineDeleteModal) {
          medicineDeleteModal.hide();
        }

        if (allMedicinesWrap && !allMedicinesWrap.classList.contains('d-none')) {
          loadAllMedicines();
        }
      } catch (error) {
        showMedicineActionAlert('danger', error.message || 'Failed to delete medicine.');
      } finally {
        if (confirmDeleteMedicineBtn) {
          confirmDeleteMedicineBtn.disabled = false;
          confirmDeleteMedicineBtn.textContent = originalLabel;
        }
      }
    });
  }

  if (cancelMedicineBtn && addMedicineFormWrap) {
    cancelMedicineBtn.addEventListener('click', function () {
      setActiveMedicineFeature('none');
      resetMedicineForm();
    });
  }

  if (addMedicineForm) {
    addMedicineForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!addMedicineForm.checkValidity()) {
        addMedicineForm.classList.add('was-validated');
        return;
      }

      var payload = {
        name: addMedicineForm.name.value.trim(),
        url: addMedicineForm.url.value.trim(),
        composition: addMedicineForm.composition.value.trim(),
        dose_form: addMedicineForm.dose_form.value.trim(),
        uses: addMedicineForm.uses.value.trim(),
        side_effect: addMedicineForm.side_effect.value.trim(),
        drug_interactions: addMedicineForm.drug_interactions.value.trim()
      };

      var originalLabel = saveMedicineBtn ? saveMedicineBtn.textContent : 'Save Medicine';
      if (saveMedicineBtn) {
        saveMedicineBtn.disabled = true;
        saveMedicineBtn.textContent = 'Saving...';
      }

      try {
        var response = await fetch('/admin/medicines', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload)
        });

        var result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to save medicine');
        }

        showMedicineActionAlert('success', 'Medicine details have been added successfully.');
        addMedicineFormWrap.classList.add('d-none');
        resetMedicineForm();
        if (allMedicinesWrap && !allMedicinesWrap.classList.contains('d-none')) {
          loadAllMedicines();
        }
      } catch (error) {
        showMedicineActionAlert('danger', error.message || 'Failed to save medicine.');
      } finally {
        if (saveMedicineBtn) {
          saveMedicineBtn.disabled = false;
          saveMedicineBtn.textContent = originalLabel;
        }
      }
    });
  }

  if (searchUsersBtn) {
    searchUsersBtn.addEventListener('click', function () {
      loadUsers(userSearchInput ? userSearchInput.value : '');
    });
  }

  if (userSearchInput) {
    userSearchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadUsers(userSearchInput.value);
      }
    });

    userSearchInput.addEventListener('input', function () {
      if (!userSearchInput.value.trim()) {
        loadUsers('');
      }
    });
  }

  if (btnSearchPrescriptions) {
    btnSearchPrescriptions.addEventListener('click', function () {
      loadAdminPrescriptions(prescriptionUserSearchInput ? prescriptionUserSearchInput.value : '');
    });
  }

  if (prescriptionUserSearchInput) {
    prescriptionUserSearchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadAdminPrescriptions(prescriptionUserSearchInput.value);
      }
    });

    prescriptionUserSearchInput.addEventListener('input', function () {
      if (!prescriptionUserSearchInput.value.trim()) {
        loadAdminPrescriptions('');
      }
    });
  }

  if (reminderStatusDropdown && reminderStatusToggle && reminderStatusMenu && reminderStatusSelect) {
    reminderStatusToggle.addEventListener('click', function () {
      var isOpen = reminderStatusToggle.getAttribute('aria-expanded') === 'true';
      reminderStatusToggle.setAttribute('aria-expanded', String(!isOpen));
      reminderStatusMenu.classList.toggle('d-none', isOpen);
    });

    reminderStatusMenu.querySelectorAll('.rx-status-option').forEach(function (optionBtn) {
      optionBtn.addEventListener('click', function () {
        var value = optionBtn.getAttribute('data-value') || '';
        reminderStatusSelect.value = value;
        reminderStatusLabel.textContent = optionBtn.textContent;
        reminderStatusToggle.setAttribute('aria-expanded', 'false');
        reminderStatusMenu.classList.add('d-none');
        loadAdminReminders(value);
      });
    });

    document.addEventListener('click', function (event) {
      if (!reminderStatusDropdown.contains(event.target)) {
        reminderStatusToggle.setAttribute('aria-expanded', 'false');
        reminderStatusMenu.classList.add('d-none');
      }
    });
  }

  if (reminderStatusSelect) {
    reminderStatusSelect.addEventListener('change', function () {
      loadAdminReminders(reminderStatusSelect.value);
    });
  }

  if (btnResetReminderStatus && reminderStatusSelect) {
    btnResetReminderStatus.addEventListener('click', function () {
      reminderStatusSelect.value = '';
      if (reminderStatusLabel) reminderStatusLabel.textContent = 'All';
      if (reminderStatusToggle) reminderStatusToggle.setAttribute('aria-expanded', 'false');
      if (reminderStatusMenu) reminderStatusMenu.classList.add('d-none');
      loadAdminReminders('');
    });
  }

  if (usersCardsList) {
    function toggleUserCard(card) {
      if (!card) return;

      var isOpen = card.classList.toggle('is-open');
      card.setAttribute('aria-expanded', String(isOpen));
    }

    usersCardsList.addEventListener('click', function (event) {
      var card = event.target.closest('.user-record-card');
      if (!card) return;
      toggleUserCard(card);
    });

    usersCardsList.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      var card = event.target.closest('.user-record-card');
      if (!card) return;

      event.preventDefault();
      toggleUserCard(card);
    });
  }

  document.querySelectorAll('[data-overview-go]').forEach(function (button) {
    button.addEventListener('click', function () {
      var destination = button.getAttribute('data-overview-go');
      if (!destination) return;
      switchView(destination);
    });
  });

  loadUsers('');
  hasLoadedUsers = true;
  loadOverviewStats();
})();
