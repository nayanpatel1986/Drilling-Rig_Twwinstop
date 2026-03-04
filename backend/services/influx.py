from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import os

class InfluxWrapper:
    def __init__(self):
        self.url = os.getenv("INFLUX_URL", "http://influxdb:8086")
        self.token = os.getenv("INFLUX_TOKEN", "my-super-secret-auth-token")
        self.org = os.getenv("INFLUX_ORG", "nov_rig")
        self.bucket = os.getenv("INFLUX_BUCKET", "rig_data")
        
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
            # OPTIMIZED: Query only last 5 minutes instead of 24 hours
            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: -5m)
                |> filter(fn: (r) => r._measurement == "{measurement}")
                |> last()
            '''
            tables = self.query_api.query(query, org=self.org)
            result = {}
            for table in tables:
                for record in table.records:
                    field = record.get_field()
                    value = record.get_value()
                    result[field] = round(float(value), 2) if isinstance(value, (int, float)) else value
                    if "_time" not in result:
                        result["_time"] = record.get_time().isoformat()
            return result
        except Exception as e:
            print(f"InfluxDB Query Error: {e}")
            return {}

    def query_range(self, range_str="-5m", measurement="realtime_drilling"):
        """Get time-series data for a given range."""
        try:
            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: {range_str})
                |> filter(fn: (r) => r._measurement == "{measurement}")
                |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> sort(columns: ["_time"], desc: false)
            '''
            tables = self.query_api.query(query, org=self.org)
            rows = []
            for table in tables:
                for record in table.records:
                    row = {"time": record.get_time().isoformat()}
                    for key, val in record.values.items():
                        if key.startswith("_") and key not in ("_time",):
                            continue
                        if isinstance(val, (int, float)):
                            row[key] = round(float(val), 2)
                        elif key != "_time":
                            row[key] = val
                    rows.append(row)
            return rows
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

            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: {start_iso}, stop: {stop_iso})
                |> filter(fn: (r) => r._measurement == "{measurement}")
                {field_filter}
                |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> sort(columns: ["_time"], desc: false)
            '''
            tables = self.query_api.query(query, org=self.org)
            rows = []
            for table in tables:
                for record in table.records:
                    row = {"time": record.get_time().isoformat()}
                    for key, val in record.values.items():
                        if key.startswith("_") and key not in ("_time",):
                            continue
                        if isinstance(val, (int, float)):
                            row[key] = round(float(val), 2)
                        elif key != "_time":
                            row[key] = val
                    rows.append(row)
            return rows
        except Exception as e:
            print(f"InfluxDB Custom Range Query Error: {e}")
            return []

    def query_sensors_latest(self, measurement="rig_sensors"):
        """Get the latest sensor readings from Telegraf."""
        try:
            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: -1m)
                |> filter(fn: (r) => r._measurement == "{measurement}")
                |> last()
                |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
            '''
            tables = self.query_api.query(query, org=self.org)
            result = {}
            for table in tables:
                for record in table.records:
                    name = record.values.get("name", "unknown")
                    row = {}
                    for key, val in record.values.items():
                        if key.startswith("_") or key in ("result", "table", "name"):
                            continue
                        if isinstance(val, (int, float)):
                            row[key] = round(float(val), 2)
                    result[name] = row
            return result
        except Exception as e:
            print(f"InfluxDB Sensors Query Error: {e}")
            return {}
