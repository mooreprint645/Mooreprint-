(function () {
  function form(title, result, affects, doesNot, check, fields) {
    return { title, result, affects, doesNot, check, fields };
  }

  const FORM_GUIDES = {
    businessForm:form('Datos del negocio','Actualiza información general y configuración base.',['settings','orders','quotes','cash'],'No crea ventas, compras ni pagos.','Confirma identidad, teléfono, RFC y saldo inicial.',{
      name:['Nombre del negocio','Identifica a la empresa.','Aparecerá en notas y cotizaciones.','Usa el nombre que reconocen tus clientes.'],
      phone:['Teléfono','Medio principal de contacto.','Aparecerá en documentos futuros.','Revisa lada y número.'],
      rfc:['RFC','Identificador fiscal del negocio.','Se reutiliza en facturación.','Verifícalo con la constancia fiscal.'],
      openingCash:['Saldo inicial de caja','Dinero con el que comienza el control.','Aumenta o reduce el saldo calculado de Caja.','Captúralo una sola vez con el monto real.'],
      monthlyHours:['Horas de trabajo al mes','Base para repartir ciertos costos.','Puede cambiar el costo sugerido por hora.','Usa tiempo productivo realista.']
    }),
    customerForm:form('Cliente','Crea o actualiza una ficha reutilizable.',['customers','quotes','orders','invoicing'],'No crea una venta ni registra un cobro.','Busca primero para evitar duplicados.',{
      name:['Nombre','Identifica al cliente.','Se mostrará en pedidos y cotizaciones.','Escríbelo siempre de la misma manera.'],
      phone:['Teléfono','Permite confirmar diseño, pago y entrega.','Se copia al seleccionar al cliente.','No mezcles dos clientes en el mismo contacto.'],
      rfc:['RFC del cliente','Dato necesario para factura.','Se reutiliza en el expediente fiscal.','Confírmalo con la constancia fiscal.']
    }),
    supplierForm:form('Proveedor','Guarda contacto y referencia de quien vende materiales.',['suppliers','purchases','inventory'],'No aumenta existencias ni registra deuda.','Confirma contacto y condiciones de compra.',{
      name:['Nombre del proveedor','Identifica a quien vende el material.','Se usa al registrar compras.','Evita duplicados innecesarios.'],
      contact:['Persona de contacto','Indica con quién se realizó la compra.','Facilita aclaraciones posteriores.','No sustituye el nombre del proveedor.']
    }),
    materialForm:form('Material','Crea o actualiza una existencia controlable.',['inventory','products','orders','reports'],'No registra una compra ni un pago.','Confirma unidad, existencia, mínimo y costo.',{
      name:['Material','Insumo que compras y consumes.','Podrá usarse en recetas de productos.','Separa medidas o acabados distintos.'],
      unit:['Unidad','Forma en que se cuenta el material.','Todas las entradas y salidas usan esta unidad.','No cambies de pieza a paquete sin convertir.'],
      stock:['Existencia','Cantidad disponible actualmente.','Define el punto inicial del inventario.','Para entradas futuras usa Compras.'],
      minStock:['Existencia mínima','Nivel que activa una alerta.','Aparece en Avisos.','Define un nivel que permita volver a comprar.'],
      unitCost:['Costo unitario','Costo de una sola unidad.','Afecta inventario y costo de productos.','Divide correctamente paquetes o rollos.']
    }),
    adjustmentForm:form('Ajuste de inventario','Corrige existencia sin crear una compra.',['inventory','reports','notifications'],'No registra factura, proveedor ni salida de Caja.','Úsalo solo para conteo o corrección.',{
      direction:['Dirección','Define si agregas o retiras existencia.','Suma o resta del material.','Revisa el signo antes de confirmar.'],
      quantity:['Cantidad','Número de unidades a corregir.','Cambia la existencia.','Usa la unidad del material.'],
      reason:['Motivo','Explica la corrección.','Aparece en movimientos.','Describe la causa real.']
    }),
    productForm:form('Producto y costo','Guarda precio, costos y receta para ventas futuras.',['products','quotes','orders','inventory','reports'],'No cambia pedidos históricos ni descuenta material.','Revisa costo total, margen y receta.',{
      salePrice:['Precio de venta','Monto cobrado al cliente por unidad.','Afecta total y margen de pedidos futuros.','No lo confundas con costo interno.'],
      laborCost:['Mano de obra','Valor del trabajo necesario.','Aumenta el costo interno.','Incluye preparación, impresión y acabado.'],
      wastePercent:['Desperdicio estimado','Porcentaje previsto de material perdido.','Aumenta el costo sugerido.','Usa datos reales.'],
      targetMarginPercent:['Margen objetivo','Ganancia deseada sobre la venta.','Cambia el precio recomendado.','Margen no significa dinero disponible en Caja.']
    }),
    orderForm:form('Pedido','Confirma una venta y un compromiso de entrega.',['orders','production','calendar','inventory','cash','reports'],'No registra automáticamente todo el pago ni aprueba el diseño.','Verifica cliente, fecha, precio, costo, receta, estado y anticipo.',{
      customerId:['Cliente','Relaciona el trabajo con una ficha.','Permite historial, contacto y saldos.','Selecciona a la persona correcta.'],
      dueDate:['Fecha prometida','Día comprometido con el cliente.','Aparece en Calendario y Avisos.','Usa una fecha posible.'],
      status:['Estado del pedido','Indica si está pendiente, en proceso, listo o entregado.','Puede activar o revertir consumo de inventario.','No avances sin confirmar el trabajo real.'],
      designStatus:['Estado del diseño','Indica si falta preparar o aprobar el archivo.','Ayuda a evitar producir una versión incorrecta.','La aprobación debe ser del diseño final.'],
      deliveryCharge:['Cobro de entrega','Monto que se suma al cliente.','Aumenta el total del pedido.','Diferéncialo del costo real de entregar.'],
      deliveryCost:['Costo de entrega','Lo que el negocio paga por entregar.','Reduce la utilidad.','No lo confundas con el cobro al cliente.'],
      discount:['Descuento','Reducción aplicada al precio.','Baja venta, saldo y utilidad.','Confirma que el margen siga siendo suficiente.']
    }),
    quoteForm:form('Cotización','Guarda una propuesta de precio con vigencia.',['quotes','customers','orders'],'No mueve Caja ni Inventario hasta convertirse en pedido.','Revisa costo, descuento, impuestos y vigencia.',{
      validUntil:['Vigencia','Último día en que respetarás el precio.','Evita vender con costos antiguos.','Usa un plazo acorde con proveedores.'],
      status:['Estado','Indica si está enviada, aceptada o rechazada.','Permite convertirla cuando sea aceptada.','Aceptada no significa pagada.'],
      discount:['Descuento','Reduce la propuesta.','Baja el margen previsto.','Revisa el costo total antes de ofrecerlo.']
    }),
    purchaseForm:form('Compra','Registra material recibido y una posible deuda.',['purchases','inventory','cash','reports'],'No es un gasto operativo ni un ajuste.','Confirma proveedor, cantidad recibida, costo y pago.',{
      supplierId:['Proveedor','Relaciona la compra con quien vendió.','Permite historial y saldo.','Selecciona al proveedor real.'],
      invoice:['Factura o referencia','Identifica el comprobante.','Facilita búsqueda y revisión.','No reutilices la misma referencia.']
    }),
    expenseForm:form('Gasto','Registra un costo operativo y su pago.',['expenses','cash','reports','notifications'],'No aumenta inventario.','Confirma que no se trate de material para venta.',{
      category:['Categoría','Agrupa el tipo de gasto.','Aparece en reportes.','Elige la categoría real.'],
      amount:['Monto','Total de la obligación.','Reduce utilidad y Caja cuando se paga.','No captures solo el abono si el total es mayor.'],
      dueDate:['Vencimiento','Fecha límite para pagar.','Genera avisos.','Captúrala aunque aún no se pague.'],
      includedInPricing:['Incluido en precios','Indica si se reparte en cálculos de costo.','Puede aumentar precios sugeridos.','No marques gastos personales.']
    }),
    recurringForm:form('Gasto recurrente','Programa la generación periódica de un gasto.',['recurring','expenses','notifications','reports'],'No paga el gasto automáticamente.','Confirma monto, día e inicio.',{
      amount:['Monto mensual','Valor de cada gasto generado.','Reduce utilidad cuando se crea.','Actualízalo si cambia el contrato.'],
      day:['Día de pago','Día esperado de cada mes.','Ordena vencimientos y avisos.','Usa el día acordado.']
    }),
    paymentForm:form('Pago o cobro','Aplica dinero a un documento existente.',['cash','orders','purchases','expenses','reports'],'No cambia el total original del documento.','Confirma monto, método, fecha y documento.',{
      amount:['Monto pagado','Cantidad que entra o sale.','Reduce el saldo y mueve Caja.','No excedas el saldo sin revisar.'],
      method:['Método','Indica cómo se movió el dinero.','Separa efectivo, transferencia y otros.','No marques efectivo si fue transferencia.'],
      reference:['Referencia','Identifica la operación.','Facilita conciliación.','Usa un dato verificable.']
    }),
    cashTransactionForm:form('Movimiento manual de caja','Crea una entrada o salida sin documento relacionado.',['cash','dashboard','reports'],'No liquida pedidos, compras o gastos.','Úsalo solo si no existe documento relacionado.',{
      type:['Tipo','Define entrada o salida.','Suma o resta del saldo.','Revisa la dirección.'],
      amount:['Monto','Cantidad del movimiento manual.','Cambia Caja.','No dupliques un cobro de pedido.'],
      description:['Descripción','Explica el origen.','Aparece en Caja y reportes.','Escribe quién, por qué y para qué.']
    }),
    cfdiSettingsForm:form('Configuración fiscal','Guarda datos predeterminados para expedientes.',['settings','invoicing'],'No timbra ni almacena certificados.','Confirma todo con tu contador.',{}),
    cfdiPreparationForm:form('Preparación de CFDI','Guarda el expediente fiscal de un pedido.',['invoicing','customers','orders'],'No genera una factura fiscal válida.','Revisa receptor, claves y forma de pago.',{})
  };

  window.MoorePrintBeginnerForms = { FORM_GUIDES };
})();