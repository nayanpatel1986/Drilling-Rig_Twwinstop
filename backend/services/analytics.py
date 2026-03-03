import time
import threading
import pandas as pd
from datetime import datetime
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
        print("Analytics Engine Started...")
        while self.running:
            # 1. Fetch Data (Real or Simulated)
            df = pd.DataFrame()
            LIVE_MODE = os.getenv("LIVE_MODE", "false").lower() == "true"
            
            if LIVE_MODE:
                # Try to get active real-time config
                db = SessionLocal()
                custom_mappings = {}
                try:
                    config = db.query(WitsmlConfig).filter(WitsmlConfig.is_active == True).first()
                    if config and config.server_url:
                        # Eagerly load channel mappings while session is open
                        for mapping in config.channel_mappings:
                            custom_mappings[mapping.witsml_mnemonic.upper()] = mapping.app_parameter
                        # Reuse client if same config, else create new
                        config_changed = (
                            not self.witsml_client
                            or self.witsml_client.url != config.server_url
                            or self.witsml_client.username != config.username
                            or self.witsml_client.password != config.password
                        )
                        if config_changed:
                            self.witsml_client = WitsmlClient(config.server_url, config.username, config.password, config.witsml_version)
                            print(f"WITSML: Client (re)created for {config.server_url}", flush=True)
                        well_uid = config.well_uid
                        wellbore_uid = config.wellbore_uid
                        log_uid = config.log_uid
                except Exception as e:
                    print(f"WITSML Config Error: {e}")
                    well_uid = wellbore_uid = log_uid = None
                finally:
                    db.close()
                
                # Fetch data outside DB session
                if self.witsml_client and well_uid:
                    try:
                        df = self.witsml_client.get_latest_log_data(well_uid, wellbore_uid, log_uid)
                    except Exception as e:
                        print(f"WITSML Polling Error: {e}")
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
                        df['time'] = pd.to_datetime(df[time_col], errors='coerce')
                        
                        # If time is timezone naive, assume it is rig local time (+05:30)
                        # and convert to UTC by subtracting 5.5 hours so InfluxDB queries work correctly.
                        if df['time'].dt.tz is None:
                            df['time'] = df['time'] - pd.Timedelta(hours=5, minutes=30)
                            
                        df = df.dropna(subset=['time'])
                        df.set_index('time', inplace=True)
                        if time_col in df.columns:
                            df.drop(columns=[time_col], inplace=True)
                        
                        # Ensure numeric types are always float to avoid InfluxDB type conflicts
                        for col in df.columns:
                            numeric_col = pd.to_numeric(df[col], errors='coerce')
                            # If column has at least one valid number, or if it was entirely empty/null
                            if not numeric_col.isna().all() or df[col].replace(r'^\s*$', pd.NA, regex=True).isna().all():
                                df[col] = numeric_col.astype(float)

                        self.influx.write_dataframe(df, "realtime_drilling")
                        print(f"Processed WITSML Log: {len(df)} rows written to InfluxDB", flush=True)
                    except Exception as e:
                        print(f"InfluxDB Write Error: {e}", flush=True)
                else:
                    print(f"Pipeline: No time column found in {list(df.columns[:15])}. Skipping InfluxDB write.", flush=True)

            time.sleep(1) # 1s refresh rate for live data

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
