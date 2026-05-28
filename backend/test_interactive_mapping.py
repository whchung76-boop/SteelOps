import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import create_user_defined_mapping
import models
import schemas
from database import SessionLocal

def test_user_mapping_flow():
    # 1. Create a clean DB session
    db = SessionLocal()
    try:
        # Clear existing mappings for this keyword to isolate test
        test_keyword = "테스트용특수부품"
        db.query(models.UserDefinedMapping).filter(models.UserDefinedMapping.keyword == test_keyword).delete()
        db.commit()

        # 2. Call the endpoint function directly
        payload = schemas.UserDefinedMappingCreate(
            keyword=test_keyword,
            part_name="Beckhoff IPC"
        )
        
        # Call the route function directly
        result = create_user_defined_mapping(payload, db)
        
        assert result.keyword == test_keyword
        assert result.part_name == "Beckhoff IPC"

        # Check DB directly
        db_mapping = db.query(models.UserDefinedMapping).filter(models.UserDefinedMapping.keyword == test_keyword).first()
        assert db_mapping is not None
        assert db_mapping.part_name == "Beckhoff IPC"

        # 3. Clean up
        db.delete(db_mapping)
        db.commit()
        print("[SUCCESS] user mapping flow unit test passed successfully!")

    except AssertionError as ae:
        print("[FAIL] Assertion error:", ae)
        sys.exit(1)
    except Exception as e:
        print("[FAIL] Unexpected error:", e)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    test_user_mapping_flow()
