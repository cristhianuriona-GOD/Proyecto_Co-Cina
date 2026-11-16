from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import hashlib
import io
import requests
import models
from database import SessionLocal, engine
from fastapi.middleware.cors import CORSMiddleware

# Importaciones de ReportLab para el PDF profesional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# Crea las tablas nuevas (usuarios, auditoria_logs) si no existen
models.Base.metadata.create_all(bind=engine)
# --- INICIO CÓDIGO DE RESCATE (Borrar después de ejecutar 1 vez) ---
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE inventario ADD COLUMN codigo_hogar VARCHAR(50) DEFAULT 'HOGAR-PRINCIPAL';"))
        conn.commit()
        print("¡ÉXITO! Columna 'codigo_hogar' creada en MySQL.")
except Exception as e:
    print(f"La columna ya existe o hubo un error: {e}")
# --- FIN CÓDIGO DE RESCATE --- 
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Auto-migración segura y creación de usuarios de prueba con roles separados
def inicializar_sistema():
    with engine.connect() as conn:
        columnas_nuevas = [
            "ALTER TABLE inventario ADD COLUMN propietario_email VARCHAR(100) DEFAULT 'cris@unifranz.edu.bo'",
            "ALTER TABLE inventario ADD COLUMN visibilidad VARCHAR(20) DEFAULT 'Compartido'",
            "ALTER TABLE inventario ADD COLUMN precio_estimado FLOAT DEFAULT 15.0"
        ]
        for sql in columnas_nuevas:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass

    # Crear cuentas por defecto si no existen para probar roles de inmediato
    db = SessionLocal()
    try:
        admin = db.query(models.Usuario).filter(models.Usuario.email == "cris@unifranz.edu.bo").first()
        if not admin:
            db.add(models.Usuario(
                nombre="Cristhian Uriona",
                email="cris@unifranz.edu.bo",
                password_hash=hash_password("123456"),
                rol="Administrador",
                codigo_hogar="HOGAR-URIONA"
            ))
        miembro = db.query(models.Usuario).filter(models.Usuario.email == "familiar@unifranz.edu.bo").first()
        if not miembro:
            db.add(models.Usuario(
                nombre="Familiar Invitado",
                email="familiar@unifranz.edu.bo",
                password_hash=hash_password("123456"),
                rol="Miembro",
                codigo_hogar="HOGAR-URIONA"
            ))
        db.commit()
    except Exception:
        pass
    finally:
        db.close()

inicializar_sistema()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def registrar_log(db: Session, email: str, accion: str):
    ahora = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    nuevo_log = models.AuditoriaLog(usuario_email=email, accion=accion, fecha_hora=ahora)
    db.add(nuevo_log)
    db.commit()

# --------------------------------------------------------
# ESQUEMAS PYDANTIC
# --------------------------------------------------------
class ProductoCreate(BaseModel):
    nombre: str
    cantidad: float
    unidad: str
    categoria: str
    fecha_vencimiento: date
    propietario_email: Optional[str] = "cris@unifranz.edu.bo"
    visibilidad: Optional[str] = "Compartido"
    precio_estimado: Optional[float] = 15.0

class AuthRequest(BaseModel):
    nombre: Optional[str] = "Usuario"
    email: str
    password: str
    rol: Optional[str] = "Miembro"
    modo_registro: Optional[bool] = False

# --------------------------------------------------------
# ENDPOINTS DE AUTENTICACIÓN REAL Y ROLES (ISO 27001)
# --------------------------------------------------------
@app.post("/auth/login")
def login_o_registro(datos: AuthRequest, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == datos.email).first()
    pwd_hash = hash_password(datos.password)

    # Si está creando cuenta nueva
    if datos.modo_registro:
        if usuario:
            raise HTTPException(status_code=400, detail="Este correo ya está registrado. Inicia sesión.")
        nuevo_usuario = models.Usuario(
            nombre=datos.nombre or datos.email.split("@")[0].capitalize(),
            email=datos.email,
            password_hash=pwd_hash,
            rol=datos.rol or "Miembro"
        )
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)
        registrar_log(db, nuevo_usuario.email, f"Registro de nuevo perfil con rol [{nuevo_usuario.rol}]")
        return {
            "id": nuevo_usuario.id,
            "nombre": nuevo_usuario.nombre,
            "email": nuevo_usuario.email,
            "rol": nuevo_usuario.rol,
            "codigo_hogar": nuevo_usuario.codigo_hogar
        }

    # Si está iniciando sesión, validamos que exista y que la contraseña coincida
    if not usuario or usuario.password_hash != pwd_hash:
        registrar_log(db, datos.email, "Intento fallido de inicio de sesión (Credenciales inválidas)")
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    registrar_log(db, usuario.email, f"Inicio de sesión exitoso ({usuario.rol})")
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "email": usuario.email,
        "rol": usuario.rol,
        "codigo_hogar": usuario.codigo_hogar
    }

