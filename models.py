from database import Base
from sqlalchemy import Column, Integer, String, Float, Date

class Inventario(Base):
    __tablename__ = "inventario"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    cantidad = Column(Float, default=0.0)
    unidad = Column(String(20)) # Ej: kg, unidades, litros
    categoria = Column(String(50)) # Ej: Lácteos, Carnes, Verduras
    fecha_vencimiento = Column(Date, nullable=False) # ¡Vital para las alertas!