import type {
  LanguageCode,
  PaymentCategory,
  PaymentMethod,
  RecurrenceCycle,
} from '../types/payment';

export const TRANSLATIONS: Record<
  LanguageCode,
  {
    brand: string;
    nav: {
      queue: string;
      ledger: string;
      calendar: string;
      history: string;
      import: string;
      categoriesHeading: string;
      preferencesHeading: string;
    };
    actions: {
      newPayment: string;
      markPaid: string;
      customSettle: string;
      edit: string;
      delete: string;
      undo: string;
      save: string;
      cancel: string;
      exportCsv: string;
      restoreDemo: string;
      clearAll: string;
      today: string;
      prevMonth: string;
      nextMonth: string;
      pause: string;
      resume: string;
    };
    kpis: {
      dueSoon: string;
      dueSoonSub: (dueCount: number, overdueCount: number) => string;
      remainingMonth: string;
      remainingMonthSub: (count: number) => string;
      paidMonth: string;
      paidMonthSub: (pct: number, count: number) => string;
      monthlyBase: string;
      monthlyBaseSub: string;
    };
    filters: {
      searchPlaceholder: string;
      allCategories: string;
      allMethods: string;
      manualOnly: string;
      autopayOnly: string;
      allStatuses: string;
      overdueOnly: string;
      activeOnly: string;
      pausedOnly: string;
    };
    sections: {
      overdue: string;
      dueWeek: string;
      upcoming: string;
      paused: string;
    };
    status: {
      overdue: string;
      dueToday: string;
      dueInDays: (days: number) => string;
      overdueByDays: (days: number) => string;
      scheduled: string;
      paused: string;
      autopay: string;
      manual: string;
      paid: string;
    };
    categories: Record<PaymentCategory, string>;
    recurrences: Record<RecurrenceCycle, string>;
    methods: Record<PaymentMethod, string>;
    table: {
      concept: string;
      categoryCycle: string;
      dueDate: string;
      method: string;
      amount: string;
      status: string;
      actions: string;
      paidDate: string;
      notes: string;
    };
    drawer: {
      createTitle: string;
      editTitle: string;
      settleTitle: string;
      conceptLabel: string;
      conceptPlaceholder: string;
      payeeLabel: string;
      payeePlaceholder: string;
      categoryLabel: string;
      amountLabel: string;
      dueDateLabel: string;
      recurrenceLabel: string;
      methodLabel: string;
      autopayLabel: string;
      autopayHint: string;
      referenceLabel: string;
      referencePlaceholder: string;
      notesLabel: string;
      notesPlaceholder: string;
      pausedLabel: string;
      settleAmountLabel: string;
      settleDateLabel: string;
      confirmSettle: string;
      advanceNote: (nextDate: string | null) => string;
    };
    calendar: {
      weeklyLoadTitle: string;
      weekLabel: (n: number) => string;
      noPaymentsDay: string;
      noPaymentsDayShort: string;
      dayHeader: (dateStr: string) => string;
      addForDay: string;
      addShort: string;
      weekdays: string[];
      tapDayHint: string;
      tapWeekHint: string;
      tapDayViewHint: string;
      dueOnDayTitle: string;
      pendingByDateTitle: string;
      pendingByDateHint: string;
      pendingBeforeWeekTitle: string;
      pendingBeforeWeekHint: string;
      dayTotalLabel: string;
      accumulatedTotalLabel: string;
      weekTotalLabel: string;
      projectedNote: (currentDueStr: string) => string;
      prevDay: string;
      nextDay: string;
      prevWeek: string;
      nextWeek: string;
      closeDrawer: string;
      moreCount: (n: number) => string;
      viewMonth: string;
      viewWeek: string;
      viewDay: string;
      openDayDetail: string;
      openFullDayView: string;
      viewPendingByDate: string;
      openWeekAction: string;
    };
    history: {
      totalFiltered: string;
      paymentsCount: (n: number) => string;
      allMonths: string;
      showingRange: (start: number, end: number, total: number) => string;
      prevPage: string;
      nextPage: string;
    };
    empty: {
      queueTitle: string;
      queueBody: string;
      filteredTitle: string;
      filteredBody: string;
      historyTitle: string;
      historyBody: string;
      resetFilters: string;
    };
    preferences: {
      currency: string;
      language: string;
      confirmClear: string;
    };
    account: {
      signInGoogle: string;
      signOut: string;
      syncing: string;
      cloudSynced: string;
      localModeTitle: string;
      localModeBody: string;
      importLocalBtn: (count: number) => string;
      popupBlocked: string;
      authErrorGeneric: string;
      quotaError: string;
    };
    importer: {
      tabFile: string;
      tabPhoto: string;
      downloadTemplate: string;
      dropFileTitle: string;
      dropFileHint: string;
      chooseFile: string;
      pasteLabel: string;
      pastePlaceholder: string;
      parseTextBtn: string;
      dropPhotoTitle: string;
      dropPhotoHint: string;
      choosePhoto: string;
      openCamera: string;
      capturePhoto: string;
      switchCamera: string;
      closeCamera: string;
      cameraDenied: string;
      cameraUnavailable: string;
      analyzing: string;
      previewTitle: (count: number) => string;
      selectAll: string;
      clearPreview: string;
      importSelected: (count: number) => string;
      noRowsError: string;
      importedSuccess: (count: number) => string;
    };
    pwa: {
      installApp: string;
      installIOS: string;
      iosTitle: string;
      iosStep1: string;
      iosStep2: string;
      close: string;
      offlineBanner: string;
    };
  }
