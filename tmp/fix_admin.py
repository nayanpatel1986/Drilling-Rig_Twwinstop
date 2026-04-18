import sys
sys.path.insert(0, '/app')
from database import SessionLocal
from db_models import User, UserRole
from auth.utils import get_password_hash, verify_password

db = SessionLocal()
try:
    # Remove temp 'admin' user if exists
    temp_admin = db.query(User).filter(User.username == 'admin').first()
    if temp_admin:
        db.delete(temp_admin)
        db.commit()
        print('Removed temp admin user.')

    # Create Drillbit_Twin if not exists
    existing = db.query(User).filter(User.username == 'Drillbit_Twin').first()
    if not existing:
        user = User(
            username='Drillbit_Twin',
            email='admin@drillbit.local',
            hashed_password=get_password_hash('Ongc@123'),
            role=UserRole.ADMIN.value
        )
        db.add(user)
        db.commit()
        print('SUCCESS: Drillbit_Twin admin created.')
    else:
        print('Drillbit_Twin already exists - OK.')

    # Verify password
    u = db.query(User).filter(User.username == 'Drillbit_Twin').first()
    ok = verify_password('Ongc@123', u.hashed_password)
    print('Password verify: PASS' if ok else 'Password verify: FAIL')

    # List all users
    all_users = db.query(User).all()
    print('All users:')
    for u2 in all_users:
        print('  -', u2.username, '[' + u2.role + ']')
finally:
    db.close()
