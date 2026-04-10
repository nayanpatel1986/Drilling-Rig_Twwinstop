from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from db_models import User
import uvicorn
from typing import Dict, List

import os
from dotenv import load_dotenv

load_dotenv()
ENV = os.getenv("ENV", "development").lower()
is_prod = ENV == "production"

app = FastAPI(
    title="DrillBit Digital Twin API", 
    version="1.0.0",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json"
)

LIVE_MODE = os.getenv("LIVE_MODE", "false").lower() == "true"

from auth.router import get_current_user

# Get CORS origins from environment or default to localhost
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081,http://localhost:3001,http://127.0.0.1:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Analytics engine import
from services.analytics import engine as analytics_engine
from services.websocket_server import ws_manager, websocket_endpoint

from auth.router import router as auth_router
from database import engine, Base

from services.wells import router as wells_router
from services.export import router as export_router
from services.witsml_config import router as witsml_config_router
from services.modbus_config import router as modbus_config_router
from services.modbus_router import router as modbus_control_router

# Create tables if not exist
Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(wells_router)
app.include_router(export_router)
app.include_router(witsml_config_router)
app.include_router(modbus_config_router)
app.include_router(modbus_control_router)

@app.on_event("startup")
async def startup_event():
    # Connect WebSocket manager to analytics engine
    analytics_engine.ws_manager = ws_manager
    
    # Analytics engine (WITSML simulator / client)
    if not LIVE_MODE:
        analytics_engine.start()
        print("Backend started. WITSML data pipeline is active (Simulator).")
    else:
        analytics_engine.start()
        print("Backend started. LIVE MODE active — waiting for WITSML/Modbus connections.")

    # Connection of managers
    pass

@app.on_event("shutdown")
async def shutdown_event():
    pass

@app.get("/")
def read_root():
    return {"status": "online", "service": "DrillBit Digital Twin Backend"}

def convert_units_to_metric(data):
    def map_and_convert(row):
        if "BitDepth" in row and row["BitDepth"] is not None:
            row["BitDepth"] = round(row["BitDepth"], 2)
        if "Depth" in row and row["Depth"] is not None:
            row["Depth"] = round(row["Depth"], 2)
        if "BlockPosition" in row and row["BlockPosition"] is not None:
            row["BlockPosition"] = round(row["BlockPosition"], 2)
            
        # Convert BBL to Cubic Meters
        bbl_fields = ["PitVolume1", "PitVolume2", "PitVolume3", "PitVolume4", 
                      "TripTank1", "TripTank2", "TripTankGL", "TT_VOL"]
        # The frontend now handles BBL to m3 conversions to allow user preference selection.
        for field in bbl_fields:
            if field in row and row[field] is not None:
                row[field] = round(row[field], 2)

                
        # Map Pump Pressure / Standpipe Pressure for UI
        # Only override with Modbus values if they actually exist and are not null
        if row.get("PUMPPRESSURE") is not None:
            row["StandpipePressure"] = row["PUMPPRESSURE"]
        elif row.get("STP_PRS_1") is not None:
            row["StandpipePressure"] = row["STP_PRS_1"]
        elif "StandpipePressure" not in row and row.get("Standpipe Pressure 1") is not None:
            row["StandpipePressure"] = row["Standpipe Pressure 1"]
            
        # Map Modbus TWINSTOP parameters for UI compatibility
        if row.get("Point1Capture") is not None:
            row["C1"] = row["Point1Capture"]
        if row.get("Point2Capture") is not None:
            row["C2"] = row["Point2Capture"]
        if row.get("Point3Capture") is not None:
            row["C3"] = row["Point3Capture"]
        if row.get("LiveEncounterCount") is not None:
            row["EDMSCOUNT"] = row["LiveEncounterCount"]
        
        if row.get("BH") is not None:
            row["BLOCK_HEIGHT"] = row["BH"]
            row["BLOCK_POS"] = row["BH"]
    
    if isinstance(data, dict):
        map_and_convert(data)
    elif isinstance(data, list):
        for row in data:
            map_and_convert(row)
            
    return data

