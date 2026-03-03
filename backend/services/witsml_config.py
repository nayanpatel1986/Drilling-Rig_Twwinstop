from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from db_models import WitsmlConfig, WitsmlChannelMapping
from auth.router import get_current_user
from db_models import User
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import requests
from requests.auth import HTTPBasicAuth

router = APIRouter(prefix="/witsml-config", tags=["witsml-config"])


# ── Default channel mappings (pre-populated for new configs) ───
DEFAULT_CHANNEL_MAPPINGS = [
    {"app_parameter": "BitDepth", "witsml_mnemonic": "BIT_DEPTH", "unit": "m", "description": "Bit Position"},
    {"app_parameter": "WOB", "witsml_mnemonic": "WOB", "unit": "ton", "description": "Bit Weight"},
    {"app_parameter": "BlockPosition", "witsml_mnemonic": "BLOCK_POS", "unit": "ft", "description": "Block Height"},
    {"app_parameter": "TonMile", "witsml_mnemonic": "TON_MILE", "unit": "ton miles", "description": "Cut and Slip"},
    {"app_parameter": "DiffPress", "witsml_mnemonic": "DIFF_PRESS", "unit": "psi", "description": "Diff Press"},
    {"app_parameter": "FlowRate", "witsml_mnemonic": "FLOW_IN", "unit": "gpm", "description": "Flow In Rate"},
    {"app_parameter": "FlowOutPercent", "witsml_mnemonic": "FLOW_OUT_REL", "unit": "%", "description": "Flow Out Percent"},
    {"app_parameter": "GainLoss", "witsml_mnemonic": "GAINLOSS", "unit": "m3", "description": "Gain Loss"},
    {"app_parameter": "H2SGas", "witsml_mnemonic": "GAS_H2S_MAX", "unit": "ppm", "description": "H2S Gas SS"},
    {"app_parameter": "Depth", "witsml_mnemonic": "TOT_DPT_MD", "unit": "m", "description": "Hole Depth"},
    {"app_parameter": "HookLoad", "witsml_mnemonic": "HOOKLOAD_MAX", "unit": "klb", "description": "Hook Load"},
    {"app_parameter": "TotalMudVolume", "witsml_mnemonic": "TOTAL_VOL", "unit": "m3", "description": "Mud Volume"},
    {"app_parameter": "PitVolume1", "witsml_mnemonic": "TANK1_VOL", "unit": "m3", "description": "Pit Volume 1"},
    {"app_parameter": "PitVolume2", "witsml_mnemonic": "TANK2_VOL", "unit": "m3", "description": "Pit Volume 2"},
    {"app_parameter": "PitVolume3", "witsml_mnemonic": "TANK3_VOL", "unit": "m3", "description": "Pit Volume 3"},
    {"app_parameter": "PitVolume4", "witsml_mnemonic": "TANK4_VOL", "unit": "m3", "description": "Pit Volume 4"},
    {"app_parameter": "StandpipePressure", "witsml_mnemonic": "PUMP_PRESSURE", "unit": "psi", "description": "Pump Pressure"},
    {"app_parameter": "SPM1", "witsml_mnemonic": "MP1_SPM", "unit": "spm", "description": "Pump SPM 1"},
    {"app_parameter": "SPM2", "witsml_mnemonic": "MP2_SPM", "unit": "spm", "description": "Pump SPM 2"},
    {"app_parameter": "SPM3", "witsml_mnemonic": "MP3_SPM", "unit": "spm", "description": "Pump SPM 3"},
    {"app_parameter": "TotalSPM", "witsml_mnemonic": "TOT_SPM", "unit": "spm", "description": "Pump SPM - Total"},
    {"app_parameter": "RigActivity", "witsml_mnemonic": "RIG_ACTIVITY", "unit": "-", "description": "Rig Activity"},
    {"app_parameter": "ROP", "witsml_mnemonic": "AVG_ROP_FT_HR", "unit": "ft/hr", "description": "ROP - Average"},
    {"app_parameter": "RPM", "witsml_mnemonic": "ROT_SPEED", "unit": "rpm", "description": "Rotary RPM"},
    {"app_parameter": "Torque", "witsml_mnemonic": "ROT_TORQUE", "unit": "ft-lb", "description": "Rotary Torque"},
    {"app_parameter": "SlipStatus", "witsml_mnemonic": "SLIP_STAT", "unit": "status", "description": "Slip Status"},
    {"app_parameter": "StringSpeed", "witsml_mnemonic": "STRING_SPEED", "unit": "ft/min", "description": "String Speed"},
    {"app_parameter": "TotalStrokes", "witsml_mnemonic": "TOT_STK", "unit": "strokes", "description": "Strks - Total"},
    {"app_parameter": "TopDriveRPM", "witsml_mnemonic": "TD_SPEED", "unit": "rpm", "description": "Top Drive RPM"},
    {"app_parameter": "TopDriveTorque", "witsml_mnemonic": "TD_TORQUE", "unit": "ft-lb", "description": "Top Drive Torque"},
    {"app_parameter": "TripTank1", "witsml_mnemonic": "TT1_VOL", "unit": "bbl", "description": "Trip Tank 1"},
    {"app_parameter": "TripTank2", "witsml_mnemonic": "TT2_VOL", "unit": "bbl", "description": "Trip Tank 2"},
    {"app_parameter": "TripTankGL", "witsml_mnemonic": "TRIP_TANK_GL", "unit": "bbl", "description": "Trip Tank GL"},
]


