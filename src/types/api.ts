/**
 * TypeScript types matching the InfraSScanField module REST API responses.
 * Mirrors the shapes documented in `docs/API.md` of the Dolibarr module.
 */

// ─── Auth ─────────────────────────────────────────────────────────────

export type Platform = 'android' | 'ios';

export interface LoginRequest {
  login: string;
  password: string;
  device_uuid?: string;
  platform?: Platform;
  app_version?: string;
}

export interface UserPublic {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  email: string;
  admin: 0 | 1;
  photo?: string;
  employee?: 0 | 1;
  fk_soc: number;
  entity: number;
}

export type PermissionKey =
  | 'InfraSScanFieldUse'
  | 'InfraSScanFieldScan'
  | 'InfraSScanFieldEquipPhoto'
  | 'InfraSScanFieldView'
  | 'InfraSScanFieldParamMenu'
  | 'paramBkpRest';

export type Permissions = Record<PermissionKey, boolean>;

export interface ClientSettings {
  token_lifetime_days: number;
  max_upload_size_mb: number;
  default_scan_dpi: number;
  pdf_compression: 'low' | 'medium' | 'high';
}

export interface LicenseInfo {
  valid: boolean;
  mode: 'stub' | 'remote';
  expires_at: string | null;
  max_users: number;
  current_users: number;
}

export interface InstanceInfo {
  name: string;
  country_code: string;
  currency: string;
  dol_version: string;
  module_version: string;
  entity: number;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: UserPublic;
  permissions: Permissions;
  settings: ClientSettings;
  license: LicenseInfo;
}

export interface MeResponse {
  user: UserPublic;
  permissions: Permissions;
  settings: ClientSettings;
  instance: InstanceInfo;
}

// ─── Dashboard ────────────────────────────────────────────────────────

export interface InterventionRow {
  id: number;
  ref: string;
  fk_soc: number;
  soc_name: string;
  date_creation: string;
  date_valid: string | null;
  duration: number;
  description: string;
  status: number;
}

export interface InvoiceRow {
  id: number;
  ref: string;
  fk_soc: number;
  soc_name: string;
  date: string;
  date_valid: string | null;
  total_ttc: number;
  status: number;
  paid: 0 | 1;
}

export interface ProposalRow {
  id: number;
  ref: string;
  fk_soc: number;
  soc_name: string;
  total_ttc: number;
  date: string;
  date_end: string | null;
  status: number;
}

export interface ProjectRow {
  id: number;
  ref: string;
  title: string;
  fk_soc: number;
  soc_name: string;
  date_start: string | null;
  date_end: string | null;
  opp_amount: number;
  status: number;
}

export interface ContractRow {
  id: number;
  ref: string;
  ref_customer: string;
  fk_soc: number;
  soc_name: string;
  date: string;
  status: number;
}

export interface ThirdpartyRow {
  id: number;
  name: string;
  code_client: string;
  code_supplier: string;
  is_customer: 0 | 1;
  is_supplier: 0 | 1;
  email: string;
  phone: string;
  zip: string;
  town: string;
  country_code: string;
}

export interface SyncQueueStatus {
  pending: number;
  failed: number;
}

export interface DashboardResponse {
  interventions_today: InterventionRow[];
  interventions_pending_count: number;
  invoices_recent: InvoiceRow[];
  proposals_to_sign: ProposalRow[];
  scan_recent_count: number;
  sync_queue_status: SyncQueueStatus;
}

// ─── Pagination ───────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type InterventionsAssignedResponse = Paginated<InterventionRow>;
export type InvoicesAccessibleResponse = Paginated<InvoiceRow>;
export type ProposalsAccessibleResponse = Paginated<ProposalRow>;
export type ProjectsAssignedResponse = Paginated<ProjectRow>;
export type ContractsAccessibleResponse = Paginated<ContractRow>;
export type ThirdpartiesSearchResponse = Paginated<ThirdpartyRow>;

// ─── Documents upload ─────────────────────────────────────────────────

export type ModulePart = 'facture' | 'propal' | 'ficheinter' | 'projet' | 'contrat';
export type ScanType = 'document' | 'equipment_photo';

export interface Geolocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface UploadRequest {
  modulepart: ModulePart;
  object_id: number;
  filename: string;
  filedata: string; // base64
  scan_type?: ScanType;
  geolocation?: Geolocation | null;
  scanned_at?: string;
  device_uuid?: string;
  idempotency_key: string;
}

export interface UploadResponse {
  success: true;
  idempotent: boolean;
  scan_log_id: number;
  file_path: string;
  file_url: string;
}

// ─── API errors ───────────────────────────────────────────────────────

export interface ApiErrorBody {
  error: string;
  code?: number;
  message?: string;
}
