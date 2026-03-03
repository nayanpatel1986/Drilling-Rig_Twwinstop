from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Enum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default=UserRole.VIEWER)
    is_active = Column(Boolean, default=True)

class WellStatus(str, enum.Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    SUSPENDED = "suspended"

class Well(Base):
    __tablename__ = "wells"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    api_number = Column(String, unique=True, index=True)
    operator = Column(String)
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, default=WellStatus.PLANNED)
    description = Column(String, nullable=True)

class WitsmlConfig(Base):
    __tablename__ = "witsml_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # ── Server Connection ───────────────────────────────
    server_url = Column(String, nullable=True)
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    witsml_version = Column(String, default="1.4.1.1")

    # ── Well Information ────────────────────────────────
    well_uid = Column(String, nullable=True)
    wellbore_uid = Column(String, nullable=True)
    log_uid = Column(String, nullable=True)
    well_name = Column(String, nullable=True)
    well_number = Column(String, nullable=True)
    api_number = Column(String, nullable=True)
    operator_name = Column(String, nullable=True)
    field_name = Column(String, nullable=True)
    county = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    surface_latitude = Column(Float, nullable=True)
    surface_longitude = Column(Float, nullable=True)

    # ── Rig Information ─────────────────────────────────
    rig_name = Column(String, nullable=True)
    rig_type = Column(String, nullable=True)
    contractor = Column(String, nullable=True)

    # ── Drilling Parameters ─────────────────────────────
    kb_elevation = Column(Float, nullable=True)
    ground_elevation = Column(Float, nullable=True)
    water_depth = Column(Float, nullable=True)
    planned_total_depth = Column(Float, nullable=True)
    current_depth = Column(Float, nullable=True)
    bit_size = Column(Float, nullable=True)
    casing_od = Column(String, nullable=True)
    casing_depth = Column(Float, nullable=True)
    max_rop = Column(Float, nullable=True)
    max_wob = Column(Float, nullable=True)
    max_rpm = Column(Float, nullable=True)
    max_torque = Column(Float, nullable=True)
    max_spp = Column(Float, nullable=True)
    max_flow_rate = Column(Float, nullable=True)
    max_hook_load = Column(Float, nullable=True)

    # ── Mud / Fluid Parameters ──────────────────────────
    mud_type = Column(String, nullable=True)
    mud_weight = Column(Float, nullable=True)
    mud_viscosity = Column(Float, nullable=True)
    flow_rate_in = Column(Float, nullable=True)

    # ── Service Company ─────────────────────────────────
    service_company = Column(String, nullable=True)
    engineer_name = Column(String, nullable=True)
    data_interval_time = Column(Float, nullable=True)
    data_interval_depth = Column(Float, nullable=True)

    # ── Relationship ────────────────────────────────────
    channel_mappings = relationship("WitsmlChannelMapping", back_populates="config", cascade="all, delete-orphan")


class WitsmlChannelMapping(Base):
    __tablename__ = "witsml_channel_mappings"

    id = Column(Integer, primary_key=True, index=True)
    config_id = Column(Integer, ForeignKey("witsml_configs.id", ondelete="CASCADE"), index=True)
    app_parameter = Column(String, index=True)       # e.g. "HookLoad", "ROP", "WOB"
    witsml_mnemonic = Column(String)                  # e.g. "HKLD", "ROP5", "WOBA"
    unit = Column(String, nullable=True)              # e.g. "klb", "m/hr", "ton"
    scale_factor = Column(Float, default=1.0)         # multiply WITSML value by this
    offset = Column(Float, default=0.0)               # add this after scaling
    description = Column(String, nullable=True)       # friendly label

    config = relationship("WitsmlConfig", back_populates="channel_mappings")


class ModbusDevice(Base):
    __tablename__ = "modbus_devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)                     # e.g. "Engine 1", "Mud Pump 1"
    device_type = Column(String)                          # "engine", "mudpump", "bop"
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Modbus connection
    ip_address = Column(String, nullable=True)            # e.g. "192.168.1.10"
    port = Column(Integer, default=502)
    slave_id = Column(Integer, default=1)
    protocol = Column(String, default="tcp")              # tcp or rtu
    baud_rate = Column(Integer, default=9600)              # for RTU
    timeout = Column(String, default="1s")

    # Telegraf measurement
    measurement_name = Column(String, default="rig_sensors")

    # Relationship
    registers = relationship("ModbusRegister", back_populates="device", cascade="all, delete-orphan")


class ModbusRegister(Base):
    __tablename__ = "modbus_registers"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("modbus_devices.id", ondelete="CASCADE"), index=True)
    field_name = Column(String)                           # e.g. "RPM", "OilPressure", "SPM"
    register_type = Column(String, default="holding")     # holding, input, coil
    address = Column(Integer)                             # Modbus register address
    data_type = Column(String, default="FLOAT32")         # UINT16, INT16, FLOAT32, etc.
    byte_order = Column(String, default="ABCD")           # ABCD, DCBA, BADC, CDAB
    scale = Column(Float, default=1.0)
    unit = Column(String, nullable=True)                  # e.g. "rpm", "psi", "spm"

    device = relationship("ModbusDevice", back_populates="registers")