@app.get("/auditoria/")
def obtener_auditoria(db: Session = Depends(get_db)):
    return db.query(models.AuditoriaLog).order_by(models.AuditoriaLog.id.desc()).limit(15).all()

# --------------------------------------------------------
# ENDPOINTS DE INVENTARIO CON FILTRO DE PRIVACIDAD Y RBAC
# --------------------------------------------------------
def calcular_semaforo(fecha_venc: date):
    hoy = date.today()
    dias = (fecha_venc - hoy).days
    if dias <= 0:
        estado = "Rojo (Vencido)"
    elif dias <= 3:
        estado = "Amarillo (Vence en < 72h)"
    else:
        estado = "Verde (Óptimo)"
    return dias, estado

@app.post("/productos/")
def crear_producto(producto: ProductoCreate, db: Session = Depends(get_db)):
    nuevo_producto = models.Inventario(
        nombre=producto.nombre,
        cantidad=producto.cantidad,
        unidad=producto.unidad,
        categoria=producto.categoria,
        fecha_vencimiento=producto.fecha_vencimiento,
        propietario_email=producto.propietario_email,
        visibilidad=producto.visibilidad,
        precio_estimado=producto.precio_estimado
    )
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    
    registrar_log(db, producto.propietario_email, f"Alta de insumo '{producto.nombre}' [{producto.visibilidad}]")
    dias, estado = calcular_semaforo(nuevo_producto.fecha_vencimiento)

    return {
        "id": nuevo_producto.id,
        "nombre": nuevo_producto.nombre,
        "cantidad": nuevo_producto.cantidad,
        "unidad": nuevo_producto.unidad,
        "categoria": nuevo_producto.categoria,
        "fecha_vencimiento": nuevo_producto.fecha_vencimiento,
        "propietario_email": nuevo_producto.propietario_email,
        "visibilidad": nuevo_producto.visibilidad,
        "precio_estimado": nuevo_producto.precio_estimado,
        "dias_restantes": dias,
        "estado_semaforo": estado
    }

@app.get("/productos/")
def obtener_productos(
    usuario_email: Optional[str] = Query(None),
    modo_privacidad: bool = Query(True),
    db: Session = Depends(get_db)
):
    productos_db = db.query(models.Inventario).all()
    resultado = []

    for p in productos_db:
        vis = getattr(p, "visibilidad", "Compartido") or "Compartido"
        prop = getattr(p, "propietario_email", "cris@unifranz.edu.bo") or "cris@unifranz.edu.bo"
        precio = getattr(p, "precio_estimado", 15.0) or 15.0

        # FILTRO ESTRICTO ENTRE PERFILES:
        if modo_privacidad and vis == "Privado" and usuario_email and prop != usuario_email:
            continue

        dias, estado = calcular_semaforo(p.fecha_vencimiento)
        resultado.append({
            "id": p.id,
            "nombre": p.nombre,
            "cantidad": p.cantidad,
            "unidad": p.unidad,
            "categoria": p.categoria,
            "fecha_vencimiento": p.fecha_vencimiento,
            "propietario_email": prop,
            "visibilidad": vis,
            "precio_estimado": precio,
            "dias_restantes": dias,
            "estado_semaforo": estado
        })

    return resultado

@app.put("/productos/{producto_id}")
def actualizar_producto(
    producto_id: int,
    producto_actualizado: ProductoCreate,
    rol_usuario: Optional[str] = Query("Administrador"),
    db: Session = Depends(get_db)
):
    producto_db = db.query(models.Inventario).filter(models.Inventario.id == producto_id).first()
    if not producto_db:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Control RBAC: Un miembro no puede editar productos privados o de otros si no es Admin
    if rol_usuario != "Administrador" and producto_db.propietario_email != producto_actualizado.propietario_email:
        registrar_log(db, producto_actualizado.propietario_email, f"Bloqueo RBAC: Intento de editar '{producto_db.nombre}'")
        raise HTTPException(status_code=403, detail="Tu rol de Miembro solo permite editar insumos propios.")
    
    producto_db.nombre = producto_actualizado.nombre
    producto_db.cantidad = producto_actualizado.cantidad
    producto_db.unidad = producto_actualizado.unidad
    producto_db.categoria = producto_actualizado.categoria
    producto_db.fecha_vencimiento = producto_actualizado.fecha_vencimiento
    producto_db.visibilidad = producto_actualizado.visibilidad
    producto_db.precio_estimado = producto_actualizado.precio_estimado
    
    db.commit()
    db.refresh(producto_db)
    registrar_log(db, producto_actualizado.propietario_email, f"Edición de '{producto_db.nombre}' ({producto_db.visibilidad})")
    return {"mensaje": "Producto actualizado con éxito"}

