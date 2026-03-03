import pandas as pd
import time
from typing import Optional
from requests import Session
from requests.auth import HTTPBasicAuth
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from witsml.parser import WitsmlParser
from witsml.simulator import WitsmlSimulator

# SOAP envelope template for WMLS_GetFromStore
# Using raw HTTP POST instead of Zeep to eliminate WSDL/schema overhead
SOAP_ENVELOPE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://www.witsml.org/wsdl/120">
  <soap:Body>
    <ns:WMLS_GetFromStore>
      <ns:WMLtypeIn>{wml_type}</ns:WMLtypeIn>
      <ns:QueryIn>{query_in}</ns:QueryIn>
      <ns:OptionsIn>{options_in}</ns:OptionsIn>
      <ns:CapabilitiesIn></ns:CapabilitiesIn>
    </ns:WMLS_GetFromStore>
  </soap:Body>
</soap:Envelope>"""

# Timeouts: (connect_timeout, read_timeout) in seconds
# - Connect: 3s to detect dead server fast
# - Read: 12s to allow server time for data response
TIMEOUT = (3, 12)


def _escape_xml(s):
    """Escape special XML characters in query strings."""
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


class WitsmlClient:
    """WITSML 1.x Client using direct HTTP POST for maximum speed."""
    
    def __init__(self, url: str, username: Optional[str] = None, password: Optional[str] = None, version: str = "1.4.1.1"):
        self.url = url
        self.username = username
        self.password = password
        self.version = version or "1.4.1.1"
        self.simulator = WitsmlSimulator()
        self._connected = False
        self._last_time_str = None
        
        # Persistent HTTP session with connection pooling (keep-alive)
        # Disable retries so we fail fast on dead servers
        self.session = Session()
        adapter = HTTPAdapter(max_retries=Retry(total=0))
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
        if self.username:
            self.session.auth = HTTPBasicAuth(self.username, self.password)
        self.session.headers.update({
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '"http://www.witsml.org/action/120/Store.WMLS_GetFromStore"',
        })
    
    @property
    def is_connected(self):
        """Check if the WITSML server is reachable."""
        return self._connected

    def _soap_call(self, wml_type, query_xml, options=""):
        """Execute a raw SOAP POST to the WITSML server. Returns (result_code, xml_out, supp_msg)."""
        escaped_query = _escape_xml(query_xml)
        body = SOAP_ENVELOPE.format(
            wml_type=wml_type,
            query_in=escaped_query,
            options_in=options,
        )
        
        t0 = time.time()
        resp = self.session.post(self.url, data=body.encode('utf-8'), timeout=TIMEOUT)
        elapsed = time.time() - t0
        
        resp.raise_for_status()
        
        # Parse the SOAP response with lxml (faster than ElementTree)
        from lxml import etree
        root = etree.fromstring(resp.content)
        
        # Extract the three return values from the SOAP body
        ns = {
            'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
            'ns': 'http://www.witsml.org/wsdl/120',
        }
        
        result_node = root.find('.//ns:WMLS_GetFromStoreResponse/ns:Result', ns)
        xml_out_node = root.find('.//ns:WMLS_GetFromStoreResponse/ns:XMLout', ns)
        supp_msg_node = root.find('.//ns:WMLS_GetFromStoreResponse/ns:SuppMsgOut', ns)
        
        result_code = int(result_node.text) if result_node is not None and result_node.text else 0
        xml_out = xml_out_node.text if xml_out_node is not None else ""
        supp_msg = supp_msg_node.text if supp_msg_node is not None else ""
        
        print(f"WITSML SOAP call completed in {elapsed:.1f}s (result={result_code})", flush=True)
        return result_code, xml_out, supp_msg
        
    def get_latest_log_data(self, well_uid: str, wellbore_uid: str, log_uid: str) -> pd.DataFrame:
        """Fetches the last data row from a WITSML log using direct HTTP POST."""
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
                
        print("Polling WITSML: {} Well:{} Log:{} Since:{}".format(
            self.url, well_uid, log_uid, self._last_time_str or "Start"), flush=True)
            
        # Build the WITSML query XML
        if self._last_time_str:
            query = '<logs xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><log uidWell="{}" uidWellbore="{}" uid="{}"><startDateTimeIndex>{}</startDateTimeIndex><logData><data/></logData></log></logs>'.format(
                well_uid, wellbore_uid, log_uid, self._last_time_str)
        else:
            query = '<logs xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><log uidWell="{}" uidWellbore="{}" uid="{}"><logData><data/></logData></log></logs>'.format(
                well_uid, wellbore_uid, log_uid)
        
        try:
            result_code, xml_out, supp_msg = self._soap_call('log', query, 'requestLatestValues=1')
            
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
            print("WITSML Exception: {}".format(e), flush=True)
            return pd.DataFrame()
