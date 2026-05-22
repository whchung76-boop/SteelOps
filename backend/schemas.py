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
    email: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    model_config = ConfigDict(from_attributes=True)
    id: str

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None

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
    actual_quote_price: Optional[float] = None
    bid_price: Optional[float] = None
    competitor_name: Optional[str] = None
    winning_price: Optional[float] = None

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
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
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
    summary_points: list[str] = []
    tech_difficulty: str = "중"
    past_project_comparison: str = ""
    cost_materials: float = 0.0
    cost_labor: float = 0.0
    cost_tech_fee: float = 0.0
    optimal_quote_price: float = 0.0
    strategic_advice: list[str] = []
    vendor_lowest_option: list[dict[str, Any]] = []
    vendor_optimized_option: list[dict[str, Any]] = []

class RecommendRequest(BaseModel):
    customer_id: Optional[str] = None
    equipment_type: Optional[str] = None
    plc_type: Optional[str] = None

class QuoteItem(BaseModel):
    name: str
    specification: str
    quantity: int
    unit_price: float
    total_price: float

class QuoteResponse(BaseModel):
    title: str
    total_amount: float
    items: list[QuoteItem]
    scope_of_supply: list[str]
    exclusions: list[str]
    conditions: list[str]

class CallSummaryRequest(BaseModel):
    text: str

class CallSummaryResponse(BaseModel):
    id: str
    customer_name: str
    inquiry_type: str
    specs: str
    predicted_equipment: str
    todos: list[str]
    created_at: str

class VendorQuote(BaseModel):
    vendor_name: str
    unit_price: int
    delivery_days: int
    notes: str

class VendorComparisonItem(BaseModel):
    item_name: str
    quotes: list[VendorQuote]

class VendorComparisonResponse(BaseModel):
    project_id: str
    items: list[VendorComparisonItem]

class ProjectUpdate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    title: Optional[str] = None
    line_name: Optional[str] = None
    steel_grade: Optional[str] = None
    equipment_type: Optional[str] = None
    status: Optional[str] = None
    target_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    margin_rate: Optional[float] = None
    actual_quote_price: Optional[float] = None
    bid_price: Optional[float] = None
    competitor_name: Optional[str] = None
    winning_price: Optional[float] = None
    specs: Optional[ProjectSpecCreate] = None

class WeeklyTrendItem(BaseModel):
    week_label: str
    amount: float

class CustomerRatioItem(BaseModel):
    customer_name: str
    won_count: int
    lost_count: int

class DashboardStatsResponse(BaseModel):
    submitted_quotes_count: int
    winning_rate: float
    time_saved_hours: float
    avg_margin_rate: float
    weekly_trends: list[WeeklyTrendItem]
    customer_ratios: list[CustomerRatioItem]

class GmailIntakeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    message_id: str
    subject: str
    sender: str
    received_at: datetime
    snippet: Optional[str] = None
    attachment_name: Optional[str] = None
    ai_status: str
    approval_status: str
    processed_project_id: Optional[str] = None
    created_at: datetime


class GmailIntakePaginatedResponse(BaseModel):
    intakes: list[GmailIntakeResponse]
    next_page_token: Optional[str] = None




