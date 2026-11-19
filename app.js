const API_URL = "https://6af7c2bd9bdd097c326e58da.mockapi.io/api/v1/repuestos";
const ENDPOINT_PRODUCTOS = `${API_URL}/Productos`;
const ENDPOINT_CATEGORIAS = `${API_URL}/categorias`; // Opcional

// Credenciales de administrador definidas en código
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

let productos = [];
let categorias = [];
let isAdmin = sessionStorage.getItem("isAdmin") === "true";

// Elementos del DOM
const vistaTiendaEl = document.getElementById("vista-tienda");
const navTiendaEl = document.getElementById("nav-tienda");
const navAdminEl = document.getElementById("nav-admin");
const panelAdminEl = document.getElementById("panel-admin");

const catalogoEl = document.getElementById("catalogo");
const estadoMsgEl = document.getElementById("estado-msg");
const filtroCategoriaEl = document.getElementById("filtro-categoria");
const adminItemsEl = document.getElementById("admin-items");
const listaCategoriasEl = document.getElementById("lista-categorias");

const statTotalProdsEl = document.getElementById("stat-total-prods");
const statTotalStockEl = document.getElementById("stat-total-stock");
const statAgotadosEl = document.getElementById("stat-agotados");

const modalLoginEl = document.getElementById("modal-login");
const formLoginEl = document.getElementById("form-login");
const loginErrorEl = document.getElementById("login-error");
const btnAbrirLogin = document.getElementById("btn-abrir-login");
const btnCerrarLogin = document.getElementById("btn-cerrar-login");
const btnVerTienda = document.getElementById("btn-ver-tienda");
const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");

const formProductoEl = document.getElementById("form-producto");
const btnCancelarEdicion = document.getElementById("btn-cancelar-edicion");
const formCategoriaEl = document.getElementById("form-categoria");

function setMensaje(texto) {
  estadoMsgEl.textContent = texto;
}

function construirPayload(prodBase, cambios = {}) {
  return {
    nombre: String(cambios.nombre ?? prodBase?.nombre ?? "").trim(),
    precio: Number(cambios.precio ?? prodBase?.precio ?? 0),
    stock: Math.max(0, Number(cambios.stock ?? prodBase?.stock ?? 0)),
    categoria: String(cambios.categoria ?? prodBase?.categoria ?? "Repostería").trim(),
    imagen: String(cambios.imagen ?? prodBase?.imagen ?? "").trim(),
  };
}

async function cargarProductos() {
  setMensaje("Cargando postres de Dulces Antojitos...");
  try {
    const res = await fetch(ENDPOINT_PRODUCTOS);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GET ${res.status}: ${errText}`);
    }
    productos = await res.json();
    renderCatalogo();
    renderAdminInventario();
    actualizarStatsAdmin();
    poblarFiltroCategorias();
    setMensaje("");
  } catch (err) {
    setMensaje(`Error al cargar productos (${err.message}). Revisa la URL de MockAPI.`);
    console.error("Error al cargar:", err);
  }
}

async function cargarCategorias() {
  try {
    const res = await fetch(ENDPOINT_CATEGORIAS);
    if (!res.ok) return;
    categorias = await res.json();
    renderCategorias();
    poblarFiltroCategorias();
  } catch {
    // Opcional
  }
}

function poblarFiltroCategorias() {
  const seleccionActual = filtroCategoriaEl.value;
  const setCats = new Set(
    [
      ...categorias.map((c) => c.nombre).filter(Boolean),
      ...productos.map((p) => p.categoria).filter(Boolean),
    ].map((c) => c.trim())
  );

  filtroCategoriaEl.innerHTML = `<option value="todas">Todas las categorías</option>`;
  setCats.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    filtroCategoriaEl.appendChild(opt);
  });

  if ([...setCats].includes(seleccionActual)) {
    filtroCategoriaEl.value = seleccionActual;
  }
}

function renderCategorias() {
  listaCategoriasEl.innerHTML = "";
  categorias.forEach((cat) => {
    const li = document.createElement("li");
    li.textContent = cat.nombre;
    listaCategoriasEl.appendChild(li);
  });
}

function renderCatalogo() {
  const filtro = filtroCategoriaEl.value;
  const filtrados =
    filtro === "todas"
      ? productos
      : productos.filter((p) => (p.categoria || "").trim() === filtro);

  catalogoEl.innerHTML = "";

  if (filtrados.length === 0) {
    catalogoEl.innerHTML = "<p>No hay postres disponibles en esta categoría.</p>";
    return;
  }

  filtrados.forEach((prod) => {
    const stockActual = Math.max(0, Number(prod.stock) || 0);
    const sinStock = stockActual <= 0;

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${prod.imagen || "https://via.placeholder.com/300x160?text=Dulces+Antojitos"}" alt="${prod.nombre}" />
      <span class="badge-cat">${prod.categoria || "Repostería"}</span>
      <h3>${prod.nombre}</h3>
      <span class="precio">$${Number(prod.precio || 0).toFixed(2)}</span>
      <span class="stock">Stock disponible: <strong>${stockActual}</strong></span>
      <button type="button" class="btn btn-primary btn-comprar" data-id="${prod.id}" ${sinStock ? "disabled" : ""}>
        ${sinStock ? "Agotado" : "Comprar"}
      </button>
    `;

    card.querySelector(".btn-comprar").addEventListener("click", () => comprarProducto(prod.id));
    catalogoEl.appendChild(card);
  });
}

