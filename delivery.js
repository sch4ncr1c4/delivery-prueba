let db;
const request = indexedDB.open("DeliveryDB", 4);

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
    mostrarColumnas();
    iniciarActualizador();
};

//
// 1️⃣ CREAR DELIVERY
//
function crearDelivery() {
    const nombre = document.getElementById("newDelivery").value.trim();
    const sueldo = parseInt(document.getElementById("newSueldo").value.trim());

    if (!nombre || !sueldo) {
        alert("Complete nombre y sueldo.");
        return;
    }

    const tx = db.transaction("deliveries", "readwrite");
    tx.objectStore("deliveries").put({ nombre, sueldo });

    tx.oncomplete = () => {
        document.getElementById("newDelivery").value = "";
        document.getElementById("newSueldo").value = "";
        mostrarColumnas();
    };
}

//
// 2️⃣ GUARDAR ENVÍO
//
function guardarEnvio(deliveryNombre, tipo) {
    const pedido = document.getElementById(`pedido-${deliveryNombre}`).value.trim();
    const envio = parseInt(document.getElementById(`envio-${deliveryNombre}`).value.trim());

    if (!pedido || !envio) {
        alert("Complete todos los campos del envío.");
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

//
// 3️⃣ MOSTRAR COLUMNAS
//
function mostrarColumnas() {
    const cont = document.getElementById("columnas");
    cont.innerHTML = "";

    const tx1 = db.transaction("deliveries", "readonly");

    tx1.objectStore("deliveries").getAll().onsuccess = function (e) {
        const deliveries = e.target.result;

        deliveries.forEach(del => {
            const col = document.createElement("div");
            col.className = "columna";

            col.innerHTML = `
                <h2>${del.nombre}</h2>
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
                </div>

                <div id="envios-${del.nombre}"></div>
                <div id="entregados-${del.nombre}" class="entregados" style="display:none;"></div>
            `;

            cont.appendChild(col);

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
                    if (r.tipo === "Vuelto") totalVuelto += r.envio;
                    else totalEnvios += r.envio;

                    const item = document.createElement("div");
                    item.className = "envio-item";

                    const hora = new Date(r.timestamp).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit"
                    });

                    let minutosHTML = "";
                    if (r.estado === "en_camino" && r.salidaTimestamp) {
                        minutosHTML = `<p><b>Minutos afuera:</b>
                            <span id="min-${r.id}">0</span> min</p>`;
                    }

                    item.innerHTML = `
                        <p><b>Pedido:</b> ${r.pedido}</p>
                        <p><b>Envío:</b> $${r.envio.toLocaleString("es-AR")}</p>
                        <p><b>Tipo:</b>
                            <span style="color:${
                                r.tipo === "MasDelivery" ? "#00bfff" :
                                r.tipo === "Peya" ? "#ff4d4d" : "green"
                            };">${r.tipo}</span>
                        </p>
                        <p><b>Hora:</b> ${hora}</p>
                        ${minutosHTML}
                        <p><b>Estado:</b>
                            <span style="color:${
                                r.estado === "entregado" ? "green" :
                                r.estado === "en_camino" ? "orange" : "gray"
                            };">${r.estado}</span>
                        </p>
                    `;

                    if (r.estado === "creado") {
                        const btn = document.createElement("button");
                        btn.textContent = "🚀 Salió";
                        btn.className = "btn-estado";
                        btn.onclick = () => cambiarEstado(r.id, "en_camino");
                        item.appendChild(btn);
                    }

                    if (r.estado === "en_camino") {
                        const btn = document.createElement("button");
                        btn.textContent = "✔ Entregado";
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

                // Totales
                divEnvios.insertAdjacentHTML("afterbegin", `
                    <div class="totales-container">
                        <p><b>Total envíos:</b> $${totalEnvios.toLocaleString("es-AR")}</p>
                        <p><b style="color:orange;">Total vuelto:</b> $${totalVuelto.toLocaleString("es-AR")}</p>
                        <p><b style="color:green;">TOTAL del día: $${totalFinal.toLocaleString("es-AR")}</b></p>
                    </div>
                    <hr style="margin:10px 0;">
                `);

                // Botón toggle entregados
                let btnToggle = document.getElementById(`toggle-${del.nombre}`);
                if (!btnToggle) {
                    btnToggle = document.createElement("button");
                    btnToggle.className = "btn-toggle";
                    btnToggle.id = `toggle-${del.nombre}`;
                    btnToggle.onclick = () => toggleEntregados(del.nombre);
                }
                btnToggle.textContent = `Ver entregados (${countEntregados})`;
                btnToggle.style.display = countEntregados === 0 ? "none" : "block";

                // Insertar botón después de totales
                const totalesDiv = divEnvios.querySelector(".totales-container");
                totalesDiv.insertAdjacentElement("afterend", btnToggle);

                // Insertar entregados arriba de envíos activos
                totalesDiv.insertAdjacentElement("afterend", divEntregados);

                actualizarMinutosAfuera();
            };
        });
    };
}

