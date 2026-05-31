# 🛡️ SafeGuard — Women Safety Alert & Tracking System

A modern, full-stack **Women Safety Alert & Tracking System** with emergency SOS, live GPS tracking, SMS/email alerts, push notifications, fake call feature, complaint registration, nearby emergency services finder, and safe route suggestions.

Built with **Django REST Framework** + vanilla **HTML/CSS/JavaScript** — no frontend framework required.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚨 **Emergency SOS** | Triggers siren sound, browser notification, SMS to all contacts, email alert, and push notification |
| 📍 **Live GPS Tracking** | Real-time location monitoring via OpenStreetMap with contact distance chips |
| 👥 **Contact Management** | Add/edit/delete emergency contacts who receive alerts |
| 💬 **Emergency SMS** | Sends SOS message via Twilio or Fast2SMS to all contacts |
| 📧 **Email Alerts** | Sends emergency email via SendGrid |
| 🔔 **Push Notifications** | Firebase Cloud Messaging (FCM) push to user device |
| 📞 **Fake Call Feature** | Simulated incoming call UI with vibration — useful for escaping unsafe situations |
| 📋 **Complaint Registration** | File complaints with title, description, date, location, suspect info |
| 🏥 **Nearby Services** | Find nearby police stations, hospitals, and ATMs |
| 🗺️ **Safe Route Suggestion** | Recommendations for safest walking routes |
| 🤖 **AI Scream Detection** | Simulated audio anomaly detection dashboard |
| 👑 **Admin Panel** | User management, alert monitoring, system status |
| 🔐 **User Authentication** | Login/Register with backend API + localStorage fallback |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Django 4.2+ / Django REST Framework |
| **Frontend** | HTML5 / CSS3 / Vanilla JavaScript |
| **Database** | SQLite (dev) / MySQL (prod) |
| **SMS** | Twilio API / Fast2SMS API |
| **Email** | SendGrid API |
| **Push** | Firebase Cloud Messaging (FCM) |
| **Maps** | OpenStreetMap embed (free, no API key) / Google Maps API (optional) |

---

## 📁 Project Structure

```
safeguard/
├── index.html              # Main frontend (all pages)
├── css/
│   └── style.css           # Full stylesheet (neon dark theme, glassmorphism, animations)
├── js/
│   └── app.js              # All frontend logic (SOS, contacts, alerts, maps, fake call, etc.)
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example        # Copy to .env and fill in your API keys
│   ├── start.bat           # One-click startup (Windows)
│   ├── backend/
│   │   ├── settings.py     # Django configuration
│   │   ├── urls.py         # URL routing (serves frontend + API)
│   │   └── wsgi.py
│   └── api/
│       ├── models.py       # UserProfile, EmergencyContact, Alert, Complaint, SOSEvent
│       ├── views.py        # Auth, CRUD, SOS workflow, places, SMS, email, FCM
│       ├── serializers.py  # DRF serializers
│       ├── urls.py         # API endpoint definitions
│       ├── utils.py        # Twilio, Fast2SMS, SendGrid, FCM, Google Maps helpers
│       └── admin.py        # Django admin registration
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- pip

### 1. Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

### 2. Configure API Keys (optional — app works without them)

```bash
copy .env.example .env
```

Edit `.env` and add your API keys (see [API Services](#-api-services) section).

### 3. Run

```bash
python manage.py migrate
python manage.py runserver
```

Open **http://127.0.0.1:8000** in your browser.

### One-click (Windows)

Double-click **`backend/start.bat`** — it creates the venv, installs deps, migrates, and starts the server.

---

## 🔑 Default Login

| Username | Password |
|----------|----------|
| `admin` | `admin` |

Or create a new account via the **Register** tab on the login page.

---

## 🌐 API Endpoints

All APIs are prefixed with `/api/` and return JSON.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Create account |
| POST | `/api/auth/login/` | Login |
| GET | `/api/auth/me/` | Current user info (auth required) |

### Emergency Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts/` | List contacts |
| POST | `/api/contacts/` | Add contact |
| GET/PUT/DELETE | `/api/contacts/<id>/` | Contact detail |

### SOS & Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sos/trigger/` | Trigger SOS — sends SMS, email, push |
| POST | `/api/sos/resolve/<id>/` | Resolve an SOS event |
| GET | `/api/sos/history/` | SOS history |
| GET/POST | `/api/alerts/` | Dashboard alerts |

### Complaints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/complaints/` | File complaint |
| GET/DELETE | `/api/complaints/<id>/` | Complaint detail |

### Places & SMS
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/places/nearby/?lat=&lng=&type=police` | Nearby places |
| POST | `/api/send-sms/` | Direct SMS |
| POST | `/api/sos-alert/` | Batch SOS SMS |
| POST | `/api/fcm/update/` | Update FCM token |
| GET | `/api/health/` | System health |

---

## 🔌 API Services

The app auto-falls back to browser-based alternatives when API keys are missing. All features work without configuration — the APIs just add real SMS/email/push delivery.

| Service | Purpose | How to Get |
|---------|---------|------------|
| **Twilio** | SMS | https://twilio.com — Free trial credits |
| **Fast2SMS** | SMS (India) | https://www.fast2sms.com |
| **SendGrid** | Email | https://sendgrid.com — 100 emails/day free |
| **Firebase (FCM)** | Push Notifications | https://console.firebase.google.com |
| **Google Maps** | Geocoding, Places | https://console.cloud.google.com |

---

## 🎨 Design

- **Theme:** Neon dark with pink (`#ff2d7b`) & electric blue (`#00d4ff`) gradients
- **UI Style:** Glassmorphism cards with backdrop blur, animated orbs, rotating satellite rings
- **Background:** Futuristic smart city with cyber grid overlay, floating particles, scan line
- **Animations:** Page transitions, staggered card entrances, shimmer loading, neon pulse glow
- **Responsive:** 6 breakpoints (1200px → 380px), touch-friendly targets, print styles

---

## 📸 Screenshots

(Screenshots would be added here for the project report)

---

## 🎯 Use Cases

- **College project** — Final year BCA/BE/CS project
- **Women safety app** — Real-time emergency response system
- **Safety dashboard** — Monitor and respond to alerts

---

## 📄 License

MIT — Free for educational and personal use.
