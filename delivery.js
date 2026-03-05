let db;
const request = indexedDB.open("DeliveryDB", 4);

let topZIndex = 20;
let movimientoBloqueado = true;
const entregadosAbiertos = {};

request.onupgradeneeded = function (e) {
    db = e.target.result;

    if (!db.objectStoreNames.contains("deliveries")) {
        db.createObjectStore("deliveries", { keyPath: "nombre" });
    }

    if (!db.objectStoreNames.contains("envios")) {
        const store = db.createObjectStore("envios", { keyPath: "id", autoIncrement: true });
        store.createIndex("delivery", "delivery");
    } else {
        const store = e.target.transaction.objectStore("envios");
        if (!store.indexNames.contains("delivery")) {
            store.createIndex("delivery", "delivery");
        }
    }
};

request.onsuccess = function (e) {
    db = e.target.result;
    actualizarBotonBloqueo();
    configurarEnterCrearDelivery();
    mostrarColumnas();
    iniciarActualizador();
};

function obtenerIconoVehiculo(vehiculo) {
    return vehiculo === "auto" ? "🚗" : "🏍️";
}

function crearDelivery() {
    const nombre = document.getElementById("newDelivery").value.trim();
    const sueldo = parseInt(document.getElementById("newSueldo").value.trim(), 10);
    const vehiculo = document.getElementById("newVehiculo").value;

    if (!nombre || Number.isNaN(sueldo)) {
        alert("Complete nombre y sueldo.");
        return;
    }

    const tx = db.transaction("deliveries", "readwrite");
    const store = tx.objectStore("deliveries");
    const req = store.get(nombre);

    req.onsuccess = () => {
        const existente = req.result;
        store.put({
            nombre,
            sueldo,
            vehiculo: vehiculo || existente?.vehiculo || "moto",
            x: existente?.x ?? null,
            y: existente?.y ?? null,
            adelanto: existente?.adelanto ?? 0
        });
    };

    tx.oncomplete = () => {
        document.getElementById("newDelivery").value = "";
        document.getElementById("newSueldo").value = "";
        document.getElementById("newVehiculo").value = "moto";
        mostrarColumnas();
    };
};

function configurarEnterCrearDelivery() {
    const nombreInput = document.getElementById("newDelivery");
    const sueldoInput = document.getElementById("newSueldo");
    if (!nombreInput || !sueldoInput) return;

    const onEnter = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        crearDelivery();
    };

    nombreInput.addEventListener("keydown", onEnter);
    sueldoInput.addEventListener("keydown", onEnter);
}

function guardarEnvio(deliveryNombre, tipo) {
    const pedido = document.getElementById(`pedido-${deliveryNombre}`).value.trim();
    const envio = parseInt(document.getElementById(`envio-${deliveryNombre}`).value.trim(), 10);

    if (!pedido || Number.isNaN(envio)) {
        alert("Complete todos los campos del envio.");
        return;
    }

    const tx = db.transaction("envios", "readwrite");

    tx.objectStore("envios").add({
        delivery: deliveryNombre,
        pedido,
        envio,
        tipo,
        estado: "creado",
        timestamp: Date.now()
    });

    tx.oncomplete = () => {
        document.getElementById(`pedido-${deliveryNombre}`).value = "";
        document.getElementById(`envio-${deliveryNombre}`).value = "";
        mostrarColumnas();
    };
}