async function comprarProducto(id) {
  const prod = productos.find((p) => String(p.id) === String(id));
  if (!prod) return;

  if (!prod.id) {
    setMensaje(`El producto "${prod.nombre}" no tiene ID en MockAPI.`);
    return;
  }

  const stockActual = Math.max(0, Number(prod.stock) || 0);
  if (stockActual <= 0) {
    setMensaje(`"${prod.nombre}" está agotado.`);
    return;
  }

  const entrada = prompt(
    `¿Cuántas unidades de "${prod.nombre}" deseas comprar? (Stock disponible: ${stockActual})`,
    "1"
  );

  if (entrada === null || entrada.trim() === "") return;

  const cantidad = Number(entrada);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    setMensaje("Ingresa una cantidad válida mayor a 0.");
    return;
  }

  if (cantidad > stockActual) {
    setMensaje(`Solo hay ${stockActual} unidad(es) disponibles de "${prod.nombre}".`);
    return;
  }

  const nuevoStock = stockActual - cantidad;
  const payload = construirPayload(prod, { stock: nuevoStock });
  const url = `${ENDPOINT_PRODUCTOS}/${prod.id}`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PUT ${res.status} en ${url}: ${errText}`);
    }

    const actualizado = await res.json();
    productos = productos.map((p) => (String(p.id) === String(prod.id) ? actualizado : p));
    renderCatalogo();
    renderAdminInventario();
    actualizarStatsAdmin();
    setMensaje(`Compra registrada: llevaste ${cantidad} de "${prod.nombre}". Stock restante: ${nuevoStock}.`);
  } catch (err) {
    setMensaje(`Error al restar stock (${err.message}).`);
    console.error("Error al comprar:", err);
  }
}

// --- Cambio entre Vista Tienda y Vista Admin ---
function actualizarVistasUI() {
  vistaTiendaEl.classList.toggle("hidden", isAdmin);
  navTiendaEl.classList.toggle("hidden", isAdmin);
  panelAdminEl.classList.toggle("hidden", !isAdmin);
  navAdminEl.classList.toggle("hidden", !isAdmin);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

btnAbrirLogin.addEventListener("click", () => {
  loginErrorEl.textContent = "";
  formLoginEl.reset();
  modalLoginEl.classList.remove("hidden");
});

btnCerrarLogin.addEventListener("click", () => {
  modalLoginEl.classList.add("hidden");
});

formLoginEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const usuario = document.getElementById("login-usuario").value.trim();
  const password = document.getElementById("login-password").value;

  if (usuario === ADMIN_USER && password === ADMIN_PASS) {
    isAdmin = true;
    sessionStorage.setItem("isAdmin", "true");
    modalLoginEl.classList.add("hidden");
    actualizarVistasUI();
    setMensaje("Bienvenido al panel de administración de Dulces Antojitos.");
  } else {
    loginErrorEl.textContent = "Usuario o contraseña incorrectos.";
  }
});

btnVerTienda.addEventListener("click", () => {
  vistaTiendaEl.classList.remove("hidden");
  panelAdminEl.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

btnCerrarSesion.addEventListener("click", () => {
  isAdmin = false;
  sessionStorage.removeItem("isAdmin");
  actualizarVistasUI();
  setMensaje("Sesión de administrador cerrada.");
});

// --- Estadísticas y CRUD Admin ---
function actualizarStatsAdmin() {
  const totalProds = productos.length;
  const totalStock = productos.reduce((acc, p) => acc + Math.max(0, Number(p.stock) || 0), 0);
  const agotados = productos.filter((p) => Math.max(0, Number(p.stock) || 0) === 0).length;

  statTotalProdsEl.textContent = totalProds;
  statTotalStockEl.textContent = totalStock;
  statAgotadosEl.textContent = agotados;
}

function renderAdminInventario() {
  adminItemsEl.innerHTML = "";
  productos.forEach((prod) => {
    const fila = document.createElement("div");
    fila.className = "admin-row";
    fila.innerHTML = `
      <div>
        <strong>${prod.nombre}</strong> <span class="badge-cat">${prod.categoria || "Repostería"}</span><br/>
        <span class="stock">Stock: <strong>${prod.stock}</strong> · Precio: <strong>$${Number(prod.precio || 0).toFixed(2)}</strong></span>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary btn-editar" data-id="${prod.id}">Editar</button>
        <button type="button" class="btn btn-danger btn-eliminar" data-id="${prod.id}">Eliminar</button>
      </div>
    `;

    fila.querySelector(".btn-editar").addEventListener("click", () => cargarFormularioEdicion(prod));
    fila.querySelector(".btn-eliminar").addEventListener("click", () => eliminarProducto(prod.id));
    adminItemsEl.appendChild(fila);
  });
}

function cargarFormularioEdicion(prod) {
  document.getElementById("prod-id").value = prod.id;
  document.getElementById("prod-nombre").value = prod.nombre || "";
  document.getElementById("prod-precio").value = prod.precio ?? 0;
  document.getElementById("prod-stock").value = prod.stock ?? 0;
  document.getElementById("prod-categoria").value = prod.categoria || "";
  document.getElementById("prod-imagen").value = prod.imagen || "";
  setMensaje(`Editando "${prod.nombre}"...`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function limpiarFormularioProducto() {
  document.getElementById("prod-id").value = "";
  formProductoEl.reset();
}

btnCancelarEdicion.addEventListener("click", limpiarFormularioProducto);

formProductoEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const rawId = document.getElementById("prod-id").value.trim();
  const prodExistente = rawId
    ? productos.find((p) => String(p.id) === String(rawId))
    : null;
  const targetId = prodExistente ? prodExistente.id : rawId;

  const payload = construirPayload(prodExistente, {
    nombre: document.getElementById("prod-nombre").value,
    precio: document.getElementById("prod-precio").value,
    stock: document.getElementById("prod-stock").value,
    categoria: document.getElementById("prod-categoria").value,
    imagen: document.getElementById("prod-imagen").value,
  });

  const url = targetId ? `${ENDPOINT_PRODUCTOS}/${targetId}` : ENDPOINT_PRODUCTOS;
  const method = targetId ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${method} ${res.status}: ${errText}`);
    }

    limpiarFormularioProducto();
    await cargarProductos();
    setMensaje(targetId ? "Producto actualizado correctamente." : "Producto creado correctamente.");
  } catch (err) {
    setMensaje(`No se pudo guardar el producto (${err.message}).`);
    console.error("Error al guardar:", err);
  }
});

async function eliminarProducto(id) {
  if (!isAdmin) return;
  try {
    const res = await fetch(`${ENDPOINT_PRODUCTOS}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DELETE ${res.status}: ${errText}`);
    }
    await cargarProductos();
    setMensaje("Producto eliminado.");
  } catch (err) {
    setMensaje(`No se pudo eliminar el producto (${err.message}).`);
    console.error("Error al eliminar:", err);
  }
}

formCategoriaEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const nombre = document.getElementById("cat-nombre").value.trim();
  if (!nombre) return;

  try {
    const res = await fetch(ENDPOINT_CATEGORIAS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`POST ${res.status}: ${errText}`);
    }
    formCategoriaEl.reset();
    await cargarCategorias();
    setMensaje(`Categoría "${nombre}" agregada.`);
  } catch (err) {
    setMensaje(`Error categoría (${err.message}). Revisa si creaste 'categorias' en MockAPI.`);
    console.error("Error categoría:", err);
  }
});

filtroCategoriaEl.addEventListener("change", renderCatalogo);

actualizarVistasUI();
cargarProductos();
cargarCategorias();