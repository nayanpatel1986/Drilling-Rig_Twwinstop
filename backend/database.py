from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Default to the docker service name 'postgres'
# Connection string: postgresql://user:password@host:port/dbname
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://admin:password123@postgres:5432/rig_manager"
)

# If running locally (not in docker) efficiently, we might need localhost
# SQLALCHEMY_DATABASE_URL = "postgresql://admin:password123@localhost:5432/rig_manager"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