@app.delete("/productos/{producto_id}")
def eliminar_producto(
    producto_id: int,
    usuario_email: Optional[str] = Query("sistema"),
    rol_usuario: Optional[str] = Query("Administrador"),
    accion: Optional[str] = Query("desechado"),
    db: Session = Depends(get_db)
):
    producto_db = db.query(models.Inventario).filter(models.Inventario.id == producto_id).first()
    if not producto_db:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    # Control RBAC: Si la acción es 'desechado' (Eliminar), solo el Administrador o el dueño del ítem puede borrarlo
    if accion == "desechado" and rol_usuario != "Administrador" and producto_db.propietario_email != usuario_email:
        registrar_log(db, usuario_email, f"Bloqueo RBAC: Rol Miembro intentó eliminar '{producto_db.nombre}'")
        raise HTTPException(status_code=403, detail="Permiso denegado: Solo el Administrador puede eliminar insumos del hogar.")
    
    nombre_prod = producto_db.nombre
    db.delete(producto_db)
    db.commit()
    registrar_log(db, usuario_email, f"Salida de insumo '{nombre_prod}' por [{accion.upper()}]")
    return {"mensaje": f"El producto '{nombre_prod}' ha sido procesado"}

# --------------------------------------------------------
# GENERADOR DE REPORTE EJECUTIVO EN PDF (REPORTLAB)
# --------------------------------------------------------
@app.get("/reporte/pdf")
def generar_reporte_pdf(
    usuario_email: str = Query("cris@unifranz.edu.bo"),
    rol_usuario: str = Query("Administrador"),
    db: Session = Depends(get_db)
):
    # Separación de funciones: Solo el Administrador puede exportar reportes gerenciales
    if rol_usuario != "Administrador":
        registrar_log(db, usuario_email, "Bloqueo RBAC: Intento no autorizado de exportar PDF")
        raise HTTPException(status_code=403, detail="Función exclusiva para el rol de Administrador del Hogar.")

    productos_db = db.query(models.Inventario).all()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    elementos = []
    estilos = getSampleStyleSheet()

    # Estilos personalizados
    estilo_titulo = ParagraphStyle(
        'TituloCoCina',
        parent=estilos['Heading1'],
        fontSize=18,
        textColor=colors.HexColor("#059669"),
        spaceAfter=6
    )
    estilo_sub = ParagraphStyle(
        'SubCoCina',
        parent=estilos['Normal'],
        fontSize=10,
        textColor=colors.HexColor("#475569"),
        spaceAfter=16
    )

    ahora_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    elementos.append(Paragraph("CO-CINA | Reporte Oficial de Inventario y Despensa", estilo_titulo))
    elementos.append(Paragraph(
        f"<b>Emitido por:</b> {usuario_email} ({rol_usuario}) &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Fecha:</b> {ahora_str} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Normativa:</b> ISO/IEC 25010 &amp; ISO/IEC 27001",
        estilo_sub
    ))

    # Encabezados de la tabla
    datos_tabla = [["ID", "Insumo", "Categoría", "Cantidad", "Visibilidad", "Vencimiento", "Estado Semáforo", "Valor (Bs)"]]
    valor_total_bs = 0.0
    criticos_count = 0

    for p in productos_db:
        vis = getattr(p, "visibilidad", "Compartido") or "Compartido"
        prop = getattr(p, "propietario_email", "cris@unifranz.edu.bo") or "cris@unifranz.edu.bo"
        precio = getattr(p, "precio_estimado", 15.0) or 15.0

        # Respeta la privacidad en el reporte: no incluye privados de otros perfiles
        if vis == "Privado" and prop != usuario_email:
            continue

        dias, estado = calcular_semaforo(p.fecha_vencimiento)
        if dias <= 3:
            criticos_count += 1
        valor_total_bs += precio
        fecha_dmy = p.fecha_vencimiento.strftime("%d/%m/%Y")

        datos_tabla.append([
            str(p.id),
            p.nombre[:22],
            p.categoria,
            f"{p.cantidad} {p.unidad}",
            vis,
            fecha_dmy,
            f"{estado} ({dias}d)",
            f"Bs {precio:.2f}"
        ])

    if len(datos_tabla) == 1:
        datos_tabla.append(["-", "Sin insumos registrados", "-", "-", "-", "-", "-", "Bs 0.00"])

    tabla = Table(datos_tabla, colWidths=[28, 105, 65, 65, 65, 68, 95, 55])
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#1e293b")),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")])
    ]))

    elementos.append(tabla)
    elementos.append(Spacer(1, 18))

    # Resumen ejecutivo inferior
    resumen_texto = (
        f"<b>Resumen Ejecutivo de Despensa:</b> Total de insumos visibles: <b>{len(datos_tabla) - 1}</b> &nbsp;|&nbsp; "
        f"Insumos en estado crítico (&lt;72h): <b>{criticos_count}</b> &nbsp;|&nbsp; "
        f"Valor económico total en inventario: <b>Bs {valor_total_bs:.2f}</b>"
    )
    elementos.append(Paragraph(resumen_texto, estilos['Normal']))
    elementos.append(Spacer(1, 12))
    elementos.append(Paragraph(
        "<i>Documento generado automáticamente por el motor backend FastAPI de Co-Cina bajo controles de acceso RBAC (ISO/IEC 27001) y gestión ambiental (ISO 14001).</i>",
        estilo_sub
    ))

    doc.build(elementos)
    buffer.seek(0)
    registrar_log(db, usuario_email, "Generación y descarga de Reporte Ejecutivo en PDF")

    headers = {
        'Content-Disposition': 'attachment; filename="Reporte_Ejecutivo_CoCina.pdf"'
    }
    return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