# ── Pydantic Models ────────────────────────────────────────

class ChannelMappingCreate(BaseModel):
    app_parameter: str
    witsml_mnemonic: str
    unit: Optional[str] = None
    scale_factor: float = 1.0
    offset: float = 0.0
    description: Optional[str] = None

class WitsmlTestRequest(BaseModel):
    server_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    witsml_version: str = "1.4.1.1"


class ChannelMappingResponse(BaseModel):
    id: int
    config_id: int
    app_parameter: str
    witsml_mnemonic: str
    unit: Optional[str] = None
    scale_factor: float = 1.0
    offset: float = 0.0
    description: Optional[str] = None

    class Config:
        orm_mode = True


class WitsmlConfigCreate(BaseModel):
    name: str
    # Server Connection
    server_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    witsml_version: str = "1.4.1.1"
    # Well Information
    well_uid: Optional[str] = None
    wellbore_uid: Optional[str] = None
    log_uid: Optional[str] = None
    well_name: Optional[str] = None
    well_number: Optional[str] = None
    api_number: Optional[str] = None
    operator_name: Optional[str] = None
    field_name: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    surface_latitude: Optional[float] = None
    surface_longitude: Optional[float] = None
    # Rig Information
    rig_name: Optional[str] = None
    rig_type: Optional[str] = None
    contractor: Optional[str] = None
    # Drilling Parameters
    kb_elevation: Optional[float] = None
    ground_elevation: Optional[float] = None
    water_depth: Optional[float] = None
    planned_total_depth: Optional[float] = None
    current_depth: Optional[float] = None
    bit_size: Optional[float] = None
    casing_od: Optional[str] = None
    casing_depth: Optional[float] = None
    max_rop: Optional[float] = None
    max_wob: Optional[float] = None
    max_rpm: Optional[float] = None
    max_torque: Optional[float] = None
    max_spp: Optional[float] = None
    max_flow_rate: Optional[float] = None
    max_hook_load: Optional[float] = None
    # Mud / Fluid
    mud_type: Optional[str] = None
    mud_weight: Optional[float] = None
    mud_viscosity: Optional[float] = None
    flow_rate_in: Optional[float] = None
    # Service Company
    service_company: Optional[str] = None
    engineer_name: Optional[str] = None
    data_interval_time: Optional[float] = None
    data_interval_depth: Optional[float] = None


class WitsmlConfigUpdate(WitsmlConfigCreate):
    name: Optional[str] = None


class WitsmlConfigResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: Optional[datetime] = None
    # Server Connection
    server_url: Optional[str] = None
    username: Optional[str] = None
    witsml_version: Optional[str] = None
    # Well Information
    well_uid: Optional[str] = None
    wellbore_uid: Optional[str] = None
    log_uid: Optional[str] = None
    well_name: Optional[str] = None
    well_number: Optional[str] = None
    api_number: Optional[str] = None
    operator_name: Optional[str] = None
    field_name: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    surface_latitude: Optional[float] = None
    surface_longitude: Optional[float] = None
    # Rig Information
    rig_name: Optional[str] = None
    rig_type: Optional[str] = None
    contractor: Optional[str] = None
    # Drilling Parameters
    kb_elevation: Optional[float] = None
    ground_elevation: Optional[float] = None
    water_depth: Optional[float] = None
    planned_total_depth: Optional[float] = None
    current_depth: Optional[float] = None
    bit_size: Optional[float] = None
    casing_od: Optional[str] = None
    casing_depth: Optional[float] = None
    max_rop: Optional[float] = None
    max_wob: Optional[float] = None
    max_rpm: Optional[float] = None
    max_torque: Optional[float] = None
    max_spp: Optional[float] = None
    max_flow_rate: Optional[float] = None
    max_hook_load: Optional[float] = None
    # Mud / Fluid
    mud_type: Optional[str] = None
    mud_weight: Optional[float] = None
    mud_viscosity: Optional[float] = None
    flow_rate_in: Optional[float] = None
    # Service Company
    service_company: Optional[str] = None
    engineer_name: Optional[str] = None
    data_interval_time: Optional[float] = None
    data_interval_depth: Optional[float] = None
    # Channel mappings
    channel_mappings: List[ChannelMappingResponse] = []

    class Config:
        orm_mode = True


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Config CRUD ────────────────────────────────────────────

@router.get("/", response_model=list[WitsmlConfigResponse])
def list_configs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(WitsmlConfig).order_by(WitsmlConfig.created_at.desc()).all()


@router.get("/active", response_model=Optional[WitsmlConfigResponse])
def get_active_config(db: Session = Depends(get_db)):
    config = db.query(WitsmlConfig).filter(WitsmlConfig.is_active == True).first()
    if not config:
        return None
    return config


@router.post("/test")
def test_connection(
    req: WitsmlTestRequest,
    _: User = Depends(require_admin),
):
    if not req.server_url:
        raise HTTPException(status_code=400, detail="Server URL is required")

    # 1. Check for ETP (WebSockets) which is NOT supported yet
    if req.server_url.startswith("ws://") or req.server_url.startswith("wss://"):
        return {
            "status": "error", 
            "message": "ETP 2.0 (WebSocket) is not supported.", 
            "details": "This application currently only supports WITSML 1.x SOAP. Please use a WITSML endpoint like: http://10.10.10.100/WitsmlService/WitsmlService.asmx"
        }

    # 2. Try Zeep-based WSDL test (same method used by the actual data pipeline)
    try:
        from zeep import Client as ZeepClient
        from zeep.transports import Transport
        from requests import Session as ReqSession
        from requests.auth import HTTPBasicAuth as ReqBasicAuth

        session = ReqSession()
        if req.username:
            session.auth = ReqBasicAuth(req.username, req.password)
        
        wsdl_url = req.server_url + '?WSDL'
        transport = Transport(session=session, timeout=8)
        
        try:
            client = ZeepClient(wsdl_url, transport=transport)
        except Exception as e:
            err_str = str(e)
            if "401" in err_str or "Unauthorized" in err_str:
                return {"status": "error", "message": "Authentication failed (HTTP 401).", "details": f"Check username/password. Tip: Try 'DOMAIN\\\\username' format. Error: {err_str[:200]}"}
            if "timeout" in err_str.lower() or "timed out" in err_str.lower():
                return {"status": "error", "message": "Connection timed out.", "details": "The server did not respond within 8 seconds. Verify the IP address and that the WITSML service is running."}
            if "Connection refused" in err_str or "No route" in err_str or "unreachable" in err_str.lower():
                return {"status": "error", "message": "No response from server.", "details": "Please check if the URL is correct and the server is reachable. Ensure this machine is connected to the rig network (Ethernet cable required for 10.x.x.x addresses)."}
            return {"status": "error", "message": "Failed to load WSDL.", "details": err_str[:300]}
        
        # WSDL loaded — try calling WMLS_GetVersion
        try:
            version_result = client.service.WMLS_GetVersion()
            version_str = str(version_result) if version_result else "Unknown"
            return {
                "status": "success", 
                "message": f"Connected successfully! Server version: {version_str}", 
                "details": f"WSDL loaded from {wsdl_url}. WMLS_GetVersion returned: {version_str}"
            }
        except Exception as e:
            # WSDL worked but GetVersion failed — still a partial success
            return {
                "status": "success", 
                "message": "Connected to server (WSDL loaded).", 
                "details": f"WSDL loaded successfully but WMLS_GetVersion call failed: {str(e)[:200]}. The server is reachable."
            }

    except ImportError:
        # Zeep not available — fall back to raw SOAP
        pass
    except Exception as e:
        return {"status": "error", "message": "Connection test failed.", "details": str(e)[:300]}