function mostrarColumnas() {
    const cont = document.getElementById("columnas");
    cont.innerHTML = "";

    const tx1 = db.transaction("deliveries", "readonly");

    tx1.objectStore("deliveries").getAll().onsuccess = function (e) {
        const deliveries = e.target.result;

        deliveries.forEach((del, index) => {
            const vehiculo = del.vehiculo || "moto";
            const iconoVehiculo = obtenerIconoVehiculo(vehiculo);
            const col = document.createElement("div");
            col.className = "columna";
            col.dataset.delivery = del.nombre;

            const defaultX = 18 + (index % 3) * 355;
            const defaultY = 18 + Math.floor(index / 3) * 520;
            const x = Number.isFinite(del.x) ? del.x : defaultX;
            const y = Number.isFinite(del.y) ? del.y : defaultY;

            col.style.left = `${x}px`;
            col.style.top = `${y}px`;
            col.style.zIndex = String(++topZIndex);

            col.innerHTML = `
                <h2>${del.nombre}<span class="vehiculo-icono">${iconoVehiculo}</span></h2>
                <p><b>Sueldo base:</b> $${del.sueldo.toLocaleString("es-AR")}</p>

                <div class="form-envio">
                    <input id="pedido-${del.nombre}" type="text" placeholder="Pedido" autocomplete="off">
                    <input id="envio-${del.nombre}" type="number" placeholder="Costo" autocomplete="off">

                    <div class="tipo-buttons">
                        <button class="btn-tipo btn-masdelivery"
                            onclick="guardarEnvio('${del.nombre}', 'MasDelivery')">MasDelivery</button>

                        <button class="btn-tipo btn-peya"
                            onclick="guardarEnvio('${del.nombre}', 'Peya')">PedidosYa</button>

                        <button class="btn-tipo btn-vuelto"
                            onclick="guardarEnvio('${del.nombre}', 'Vuelto')">Vuelto</button>
                    </div>
                    <button class="btn-adelanto"
                        onclick="registrarAdelanto('${del.nombre}')">ADELANTO</button>
                </div>

                <div id="envios-${del.nombre}"></div>
                <div id="entregados-${del.nombre}" class="entregados" style="display:none;"></div>
            `;

            cont.appendChild(col);
            habilitarDrag(col, del.nombre);

            const tx2 = db.transaction("envios", "readonly");
            const enviosStore = tx2.objectStore("envios").index("delivery");

            enviosStore.getAll(del.nombre).onsuccess = function (ev) {
                const lista = ev.target.result;
                const divEnvios = document.getElementById(`envios-${del.nombre}`);
                const divEntregados = document.getElementById(`entregados-${del.nombre}`);

                let totalEnvios = 0;
                let totalVuelto = 0;
                let countEntregados = 0;

                divEnvios.innerHTML = "";
                divEntregados.innerHTML = "";

                lista.forEach(r => {
                    if (r.tipo === "Vuelto") {
                        totalVuelto += r.envio;
                    } else {
                        totalEnvios += r.envio;
                    }

                    const item = document.createElement("div");
                    item.className = "envio-item";

                    const hora = new Date(r.timestamp).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit"
                    });

                    let minutosHTML = "";
                    if (r.estado === "en_camino" && r.salidaTimestamp) {
                        minutosHTML = `<p><b>Minutos afuera:</b> <span id="min-${r.id}">0</span> min</p>`;
                    } else if (r.estado === "entregado") {
                        const tiempoFinal = r.tiempoFinalMinutos ?? 0;
                        minutosHTML = `<p><b>Tiempo final:</b> ${tiempoFinal} min</p>`;
                    }

                    item.innerHTML = `
                        <p><b>Pedido:</b> ${r.pedido}</p>
                        <p><b>Envio:</b> $${r.envio.toLocaleString("es-AR")}</p>
                        <p><b>Tipo:</b>
                            <span style="color:${
                                r.tipo === "MasDelivery" ? "#0ea5e9" :
                                r.tipo === "Peya" ? "#ef4444" : "#16a34a"
                            }">${r.tipo}</span>
                        </p>
                        <p><b>Hora:</b> ${hora}</p>
                        ${minutosHTML}
                        <p><b>Estado:</b>
                            <span style="color:${
                                r.estado === "entregado" ? "#15803d" :
                                r.estado === "en_camino" ? "#ea580c" : "#6b7280"
                            }">${r.estado}</span>
                        </p>
                    `;

                    if (r.estado === "creado") {
                        const btn = document.createElement("button");
                        btn.textContent = "Salio";
                        btn.className = "btn-estado";
                        btn.onclick = () => cambiarEstado(r.id, "en_camino");
                        item.appendChild(btn);
                    }

                    if (r.estado === "en_camino") {
                        const btn = document.createElement("button");
                        btn.textContent = "Entregado";
                        btn.className = "btn-estado-entregado";
                        btn.onclick = () => cambiarEstado(r.id, "entregado");
                        item.appendChild(btn);
                    }

                    const btnBorrar = document.createElement("button");
                    btnBorrar.textContent = "X";
                    btnBorrar.className = "btn-borrar";
                    btnBorrar.onclick = () => borrarEnvio(r.id);
                    item.appendChild(btnBorrar);

                    if (r.estado === "entregado") {
                        countEntregados++;
                        divEntregados.appendChild(item);
                    } else {
                        divEnvios.appendChild(item);
                    }
                });

                const totalFinal = del.sueldo + totalEnvios;
                const adelanto = del.adelanto || 0;
                const totalAPagar = totalFinal - adelanto;

                divEnvios.insertAdjacentHTML("afterbegin", `
                    <div class="totales-container">
                        <p class="linea-total"><b>Total envios:</b> $${totalEnvios.toLocaleString("es-AR")}</p>
                        <p class="linea-total"><b style="color:#ea580c;">Total vuelto:</b> $${totalVuelto.toLocaleString("es-AR")}</p>
                        <p class="linea-total"><b style="color:#7c3aed;">ADELANTO:</b> $${adelanto.toLocaleString("es-AR")}</p>
                        <p class="linea-total"><b style="color:#0f766e;">TOTAL A PAGAR:</b> $${totalAPagar.toLocaleString("es-AR")}</p>
                        <p class="linea-total"><b style="color:#15803d;">Pasar en gastos:</b> $${totalFinal.toLocaleString("es-AR")}</p>                       
                    </div>
                    <hr style="margin:10px 0; border: 0; border-top: 1px solid #dbe7f2;">
                `);

                let btnToggle = document.getElementById(`toggle-${del.nombre}`);
                if (!btnToggle) {
                    btnToggle = document.createElement("button");
                    btnToggle.className = "btn-toggle";
                    btnToggle.id = `toggle-${del.nombre}`;
                    btnToggle.onclick = () => toggleEntregados(del.nombre);
                }

                const abierto = Boolean(entregadosAbiertos[del.nombre]) && countEntregados > 0;
                divEntregados.style.display = abierto ? "block" : "none";
                btnToggle.textContent = abierto
                    ? `Cerrar (${countEntregados})`
                    : `Ver mas (${countEntregados})`;
                btnToggle.style.display = countEntregados === 0 ? "none" : "block";

                const totalesDiv = divEnvios.querySelector(".totales-container");
                totalesDiv.insertAdjacentElement("afterend", btnToggle);
                btnToggle.insertAdjacentElement("afterend", divEntregados);

                actualizarMinutosAfuera();
            };
        });
    };
}

