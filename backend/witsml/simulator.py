import time
import random
import os
from datetime import datetime

class WitsmlSimulator:
    """Generates synthetic WITSML Log XML files for testing."""
    
    def __init__(self, output_dir="witsml_data"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        self.current_depth = 1000.0

    def generate_log_step(self):
        """Generates a single WITSML log step."""
        self.current_depth += 0.5
        timestamp = datetime.utcnow().isoformat()
        
        # Simulate Data
        hkld = 200 + random.uniform(-5, 5)
        wob = 15 + random.uniform(-2, 2)
        rop = 40 + random.uniform(-10, 10)
        rpm = 120 + random.uniform(-5, 5)
        spp = 3000 + random.uniform(-50, 50)
        
        xml = f"""
        <logs xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1">
            <log>
                <name>RealTime_Drilling</name>
                <logCurveInfo><mnemonic>TIME</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>DEPT</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>HKLD</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>WOB</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>ROP</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>RPM</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>PP2_RPM</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>PP3_RPM</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>PP4_RPM</mnemonic></logCurveInfo>
                <logCurveInfo><mnemonic>SPP</mnemonic></logCurveInfo>
                
                <logData>
                    <data>{timestamp},{self.current_depth:.2f},{hkld:.2f},{wob:.2f},{rop:.2f},{rpm:.2f},{rpm*0.98:.2f},{rpm*0.96:.2f},{rpm*1.01:.2f},{spp:.2f}</data>
                </logData>
            </log>
        </logs>
        """
        
        filename = f"{self.output_dir}/log_{int(time.time())}.xml"
        with open(filename, "w") as f:
            f.write(xml)
        return filename
