import type { IntegrationType } from '@/types'

interface IntegrationMeta {
  name: string
  description: string
  initials: string
  color: string
  oauthType: 'oauth' | 'file' | 'none'
  authPath?: string
  syncPath?: string
  exportPath?: string
  codeHint?: string  // hint shown in code mapping table for the external field label
}

export const INTEGRATION_META: Record<IntegrationType, IntegrationMeta> = {
  quickbooks: {
    name: 'QuickBooks Online',
    description: 'Payroll & accounting sync',
    initials: 'QB',
    color: '#2CA01C',
    oauthType: 'oauth',
    authPath: '/api/integrations/quickbooks/auth',
    syncPath: '/api/integrations/quickbooks/sync',
    codeHint: 'QBO Service Item ID',
  },
  gusto: {
    name: 'Gusto',
    description: 'HR & payroll',
    initials: 'GU',
    color: '#F46B5D',
    oauthType: 'oauth',
    authPath: '/api/integrations/gusto/auth',
    syncPath: '/api/integrations/gusto/sync',
    codeHint: 'Gusto Earning Code',
  },
  adp: {
    name: 'ADP Workforce Now',
    description: 'Payroll CSV export',
    initials: 'ADP',
    color: '#D6001C',
    oauthType: 'file',
    exportPath: '/api/integrations/adp/export',
    codeHint: 'ADP Earning Code',
  },
  xero: {
    name: 'Xero',
    description: 'Accounting alternative to QBO',
    initials: 'XO',
    color: '#13B5EA',
    oauthType: 'oauth',
    authPath: '/api/integrations/xero/auth',
    syncPath: '/api/integrations/xero/sync',
    codeHint: 'Xero Earnings Rate ID',
  },
  sage_intacct: {
    name: 'Sage Intacct',
    description: 'Government ERP labor export',
    initials: 'SI',
    color: '#00B050',
    oauthType: 'file',
    exportPath: '/api/integrations/sage/export',
    codeHint: 'Project:Task (colon-separated)',
  },
  deltek: {
    name: 'Deltek Vision / Vantagepoint',
    description: 'Feeder file for project ERP',
    initials: 'DT',
    color: '#003087',
    oauthType: 'file',
    exportPath: '/api/integrations/deltek/export',
    codeHint: 'Deltek Task Code',
  },
}

// Order of display on the integrations page
export const INTEGRATION_ORDER: IntegrationType[] = [
  'quickbooks', 'gusto', 'adp', 'xero', 'sage_intacct', 'deltek',
]
