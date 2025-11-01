# 🗳️ Election Portal

A modern, user-friendly web application designed to conduct and manage online elections for student organizations like **EMAS (Event Management and Activities Society)**.  
Built using **HTML**, **Tailwind CSS**, **JavaScript**, and **Firebase**, this project ensures a fair, secure, and smooth online voting experience.

---

## 🚀 Features

- **🧾 User Registration Popup**
  - When a user first opens the election page, a popup appears asking for their *name* and *roll number*.
  - This information is stored and linked to their device to prevent multiple voting attempts.

- **🔐 Secure Voting**
  - Each user can vote **only once per position**.
  - Votes are stored securely in Firebase in real time.

- **📊 Dynamic Candidate Display**
  - Displays multiple positions (President, Vice President, Event Coordinator, etc.).
  - On selecting a position, candidates are shown with a short description and vote button.

- **📱 Responsive Design**
  - Fully mobile-friendly UI with smooth transitions and clean layout.
  - Optimized for small screens using Tailwind CSS.

- **⏱️ Session Management**
  - Each user session remains active for **2 hours**.
  - After expiration, the user must re-register to continue voting.

---

## 🧩 Positions & Descriptions

| Position | Description |
|-----------|--------------|
| **President** | Leads the EMAS team, manages overall functioning, and represents the organization officially. |
| **Vice President** | Supports the president and coordinates between event teams. |
| **Event Coordinator** | Plans and executes various college events efficiently. |
| **Cultural Representative** | Handles cultural and creative events within the organization. |

---

## 🛠️ Tech Stack

- **Frontend:** HTML, Tailwind CSS, JavaScript  
- **Backend:** Firebase Realtime Database  
- **Hosting:** GitHub Pages / Vercel  

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/theujwalthakare/Election-Portal.git
cd Election-Portal
