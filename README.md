# 🌾 Farm Copilot

AI-powered crop diagnosis, disease treatment recommendations, product verification, and personalized farming solutions — all in one place.

---

## 🚀 Live Applications

| Application | Description | Live Link |
| :--- | :--- | :--- |
| **Farmer Web App** 🌾 | Primary platform for crop diagnosis, treatment, weather, and ordering | [farm-coppilot.vercel.app](https://farm-coppilot.vercel.app) |
| **AgriVendor Portal** 🛍️ | Merchant dashboard for managing orders, stock, and equipment fleet | [farm-copilot-vendor-lac.vercel.app](https://farm-copilot-vendor-lac.vercel.app) |

---

## ✨ Features

- **🤖 AI Crop Diagnosis**: Powered by Google Gemini AI for instant disease detection, severity rating, and confidence scoring.
- **💊 Treatment & Dosage Calculator**: Get tailored recommendations and dosage instructions for crops.
- **🛒 Nearby Agri-Shop Order Broadcasting**: Broadcast chemical and treatment orders directly to local vendors.
- **🚜 Machinery & Equipment Rental**: Request tractor and harvester rentals from nearby equipment fleets.
- **🧪 Soil Report AI Analysis**: Analyze soil parameters (NPK, pH, Moisture) with actionable soil health recommendations.

---

## 📁 Repository Structure

```text
├── copilot/      # Farmer-facing Web Application (React + Vite)
├── vendor/       # AgriVendor Merchant Portal (React + Vite)
├── server/       # Express Backend API & AI Integration (Node.js)
└── PRODUCT.md    # Detailed Product & Architecture Schema
```

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Lucide Icons, CSS3
- **Backend**: Node.js, Express.js
- **AI Integration**: Google Gemini AI (`gemini-2.5-flash`)
- **Deployment**: Vercel & Render