function habilitarDrag(columna, nombre) {
    const handle = columna.querySelector("h2");
    if (!handle) return;

    handle.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (movimientoBloqueado) return;

        const rect = columna.getBoundingClientRect();
        const parentRect = columna.parentElement.getBoundingClientRect();

        const startOffsetX = e.clientX - rect.left;
        const startOffsetY = e.clientY - rect.top;

        columna.classList.add("dragging");
        columna.style.zIndex = String(++topZIndex);

        const move = (event) => {
            let left = event.clientX - parentRect.left - startOffsetX;
            let top = event.clientY - parentRect.top - startOffsetY;

            if (left < 0) left = 0;
            if (top < 0) top = 0;

            columna.style.left = `${left}px`;
            columna.style.top = `${top}px`;
        };

        const up = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
            columna.classList.remove("dragging");

            let leftFinal = parseInt(columna.style.left, 10) || 0;
            let topFinal = parseInt(columna.style.top, 10) || 0;

            if (haySuperposicion(columna, leftFinal, topFinal)) {
                const libre = buscarPosicionLibre(columna, leftFinal, topFinal);
                leftFinal = libre.left;
                topFinal = libre.top;
                columna.style.left = `${leftFinal}px`;
                columna.style.top = `${topFinal}px`;
            }

            guardarPosicion(nombre, leftFinal, topFinal);
        };

        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
    });
}

function toggleBloqueoMovimiento() {
    movimientoBloqueado = !movimientoBloqueado;
    actualizarBotonBloqueo();
}

function actualizarBotonBloqueo() {
    const btn = document.getElementById("btn-bloqueo-mov");
    if (!btn) return;

    if (movimientoBloqueado) {
        btn.textContent = "Movimiento bloqueado";
        btn.classList.add("activo");
        document.body.classList.add("movimiento-bloqueado");
    } else {
        btn.textContent = "Movimiento desbloqueado";
        btn.classList.remove("activo");
        document.body.classList.remove("movimiento-bloqueado");
    }
}

