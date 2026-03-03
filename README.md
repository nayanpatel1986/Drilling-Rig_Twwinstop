# DrillBit - Digital Twin & Condition Monitoring for NOV E-1400

A comprehensive Digital Twin application for drilling rigs, featuring real-time WITSML data ingestion, condition monitoring, and drilling optimization analytics.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running.

### Installation

1. **Clone/Download** this repository.
2. **Navigate** to the project root:
   ```bash
   cd c:\DS_E1400RIG
   ```
3. **Start the Stack**:
   ```bash
   docker-compose down -v  # Optional: Clean start
   docker-compose up --build
   ```

### Accessing the Application

- **Frontend Dashboard**: [http://localhost:3001](http://localhost:3001)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **InfluxDB UI**: [http://localhost:8086](http://localhost:8086) (User: admin, Pass: password123)

## 🏗 Architecture

- **Frontend**: React, Vite, TailwindCSS, Recharts (Data Visualization).
- **Backend**: Python FastAPI, Pandas (Analytics), WITSML Parser.
- **Data Layer**: InfluxDB (Time-series), PostgreSQL (Metadata), Mosquitto (MQTT).
- **Ingestion**: Telegraf (Simulated Sensors), Custom WITSML Simulator.

## 🌟 Key Features

1. **Rig Overview**: 3D-style status monitoring.
2. **Equipment Health**: Condition monitoring for Engines, Pumps, and Drawworks.
3. **Real-Time EDR**: Depth-based logging of ROP, WOB, Torque.
4. **PVR Analytics**: Parameter vs Rate optimization plots (MSE analysis).
5. **Reports**: Automated daily drilling and performance reports.

## 🔧 Development

- To run frontend locally without Docker:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
- To run backend locally:
  ```bash
  cd backend
  pip install -r requirements.txt
  uvicorn main:app --reload
  ```
