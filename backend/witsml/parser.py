import xmltodict
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime

class WitsmlParser:
    """Parses WITSML 1.3.1.1 / 1.4.1.1 XML strings into usable Python objects."""

    @staticmethod
    def parse_log(xml_content: str) -> pd.DataFrame:
        """
        Parses a WITSML log object and returns a DataFrame of the log data.
        Assumes 'logCurveInfo' defines columns and 'logData' contains the data rows.
        """
        try:
            data_dict = xmltodict.parse(xml_content)
            logs = data_dict.get('logs', {}).get('log', [])
            if isinstance(logs, dict):
                logs = [logs] # Handle single log case
            
            all_data = []

            for log in logs:
                # Extract menmonics
                curve_infos = log.get('logCurveInfo', [])
                if isinstance(curve_infos, dict):
                    curve_infos = [curve_infos]
                
                mnemonics = [c['mnemonic'] for c in curve_infos]
                
                # Extract data
                log_data = log.get('logData', {}).get('data', [])
                if isinstance(log_data, str):
                    log_data = [log_data] # Single data point
                
                for row in log_data:
                    # WITSML 1.4.1.1 usually comma separated
                    values = row.split(',')
                    row_dict = {k: v for k, v in zip(mnemonics, values)}
                    all_data.append(row_dict)

            df = pd.DataFrame(all_data)
            return df
        except Exception as e:
            print(f"Error parsing WITSML Log: {e}")
            return pd.DataFrame()

    @staticmethod
    def parse_trajectory(xml_content: str) -> List[Dict]:
        """Parses a WITSML trajectory object."""
        try:
            data_dict = xmltodict.parse(xml_content)
            trajs = data_dict.get('trajectorys', {}).get('trajectory', [])
            if isinstance(trajs, dict):
                trajs = [trajs]
            
            results = []
            for traj in trajs:
                stations = traj.get('trajectoryStation', [])
                if isinstance(stations, dict):
                    stations = [stations]
                
                for stn in stations:
                    results.append({
                        'md': float(stn.get('md', {}).get('#text', 0)),
                        'tvd': float(stn.get('tvd', {}).get('#text', 0)),
                        'incl': float(stn.get('incl', {}).get('#text', 0)),
                        'azi': float(stn.get('azi', {}).get('#text', 0)),
                    })
            return results
        except Exception as e:
            print(f"Error parsing WITSML Trajectory: {e}")
            return []
