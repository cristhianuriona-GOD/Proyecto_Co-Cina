import React, { useState, useEffect } from 'react';

function Inventario() {
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: '', cantidad: '', unidad: 'Unidades', categoria: 'Lácteos', fecha_vencimiento: ''
  });
  const [idEdicion, setIdEdicion] = useState(null);
  const [mensaje, setMensaje] = useState(''); // Estado para el aviso

  // Función para convertir a formato Bolivia (dd/mm/aaaa)
  const formatearFecha = (fechaISO) => {
    if (!fechaISO) return "";
    const d = new Date(fechaISO);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  useEffect(() => {
    fetch('http://127.0.0.1:8000/productos/')
      .then(response => response.json())
      .then(data => { if (Array.isArray(data)) setProductos(data); })
      .catch(error => console.error("Error API:", error));
  }, []);

  const eliminarProducto = async (id) => {
    const confirmado = window.confirm("¿Seguro que quieres eliminar este alimento?");
    if (confirmado) {
      try {
        const response = await fetch(`http://127.0.0.1:8000/productos/${id}`, { method: 'DELETE' });
        if (response.ok) {
          setProductos(productos.filter(p => p.id !== id));
        }
      } catch (error) { console.error("Error:", error); }
    }
  };

  const manejarCambioFormulario = (e) => {
    setNuevoProducto({ ...nuevoProducto, [e.target.name]: e.target.value });
  };

  const prepararEdicion = (producto) => {
    setNuevoProducto({
      nombre: producto.nombre,
      cantidad: producto.cantidad,
      unidad: producto.unidad,
      categoria: producto.categoria,
      fecha_vencimiento: producto.fecha_vencimiento
    });
    setIdEdicion(producto.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    if (!nuevoProducto.nombre || !nuevoProducto.fecha_vencimiento) {
      alert("Faltan datos obligatorios."); return;
    }

    try {
      const url = idEdicion ? `http://127.0.0.1:8000/productos/${idEdicion}` : 'http://127.0.0.1:8000/productos/';
      const metodo = idEdicion ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nuevoProducto,
          cantidad: parseFloat(nuevoProducto.cantidad) || 0
        })
      });

      if (response.ok) {
        // --- AQUÍ ESTÁ EL CAMBIO ---
        setMensaje(idEdicion ? '✅ ¡Producto actualizado con éxito!' : '✅ ¡Producto guardado en Co-Cina!');
        setTimeout(() => setMensaje(''), 3000); // Borra el mensaje a los 3 segundos
        // ---------------------------

        const dataActualizada = await fetch('http://127.0.0.1:8000/productos/').then(r => r.json());
        setProductos(dataActualizada);
        setIdEdicion(null);
        setNuevoProducto({ nombre: '', cantidad: '', unidad: 'Unidades', categoria: 'Lácteos', fecha_vencimiento: '' });
      }
    } catch (error) { 
      console.error("Error:", error); 
      setMensaje('❌ Hubo un error al guardar.');
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  const obtenerClaseSemaforo = (estado) => {
    if (!estado || typeof estado !== 'string') return 'badge badge-verde';
    if (estado.includes('Rojo')) return 'badge badge-rojo';
    if (estado.includes('Amarillo')) return 'badge badge-amarillo';
    return 'badge badge-verde';
  };
  const productosFiltrados = productos.filter(producto => 
    producto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    producto.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );
  return (
    <div className="contenedor">
      <h2 className="titulo">Mi Despensa Co-Cina 🍳</h2>
      
      <div className="formulario-contenedor">
        <h3>{idEdicion ? '✏️ Editando alimento...' : '🛒 Agregar nuevo alimento'}</h3>
        <form onSubmit={guardarProducto}>
          <div className="formulario-grid">
            <div className="input-grupo">
              <label>Nombre del producto</label>
              <input type="text" name="nombre" value={nuevoProducto.nombre} onChange={manejarCambioFormulario} placeholder="Ej. Tomates" />
            </div>
            <div className="input-grupo">
              <label>Cantidad</label>
              <input type="number" name="cantidad" value={nuevoProducto.cantidad} onChange={manejarCambioFormulario} />
            </div>
            <div className="input-grupo">
              <label>Unidad</label>
              <select name="unidad" value={nuevoProducto.unidad} onChange={manejarCambioFormulario}>
                <option value="Unidades">Unidades</option>
                <option value="Kg">Kilogramos</option>
                <option value="Litros">Litros</option>
                <option value="Gramos">Gramos</option>
              </select>
            </div>
            <div className="input-grupo">
              <label>Categoría</label>
              <select name="categoria" value={nuevoProducto.categoria} onChange={manejarCambioFormulario}>
                <option value="Lácteos">Lácteos</option>
                <option value="Verduras">Verduras</option>
                <option value="Frutas">Frutas</option>
                <option value="Carnes">Carnes</option>
                <option value="Abarrotes">Abarrotes</option>
              </select>
            </div>
            <div className="input-grupo">
              <label>Fecha Vencimiento</label>
              <input type="date" name="fecha_vencimiento" value={nuevoProducto.fecha_vencimiento} onChange={manejarCambioFormulario} />
            </div>
          </div>
          
          <button type="submit" className="btn-agregar" style={idEdicion ? {backgroundColor: '#d97706'} : {}}>
            {idEdicion ? '💾 Actualizar Producto' : '➕ Guardar en Despensa'}
          </button>

          {/* --- MENSAJE DE CONFIRMACIÓN --- */}
          {mensaje && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '5px', textAlign: 'center', fontWeight: 'bold' }}>
              {mensaje}
            </div>
          )}
          {/* ------------------------------- */}
        </form>
      </div>
      {/* --- BARRA DE BÚSQUEDA --- */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
        <input 
          type="text" 
          placeholder="🔍 Buscar producto o categoría..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ 
            width: '100%', 
            maxWidth: '400px', 
            padding: '10px', 
            borderRadius: '8px', 
            border: '1px solid #ccc',
            fontSize: '16px'
          }}
        />
      </div>
      {/* ------------------------- */}
      <div className="grid-productos">
        {productosFiltrados.map(producto => (
          <div key={producto.id} className="tarjeta">
             {/* ... el resto de tu código de la tarjeta ... */}
            <h3>{producto?.nombre}</h3>
            <p className="info">📦 {producto?.cantidad} {producto?.unidad}</p>
            <p className="info">🏷️ {producto?.categoria}</p>
            <p className="info">📅 Vence: {formatearFecha(producto?.fecha_vencimiento)}</p>
            
            <span className={obtenerClaseSemaforo(producto?.estado_semaforo)}>
              {producto?.estado_semaforo}
            </span>
            
            <div className="acciones-tarjeta">
              <button className="btn-editar" onClick={() => prepararEdicion(producto)}>Editar</button>
              <button className="btn-eliminar" onClick={() => eliminarProducto(producto.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Inventario;