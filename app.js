// Detectar ENTER y DELETE
document.addEventListener("keydown", function(event) {

    const pago = document.getElementById("pago");
    const precio = document.getElementById("precio");

    // ENTER
    if (event.key === "Enter") {

        // Si no hay nada seleccionado → enfocar primer input
        if (document.activeElement !== pago && document.activeElement !== precio) {
            pago.focus();
            return;
        }

        // Si estamos en el primer input → pasar al segundo
        if (document.activeElement === pago) {
            precio.focus();
            return;
        }

        // Si estamos en el segundo input → calcular
        if (document.activeElement === precio) {
            calcularVuelto();
            return;
        }
    }

    // DELETE o BACKSPACE → limpiar inputs y volver al primero
    document.addEventListener("keydown", (event) => {
        if (event.key === "Insert") {
            console.log("Tocaste INSERT");
            limpiarTodo();
            pago.focus();
    }
});
});


// Formatear con puntos
function formatear(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Quitar puntos
function limpiar(num) {
    return num.replace(/\./g, "");
}

// Limpiar inputs y resultado
function limpiarTodo() {
    document.getElementById("pago").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("resultado").innerHTML = "";
}


// AUTO-FORMATO
["pago", "precio"].forEach(id => {
    const input = document.getElementById(id);

    input.addEventListener("input", (e) => {
        let valor = e.target.value;

        // Solo números
        valor = valor.replace(/\D/g, "");

        if (valor !== "") {
            valor = formatear(valor);
        }

        e.target.value = valor;
    });
});


// CALCULAR VUELTO
function calcularVuelto() {
    let pago = document.getElementById("pago").value;
    let precio = document.getElementById("precio").value;
    let resultado = document.getElementById("resultado");

    pago = parseFloat(limpiar(pago));
    precio = parseFloat(limpiar(precio));

    if (isNaN(pago) || isNaN(precio)) {
        resultado.innerHTML = "❌ Ingrese números válidos";
        resultado.style.color = "red";
        return;
    }

    let vuelto = pago - precio;

    if (vuelto < 0) {
        resultado.innerHTML = "❗ Falta dinero: el cliente debe " + formatear(Math.abs(vuelto));
        resultado.style.color = "red";
    } else if (vuelto === 0) {
        resultado.innerHTML = "✔ No hay vuelto, está justo";
        resultado.style.color = "black";
    } else {
        resultado.innerHTML = "💰 El vuelto es: " + formatear(vuelto);
        resultado.style.color = "green";
    }
}
