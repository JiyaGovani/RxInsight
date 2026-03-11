# 💊 RxInsight

RxInsight is a modern web application for managing prescriptions, medication reminders, and adherence tracking. Built with Flask and PostgreSQL, it offers a seamless experience for both patients and administrators.

---

## 🚀 Features

- **User Authentication**: Secure login, registration, and role-based access (user/admin)
- **Prescription Upload**: OCR-powered extraction of medicine details
- **Medication Reminders**: Custom schedules, missed dose alerts, and adherence tracking
- **Dynamic Dashboards**: Separate views for users and admins
- **Admin Insights**: Overview of prescription activity, most prescribed medicines, and user management
- **Emergency Notifications**: SMS alerts via Twilio for missed doses

---

## 🗂️ Folder Structure

```
app/
  dao/           # Data access objects
  db/            # Database connection logic
  models/        # Database models
  routes/        # Flask route handlers
  static/        # CSS, JS, images
  templates/     # HTML templates
  utils/         # Utility functions (OCR, parsing, validation)
run.py           # Main Flask app entry point
db.py            # Database setup
schema.txt       # Database schema (PostgreSQL)
requirements.txt # Python dependencies
.env             # Environment variables
```

---

## 🗄️ Database Schema

- **users**: User info, authentication, emergency contacts
- **prescriptions**: Prescription details (OCR extracted)
- **medicines**: Master medicine list
- **reminders**: Medication reminders for users
- **dose_logs**: Tracks individual doses and adherence

---

## ⚙️ Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Configure environment:**
   - Create a `.env` file with your DB credentials, SECRET_KEY, Twilio keys, etc.
3. **Initialize database:**
   - Create a PostgreSQL database and run the schema from `schema.txt`.
4. **Start the app:**
   ```bash
   python run.py
   ```

---

## 👤 Usage

- **Users:** Log in, upload prescriptions, set reminders, and view dashboard stats.
- **Admins:** Manage users, view all prescriptions, and see stats like most prescribed medicines.

---

## 🛠️ Tech Stack

- **Python (Flask)**
- **PostgreSQL**
- **Bootstrap** (UI)
- **Vanilla JS**
- **Twilio** (SMS notifications)

---

## 📄 License

This project is for educational and demonstration purposes.

---

## 📬 Contact Us

- Developers:
  - Jiya Govani
  - Vansh Bhadvaniya (https://github.com/VanshBhadvaniya)
  - Kiri Sujal (https://github.com/sujal-045)

We welcome your feedback, questions, and suggestions! Feel free to reach out or open an issue on GitHub if you want to connect, contribute, or just say hello.
