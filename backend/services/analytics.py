import time
import threading
import pandas as pd
from datetime import datetime
import asyncio
from witsml.simulator import WitsmlSimulator
from witsml.parser import WitsmlParser
from witsml.mapper import MnemonicMapper
from witsml.client import WitsmlClient
from services.influx import InfluxWrapper
import os
from database import SessionLocal
from db_models import WitsmlConfig

class AnalyticsEngine:
    def __init__(self):
        self.running = False
        self.simulator = WitsmlSimulator()
        self.influx = InfluxWrapper()
        self.witsml_client = None  # Persistent WITSML client for status checking
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        
        # Performance optimization: Cache timezone offset
        self._tz_offset = pd.Timedelta(hours=-5, minutes=-30)  # IST to UTC
        
        # WebSocket manager (will be set by main.py)
        self.ws_manager = None
    
    @property
    def is_witsml_connected(self):
        """Check if WITSML server is reachable."""
        if self.witsml_client and self.witsml_client._connected:
            return True
        return False

    def start(self):
        self.running = True
        self.thread.start()

    def stop(self):
        self.running = False
        self.thread.join()

    def _run_loop(self):
        print("Analytics Engine Started (Live Concurrency Optimized)...")
        last_config_check = 0
        last_witsml_poll = 0
        
        cached_config = None
        custom_mappings = {}
        well_uid = wellbore_uid = log_uid = None

        while self.running:
            df = pd.DataFrame()
            LIVE_MODE = os.getenv("LIVE_MODE", "false").lower() == "true"
            
            current_time = time.time()

            if LIVE_MODE:
                # 1. Update Config Cache Every 10 Seconds
                if current_time - last_config_check > 10:
                    last_config_check = current_time
                    db = SessionLocal()
                    try:
                        config = db.query(WitsmlConfig).filter(WitsmlConfig.is_active == True).first()
                        if config and config.server_url:
                            custom_mappings.clear()
                            for mapping in config.channel_mappings:
                                custom_mappings[mapping.witsml_mnemonic.upper()] = mapping.app_parameter
                                
                            config_changed = (
                                not self.witsml_client
                                or self.witsml_client.url != config.server_url
                                or self.witsml_client.username != config.username
                                or self.witsml_client.password != config.password
                            )
                            if config_changed:
                                self.witsml_client = WitsmlClient(config.server_url, config.username, config.password, config.witsml_version)
                                print(f"WITSML: Connect/Reconnect successful -> {config.server_url}", flush=True)
                            
                            well_uid = config.well_uid
                            wellbore_uid = config.wellbore_uid
                            log_uid = config.log_uid
                    except Exception as e:
                        print(f"WITSML Config Sync Error: {e}")
                    finally:
                        db.close()
                
                # 2. Poll WITSML Server Every 1.0 Seconds 
                if current_time - last_witsml_poll > 1.0:
                    last_witsml_poll = current_time
                    if self.witsml_client and well_uid:
                        try:
                            # Using 1-second timeout limits if possible, catching generalized exceptions
                            df = self.witsml_client.get_latest_log_data(well_uid, wellbore_uid, log_uid, list(custom_mappings.keys()))
                        except Exception as e:
                            print(f"WITSML Live Polling Timeout/Error: {e}")
            else:
                # DEMO MODE: Generate simulated data
                xml_file = self.simulator.generate_log_step()
                with open(xml_file, 'r') as f:
                    xml_content = f.read()
                df = WitsmlParser.parse_log(xml_content)
            
            if df is not None and not df.empty:
                # custom_mappings already loaded from DB session above (for LIVE_MODE)
                if not LIVE_MODE:
                    custom_mappings = {}
                
                print(f"Pipeline: DataFrame has {len(df)} rows, columns: {list(df.columns[:10])}", flush=True)
                
                df = MnemonicMapper.map_dataframe(df, custom_mappings)
                
                # 3. Calculate Digital Twin Parameters
                df = self._calculate_derived_params(df)
                
                # 4. Check Alarms
                self._check_alarms(df)

                # 5. Store to InfluxDB
                # Find the time/index column (could be TIME, RIGTIME, or similar)
                time_col = None
                for candidate in ['TIME', 'RIGTIME', 'RigTime', 'time', 'DATETIME', 'DateTime']:
                    if candidate in df.columns:
                        time_col = candidate
                        break
                
                if time_col:
                    try:
                        # Optimized time handling
                        df['time'] = pd.to_datetime(df[time_col], errors='coerce')
                        
                        # The WITSML server provides times in local rig time (e.g. +05:30)
                        # We just need to convert it to UTC for InfluxDB
                        if df['time'].dt.tz is None:
                            df['time'] = df['time'].dt.tz_localize('UTC')
                        else:
                            df['time'] = df['time'].dt.tz_convert('UTC').dt.tz_localize(None)
                        
                        print(f"Pipeline: time col={time_col}, UTC sample={df['time'].iloc[0] if len(df) > 0 else 'N/A'}", flush=True)
                            
                        df = df.dropna(subset=['time'])
                        df.set_index('time', inplace=True)
                        if time_col in df.columns:
                            df.drop(columns=[time_col], inplace=True)
                        
                        # Ensure numeric types are always float to avoid InfluxDB type conflicts
                        for col in df.columns:
                            # Convert to numeric, turning empty strings to NaN
                            numeric_col = pd.to_numeric(df[col], errors='coerce')
                            
                            # Replace NaN with 0.0 so the frontend always receives the column
                            df[col] = numeric_col.fillna(0.0).astype(float)

                        self.influx.write_dataframe(df, "realtime_drilling")
                        print(f"Processed WITSML Log: {len(df)} rows written to InfluxDB", flush=True)
                        
                        # Broadcast to WebSocket clients (Phase 2 optimization)
                        if self.ws_manager and len(df) > 0:
                            try:
                                latest_data = df.iloc[-1].to_dict()
                                latest_data['_time'] = df.index[-1].isoformat()
                                latest_data['_type'] = 'realtime_data'
                                
                                # Keep raw depth values but round to 2 decimal places to match UI expectations
                                if "BitDepth" in latest_data and latest_data["BitDepth"] is not None:
                                    latest_data["BitDepth"] = round(latest_data["BitDepth"], 2)
                                if "Depth" in latest_data and latest_data["Depth"] is not None:
                                    latest_data["Depth"] = round(latest_data["Depth"], 2)
                                if "BlockPosition" in latest_data and latest_data["BlockPosition"] is not None:
                                    latest_data["BlockPosition"] = round(latest_data["BlockPosition"], 2)
                                    
                                bbl_fields = ["PitVolume1", "PitVolume2", "PitVolume3", "PitVolume4", 
                                              "TripTank1", "TripTank2", "TripTankGL", "TT_VOL"]
                                for field in bbl_fields:
                                    if field in latest_data and latest_data[field] is not None:
                                        latest_data[field] = round(latest_data[field], 2)
                                
                                if latest_data.get("PUMPPRESSURE") is not None:
                                    latest_data["StandpipePressure"] = latest_data["PUMPPRESSURE"]
                                elif latest_data.get("STP_PRS_1") is not None:
                                    latest_data["StandpipePressure"] = latest_data["STP_PRS_1"]
                                elif "StandpipePressure" not in latest_data and latest_data.get("Standpipe Pressure 1") is not None:
                                    latest_data["StandpipePressure"] = latest_data["Standpipe Pressure 1"]

                                # Run async broadcast in event loop
                                loop = asyncio.new_event_loop()
                                asyncio.set_event_loop(loop)
                                loop.run_until_complete(self.ws_manager.broadcast(latest_data))
                                loop.close()
                            except Exception as e:
                                print(f"WebSocket broadcast error: {e}", flush=True)
                    except Exception as e:
                        print(f"InfluxDB Write Error: {e}", flush=True)
                else:
                    print(f"Pipeline: No time column found in {list(df.columns[:15])}. Skipping InfluxDB write.", flush=True)

            time.sleep(0.05)  # 50ms refresh rate for <100ms latency target

    def _calculate_derived_params(self, df):
        """Calculates MSE, d-exponent, etc."""
        # simple MSE = (WOB/Area) + (120*Pi*RPM*Torque)/(Area*ROP) -> simplified for demo
        try:
            if 'WOB' in df.columns and 'ROP' in df.columns and 'RPM' in df.columns:
                 # Toy calculation for Mechanical Specific Energy
                 # Ensure numeric
                 wob = pd.to_numeric(df['WOB'], errors='coerce').fillna(0)
                 rop = pd.to_numeric(df['ROP'], errors='coerce').fillna(1) # avoid div0
                 rpm = pd.to_numeric(df['RPM'], errors='coerce').fillna(0)
                 
                 df['MSE'] = (wob * 1000) / (8.5**2) + (1000 * rpm) / rop
        except Exception as e:
            print(f"Calc Error: {e}")
        return df

    def _check_alarms(self, df):
        """Checks for threshold violations."""
        try:
            # Example: High RPM Alarm
            if 'RPM' in df.columns:
                high_rpm = df[pd.to_numeric(df['RPM'], errors='coerce') > 180]
                if not high_rpm.empty:
                    print(f"ALARM: High RPM Detected! Value: {high_rpm['RPM'].iloc[0]}")
                    # In real app, write to 'alarms' measurement in Influx or Postgre
        except Exception as e:
            print(f"Alarm Check Error: {e}")

engine = AnalyticsEngine()
