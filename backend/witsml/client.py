import pandas as pd
import time
from typing import Optional
from requests import Session as ReqSession
from requests.auth import HTTPBasicAuth
from witsml.parser import WitsmlParser
from witsml.simulator import WitsmlSimulator


class WitsmlClient:
    """WITSML 1.x Client using Zeep (WSDL) for server compatibility."""
    
    def __init__(self, url: str, username: Optional[str] = None, password: Optional[str] = None, version: str = "1.4.1.1"):
        self.url = url
        self.username = username
        self.password = password
        self.version = version or "1.4.1.1"
        self.simulator = WitsmlSimulator()
        self._connected = False
        self._last_time_str = None
        self._zeep_client = None
    
    def _get_zeep_client(self):
        """Create or return a cached Zeep SOAP client."""
        if self._zeep_client is None:
            from zeep import Client as ZeepClient
            from zeep.transports import Transport

            session = ReqSession()
            if self.username:
                session.auth = HTTPBasicAuth(self.username, self.password)
            wsdl_url = self.url + '?WSDL'
            transport = Transport(session=session, timeout=12)
            self._zeep_client = ZeepClient(wsdl_url, transport=transport)
            print(f"WITSML: Zeep client created for {self.url}", flush=True)
        return self._zeep_client
    
    @property
    def is_connected(self):
        """Check if the WITSML server is reachable."""
        return self._connected

    def _soap_call(self, wml_type, query_xml, options=""):
        """Execute WMLS_GetFromStore via Zeep. Returns (result_code, xml_out, supp_msg)."""
        t0 = time.time()
        client = self._get_zeep_client()
        result = client.service.WMLS_GetFromStore(
            WMLtypeIn=wml_type,
            QueryIn=query_xml,
            OptionsIn=options,
            CapabilitiesIn='',
        )
        elapsed = time.time() - t0

        # Zeep response structure varies by server — handle multiple formats
        result_code = 0
        xml_out = ""
        supp_msg = ""
        
        try:
            # Debug: log the response type and available attributes
            print(f"WITSML Zeep response type: {type(result).__name__}", flush=True)
            
            if hasattr(result, 'Result'):
                result_code = int(result.Result) if result.Result is not None else 0
                xml_out = result.XMLout or ""
                supp_msg = result.SuppMsgOut or ""
            elif hasattr(result, 'result'):
                result_code = int(result.result) if result.result is not None else 0
                xml_out = getattr(result, 'xmlOut', '') or getattr(result, 'XMLout', '') or ""
                supp_msg = getattr(result, 'suppMsgOut', '') or getattr(result, 'SuppMsgOut', '') or ""
            elif isinstance(result, (list, tuple)):
                # Some servers return a tuple/list: (result_code, xml_out, supp_msg)
                result_code = int(result[0]) if result[0] is not None else 0
                xml_out = str(result[1]) if len(result) > 1 and result[1] else ""
                supp_msg = str(result[2]) if len(result) > 2 and result[2] else ""
            elif isinstance(result, dict):
                result_code = int(result.get('Result', result.get('result', 0)))
                xml_out = result.get('XMLout', result.get('xmlOut', '')) or ""
                supp_msg = result.get('SuppMsgOut', result.get('suppMsgOut', '')) or ""
            else:
                # Last resort: try to discover attributes
                attrs = [a for a in dir(result) if not a.startswith('_')]
                print(f"WITSML Zeep response attrs: {attrs}", flush=True)
                for attr in attrs:
                    val = getattr(result, attr, None)
                    attr_lower = attr.lower()
                    if 'result' == attr_lower and not callable(val):
                        result_code = int(val) if val is not None else 0
                    elif 'xmlout' == attr_lower and not callable(val):
                        xml_out = str(val) if val else ""
                    elif 'suppmsgout' == attr_lower and not callable(val):
                        supp_msg = str(val) if val else ""
        except Exception as parse_err:
            print(f"WITSML: Error parsing Zeep response: {parse_err}. Raw result: {result}", flush=True)

        print(f"WITSML Zeep call completed in {elapsed:.1f}s (result={result_code}, xml_len={len(xml_out)})", flush=True)
        return result_code, xml_out, supp_msg
        
    def get_latest_log_data(self, well_uid: str, wellbore_uid: str, log_uid: str, mnemonics: list = None) -> pd.DataFrame:
        """Fetches the last data row from a WITSML log."""
        if not self.url:
            return pd.DataFrame()
        
        # Determine if we should only query for new data
        if self._last_time_str is None:
            print(f"WITSML: First poll. Fetching log header to jump to live edge...", flush=True)
            header_query = '<logs xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><log uidWell="{}" uidWellbore="{}" uid="{}"><endDateTimeIndex/></log></logs>'.format(
                well_uid, wellbore_uid, log_uid)
            try:
                _, h_xml, _ = self._soap_call('log', header_query, 'returnElements=header-only')
                if h_xml:
                    import xml.etree.ElementTree as ET
                    root = ET.fromstring(h_xml)
                    ns = {'w': 'http://www.witsml.org/schemas/131'}
                    end_node = root.find('.//w:endDateTimeIndex', ns)
                    if end_node is not None and end_node.text:
                        end_str = end_node.text
                        print(f"WITSML: Found log end time: {end_str}. Adjusting start time...", flush=True)
                        t = pd.to_datetime(end_str)
                        start_t = t - pd.Timedelta(minutes=5)
                        if start_t.tzinfo is not None:
                            start_t = start_t.tz_localize(None)
                        # NOV server timezone offset fix (CST→IST = +11.5h)
                        query_time = start_t + pd.Timedelta(hours=11, minutes=30)
                        self._last_time_str = query_time.strftime('%Y-%m-%dT%H:%M:%SZ')
                    else:
                        self._last_time_str = None
            except Exception as e:
                print(f"WITSML: Failed to get header end time: {e}", flush=True)
                self._last_time_str = None
                
        print("Polling WITSML: {} Well:{} Wellbore:{} Log:{} Since:{}".format(
            self.url, well_uid, wellbore_uid, log_uid, self._last_time_str or "Start"), flush=True)
            
        # Build the WITSML query XML
        curve_info_xml = ""
        if mnemonics:
            # We always want RIGTIME or DATE/TIME to correlate data, though WITSML usually returns it as the index curve anyway
            if 'RIGTIME' not in [m.upper() for m in mnemonics]:
                curve_info_xml += '<logCurveInfo><mnemonic>RIGTIME</mnemonic></logCurveInfo>'
            for m in mnemonics:
                curve_info_xml += f'<logCurveInfo><mnemonic>{m}</mnemonic></logCurveInfo>'
                
        if self._last_time_str:
            query = '<logs xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><log uidWell="{}" uidWellbore="{}" uid="{}"><startDateTimeIndex>{}</startDateTimeIndex>{}<logData><data/></logData></log></logs>'.format(
                well_uid, wellbore_uid, log_uid, self._last_time_str, curve_info_xml)
        else:
            query = '<logs xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><log uidWell="{}" uidWellbore="{}" uid="{}">{}<logData><data/></logData></log></logs>'.format(
                well_uid, wellbore_uid, log_uid, curve_info_xml)
        
        try:
            # requestLatestValues is extremely slow on NOV servers (> 200 seconds).
            # If we know the start time, just request everything after it.
            # returnElements=data-only speeds up the server processing by ~40%
            options = 'returnElements=data-only' if self._last_time_str else 'requestLatestValues=1'
            result_code, xml_out, supp_msg = self._soap_call('log', query, options)
            
            self._connected = True
            
            if result_code is not None and result_code < 0:
                if result_code == -299:
                    print("WITSML: Error -299 (No new data available).", flush=True)
                    return pd.DataFrame()
                print("WITSML: Error {}: {}".format(result_code, supp_msg), flush=True)
                return pd.DataFrame()
            
            if xml_out and len(xml_out.strip()) > 0:
                df = WitsmlParser.parse_log(xml_out)
                if df is not None and not df.empty:
                    # Find time column and save the latest time for next query
                    time_cols = [c for c in df.columns if 'TIME' in c.upper()]
                    if time_cols:
                        tc = time_cols[0]
                        try:
                            max_time = pd.to_datetime(df[tc]).max()
                            print(f"[DEBUG_TIME] df[tc] first val: {df[tc].iloc[0]} max_time: {max_time} tzinfo: {max_time.tzinfo}", flush=True)
                            if pd.notna(max_time):
                                if max_time.tzinfo is not None:
                                    max_time = max_time.tz_localize(None)
                                query_time = max_time + pd.Timedelta(hours=11, minutes=30)
                                self._last_time_str = query_time.strftime('%Y-%m-%dT%H:%M:%SZ')
                        except Exception as e:
                            print(f"WITSML: Failed to parse max time: {e}", flush=True)
                            
                    print("WITSML: SUCCESS - {} rows".format(len(df)), flush=True)
                    return df
                else:
                    print("WITSML: XMLout received but no logData rows parsed.", flush=True)
                    return pd.DataFrame()
            else:
                print("WITSML: Empty XMLout (result={}). Check UIDs.".format(result_code), flush=True)
                return pd.DataFrame()
                
        except Exception as e:
            self._connected = False
            self._zeep_client = None  # Reset client so it reconnects next time
            print("WITSML Exception: {}".format(e), flush=True)
            return pd.DataFrame()