# ── Rig Data Router (with /api prefix for frontend compatibility) ──
from fastapi import APIRouter
rig_router = APIRouter(prefix="/rig", tags=["Rig Telemetry"])

@rig_router.get("/latest")
async def get_latest_data(_: User = Depends(get_current_user)):
    """Get latest drilling values from InfluxDB (WITSML + Modbus Sensors)."""
    from services.influx import InfluxWrapper
    from services.analytics import engine
    
    influx = InfluxWrapper()
    
    # 1. Get WITSML Data (Measurement: realtime_drilling)
    witsml_data = {}
    if not (LIVE_MODE and not engine.is_witsml_connected):
        witsml_data = influx.query_latest("realtime_drilling") or {}
    
    # 2. Get Modbus Sensor Data (Measurement: modbus)
    sensor_data = influx.query_sensors_latest("modbus") or {}

    # 3. Merge Data
    merged_data = {**sensor_data, **witsml_data}
    
    # Always return a valid object, even if empty, to prevent frontend freeze.
    # Frontend handles empty objects by defaulting to 0/Offline.
    return convert_units_to_metric(merged_data)

@rig_router.get("/history")
async def get_history(range: str = "-5m", _: User = Depends(get_current_user)):
    """Get time-series drilling data for charts."""
    from services.influx import InfluxWrapper
    influx = InfluxWrapper()
    
    # Query both WITSML and Modbus measurements
    witsml_rows = influx.query_range(range, "realtime_drilling")
    modbus_rows = influx.query_range(range, "modbus")
    
    # Merge: combine both sources
    all_rows = witsml_rows + modbus_rows
    
    # If both have data, merge by timestamp
    if witsml_rows and modbus_rows:
        merged = {}
        for row in all_rows:
            t = row.get("time", "")
            if t not in merged:
                merged[t] = row
            else:
                merged[t].update(row)
        all_rows = sorted(merged.values(), key=lambda r: r.get("time", ""))
    
    return convert_units_to_metric(all_rows)

@rig_router.get("/history-range")
async def get_history_range(start: str = "", stop: str = "", _: User = Depends(get_current_user)):
    """Get time-series data between two absolute ISO timestamps."""
    from services.influx import InfluxWrapper
    influx = InfluxWrapper()
    
    if not start or not stop:
        return []
    
    # Query both measurements
    witsml_rows = influx.query_custom_range(start, stop, "realtime_drilling")
    modbus_rows = influx.query_custom_range(start, stop, "modbus")
    
    all_rows = witsml_rows + modbus_rows
    
    if witsml_rows and modbus_rows:
        merged = {}
        for row in all_rows:
            t = row.get("time", "")
            if t not in merged:
                merged[t] = row
            else:
                merged[t].update(row)
        all_rows = sorted(merged.values(), key=lambda r: r.get("time", ""))
    
    return convert_units_to_metric(all_rows)

@rig_router.get("/sensors")
async def get_sensors(_: User = Depends(get_current_user)):
    """Get latest equipment sensor readings from Telegraf."""
    from services.influx import InfluxWrapper
    influx = InfluxWrapper()
    data = influx.query_sensors_latest("modbus")
    return data

app.include_router(rig_router)

@app.get("/health")
def health_check():
    from services.analytics import engine
    return {
        "status": "ok", 
        "live_mode": LIVE_MODE,
        "witsml_connected": engine.is_witsml_connected if LIVE_MODE else False
    }

@app.websocket("/ws/realtime")
async def realtime_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time drilling data"""
    await websocket_endpoint(websocket)

@app.get("/ws/stats")
async def websocket_stats():
    """Get WebSocket connection statistics"""
    return ws_manager.get_stats()

if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", 8000))
    reload = os.getenv("API_RELOAD", "true").lower() == "true" and not is_prod
    
    uvicorn.run("main:app", host=host, port=port, reload=reload)