> = {
  es: {
    brand: 'FlujoPago',
    nav: {
      queue: 'Flujo próximo',
      ledger: 'Obligaciones',
      calendar: 'Calendario',
      history: 'Historial',
      import: 'Importar',
      categoriesHeading: 'Por categoría',
      preferencesHeading: 'Preferencias',
    },
    actions: {
      newPayment: 'Nuevo pago',
      markPaid: 'Marcar pagado',
      customSettle: 'Registrar monto',
      edit: 'Editar',
      delete: 'Eliminar',
      undo: 'Deshacer',
      save: 'Guardar pago',
      cancel: 'Cancelar',
      exportCsv: 'Exportar CSV',
      restoreDemo: 'Cargar ejemplos',
      clearAll: 'Vaciar todo',
      today: 'Hoy',
      prevMonth: 'Anterior',
      nextMonth: 'Siguiente',
      pause: 'Pausar',
      resume: 'Reanudar',
    },
    kpis: {
      dueSoon: 'Urgente (próximos 7 días)',
      dueSoonSub: (dueCount, overdueCount) =>
        overdueCount > 0
          ? `${overdueCount} vencido(s) · ${dueCount} por vencer`
          : `${dueCount} pago(s) en ventana de 7 días`,
      remainingMonth: 'Pendiente este mes',
      remainingMonthSub: (count) => `${count} obligación(es) por cubrir`,
      paidMonth: 'Pagado este mes',
      paidMonthSub: (pct, count) => `${pct}% completado · ${count} liquidado(s)`,
      monthlyBase: 'Carga mensual base',
      monthlyBaseSub: 'Promedio prorrateado recurrente',
    },
    filters: {
      searchPlaceholder: 'Buscar por concepto, beneficiario o referencia...',
      allCategories: 'Todas',
      allMethods: 'Todos',
      manualOnly: 'Manual',
      autopayOnly: 'Domiciliado',
      allStatuses: 'Todos',
      overdueOnly: 'Vencidos',
      activeOnly: 'Activos',
      pausedOnly: 'Pausados',
    },
    sections: {
      overdue: 'Vencidos',
      dueWeek: 'Próximos 7 días',
      upcoming: 'Siguientes fechas',
      paused: 'En pausa',
    },
    status: {
      overdue: 'Vencido',
      dueToday: 'Vence hoy',
      dueInDays: (days) => (days === 1 ? 'En 1 día' : `En ${days} días`),
      overdueByDays: (days) =>
        days === 1 ? 'Atraso de 1 día' : `Atraso de ${days} días`,
      scheduled: 'Programado',
      paused: 'Pausado',
      autopay: 'Domiciliado',
      manual: 'Manual',
      paid: 'Pagado',
    },
    categories: {
      rent: 'Renta y vivienda',
      tuition: 'Colegiaturas',
      services: 'Servicios',
      subscriptions: 'Suscripciones',
      other: 'Otros',
    },
    recurrences: {
      one_time: 'Pago único',
      monthly: 'Mensual',
      bimonthly: 'Bimestral',
      quarterly: 'Trimestral',
      semester: 'Semestral',
      annual: 'Anual',
    },
    methods: {
      transfer: 'Transferencia',
      credit_card: 'Tarjeta crédito',
      debit_card: 'Tarjeta débito',
      cash: 'Efectivo',
      direct_debit: 'Cargo automático',
    },
    table: {
      concept: 'Concepto y referencia',
      categoryCycle: 'Categoría y ciclo',
      dueDate: 'Vencimiento',
      method: 'Método',
      amount: 'Monto',
      status: 'Estado',
      actions: 'Acciones',
      paidDate: 'Fecha de pago',
      notes: 'Notas',
    },
    drawer: {
      createTitle: 'Nueva obligación de pago',
      editTitle: 'Editar obligación',
      settleTitle: 'Registrar pago realizado',
      conceptLabel: 'Concepto',
      conceptPlaceholder: 'Ej. Alquiler, Mensualidad colegio, Matrícula UCR, CNFL',
      payeeLabel: 'Beneficiario o proveedor',
      payeePlaceholder: 'Ej. CNFL, AyA, Kölbi, UCR, Colegio La Salle',
      categoryLabel: 'Categoría',
      amountLabel: 'Monto estimado o fijo',
      dueDateLabel: 'Próxima fecha de vencimiento',
      recurrenceLabel: 'Frecuencia',
      methodLabel: 'Método de pago',
      autopayLabel: 'Pago domiciliado (automático)',
      autopayHint: 'Márcalo si se carga automáticamente a tu cuenta o tarjeta.',
      referenceLabel: 'Referencia / N.º servicio (opcional)',
      referencePlaceholder: 'Ej. Contrato #ESC-402, NIS 882194...',
      notesLabel: 'Notas (opcional)',
      notesPlaceholder: 'Detalles de cuenta IBAN, SINPE Móvil o recordatorio...',
      pausedLabel: 'Pausar temporalmente',
      settleAmountLabel: 'Monto liquidado',
      settleDateLabel: 'Fecha en que se realizó el pago',
      confirmSettle: 'Confirmar pago',
      advanceNote: (nextDate) =>
        nextDate
          ? `Al confirmar, la próxima fecha avanzará automáticamente al ${nextDate}.`
          : 'Es un pago único: se archivará en el historial al confirmarlo.',
    },
    calendar: {
      weeklyLoadTitle: 'Distribución semanal del mes (toca una semana para abrirla)',
      weekLabel: (n) => `Semana ${n}`,
      noPaymentsDay: 'No hay pagos pendientes ni programados para esta fecha.',
      noPaymentsDayShort: 'Sin pagos programados',
      dayHeader: (dateStr) => `Pagos del ${dateStr}`,
      addForDay: 'Programar en esta fecha',
      addShort: 'Programar',
      weekdays: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      tapDayHint: 'Toca cualquier día para ver y gestionar los pagos pendientes a esa fecha.',
      tapWeekHint: 'Toca cualquier día o pago de la semana para liquidar, editar o programar.',
      tapDayViewHint: 'Vista diaria interactiva con vencimientos del día y pendientes acumulados.',
      dueOnDayTitle: 'Programados para este día',
      pendingByDateTitle: 'Otros pendientes previos a esta fecha',
      pendingByDateHint: 'Obligaciones activas cuyo vencimiento es anterior a este día y aún no se han liquidado.',
      pendingBeforeWeekTitle: 'Pendientes previos a esta semana',
      pendingBeforeWeekHint: 'Obligaciones activas sin liquidar con vencimiento anterior al inicio de esta semana.',
      dayTotalLabel: 'Total del día',
      accumulatedTotalLabel: 'Pendiente acumulado a la fecha',
      weekTotalLabel: 'Total de la semana',
      projectedNote: (currentDueStr) => `Proyección recurrente · próximo vencimiento actual: ${currentDueStr}`,
      prevDay: 'Día anterior',
      nextDay: 'Día siguiente',
      prevWeek: 'Semana anterior',
      nextWeek: 'Semana siguiente',
      closeDrawer: 'Cerrar detalle del día',
      moreCount: (n) => `+${n} más`,
      viewMonth: 'Mensual',
      viewWeek: 'Semanal',
      viewDay: 'Diaria',
      openDayDetail: 'Ver detalle',
      openFullDayView: 'Vista diaria',
      viewPendingByDate: 'Ver pendientes a la fecha',
      openWeekAction: 'Abrir semana',
    },
    history: {
      totalFiltered: 'Total liquidado',
      paymentsCount: (n) => `${n} registro(s)`,
      allMonths: 'Todos los meses',
      showingRange: (start, end, total) => `Mostrando ${start}–${end} de ${total}`,
      prevPage: 'Anterior',
      nextPage: 'Siguiente',
    },
    empty: {
      queueTitle: 'Sin obligaciones pendientes',
      queueBody:
        'Agrega rentas, servicios o colegiaturas para organizar tus próximos vencimientos.',
      filteredTitle: 'Ningún pago coincide con el filtro',
      filteredBody:
        'Prueba limpiando la búsqueda o seleccionando otra categoría.',
      historyTitle: 'Aún no hay pagos liquidados',
      historyBody:
        'Cuando marques un pago como realizado, aparecerá registrado aquí.',
      resetFilters: 'Limpiar filtros',
    },
    preferences: {
      currency: 'Moneda',
      language: 'Idioma',
      confirmClear: '¿Vaciar todas las obligaciones e historial?',
    },
    account: {
      signInGoogle: 'Conectar con Google',
      signOut: 'Cerrar sesión',
      syncing: 'Sincronizando cuenta...',
      cloudSynced: 'Sincronizado en la nube',
      localModeTitle: 'Modo local (solo este navegador)',
      localModeBody:
        'Inicia sesión con Google para guardar y sincronizar tus pagos en todos tus dispositivos.',
      importLocalBtn: (count) =>
        `Importar ${count} registro(s) de este navegador`,
      popupBlocked:
        'El navegador bloqueó la ventana de acceso. Permite las ventanas emergentes e intenta de nuevo.',
      authErrorGeneric: 'No se pudo completar el inicio de sesión.',
      quotaError:
        'Se alcanzó el límite diario gratuito de base de datos. Se restablecerá mañana.',
    },
    importer: {
      tabFile: 'Excel, CSV o TXT',
      tabPhoto: 'Foto o captura de Excel',
      downloadTemplate: 'Descargar plantilla Excel',
      dropFileTitle: 'Sube un archivo Excel (.xlsx, .xls), CSV o TXT',
      dropFileHint:
        'Detecta columnas automáticamente (Concepto, Proveedor, Monto, Vencimiento, Categoría, Frecuencia).',
      chooseFile: 'Seleccionar archivo',
      pasteLabel: 'O pega filas desde Excel / lista de texto',
      pastePlaceholder:
        'Pega aquí celdas copiadas de Excel, CSV o notas como:\nCNFL Electricidad, 34800, 15/11/2026\nAyA Agua potable, 16400, mensual',
      parseTextBtn: 'Procesar texto',
      dropPhotoTitle: 'Toma una foto o sube una captura de Excel / recibos',
      dropPhotoHint:
        'Compatible con fotos de hojas impresas, capturas de pantalla de Excel o listados de cobros.',
      choosePhoto: 'Subir imagen o captura',
      openCamera: 'Usar cámara',
      capturePhoto: 'Capturar foto',
      switchCamera: 'Cambiar cámara',
      closeCamera: 'Cerrar cámara',
      cameraDenied:
        'Permiso de cámara denegado. Habilita el acceso en tu navegador o sube una imagen.',
      cameraUnavailable:
        'No se detectó cámara activa en este dispositivo. Puedes subir una imagen o usar la cámara nativa.',
      analyzing: 'Analizando tabla y extrayendo cobros...',
      previewTitle: (count) => `Vista previa editable (${count} detectado(s))`,
      selectAll: 'Marcar / desmarcar todos',
      clearPreview: 'Descartar lista',
      importSelected: (count) => `Importar ${count} obligación(es)`,
      noRowsError:
        'No se detectaron filas con concepto y monto válidos. Verifica las columnas o usa una imagen más nítida.',
      importedSuccess: (count) =>
        `Se importaron ${count} obligación(es) correctamente.`,
    },
    pwa: {
      installApp: 'Instalar aplicación',
      installIOS: 'Instalar en iPhone / iPad',
      iosTitle: 'Instalar FlujoPago en iOS',
      iosStep1: 'Toca el botón Compartir en la barra de Safari',
      iosStep2: 'Desliza hacia abajo y selecciona "Agregar a inicio".',
      close: 'Cerrar',
      offlineBanner: 'Sin conexión — Mostrando datos locales guardados',
    },
  },
  en: {
    brand: 'FlujoPago',
    nav: {
      queue: 'Upcoming Flow',
      ledger: 'Obligations',
      calendar: 'Calendar',
      history: 'History',
      import: 'Import',
      categoriesHeading: 'By category',
      preferencesHeading: 'Preferences',
    },
    actions: {
      newPayment: 'New payment',
      markPaid: 'Mark paid',
      customSettle: 'Log custom amount',
      edit: 'Edit',
      delete: 'Delete',
      undo: 'Undo',
      save: 'Save payment',
      cancel: 'Cancel',
      exportCsv: 'Export CSV',
      restoreDemo: 'Load samples',
      clearAll: 'Clear all',
      today: 'Today',
      prevMonth: 'Previous',
      nextMonth: 'Next',
      pause: 'Pause',
      resume: 'Resume',
    },
    kpis: {
      dueSoon: 'Urgent (next 7 days)',
      dueSoonSub: (dueCount, overdueCount) =>
        overdueCount > 0
          ? `${overdueCount} overdue · ${dueCount} due soon`
          : `${dueCount} payment(s) in 7-day window`,
      remainingMonth: 'Remaining this month',
      remainingMonthSub: (count) => `${count} obligation(s) left`,
      paidMonth: 'Paid this month',
      paidMonthSub: (pct, count) => `${pct}% settled · ${count} payment(s)`,
      monthlyBase: 'Monthly baseline',
      monthlyBaseSub: 'Normalized recurring burn rate',
    },
    filters: {
      searchPlaceholder: 'Search by concept, payee, or reference...',
      allCategories: 'All',
      allMethods: 'All',
      manualOnly: 'Manual',
      autopayOnly: 'Autopay',
      allStatuses: 'All',
      overdueOnly: 'Overdue',
      activeOnly: 'Active',
      pausedOnly: 'Paused',
    },
    sections: {
      overdue: 'Overdue',
      dueWeek: 'Next 7 days',
      upcoming: 'Later dates',
      paused: 'Paused',
    },
    status: {
      overdue: 'Overdue',
      dueToday: 'Due today',
      dueInDays: (days) => (days === 1 ? 'In 1 day' : `In ${days} days`),
      overdueByDays: (days) =>
        days === 1 ? '1 day overdue' : `${days} days overdue`,
      scheduled: 'Scheduled',
      paused: 'Paused',
      autopay: 'Autopay',
      manual: 'Manual',
      paid: 'Paid',
    },
    categories: {
      rent: 'Rent & housing',
      tuition: 'Tuition',
      services: 'Utilities & services',
      subscriptions: 'Subscriptions',
      other: 'Other',
    },
    recurrences: {
      one_time: 'One-time',
      monthly: 'Monthly',
      bimonthly: 'Bimonthly',
      quarterly: 'Quarterly',
      semester: 'Semester',
      annual: 'Annual',
    },
    methods: {
      transfer: 'Bank transfer',
      credit_card: 'Credit card',
      debit_card: 'Debit card',
      cash: 'Cash',
      direct_debit: 'Direct debit',
    },
    table: {
      concept: 'Concept & reference',
      categoryCycle: 'Category & cycle',
      dueDate: 'Due date',
      method: 'Method',
      amount: 'Amount',
      status: 'Status',
      actions: 'Actions',
      paidDate: 'Paid date',
      notes: 'Notes',
    },
    drawer: {
      createTitle: 'New payment obligation',
      editTitle: 'Edit obligation',
      settleTitle: 'Record settled payment',
      conceptLabel: 'Concept',
      conceptPlaceholder: 'e.g., Apartment Rent, University Tuition, Power Bill',
      payeeLabel: 'Payee or provider',
      payeePlaceholder: 'e.g., North Realty, State University',
      categoryLabel: 'Category',
      amountLabel: 'Fixed or estimated amount',
      dueDateLabel: 'Next due date',
      recurrenceLabel: 'Recurrence',
      methodLabel: 'Payment method',
      autopayLabel: 'Autopay enabled',
      autopayHint: 'Enable if this bill is charged automatically.',
      referenceLabel: 'Reference / Account # (optional)',
      referencePlaceholder: 'e.g., Lease #408-B, Service #9812...',
      notesLabel: 'Notes (optional)',
      notesPlaceholder: 'Account details, campus, or reminder notes...',
      pausedLabel: 'Temporarily paused',
      settleAmountLabel: 'Amount paid',
      settleDateLabel: 'Date paid',
      confirmSettle: 'Confirm payment',
      advanceNote: (nextDate) =>
        nextDate
          ? `After confirming, the next due date will advance to ${nextDate}.`
          : 'This is a one-time payment and will move to history once confirmed.',
    },
    calendar: {
      weeklyLoadTitle: 'Monthly weekly load (click a week to open it)',
      weekLabel: (n) => `Week ${n}`,
      noPaymentsDay: 'No pending or scheduled payments for this date.',
      noPaymentsDayShort: 'No scheduled payments',
      dayHeader: (dateStr) => `Payments for ${dateStr}`,
      addForDay: 'Schedule on this day',
      addShort: 'Schedule',
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      tapDayHint: 'Tap any day to open and manage all payments pending as of that date.',
      tapWeekHint: 'Tap any day or payment in the week to settle, edit, or schedule.',
      tapDayViewHint: 'Interactive daily view with scheduled bills and accumulated pending items.',
      dueOnDayTitle: 'Scheduled on this day',
      pendingByDateTitle: 'Earlier pending obligations as of this date',
      pendingByDateHint: 'Active obligations due before this day that remain unpaid.',
      pendingBeforeWeekTitle: 'Pending before this week',
      pendingBeforeWeekHint: 'Active unpaid obligations with due dates prior to the start of this week.',
      dayTotalLabel: 'Day total',
      accumulatedTotalLabel: 'Pending total by this date',
      weekTotalLabel: 'Week total',
      projectedNote: (currentDueStr) => `Recurring projection · current next due date: ${currentDueStr}`,
      prevDay: 'Previous day',
      nextDay: 'Next day',
      prevWeek: 'Previous week',
      nextWeek: 'Next week',
      closeDrawer: 'Close day details',
      moreCount: (n) => `+${n} more`,
      viewMonth: 'Monthly',
      viewWeek: 'Weekly',
      viewDay: 'Daily',
      openDayDetail: 'Open details',
      openFullDayView: 'Daily view',
      viewPendingByDate: 'View pending by date',
      openWeekAction: 'Open week',
    },
    history: {
      totalFiltered: 'Total settled',
      paymentsCount: (n) => `${n} record(s)`,
      allMonths: 'All months',
      showingRange: (start, end, total) => `Showing ${start}–${end} of ${total}`,
      prevPage: 'Previous',
      nextPage: 'Next',
    },
    empty: {
      queueTitle: 'No scheduled obligations',
      queueBody:
        'Add rents, utilities, or tuition installments to organize upcoming due dates.',
      filteredTitle: 'No payments match your filters',
      filteredBody: 'Try clearing the search query or picking another category.',
      historyTitle: 'No settled payments yet',
      historyBody:
        'When you mark an obligation as paid, its transaction log will appear here.',
      resetFilters: 'Reset filters',
    },
    preferences: {
      currency: 'Currency',
      language: 'Language',
      confirmClear: 'Clear all obligations and payment history?',
    },
    account: {
      signInGoogle: 'Sign in with Google',
      signOut: 'Sign out',
      syncing: 'Syncing account...',
      cloudSynced: 'Cloud synced',
      localModeTitle: 'Local mode (this browser only)',
      localModeBody:
        'Sign in with Google to sync your payment schedule and history across all your devices.',
      importLocalBtn: (count) =>
        `Import ${count} record(s) from this browser`,
      popupBlocked:
        'Sign-in popup was blocked by the browser. Allow popups and try again.',
      authErrorGeneric: 'Could not complete sign-in. Please try again.',
      quotaError:
        'Daily free database quota exceeded. It will reset tomorrow.',
    },
    importer: {
      tabFile: 'Excel, CSV, or TXT',
      tabPhoto: 'Photo or Excel screenshot',
      downloadTemplate: 'Download Excel template',
      dropFileTitle: 'Upload an Excel (.xlsx, .xls), CSV, or TXT file',
      dropFileHint:
        'Automatically maps columns (Concept, Payee, Amount, Due Date, Category, Frequency).',
      chooseFile: 'Choose file',
      pasteLabel: 'Or paste rows from Excel / plain text list',
      pastePlaceholder:
        'Paste copied Excel cells, CSV, or notes like:\nCNFL Power, 34800, 15/11/2026\nAyA Water, 16400, monthly',
      parseTextBtn: 'Parse text',
      dropPhotoTitle: 'Take a photo or upload an Excel / bill screenshot',
      dropPhotoHint:
        'Works with printed tables, Excel screenshots, or payment lists.',
      choosePhoto: 'Upload image',
      openCamera: 'Use camera',
      capturePhoto: 'Capture photo',
      switchCamera: 'Switch camera',
      closeCamera: 'Close camera',
      cameraDenied:
        'Camera permission denied. Allow camera access in your browser or upload an image.',
      cameraUnavailable:
        'No active camera detected on this device. You can upload an image instead.',
      analyzing: 'Reading table and extracting obligations...',
      previewTitle: (count) => `Editable preview (${count} detected)`,
      selectAll: 'Toggle all',
      clearPreview: 'Clear preview',
      importSelected: (count) => `Import ${count} obligation(s)`,
      noRowsError:
        'No valid rows with concept and amount were detected. Check the columns or try a clearer image.',
      importedSuccess: (count) =>
        `Successfully imported ${count} obligation(s).`,
    },
    pwa: {
      installApp: 'Install app',
      installIOS: 'Install on iPhone / iPad',
      iosTitle: 'Install FlujoPago on iOS',
      iosStep1: 'Tap the Share button in the Safari toolbar',
      iosStep2: 'Scroll down and tap "Add to Home Screen".',
      close: 'Close',
      offlineBanner: 'Offline — Showing cached local data',
    },
  },
};
