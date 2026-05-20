from database import SessionLocal, engine
import models
from datetime import datetime, timedelta

def seed_data():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if data exists
    if db.query(models.Tenant).first():
        print("Data already seeded.")
        db.close()
        return

    print("Seeding initial data...")
    
    tenant = models.Tenant(name="SteelOps Inc.", subscription_plan="Enterprise")
    db.add(tenant)
    db.commit()

    user = models.User(tenant_id=tenant.id, name="김영업", email="sales@steelops.com", role="영업")
    db.add(user)

    posco = models.Customer(tenant_id=tenant.id, name="포스코", contact_person="이담당", contact_number="010-1234-5678")
    hyundai = models.Customer(tenant_id=tenant.id, name="현대제철", contact_person="박책임", contact_number="010-9876-5432")
    db.add_all([posco, hyundai])
    db.commit()

    projects = [
        models.Project(
            tenant_id=tenant.id, customer_id=posco.id, title="광양 2열연 마킹기 개조",
            line_name="2열연", steel_grade="열연", equipment_type="마킹기",
            status="수주", target_date=datetime.now() + timedelta(days=30),
            total_amount=150000000, margin_rate=25.5
        ),
        models.Project(
            tenant_id=tenant.id, customer_id=hyundai.id, title="당진 1냉연 밴딩기 신설",
            line_name="1냉연", steel_grade="냉연", equipment_type="밴딩기",
            status="견적제출", target_date=datetime.now() + timedelta(days=60),
            total_amount=320000000, margin_rate=18.0
        ),
        models.Project(
            tenant_id=tenant.id, customer_id=posco.id, title="포항 후판 비전검사기",
            line_name="후판", steel_grade="후판", equipment_type="비전검사기",
            status="검토중", target_date=datetime.now() + timedelta(days=90),
            total_amount=85000000, margin_rate=30.0
        ),
        models.Project(
            tenant_id=tenant.id, customer_id=posco.id, title="광양 선재 결속기 교체",
            line_name="1선재", steel_grade="선재", equipment_type="결속기",
            status="실주", target_date=datetime.now() - timedelta(days=10),
            total_amount=120000000, margin_rate=15.0
        )
    ]
    db.add_all(projects)
    db.commit()

    specs = [
        models.ProjectSpec(project_id=projects[0].id, speed="120mpm", plc_type="Melsec Q", comm_type="CC-Link", environment="고온, 스케일"),
        models.ProjectSpec(project_id=projects[1].id, speed="200mpm", plc_type="Siemens S7", comm_type="Profinet", environment="일반"),
        models.ProjectSpec(project_id=projects[2].id, speed="60mpm", plc_type="LS", comm_type="TCP/IP", environment="분진"),
    ]
    db.add_all(specs)
    db.commit()
    
    print("Seeding complete.")
    db.close()

if __name__ == "__main__":
    seed_data()
