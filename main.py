from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
import models
from database import SessionLocal, engine

app = FastAPI()

# Esto abre y cierra la conexión con la base de datos por cada petición
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --------------------------------------------------------
# ESQUEMAS (Para validar los datos que enviará React luego)
# --------------------------------------------------------
class ProductoCreate(BaseModel):
    nombre: str
    cantidad: float
    unidad: str
    categoria: str
    fecha_vencimiento: date

# --------------------------------------------------------
# ENDPOINTS / RUTAS DE LA API
# --------------------------------------------------------

@app.get("/")
def inicio():
    return {"status": "Online", "mensaje": "¡Proyecto Co-Cina funcionando!"}

# 1. Crear un nuevo producto (POST)
@app.post("/productos/")
def crear_producto(producto: ProductoCreate, db: Session = Depends(get_db)):
    nuevo_producto = models.Inventario(
        nombre=producto.nombre,
        cantidad=producto.cantidad,
        unidad=producto.unidad,
        categoria=producto.categoria,
        fecha_vencimiento=producto.fecha_vencimiento
    )
    db.add(nuevo_producto)
    db.commit() # Guarda en MySQL
    db.refresh(nuevo_producto)
    return {"mensaje": "Producto guardado con éxito", "producto": nuevo_producto}

# 2. Obtener todo el inventario con LÓGICA DE SEMÁFORO (GET)
@app.get("/productos/")
def obtener_productos(db: Session = Depends(get_db)):
    productos_db = db.query(models.Inventario).all()
    resultado = []
    hoy = date.today() # Captura la fecha actual del sistema

    for p in productos_db:
        # Matemática simple: Fecha de vencimiento menos fecha de hoy
        dias = (p.fecha_vencimiento - hoy).days
        
        # Lógica del semáforo
        if dias <= 0:
            estado = "🔴 Rojo (Vencido)"
        elif dias <= 3:
            estado = "🟡 Amarillo (Vence en menos de 72h)"
        else:
            estado = "🟢 Verde (En buen estado)"

        # Armamos un paquete con los datos originales + la nueva inteligencia
        producto_inteligente = {
            "id": p.id,
            "nombre": p.nombre,
            "cantidad": p.cantidad,
            "unidad": p.unidad,
            "categoria": p.categoria,
            "fecha_vencimiento": p.fecha_vencimiento,
            "dias_restantes": dias,
            "estado_semaforo": estado
        }
        resultado.append(producto_inteligente)

    return resultado