//
// 4️⃣ CAMBIAR ESTADO
//
function cambiarEstado(id, nuevoEstado) {
    const tx = db.transaction("envios", "readwrite");
    const store = tx.objectStore("envios");

    const req = store.get(id);

    req.onsuccess = () => {
        const envio = req.result;
        envio.estado = nuevoEstado;

        if (nuevoEstado === "en_camino") {
            envio.salidaTimestamp = Date.now();
        }

        store.put(envio);
    };

    tx.oncomplete = () => mostrarColumnas();
}

//
// ⭐ MINUTOS AFUERA
//
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

//
// BORRAR ENVÍO
//
function borrarEnvio(id) {
    const tx = db.transaction("envios", "readwrite");
    tx.objectStore("envios").delete(id);
    tx.oncomplete = () => mostrarColumnas();
}

//
// ELIMINAR DELIVERY
//
function eliminarDelivery() {
    const nombre = document.getElementById("newDelivery").value.trim();

    if (!nombre) {
        mostrarModal("Ingrese el nombre del delivery a eliminar.");
        return;
    }

    mostrarModal(`¿Eliminar el delivery "${nombre}" y todos sus envíos?`, false, () => {
        const tx1 = db.transaction("deliveries", "readwrite");
        tx1.objectStore("deliveries").delete(nombre);

        tx1.oncomplete = () => {
            const tx2 = db.transaction("envios", "readwrite");
            const index = tx2.objectStore("envios").index("delivery");

            index.getAllKeys(nombre).onsuccess = (ev) => {
                ev.target.result.forEach(id => tx2.objectStore("envios").delete(id));
            };

            tx2.oncomplete = () => {
                mostrarColumnas();
                document.getElementById("newDelivery").value = "";
                document.getElementById("newSueldo").value = "";
                mostrarModal(`Delivery "${nombre}" eliminado.`);
            };
        };
    });
}

//
// MODAL
//
function mostrarModal(mensaje, mostrarInput = false, callbackOK = null) {
    const modal = document.getElementById("modal");
    const mensajeElem = document.getElementById("modal-mensaje");
    const input = document.getElementById("modal-input");
    const btnOK = document.getElementById("modal-ok");
    const btnCancel = document.getElementById("modal-cancel");

    mensajeElem.textContent = mensaje;
    input.style.display = mostrarInput ? "block" : "none";
    input.value = "";

    modal.style.display = "flex";

    btnOK.onclick = () => {
        modal.style.display = "none";
        if (callbackOK) callbackOK(input.value);
    };

    btnCancel.onclick = () => {
        modal.style.display = "none";
    };
}

//
// BORRAR TODO
//
function borrarTodo() {
    const tx1 = db.transaction("deliveries", "readwrite");
    tx1.objectStore("deliveries").clear();

    const tx2 = db.transaction("envios", "readwrite");
    tx2.objectStore("envios").clear();

    Promise.all([
        new Promise(res => tx1.oncomplete = res),
        new Promise(res => tx2.oncomplete = res)
    ]).then(() => {
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
        btn.textContent = `Ver menos (${cantidad})`;
    } else {
        div.style.display = "none";
        btn.textContent = `Ver entregados (${cantidad})`;
    }
}


//
// CONFIRMAR BORRADO TOTAL
//
function confirmarBorrado() {
    mostrarModal(
        "¿Seguro que deseas borrar TODOS los deliveries y envíos? Esta acción no se puede deshacer.",
        false,
        () => borrarTodo()
    );
}
