from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime

class ProjectSpecBase(BaseModel):
    speed: Optional[str] = None
    plc_type: Optional[str] = None
    comm_type: Optional[str] = None
    environment: Optional[str] = None
    ai_extracted_data: Optional[Any] = None

class ProjectSpecResponse(ProjectSpecBase):
    model_config = ConfigDict(from_attributes=True)
    id: str

class CustomerBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None

class CustomerResponse(CustomerBase):
    model_config = ConfigDict(from_attributes=True)
    id: str

class UserBase(BaseModel):
    name: str
    email: Optional[str] = None
    role: Optional[str] = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: str

class ProjectBase(BaseModel):
    title: str
    line_name: Optional[str] = None
    steel_grade: Optional[str] = None
    equipment_type: Optional[str] = None
    status: Optional[str] = None
    target_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    margin_rate: Optional[float] = None

class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customer: Optional[CustomerResponse] = None
    specs: Optional[ProjectSpecResponse] = None
    created_at: datetime

class ProjectSpecCreate(BaseModel):
    speed: Optional[str] = None
    plc_type: Optional[str] = None
    comm_type: Optional[str] = None
    environment: Optional[str] = None

class ProjectCreate(BaseModel):
    customer_id: str
    title: str
    line_name: Optional[str] = None
    steel_grade: Optional[str] = None
    equipment_type: Optional[str] = None
    status: Optional[str] = "검토중"
    target_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    margin_rate: Optional[float] = None
    specs: Optional[ProjectSpecCreate] = None

class AIAnalysisResponse(BaseModel):
    title: Optional[str] = None
    line_name: Optional[str] = None
    steel_grade: Optional[str] = None
    equipment_type: Optional[str] = None
    target_date: Optional[datetime] = None
    speed: Optional[str] = None
    plc_type: Optional[str] = None
    comm_type: Optional[str] = None
    environment: Optional[str] = None
    risk_alerts: list[str] = []

