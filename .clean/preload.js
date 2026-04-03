const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Company
  company: {
    get: () => ipcRenderer.invoke('company:get'),
    save: (data) => ipcRenderer.invoke('company:save', data),
  },
  // Auth / Users
  auth: {
    login: (creds) => ipcRenderer.invoke('auth:login', creds),
  },
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    add: (u) => ipcRenderer.invoke('users:add', u),
    update: (u) => ipcRenderer.invoke('users:update', u),
    delete: (id) => ipcRenderer.invoke('users:delete', id),
  },
  // Customers
  customers: {
    getAll: () => ipcRenderer.invoke('customers:getAll'),
    add: (c) => ipcRenderer.invoke('customers:add', c),
    update: (c) => ipcRenderer.invoke('customers:update', c),
    delete: (id) => ipcRenderer.invoke('customers:delete', id),
  },
  // Suppliers
  suppliers: {
    getAll: () => ipcRenderer.invoke('suppliers:getAll'),
    add: (s) => ipcRenderer.invoke('suppliers:add', s),
    update: (s) => ipcRenderer.invoke('suppliers:update', s),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
  },
  // Categories
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    add: (name) => ipcRenderer.invoke('categories:add', name),
    delete: (id) => ipcRenderer.invoke('categories:delete', id),
  },
  // Products
  products: {
    getAll: () => ipcRenderer.invoke('products:getAll'),
    add: (p) => ipcRenderer.invoke('products:add', p),
    update: (p) => ipcRenderer.invoke('products:update', p),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    updateStock: (data) => ipcRenderer.invoke('products:updateStock', data),
    getLowStock: () => ipcRenderer.invoke('products:getLowStock'),
  },
  // Ledgers
  ledgerGroups: {
    getAll: () => ipcRenderer.invoke('ledgerGroups:getAll'),
  },
  ledgers: {
    getAll: () => ipcRenderer.invoke('ledgers:getAll'),
    add: (l) => ipcRenderer.invoke('ledgers:add', l),
    update: (l) => ipcRenderer.invoke('ledgers:update', l),
    delete: (id) => ipcRenderer.invoke('ledgers:delete', id),
    getTransactions: (id) => ipcRenderer.invoke('ledgers:getTransactions', id),
  },
  // Daily Funds
  dailyFunds: {
    getAll: () => ipcRenderer.invoke('dailyFunds:getAll'),
    add: (data) => ipcRenderer.invoke('dailyFunds:add', data),
    delete: (id) => ipcRenderer.invoke('dailyFunds:delete', id),
  },
  // Financial Years
  financialYears: {
    getAll: () => ipcRenderer.invoke('financialYears:getAll'),
    getCurrent: () => ipcRenderer.invoke('financialYears:getCurrent'),
    add: (fy) => ipcRenderer.invoke('financialYears:add', fy),
  },
  // Sales
  sales: {
    getNextNumber: () => ipcRenderer.invoke('sales:getNextNumber'),
    getAll: () => ipcRenderer.invoke('sales:getAll'),
    getById: (id) => ipcRenderer.invoke('sales:getById', id),
    save: (data) => ipcRenderer.invoke('sales:save', data),
    delete: (id) => ipcRenderer.invoke('sales:delete', id),
  },
  // Purchase
  purchase: {
    getNextNumber: () => ipcRenderer.invoke('purchase:getNextNumber'),
    getAll: () => ipcRenderer.invoke('purchase:getAll'),
    getById: (id) => ipcRenderer.invoke('purchase:getById', id),
    save: (data) => ipcRenderer.invoke('purchase:save', data),
    delete: (id) => ipcRenderer.invoke('purchase:delete', id),
  },
  // Quotations
  quotations: {
    getNextNumber: () => ipcRenderer.invoke('quotations:getNextNumber'),
    getAll: () => ipcRenderer.invoke('quotations:getAll'),
    getById: (id) => ipcRenderer.invoke('quotations:getById', id),
    save: (data) => ipcRenderer.invoke('quotations:save', data),
    delete: (id) => ipcRenderer.invoke('quotations:delete', id),
    convertToSale: (id) => ipcRenderer.invoke('quotations:convertToSale', id),
  },
  // Credit/Debit Notes
  creditNotes: {
    getAll: () => ipcRenderer.invoke('creditNotes:getAll'),
    save: (data) => ipcRenderer.invoke('creditNotes:save', data),
  },
  debitNotes: {
    getAll: () => ipcRenderer.invoke('debitNotes:getAll'),
    save: (data) => ipcRenderer.invoke('debitNotes:save', data),
  },
  // Delivery Notes
  deliveryNotes: {
    getAll: () => ipcRenderer.invoke('deliveryNotes:getAll'),
    save: (data) => ipcRenderer.invoke('deliveryNotes:save', data),
  },
  // Reports
  reports: {
    salesSummary: (params) => ipcRenderer.invoke('reports:salesSummary', params),
    purchaseSummary: (params) => ipcRenderer.invoke('reports:purchaseSummary', params),
    gstSummary: (params) => ipcRenderer.invoke('reports:gstSummary', params),
    stockReport: () => ipcRenderer.invoke('reports:stockReport'),
    customerLedger: (id) => ipcRenderer.invoke('reports:customerLedger', id),
    supplierLedger: (id) => ipcRenderer.invoke('reports:supplierLedger', id),
    dashboardStats: () => ipcRenderer.invoke('reports:dashboardStats'),
  },
  // Logs
  logs: {
    getAll: () => ipcRenderer.invoke('logs:getAll'),
  },
  // Backup
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
  },
  // File/Shell
  dialog: {
    openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  },
  file: {
    readBase64: (path) => ipcRenderer.invoke('file:readBase64', path),
    save: (data) => ipcRenderer.invoke('file:save', data),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  updates: {
    check: (params) => ipcRenderer.invoke('updates:check', params),
    openDownload: (url) => ipcRenderer.invoke('updates:openDownload', url),
  },
});