function haySuperposicion(columnaActual, left, top) {
    const rectActual = {
        left,
        top,
        right: left + columnaActual.offsetWidth,
        bottom: top + columnaActual.offsetHeight
    };

    const columnas = document.querySelectorAll(".columna");
    for (const otra of columnas) {
        if (otra === columnaActual) continue;

        const otherLeft = parseInt(otra.style.left, 10) || 0;
        const otherTop = parseInt(otra.style.top, 10) || 0;
        const rectOtra = {
            left: otherLeft,
            top: otherTop,
            right: otherLeft + otra.offsetWidth,
            bottom: otherTop + otra.offsetHeight
        };

        if (rectangulosSePisan(rectActual, rectOtra, 10)) return true;
    }

    return false;
}

function rectangulosSePisan(a, b, separacion = 0) {
    return !(
        a.right + separacion <= b.left ||
        a.left >= b.right + separacion ||
        a.bottom + separacion <= b.top ||
        a.top >= b.bottom + separacion
    );
}

function buscarPosicionLibre(columnaActual, baseLeft, baseTop) {
    if (!haySuperposicion(columnaActual, baseLeft, baseTop)) {
        return { left: baseLeft, top: baseTop };
    }

    const paso = 24;
    const maxRadio = 1600;

    for (let radio = paso; radio <= maxRadio; radio += paso) {
        for (let dx = -radio; dx <= radio; dx += paso) {
            const candidatos = [
                { left: baseLeft + dx, top: baseTop - radio },
                { left: baseLeft + dx, top: baseTop + radio }
            ];

            for (const c of candidatos) {
                const left = Math.max(0, c.left);
                const top = Math.max(0, c.top);
                if (!haySuperposicion(columnaActual, left, top)) {
                    return { left, top };
                }
            }
        }

        for (let dy = -radio + paso; dy <= radio - paso; dy += paso) {
            const candidatos = [
                { left: baseLeft - radio, top: baseTop + dy },
                { left: baseLeft + radio, top: baseTop + dy }
            ];

            for (const c of candidatos) {
                const left = Math.max(0, c.left);
                const top = Math.max(0, c.top);
                if (!haySuperposicion(columnaActual, left, top)) {
                    return { left, top };
                }
            }
        }
    }

    return { left: Math.max(0, baseLeft), top: Math.max(0, baseTop) };
}

function guardarPosicion(nombre, x, y) {
    const tx = db.transaction("deliveries", "readwrite");
    const store = tx.objectStore("deliveries");

    const req = store.get(nombre);
    req.onsuccess = () => {
        const delivery = req.result;
        if (!delivery) return;
        delivery.x = x;
        delivery.y = y;
        store.put(delivery);
    };
}

function registrarAdelanto(nombre) {
    const txLectura = db.transaction("deliveries", "readonly");
    const storeLectura = txLectura.objectStore("deliveries");
    const reqLectura = storeLectura.get(nombre);

    reqLectura.onsuccess = () => {
        const delivery = reqLectura.result;
        if (!delivery) return;

        const adelantoActual = delivery.adelanto || 0;

        mostrarModal(
            `Ingrese monto de adelanto para ${nombre}:`,
            true,
            (valor) => {
                const monto = parseInt((valor || "").trim(), 10);

                if (Number.isNaN(monto) || monto < 0) {
                    mostrarModal("Ingrese un monto valido (0 o mayor).");
                    return;
                }

                const tx = db.transaction("deliveries", "readwrite");
                const store = tx.objectStore("deliveries");
                const req = store.get(nombre);

                req.onsuccess = () => {
                    const deliveryEditado = req.result;
                    if (!deliveryEditado) return;
                    deliveryEditado.adelanto = monto;
                    store.put(deliveryEditado);
                };

                tx.oncomplete = () => mostrarColumnas();
            },
            {
                placeholder: "Adelanto aqui",
                valorInicial: String(adelantoActual)
            }
        );
    };
}

function cambiarEstado(id, nuevoEstado) {
    const tx = db.transaction("envios", "readwrite");
    const store = tx.objectStore("envios");

    const req = store.get(id);

    req.onsuccess = () => {
        const envio = req.result;
        envio.estado = nuevoEstado;

        if (nuevoEstado === "en_camino") {
            envio.salidaTimestamp = Date.now();
            envio.tiempoFinalMinutos = null;
        }

        if (nuevoEstado === "entregado") {
            if (envio.salidaTimestamp) {
                envio.tiempoFinalMinutos = Math.floor((Date.now() - envio.salidaTimestamp) / 60000);
            } else {
                envio.tiempoFinalMinutos = 0;
            }
        }

        store.put(envio);
    };

    tx.oncomplete = () => mostrarColumnas();
}

