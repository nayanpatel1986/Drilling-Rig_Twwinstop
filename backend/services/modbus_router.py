from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from db_models import ModbusDevice, ModbusRegister, User
from auth.router import get_current_user
from pydantic import BaseModel
from typing import List, Optional
from services.modbus_control import modbus_writer

router = APIRouter(prefix="/modbus", tags=["Modbus Write Control"])

# ── Pydantic Models ───────────────────────────────────────

class WriteCoilRequest(BaseModel):
    device_id: int
    address: int
    value: bool

class WriteRegisterRequest(BaseModel):
    device_id: int
    address: int
    value: int

class WriteBulkRegistersRequest(BaseModel):
    device_id: int
    address: int
    values: List[int]

class WriteFloatRequest(BaseModel):
    device_id: int
    address: int
    value: float

# ── Helper for admin check ───────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required for PLC control")
    return current_user

# ── API Endpoints ──────────────────────────────────────────

@router.post("/write-coil")
async def write_coil(
    payload: WriteCoilRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    """Write a boolean (On/Off) value to a Modbus Coil (0x)."""
    device = db.query(ModbusDevice).filter(ModbusDevice.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Modbus Device not found")
    
    if not device.ip_address:
         raise HTTPException(status_code=400, detail="Device has no IP address configured")

    result = await modbus_writer.write_coil(
        device.ip_address, 
        device.port, 
        device.slave_id, 
        payload.address, 
        payload.value
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result

@router.post("/write-register")
async def write_register(
    payload: WriteRegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    """Write a single 16-bit integer (Set Point) to a Modbus Register (4x)."""
    device = db.query(ModbusDevice).filter(ModbusDevice.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Modbus Device not found")
    
    if not device.ip_address:
         raise HTTPException(status_code=400, detail="Device has no IP address configured")

    # Safety Limit Validation
    register_config = db.query(ModbusRegister).filter(
        ModbusRegister.device_id == payload.device_id,
        ModbusRegister.address == payload.address
    ).first()

    if register_config:
        if register_config.min_value is not None and payload.value < (register_config.min_value / register_config.scale):
             raise HTTPException(status_code=400, detail=f"Safety Violation: Value {payload.value} is below minimum allowed ({register_config.min_value} {register_config.unit})")
        if register_config.max_value is not None and payload.value > (register_config.max_value / register_config.scale):
             raise HTTPException(status_code=400, detail=f"Safety Violation: Value {payload.value} is above maximum allowed ({register_config.max_value} {register_config.unit})")

    result = await modbus_writer.write_register(
        device.ip_address, 
        device.port, 
        device.slave_id, 
        payload.address, 
        payload.value
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result

@router.post("/write-registers-bulk")
async def write_registers_bulk(
    payload: WriteBulkRegistersRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    """Write multiple 16-bit integers to Modbus Holding Registers (4x)."""
    device = db.query(ModbusDevice).filter(ModbusDevice.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Modbus Device not found")
    
    if not device.ip_address:
         raise HTTPException(status_code=400, detail="Device has no IP address configured")

    result = await modbus_writer.write_registers(
        device.ip_address, 
        device.port, 
        device.slave_id, 
        payload.address, 
        payload.values
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result

@router.post("/write-float")
async def write_float(
    payload: WriteFloatRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    """Write a 32-bit floating point value (REAL) to Modbus Holding Registers (4x)."""
    device = db.query(ModbusDevice).filter(ModbusDevice.id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Modbus Device not found")
    
    if not device.ip_address:
         raise HTTPException(status_code=400, detail="Device has no IP address configured")

    # Safety Limit Validation
    register_config = db.query(ModbusRegister).filter(
        ModbusRegister.device_id == payload.device_id,
        ModbusRegister.address == payload.address
    ).first()

    if register_config:
        if register_config.min_value is not None and payload.value < (register_config.min_value / register_config.scale):
             raise HTTPException(status_code=400, detail=f"Safety Violation: Value {payload.value} is below minimum allowed ({register_config.min_value} {register_config.unit})")
        if register_config.max_value is not None and payload.value > (register_config.max_value / register_config.scale):
             raise HTTPException(status_code=400, detail=f"Safety Violation: Value {payload.value} is above maximum allowed ({register_config.max_value} {register_config.unit})")

    result = await modbus_writer.write_float(
        device.ip_address, 
        device.port, 
        device.slave_id, 
        payload.address, 
        payload.value
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result
