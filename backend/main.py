from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
import uvicorn
from typing import Dict, List

import os
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="DrillBit Digital Twin API", version="1.0.0")

LIVE_MODE = os.getenv("LIVE_MODE", "false").lower() == "true"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

    # Create default admin user
    from database import SessionLocal
    from db_models import User, UserRole
    from auth.utils import get_password_hash
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin_user = User(
                username="admin",
                email="admin@drillbit.com",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN
            )
            db.add(admin_user)
            db.commit()
            print("Default admin user created: admin / admin123")
    except Exception as e:
        print(f"Error creating default user: {e}")
    finally:
        db.close()

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
async def get_latest_data():
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
    
    if not merged_data:
        return {"error": "No data available from WITSML or Sensors"}
        
    return convert_units_to_metric(merged_data)

@rig_router.get("/history")
async def get_history(range: str = "-5m"):
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
async def get_history_range(start: str = "", stop: str = ""):
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
async def get_sensors():
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
