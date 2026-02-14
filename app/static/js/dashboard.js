
function toggleSidebar() {
  document.getElementById("userSidebar").classList.toggle("active");
  document.getElementById("overlay").classList.toggle("active");
}

//med-details
const medicines = [
  {
    name: "Paracetamol",
    warnings: "Avoid overdose. Use with caution in liver disease.",
    interactions: "May interact with alcohol.",
    references: "WHO Essential Medicines List"
  },
  {
    name: "Amoxicillin",
    warnings: "May cause allergic reactions.",
    interactions: "Avoid with methotrexate.",
    references: "FDA Drug Database"
  }
];

// const medicineList = document.getElementById("medicineList");

// // Only populate medicines if medicineList element exists
// if (medicineList) {
//   medicines.forEach((med, index) => {
//     const li = document.createElement("li");
//     li.className = "list-group-item list-group-item-action";
//     li.style.cursor = "pointer";
//     li.innerText = med.name;

//     li.onclick = () => loadMedicine(index);

//     medicineList.appendChild(li);
//   });
// }

function loadMedicine(index) {
  const med = medicines[index];

  document.getElementById("medName").innerText = med.name;
  document.getElementById("medWarnings").innerText = med.warnings;
  document.getElementById("medInteractions").innerText = med.interactions;
  document.getElementById("medReferences").innerText = med.references;
}

//helper function to hide other secrions
function hideAllSections() {
  document.querySelectorAll('.toggle-section').forEach(section => {
    section.style.display = 'none';
  });
}

// Add medicine via API
function addMedicine(medicineData) {
  hideAllSections();
  console.log('Sending data:', medicineData);
  
  fetch('/medicine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(medicineData)
  })
  .then(response => {
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    return response.json().then(data => ({ status: response.status, body: data }));
  })
  .then(({ status, body }) => {
    console.log('Response body:', body);
    if (status === 201 || body.success) {
      // Show success modal
      const successModal = new bootstrap.Modal(document.getElementById('addMedicineSuccessModal'));
      successModal.show();

      // Hide the form
      document.getElementById('medicine-form').style.display = 'none';

      // Close modal and reset form after 2 seconds
      setTimeout(() => {
        successModal.hide();
        const form = document.querySelector('form');
        if (form) {
          form.reset();
        }
      }, 2000);
    } else {
      // Show error in a simpler way
      alert('Error: ' + (body.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Network Error:', error);
    alert('Network error: ' + error.message);
  });
}

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const medicineData = {
        medicine_name: document.getElementById('medicine_name').value,
        alt_medicine: document.getElementById('alt_medicine').value,
        url: document.getElementById('url').value,
        dosage_form: document.getElementById('dosage_form').value,
        composition: document.getElementById('composition').value,
        warnings: document.getElementById('warnings').value,
        drug_interactions: document.getElementById('drug_interactions').value
      };
      
      addMedicine(medicineData);
      form.reset();
    });
  }
});

  // Toggle form visibility
    const addMedicineBtn = document.getElementById('addMedicineBtn');
    const closeMedicineBtn = document.getElementById('closeMedicineBtn');
    const medicineForm = document.getElementById('medicine-form');

    addMedicineBtn.addEventListener('click', function() {
        medicineForm.style.display = 'block';
    });

    closeMedicineBtn.addEventListener('click', function() {
        medicineForm.style.display = 'none';
    });

// ======================== DELETE MEDICINE FUNCTIONALITY ========================

