from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from db_models import ModbusDevice, ModbusRegister, User
from auth.router import get_current_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from services.telegraf_sync import sync_telegraf_config

router = APIRouter(prefix="/modbus-config", tags=["modbus-config"])


# ── Default registers per device type ──────────────────────
DEFAULT_REGISTERS = {
    "engine": [
        {"field_name": "RPM", "register_type": "holding", "address": 0, "data_type": "FLOAT32", "scale": 1.0, "unit": "rpm"},
        {"field_name": "OilPressure", "register_type": "holding", "address": 2, "data_type": "FLOAT32", "scale": 1.0, "unit": "psi"},
        {"field_name": "OilTemperature", "register_type": "holding", "address": 4, "data_type": "FLOAT32", "scale": 1.0, "unit": "°C"},
        {"field_name": "CoolantTemp", "register_type": "holding", "address": 6, "data_type": "FLOAT32", "scale": 1.0, "unit": "°C"},
        {"field_name": "ExhaustTemp", "register_type": "holding", "address": 8, "data_type": "FLOAT32", "scale": 1.0, "unit": "°C"},
        {"field_name": "FuelRate", "register_type": "holding", "address": 10, "data_type": "FLOAT32", "scale": 1.0, "unit": "L/hr"},
        {"field_name": "RunHours", "register_type": "holding", "address": 12, "data_type": "FLOAT32", "scale": 1.0, "unit": "hrs"},
        {"field_name": "LoadPercent", "register_type": "holding", "address": 14, "data_type": "FLOAT32", "scale": 1.0, "unit": "%"},
        {"field_name": "InstFuelCons", "register_type": "holding", "address": 255, "data_type": "UINT16", "scale": 0.05, "unit": "L/hr"},
        {"field_name": "TotalFuelCons", "register_type": "holding", "address": 891, "data_type": "UINT32", "scale": 1.0, "unit": "L"},
        {"field_name": "OverallPowerFactor", "register_type": "holding", "address": 102, "data_type": "UINT16", "scale": 1.0, "unit": ""},
        {"field_name": "TotalReactivePower", "register_type": "holding", "address": 140, "data_type": "UINT32", "scale": 1.0, "unit": "kVAR"},
        {"field_name": "TotalPercentKW", "register_type": "holding", "address": 104, "data_type": "UINT16", "scale": 1.0, "unit": "%"},
    ],
    "mudpump": [
        {"field_name": "SPM", "register_type": "holding", "address": 0, "data_type": "FLOAT32", "scale": 1.0, "unit": "spm"},
        {"field_name": "DischargePressure", "register_type": "holding", "address": 2, "data_type": "FLOAT32", "scale": 1.0, "unit": "psi"},
        {"field_name": "LinerSize", "register_type": "holding", "address": 4, "data_type": "FLOAT32", "scale": 1.0, "unit": "in"},
        {"field_name": "Vibration", "register_type": "holding", "address": 6, "data_type": "FLOAT32", "scale": 1.0, "unit": "ips"},
        {"field_name": "MotorCurrent", "register_type": "holding", "address": 8, "data_type": "FLOAT32", "scale": 1.0, "unit": "A"},
    ],
    "bop": [
        {"field_name": "AnnularPressure", "register_type": "holding", "address": 0, "data_type": "FLOAT32", "scale": 1.0, "unit": "psi"},
        {"field_name": "AccumulatorPressure", "register_type": "holding", "address": 2, "data_type": "FLOAT32", "scale": 1.0, "unit": "psi"},
        {"field_name": "ManifoldPressure", "register_type": "holding", "address": 4, "data_type": "FLOAT32", "scale": 1.0, "unit": "psi"},
        {"field_name": "AnnularStatus", "register_type": "coil", "address": 0, "data_type": "UINT16", "scale": 1.0, "unit": ""},
        {"field_name": "PipeRamStatus", "register_type": "coil", "address": 1, "data_type": "UINT16", "scale": 1.0, "unit": ""},
        {"field_name": "BlindRamStatus", "register_type": "coil", "address": 2, "data_type": "UINT16", "scale": 1.0, "unit": ""},
    ],
}


# ── Pydantic Models ───────────────────────────────────────

class RegisterCreate(BaseModel):
    field_name: str
    register_type: str = "holding"
    address: int = 0
    data_type: str = "FLOAT32"
    byte_order: str = "ABCD"
    scale: float = 1.0
    unit: Optional[str] = None


class RegisterResponse(RegisterCreate):
    id: int
    device_id: int

    class Config:
        orm_mode = True


class DeviceCreate(BaseModel):
    name: str
    device_type: str = "engine"
    is_enabled: bool = True
    ip_address: Optional[str] = None
    port: int = 502
    slave_id: int = 1
    protocol: str = "tcp"
    baud_rate: int = 9600
    timeout: str = "1s"
    measurement_name: str = "rig_sensors"


class DeviceUpdate(DeviceCreate):
    name: Optional[str] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    device_type: str
    is_enabled: bool
    created_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    port: int
    slave_id: int
    protocol: str
    baud_rate: int
    timeout: str
    measurement_name: str
    registers: List[RegisterResponse] = []

    class Config:
        orm_mode = True


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Device CRUD ────────────────────────────────────────────

@router.get("/", response_model=List[DeviceResponse])
def list_devices(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ModbusDevice).order_by(ModbusDevice.created_at.desc()).all()


@router.post("/", response_model=DeviceResponse)
def create_device(
    device_data: DeviceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    data_dict = device_data.dict()
    new_device = ModbusDevice(**data_dict)
    db.add(new_device)
    db.flush()

    # Auto-populate default registers
    defaults = DEFAULT_REGISTERS.get(device_data.device_type, [])
    for reg in defaults:
        db.add(ModbusRegister(device_id=new_device.id, **reg))

    db.commit()
    db.refresh(new_device)
    sync_telegraf_config()
    return new_device


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    device_data: DeviceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    device = db.query(ModbusDevice).filter(ModbusDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    for key, value in device_data.dict(exclude_unset=True).items():
        setattr(device, key, value)
    db.commit()
    db.refresh(device)
    sync_telegraf_config()
    return device


@router.delete("/{device_id}")
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    device = db.query(ModbusDevice).filter(ModbusDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    sync_telegraf_config()
    return {"detail": "Device deleted"}


@router.put("/{device_id}/toggle", response_model=DeviceResponse)
def toggle_device(
    device_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    device = db.query(ModbusDevice).filter(ModbusDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.is_enabled = not device.is_enabled
    db.commit()
    db.refresh(device)
    sync_telegraf_config()
    return device


# ── Register CRUD ──────────────────────────────────────────

@router.put("/{device_id}/registers/bulk", response_model=List[RegisterResponse])
def bulk_update_registers(
    device_id: int,
    registers: List[RegisterCreate],
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    device = db.query(ModbusDevice).filter(ModbusDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    db.query(ModbusRegister).filter(ModbusRegister.device_id == device_id).delete()
    new_regs = []
    for r in registers:
        reg = ModbusRegister(device_id=device_id, **r.dict())
        db.add(reg)
        new_regs.append(reg)
    db.commit()
    for r in new_regs:
        db.refresh(r)
    sync_telegraf_config()
    return new_regs
