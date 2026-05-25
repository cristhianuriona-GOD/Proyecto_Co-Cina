from database import engine, Base
import models

print("🚀 Conectando con MySQL y creando tablas...")

try:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✅ ¡LOGRADO! La tabla 'inventario' ya existe en co_cina_db.")
except Exception as e:
    print(f"❌ Hubo un error: {e}")