document.addEventListener('DOMContentLoaded', function() {
  hideAllSections();
  const deleteMedicineBtn = document.querySelector('.btn-delete');
  const deleteMedicineModal = document.getElementById('deleteMedicineModal');
  const fetchMedicineBtn = document.getElementById('fetchMedicineBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteBackBtn = document.getElementById('deleteBackBtn');
  const deleteSearchStep = document.getElementById('deleteSearchStep');
  const deleteConfirmStep = document.getElementById('deleteConfirmStep');
  const deleteSearchInput = document.getElementById('delete_search_name');

  // Open modal on Delete Medicine button click
  deleteMedicineBtn.addEventListener('click', function() {
    const modal = new bootstrap.Modal(deleteMedicineModal);
    modal.show();
    deleteSearchInput.focus();
  });

  // Search for medicine by name
  fetchMedicineBtn.addEventListener('click', function() {
    const medicineName = deleteSearchInput.value.trim();
    
    if (!medicineName) {
      alert('Please enter a medicine name');
      return;
    }

    fetchMedicineDetails(medicineName);
  });

  // Allow Enter key to search
  deleteSearchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      fetchMedicineBtn.click();
    }
  });

  // Confirm deletion
  confirmDeleteBtn.addEventListener('click', function() {
    deleteMedicine(window.medicineToDelete);
  });

  // Go back to search step
  deleteBackBtn.addEventListener('click', function() {
    deleteSearchStep.style.display = 'block';
    deleteConfirmStep.style.display = 'none';
    confirmDeleteBtn.style.display = 'none';
    deleteBackBtn.style.display = 'none';
    fetchMedicineBtn.style.display = 'inline-block';
    deleteSearchInput.value = '';
    document.getElementById('deleteErrorMessage').style.display = 'none';
    deleteSearchInput.focus();
  });

  // Reset modal when closed
  deleteMedicineModal.addEventListener('hidden.bs.modal', function() {
    deleteSearchStep.style.display = 'block';
    deleteConfirmStep.style.display = 'none';
    confirmDeleteBtn.style.display = 'none';
    deleteBackBtn.style.display = 'none';
    fetchMedicineBtn.style.display = 'inline-block';
    deleteSearchInput.value = '';
    document.getElementById('deleteErrorMessage').style.display = 'none';
  });
});

// Fetch medicine details from backend
function fetchMedicineDetails(medicineName) {
  const deleteSearchStep = document.getElementById('deleteSearchStep');
  const deleteConfirmStep = document.getElementById('deleteConfirmStep');
  const fetchMedicineBtn = document.getElementById('fetchMedicineBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteBackBtn = document.getElementById('deleteBackBtn');
  const deleteErrorMessage = document.getElementById('deleteErrorMessage');
  const deleteErrorText = document.getElementById('deleteErrorText');

  // Hide error message initially
  deleteErrorMessage.style.display = 'none';

  fetch(`/medicine/search?name=${encodeURIComponent(medicineName)}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Hide error message on success
        deleteErrorMessage.style.display = 'none';

        // Autofill the medicine details
        document.getElementById('delete_med_name').textContent = data.medicine.medicine_name;
        document.getElementById('delete_alt_name').textContent = data.medicine.alt_medicine;
        document.getElementById('delete_dosage').textContent = data.medicine.dosage_form;
        document.getElementById('delete_url').textContent = data.medicine.url;
        document.getElementById('delete_composition').textContent = data.medicine.composition;
        document.getElementById('delete_warnings').textContent = data.medicine.warnings;
        document.getElementById('delete_interactions').textContent = data.medicine.drug_interactions;

        // Store medicine_id for deletion
        window.medicineToDelete = data.medicine.medicine_id;

        // Switch to confirmation step
        deleteSearchStep.style.display = 'none';
        deleteConfirmStep.style.display = 'block';
        fetchMedicineBtn.style.display = 'none';
        confirmDeleteBtn.style.display = 'inline-block';
        deleteBackBtn.style.display = 'inline-block';
      } else {
        // Show error message in modal
        deleteErrorText.textContent = data.error || 'Medicine not found';
        deleteErrorMessage.style.display = 'block';
      }
    })
    .catch(error => {
      console.error('Error fetching medicine:', error);
      deleteErrorText.textContent = 'Error fetching medicine details. Please try again.';
      deleteErrorMessage.style.display = 'block';
    });
}

// Delete medicine from backend
function deleteMedicine(medicineId) {
  fetch(`/medicine/${medicineId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      const deleteSuccessMessage = document.getElementById('deleteSuccessMessage');
      const deleteSuccessText = document.getElementById('deleteSuccessText');
      const deleteConfirmStep = document.getElementById('deleteConfirmStep');
      const fetchMedicineBtn = document.getElementById('fetchMedicineBtn');
      const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
      const deleteBackBtn = document.getElementById('deleteBackBtn');
      const deleteSearchInput = document.getElementById('delete_search_name');

      // Show success message
      deleteSuccessText.textContent = 'Medicine deleted successfully!';
      deleteSuccessMessage.style.display = 'block';

      // Hide confirmation step and buttons
      deleteConfirmStep.style.display = 'none';
      confirmDeleteBtn.style.display = 'none';
      deleteBackBtn.style.display = 'none';
      fetchMedicineBtn.style.display = 'none';

      // Close modal after 2 seconds
      setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteMedicineModal'));
        if (modal) {
          modal.hide();
        }
      }, 2000);
    } else {
      const deleteErrorMessage = document.getElementById('deleteErrorMessage');
      const deleteErrorText = document.getElementById('deleteErrorText');
      deleteErrorText.textContent = data.error || 'Error deleting medicine';
      deleteErrorMessage.style.display = 'block';
    }
  })
  .catch(error => {
    console.error('Error deleting medicine:', error);
    const deleteErrorMessage = document.getElementById('deleteErrorMessage');
    const deleteErrorText = document.getElementById('deleteErrorText');
    deleteErrorText.textContent = 'Error deleting medicine. Please try again.';
    deleteErrorMessage.style.display = 'block';
  });
}

