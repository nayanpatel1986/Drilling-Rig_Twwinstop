from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import os

class InfluxWrapper:
    def __init__(self):
        self.url = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
        self.token = os.getenv("INFLUXDB_TOKEN")
        self.org = os.getenv("INFLUXDB_ORG", "nov_rig")
        self.bucket = os.getenv("INFLUXDB_BUCKET", "rig_data")
        
        if not self.token:
            raise RuntimeError("INFLUXDB_TOKEN environment variable is mandatory.")
        
        self.client = InfluxDBClient(url=self.url, token=self.token, org=self.org)
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()

    def write_point(self, point):
        try:
            self.write_api.write(bucket=self.bucket, org=self.org, record=point)
        except Exception as e:
            print(f"InfluxDB Write Error: {e}")

    def write_dataframe(self, df, measurement_name, tag_columns=None):
        try:
            self.write_api.write(bucket=self.bucket, org=self.org, record=df, 
                               data_frame_measurement_name=measurement_name,
                               data_frame_tag_columns=tag_columns)
        except Exception as e:
            print(f"InfluxDB DataFrame Write Error: {e}")

    def query_latest(self, measurement="realtime_drilling"):
        """Get the latest values for all fields in a measurement."""
        try:
            # OPTIMIZED: Query only last 10 minutes instead of 24 hours
            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: -10m)
                |> filter(fn: (r) => r._measurement == "{measurement}")
                |> last()
            '''
            tables = self.query_api.query(query, org=self.org)
            result = {}
            
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            
            for table in tables:
                for record in table.records:
                    field = record.get_field()
                    value = record.get_value()
                    
                    # Per-field timeout check
                    rt_str = record.get_time().isoformat().replace("Z", "+00:00")
                    rt = datetime.fromisoformat(rt_str)
                    is_stale = (now - rt).total_seconds() > 10
                    
                    if is_stale and isinstance(value, (int, float)):
                        result[field] = 0.0
                    else:
                        result[field] = round(float(value), 2) if isinstance(value, (int, float)) else value
                        
                    if "_time" not in result:
                        result["_time"] = rt_str
            return result
        except Exception as e:
            print(f"InfluxDB Query Error: {e}")
            return {}

    # Keys to exclude from chart data output
    _SKIP_KEYS = {"result", "table", "_start", "_stop", "_measurement",
                  "device_name", "device_type", "host", "name",
                  "rig_id", "slave_id", "type"}

    def _merge_records(self, tables):
        """Parse query results, merge rows by timestamp, strip tag columns."""
        merged = {}
        for table in tables:
            for record in table.records:
                t = record.get_time().isoformat()
                if t not in merged:
                    merged[t] = {"time": t}
                row = merged[t]
                for key, val in record.values.items():
                    if key.startswith("_") or key in self._SKIP_KEYS:
                        continue
                    if isinstance(val, (int, float)):
                        row[key] = round(float(val), 2)
                    elif key != "_time":
                        row[key] = val
        return sorted(merged.values(), key=lambda r: r.get("time", ""))

    def query_range(self, range_str="-5m", measurement="realtime_drilling"):
        """Get time-series data for a given range."""
        try:
            # OPTIMIZATION: Downsample data for large ranges to avoid timeouts
            # -5m, -15m, -30m -> High resolution (no aggregation)
            # -1h, -6h       -> 10 second averages
            # -12h, -24h     -> 1 minute averages
            agg_window = ""
            if "-1h" in range_str or "-6h" in range_str:
                agg_window = '|> aggregateWindow(every: 10s, fn: mean, createEmpty: false)'
            elif "-12h" in range_str or "-24h" in range_str:
                agg_window = '|> aggregateWindow(every: 1m, fn: mean, createEmpty: false)'

            # For modbus data, drop tags before pivoting so coil and holding_register
            # fields merge into a single row per timestamp
            drop_tags = ""
            if measurement == "modbus":
                drop_tags = '|> drop(columns: ["device_name", "device_type", "host", "name", "rig_id", "slave_id", "type"])'

            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: {range_str})
                |> filter(fn: (r) => r._measurement == "{measurement}")
                {agg_window}
                {drop_tags}
                |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> sort(columns: ["_time"], desc: false)
            '''
            tables = self.query_api.query(query, org=self.org)
            return self._merge_records(tables)
        except Exception as e:
            print(f"InfluxDB Range Query Error: {e}")
            return []

    def query_custom_range(self, start_iso, stop_iso, measurement="realtime_drilling", fields=None):
        """Get time-series data between two absolute ISO timestamps."""
        try:
            field_filter = ""
            if fields:
                field_clauses = " or ".join([f'r._field == "{f}"' for f in fields])
                field_filter = f'|> filter(fn: (r) => {field_clauses})'

            drop_tags = ""
            if measurement == "modbus":
                drop_tags = '|> drop(columns: ["device_name", "device_type", "host", "name", "rig_id", "slave_id", "type"])'

            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: {start_iso}, stop: {stop_iso})
                |> filter(fn: (r) => r._measurement == "{measurement}")
                {field_filter}
                {drop_tags}
                |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> sort(columns: ["_time"], desc: false)
            '''
            tables = self.query_api.query(query, org=self.org)
            return self._merge_records(tables)
        except Exception as e:
            print(f"InfluxDB Custom Range Query Error: {e}")
            return []

    def query_sensors_latest(self, measurement="rig_sensors"):
        """Get the latest sensor readings from Telegraf (pivoted for easy access)."""
        try:
            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: -5m)
                |> filter(fn: (r) => r._measurement == "{measurement}")
                |> last()
            '''
            tables = self.query_api.query(query, org=self.org)
            result = {}
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            
            for table in tables:
                for record in table.records:
                    field = record.get_field()
                    value = record.get_value()
                    
                    rt_str = record.get_time().isoformat().replace("Z", "+00:00")
                    rt = datetime.fromisoformat(rt_str)
                    is_stale = (now - rt).total_seconds() > 10
                    
                    # Flatten into a single dictionary
                    if is_stale and isinstance(value, (int, float)):
                        result[field] = 0.0
                    else:
                        result[field] = round(float(value), 2) if isinstance(value, (int, float)) else value
                        
                    if "_time" not in result:
                        result["_time"] = rt_str
            return result
        except Exception as e:
            print(f"InfluxDB Sensors Query Error: {e}")
            return {}
