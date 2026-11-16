import React, { useState, useEffect } from 'react';
import './App.css'; 

function App() {
  // --- AUTENTICACIÓN REAL Y ROLES (ISO/IEC 27001) ---
  const [usuarioActivo, setUsuarioActivo] = useState(() => {
    const guardado = localStorage.getItem('cocina_user');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [emailLogin, setEmailLogin] = useState('');
  const [passLogin, setPassLogin] = useState('');
  const [nombreFamilia, setNombreFamilia] = useState('');
  const [rolSeleccionado, setRolSeleccionado] = useState('Administrador');
  const [modoRegistro, setModoRegistro] = useState(false);
  const [errorAuth, setErrorAuth] = useState('');

  // --- PRIVACIDAD ENTRE PERFILES Y CONSENTIMIENTO (R05 y R08) ---
  const [aislamientoPrivado, setAislamientoPrivado] = useState(true);
  const [consentimientoIA, setConsentimientoIA] = useState(true);
  const [logsAuditoria, setLogsAuditoria] = useState([]);
  const [filtroVisibilidad, setFiltroVisibilidad] = useState('Todos');

  // --- NAVEGACIÓN Y DATOS ---
  const [pantallaActual, setPantallaActual] = useState('inicio'); 
  const [listaProductos, setListaProductos] = useState([]);
  const [listaCompras, setListaCompras] = useState(() => {
    const guardado = localStorage.getItem('cocina_compras');
    return guardado ? JSON.parse(guardado) : [
      { id: 1, nombre: 'Leche entera', categoria: 'Lácteos', comprado: false },
      { id: 2, nombre: 'Tomates perita', categoria: 'Verduras', comprado: false }
    ];
  });
  const [nuevoItemCompra, setNuevoItemCompra] = useState('');

  // --- MÉTRICAS DE INGENIERÍA Y ESTADÍSTICA ---
  const [latenciaApi, setLatenciaApi] = useState(0);
  const [erroresApi, setErroresApi] = useState(0);
  const [totalPeticiones, setTotalPeticiones] = useState(0);
  const [historialImpacto, setHistorialImpacto] = useState(() => {
    const guardado = localStorage.getItem('cocina_impacto');
    return guardado ? JSON.parse(guardado) : { consumidos: 12, desechados: 2, ahorroBs: 185.50 };
  });

  // --- VARIABLES PARA EL PERFIL ---
  const [notificaciones, setNotificaciones] = useState(true);
  const [modoOscuro, setModoOscuro] = useState(false);
  const [idEdicion, setIdEdicion] = useState(null);
  // --- VARIABLES PARA EL CHATBOT IA ---
  const [mensajesChat, setMensajesChat] = useState([
    { autor: 'ia', texto: '¡Hola! Soy el Chef Virtual de Co-Cina. ¿Qué cocinamos hoy con tu despensa?' }
  ]);
  const [inputChat, setInputChat] = useState('');
  const [cargandoIA, setCargandoIA] = useState(false);
  const chatFinRef = React.useRef(null);

  useEffect(() => {
    if (modoOscuro) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [modoOscuro]);

  // --- VARIABLES DEL FORMULARIO ---
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('Kg');
  const [categoria, setCategoria] = useState('Verduras');
  const [visibilidad, setVisibilidad] = useState('Compartido');
  const [precioEstimado, setPrecioEstimado] = useState('15');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [esExito, setEsExito] = useState(true);

  // --- SELECTORES DÍA / MES / AÑO ---
  const hoy = new Date();
  const [diaSel, setDiaSel] = useState(String(hoy.getDate()).padStart(2, '0'));
  const [mesSel, setMesSel] = useState(String(hoy.getMonth() + 1).padStart(2, '0'));
  const [anioSel, setAnioSel] = useState(String(hoy.getFullYear()));

  useEffect(() => {
    setFechaVencimiento(`${anioSel}-${mesSel}-${diaSel}`);
  }, [diaSel, mesSel, anioSel]);

  const formatearFechaDMY = (fechaStr) => {
    if (!fechaStr) return '';
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  // --- OBTENER DATOS CON FILTRO DE PRIVACIDAD POR PERFIL ---
  const cargarInventario = async () => {
    if (!usuarioActivo) return;
    const tInicio = performance.now();
    setTotalPeticiones(prev => prev + 1);
    try {
      const url = `http://localhost:8000/productos/?usuario_email=${encodeURIComponent(usuarioActivo.email)}&modo_privacidad=${aislamientoPrivado}`;
      const response = await fetch(url);
      const tFin = performance.now();
      setLatenciaApi(Math.round(tFin - tInicio));

      if (response.ok) {
        const datos = await response.json();
        setListaProductos(datos); 
      } else {
        setErroresApi(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error al cargar inventario:", error);
      setErroresApi(prev => prev + 1);
    }
  };

  const cargarAuditoria = async () => {
    try {
      const resp = await fetch('http://localhost:8000/auditoria/');
      if (resp.ok) {
        setLogsAuditoria(await resp.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (usuarioActivo) {
      cargarInventario();
      if (pantallaActual === 'privacidad') {
        cargarAuditoria();
      }
    }
  }, [pantallaActual, usuarioActivo, aislamientoPrivado]);

  // --- LOGIN Y REGISTRO REAL CONTRA MYSQL ---
  const manejarAuth = async (e) => {
    e.preventDefault();
    setErrorAuth('');
    if (!emailLogin || !passLogin) return;

    try {
      const resp = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: modoRegistro ? nombreFamilia : undefined,
          email: emailLogin.trim(),
          password: passLogin,
          rol: rolSeleccionado,
          modo_registro: modoRegistro
        })
      });

      const data = await resp.json();
      if (resp.ok) {
        localStorage.setItem('cocina_user', JSON.stringify(data));
        setUsuarioActivo(data);
        setEmailLogin('');
        setPassLogin('');
        setNombreFamilia('');
        setPantallaActual('inicio');
      } else {
        setErrorAuth(data.detail || 'Credenciales incorrectas');
      }
    } catch {
      setErrorAuth('No se pudo conectar con el servidor FastAPI (Verifica el puerto 8000)');
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('cocina_user');
    setUsuarioActivo(null);
    setEmailLogin('');
    setPassLogin('');
    setNombreFamilia('');
    setErrorAuth('');
  };

  // --- CÁLCULOS MATEMÁTICOS Y FILTRADO ---
  const esAdmin = usuarioActivo?.rol === 'Administrador';

  const productosFiltrados = listaProductos.filter(p => {
    if (filtroVisibilidad === 'Compartido') return p.visibilidad !== 'Privado';
    if (filtroVisibilidad === 'Privado') return p.visibilidad === 'Privado';
    return true;
  });

  const totalProductos = listaProductos.length;
  const productosCriticos = listaProductos.filter(p => p.dias_restantes <= 3).length;
  
  const prodRojos = listaProductos.filter(p => p.estado_semaforo?.includes('Rojo')).length;
  const prodAmarillos = listaProductos.filter(p => p.estado_semaforo?.includes('Amarillo')).length;
  const prodVerdes = listaProductos.filter(p => p.estado_semaforo?.includes('Verde')).length;
  
  const pctRojo = totalProductos === 0 ? 0 : (prodRojos / totalProductos) * 100;
  const pctAmarillo = totalProductos === 0 ? 0 : (prodAmarillos / totalProductos) * 100;
  const pctVerde = totalProductos === 0 ? 100 : (prodVerdes / totalProductos) * 100;

  const productosPorVencer = listaProductos
    .filter(p => p.dias_restantes >= 0 && p.dias_restantes <= 3)
    .sort((a, b) => a.dias_restantes - b.dias_restantes)
    .slice(0, 3);

  const calcularModaCategoria = () => {
    if (listaProductos.length === 0) return 'Sin datos';
    const conteo = {};
    let maxCat = listaProductos[0].categoria;
    let maxCount = 0;
    listaProductos.forEach(p => {
      conteo[p.categoria] = (conteo[p.categoria] || 0) + 1;
      if (conteo[p.categoria] > maxCount) {
        maxCount = conteo[p.categoria];
        maxCat = p.categoria;
      }
    });
    return `${maxCat} (${maxCount})`;
  };

  const totalGestionados = historialImpacto.consumidos + historialImpacto.desechados;
  const proporcionDesperdicio = totalGestionados === 0 ? 0 : ((historialImpacto.desechados / totalGestionados) * 100).toFixed(1);
  const tasaErrorBd = totalPeticiones === 0 ? 0 : ((erroresApi / totalPeticiones) * 100).toFixed(1);

  // --- PREPARAR FORMULARIO PARA EDITAR (CON VALIDACIÓN RBAC) ---
  const prepararEdicion = (producto) => {
    if (!esAdmin && producto.propietario_email !== usuarioActivo.email) {
      alert("Acceso restringido (ISO/IEC 27001): Tu cuenta de Miembro Familiar solo puede editar los insumos que tú registraste.");
      return;
    }

    setNombre(producto.nombre);
    setCantidad(producto.cantidad);
    setUnidad(producto.unidad);
    setCategoria(producto.categoria);
    setVisibilidad(producto.visibilidad || 'Compartido');
    setPrecioEstimado(producto.precio_estimado || '15');
    if (producto.fecha_vencimiento) {
      const [a, m, d] = producto.fecha_vencimiento.split('-');
      if (a && m && d) {
        setDiaSel(d);
        setMesSel(m);
        setAnioSel(a);
      }
    }
    setIdEdicion(producto.id); 
    setMensaje(''); 
    setPantallaActual('agregar'); 
  };

  const abrirFormularioLimpio = () => {
    const fechaHoy = new Date();
    setIdEdicion(null);
    setNombre('');
    setCantidad('');
    setVisibilidad('Compartido');
    setPrecioEstimado('15');
    setDiaSel(String(fechaHoy.getDate()).padStart(2, '0'));
    setMesSel(String(fechaHoy.getMonth() + 1).padStart(2, '0'));
    setAnioSel(String(fechaHoy.getFullYear()));
    setMensaje('');
    setPantallaActual('agregar');
  };

  // --- CREAR O ACTUALIZAR (POST / PUT) ---
  const guardarProducto = async () => {
    if (!nombre || !cantidad || !fechaVencimiento) {
      setEsExito(false);
      setMensaje('Completa todos los campos obligatorios');
      return;
    }

    const datosProducto = {
      nombre: nombre,
      cantidad: parseFloat(cantidad),
      unidad: unidad,
      categoria: categoria,
      fecha_vencimiento: fechaVencimiento,
      propietario_email: usuarioActivo.email,
      visibilidad: visibilidad,
      precio_estimado: parseFloat(precioEstimado) || 15.0
    };

    const tInicio = performance.now();
    setTotalPeticiones(prev => prev + 1);

    try {
      let response;
      if (idEdicion) {
        response = await fetch(`http://localhost:8000/productos/${idEdicion}?rol_usuario=${encodeURIComponent(usuarioActivo.rol)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datosProducto),
        });
      } else {
        response = await fetch('http://localhost:8000/productos/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datosProducto),
        });
      }

      setLatenciaApi(Math.round(performance.now() - tInicio));

      if (response.ok) {
        setEsExito(true);
        setMensaje(idEdicion ? 'Producto actualizado correctamente' : `Guardado como ${visibilidad}`);
        if (!idEdicion) {
          setNombre(''); setCantidad('');
        }
      } else {
        const errData = await response.json();
        setErroresApi(prev => prev + 1);
        setEsExito(false);
        setMensaje(errData.detail || 'Hubo un error al guardar el producto');
      }
    } catch (error) {
      console.error("Error:", error);
      setErroresApi(prev => prev + 1);
      setEsExito(false);
      setMensaje('Error de conexión con el servidor');
    }
  };

  // --- ELIMINAR O CONSUMIR CON SEPARACIÓN ESTRICTA DE FUNCIONES (RBAC) ---
  const eliminarProducto = async (producto, tipoAccion = 'desechado') => {
    if (tipoAccion === 'desechado' && !esAdmin && producto.propietario_email !== usuarioActivo.email) {
      alert("Función restringida (ISO/IEC 27001): El rol de Miembro Familiar no tiene permisos para eliminar insumos del hogar registrados por otros usuarios.");
      return;
    }

    if (tipoAccion === 'desechado') {
      const confirmar = window.confirm(`¿Eliminar "${producto.nombre}" de la despensa y añadirlo a la Lista de Compras?`);
      if (!confirmar) return;
    }

    const valorEstimado = parseFloat(producto.precio_estimado) || 15.0;
    try {
      const url = `http://localhost:8000/productos/${producto.id}?usuario_email=${encodeURIComponent(usuarioActivo.email)}&rol_usuario=${encodeURIComponent(usuarioActivo.rol)}&accion=${tipoAccion}`;
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) {
        const nuevoImpacto = { ...historialImpacto };
        if (tipoAccion === 'consumido') {
          nuevoImpacto.consumidos += 1;
          nuevoImpacto.ahorroBs = parseFloat((nuevoImpacto.ahorroBs + valorEstimado).toFixed(2));
        } else {
          nuevoImpacto.desechados += 1;
          const nuevaCompra = [
            ...listaCompras,
            { id: Date.now(), nombre: producto.nombre, categoria: producto.categoria, comprado: false }
          ];
          setListaCompras(nuevaCompra);
          localStorage.setItem('cocina_compras', JSON.stringify(nuevaCompra));
        }
        setHistorialImpacto(nuevoImpacto);
        localStorage.setItem('cocina_impacto', JSON.stringify(nuevoImpacto));
        cargarInventario();
      } else {
        const err = await response.json();
        alert(err.detail || "No tienes permisos para realizar esta acción.");
      }
    } catch (error) {
      console.error("Error al procesar:", error);
    }
  };

  // --- DESCARGAR REPORTE FORMAL EN PDF DESDE FASTAPI ---
  const descargarReportePDF = async () => {
    if (!esAdmin) {
      alert("Permiso denegado (ISO/IEC 27001): La generación de Reportes Ejecutivos en PDF es una función exclusiva del Administrador del Hogar.");
      return;
    }

    try {
      const url = `http://localhost:8000/reporte/pdf?usuario_email=${encodeURIComponent(usuarioActivo.email)}&rol_usuario=${encodeURIComponent(usuarioActivo.rol)}`;
      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json();
        alert(err.detail || "Error al generar el PDF");
        return;
      }
      const blob = await response.blob();
      const pdfUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.setAttribute('download', `Reporte_Ejecutivo_CoCina_${hoy.toISOString().slice(0,10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(pdfUrl);
    } catch (error) {
      console.error("Error descargando PDF:", error);
      alert("Error al conectar con el generador de PDF en el backend.");
    }
  };

  const obtenerClaseSemaforo = (estado = '') => {
    if (estado.includes('Rojo')) return 'badge-rojo';
    if (estado.includes('Amarillo')) return 'badge-amarillo';
    return 'badge-verde';
  };

  // ==========================================================
  // VISTA DE LOGIN Y REGISTRO DE CUENTAS INDEPENDIENTES
  // ==========================================================
  if (!usuarioActivo) {
    return (
      <div className={`app-container ${modoOscuro ? 'dark-mode' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="form-container" style={{ width: '100%', maxWidth: '390px', padding: '28px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#d1fae5', color: '#059669', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
            </div>
            <h2 className="form-title" style={{ margin: 0 }}>Co-Cina</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
              Gestión Inteligente de Inventario Doméstico
            </p>
          </div>

          {/* Selector limpio de Iniciar Sesión vs Crear Cuenta */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(148, 163, 184, 0.12)', padding: '4px', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => { setModoRegistro(false); setErrorAuth(''); }}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '9px',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                background: !modoRegistro ? '#10b981' : 'transparent',
                color: !modoRegistro ? '#ffffff' : '#64748b'
              }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setModoRegistro(true); setErrorAuth(''); }}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '9px',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                background: modoRegistro ? '#10b981' : 'transparent',
                color: modoRegistro ? '#ffffff' : '#64748b'
              }}
            >
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={manejarAuth}>
            {modoRegistro && (
              <>
                <div className="form-group">
                  <label className="form-label">Nombre y Apellido</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. Ana Uriona"
                    value={nombreFamilia}
                    onChange={(e) => setNombreFamilia(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de Perfil / Rol en el Hogar</label>
                  <select className="form-select" value={rolSeleccionado} onChange={(e) => setRolSeleccionado(e.target.value)}>
                    <option value="Administrador">Administrador del Hogar (Control Total y PDF)</option>
                    <option value="Miembro">Miembro Familiar (Consulta y Consumo)</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input
                type="email"
                className="form-input"
                placeholder="usuario@correo.com"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-input"
                placeholder="Ingresa tu contraseña"
                value={passLogin}
                onChange={(e) => setPassLogin(e.target.value)}
                required
              />
            </div>

            {errorAuth && (
              <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center', marginBottom: '10px', fontWeight: '600' }}>
                {errorAuth}
              </div>
            )}

            <button type="submit" className="submit-btn" style={{ width: '100%', marginTop: '8px' }}>
              {modoRegistro ? 'Registrar Cuenta' : 'Entrar a Co-Cina'}
            </button>
          </form>
        </div>
      </div>
    );
  }
// --- FUNCIÓN PARA ENVIAR MENSAJE A OLLAMA ---
  const enviarMensajeIA = async () => {
    if (!inputChat.trim() || cargandoIA) return;
    
    const nuevoMensajeUsuario = { autor: 'usuario', texto: inputChat };
    const nuevoHistorial = [...mensajesChat, nuevoMensajeUsuario];
    setMensajesChat(nuevoHistorial);
    setInputChat('');
    setCargandoIA(true);

    // Juntamos los últimos mensajes para darle memoria a la IA
    const historialTexto = nuevoHistorial
      .slice(-6) // Toma los últimos 6 mensajes
      .map(m => `${m.autor === 'usuario' ? 'Usuario' : 'Chef'}: ${m.texto}`)
      .join('\n');

    try {
      const response = await fetch('http://localhost:8000/chatbot/cocina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: historialTexto, // Ahora enviamos la conversación entera, no solo "vacia?"
          codigo_hogar: usuarioActivo.codigo_hogar
        })
      });

      const data = await response.json();
      setMensajesChat((prev) => [...prev, { autor: 'ia', texto: data.respuesta }]);
    } catch (error) {
      setMensajesChat((prev) => [...prev, { autor: 'ia', texto: "Error de conexión con FastAPI o Ollama." }]);
    } finally {
      setCargandoIA(false);
    }
  };

  // Auto-scroll al final del chat
  useEffect(() => {
    if (pantallaActual === 'chef' && chatFinRef.current) {
      chatFinRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajesChat, pantallaActual]);
  return (
    <div className={`app-container ${modoOscuro ? 'dark-mode' : ''}`}>

      {/* ============================================== */}
      {/* PANTALLA: INICIO (HOME)                        */}
      {/* ============================================== */}
      {pantallaActual === 'inicio' && (
        <div className="home-container">
          <div className="home-header">
            <div className="greeting-text">
              <p>Perfil: <strong>{usuarioActivo.rol}</strong></p>
              <h1>Hola, {usuarioActivo.nombre.split(' ')[0]}</h1>
            </div>
            <div className="profile-icon" onClick={() => setPantallaActual('perfil')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
          </div>

          <div className="summary-cards">
            <div className="card card-roja">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Críticas
              </div>
              <p className="card-value">{productosCriticos}</p>
              <p className="card-subtitle">vencen en &lt; 72h</p>
            </div>
            <div className="card card-verde">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                Despensa
              </div>
              <p className="card-value">{totalProductos}</p>
              <p className="card-subtitle">productos totales</p>
            </div>
          </div>

          <div className="progress-section">
            <h3 className="progress-title">Estado de Conservación</h3>
            <div className="progress-bar-container">
              <div className="progress-red" style={{ width: `${pctRojo}%` }}></div>
              <div className="progress-yellow" style={{ width: `${pctAmarillo}%` }}></div>
              <div className="progress-green" style={{ width: `${pctVerde}%` }}></div>
            </div>

            <div className="expiring-section">
              <div className="expiring-header">
                <h3 className="expiring-title">Por vencer</h3>
                <span className="see-all-link" onClick={() => setPantallaActual('despensa')}>
                  Ver todo
                </span>
              </div>

              <div className="expiring-list">
                {productosPorVencer.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginTop: '10px' }}>
                    Sin productos próximos a vencer
                  </p>
                ) : (
                  productosPorVencer.map((producto) => (
                    <div key={producto.id} className="expiring-card">
                      <div className={`icon-circle ${producto.dias_restantes <= 1 ? 'icon-red' : 'icon-orange'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </div>
                      <div className="expiring-info">
                        <h4>{producto.nombre}</h4>
                        <p>{producto.categoria} • {producto.cantidad} {producto.unidad} • {producto.visibilidad || 'Compartido'}</p>
                      </div>
                      <div className={`mini-badge ${producto.dias_restantes <= 1 ? 'mini-badge-red' : 'mini-badge-orange'}`}>
                        {producto.dias_restantes} {producto.dias_restantes === 1 ? 'día' : 'días'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="progress-labels">
              <div className="label-item"><div className="dot dot-red"></div>Urgente</div>
              <div className="label-item"><div className="dot dot-yellow"></div>Pronto</div>
              <div className="label-item"><div className="dot dot-green"></div>Óptimo</div>
            </div>
          </div>
        </div>
      )}
      
      {/* ============================================== */}
      {/* PANTALLA: FORMULARIO                           */}
      {/* ============================================== */}
      {pantallaActual === 'agregar' && (
        <div className="form-container">
          <h2 className="form-title">{idEdicion ? 'Editar Producto' : 'Añadir Producto'}</h2>
          <div className="form-group">
            <label className="form-label">Nombre del producto</label>
            <input type="text" className="form-input" placeholder="Ej. Yogurt Griego" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input type="number" className="form-input" placeholder="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <select className="form-select" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                <option value="Kg">Kg</option>
                <option value="Litros">Litros</option>
                <option value="Unidades">Unidades</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="Verduras">Verduras</option>
                <option value="Lácteos">Lácteos</option>
                <option value="Carnes">Carnes</option>
                <option value="Frutas">Frutas</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valor Estimado (Bs)</label>
              <input type="number" className="form-input" placeholder="15" value={precioEstimado} onChange={(e) => setPrecioEstimado(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Privacidad del Insumo</label>
            <select className="form-select" value={visibilidad} onChange={(e) => setVisibilidad(e.target.value)}>
              <option value="Compartido">Familiar Compartido (Visible para todo el hogar)</option>
              <option value="Privado">Privado Personal (Solo visible en mi cuenta)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha de vencimiento (Día / Mes / Año)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select className="form-select" style={{ flex: 1 }} value={diaSel} onChange={(e) => setDiaSel(e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select className="form-select" style={{ flex: 1.5 }} value={mesSel} onChange={(e) => setMesSel(e.target.value)}>
                <option value="01">Enero</option>
                <option value="02">Febrero</option>
                <option value="03">Marzo</option>
                <option value="04">Abril</option>
                <option value="05">Mayo</option>
                <option value="06">Junio</option>
                <option value="07">Julio</option>
                <option value="08">Agosto</option>
                <option value="09">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
              <select className="form-select" style={{ flex: 1.1 }} value={anioSel} onChange={(e) => setAnioSel(e.target.value)}>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
              </select>
            </div>
          </div>

          {mensaje && (
            <div style={{ textAlign: 'center', marginTop: '10px', color: esExito ? '#00C48C' : '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>
              {mensaje}
            </div>
          )}
          <button className="submit-btn" onClick={guardarProducto}>
            {idEdicion ? 'Actualizar en despensa' : 'Guardar en despensa'}
          </button>
        </div>
      )}

      {/* ============================================== */}
      {/* PANTALLA: INVENTARIO CON PERMISOS POR ROL      */}
      {/* ============================================== */}
      {pantallaActual === 'despensa' && (
        <div className="inventory-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 className="inventory-title" style={{ margin: 0 }}>Inventario</h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['Todos', 'Compartido', 'Privado'].map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroVisibilidad(f)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: filtroVisibilidad === f ? '#10b981' : 'transparent',
                    color: filtroVisibilidad === f ? '#fff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="product-list">
            {productosFiltrados.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b' }}>No hay productos en esta vista.</p>
            ) : (
              productosFiltrados.map((producto) => {
                const tienePermisoTotal = esAdmin || producto.propietario_email === usuarioActivo.email;
                return (
                  <div key={producto.id} className="product-card">
                    <div className="product-info">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h3>{producto.nombre}</h3>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: producto.visibilidad === 'Privado' ? '#fef3c7' : '#e0f2fe',
                            color: producto.visibilidad === 'Privado' ? '#d97706' : '#0284c7',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: '600'
                          }}>
                            {producto.visibilidad === 'Privado' ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                              </svg>
                            ) : null}
                            {producto.visibilidad || 'Compartido'}
                          </span>
                        </div>
                        <div className="product-details">
                          <span>{producto.categoria}</span>
                          <span>•</span>
                          <span>{producto.cantidad} {producto.unidad}</span>
                          <span>•</span>
                          <span>{formatearFechaDMY(producto.fecha_vencimiento)}</span>
                        </div>
                      </div>
                      <div className={`badge-dias ${obtenerClaseSemaforo(producto.estado_semaforo)}`}>
                        {producto.dias_restantes}d
                      </div>
                    </div>
                    <div className="card-actions">
                      <button className="edit-btn" onClick={() => eliminarProducto(producto, 'consumido')} style={{ borderColor: '#10b981', color: '#10b981' }}>
                        Consumido
                      </button>
                      {tienePermisoTotal ? (
                        <>
                          <button className="edit-btn" onClick={() => prepararEdicion(producto)}>Editar</button>
                          <button className="delete-btn" onClick={() => eliminarProducto(producto, 'desechado')}>Eliminar</button>
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          Solo Admin
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* PANTALLA: POLÍTICA DE PRIVACIDAD Y AUDITORÍA   */}
      {/* ============================================== */}
      {pantallaActual === 'privacidad' && (
        <div className="more-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="more-title" style={{ margin: 0 }}>Privacidad y Roles</h2>
            <button onClick={() => setPantallaActual('perfil')} style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
              Volver
            </button>
          </div>

          <div className="setting-card" style={{ padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, fontSize: '15px' }}>Permisos de tu Cuenta ({usuarioActivo.rol})</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0' }}>
              {esAdmin
                ? 'Tienes habilitado el control total del inventario, gestión de insumos privados y exportación de Reportes Ejecutivos en PDF.'
                : 'Tu cuenta tiene permisos de consulta del inventario compartido, registro de consumo y gestión exclusiva de tus insumos propios.'}
            </p>
            <div className="setting-row" style={{ marginTop: '10px' }}>
              <div className="setting-label" style={{ fontSize: '13px' }}>
                Aislar mis ítems "Privados" de otras cuentas
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={aislamientoPrivado} onChange={() => setAislamientoPrivado(!aislamientoPrivado)} />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-row">
              <div className="setting-label" style={{ fontSize: '13px' }}>
                Consentimiento de datos para Chef IA (R08)
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={consentimientoIA} onChange={() => setConsentimientoIA(!consentimientoIA)} />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-card" style={{ padding: '16px' }}>
            <h3 style={{ marginTop: 0, fontSize: '15px' }}>Bitácora de Auditoría en MySQL</h3>
            {logsAuditoria.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#64748b' }}>Sin registros recientes.</p>
            ) : (
              logsAuditoria.slice(0, 6).map(log => (
                <div key={log.id} style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 0', fontSize: '12px' }}>
                  <div style={{ fontWeight: '600' }}>{log.accion}</div>
                  <div style={{ color: '#64748b' }}>{log.usuario_email} • {log.fecha_hora}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* PANTALLA: CHEF VIRTUAL IA CON CHATBOT OLLAMA   */}
      {/* ============================================== */}
      {pantallaActual === 'chef' && (
        <div className="more-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="more-title" style={{ margin: 0 }}>Chef Virtual (Ollama)</h2>
            <button onClick={() => setPantallaActual('mas')} style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>Volver</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: modoOscuro ? '#0f172a' : '#f8fafc', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mensajesChat.map((msg, index) => (
              <div key={index} style={{ 
                alignSelf: msg.autor === 'usuario' ? 'flex-end' : 'flex-start',
                background: msg.autor === 'usuario' ? '#059669' : (modoOscuro ? '#1e293b' : '#ffffff'),
                color: msg.autor === 'usuario' ? '#ffffff' : (modoOscuro ? '#f1f5f9' : '#334155'),
                padding: '10px 14px',
                borderRadius: '16px',
                maxWidth: '85%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                fontSize: '14px',
                lineHeight: '1.4'
              }}>
                {msg.texto}
              </div>
            ))}
            {cargandoIA && (
              <div style={{ alignSelf: 'flex-start', background: modoOscuro ? '#1e293b' : '#ffffff', color: '#94a3b8', padding: '10px 14px', borderRadius: '16px', fontSize: '13px' }}>
                Pensando...
              </div>
            )}
            <div ref={chatFinRef} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej. ¿Qué cocino hoy?..." 
              value={inputChat} 
              onChange={(e) => setInputChat(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && enviarMensajeIA()}
              disabled={cargandoIA}
            />
            <button 
              className="submit-btn" 
              style={{ width: 'auto', padding: '0 16px', marginTop: 0, opacity: cargandoIA ? 0.6 : 1 }} 
              onClick={enviarMensajeIA}
              disabled={cargandoIA}
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* PANTALLA: LISTA DE COMPRAS                     */}
      {/* ============================================== */}
      {pantallaActual === 'compras' && (
        <div className="more-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="more-title" style={{ margin: 0 }}>Lista de Compras</h2>
            <button onClick={() => setPantallaActual('mas')} style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
              Volver
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Añadir insumo faltante..."
              value={nuevoItemCompra}
              onChange={(e) => setNuevoItemCompra(e.target.value)}
            />
            <button
              className="submit-btn"
              style={{ width: 'auto', padding: '0 18px', marginTop: 0 }}
              onClick={() => {
                if (!nuevoItemCompra) return;
                const nueva = [...listaCompras, { id: Date.now(), nombre: nuevoItemCompra, categoria: 'General', comprado: false }];
                setListaCompras(nueva);
                localStorage.setItem('cocina_compras', JSON.stringify(nueva));
                setNuevoItemCompra('');
              }}
            >
              Añadir
            </button>
          </div>

          <div className="setting-card" style={{ padding: '12px' }}>
            {listaCompras.map(item => (
              <div key={item.id} className="setting-row">
                <span style={{ fontSize: '14px' }}>{item.nombre}</span>
                <button
                  className="delete-btn"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => {
                    const filtrada = listaCompras.filter(i => i.id !== item.id);
                    setListaCompras(filtrada);
                    localStorage.setItem('cocina_compras', JSON.stringify(filtrada));
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* PANTALLA: MÉTRICAS Y KPIs                      */}
      {/* ============================================== */}
      {pantallaActual === 'metricas' && (
        <div className="more-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="more-title" style={{ margin: 0 }}>Métricas e Impacto</h2>
            <button onClick={() => setPantallaActual('mas')} style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
              Volver
            </button>
          </div>

          <div className="summary-cards" style={{ marginBottom: '16px' }}>
            <div className="card card-verde">
              <div className="card-title">Ahorro (Ae)</div>
              <p className="card-value">Bs {historialImpacto.ahorroBs}</p>
              <p className="card-subtitle">{historialImpacto.consumidos} insumos consumidos</p>
            </div>
            <div className="card card-roja">
              <div className="card-title">Desperdicio (Pd)</div>
              <p className="card-value">{proporcionDesperdicio}%</p>
              <p className="card-subtitle">{historialImpacto.desechados} desechados</p>
            </div>
          </div>

          <div className="setting-card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Estadística Descriptiva</div>
            <p style={{ fontSize: '13px', margin: '6px 0', color: '#64748b' }}>Moda Categoría (Mo): <strong>{calcularModaCategoria()}</strong></p>
            <p style={{ fontSize: '13px', margin: '6px 0', color: '#64748b' }}>Frecuencia Crítica (hi): <strong>{totalProductos ? ((productosCriticos / totalProductos) * 100).toFixed(1) : 0}%</strong></p>
          </div>

          <div className="setting-card" style={{ padding: '16px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Rendimiento Ingeniería (ISO/IEC 25010)</div>
            <p style={{ fontSize: '13px', margin: '6px 0', color: '#64748b' }}>Latencia API (Tr): <strong>{latenciaApi} ms</strong> (Meta &lt; 200 ms)</p>
            <p style={{ fontSize: '13px', margin: '6px 0', color: '#64748b' }}>Tasa Error BD (Er): <strong>{tasaErrorBd}%</strong> ({erroresApi}/{totalPeticiones} consultas)</p>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* PANTALLA: PERFIL Y REPORTE PDF (LIMPIO)        */}
      {/* ============================================== */}
      {pantallaActual === 'perfil' && (
        <div className="profile-container">
          <h2 className="form-title">Mi Perfil</h2>

          <div className="profile-header-card">
            <div className="profile-avatar">{usuarioActivo.nombre.charAt(0).toUpperCase()}</div>
            <div className="profile-info">
              <h2>{usuarioActivo.nombre}</h2>
              <p>{usuarioActivo.rol} • {usuarioActivo.email}</p>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-title">Preferencias</h3>
            <div className="setting-card">
              <div className="setting-row">
                <div className="setting-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                  </svg>
                  Alertas de vencimiento
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={notificaciones} onChange={() => setNotificaciones(!notificaciones)} />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="setting-row">
                <div className="setting-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                  </svg>
                  Modo Oscuro
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={modoOscuro} onChange={() => setModoOscuro(!modoOscuro)} />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-title">Cuenta</h3>
            <div className="setting-card">
              <div className="setting-row" style={{ cursor: 'pointer', opacity: esAdmin ? 1 : 0.6 }} onClick={descargarReportePDF}>
                <div className="setting-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  Generar Reporte de Despensa (PDF)
                </div>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>{esAdmin ? 'Descargar ›' : 'Solo Admin'}</span>
              </div>

              <div className="setting-row" style={{ cursor: 'pointer' }} onClick={() => setPantallaActual('privacidad')}>
                <div className="setting-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  Política de Privacidad y Roles
                </div>
                <span style={{ color: '#94a3b8' }}>›</span>
              </div>
            </div>
          </div>

          <button className="logout-btn" onClick={cerrarSesion}>
            Cerrar Sesión
          </button>
        </div>
      )}

      {/* ============================================== */}
      {/* PANTALLA: MÁS (CON EXPORTACIÓN PDF DIRECTA)    */}
      {/* ============================================== */}
      {pantallaActual === 'mas' && (
        <div className="more-container">
          <h2 className="more-title">Explorar</h2>

          <div className="features-grid">
            <div className="feature-card" onClick={descargarReportePDF} style={{ opacity: esAdmin ? 1 : 0.65 }}>
              <div className="feature-icon icon-pink">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Reporte Ejecutivo en PDF</h3>
                <p>{esAdmin ? 'Descarga el estado actual de la despensa con aval ISO' : 'Restringido: Requiere rol de Administrador'}</p>
              </div>
              <div className="feature-arrow">›</div>
            </div>

            <div className="feature-card" onClick={() => setPantallaActual('metricas')}>
              <div className="feature-icon icon-teal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"></path>
                  <path d="M18 17V9"></path>
                  <path d="M13 17V5"></path>
                  <path d="M8 17v-3"></path>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Métricas y Rendimiento</h3>
                <p>Indicadores de ahorro, desperdicio y latencia API</p>
              </div>
              <div className="feature-arrow">›</div>
            </div>

            <div className="feature-card" onClick={() => setPantallaActual('chef')}>
              <div className="feature-icon icon-purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3l1.9 5.8 1.9-5.8a2 2 0 0 1 1.3-1.3l5.8-1.9-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"></path>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Chef Virtual IA</h3>
                <p>Recetas con lo que tienes a punto de vencer</p>
              </div>
              <div className="feature-arrow">›</div>
            </div>

            <div className="feature-card" onClick={() => setPantallaActual('compras')}>
              <div className="feature-icon icon-blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Lista de Compras ({listaCompras.length})</h3>
                <p>Reposición automática de insumos agotados</p>
              </div>
              <div className="feature-arrow">›</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* MENÚ INFERIOR                                  */}
      {/* ============================================== */}
      <nav className="bottom-nav">
        <div className={`nav-item ${pantallaActual === 'inicio' ? 'active' : ''}`} onClick={() => setPantallaActual('inicio')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Inicio</span>
        </div>

        <div className={`nav-item ${pantallaActual === 'despensa' ? 'active' : ''}`} onClick={() => setPantallaActual('despensa')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          <span>Despensa</span>
        </div>
        
        <div className="fab-container" onClick={abrirFormularioLimpio}>
          <button className="fab-button">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        
        <div className={`nav-item ${pantallaActual === 'perfil' || pantallaActual === 'privacidad' ? 'active' : ''}`} onClick={() => setPantallaActual('perfil')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Perfil</span>
        </div>

        <div className={`nav-item ${['mas', 'metricas', 'chef', 'compras'].includes(pantallaActual) ? 'active' : ''}`} onClick={() => setPantallaActual('mas')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
          <span>Más</span>
        </div>
      </nav>

    </div>
  );
}

export default App;