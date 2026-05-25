from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ¡OJO AQUÍ! Cambia 'TU_PASSWORD' por la clave que pusiste en el MySQL
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:CR15TH14N@localhost:3306/co_cina_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()