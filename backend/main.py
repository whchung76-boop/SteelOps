import asyncio
from fastapi import FastAPI, Depends, Query, File, UploadFile, HTTPException
from sqlalchemy.orm import Session, joinedload
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

import models, schemas
from database import engine, get_db

# Create the database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SteelOps API")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to SteelOps API"}

@app.get("/api/projects/", response_model=List[schemas.ProjectResponse])
def read_projects(
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    equipment_type: Optional[List[str]] = Query(None),
    steel_grade: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Project).options(
        joinedload(models.Project.customer),
        joinedload(models.Project.specs)
    )
    
    if status:
        query = query.filter(models.Project.status == status)
    if keyword:
        query = query.filter(models.Project.title.contains(keyword) | models.Project.line_name.contains(keyword))
    if equipment_type:
        query = query.filter(models.Project.equipment_type.in_(equipment_type))
    if steel_grade:
        query = query.filter(models.Project.steel_grade.in_(steel_grade))
        
    projects = query.order_by(models.Project.created_at.desc()).offset(skip).limit(limit).all()
    return projects

@app.get("/api/customers/", response_model=List[schemas.CustomerResponse])
def read_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).all()

@app.post("/api/projects/upload", response_model=schemas.AIAnalysisResponse)
async def upload_spec_file(file: UploadFile = File(...)):
    # Mock AI Service delay
    await asyncio.sleep(2.5)
    
    # Mock extracted data
    return schemas.AIAnalysisResponse(
        title=f"신규 설비 도입 건 ({file.filename})",
        line_name="2냉연",
        steel_grade="냉연",
        equipment_type="밴딩기",
        speed="150mpm",
        plc_type="미기재 (확인 요망)",
        comm_type="미기재 (확인 요망)",
        environment="고온 다습",
        risk_alerts=[
            "⚠️ 제어반(PLC) 메이커 및 통신 방식 미기재",
            "⚠️ 현장 에어압 조건 없음 (확인 요망)"
        ]
    )

@app.post("/api/projects/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    tenant = db.query(models.Tenant).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="No tenant found")
        
    db_project = models.Project(
        tenant_id=tenant.id,
        customer_id=project.customer_id,
        title=project.title,
        line_name=project.line_name,
        steel_grade=project.steel_grade,
        equipment_type=project.equipment_type,
        status=project.status,
        target_date=project.target_date,
        total_amount=project.total_amount,
        margin_rate=project.margin_rate
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    if project.specs:
        db_spec = models.ProjectSpec(
            project_id=db_project.id,
            speed=project.specs.speed,
            plc_type=project.specs.plc_type,
            comm_type=project.specs.comm_type,
            environment=project.specs.environment
        )
        db.add(db_spec)
        db.commit()
        db.refresh(db_spec)
        
    return db.query(models.Project).options(
        joinedload(models.Project.customer),
        joinedload(models.Project.specs)
    ).filter(models.Project.id == db_project.id).first()
