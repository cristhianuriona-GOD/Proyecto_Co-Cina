from database import Base
from sqlalchemy import Column, Integer, String, Float, Date, Boolean

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    rol = Column(String(30), default="Administrador")
    codigo_hogar = Column(String(50), default="HOGAR-URIONA")
    ocultar_privados = Column(Boolean, default=True)
    consentimiento_ia = Column(Boolean, default=True)

class Inventario(Base):
    __tablename__ = "inventario"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    cantidad = Column(Float, default=0.0)
    unidad = Column(String(20))
    categoria = Column(String(50))
    fecha_vencimiento = Column(Date, nullable=False)
    
    # --- AQUÍ ESTÁ LA LÍNEA QUE FALTABA ---
    codigo_hogar = Column(String(50), default="HOGAR-PRINCIPAL") 
    
    propietario_email = Column(String(100), default="cris@unifranz.edu.bo")
    visibilidad = Column(String(20), default="Compartido")
    precio_estimado = Column(Float, default=15.0)

class AuditoriaLog(Base):
    __tablename__ = "auditoria_logs"

    id = Column(Integer, primary_key=True, index=True)
    usuario_email = Column(String(100))
    accion = Column(String(255))
    fecha_hora = Column(String(50))