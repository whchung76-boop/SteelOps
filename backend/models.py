import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    subscription_plan = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    users = relationship("User", back_populates="tenant")
    projects = relationship("Project", back_populates="tenant")
    customers = relationship("Customer", back_populates="tenant")

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    role = Column(String) # 영업, 엔지니어, 관리자
    
    tenant = relationship("Tenant", back_populates="users")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"))
    name = Column(String, nullable=False)
    contact_person = Column(String)
    contact_number = Column(String)
    
    tenant = relationship("Tenant", back_populates="customers")
    projects = relationship("Project", back_populates="customer")

class Project(Base):
    __tablename__ = "projects"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"))
    customer_id = Column(String(36), ForeignKey("customers.id"))
    title = Column(String, nullable=False)
    line_name = Column(String)
    steel_grade = Column(String)
    equipment_type = Column(String)
    status = Column(String, default="검토중") # 검토중, 견적제출, 수주, 실주
    target_date = Column(DateTime)
    total_amount = Column(Numeric)
    margin_rate = Column(Numeric)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    tenant = relationship("Tenant", back_populates="projects")
    customer = relationship("Customer", back_populates="projects")
    specs = relationship("ProjectSpec", back_populates="project", uselist=False)

class ProjectSpec(Base):
    __tablename__ = "project_specs"
    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"))
    speed = Column(String)
    plc_type = Column(String)
    comm_type = Column(String)
    environment = Column(String)
    ai_extracted_data = Column(JSON) # JSON type for flexibility
    
    project = relationship("Project", back_populates="specs")
