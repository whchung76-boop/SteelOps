import asyncio
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, Query, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

import models, schemas
from database import engine, get_db, SessionLocal

# Create the database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SteelOps API")

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # Auto-migration: check if attachment_content column exists in gmail_intakes table
        from sqlalchemy import inspect, text
        inspector = inspect(db.bind)
        columns = [col['name'] for col in inspector.get_columns('gmail_intakes')]
        if 'attachment_content' not in columns:
            try:
                db.execute(text("ALTER TABLE gmail_intakes ADD COLUMN attachment_content TEXT"))
                db.commit()
                print("[INFO] Successfully added column 'attachment_content' to table 'gmail_intakes'.")
            except Exception as migrate_ex:
                print(f"[WARNING] Auto-migration failed: {migrate_ex}")
                db.rollback()
                
        # Define the titles of sample projects to remove
        sample_titles = [
            "광양 2열연 마킹기 개조",
            "당진 1냉연 밴딩기 신설",
            "포항 후판 비전검사기",
            "광양 선재 결속기 교체",
            "광양 3열연 마킹기 신설",
            "당진 2냉연 밴딩기 개조",
            "인천 공장 자율주행 로봇"
        ]
        # Query and delete
        projects_to_delete = db.query(models.Project).filter(models.Project.title.in_(sample_titles)).all()
        for p in projects_to_delete:
            # Delete associated specs first
            db.query(models.ProjectSpec).filter(models.ProjectSpec.project_id == p.id).delete()
            db.delete(p)
        db.commit()
        print("Sample projects cleaned up successfully on startup.")
    except Exception as e:
        print(f"Error cleaning up sample projects on startup: {e}")
        db.rollback()
    finally:
        db.close()

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