function actualizarMinutosAfuera() {
    const tx = db.transaction("envios", "readonly");

    tx.objectStore("envios").getAll().onsuccess = (e) => {
        e.target.result.forEach(r => {
            if (r.estado !== "en_camino") return;
            if (!r.salidaTimestamp) return;

            const el = document.getElementById(`min-${r.id}`);
            if (!el) return;

            const minutos = Math.floor((Date.now() - r.salidaTimestamp) / 60000);
            el.textContent = minutos;
        });
    };
}

function iniciarActualizador() {
    setInterval(actualizarMinutosAfuera, 30000);
}

function borrarEnvio(id) {
    const tx = db.transaction("envios", "readwrite");
    tx.objectStore("envios").delete(id);
    tx.oncomplete = () => mostrarColumnas();
}

function eliminarDelivery() {
    const nombre = document.getElementById("newDelivery").value.trim();

    if (!nombre) {
        mostrarModal("Ingrese el nombre del delivery a eliminar.");
        return;
    }

    mostrarModal(`Eliminar el delivery "${nombre}" y todos sus envios?`, false, () => {
        const tx1 = db.transaction("deliveries", "readwrite");
        tx1.objectStore("deliveries").delete(nombre);

        tx1.oncomplete = () => {
            const tx2 = db.transaction("envios", "readwrite");
            const index = tx2.objectStore("envios").index("delivery");

            index.getAllKeys(nombre).onsuccess = (ev) => {
                ev.target.result.forEach(id => tx2.objectStore("envios").delete(id));
            };

            tx2.oncomplete = () => {
                delete entregadosAbiertos[nombre];
                mostrarColumnas();
                document.getElementById("newDelivery").value = "";
                document.getElementById("newSueldo").value = "";
                mostrarModal(`Delivery "${nombre}" eliminado.`);
            };
        };
    });
}

function mostrarModal(mensaje, mostrarInput = false, callbackOK = null, opcionesInput = {}) {
    const modal = document.getElementById("modal");
    const mensajeElem = document.getElementById("modal-mensaje");
    const input = document.getElementById("modal-input");
    const btnOK = document.getElementById("modal-ok");
    const btnCancel = document.getElementById("modal-cancel");
    const placeholder = opcionesInput.placeholder || "Adelanto aqui";
    const valorInicial = opcionesInput.valorInicial || "";

    mensajeElem.textContent = mensaje;
    input.style.display = mostrarInput ? "block" : "none";
    input.placeholder = placeholder;
    input.value = mostrarInput ? valorInicial : "";

    modal.style.display = "flex";

    if (mostrarInput) {
        input.focus();
        input.select();
    }

    btnOK.onclick = () => {
        modal.style.display = "none";
        if (callbackOK) callbackOK(input.value);
    };

    btnCancel.onclick = () => {
        modal.style.display = "none";
    };
}

function cerrarTodosLosModales() {
    document.querySelectorAll(".modal").forEach((modal) => {
        modal.style.display = "none";
    });
}

function borrarTodo() {
    const tx1 = db.transaction("deliveries", "readwrite");
    tx1.objectStore("deliveries").clear();

    const tx2 = db.transaction("envios", "readwrite");
    tx2.objectStore("envios").clear();

    Promise.all([
        new Promise(res => tx1.oncomplete = res),
        new Promise(res => tx2.oncomplete = res)
    ]).then(() => {
        Object.keys(entregadosAbiertos).forEach(key => delete entregadosAbiertos[key]);
        mostrarColumnas();
        mostrarModal("Todos los datos fueron eliminados.");
    });
}

function toggleEntregados(nombre) {
    const div = document.getElementById(`entregados-${nombre}`);
    const btn = document.getElementById(`toggle-${nombre}`);

    const match = btn.textContent.match(/\((\d+)\)/);
    const cantidad = match ? match[1] : 0;

    if (div.style.display === "none") {
        div.style.display = "block";
        btn.textContent = `Cerrar (${cantidad})`;
        entregadosAbiertos[nombre] = true;
    } else {
        div.style.display = "none";
        btn.textContent = `Ver mas (${cantidad})`;
        entregadosAbiertos[nombre] = false;
    }
}

function confirmarBorrado() {
    mostrarModal(
        "Seguro que deseas borrar TODOS los deliveries y envios? Esta accion no se puede deshacer.",
        false,
        () => borrarTodo()
    );
}

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    cerrarTodosLosModales();
});
