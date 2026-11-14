# Deuda Técnica Conocida (Spotlight / Overlay / Hover)

1. **`re_assert_topmost` y cambio de estilo**: Cambia el estilo extendido después de `SetWindowPos` y sin `SWP_FRAMECHANGED`; se ejecuta desde el worker.
2. **Monitor primario con monitor vecino**: Desactivación del HUD en el borde colindante con otro monitor (decisión consciente de diseño para no interferir con el cruce del cursor).
3. **Ventana de microsegundos**: Existe un intervalo de microsegundos entre la evaluación de la guarda en `re_assert_topmost` y la finalización de `open_spotlight` (impacto acotado: en el peor de los casos requerir repetir `Alt+Space`).
