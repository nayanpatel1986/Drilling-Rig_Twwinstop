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

# Create tables if not exist
Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(wells_router)
app.include_router(export_router)
app.include_router(witsml_config_router)
app.include_router(modbus_config_router)

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
            row["BitDepth"] = round(row["BitDepth"] * 0.3048, 2)
        if "Depth" in row and row["Depth"] is not None:
            row["Depth"] = round(row["Depth"] * 0.3048, 2)
        if "BlockPosition" in row and row["BlockPosition"] is not None:
            row["BlockPosition"] = round(row["BlockPosition"] * 0.3048, 2)
            
        # Convert BBL to Cubic Meters
        bbl_fields = ["PitVolume1", "PitVolume2", "PitVolume3", "PitVolume4", 
                      "TripTank1", "TripTank2", "TripTankGL", "TT_VOL"]
        for field in bbl_fields:
            if field in row and row[field] is not None:
                row[field] = round(row[field] * 0.158987, 2)
                
        # Map Pump Pressure / Standpipe Pressure for UI
        # Prefer Modbus values (PUMPPRESSURE / STP_PRS_1) over WITSML StandpipePressure
        if "PUMPPRESSURE" in row and row["PUMPPRESSURE"] is not None:
            row["StandpipePressure"] = row["PUMPPRESSURE"]
        elif "STP_PRS_1" in row and row["STP_PRS_1"] is not None:
            row["StandpipePressure"] = row["STP_PRS_1"]
        elif "StandpipePressure" not in row:
            if "Standpipe Pressure 1" in row and row["Standpipe Pressure 1"] is not None:
                row["StandpipePressure"] = row["Standpipe Pressure 1"]
    
    if isinstance(data, dict):
        map_and_convert(data)
    elif isinstance(data, list):
        for row in data:
            map_and_convert(row)
            
    return data

@app.get("/rig/latest")
async def get_latest_data():
    """Get latest drilling values from InfluxDB."""
    from services.influx import InfluxWrapper
    from services.analytics import engine
    
    # If WITSML is disconnected in live mode, return an empty-like object 
    # so the frontend resets values to 0 instead of freezing on old data.
    if LIVE_MODE and not engine.is_witsml_connected:
        return {"_WITSML_STATUS": "Disconnected"}
        
    influx = InfluxWrapper()
    data = influx.query_latest("realtime_drilling")
    
    if not data:
        return {"error": "No live data available"}
        
    # Check for stale data (older than 5 minutes)
    if "_time" in data:
        import pandas as pd
        from datetime import datetime, timezone
        try:
            data_time = pd.to_datetime(data["_time"])
            if data_time.tzinfo is None:
                data_time = data_time.tz_localize('UTC')
            now = datetime.now(timezone.utc)
            if (now - data_time).total_seconds() > 300:
                if LIVE_MODE:
                    return {"_WITSML_STATUS": "Stale"}
        except Exception:
            pass
            
    return convert_units_to_metric(data)

@app.get("/rig/history")
async def get_history(range: str = "-5m"):
    """Get time-series drilling data for charts."""
    from services.influx import InfluxWrapper
    influx = InfluxWrapper()
    rows = influx.query_range(range, "realtime_drilling")
    return convert_units_to_metric(rows)

@app.get("/rig/history-range")
async def get_history_range(start: str, stop: str):
    """Get time-series drilling data between two absolute ISO timestamps."""
    from services.influx import InfluxWrapper
    influx = InfluxWrapper()
    rows = influx.query_custom_range(start, stop, "realtime_drilling")
    return convert_units_to_metric(rows)

@app.get("/rig/sensors")
async def get_sensors():
    """Get latest equipment sensor readings from Telegraf."""
    from services.influx import InfluxWrapper
    influx = InfluxWrapper()
    data = influx.query_sensors_latest("rig_sensors")
    return data

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