# ── Browse Endpoints (Well / Wellbore / Log Discovery) ─────

class WitsmlBrowseRequest(BaseModel):
    server_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    well_uid: Optional[str] = None
    wellbore_uid: Optional[str] = None


def _get_zeep_client_for_browse(req):
    """Create a temporary Zeep client for browsing."""
    from zeep import Client as ZeepClient
    from zeep.transports import Transport
    from requests import Session as ReqSession
    from requests.auth import HTTPBasicAuth as ReqBasicAuth

    session = ReqSession()
    if req.username:
        session.auth = ReqBasicAuth(req.username, req.password)
    wsdl_url = req.server_url + '?WSDL'
    transport = Transport(session=session, timeout=10)
    return ZeepClient(wsdl_url, transport=transport)


@router.post("/browse/wells")
def browse_wells(
    req: WitsmlBrowseRequest,
    _: User = Depends(get_current_user),
):
    """Query the WITSML server for all available wells."""
    try:
        client = _get_zeep_client_for_browse(req)
        query = '<wells xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><well uid=""><name/></well></wells>'
        result = client.service.WMLS_GetFromStore(
            WMLtypeIn='well', QueryIn=query,
            OptionsIn='returnElements=id-only', CapabilitiesIn=''
        )
        wells = []
        if result.XMLout:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(result.XMLout)
            ns = {'w': 'http://www.witsml.org/schemas/131'}
            for well in root.findall('.//w:well', ns):
                uid = well.get('uid', '')
                name_el = well.find('w:name', ns)
                name = name_el.text if name_el is not None and name_el.text else uid
                wells.append({"uid": uid, "name": name})
        return {"status": "success", "wells": wells}
    except Exception as e:
        return {"status": "error", "message": str(e)[:300], "wells": []}


@router.post("/browse/wellbores")
def browse_wellbores(
    req: WitsmlBrowseRequest,
    _: User = Depends(get_current_user),
):
    """Query wellbores for a given well UID."""
    if not req.well_uid:
        return {"status": "error", "message": "well_uid is required", "wellbores": []}
    try:
        client = _get_zeep_client_for_browse(req)
        query = f'<wellbores xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><wellbore uidWell="{req.well_uid}" uid=""><name/></wellbore></wellbores>'
        result = client.service.WMLS_GetFromStore(
            WMLtypeIn='wellbore', QueryIn=query,
            OptionsIn='returnElements=id-only', CapabilitiesIn=''
        )
        wellbores = []
        if result.XMLout:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(result.XMLout)
            ns = {'w': 'http://www.witsml.org/schemas/131'}
            for wb in root.findall('.//w:wellbore', ns):
                uid = wb.get('uid', '')
                name_el = wb.find('w:name', ns)
                name = name_el.text if name_el is not None and name_el.text else uid
                wellbores.append({"uid": uid, "name": name})
        return {"status": "success", "wellbores": wellbores}
    except Exception as e:
        return {"status": "error", "message": str(e)[:300], "wellbores": []}


