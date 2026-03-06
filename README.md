# CityWatch — Infrastructure Capacity & Utilization Monitor

CityWatch is a high-fidelity, real-time infrastructure simulation and monitoring dashboard designed for urban planners, emergency responders, and city officials. It provides a comprehensive view of a city's vital signs, from power grid stability to road network congestion, using a sophisticated simulation engine that mimics real-world urban dynamics.

## 🏙️ Core Concept

The application simulates a city divided into 9 distinct zones, each with its own demographic profile and infrastructure requirements. Unlike static dashboards, CityWatch features a **Diurnal Simulation Engine** that follows a 24-hour cycle, causing infrastructure load to shift naturally between residential, commercial, and industrial areas as the "day" progresses.

## 🚀 Key Features

### 1. Real-Time Simulation Engine
- **Diurnal Cycles**: Infrastructure usage follows a 24-hour clock. Residential zones peak in the morning/evening, while Commercial zones peak during business hours.
- **Zone Profiles**: Nine zones categorized as *Residential*, *Commercial*, *Industrial*, or *City Core* with unique consumption behaviors.
- **Dynamic Load Factors**: Combines base capacity, time-of-day multipliers, long-term growth drift, and short-term stochastic noise.

### 2. Intelligent Monitoring (Dashboard)
- **City Health Index**: A weighted KPI reflecting the overall stability of the city's infrastructure.
- **Priority Triage**: An automated list that identifies the most critical asset failures and suggests immediate remediation protocols.
- **Zone Heatmap**: A 3x3 grid providing an instant visual status of the entire city.

### 3. Predictive Analytics
- **Breach Forecasting**: Uses linear regression on historical data to predict exactly when an asset will exceed its 90% capacity threshold.
- **Trend Visualization**: Interactive charts showing live data alongside projected 12-tick trends.

### 4. Cascade Failure Simulator
- **Dependency Mapping**: Models how failures in one system (e.g., Power) impact others (e.g., Water filtration or Healthcare triage).
- **Adjacency Spread**: Simulates how a localized crisis in one zone puts stress on neighboring districts.
- **Remediation Protocols**: Step-by-step emergency procedures for different failure scenarios.

### 5. "What-If" Planning Engine
- **Population Growth**: Simulate the impact of adding up to 60,000 new residents to a specific zone.
- **Event Simulation**: Model the infrastructure strain caused by major concerts, natural disasters, peak-hour traffic, or large-scale construction.

### 6. Public Transparency Portal
- **Citizen Interface**: A simplified, high-contrast view for the general public.
- **Status Alerts**: Plain-English updates on city health and service availability.
- **Emergency Directory**: Quick access to essential city services and helplines.

## 🛠️ Tech Stack

- **Framework**: React 19 (TypeScript)
- **Styling**: Custom CSS-in-JS / Inline Styles (Optimized for high-performance rendering)
- **Visualization**: Recharts (Forecasting & Trends)
- **Icons**: Lucide-React
- **Build Tool**: Vite

## 🚦 Getting Started

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Simulation Controls
- Use the **Sidebar** to switch between specialized views.
- The **Sim Time** indicator shows the current hour of the 24-hour cycle.
- In the **Cascade Sim**, click on a zone and then an asset to trigger a manual failure.

## ⚖️ License

This project is developed for demonstration and urban planning simulation purposes.