# ========================================================
# INTEGRACIÓN DEL MODELO DE IA (OLLAMA LOCAL - gemma3:1b)
# ========================================================
class ChatRequest(BaseModel):
    mensaje: str
    codigo_hogar: str

@app.post("/chatbot/cocina")
def chatbot_ia_cocina(req: ChatRequest, db: Session = Depends(get_db)):
    # 1. Obtenemos el inventario actual
    productos_db = db.query(models.Inventario).filter(models.Inventario.codigo_hogar == req.codigo_hogar).all()
    
    # DEBUG 
    print(f"--- DEBUG CHATBOT --- Hogar: {req.codigo_hogar} | Insumos: {len(productos_db)}")
    
    if not productos_db:
        despensa_contexto = "ACTUALMENTE NO TIENES NINGÚN INGREDIENTE. LA DESPENSA ESTÁ VACÍA."
    else:
        items = [f"- {p.nombre} ({p.cantidad} {p.unidad})" for p in productos_db]
        despensa_contexto = "TIENES EXACTAMENTE ESTOS INGREDIENTES Y NADA MÁS:\n" + "\n".join(items)

    # 2. Prompt ultra-restrictivo (Técnica: Restricción Positiva y Negativa)
    prompt_sistema = (
        "Eres el Chef Virtual IA de Co-Cina. "
        f"{despensa_contexto}\n\n"
        "REGLAS ESTRICTAS:\n"
        "1. NO preguntes qué hay en la despensa, yo ya te di la lista arriba.\n"
        "2. NO inventes ingredientes (no agregues pan, sal, aceite ni agua si no están en la lista).\n"
        "3. Sugiere UNA receta usando SOLO lo que hay en la lista.\n"
        "4. Si la despensa está vacía, di: 'Tu despensa está vacía, por favor agrega productos'."
    )

    # 3. Formateo limpio del prompt para Gemma
    # Extraemos solo la última pregunta del usuario (el historial largo marea a los modelos pequeños)
    ultima_pregunta = req.mensaje.split("\n")[-1] 
    
    url_ollama = "http://localhost:11434/api/generate"
    payload = {
        "model": "gemma3:1b",
        "prompt": f"{prompt_sistema}\n\nUsuario: {ultima_pregunta}\nChef:",
        "stream": False
    }

    try:
        respuesta_ollama = requests.post(url_ollama, json=payload, timeout=30)
        respuesta_ollama.raise_for_status()
        return {"respuesta": respuesta_ollama.json().get("response", "Error leyendo respuesta.")}
    except requests.exceptions.RequestException as e:
        return {"respuesta": "Error de conexión con Ollama en el puerto 11434."}