@router.post("/browse/logs")
def browse_logs(
    req: WitsmlBrowseRequest,
    _: User = Depends(get_current_user),
):
    """Query logs for a given well + wellbore UID."""
    if not req.well_uid or not req.wellbore_uid:
        return {"status": "error", "message": "well_uid and wellbore_uid are required", "logs": []}
    try:
        client = _get_zeep_client_for_browse(req)
        query = f'<logs xmlns="http://www.witsml.org/schemas/131" version="1.3.1"><log uidWell="{req.well_uid}" uidWellbore="{req.wellbore_uid}" uid=""><name/></log></logs>'
        result = client.service.WMLS_GetFromStore(
            WMLtypeIn='log', QueryIn=query,
            OptionsIn='returnElements=id-only', CapabilitiesIn=''
        )
        logs = []
        if result.XMLout:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(result.XMLout)
            ns = {'w': 'http://www.witsml.org/schemas/131'}
            for log in root.findall('.//w:log', ns):
                uid = log.get('uid', '')
                name_el = log.find('w:name', ns)
                name = name_el.text if name_el is not None and name_el.text else uid
                logs.append({"uid": uid, "name": name})
        return {"status": "success", "logs": logs}
    except Exception as e:
        return {"status": "error", "message": str(e)[:300], "logs": []}


@router.post("/", response_model=WitsmlConfigResponse)
def create_config(
    config_data: WitsmlConfigCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    data_dict = config_data.dict()
    new_config = WitsmlConfig(**data_dict, is_active=False)
    db.add(new_config)
    db.flush()  # Get ID before adding mappings

    # Pre-populate default channel mappings
    for mapping in DEFAULT_CHANNEL_MAPPINGS:
        db.add(WitsmlChannelMapping(config_id=new_config.id, **mapping))

    db.commit()
    db.refresh(new_config)
    return new_config


@router.put("/{config_id}", response_model=WitsmlConfigResponse)
def update_config(
    config_id: int,
    config_data: WitsmlConfigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    config = db.query(WitsmlConfig).filter(WitsmlConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    update_fields = config_data.dict(exclude_unset=True)
    for key, value in update_fields.items():
        setattr(config, key, value)

    db.commit()
    db.refresh(config)
    return config


@router.put("/{config_id}/activate", response_model=WitsmlConfigResponse)
def activate_config(
    config_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    config = db.query(WitsmlConfig).filter(WitsmlConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    db.query(WitsmlConfig).update({WitsmlConfig.is_active: False})
    config.is_active = True
    db.commit()
    db.refresh(config)
    return config


@router.delete("/{config_id}")
def delete_config(
    config_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    config = db.query(WitsmlConfig).filter(WitsmlConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    db.delete(config)
    db.commit()
    return {"detail": "Config deleted"}


# ── Channel Mapping CRUD ───────────────────────────────────

@router.get("/{config_id}/mappings", response_model=List[ChannelMappingResponse])
def list_mappings(config_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(WitsmlChannelMapping).filter(WitsmlChannelMapping.config_id == config_id).all()


@router.post("/{config_id}/mappings", response_model=ChannelMappingResponse)
def create_mapping(
    config_id: int,
    mapping_data: ChannelMappingCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    config = db.query(WitsmlConfig).filter(WitsmlConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    new_mapping = WitsmlChannelMapping(config_id=config_id, **mapping_data.dict())
    db.add(new_mapping)
    db.commit()
    db.refresh(new_mapping)
    return new_mapping


@router.put("/mappings/{mapping_id}", response_model=ChannelMappingResponse)
def update_mapping(
    mapping_id: int,
    mapping_data: ChannelMappingCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    mapping = db.query(WitsmlChannelMapping).filter(WitsmlChannelMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    for key, value in mapping_data.dict().items():
        setattr(mapping, key, value)

    db.commit()
    db.refresh(mapping)
    return mapping


@router.delete("/mappings/{mapping_id}")
def delete_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    mapping = db.query(WitsmlChannelMapping).filter(WitsmlChannelMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    db.delete(mapping)
    db.commit()
    return {"detail": "Mapping deleted"}


@router.put("/{config_id}/mappings/bulk", response_model=List[ChannelMappingResponse])
def bulk_update_mappings(
    config_id: int,
    mappings: List[ChannelMappingCreate],
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Replace all channel mappings for a config with the provided list."""
    config = db.query(WitsmlConfig).filter(WitsmlConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    # Delete existing
    db.query(WitsmlChannelMapping).filter(WitsmlChannelMapping.config_id == config_id).delete()

    # Add new
    new_mappings = []
    for m in mappings:
        mapping = WitsmlChannelMapping(config_id=config_id, **m.dict())
        db.add(mapping)
        new_mappings.append(mapping)

    db.commit()
    for m in new_mappings:
        db.refresh(m)
    return new_mappings