// fetch all medicines and display in a table
document.getElementById('showMedicineBtn').onclick = function () {
  console.log('Show Medicine button clicked'); // ✅ Check if button click works

  hideAllSections();
  console.log('hideAllSections() called'); // ✅ Verify other sections are being hidden

  fetch('http://127.0.0.1:5000/api/medicine')
    .then(response => {
      console.log('Fetch response received:', response);
      return response.json();
    })
    .then(data => {
      console.log('Data fetched from API:', data); // ✅ Inspect what the API actually returned

      if (!Array.isArray(data)) {
        console.error('Data is not an array:', data);
        throw new Error('Expected an array of medicines');
      }

      // Build the table HTML string
      let table = `
        <table id="medicines-table" class="display" border="1" cellpadding="8" cellspacing="0">
          <thead>
            <tr>
              <th>Medicine ID</th>
              <th>Medicine name</th>
              <th>Alternate name</th>
              <th>Url</th>
              <th>Dosage form</th>
              <th>Composition</th>
              <th>Warnings</th>
              <th>Drug Interaction</th>
            </tr>
          </thead>
          <tbody>
      `;

      // Add a row for each medicine
      data.forEach(med => {
        console.log('Adding medicine row:', med); // ✅ Log each medicine before adding
        table += `
          <tr>
            <td>${med.medicine_id}</td>
            <td>${med.medicine_name}</td>
            <td>${med.alt_medicine}</td>
            <td>${med.url}</td>
            <td>${med.dosage_form}</td>
            <td>${med.composition}</td>
            <td>${med.warnings}</td>
            <td>${med.drug_interactions}</td>
          </tr>
        `;
      });

      // Close the table tags
      table += `
          </tbody>
        </table>
      `;

      // Insert the table HTML into the page
      console.log('Inserting table into #allMedicine');
      document.getElementById('allMedicine').innerHTML = table;

      // Initialize DataTable
      console.log('Initializing DataTable');
      $('#medicines-table').DataTable();
      console.log('DataTable initialized successfully');
    })
    .catch(err => {
      console.error('Error in showMedicineBtn:', err);
      document.getElementById('allMedicine').innerText = 'Error fetching medicines';
    });
};
