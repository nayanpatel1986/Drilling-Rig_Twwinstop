from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from db_models import Well, WellStatus
from pydantic import BaseModel
from auth.router import get_current_user, require_operator_or_admin

router = APIRouter(prefix="/wells", tags=["wells"])

class WellCreate(BaseModel):
    name: str
    api_number: str
    operator: str
    description: Optional[str] = None

class WellUpdate(BaseModel):
    status: WellStatus
    end_date: Optional[datetime] = None

class WellResponse(BaseModel):
    id: int
    name: str
    api_number: str
    status: str
    start_date: datetime
    end_date: Optional[datetime]
    class Config:
        orm_mode = True

@router.post("/", response_model=WellResponse)
def create_well(well: WellCreate, db: Session = Depends(get_db), current_user = Depends(require_operator_or_admin)):
    # Check if active well exists
    active_well = db.query(Well).filter(Well.status == WellStatus.ACTIVE).first()
    if active_well:
        raise HTTPException(
            status_code=400, 
            detail="An active well already exists. Please end the current well first."
        )

    new_well = Well(
        name=well.name,
        api_number=well.api_number,
        operator=well.operator,
        description=well.description,
        status=WellStatus.ACTIVE,
        start_date=datetime.utcnow()
    )
    db.add(new_well)
    db.commit()
    db.refresh(new_well)
    return new_well

@router.get("/active", response_model=Optional[WellResponse])
def get_active_well(db: Session = Depends(get_db)):
    well = db.query(Well).filter(Well.status == WellStatus.ACTIVE).first()
    if not well:
         # Return a default placeholder or None
         return None 
    return well

@router.put("/{well_id}/end", response_model=WellResponse)
def end_well(well_id: int, db: Session = Depends(get_db), current_user = Depends(require_operator_or_admin)):
    well = db.query(Well).filter(Well.id == well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail="Well not found")
    
    well.status = WellStatus.COMPLETED
    well.end_date = datetime.utcnow()
    db.commit()
    db.refresh(well)
    return well

@router.get("/", response_model=List[WellResponse])
def list_wells(db: Session = Depends(get_db)):
    return db.query(Well).order_by(Well.start_date.desc()).all()
