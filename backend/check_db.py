import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from database import SessionLocal
import models

def check_db():
    db = SessionLocal()
    try:
        # Check gmail intakes
        print("=== GMAIL INTAKES ===")
        intakes = db.query(models.GmailIntake).all()
        for idx, intake in enumerate(intakes):
            print(f"{idx+1}. ID: {intake.id} | MsgID: {intake.message_id} | Subject: {intake.subject} | Attachment: {intake.attachment_name} | AI Status: {intake.ai_status} | Converted Project ID: {intake.processed_project_id}")
        
        # Check projects
        print("\n=== PROJECTS ===")
        projects = db.query(models.Project).all()
        for idx, p in enumerate(projects):
            customer_name = p.customer.name if p.customer else "Unknown"
            print(f"{idx+1}. ID: {p.id} | Title: {p.title} | Cust: {customer_name} | Line: {p.line_name} | Grade: {p.steel_grade} | Equip: {p.equipment_type} | Status: {p.status} | Total: {p.total_amount:,.2f} | Margin: {p.margin_rate}%")
            if p.specs:
                # If specs is a list, iterate, if it's a single object, print it
                if hasattr(p.specs, '__iter__'):
                    for spec in p.specs:
                        print(f"   └─ Spec: Speed: {spec.speed} | PLC: {spec.plc_type} | Comm: {spec.comm_type} | Env: {spec.environment}")
                else:
                    spec = p.specs
                    print(f"   └─ Spec: Speed: {spec.speed} | PLC: {spec.plc_type} | Comm: {spec.comm_type} | Env: {spec.environment}")
            else:
                print("   └─ Spec: None")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
