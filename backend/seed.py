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

    posco = models.Customer(tenant_id=tenant.id, name="포스코", contact_person="이담당", contact_number="010-1234-5678", email="posco_contact@posco.com")
    hyundai = models.Customer(tenant_id=tenant.id, name="현대제철", contact_person="박책임", contact_number="010-9876-5432", email="hyundai_contact@hyundaisteel.com")
    dongkuk = models.Customer(tenant_id=tenant.id, name="동국제강", contact_person="최부장", contact_number="010-5555-6666", email="dongkuk_contact@dongkuk.com")
    db.add_all([posco, hyundai, dongkuk])
    db.commit()

    # Projects and specs are no longer seeded to support a clean "My Data only" startup
    pass
    
    print("Seeding complete.")
    db.close()

if __name__ == "__main__":
    seed_data()