@app.post("/api/customers/", response_model=schemas.CustomerResponse)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    tenant = db.query(models.Tenant).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="No tenant found")
    db_customer = models.Customer(
        tenant_id=tenant.id,
        name=customer.name,
        contact_person=customer.contact_person,
        contact_number=customer.contact_number,
        email=customer.email
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.put("/api/customers/{customer_id}", response_model=schemas.CustomerResponse)
def update_customer(customer_id: str, customer_update: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    update_data = customer_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_customer, key, value)
        
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    # Cascade delete projects and specs
    projects = db.query(models.Project).filter(models.Project.customer_id == customer_id).all()
    for p in projects:
        db.query(models.ProjectSpec).filter(models.ProjectSpec.project_id == p.id).delete()
        db.delete(p)
        
    db.delete(db_customer)
    db.commit()
    return {"message": "Customer and associated projects deleted successfully"}


@app.post("/api/projects/upload", response_model=schemas.AIAnalysisResponse)
async def upload_spec_file(
    file: UploadFile = File(...),
    customer: Optional[str] = Form(None),
    equipment_type: Optional[str] = Form(None)
):
    # Mock AI Service delay
    await asyncio.sleep(2.5)
    
    filename = file.filename or ""
    cust_name = customer or "신규 고객사"
    eq_type = equipment_type or "밴딩기"
    
    is_robot = ("자율주행" in filename or "로봇" in filename) or (equipment_type and ("자율주행" in equipment_type or "로봇" in equipment_type))
    
    if is_robot:
        return schemas.AIAnalysisResponse(
            title=f"{cust_name} {eq_type} 구축 ({filename})",
            line_name="광양소 시편가공실",
            steel_grade="기타(시편)",
            equipment_type=eq_type,
            speed="자율주행 1.5m/s",
            plc_type="ROS2 / IPC (자동 제어)",
            comm_type="Wi-Fi / 5G",
            environment="시편가공실 (분진, 자기장 주의)",
            risk_alerts=[
                "⚠️ 적재용량 200kg 초과 여부 확인 필요",
                "⚠️ 바닥면 단차 및 요철로 인한 주행 장애 요소 사전 실측 요망"
            ],
            summary_points=[
                "시편가공실 내 고자기장 및 분진 환경에 대응하기 위한 밀폐형(IP65급) 외함 설계 및 자기장 차폐 차체 구조 적용이 필수적임.",
                "과거 포항소 프로젝트 대비 좁은 회전 반경(R1.2m 이하) 스펙이 요구되어, 메카넘 휠 또는 전방향 조향 모듈(Dual-drive) 설계 검토 권장.",
                "원가 절감과 단기 납기 준수를 위해 라이다 및 구동 제어 모듈에 국산화 협업 패키지(옵토센서+모션코리아)를 적용하여 최적 견적가 도출."
            ],
            tech_difficulty="상",
            past_project_comparison="포항소 3선재 AGV 도입 프로젝트(2025)와 핵심 구동계는 80% 유사하나, 고자기장 환경(차폐 설계 필요) 및 좁은 협로 주행에 따른 특수 조향 구조 변경이 추가되어 기술적 난이도가 상승함.",
            cost_materials=40000000.0,
            cost_labor=12000000.0,
            cost_tech_fee=11750000.0,
            optimal_quote_price=85000000.0,
            strategic_advice=[
                "발주처 요구 납기(12주) 대비 2주 단축이 가능한 '핵심 모듈 사전 선발주' 안을 전략 제안서에 명시하여 일정 우위 선점.",
                "모터 및 센서류 국산화 대안을 포함한 'Dual Option' 제안서로 경쟁사 대비 우호적 가격 점수를 획득함과 동시에 25% 마진율 수호.",
                "무선 Wi-Fi 음영지역 발생에 대비한 LTE/5G 하이브리드 라우터 무상 지원 프로모션 패키지를 제안하여 수주 확률 제고."
            ],
            vendor_lowest_option=[
                {"item_name": "구동 모터", "vendor_name": "모션코리아", "price": 4500000.0, "spec": "BLDC 400W"},
                {"item_name": "라이다 센서", "vendor_name": "옵토센서", "price": 3200000.0, "spec": "2D Lidar 10m"},
                {"item_name": "제어반/IPC", "vendor_name": "산전시스템", "price": 2800000.0, "spec": "Core i5 IPC (Basic)"}
            ],
            vendor_optimized_option=[
                {"item_name": "구동 모터", "vendor_name": "Sanyo Denki (일본)", "price": 6800000.0, "spec": "AC Servo 400W (고정밀)"},
                {"item_name": "라이다 센서", "vendor_name": "Velodyne (미국)", "price": 7500000.0, "spec": "3D LiDAR 16Ch (정밀 맵핑)"},
                {"item_name": "제어반/IPC", "vendor_name": "Beckhoff (독일)", "price": 4500000.0, "spec": "EtherCAT IPC (차폐 강화형)"}
            ]
        )
    
    # Default Mock extracted data
    return schemas.AIAnalysisResponse(
        title=f"{cust_name} 신규 {eq_type} 도입 건 ({filename})",
        line_name="2냉연",
        steel_grade="냉연",
        equipment_type=eq_type,
        speed="150mpm",
        plc_type="미기재 (확인 요망)",
        comm_type="미기재 (확인 요망)",
        environment="고온 다습",
        risk_alerts=[
            "⚠️ 제어반(PLC) 메이커 및 통신 방식 미기재",
            "⚠️ 현장 에어압 조건 없음 (확인 요망)"
        ],
        summary_points=[
            "2냉연 라인의 고온/다습 환경을 고려하여 스테인리스 스틸 재질의 제어반 외함 및 에어 쿨링 유닛 적용이 반드시 검토되어야 함.",
            "발주서상 PLC 및 통신 사양이 공란이므로, 포스코 표준 Profinet 기반 Siemens S7-1500 제어반으로 제안하여 리스크 선제 방어.",
            "기구 프레임은 기존 설계 도면을 90% 재사용 가능하므로, 원가 시뮬레이션상 기구 설계 부문의 인건비 및 기술료를 대폭 절감함."
        ],
        tech_difficulty="중",
        past_project_comparison="광양 1냉연 밴딩기 개조 사업(2024)과 기구부 구조가 90% 일치하여 설계 재사용 가능. 단, 이번 프로젝트는 라인 속도가 120mpm에서 150mpm으로 향상되어 가이드 롤러 내마모 설계 변경 필요.",
        cost_materials=25000000.0,
        cost_labor=8000000.0,
        cost_tech_fee=5000000.0,
        optimal_quote_price=50000000.0,
        strategic_advice=[
            "포스코 스마트팩토리 표준 가이드라인 사전 준수 기술서 및 성적서를 제안서 첨부 서류로 추가하여 신뢰도 확보.",
            "예비품 무상 제공 품목 확대(주요 마모 부품인 밴딩 헤드 소모품 1년분)를 통해 경쟁사 대비 정성적 평가 점수 가점 획득.",
            "현장 설치 작업 시 가동 정지 시간(Down-time)을 단축하기 위한 48시간 내 모듈 단위 교체 설치 공법 전략 제안."
        ],
        vendor_lowest_option=[
            {"item_name": "유압 모터", "vendor_name": "한일유압", "price": 3500000.0, "spec": "Standard Hydraulic 7.5kW"},
            {"item_name": "PLC 제어반", "vendor_name": "LS일렉트릭", "price": 4200000.0, "spec": "XGB Series"},
            {"item_name": "밴딩 헤드", "vendor_name": "대진기공", "price": 12000000.0, "spec": "PET Banding Head"}
        ],
        vendor_optimized_option=[
            {"item_name": "유압 모터", "vendor_name": "Rexroth (독일)", "price": 5800000.0, "spec": "Variable Displacement 7.5kW"},
            {"item_name": "PLC 제어반", "vendor_name": "Siemens (독일)", "price": 7500000.0, "spec": "S7-1500 (Profinet)"},
            {"item_name": "밴딩 헤드", "vendor_name": "Signode (미국)", "price": 18000000.0, "spec": "Steel Banding Head (초고신뢰형)"}
        ]
    )

@app.post("/api/projects/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    tenant = db.query(models.Tenant).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="No tenant found")
        
    customer_id = project.customer_id
    if project.customer_name:
        # Check if customer already exists by name under this tenant
        existing_cust = db.query(models.Customer).filter(
            models.Customer.tenant_id == tenant.id,
            models.Customer.name == project.customer_name
        ).first()
        if existing_cust:
            customer_id = existing_cust.id
        else:
            # Create new customer dynamically
            new_cust = models.Customer(
                tenant_id=tenant.id,
                name=project.customer_name
            )
            db.add(new_cust)
            db.commit()
            db.refresh(new_cust)
            customer_id = new_cust.id
    elif not customer_id:
        raise HTTPException(status_code=400, detail="Customer ID or Customer Name is required")
        
    db_project = models.Project(
        tenant_id=tenant.id,
        customer_id=customer_id,
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

@app.post("/api/projects/recommend", response_model=List[schemas.ProjectResponse])
def recommend_projects(req: schemas.RecommendRequest, db: Session = Depends(get_db)):
    all_projects = db.query(models.Project).options(
        joinedload(models.Project.customer),
        joinedload(models.Project.specs)
    ).all()
    
    def score(p):
        s = 0
        if req.customer_id and p.customer_id == req.customer_id: s += 10
        if req.equipment_type and p.equipment_type == req.equipment_type: s += 5
        if req.plc_type and p.specs and p.specs.plc_type and req.plc_type in p.specs.plc_type: s += 3
        return s
        
    scored = [(p, score(p)) for p in all_projects if score(p) > 0]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [p[0] for p in scored[:3]]

@app.post("/api/quotes/generate", response_model=schemas.QuoteResponse)
def generate_quote(req: schemas.RecommendRequest):
    equipment = req.equipment_type or "자동화 설비"
    is_robot = "로봇" in equipment or "자율주행" in equipment
    
    exclusions = [
        "설비 설치 위치까지의 1차측 전원 공급 공사 제외",
        "Utility (Air, 용수 등) 배관 및 공급 라인 공사 제외",
        "고객사 사정으로 인한 시운전 지연 시 엔지니어 체재비 별도 청구"
    ]
    if is_robot:
        exclusions.append("자율주행 맵핑 시 공장 내 적치물 이동 등 고객 협조 미비로 인한 지연 시 추가 비용 청구")
        exclusions.append("무선 네트워크(5G/Wi-Fi) 통신 음영 지역으로 인한 주행 불가 책임 제외")
    
    if is_robot:
        items = [
            schemas.QuoteItem(name=f"{equipment} (바퀴형 모바일 플랫폼)", specification="Payload 200kg 급", quantity=1, unit_price=45000000, total_price=45000000),
            schemas.QuoteItem(name="상단 적재부 및 리프트 장치", specification="시편 운반용 맞춤형", quantity=1, unit_price=8000000, total_price=8000000),
            schemas.QuoteItem(name="관제 서버 및 제어 소프트웨어", specification="ROS2 기반 다중 로봇 관제", quantity=1, unit_price=25000000, total_price=25000000),
            schemas.QuoteItem(name="현장 맵핑 및 시운전", specification="1식", quantity=1, unit_price=7000000, total_price=7000000)
        ]
        scope_of_supply = [
            f"{equipment} 제작 및 시편 이송용 지그 결합",
            "현장 맵핑 및 자율주행 라인 설정",
            "관제 소프트웨어 설치 및 기존 시스템(MES/PLC) 인터페이스 연동"
        ]
    else:
        items = [
            schemas.QuoteItem(name=f"{equipment} 본체", specification="Standard Type", quantity=1, unit_price=120000000, total_price=120000000),
            schemas.QuoteItem(name="제어반 (PLC/HMI)", specification=req.plc_type or "지정 메이커", quantity=1, unit_price=15000000, total_price=15000000),
            schemas.QuoteItem(name="설치 및 시운전", specification="1식", quantity=1, unit_price=5000000, total_price=5000000)
        ]
        scope_of_supply = [
            f"{equipment} 설계, 기구 제작 및 조립",
            "현장 반입, 설치 및 구동 테스트 (시운전)",
            "운영자 조작 교육 1회 및 매뉴얼 제공"
        ]
        
    total = sum(i.total_price for i in items)
    
    return schemas.QuoteResponse(
        title=f"{equipment} 도입 표준 견적서",
        total_amount=total,
        items=items,
        scope_of_supply=scope_of_supply,
        exclusions=exclusions,
        conditions=[
            "납기: 발주(도면 승인) 후 12주" if not is_robot else "납기: 발주 후 8주",
            "결제조건: 선급금 30%, 중도금 40%, 잔금 30%",
            "견적 유효기간: 제출일로부터 30일"
        ]
    )

import uuid

@app.post("/api/calls/summarize", response_model=schemas.CallSummaryResponse)
def summarize_call(req: schemas.CallSummaryRequest):
    return schemas.CallSummaryResponse(
        id=str(uuid.uuid4()),
        customer_name="포스코 광양제철소" if "포스코" in req.text else ("현대제철 당진" if "현대" in req.text else "신규 고객사"),
        inquiry_type="설비 교체 및 신규 도입 문의",
        specs="기존 설비 노후화로 인한 교체, 고속 처리 및 최신 통신(Profinet) 지원 요망",
        predicted_equipment="마킹기" if "마킹기" in req.text else ("밴딩기" if "밴딩기" in req.text else "자동화 설비"),
        todos=[
            "고객사 현장 방문 및 기존 설비 실측 (이번 주 내)",
            "기존 라인 도면 확보 및 인터페이스 확인",
            "주요 부품(PLC, 서보) 협력사 단가 견적 요청"
        ],
        created_at=datetime.now().isoformat()
    )

@app.get("/api/vendors/compare/{project_id}", response_model=schemas.VendorComparisonResponse)
def get_vendor_comparison(project_id: str):
    items = [
        schemas.VendorComparisonItem(
            item_name="주제어 PLC (Siemens S7-1500)",
            quotes=[
                schemas.VendorQuote(vendor_name="A사 (공식대리점)", unit_price=12000000, delivery_days=14, notes="재고 보유"),
                schemas.VendorQuote(vendor_name="B사 (직판)", unit_price=11500000, delivery_days=30, notes="독일 본사 발주 필요"),
                schemas.VendorQuote(vendor_name="C사", unit_price=12500000, delivery_days=7, notes="긴급 대응 가능")
            ]
        ),
        schemas.VendorComparisonItem(
            item_name="서보 모터 & 드라이브 세트",
            quotes=[
                schemas.VendorQuote(vendor_name="A사", unit_price=8500000, delivery_days=21, notes="전용 케이블 10m 포함"),
                schemas.VendorQuote(vendor_name="B사", unit_price=8200000, delivery_days=28, notes="케이블 별도"),
                schemas.VendorQuote(vendor_name="C사", unit_price=8800000, delivery_days=10, notes="일부 사양 대체 모델")
            ]
        ),
        schemas.VendorComparisonItem(
            item_name="산업용 비전 카메라 (20M)",
            quotes=[
                schemas.VendorQuote(vendor_name="D사", unit_price=5500000, delivery_days=14, notes="조명 일체형"),
                schemas.VendorQuote(vendor_name="E사", unit_price=4800000, delivery_days=40, notes="납기 지연 가능성 높음"),
                schemas.VendorQuote(vendor_name="F사", unit_price=5200000, delivery_days=21, notes="표준형")
            ]
        )
    ]
    return schemas.VendorComparisonResponse(
        project_id=project_id,
        items=items
    )

@app.get("/api/projects/equipment-types", response_model=List[str])
def get_equipment_types(db: Session = Depends(get_db)):
    types = db.query(models.Project.equipment_type).distinct().all()
    return [t[0] for t in types if t[0]]

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # ProjectSpec will be deleted automatically if cascade="all, delete-orphan" is set, 
    # but let's delete specs explicitly just to be safe if cascade isn't set.
    db.query(models.ProjectSpec).filter(models.ProjectSpec.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

@app.put("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: str, project_update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    update_data = project_update.model_dump(exclude_unset=True)
    
    # Handle specs update separately if it is passed as a dict
    specs_data = update_data.pop("specs", None)
    if specs_data:
        db_specs = db.query(models.ProjectSpec).filter(models.ProjectSpec.project_id == project_id).first()
        if db_specs:
            for key, value in specs_data.items():
                setattr(db_specs, key, value)
        else:
            db_specs = models.ProjectSpec(project_id=project_id, **specs_data)
            db.add(db_specs)
            
    # Handle customer_name separately
    customer_name = update_data.pop("customer_name", None)
    if customer_name:
        tenant = db.query(models.Tenant).first()
        if tenant:
            existing_cust = db.query(models.Customer).filter(
                models.Customer.tenant_id == tenant.id,
                models.Customer.name == customer_name
            ).first()
            if existing_cust:
                db_project.customer_id = existing_cust.id
            else:
                new_cust = models.Customer(tenant_id=tenant.id, name=customer_name)
                db.add(new_cust)
                db.commit()
                db.refresh(new_cust)
                db_project.customer_id = new_cust.id
                
    for key, value in update_data.items():
        setattr(db_project, key, value)
        
    db.commit()
    db.refresh(db_project)
    
    return db.query(models.Project).options(
        joinedload(models.Project.customer),
        joinedload(models.Project.specs)
    ).filter(models.Project.id == project_id).first()


@app.get("/api/dashboard/stats", response_model=schemas.DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    # 1. Fetch all projects
    projects = db.query(models.Project).options(
        joinedload(models.Project.customer)
    ).all()
    
    # Calculate stats
    # submitted_quotes_count: count projects with status in ["견적제출", "수주", "실주"]
    submitted_quotes_all = [p for p in projects if p.status in ["견적제출", "수주", "실주"]]
    submitted_quotes_count = len(submitted_quotes_all)
    
    # winning_rate = (won / (won + lost)) * 100
    won_projects = [p for p in projects if p.status == "수주"]
    lost_projects = [p for p in projects if p.status == "실주"]
    total_decided = len(won_projects) + len(lost_projects)
    winning_rate = (len(won_projects) / total_decided * 100.0) if total_decided > 0 else 0.0
    
    # time_saved_hours: total projects * 3.5
    time_saved_hours = len(projects) * 3.5
    
    # avg_margin_rate: average margin_rate
    margin_rates = [float(p.margin_rate) for p in projects if p.margin_rate is not None]
    avg_margin_rate = sum(margin_rates) / len(margin_rates) if len(margin_rates) > 0 else 0.0
    
    # 2. weekly_trends (last 5 weeks)
    now = datetime.now()
    weekly_trends = []
    for i in range(4, -1, -1):
        target_date = now - timedelta(weeks=i)
        start_of_week = target_date - timedelta(days=target_date.weekday())
        start_of_week = datetime(start_of_week.year, start_of_week.month, start_of_week.day)
        end_of_week = start_of_week + timedelta(days=7)
        
        first_day_of_month = datetime(start_of_week.year, start_of_week.month, 1)
        week_num = ((start_of_week - first_day_of_month).days // 7) + 1
        week_label = f"{start_of_week.month}월 {week_num}주"
        
        week_amount = 0.0
        for p in projects:
            if p.status == "수주" and p.created_at and start_of_week <= p.created_at < end_of_week:
                # Prioritize bid_price, then actual_quote_price, then total_amount
                amt = p.bid_price or p.actual_quote_price or p.total_amount
                if amt is not None:
                    week_amount += float(amt)
        
        # If week_amount is 0 and it's a seed week, we can give it some dummy values so the chart looks rich initially.
        # But if we seed projects spread across weeks in seed.py, it will naturally have values!
        weekly_trends.append(schemas.WeeklyTrendItem(week_label=week_label, amount=week_amount))
        
    # 3. customer_ratios
    cust_data = {}
    for p in projects:
        if p.customer and p.status in ["수주", "실주"]:
            c_name = p.customer.name
            if c_name not in cust_data:
                cust_data[c_name] = {"won": 0, "lost": 0}
            if p.status == "수주":
                cust_data[c_name]["won"] += 1
            else:
                cust_data[c_name]["lost"] += 1
                
    customer_ratios = []
    for c_name, counts in cust_data.items():
        customer_ratios.append(schemas.CustomerRatioItem(
            customer_name=c_name,
            won_count=counts["won"],
            lost_count=counts["lost"]
        ))
        
    # Default fallbacks if no customer ratios are present
    if not customer_ratios:
        customer_ratios = []
        
    return schemas.DashboardStatsResponse(
        submitted_quotes_count=submitted_quotes_count,
        winning_rate=round(winning_rate, 1),
        time_saved_hours=round(time_saved_hours, 1),
        avg_margin_rate=round(avg_margin_rate, 1),
        weekly_trends=weekly_trends,
        customer_ratios=customer_ratios
    )

# --- Gmail Automatic Intake Endpoints ---
@app.get("/api/gmail/intakes", response_model=schemas.GmailIntakePaginatedResponse)
def get_gmail_intakes(page_token: Optional[str] = None, db: Session = Depends(get_db)):
    limit = 10
    offset = 0
    if page_token:
        try:
            offset = int(page_token)
        except ValueError:
            pass
            
    query = db.query(models.GmailIntake).order_by(models.GmailIntake.received_at.desc())
    total = query.count()
    intakes = query.offset(offset).limit(limit).all()
    
    next_page_token = str(offset + limit) if offset + limit < total else None
    
    return schemas.GmailIntakePaginatedResponse(
        intakes=intakes,
        next_page_token=next_page_token
    )

@app.post("/api/gmail/sync", response_model=schemas.GmailIntakePaginatedResponse)
def sync_gmail(page_token: Optional[str] = None, db: Session = Depends(get_db)):
    import gmail_service
    
    try:
        emails, next_gmail_page_token = gmail_service.fetch_gmail_emails(max_results=10, page_token=page_token)
    except Exception as e:
        if hasattr(e, "auth_url"):
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "AUTH_REQUIRED",
                    "auth_url": getattr(e, "auth_url")
                }
            )
        raise HTTPException(
            status_code=400, 
            detail=f"Gmail API 연동 실패: {str(e)}. credentials.json 파일이 없거나 환경 변수 설정이 올바르지 않습니다."
        )
        
    for email in emails:
        existing = db.query(models.GmailIntake).filter(models.GmailIntake.message_id == email["message_id"]).first()
        if not existing:
            new_intake = models.GmailIntake(
                message_id=email["message_id"],
                sender=email["sender"],
                subject=email["subject"],
                snippet=email["snippet"],
                attachment_name=email["attachment_name"],
                attachment_content=email.get("attachment_content"),
                received_at=email["received_at"],
                ai_status="PENDING",
                approval_status="PENDING"
            )
            db.add(new_intake)
        else:
            # Backfill attachment_content if missing
            if not existing.attachment_content and email.get("attachment_content"):
                existing.attachment_content = email.get("attachment_content")
            
    db.commit()
    
    # Return the first page of DB intakes after sync
    limit = 10
    query = db.query(models.GmailIntake).order_by(models.GmailIntake.received_at.desc())
    total = query.count()
    intakes = query.limit(limit).all()
    next_db_page_token = "10" if total > limit else None
    
    return schemas.GmailIntakePaginatedResponse(
        intakes=intakes,
        next_page_token=next_db_page_token
    )

@app.get("/api/gmail/oauth2callback")
def gmail_oauth2callback(code: str = None, state: str = None, error: str = None):
    import os
    import gmail_service
    from google_auth_oauthlib.flow import Flow

    if error:
        return HTMLResponse(
            content=f"""
            <html>
                <head>
                    <title>인증 실패</title>
                    <style>
                        body {{ font-family: 'Malgun Gothic', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8fafc; margin: 0; }}
                        .container {{ text-align: center; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); max-width: 400px; }}
                        h1 {{ color: #ef4444; font-size: 1.5rem; margin-bottom: 1rem; }}
                        p {{ color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }}
                        button {{ background-color: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; font-size: 0.9rem; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }}
                        button:hover {{ background-color: #dc2626; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>인증 실패</h1>
                        <p>Google 인증 과정에서 오류가 발생했습니다.<br>에러 메시지: {error}</p>
                        <button onclick="window.close()">창 닫기</button>
                    </div>
                </body>
            </html>
            """,
            status_code=400
        )

    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is missing.")

    credentials_path = os.getenv("GMAIL_CREDENTIALS_JSON_PATH", "credentials.json")
    if not os.path.exists(credentials_path):
        raise HTTPException(status_code=500, detail="credentials.json not found on server.")

    try:
        flow = Flow.from_client_secrets_file(
            credentials_path,
            scopes=gmail_service.SCOPES,
            redirect_uri="http://localhost:8000/api/gmail/oauth2callback"
        )
        flow.fetch_token(code=code, code_verifier=state)
        creds = flow.credentials

        token_path = os.getenv("GMAIL_TOKEN_JSON_PATH", "token.json")
        with open(token_path, "w") as token_file:
            token_file.write(creds.to_json())

        return HTMLResponse(
            content="""
            <html>
                <head>
                    <title>인증 완료</title>
                    <style>
                        body { font-family: 'Malgun Gothic', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8fafc; margin: 0; }
                        .container { text-align: center; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); max-width: 400px; }
                        .icon { font-size: 3rem; color: #10b981; margin-bottom: 1rem; }
                        h1 { color: #1e293b; font-size: 1.5rem; margin-bottom: 1rem; }
                        p { color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }
                        button { background-color: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; font-size: 0.9rem; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }
                        button:hover { background-color: #2563eb; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✓</div>
                        <h1>Google 계정 연동 성공</h1>
                        <p>Gmail 연동 인증이 성공적으로 완료되었습니다.<br>이 창을 닫고 동기화를 다시 진행해주세요.</p>
                        <button onclick="window.close()">확인</button>
                    </div>
                    <script>
                        try {
                            if (window.opener) {
                                window.opener.postMessage("gmail_auth_success", "*");
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    </script>
                </body>
            </html>
            """
        )
    except Exception as e:
        return HTMLResponse(
            content=f"""
            <html>
                <head>
                    <title>인증 실패</title>
                    <style>
                        body {{ font-family: 'Malgun Gothic', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8fafc; margin: 0; }}
                        .container {{ text-align: center; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); max-width: 400px; }}
                        h1 {{ color: #ef4444; font-size: 1.5rem; margin-bottom: 1rem; }}
                        p {{ color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }}
                        button {{ background-color: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; font-size: 0.9rem; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }}
                        button:hover {{ background-color: #dc2626; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>인증 처리 오류</h1>
                        <p>서버에서 토큰을 교환하는 중 오류가 발생했습니다.<br>에러 메시지: {str(e)}</p>
                        <button onclick="window.close()">창 닫기</button>
                    </div>
                </body>
            </html>
            """,
            status_code=500
        )

@app.post("/api/gmail/intakes/{intake_id}/convert", response_model=schemas.ProjectResponse)
def convert_gmail_to_project(intake_id: str, db: Session = Depends(get_db)):
    intake = db.query(models.GmailIntake).filter(models.GmailIntake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Gmail intake not found")
        
    tenant = db.query(models.Tenant).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="No tenant found")
        
    if intake.message_id == "msg_001":
        customer_name = "포스코"
        contact_person = "홍길동 대리"
        contact_number = "010-1234-5678"
        email = "gildong@posco.com"
        
        project_title = "광양 2열연 마킹기 개조"
        line_name = "2열연"
        steel_grade = "열연"
        equipment_type = "마킹기"
        total_amount = 85000000.0
        margin_rate = 25.0
        
        speed = "120mpm"
        plc_type = "Siemens S7-1500 (Profinet)"
        comm_type = "Profinet"
        environment = "고온 분진 (방진 IP65 권장)"
    elif intake.message_id == "msg_002":
        customer_name = "현대제철"
        contact_person = "김철수 과장"
        contact_number = "010-9876-5432"
        email = "chulsoo@hyundai-steel.com"
        
        project_title = "당진 1냉연 밴딩기 신설"
        line_name = "1냉연"
        steel_grade = "냉연"
        equipment_type = "밴딩기"
        total_amount = 50000000.0
        margin_rate = 22.0
        
        speed = "150mpm"
        plc_type = "LS XGB"
        comm_type = "Modbus"
        environment = "고온 다습 환경"
    elif intake.message_id == "msg_003":
        customer_name = "포스코"
        contact_person = "김영희 대리"
        contact_number = "010-5555-6666"
        email = "yeonghee@posco.com"
        
        project_title = "포항 후판 비전검사기"
        line_name = "후판"
        steel_grade = "후판"
        equipment_type = "비전검사기"
        total_amount = 120000000.0
        margin_rate = 28.0
        
        speed = "80mpm"
        plc_type = "ROS2 / IPC (자동 제어)"
        comm_type = "Ethernet"
        environment = "진동 및 자기장 (밀폐형 IP65)"
    else:
        # 1. Gather all search text (attachment_content, subject, snippet, attachment_name)
        attachment_text = intake.attachment_content or ""
        subject_text = intake.subject or ""
        snippet_text = intake.snippet or ""
        attachment_name_text = intake.attachment_name or ""
        search_corpus = f"{subject_text}\n{snippet_text}\n{attachment_text}\n{attachment_name_text}"
        search_corpus_lower = search_corpus.lower()
        
        # 2. Extract Customer Name
        customer_name = "신규 고객사"
        email = intake.sender or ""
        sender_lower = email.lower()
        
        # Check header (subject + attachment_name) first for high-confidence match
        header_text = f"{subject_text}\n{attachment_name_text}"
        header_text_lower = header_text.lower()
        
        if "posco" in header_text_lower or "포스코" in header_text or "광양" in header_text or "포항" in header_text:
            customer_name = "포스코"
        elif "hyundai" in header_text_lower or "현대제철" in header_text or "당진" in header_text:
            customer_name = "현대제철"
        else:
            # Fallback to full corpus
            if "posco" in search_corpus_lower or "posco" in sender_lower or "포스코" in search_corpus or "광양" in search_corpus or "포항" in search_corpus:
                customer_name = "포스코"
            elif "hyundai" in search_corpus_lower or "hyundai-steel" in sender_lower or "현대제철" in search_corpus or "당진" in search_corpus:
                customer_name = "현대제철"
            else:
                if "posco" in sender_lower:
                    customer_name = "포스코"
                elif "hyundai" in sender_lower:
                    customer_name = "현대제철"
                
        # 3. Representative info based on customer and keywords
        contact_person = ""
        contact_number = ""
        
        if customer_name == "현대제철":
            contact_person = "정재하 이사"
            contact_number = "010-9942-9999"
            email = "rebirth80@dms-inc.kr"
        elif customer_name == "포스코":
            contact_person = "정우현 담당자"
            contact_number = "010-8840-9813"
            email = "woohyun.jung@posco.com"
        else:
            contact_person = email.split("@")[0] if "@" in email else "담당자 미지정"
            contact_number = ""
            
        # 4. Project Title
        project_title = ""
        
        # Look for "건 명 :" or "건명 :" or similar in attachment text
        import re
        title_match = re.search(r"건\s*명\s*:\s*(.*)", search_corpus)
        if title_match:
            extracted = title_match.group(1).strip()
            # Clean up any potential newline sequences and multi-space gaps
            extracted = re.sub(r"\s+", " ", extracted)
            if len(extracted) > 5:
                project_title = extracted
                
        # Specific known projects detection based on signatures in the text
        if "2열연" in search_corpus and ("마킹기" in search_corpus or "마킹머신" in search_corpus):
            project_title = "현대제철 2열연공장 마킹머신 페인트 서플라이 아세이 개선 공사"
        elif "특수강" in search_corpus and "디스펜서" in search_corpus:
            project_title = "현대제철 특수강 소형봉강 정정 라인 (디스펜서 교체)"
        elif "모바일로봇" in search_corpus or "무인배송" in search_corpus or "agv" in search_corpus_lower:
            project_title = "[R&D 설비] (광양) 모바일로봇 기반 소내 물류 무인배송 시스템"
        elif "1냉연" in search_corpus and "밴딩기" in search_corpus:
            project_title = "당진 1냉연 밴딩기 신설"
            
        if not project_title:
            project_title = subject_text.replace("[참조]", "").replace("[견적서]", "").strip()
            if not project_title:
                project_title = "신규 자동화 프로젝트"
                
        # 5. Line Name
        line_name = "미지정"
        if "시편가공실" in search_corpus or "무인배송" in search_corpus or "agv" in search_corpus_lower:
            line_name = "광양소 시편가공실"
        elif "2열연" in search_corpus:
            line_name = "2열연"
        elif "1냉연" in search_corpus:
            line_name = "1냉연"
        elif "2냉연" in search_corpus:
            line_name = "2냉연"
        elif "특수강" in search_corpus:
            line_name = "특수강"
        elif "후판" in search_corpus:
            line_name = "후판"
        elif "도금" in search_corpus:
            line_name = "도금"
        else:
            for word in ["1열연", "2열연", "1냉연", "2냉연", "후판", "도금", "특수강", "시편가공실"]:
                if word in subject_text:
                    line_name = word
                    break
                    
        # 6. Steel Grade
        steel_grade = "기타"
        if "시편가공실" in search_corpus or "시편" in search_corpus or "모바일로봇" in search_corpus or "무인배송" in search_corpus:
            steel_grade = "기타(시편)"
        elif "열연" in search_corpus:
            steel_grade = "열연"
        elif "냉연" in search_corpus:
            steel_grade = "냉연"
        elif "특수강" in search_corpus:
            steel_grade = "특수강"
        elif "후판" in search_corpus:
            steel_grade = "후판"
        else:
            for word in ["열연", "냉연", "특수강", "후판", "시편"]:
                if word in subject_text:
                    if word == "시편":
                        steel_grade = "기타(시편)"
                    else:
                        steel_grade = word
                    break
                    
        # 7. Equipment Type
        equipment_type = "자동화 설비"
        if "모바일로봇" in search_corpus or "무인배송" in search_corpus or "agv" in search_corpus_lower:
            equipment_type = "자율주행로봇"
        elif "마킹기" in search_corpus or "마킹머신" in search_corpus:
            equipment_type = "마킹기"
        elif "디스펜서" in search_corpus:
            equipment_type = "디스펜서"
        elif "밴딩기" in search_corpus:
            equipment_type = "밴딩기"
        elif "비전검사기" in search_corpus or "비전" in search_corpus:
            equipment_type = "비전검사기"
        else:
            for word in ["마킹기", "밴딩기", "비전검사기", "디스펜서", "로봇", "AGV"]:
                if word in subject_text:
                    if word in ["로봇", "AGV"]:
                        equipment_type = "자율주행로봇"
                    else:
                        equipment_type = word
                    break

        # 8. Target Amount & Margin Rate
        if equipment_type == "마킹기":
            total_amount = 85000000.0
            margin_rate = 25.0
        elif equipment_type == "밴딩기":
            if "1냉연" in line_name:
                total_amount = 75000000.0
                margin_rate = 24.0
            else:
                total_amount = 50000000.0
                margin_rate = 22.0
        elif equipment_type == "디스펜서":
            total_amount = 65000000.0
            margin_rate = 23.0
        elif equipment_type == "자율주행로봇":
            total_amount = 110000000.0
            margin_rate = 26.0
        elif equipment_type == "비전검사기":
            total_amount = 120000000.0
            margin_rate = 28.0
        else:
            total_amount = 60000000.0
            margin_rate = 25.0
            
        # 9. Technical Specifications
        if equipment_type == "자율주행로봇":
            speed = "자율주행 1.5m/s"
            plc_type = "ROS2 / IPC (자동 제어)"
            comm_type = "Wi-Fi / 5G"
            environment = "시편가공실 (분진, 자기장 주의)"
        elif equipment_type == "마킹기":
            speed = "120mpm"
            plc_type = "Siemens S7-1500 (Profinet)"
            comm_type = "Profinet"
            environment = "고온 분진 (방진 IP65 권장)"
        elif equipment_type == "밴딩기":
            speed = "150mpm"
            plc_type = "LS XGB"
            comm_type = "Modbus"
            environment = "고온 다습 환경"
        elif equipment_type == "디스펜서":
            speed = "100mpm"
            plc_type = "LS XGB"
            comm_type = "Modbus"
            environment = "진동 및 오일 분무 환경"
        else:
            speed = "100mpm"
            plc_type = "Siemens S7-1500 (Profinet)" if customer_name == "포스코" else "LS XGB"
            comm_type = "Profinet" if customer_name == "포스코" else "Modbus"
            environment = "일반 제철소 공장 환경"

    customer = db.query(models.Customer).filter(
        models.Customer.tenant_id == tenant.id,
        models.Customer.name == customer_name
    ).first()
    
    if not customer:
        customer = models.Customer(
            tenant_id=tenant.id,
            name=customer_name,
            contact_person=contact_person,
            contact_number=contact_number,
            email=email
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
    else:
        if contact_person:
            customer.contact_person = contact_person
        if contact_number:
            customer.contact_number = contact_number
        if email:
            customer.email = email
        db.commit()
        db.refresh(customer)
        
    project = models.Project(
        tenant_id=tenant.id,
        customer_id=customer.id,
        title=project_title,
        line_name=line_name,
        steel_grade=steel_grade,
        equipment_type=equipment_type,
        status="검토중",
        total_amount=total_amount,
        margin_rate=margin_rate
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    spec = models.ProjectSpec(
        project_id=project.id,
        speed=speed,
        plc_type=plc_type,
        comm_type=comm_type,
        environment=environment
    )
    db.add(spec)
    
    intake.ai_status = "COMPLETED"
    intake.approval_status = "APPROVED"
    intake.processed_project_id = project.id
    
    db.commit()
    db.refresh(project)
    
    return db.query(models.Project).options(
        joinedload(models.Project.customer),
        joinedload(models.Project.specs)
    ).filter(models.Project.id == project.id).first()
