# Farm Copilot

Farm Copilot is an intelligent agricultural platform designed to bridge the gap between crop diagnosis and real-world farm management. By combining AI-driven diagnostic analysis with local vendor networks, the system enables farmers to identify crop issues, receive dosage guidance, source authentic supplies, and request machinery support through a unified interface.

---

## Live Applications

| Application | Description | Live Link |
| :--- | :--- | :--- |
| **Farmer Web Application** | Core platform for diagnosis, treatment guidelines, weather insights, and local supply orders | [farm-coppilot.vercel.app](https://farm-coppilot.vercel.app) |
| **AgriVendor Portal** | Merchant dashboard for order fulfillment, inventory management, and fleet dispatch | [farm-copilot-vendor-lac.vercel.app](https://farm-copilot-vendor-lac.vercel.app) |

---

## Key Capabilities

→ **AI Crop Diagnosis**: Powered by Google Gemini AI, providing immediate disease analysis, severity ratings, and confidence evaluations from crop photos or descriptions.

→ **Treatment & Dosage Guidance**: Tailored agricultural recommendations with precise chemical dosage calculations based on crop type and affected area.

→ **Local Order Broadcasting**: Direct request dispatching to nearby verified agricultural shops for fast product procurement and delivery tracking.

→ **Machinery & Equipment Rental**: Streamlined rental requests for tractors, harvesters, and specialized farm equipment from registered vendor fleets.

→ **Soil Health Analysis**: Automated evaluation of soil metrics including NPK levels, pH balance, and moisture content with actionable soil enrichment steps.

---

## Architecture Overview

```text
├── copilot/      # Farmer-facing Web Application (React, Vite)
├── vendor/       # Merchant & Fleet Management Portal (React, Vite)
├── server/       # Central Backend Services & Gemini AI Integration (Node.js, Express)
└── PRODUCT.md    # Product Specifications & Architecture Reference
```

---

## Technology Stack

→ **Frontend Frameworks**: React, Vite, CSS3

→ **Backend Engine**: Node.js, Express.js REST APIs

→ **Artificial Intelligence**: Google Gemini AI (`gemini-2.5-flash`)

→ **Cloud Infrastructure**: Vercel & Render
